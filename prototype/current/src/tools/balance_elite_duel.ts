/**
 * Reachable-loadout duel: one real elite (spawned by the live EliteSpawnSystem at time T, so
 * its HP follows worldScale and rarity) plus an optional one-shot crowd, against a hero whose
 * stats are what a clean run can ACTUALLY reach.
 *
 * Why not v011_build_report: that report configures `configureBenchmarkLoadout` defaults
 * (per-skill power/coverage/duration..., globalPower 0.35, tempo 0.2, crit 0.1) which no clean
 * run can obtain - nothing in live progression raises per-skill stats or globalPower. Its
 * silencing of `sim.spawnCredits/eliteAcc` also predates EncounterDirector owning them.
 *
 * Here per-skill stats stay at newSkill() defaults; growth comes only from level (corePower)
 * and doctrine ranks, which is the real v0.13 clean-run growth model.
 *
 * Output: per build x checkpoint, elite TTK (median/max over seeds), crowd clear time,
 * DPS on the elite and the top damage sources; plus an outlier index per checkpoint
 * (slowest / fastest solo phenomenon TTK).
 *
 * Measurement only; not part of `npm test`. Internals are reached through `any` on purpose
 * (same boundary as v011_build_report); if Simulation internals are renamed, fix here.
 *
 * Usage (after `npm run build`):
 *   node dist/tools/balance_elite_duel.js [--seeds 3] [--checkpoints 60:6,180:16,300:28,420:40]
 *        [--doctrines greedy|even|none] [--crowd 24] [--rarity common|uplifted|legendary]
 *        [--affix none|keep] [--builds solo|combos|all] [--cap 90]
 * Checkpoint format is time:level. Take levels from balance_run_matrix (perBucket.level)
 * of the SAME build; the defaults are rough estimates of the current curve.
 */
import { Simulation } from '../core/simulation.js';
import { SimulationHarness } from '../testing/simulationHarness.js';
import type { DoctrineId, SkillId } from '../core/types.js';
import { activeSkillOrder, doctrineOrder } from '../content/definitions.js';
import { HZ, argNumber, argSeeds, argValue, median, printJson, round } from './balance_kit.js';

const RARITY_HP = { common: 2.5, uplifted: 5, legendary: 9.4 } as const; // mirror of eliteSpawnSystem.ts
type Rarity = keyof typeof RARITY_HP;

const seeds = argSeeds(3);
const cap = argNumber('cap', 90);
const crowdSize = argNumber('crowd', 24);
const rarity = argValue('rarity', 'common') as Rarity;
const affixMode = argValue('affix', 'none');
const doctrineMode = argValue('doctrines', 'greedy');
const buildMode = argValue('builds', 'all');
const checkpoints = argValue('checkpoints', '60:6,180:16,300:28,420:40')
  .split(',')
  .map((pair) => {
    const [t, l] = pair.split(':').map(Number);
    return { time: t, level: l };
  });

const MELEE = new Set<SkillId>(['cleaver', 'orbit_blades', 'frost_ring', 'tether_drag']);

/** Preset 4-slot archetypes plus the "suspected annihilators" to compare against. */
const combos: { name: string; slots: SkillId[] }[] = [
  { name: 'melee', slots: ['cleaver', 'orbit_blades', 'frost_ring', 'tether_drag'] },
  { name: 'ranged', slots: ['rail_spear', 'shard_fan', 'sentry', 'chain_arc'] },
  { name: 'control', slots: ['frost_ring', 'toxic_mist', 'chain_arc', 'mass_driver'] },
  { name: 'artillery', slots: ['mortar_bloom', 'sentry', 'mass_driver', 'rail_spear'] },
  { name: 'orbit_mist', slots: ['orbit_blades', 'toxic_mist', 'frost_ring', 'chain_arc'] }
];

