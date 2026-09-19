declare const process: { argv: string[]; exit(code?: number): never };
import { Simulation } from '../core/simulation.js';
import { pickOffer } from './driver.js';
import type { EliteEncounter, EliteRarity } from '../core/types.js';

/**
 * D52 reporting for D49: measures how long elite fights actually last.
 *
 * The hero is driven by the same loop as headless.ts, which is a mediocre but
 * consistent player: it circles, always aims at the nearest elite, and always
 * takes the first offer. Treat the numbers as a baseline, not as a verdict on
 * how the fight feels.
 */

const args = process.argv.slice(2);
const get = (k: string, d: string) => {
  const i = args.indexOf(k);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const seeds = get('--seeds', '12345,20260919,777,4242')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((s) => Number.isFinite(s));
const ticks = Number(get('--ticks', '28800'));
const hz = 60 as const;

/** D49 target fight length in seconds, measured from first blow traded to death. */
const TARGET: Record<EliteRarity, [number, number]> = {
  common: [8, 12],
  uplifted: [15, 25],
  legendary: [30, 45]
};

function runSeed(seed: number): { encounters: EliteEncounter[]; time: number; died: boolean } {
  const sim = new Simulation({ seed, hz });
  for (let i = 0; i < ticks; i++) {
    const snap = sim.snapshot();
    const a = i / (hz * 4.3),
      sx = Math.cos(a) * 0.65,
      sy = Math.sin(a * 0.73) * 0.58;
    const moveX = (sx + sy) * 0.7071,
      moveZ = (-sx + sy) * 0.7071;
    const targets = [...snap.entities].sort(
      (p, q) =>
        Number(q.elite) - Number(p.elite) ||
        Math.hypot(p.x - snap.player.x, p.z - snap.player.z) -
          Math.hypot(q.x - snap.player.x, q.z - snap.player.z)
    );
    const t = targets[0];
    let ax = Math.cos(a),
      az = Math.sin(a);
    if (t) {
      const dx = t.x - snap.player.x,
        dz = t.z - snap.player.z,
        m = Math.hypot(dx, dz) || 1;
      ax = dx / m;
      az = dz / m;
    }
    sim.step({ moveX, moveZ, aimX: ax, aimZ: az });
    let guard = 0;
    while (sim.hasChoice && guard++ < 10) {
      const s = sim.snapshot();
      if (s.mutationOffer) sim.chooseMutation(0);
      else if (s.rewardOffers) sim.chooseReward(pickOffer(s));
    }
    const now = sim.snapshot();
    if (now.player.hp <= 0 || now.finished) break;
  }
  const s = sim.snapshot();
  return { encounters: sim.eliteEncounters(), time: s.time, died: s.player.hp <= 0 };
}

const round = (v: number, p = 1) => Math.round(v * 10 ** p) / 10 ** p;
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const a = [...xs].sort((p, q) => p - q);
  const h = a.length >> 1;
  return a.length % 2 ? a[h] : (a[h - 1] + a[h]) / 2;
};

const all: EliteEncounter[] = [];
const runs: string[] = [];
for (const seed of seeds) {
  const r = runSeed(seed);
  all.push(...r.encounters);
  runs.push(
    `seed ${seed}: ${round(r.time)}s, ${r.encounters.length} elites, ` +
      `${r.encounters.filter((e) => e.killed).length} killed${r.died ? ', HERO DIED' : ''}`
  );
}

console.log('=== runs ===');
for (const line of runs) console.log('  ' + line);

console.log('\n=== fight length against D49 ===');
console.log('  seconds spent within reach of the hero, not wall clock since the first blow:');
console.log('  an elite that drifts away and returns fought twice, briefly, not once at length');
const order: EliteRarity[] = ['common', 'uplifted', 'legendary'];
let anyMiss = false;
for (const rarity of order) {
  const rows = all.filter((e) => e.rarity === rarity);
  const fought = rows.filter((e) => e.killed && e.engagedAt >= 0);
  const engaged = fought.map((e) => e.contactTime);
  const lifetimes = fought.map((e) => e.endedAt - e.spawnedAt);
  const [lo, hi] = TARGET[rarity];
  const med = median(engaged);
  const verdict = !fought.length
    ? 'NO DATA'
    : med < lo
      ? 'TOO SHORT'
      : med > hi
        ? 'TOO LONG'
        : 'ON TARGET';
  if (verdict === 'TOO SHORT' || verdict === 'TOO LONG') anyMiss = true;
  console.log(
    `  ${rarity.padEnd(10)} n=${String(rows.length).padStart(3)} killed=${String(fought.length).padStart(3)} ` +
      `median=${String(round(med)).padStart(6)}s  target=${lo}-${hi}s  ${verdict}`
  );
  if (fought.length) {
    console.log(
      `             spread=${round(Math.min(...engaged))}..${round(Math.max(...engaged))}s  ` +
        `lifetime median=${round(median(lifetimes))}s  ` +
        `repertoire avg=${round(rows.reduce((s, e) => s + e.repertoire, 0) / rows.length)}  ` +
        `casts avg=${round(rows.reduce((s, e) => s + e.casts, 0) / rows.length, 2)}`
    );
    console.log(
      `             hero dealt avg=${round(fought.reduce((s, e) => s + e.damageFromHero, 0) / fought.length)}  ` +
        `elite dealt avg=${round(fought.reduce((s, e) => s + e.damageToHero, 0) / fought.length)}`
    );
  }
}

const unfought = all.filter((e) => e.engagedAt < 0).length;
const escaped = all.filter((e) => !e.killed).length;
console.log(
  `\n  never engaged: ${unfought} of ${all.length}   still alive at the end: ${escaped} of ${all.length}`
);

const casts: Record<string, number> = {};
for (const e of all)
  for (const k of Object.keys(e.castSkills)) casts[k] = (casts[k] ?? 0) + e.castSkills[k];
console.log('  refusals fielded: ' + (Object.keys(casts).length ? JSON.stringify(casts) : 'none'));

if (args.includes('--assert') && anyMiss) {
  console.error('elite fight length is outside the D49 target');
  process.exit(1);
}
