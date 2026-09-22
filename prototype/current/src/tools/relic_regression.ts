/**
 * Relics are the shared source of power D14 asked for, so the things worth proving are not
 * that the feature exists but that it stays shared: they lie where they fall, an elite can
 * reach one first, and whoever takes it is actually changed by it.
 */
import { itemOrder, items } from '../content/items.js';
import { Simulation } from '../core/simulation.js';
import { SimulationHarness } from '../testing/simulationHarness.js';
import type { ItemCategory } from '../core/types.js';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('relic-regression: ' + msg);
}

// --- the catalogue itself -------------------------------------------------
assert(itemOrder.length === 20, `expected 20 items, got ${itemOrder.length}`);
assert(new Set(itemOrder).size === 20, 'duplicate item id in itemOrder');
const byCategory = new Map<ItemCategory, number>();
for (const id of itemOrder) {
  const def = items[id];
  assert(!!def, `${id} has no definition`);
  assert(def.id === id, `${id} disagrees with its own id`);
  assert(def.name.length > 0 && def.short.length > 0, `${id} has no name or short code`);
  assert(def.description.length > 0, `${id} has no description`);
  byCategory.set(def.category, (byCategory.get(def.category) ?? 0) + 1);
}
assert(byCategory.size === 5, `D35 named five categories, found ${byCategory.size}`);
for (const [cat, n] of byCategory) assert(n >= 2, `category ${cat} has only ${n} items`);

// --- taking one changes the taker ----------------------------------------
{
  const h = SimulationHarness.create({ seed: 4242, hz: 60 });
  const sim = h.sim;
  const before = sim.armor;
  h.takeRelic({ id: 1, x: 0, z: 0, item: 'plating', bornAt: 0 });
  assert(sim.armor > before, 'plating did not add armour');
  assert(sim.heldItems.length === 1, 'the haul did not record the relic');
  const hpBefore = sim.maxHp;
  h.takeRelic({ id: 2, x: 0, z: 0, item: 'vitality', bornAt: 0 });
  assert(sim.maxHp > hpBefore, 'vitality did not raise the ceiling');
  // D14 forbids slots, so a second copy of the same relic must still count.
  h.takeRelic({ id: 3, x: 0, z: 0, item: 'plating', bornAt: 0 });
  assert(sim.heldItems.length === 3, 'a repeated relic was swallowed instead of stacking');
}

// --- an elite that reaches one first is changed too -----------------------
{
  const h = SimulationHarness.create({ seed: 777, hz: 60 });
  const sim = h.sim;
  let elite = h.entities.find((e) => e.kind === 'elite');
  // A standing driver is dead long before the first elite arrives, so it has to keep moving.
  for (let i = 0; i < 60 * 90 && !elite; i++) {
    const t = i / 60;
    sim.step({
      moveX: Math.cos(t * 0.7),
      moveZ: Math.sin(t * 0.7),
      aimX: Math.cos(t * 0.7),
      aimZ: Math.sin(t * 0.7)
    });
    if (sim.hasChoice) sim.chooseReward(0);
    elite = h.entities.find((e) => e.kind === 'elite');
  }
  assert(!!elite, 'no elite appeared in ninety seconds');
  const hpBefore = elite.maxHp;
  h.giveEliteRelic(elite, { id: 9, x: elite.x, z: elite.z, item: 'plating', bornAt: 0 });
  assert(elite.maxHp > hpBefore, 'plating did not increase elite durability');
  const seekBefore = elite.relicSeekMul ?? 1;
  h.giveEliteRelic(elite, { id: 10, x: elite.x, z: elite.z, item: 'beacon', bornAt: 0 });
  assert((elite.relicSeekMul ?? 1) > seekBefore, 'beacon did not make the elite hunt relics harder');

  // Every catalogue item must have a concrete enemy-side consequence. Categories are only
  // organisation; they no longer collapse twenty relics into five generic rival buffs.
  const sig = () => JSON.stringify({
    hp:elite.maxHp, taken:elite.relicDamageTakenMul??1, cast:elite.relicCastMul??1,
    crit:elite.relicCritChance??0, siphon:elite.relicSiphon??0, speed:elite.speed,
    gap:elite.relicGapMul??1, seek:elite.relicSeekMul??1, contact:elite.contactDps,
    buff:elite.buffUntil, repertoire:elite.repertoire.length
  });
  for (const id of itemOrder) {
    const before=sig();
    h.giveEliteRelic(elite, { id: 11, x: elite.x, z: elite.z, item: id, bornAt: 0 });
    assert(sig() !== before, id + ' gave the elite no mechanical consequence');
  }
}

// --- they appear, they stay put, and they are reachable -------------------
{
  const h = SimulationHarness.create({ seed: 12345, hz: 60 });
  const sim = h.sim;
  let seen = 0;
  let maxAtOnce = 0;
  let takenByElites = 0;
  for (let i = 0; i < 60 * 420; i++) {
    const t = i / 60;
    // Walk at the nearest relic when there is one: otherwise the circling driver never
    // reaches a single one and the hero side of the shared source goes untested.
    let mx = Math.cos(t * 0.7),
      mz = Math.sin(t * 0.7);
    if (h.relics.length) {
      let best = h.relics[0],
        bd = Infinity;
      for (const r of h.relics) {
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
    if (sim.hasChoice) sim.chooseReward(0);
    for (const e of sim.events) if (e.type === 'RelicAppeared') seen++;
    for (const r of h.relics) assert(!h.blocked(r.x, r.z, 0.9), 'a relic sat inside a rock');
    maxAtOnce = Math.max(maxAtOnce, h.relics.length);
    if (sim.php <= 0) break;
  }
  takenByElites = sim.metrics.relicsTakenByElites;
  // The driver dies sooner here than in the other tools, because walking at every relic walks
  // it into the swarm - which is the cost the shared source is supposed to have. So the rate
  // is checked against the time actually survived rather than against the length of a run.
  const expected = Math.floor(sim.time / (Simulation.RELIC_INTERVAL * 1.5));
  assert(
    seen >= expected,
    `expected at least ${expected} relics in ${sim.time.toFixed(0)}s, saw ${seen}`
  );
  assert(seen >= 3, `almost no relics appeared at all: ${seen}`);
  assert(maxAtOnce <= 8, `relics piled up on the field: ${maxAtOnce} at once`);
  assert(
    sim.metrics.relicsTakenByHero > 0,
    'the hero walked straight at every relic and still took none'
  );
  // A relic can now also arrive as a level reward, which fills the haul without anyone
  // walking to it, so the haul is at least the number picked up off the ground rather
  // than exactly it.
  assert(
    (sim.heldItems as string[]).length >= sim.metrics.relicsTakenByHero,
    'the haul lost track of a relic picked up off the ground'
  );
  console.log('relic-regression OK', {
    catalogue: itemOrder.length,
    categories: byCategory.size,
    survived: `${sim.time.toFixed(1)}s`,
    appeared: seen,
    takenByHero: sim.metrics.relicsTakenByHero,
    takenByElites
  });
}
