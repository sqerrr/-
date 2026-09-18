import { Simulation } from '../core/simulation.js';
// Technical regression only: determinism and the fact that planning topology reaches the simulation.
// Showcase is intentional here because the clean run begins with no Catalysts to move.
function run(layout) {
    const sim = new Simulation({ seed: 777, hz: 60, mode: 'showcase' });
    sim.php = 1_000_000;
    sim.maxHp = 1_000_000;
    if (layout === 'moved') {
        if (!sim.swapCatalysts(0, 2))
            throw new Error('catalyst swap rejected');
        if (!sim.swapSkillSlots(1, 3))
            throw new Error('skill swap rejected');
    }
    for (let i = 0; i < 3600; i++) {
        const s = sim.snapshot();
        const elite = s.entities.find((e) => e.elite), t = elite ?? s.entities[0];
        let ax = 1, az = -1;
        if (t) {
            const dx = t.x - s.player.x, dz = t.z - s.player.z, m = Math.hypot(dx, dz) || 1;
            ax = dx / m;
            az = dz / m;
        }
        const a = i * 0.011;
        sim.step({ moveX: Math.cos(a) * 0.35, moveZ: Math.sin(a) * 0.35, aimX: ax, aimZ: az });
        let g = 0;
        while (sim.hasChoice && g++ < 10) {
            const q = sim.snapshot();
            if (q.mutationOffer)
                sim.chooseMutation(0);
            else if (q.rewardOffers)
                sim.chooseReward(0);
        }
    }
    return { hash: sim.canonicalHash(), chain: sim.snapshot().chain };
}
const a = run('default'), b = run('default'), c = run('moved');
if (a.hash !== b.hash)
    throw new Error(`determinism failed ${a.hash} != ${b.hash}`);
if (a.hash === c.hash)
    throw new Error('reordered chain produced identical canonical state');
console.log('chain-regression OK', JSON.stringify({ defaultHash: a.hash, movedHash: c.hash }, null, 2));
