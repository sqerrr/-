import { Simulation } from '../core/simulation.js';
const assert = (ok, msg) => {
    if (!ok) {
        console.error('refusal-regression FAIL: ' + msg);
        process.exit(1);
    }
};
const hz = 60;
const sim = new Simulation({ seed: 12345, hz });
let resolved = 0;
let refusedEvents = 0;
let maxRefusalsAfterResolve = 0;
for (let i = 0; i < 3600; i++) {
    const snap = sim.snapshot();
    const a = i / (hz * 4.3), sx = Math.cos(a) * 0.65, sy = Math.sin(a * 0.73) * 0.58;
    const moveX = (sx + sy) * 0.7071, moveZ = (-sx + sy) * 0.7071;
    const targets = [...snap.entities].sort((p, q) => Number(q.elite) - Number(p.elite) ||
        Math.hypot(p.x - snap.player.x, p.z - snap.player.z) -
            Math.hypot(q.x - snap.player.x, q.z - snap.player.z));
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
        if (s.mutationOffer) {
            // Picking a mutation is not a draft: nothing is conceded to the elites.
            const before = sim.snapshot().refusals.length;
            sim.chooseMutation(0);
            assert(sim.snapshot().refusals.length === before, 'a mutation choice must not concede a card');
        }
        else if (s.rewardOffers) {
            const before = sim.snapshot().refusals.length;
            const offered = s.rewardOffers.length;
            if (sim.chooseReward(0)) {
                const after = sim.snapshot().refusals.length;
                // D7: exactly one of the cards the hero passed over reaches the elites, never more.
                const gained = after - before;
                assert(gained <= 1, 'a single draft conceded ' + gained + ' cards');
                if (offered > 1 && s.rewardOffers[0].kind !== 'mutation_target') {
                    assert(gained === 1, 'a resolved draft conceded nothing');
                    resolved++;
                }
                maxRefusalsAfterResolve = Math.max(maxRefusalsAfterResolve, after);
            }
        }
    }
    // step() clears the event list, so read it after the draft is resolved to catch both
    // the combat events of this tick and anything the choice pushed.
    for (const ev of sim.events)
        if (ev.type === 'RewardRefused')
            refusedEvents++;
    const now = sim.snapshot();
    if (now.player.hp <= 0 || now.finished)
        break;
}
const s = sim.snapshot();
assert(resolved > 0, 'the run resolved no drafts at all');
assert(s.refusals.length > 0, 'the refusal store stayed empty');
assert(s.refusals.length === refusedEvents, 'store size ' + s.refusals.length + ' disagrees with ' + refusedEvents + ' RewardRefused events');
// Serials must be dense and ascending: the store is an ordered history, not a bag.
s.refusals.forEach((c, i) => assert(c.serial === i + 1, 'serial ' + c.serial + ' out of order at index ' + i));
// Nothing claims a card until an elite does (that arrives with the rarity draw).
assert(s.refusals.every((c) => c.heldBy === 0), 'a card is held although no elite has drawn one yet');
// Every conceded card must carry enough identity to be fielded later.
assert(s.refusals.every((c) => !!c.title && !!c.icon && (!!c.skill || !!c.catalyst || !!c.resonance || !!c.stat)), 'a conceded card carries no usable payload');
const byKind = {};
for (const c of s.refusals)
    byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;
console.log('refusal-regression OK', { resolved, stored: s.refusals.length, byKind });
