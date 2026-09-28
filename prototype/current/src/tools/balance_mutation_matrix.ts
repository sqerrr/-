/**
 * Mutation matrix: every live Phenomenon x every mutation path (base, Tier I, I->II, I->II->III)
 * measured in the same controlled labs, so weak branches stand out against their siblings.
 *
 * Labs (directors silenced, hero invulnerable but damage taken is recorded):
 *   crowd  - waves of normal mobs rush the hero for --crowd-time seconds; metric = killed HP/s,
 *            kills and damage taken per second (defensive branches show up here).
 *   elite  - one common elite (no affix) plus a small ring of mobs; metric = elite TTK.
 *   link   - optional (--links): the mutated Phenomenon on the LEFT of a Catalyst link with a
 *            fixed partner on the right; metric = Catalyst fires per minute and pair kill-rate
 *            uplift versus the same pair without a Catalyst. Shows which mutations starve or
 *            feed their Catalyst signals (terminal / path / carrier / area).
 *
 * Hero growth mirrors a clean run: newSkill() stats, level and greedy doctrine ranks only.
 *
 * Usage (after `npm run build`):
 *   node dist/tools/balance_mutation_matrix.js [--seeds 3] [--time 240] [--level 22]
 *        [--skills all|a,b] [--crowd-time 30] [--elite-cap 60] [--links] [--json]
 * Measurement only; not part of `npm test`.
 */
import { Simulation } from '../core/simulation.js';
import { SimulationHarness } from '../testing/simulationHarness.js';
import type { CatalystId, DoctrineId, MutationId, SkillId } from '../core/types.js';
import {
  activeSkillOrder,
  catalystOrder,
  catalystPairCompatible,
  doctrineOrder,
  mutationChildren,
  mutationRoots,
  skills
} from '../content/definitions.js';
import { HZ, argFlag, argNumber, argSeeds, argValue, driverRng, mean, median, printJson, round } from './balance_kit.js';

const seeds = argSeeds(3);
const time = argNumber('time', 240);
const level = argNumber('level', 22);
const crowdTime = argNumber('crowd-time', 30);
const eliteCap = argNumber('elite-cap', 60);
const withLinks = argFlag('links');
/** Optional unmutated second Phenomenon in both labs (e.g. a mark source for "связка" branches). */
const support = argValue('support', '') as SkillId | '';
const rawSkills = argValue('skills', 'all');
const skillList: SkillId[] = rawSkills === 'all' ? [...activeSkillOrder] : (rawSkills.split(',') as SkillId[]);

const MELEE = new Set<SkillId>(['cleaver', 'orbit_blades', 'frost_ring', 'tether_drag']);
const CROWD_KINDS = ['footnote', 'bookmark', 'palimpsest', 'binder', 'inkblot', 'marginwalker'] as const;

interface Variant {
  label: string;
  path: MutationId[];
}

function variants(skill: SkillId): Variant[] {
  const out: Variant[] = [{ label: 'base', path: [] }];
  for (const root of mutationRoots(skill)) {
    const child = mutationChildren(skill, root.id)[0];
    const apo = child ? mutationChildren(skill, child.id)[0] : undefined;
    out.push({ label: root.id, path: [root.id] });
    if (child) out.push({ label: `${root.id}>${child.id}`, path: [root.id, child.id] });
    if (child && apo) out.push({ label: `${root.id}>${child.id}>${apo.id}`, path: [root.id, child.id, apo.id] });
  }
  return out;
}

function doctrineSpread(ranks: number, slots: SkillId[]): Record<DoctrineId, number> {
  const out = Object.fromEntries(doctrineOrder.map((d) => [d, 0])) as Record<DoctrineId, number>;
  const close = slots.some((s) => MELEE.has(s));
  const order: DoctrineId[] = close
    ? ['might', 'size', 'might', 'quantity', 'guard', 'precision', 'duration', 'mobility']
    : ['might', 'precision', 'might', 'quantity', 'duration', 'size', 'mobility', 'force'];
  for (let i = 0; i < ranks; i++) out[order[i % order.length]]++;
  return out;
}