function doctrineSpread(ranks: number, slots: SkillId[]): Record<DoctrineId, number> {
  const out = Object.fromEntries(doctrineOrder.map((d) => [d, 0])) as Record<DoctrineId, number>;
  if (doctrineMode === 'none' || ranks <= 0) return out;
  const close = slots.some((s) => MELEE.has(s));
  const order: DoctrineId[] =
    doctrineMode === 'greedy'
      ? close
        ? ['might', 'size', 'might', 'quantity', 'guard', 'precision', 'duration', 'mobility']
        : ['might', 'precision', 'might', 'quantity', 'duration', 'size', 'mobility', 'force']
      : [...doctrineOrder];
  for (let i = 0; i < ranks; i++) out[order[i % order.length]]++;
  return out;
}

interface DuelResult {
  build: string;
  time: number;
  level: number;
  seed: number;
  eliteHp: number;
  chassis: string;
  eliteTtk: number;
  crowdClear: number;
  eliteDps: number;
  top: string[];
}

function duel(name: string, slots: SkillId[], time: number, level: number, seed: number): DuelResult {
  const sim = new Simulation({ seed, hz: HZ, runDuration: 480, benchmark: true, mode: 'clean' });
  const harness = new SimulationHarness(sim);
  const internals = sim as any;
  sim.configureBenchmarkLoadout({
    slots, catalysts: [], level,
    globalPower: 0, tempo: 0.08, armor: 0, maxHp: 1e7, moveSpeed: 4.8, pickupRadius: 8.5, fortune: 0,
    skillPower: 0, skillCoverage: 0, skillRange: 0, skillDuration: 0, skillControl: 0, skillStatus: 0, skillElite: 0
  });
  // configureBenchmarkLoadout pins crit to 0.1; a clean run keeps newSkill()'s base crit.
  for (const id of slots) {
    const runtime = harness.skill(id);
    if (runtime) {
      runtime.crit = internals.newSkill(id).crit;
      runtime.level = 1;
    }
  }
  sim.level = level;
  Object.assign(sim.doctrines, doctrineSpread(level - 1, slots));

  // Silence every director: this is a controlled duel.
  const director = internals.encounterDirector;
  director.tickNormalSpawns = () => undefined;
  director.tickElite = () => null;
  director.shouldSpawnBoss = () => false;
  if (internals.poiSystem?.points) internals.poiSystem.points.length = 0;
  harness.obstacles = [];
  harness.entities = [];
  harness.setTime(time);
  harness.setPlayerPosition(0, 0);

  const elite = harness.spawnElite(false);
  if (!elite) throw new Error('elite did not spawn');
  const targetHp = (elite.maxHp / RARITY_HP[(elite.rarity ?? 'common') as Rarity]) * RARITY_HP[rarity];
  elite.maxHp = elite.hp = targetHp;
  elite.rarity = rarity;
  elite.repertoire = [];
  if (affixMode === 'none') elite.affix = 'none';
  elite.x = 8;
  elite.z = 0;

  const crowdKinds = ['footnote', 'bookmark', 'palimpsest', 'binder', 'inkblot', 'marginwalker'] as const;
  const crowdIds = new Set<number>();
  for (let i = 0; i < crowdSize; i++) {
    const a = (i / Math.max(1, crowdSize)) * Math.PI * 2;
    const spawned = harness.spawnEnemyAt(crowdKinds[i % crowdKinds.length], Math.cos(a) * 9, Math.sin(a) * 9);
    if (spawned) crowdIds.add(spawned.id);
  }
  harness.clearEvents();

  const preferred = slots.every((s) => MELEE.has(s)) ? 2.4 : slots.some((s) => MELEE.has(s)) ? 4.2 : 7.5;
  let eliteTtk = -1, crowdClear = crowdIds.size ? -1 : 0;
  const start = sim.tick;
  for (let frame = 0; frame < cap * HZ; frame++) {
    harness.relics.length = 0;
    const alive = harness.entities.filter((e) => e.hp > 0);
    const target = alive.find((e) => e.kind === 'elite') ?? alive[0];
    let moveX = 0, moveZ = 0, aimX = 1, aimZ = 0;
    if (target) {
      const dx = target.x - sim.px, dz = target.z - sim.pz, d = Math.hypot(dx, dz) || 1;
      aimX = dx / d;
      aimZ = dz / d;
      const radial = Math.max(-0.9, Math.min(0.9, (d - preferred) * 0.8));
      const lateral = (Math.floor(frame / (HZ * 4)) % 2 === 0 ? 1 : -1) * 0.6;
      moveX = aimX * radial - aimZ * lateral;
      moveZ = aimZ * radial + aimX * lateral;
      const m = Math.hypot(moveX, moveZ) || 1;
      moveX /= m;
      moveZ /= m;
    }
    sim.step({ moveX, moveZ, aimX, aimZ });
    const seconds = (sim.tick - start) / HZ;
    if (eliteTtk < 0 && elite.hp <= 0) eliteTtk = seconds;
    if (crowdClear < 0 && ![...crowdIds].some((id) => harness.entities.some((e) => e.id === id && e.hp > 0)))
      crowdClear = seconds;
    if (eliteTtk >= 0 && crowdClear >= 0) break;
  }
  const telemetry = sim.telemetry();
  const top = Object.entries(telemetry.damageBySource)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([source, amount]) => `${source}:${Math.round(amount)}`);
  const elapsed = eliteTtk >= 0 ? eliteTtk : cap;
  return {
    build: name, time, level, seed,
    eliteHp: Math.round(targetHp),
    chassis: String(elite.chassis),
    eliteTtk: eliteTtk >= 0 ? round(eliteTtk, 2) : Infinity,
    crowdClear: crowdClear >= 0 ? round(crowdClear, 2) : Infinity,
    eliteDps: round((targetHp - Math.max(0, elite.hp)) / elapsed, 1),
    top
  };
}

