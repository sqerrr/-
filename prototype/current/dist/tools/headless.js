import { Simulation } from '../core/simulation.js';
import { pickOffer, steer } from './driver.js';
const args = process.argv.slice(2);
const get = (k, d) => {
    const i = args.indexOf(k);
    return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const ticks = Number(get('--ticks', '28800')), seed = Number(get('--seed', '12345')), hz = Number(get('--hz', '60'));
const sim = new Simulation({ seed, hz });
for (let i = 0; i < ticks; i++) {
    const snap = sim.snapshot();
    const cmd = steer(snap, i, hz);
    sim.step(cmd);
    let guard = 0;
    while (sim.hasChoice && guard++ < 10) {
        const s = sim.snapshot();
        if (s.mutationOffer)
            sim.chooseMutation(0);
        else if (s.rewardOffers)
            sim.chooseReward(pickOffer(s));
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
