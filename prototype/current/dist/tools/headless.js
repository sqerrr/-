import { Simulation } from '../core/simulation.js';
const args = process.argv.slice(2);
const get = (k, d) => {
    const i = args.indexOf(k);
    return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const ticks = Number(get('--ticks', '28800')), seed = Number(get('--seed', '12345')), hz = Number(get('--hz', '60'));
const sim = new Simulation({ seed, hz });
for (let i = 0; i < ticks; i++) {
    const snap = sim.snapshot();
    const a = i / (hz * 4.3), sx = Math.cos(a) * 0.65, sy = Math.sin(a * 0.73) * 0.58;
    const moveX = (sx + sy) * 0.7071, moveZ = (-sx + sy) * 0.7071;
    const targets = [...snap.entities].sort((a, b) => Number(b.elite) - Number(a.elite) ||
        Math.hypot(a.x - snap.player.x, a.z - snap.player.z) -
            Math.hypot(b.x - snap.player.x, b.z - snap.player.z));
    const t = targets[0];
    let ax = Math.cos(a), az = Math.sin(a);
    if (t) {
        const dx = t.x - snap.player.x, dz = t.z - snap.player.z, m = Math.hypot(dx, dz) || 1;
        ax = dx / m;
        az = dz / m;
    }
    sim.step({ moveX, moveZ, aimX: ax, aimZ: az });
    let guard = 0;
    while (sim.hasChoice && guard++ < 10) {
        const s = sim.snapshot();
        if (s.mutationOffer)
            sim.chooseMutation(0);
        else if (s.rewardOffers)
            sim.chooseReward(0);
    }
    const now = sim.snapshot();
    if (now.player.hp <= 0 || now.finished)
        break;
}
const s = sim.snapshot();
const out = {
    seed,
    hz,
    tick: s.tick,
    time: s.time,
    hash: sim.canonicalHash(),
    level: s.player.level,
    metrics: s.metrics,
    alive: s.entities.length,
    hp: s.player.hp,
    skills: s.skills.map((x) => ({ id: x.id, level: x.level, mutation: x.mutation }))
};
console.log(JSON.stringify(out, null, 2));
if (args.includes('--assert')) {
    if (s.metrics.activations < 30 || s.metrics.spawned < 20 || s.player.level < 2) {
        console.error('basic gameplay invariant failed');
        process.exit(1);
    }
    if (!/^[0-9a-f]{8}$/.test(out.hash)) {
        console.error('bad deterministic hash');
        process.exit(1);
    }
}
