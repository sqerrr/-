import { Simulation } from '../core/simulation.js';
function assert(cond, msg) {
    if (!cond)
        throw new Error(`choice regression: ${msg}`);
}
const sim = new Simulation({ seed: 12345, hz: 60 });
sim.php = 1_000_000;
sim.maxHp = 1_000_000;
let resolved = 0, chained = 0, injectedMutationCore = false;
for (let guard = 0; guard < 60 * 60 * 8 && !sim.finished; guard++) {
    if (sim.hasChoice) {
        const before = sim.snapshot();
        const serial = before.choiceSerial;
        let ok = false;
        if (before.mutationOffer)
            ok = sim.chooseMutation(0);
        else if (before.rewardOffers)
            ok = sim.chooseReward(0);
        assert(ok, `choice ${resolved + 1} was rejected (serial ${serial})`);
        const after = sim.snapshot();
        if (sim.hasChoice) {
            chained++;
            assert(after.choiceSerial > serial, `same choice survived resolution (serial ${serial})`);
        }
        resolved++;
        continue;
    }
    // D6 moved Mutation Cores off level milestones and onto uplifted/legendary elite drops.
    // This driver is about choice lifecycle, not loot routing, so inject one core solely to
    // keep the mutation-target -> branch modal chain under regression coverage.
    if (!injectedMutationCore && sim.snapshot().player.level >= 6) {
        sim.mutationCores = 1;
        injectedMutationCore = true;
    }
    const a = guard * 0.017;
    sim.step({ moveX: Math.cos(a), moveZ: Math.sin(a), aimX: 1, aimZ: -1 });
}
assert(resolved >= 10, `too few choices exercised: ${resolved}`);
console.log(`choice-regression OK resolved=${resolved} chained=${chained} finalSerial=${sim.snapshot().choiceSerial}`);
