/**
 * Full clean-run matrix: starting Phenomenon x seed x pick policy.
 *
 * Measures what the player FEELS rather than what a benchmark loadout can do:
 *   - pacing:     level-ups and choice windows per 30 s bucket (by window kind);
 *   - lethality:  median / P90 "exposure TTK" of normal enemies (first hit -> death) per bucket
 *                 and the share of one-shots (killed within 0.1 s of the first hit);
 *   - domination: kills / spawns per bucket and average living crowd;
 *   - elites:     encounter TTK (engaged -> death) and contact time, by spawn bucket;
 *   - danger:     damage taken per bucket, deaths, time of death;
 *   - outliers:   damage share by source (which node carries the build).
 *
 * Measurement only: no assertions, not part of `npm test`. Runtime is roughly
 * (starts x seeds x policies) full runs; start with a narrow slice.
 *
 * Usage (after `npm run build`):
 *   node dist/tools/balance_run_matrix.js [--starts all|cleaver,rail_spear] [--seeds 4]
 *        [--policies driver,random,greedy] [--run 480] [--decide-every 6] [--runs-detail]
 *   node dist/tools/balance_run_matrix.js --starts cleaver --seeds 2 --policies greedy > out.json
 */
import { Simulation } from '../core/simulation.js';
import type { Command, SkillId, Snapshot } from '../core/types.js';
import {
  HZ, argFlag, argNumber, argSeeds, argStarts, argValue, driverRng, mean, median,
  percentile, pickOfferBy, printJson, round, routeSteer, windowKind, type OfferPolicy
} from './balance_kit.js';

const BUCKET = 30;
const runDuration = argNumber('run', 480);
const decideEvery = Math.max(1, argNumber('decide-every', 6));
const policies = argValue('policies', 'driver,random,greedy').split(',') as OfferPolicy[];
const starts = argStarts();
const seeds = argSeeds(4);
const detail = argFlag('runs-detail');

interface Bucket {
  t: number;
  levelUps: number;
  windows: Record<string, number>;
  spawned: number;
  killed: number;
  eliteKilled: number;
  damageTaken: number;
  hpEnd: number;
  aliveSamples: number[];
  ttk: number[];
  oneShots: number;
  levelEnd: number;
}

interface RunResult {
  start: SkillId;
  seed: number;
  policy: OfferPolicy;
  alive: boolean;
  finished: boolean;
  deathAt: number;
  finalLevel: number;
  rewardApplyFailures: number;
  buckets: Bucket[];
  eliteTtk: { spawnedAt: number; ttk: number; contact: number; rarity: string; chassis: string }[];
  eliteUnkilled: number;
  damageShare: Record<string, number>;
  doctrines: Record<string, number>;
  build: (string | null)[];
}

function newBucket(t: number): Bucket {
  return { t, levelUps: 0, windows: {}, spawned: 0, killed: 0, eliteKilled: 0, damageTaken: 0, hpEnd: 0, aliveSamples: [], ttk: [], oneShots: 0, levelEnd: 1 };
}

function runOne(start: SkillId, seed: number, policy: OfferPolicy): RunResult {
  const sim = new Simulation({ seed, hz: HZ, runDuration, mode: 'clean', startingSkill: start });
  const rand = driverRng(seed * 31 + policies.indexOf(policy));
  const buckets: Bucket[] = [];
  const bucketAt = (time: number) => {
    const index = Math.min(Math.floor(time / BUCKET), Math.ceil(runDuration / BUCKET));
    while (buckets.length <= index) buckets.push(newBucket(buckets.length * BUCKET));
    return buckets[index];
  };
  const firstHit = new Map<number, number>();
  let lastSerial = -1, failures = 0, cmd: Command = { moveX: 0, moveZ: 0, aimX: 1, aimZ: 0 };
  let damageTakenBefore = 0;
  const maxTicks = Math.ceil(runDuration * 1.15 * HZ);

  for (let i = 0; i < maxTicks; i++) {
    if (i % decideEvery === 0) cmd = routeSteer(sim.snapshot(), i);
    sim.step(cmd);
    const time = sim.tick / HZ;
    const bucket = bucketAt(time);
    for (const ev of sim.events) {
      if (ev.type === 'EntitySpawned' && ev.kind !== 'elite') bucket.spawned++;
      else if (ev.type === 'DamageResolved' && !ev.elite && !firstHit.has(ev.entity)) firstHit.set(ev.entity, ev.tick);
      else if (ev.type === 'EntityDied') {
        if (ev.elite) { bucket.eliteKilled++; continue; }
        bucket.killed++;
        const hitTick = firstHit.get(ev.entity);
        if (hitTick !== undefined) {
          const ttk = (ev.tick - hitTick) / HZ;
          bucket.ttk.push(ttk);
          if (ttk <= 0.1) bucket.oneShots++;
          firstHit.delete(ev.entity);
        }
      } else if (ev.type === 'LevelUp') bucket.levelUps++;
    }
    let guard = 0;
    while (sim.hasChoice && guard++ < 16) {
      const s: Snapshot = sim.snapshot();
      if (s.choiceSerial !== lastSerial) {
        lastSerial = s.choiceSerial;
        const kind = windowKind(s);
        bucket.windows[kind] = (bucket.windows[kind] ?? 0) + 1;
      }
      if (s.mutationOffer) sim.chooseMutation(policy === 'random' ? Math.floor(rand() * s.mutationOffer.choices.length) : 0);
      else if (s.rewardOffers) {
        const ok = sim.chooseReward(pickOfferBy(policy, s, rand));
        if (!ok) failures++;
      } else break;
    }
    if (i % HZ === 0) {
      const s = sim.snapshot();
      bucket.aliveSamples.push(s.entities.filter((e) => !e.elite).length);
      bucket.hpEnd = s.player.hp;
      bucket.levelEnd = s.player.level;
      bucket.damageTaken += s.metrics.damageTaken - damageTakenBefore;
      damageTakenBefore = s.metrics.damageTaken;
      if (s.player.hp <= 0 || s.finished) break;
    }
  }

  const end = sim.snapshot();
  const telemetry = sim.telemetry();
  const totalDamage = Object.values(telemetry.damageBySource).reduce((a, b) => a + b, 0) || 1;
  const damageShare = Object.fromEntries(
    Object.entries(telemetry.damageBySource)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([source, amount]) => [source, round(amount / totalDamage, 3)])
  );
  const encounters = sim.eliteEncounters();
  return {
    start, seed, policy,
    alive: end.player.hp > 0,
    finished: end.finished,
    deathAt: end.player.hp > 0 ? -1 : round(end.time, 1),
    finalLevel: end.player.level,
    rewardApplyFailures: failures,
    buckets,
    eliteTtk: encounters
      .filter((e) => e.killed && e.engagedAt >= 0)
      .map((e) => ({ spawnedAt: round(e.spawnedAt, 1), ttk: round(e.endedAt - e.engagedAt, 2), contact: round(e.contactTime, 2), rarity: e.rarity, chassis: e.chassis })),
    eliteUnkilled: encounters.filter((e) => !e.killed).length,
    damageShare,
    doctrines: { ...end.doctrines },
    build: [...end.chain.slots, ...end.chain.skillReserve]
  };
}