function setup(seed: number, slots: SkillId[], path: MutationId[], catalysts: (CatalystId | null)[]) {
  const sim = new Simulation({ seed, hz: HZ, runDuration: 480, benchmark: true, mode: 'clean' });
  const harness = new SimulationHarness(sim);
  const internals = sim as any;
  const main = slots[0];
  sim.configureBenchmarkLoadout({
    slots,
    catalysts: catalysts as CatalystId[],
    level,
    mutations: path[0] ? { [main]: path[0] } : undefined,
    mutationUpgrades: path[1] ? { [main]: path[1] } : undefined,
    mutationApotheoses: path[2] ? { [main]: path[2] } : undefined,
    globalPower: 0, tempo: 0.08, armor: 0, maxHp: 1e7, moveSpeed: 4.8, pickupRadius: 8.5, fortune: 0,
    skillPower: 0, skillCoverage: 0, skillRange: 0, skillDuration: 0, skillControl: 0, skillStatus: 0, skillElite: 0
  } as any);
  for (const id of slots) {
    const runtime = harness.skill(id);
    if (runtime) {
      runtime.crit = internals.newSkill(id).crit;
      runtime.level = 1;
    }
  }
  sim.level = level;
  Object.assign(sim.doctrines, doctrineSpread(level - 1, slots));
  harness.silenceDirectors();
  harness.obstacles = [];
  harness.entities = [];
  harness.setTime(time);
  harness.setPlayerPosition(0, 0);
  return { sim, harness };
}

/** Kite at a preferred distance from the nearest body, strafing so lanes keep changing. */
function steer(sim: Simulation, harness: SimulationHarness, frame: number, preferred: number, focusElite: boolean) {
  const alive = harness.entities.filter((e) => e.hp > 0);
  let target = focusElite ? alive.find((e) => e.kind === 'elite') : undefined;
  if (!target) {
    let best = Infinity;
    for (const e of alive) {
      const d = Math.hypot(e.x - sim.px, e.z - sim.pz);
      if (d < best) { best = d; target = e; }
    }
  }
  if (!target) return { moveX: 0, moveZ: 0, aimX: 1, aimZ: 0 };
  const dx = target.x - sim.px, dz = target.z - sim.pz, d = Math.hypot(dx, dz) || 1;
  const aimX = dx / d, aimZ = dz / d;
  const radial = Math.max(-0.9, Math.min(0.9, (d - preferred) * 0.8));
  const lateral = (Math.floor(frame / (HZ * 4)) % 2 === 0 ? 1 : -1) * 0.6;
  let moveX = aimX * radial - aimZ * lateral, moveZ = aimZ * radial + aimX * lateral;
  const m = Math.hypot(moveX, moveZ) || 1;
  moveX /= m; moveZ /= m;
  return { moveX, moveZ, aimX, aimZ };
}

interface CrowdResult { hpRate: number; kills: number; taken: number; fires: number }

function crowdLab(seed: number, slots: SkillId[], path: MutationId[], catalysts: (CatalystId | null)[]): CrowdResult {
  const { sim, harness } = setup(seed, slots, path, catalysts);
  const rng = driverRng(seed);
  const preferred = MELEE.has(slots[0]) ? 2.4 : 6.5;
  const ids = new Map<number, number>();
  let killedHp = 0, fires = 0;
  const hp0 = sim.php;
  for (let frame = 0; frame < crowdTime * HZ; frame++) {
    if (frame % Math.round(HZ * 2.5) === 0) {
      for (let i = 0; i < 10; i++) {
        const a = rng() * Math.PI * 2, r = 11 + rng() * 3;
        const spawned = harness.spawnEnemyAt(CROWD_KINDS[(frame + i) % CROWD_KINDS.length], sim.px + Math.cos(a) * r, sim.pz + Math.sin(a) * r);
        if (spawned) ids.set(spawned.id, spawned.maxHp);
      }
    }
    harness.relics.length = 0;
    sim.step(steer(sim, harness, frame, preferred, false));
    for (const ev of sim.events) if (ev.type === 'CatalystChoreography' && ev.fromSlot === 0) fires++;
    for (const [id, maxHp] of ids) {
      const e = harness.entities.find((x) => x.id === id);
      if (!e || e.hp <= 0) { killedHp += maxHp; ids.delete(id); }
    }
  }
  const kills = sim.telemetry().killsBySource;
  return {
    hpRate: killedHp / crowdTime,
    kills: Object.values(kills).reduce((a, b) => a + b, 0),
    taken: (hp0 - sim.php) / crowdTime,
    fires: (fires / crowdTime) * 60
  };
}