const builds: { name: string; slots: SkillId[] }[] = [
  ...(buildMode === 'combos' ? [] : activeSkillOrder.map((id) => ({ name: 'solo:' + id, slots: [id] }))),
  ...(buildMode === 'solo' ? [] : combos.map((c) => ({ name: 'combo:' + c.name, slots: c.slots })))
];

const rows: DuelResult[] = [];
for (const cp of checkpoints)
  for (const build of builds)
    for (const seed of seeds) rows.push(duel(build.name, build.slots, cp.time, cp.level, seed));

const table = checkpoints.flatMap((cp) =>
  builds.map((build) => {
    const rs = rows.filter((r) => r.time === cp.time && r.build === build.name);
    const ttk = rs.map((r) => r.eliteTtk);
    return {
      t: cp.time,
      level: cp.level,
      build: build.name,
      eliteHp: Math.round(median(rs.map((r) => r.eliteHp))),
      eliteTtkMed: median(ttk),
      eliteTtkMax: Math.max(...ttk),
      crowdClearMed: median(rs.map((r) => r.crowdClear)),
      eliteDpsMed: median(rs.map((r) => r.eliteDps)),
      top: rs[0]?.top.join(' ')
    };
  })
);

const outliers = checkpoints.map((cp) => {
  const solo = table.filter((r) => r.t === cp.time && r.build.startsWith('solo:') && Number.isFinite(r.eliteTtkMed));
  const sorted = [...solo].sort((a, b) => a.eliteTtkMed - b.eliteTtkMed);
  return {
    t: cp.time,
    fastest: sorted[0]?.build,
    fastestTtk: sorted[0]?.eliteTtkMed,
    slowest: sorted[sorted.length - 1]?.build,
    slowestTtk: sorted[sorted.length - 1]?.eliteTtkMed,
    /** Target band for a balanced roster: <= ~2.5x between best and worst opener. */
    spread: sorted.length ? round(sorted[sorted.length - 1].eliteTtkMed / sorted[0].eliteTtkMed, 2) : NaN,
    unkillable: table.filter((r) => r.t === cp.time && r.build.startsWith('solo:') && !Number.isFinite(r.eliteTtkMed)).map((r) => r.build)
  };
});

printJson({
  config: { seeds, cap, crowdSize, rarity, affixMode, doctrineMode, checkpoints },
  outliers,
  table
});
