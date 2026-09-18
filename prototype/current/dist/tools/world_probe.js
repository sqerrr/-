import { Simulation } from '../core/simulation.js';
const seeds = [11, 22, 33, 44, 55];
const marks = [15, 30, 60, 90, 120, 180, 240, 300, 360, 420, 480];
const rows = new Map(marks.map((m) => [m, { enemies: [], elites: [], shots: [], hp: [], kills: [] }]));
for (const seed of seeds) {
    const sim = new Simulation({ seed, hz: 30 });
    let mi = 0;
    for (let i = 0; i < 480 * 30; i++) {
        const s = sim.snapshot();
        const t = s.entities
            .filter((e) => e.elite)
            .sort((a, b) => Math.hypot(a.x - s.player.x, a.z - s.player.z) -
            Math.hypot(b.x - s.player.x, b.z - s.player.z))[0] ?? s.entities[0];
        let ax = 1, az = 0;
        if (t) {
            const dx = t.x - s.player.x, dz = t.z - s.player.z, m = Math.hypot(dx, dz) || 1;
            ax = dx / m;
            az = dz / m;
        }
        const a = s.time / 5.5;
        sim.step({ moveX: Math.cos(a) * 0.45, moveZ: Math.sin(a * 0.77) * 0.45, aimX: ax, aimZ: az });
        while (sim.hasChoice) {
            const q = sim.snapshot();
            if (q.mutationOffer)
                sim.chooseMutation(0);
            else if (q.rewardOffers)
                sim.chooseReward(0);
        }
        const n = sim.snapshot();
        while (mi < marks.length && n.time >= marks[mi]) {
            const r = rows.get(marks[mi]);
            r.enemies.push(n.entities.filter((e) => !e.elite).length);
            r.elites.push(n.entities.filter((e) => e.elite).length);
            r.shots.push(n.projectiles.length);
            r.hp.push(n.player.hp);
            r.kills.push(n.metrics.killed);
            mi++;
        }
        if (n.player.hp <= 0 || n.finished)
            break;
    }
}
const avg = (x) => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : 0);
const out = [...rows].map(([t, r]) => ({
    t,
    enemies: +avg(r.enemies).toFixed(1),
    elites: +avg(r.elites).toFixed(1),
    enemyProjectiles: +avg(r.shots).toFixed(1),
    hp: +avg(r.hp).toFixed(0),
    kills: +avg(r.kills).toFixed(1),
    samples: r.enemies.length
}));
console.log(JSON.stringify({ seeds, out }, null, 2));
if (process.argv.includes('--assert')) {
    const s15 = out.find((x) => x.t === 15);
    if (s15.enemies > 18)
        throw new Error(`opening too dense: ${s15.enemies}`);
    const s60 = out.find((x) => x.t === 60);
    if (s60.enemyProjectiles > 12)
        throw new Error(`enemy projectile carpet: ${s60.enemyProjectiles}`);
}