/** Elite damage per second over the window (until death or cap): finite even for weak solos. */
function eliteLab(seed: number, slots: SkillId[], path: MutationId[]): { dps: number; ttk: number } {
  const { sim, harness } = setup(seed, slots, path, []);
  const elite = harness.spawnElite(false);
  if (!elite) throw new Error('elite did not spawn');
  const common = (elite.maxHp / ({ common: 2.5, uplifted: 5, legendary: 9.4 } as Record<string, number>)[elite.rarity ?? 'common']) * 2.5;
  elite.maxHp = elite.hp = common;
  elite.rarity = 'common';
  elite.repertoire = [];
  elite.affix = 'none';
  elite.x = 8; elite.z = 0;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    harness.spawnEnemyAt(CROWD_KINDS[i % CROWD_KINDS.length], Math.cos(a) * 9, Math.sin(a) * 9);
  }
  const preferred = MELEE.has(slots[0]) ? 2.4 : 7;
  const start = sim.tick;
  for (let frame = 0; frame < eliteCap * HZ; frame++) {
    harness.relics.length = 0;
    sim.step(steer(sim, harness, frame, preferred, true));
    if (elite.hp <= 0) {
      const ttk = (sim.tick - start) / HZ;
      return { dps: common / ttk, ttk };
    }
  }
  return { dps: (common - elite.hp) / eliteCap, ttk: Infinity };
}

const partnerFor = (skill: SkillId): SkillId => (skill === 'mortar_bloom' ? 'rail_spear' : 'mortar_bloom');

const rows: Record<string, unknown>[] = [];
const links: Record<string, unknown>[] = [];
for (const skill of skillList) {
  const vs = variants(skill);
  let baseCrowd = NaN, baseTtk = NaN;
  for (const v of vs) {
    const labSlots: SkillId[] = support && support !== skill ? [skill, support] : [skill];
    const crowd = seeds.map((s) => crowdLab(s, labSlots, v.path, []));
    const duel = seeds.map((s) => eliteLab(s, labSlots, v.path));
    const ttk = duel.map((d) => d.ttk);
    const hpRate = median(crowd.map((c) => c.hpRate));
    const ttkMed = median(ttk);
    const dps = median(duel.map((d) => d.dps));
    if (v.label === 'base') { baseCrowd = hpRate; baseTtk = dps; }
    rows.push({
      skill,
      tier: v.path.length,
      variant: v.label,
      crowdHpPerSec: round(hpRate, 0),
      crowdRel: round(hpRate / baseCrowd, 2),
      kills: round(median(crowd.map((c) => c.kills)), 0),
      takenPerSec: round(median(crowd.map((c) => c.taken)), 1),
      eliteTtk: round(ttkMed, 1),
      eliteDps: round(dps, 0),
      eliteRel: round(dps / baseTtk, 2),
      unkilled: ttk.filter((t) => !Number.isFinite(t)).length
    });
    if (!withLinks || (v.path.length !== 0 && v.path.length !== 3)) continue;
    const partner = partnerFor(skill);
    const pairBase = mean(seeds.map((s) => crowdLab(s, [skill, partner], v.path, []).hpRate));
    for (const cat of catalystOrder) {
      if (!catalystPairCompatible(cat, skill, partner)) continue;
      const r = seeds.map((s) => crowdLab(s, [skill, partner], v.path, [cat]));
      links.push({
        skill,
        variant: v.label,
        catalyst: cat,
        partner,
        firesPerMin: round(mean(r.map((x) => x.fires)), 1),
        uplift: round(mean(r.map((x) => x.hpRate)) / pairBase, 2)
      });
    }
  }
}

if (argFlag('json')) printJson({ config: { seeds, time, level, crowdTime, eliteCap }, rows, links });
else {
  console.log(`mutation matrix t=${time}s level=${level} seeds=${seeds.length}`);
  console.log('skill | variant | crowdHP/s (rel) | kills | taken/s | eliteDPS (rel) | eliteTTK | unkilled');
  for (const r of rows as any[])
    console.log(`${r.skill} | ${r.variant} | ${r.crowdHpPerSec} (${r.crowdRel}) | ${r.kills} | ${r.takenPerSec} | ${r.eliteDps} (${r.eliteRel}) | ${r.eliteTtk} | ${r.unkilled}`);
  if (links.length) {
    console.log('\nlinks: skill | variant | catalyst -> partner | fires/min | pair uplift');
    for (const l of links as any[]) console.log(`${l.skill} | ${l.variant} | ${l.catalyst} -> ${l.partner} | ${l.firesPerMin} | ${l.uplift}`);
  }
  void skills;
}