function aggregate(runs: RunResult[]) {
  const bucketCount = Math.max(...runs.map((r) => r.buckets.length));
  const perBucket = Array.from({ length: bucketCount }, (_, index) => {
    const bs = runs.map((r) => r.buckets[index]).filter((b): b is Bucket => !!b);
    const ttk = bs.flatMap((b) => b.ttk);
    const windows: Record<string, number> = {};
    for (const b of bs) for (const [k, v] of Object.entries(b.windows)) windows[k] = round((windows[k] ?? 0) + v / bs.length, 2);
    const elites = runs.flatMap((r) => r.eliteTtk).filter((e) => Math.floor(e.spawnedAt / BUCKET) === index);
    return {
      t: index * BUCKET,
      runsAlive: bs.length,
      level: round(mean(bs.map((b) => b.levelEnd)), 1),
      levelUps: round(mean(bs.map((b) => b.levelUps)), 2),
      windows,
      killShare: round(mean(bs.map((b) => (b.spawned ? b.killed / b.spawned : NaN)).filter(Number.isFinite)), 2),
      alive: round(mean(bs.flatMap((b) => b.aliveSamples)), 1),
      ttkMedian: round(median(ttk), 2),
      ttkP90: round(percentile(ttk, 0.9), 2),
      oneShotShare: round(ttk.length ? bs.reduce((a, b) => a + b.oneShots, 0) / ttk.length : NaN, 2),
      eliteTtkMedian: round(median(elites.map((e) => e.ttk)), 1),
      eliteTtkP90: round(percentile(elites.map((e) => e.ttk), 0.9), 1),
      damageTakenPerSec: round(mean(bs.map((b) => b.damageTaken / BUCKET)), 2),
      hp: round(mean(bs.map((b) => b.hpEnd)), 0)
    };
  });
  const allElite = runs.flatMap((r) => r.eliteTtk.map((e) => e.ttk));
  return {
    runs: runs.length,
    survival: round(runs.filter((r) => r.alive).length / runs.length, 2),
    deathAtMedian: round(median(runs.filter((r) => !r.alive).map((r) => r.deathAt)), 1),
    finalLevelMedian: median(runs.map((r) => r.finalLevel)),
    rewardApplyFailures: runs.reduce((a, r) => a + r.rewardApplyFailures, 0),
    eliteTtkMedian: round(median(allElite), 1),
    eliteTtkP90: round(percentile(allElite, 0.9), 1),
    eliteUnkilledMean: round(mean(runs.map((r) => r.eliteUnkilled)), 1),
    topSources: runs.map((r) => Object.keys(r.damageShare)[0] + ':' + Object.values(r.damageShare)[0]),
    perBucket
  };
}

const all: RunResult[] = [];
const summary: Record<string, unknown> = {};
for (const policy of policies) {
  for (const start of starts) {
    const runs = seeds.map((seed) => runOne(start, seed, policy));
    all.push(...runs);
    summary[`${policy}/${start}`] = aggregate(runs);
  }
  summary[`${policy}/ALL`] = aggregate(all.filter((r) => r.policy === policy));
}

printJson({
  config: { runDuration, seeds, starts, policies, decideEvery, bucketSec: BUCKET },
  summary,
  runs: detail ? all : undefined
});
