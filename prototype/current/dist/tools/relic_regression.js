/**
 * Relics are the shared source of power D14 asked for, so the things worth proving are not
 * that the feature exists but that it stays shared: they lie where they fall, an elite can
 * reach one first, and whoever takes it is actually changed by it.
 */
import { itemOrder, items } from '../content/items.js';
import { Simulation } from '../core/simulation.js';
function assert(cond, msg) {
    if (!cond)
        throw new Error('relic-regression: ' + msg);
}
// --- the catalogue itself -------------------------------------------------
assert(itemOrder.length === 20, `expected 20 items, got ${itemOrder.length}`);
assert(new Set(itemOrder).size === 20, 'duplicate item id in itemOrder');
const byCategory = new Map();
for (const id of itemOrder) {
    const def = items[id];
    assert(!!def, `${id} has no definition`);
    assert(def.id === id, `${id} disagrees with its own id`);
    assert(def.name.length > 0 && def.short.length > 0, `${id} has no name or short code`);
    assert(def.description.length > 0, `${id} has no description`);
    byCategory.set(def.category, (byCategory.get(def.category) ?? 0) + 1);
}
assert(byCategory.size === 5, `D35 named five categories, found ${byCategory.size}`);
for (const [cat, n] of byCategory)
    assert(n >= 2, `category ${cat} has only ${n} items`);
// --- taking one changes the taker ----------------------------------------
{
    const sim = new Simulation({ seed: 4242, hz: 60 });
    const before = sim.armor;
    sim.takeRelic({ id: 1, x: 0, z: 0, item: 'plating', bornAt: 0 });
    assert(sim.armor > before, 'plating did not add armour');
    assert(sim.heldItems.length === 1, 'the haul did not record the relic');
    const hpBefore = sim.maxHp;
    sim.takeRelic({ id: 2, x: 0, z: 0, item: 'vitality', bornAt: 0 });
    assert(sim.maxHp > hpBefore, 'vitality did not raise the ceiling');
    // D14 forbids slots, so a second copy of the same relic must still count.
    sim.takeRelic({ id: 3, x: 0, z: 0, item: 'plating', bornAt: 0 });
    assert(sim.heldItems.length === 3, 'a repeated relic was swallowed instead of stacking');
}
// --- an elite that reaches one first is changed too -----------------------
{
    const sim = new Simulation({ seed: 777, hz: 60 });
    let elite = null;
    // A standing driver is dead long before the first elite arrives, so it has to keep moving.
    for (let i = 0; i < 60 * 90 && !elite; i++) {
        const t = i / 60;
        sim.step({
            moveX: Math.cos(t * 0.7),
            moveZ: Math.sin(t * 0.7),
            aimX: Math.cos(t * 0.7),
            aimZ: Math.sin(t * 0.7)
        });
        if (sim.hasChoice)
            sim.chooseReward(0);
        elite = sim.ents.find((e) => e.kind === 'elite');
    }
    assert(!!elite, 'no elite appeared in ninety seconds');
    const dpsBefore = elite.contactDps;
    sim.giveEliteRelic(elite, { id: 9, x: elite.x, z: elite.z, item: 'plating', bornAt: 0 });
    assert(elite.contactDps > dpsBefore, 'a guard relic gave the elite nothing');
    const reachBefore = elite.relicReachMul ?? 1;
    sim.giveEliteRelic(elite, { id: 10, x: elite.x, z: elite.z, item: 'spoils', bornAt: 0 });
    assert((elite.relicReachMul ?? 1) > reachBefore, 'a hunt relic gave the elite nothing');
    // None of the counterparts may touch durability: fight length under D49 is tuned through it.
    const hp = elite.maxHp;
    for (const id of itemOrder)
        sim.giveEliteRelic(elite, { id: 11, x: elite.x, z: elite.z, item: id, bornAt: 0 });
    assert(elite.maxHp === hp, 'a relic counterpart moved elite durability, which D49 is tuned on');
}
// --- they appear, they stay put, and they are reachable -------------------
{
    const sim = new Simulation({ seed: 12345, hz: 60 });
    let seen = 0;
    let maxAtOnce = 0;
    let takenByElites = 0;
    for (let i = 0; i < 60 * 420; i++) {
        const t = i / 60;
        // Walk at the nearest relic when there is one: otherwise the circling driver never
        // reaches a single one and the hero side of the shared source goes untested.
        let mx = Math.cos(t * 0.7), mz = Math.sin(t * 0.7);
        if (sim.relics.length) {
            let best = sim.relics[0], bd = Infinity;
            for (const r of sim.relics) {
                const d = Math.hypot(r.x - sim.px, r.z - sim.pz);
                if (d < bd) {
                    bd = d;
                    best = r;
                }
            }
            const d = Math.hypot(best.x - sim.px, best.z - sim.pz) || 1;
            mx = (best.x - sim.px) / d;
            mz = (best.z - sim.pz) / d;
        }
        sim.step({ moveX: mx, moveZ: mz, aimX: mx, aimZ: mz });
        if (sim.hasChoice)
            sim.chooseReward(0);
        for (const e of sim.events)
            if (e.type === 'RelicAppeared')
                seen++;
        for (const r of sim.relics)
            assert(!sim.blocked(r.x, r.z, 0.9), 'a relic sat inside a rock');
        maxAtOnce = Math.max(maxAtOnce, sim.relics.length);
        if (sim.php <= 0)
            break;
    }
    takenByElites = sim.metrics.relicsTakenByElites;
    // The driver dies sooner here than in the other tools, because walking at every relic walks
    // it into the swarm - which is the cost the shared source is supposed to have. So the rate
    // is checked against the time actually survived rather than against the length of a run.
    const expected = Math.floor(sim.time / (Simulation.RELIC_INTERVAL * 1.5));
    assert(seen >= expected, `expected at least ${expected} relics in ${sim.time.toFixed(0)}s, saw ${seen}`);
    assert(seen >= 3, `almost no relics appeared at all: ${seen}`);
    assert(maxAtOnce <= 8, `relics piled up on the field: ${maxAtOnce} at once`);
    assert(sim.metrics.relicsTakenByHero > 0, 'the hero walked straight at every relic and still took none');
    // A relic can now also arrive as a level reward, which fills the haul without anyone
    // walking to it, so the haul is at least the number picked up off the ground rather
    // than exactly it.
    assert(sim.heldItems.length >= sim.metrics.relicsTakenByHero, 'the haul lost track of a relic picked up off the ground');
    console.log('relic-regression OK', {
        catalogue: itemOrder.length,
        categories: byCategory.size,
        survived: `${sim.time.toFixed(1)}s`,
        appeared: seen,
        takenByHero: sim.metrics.relicsTakenByHero,
        takenByElites
    });
}
