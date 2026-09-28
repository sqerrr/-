/**
 * Analytic (no Simulation) model of the XP economy and the hero-vs-world power race.
 *
 * Why analytic: a full run costs seconds and hides the curve behind driver noise. This model
 * answers the structural questions in milliseconds:
 *   - how many level-up windows the current curve opens per minute if the hero clears the
 *     director's budget (kill share), and how that compares to candidate curves;
 *   - how the hero's multiplicative damage (corePower x might) races worldScale (enemy HP).
 *
 * Constants below MIRROR live code; when those files change, update the mirror:
 *   - XP per kill:     src/core/deathResolutionSystem.ts (xp drop by kind, elite 30)
 *   - kind mix, cost:  src/core/encounterDirector.ts (pickEnemyKind, enemyCost, spawnPressure)
 *   - elite cadence:   src/core/encounterDirector.ts (tickElite)
 *   - XP curve:        src/core/progressionRuntime.ts (nextXpNeed, initial xpNeed 14)
 *   - corePower:       src/core/simulation.ts (corePower, powerBucket might 0.11)
 *
 * Usage (after `npm run build`):
 *   node dist/tools/balance_progression_model.js [--kill-share 0.85] [--xp-mul 1]
 *        [--run 480] [--might-share 0.33] [--target-level 24] [--exponent 1.6]
 *        [--core-step 0.075] [--json]
 */
import { ProgressionRuntime } from '../core/progressionRuntime.js';
import { argFlag, argNumber, printJson, round } from './balance_kit.js';

type Kind =
  | 'palimpsest' | 'bookmark' | 'footnote' | 'binder'
  | 'redactor' | 'indexer' | 'inkblot' | 'marginwalker';

const XP: Record<Kind, number> = {
  binder: 4, redactor: 4, indexer: 4, marginwalker: 3,
  bookmark: 2.5, inkblot: 2.4, footnote: 2.1, palimpsest: 1.8
};
const COST: Record<Kind, number> = {
  palimpsest: 3.5, bookmark: 2.5, footnote: 2, binder: 4,
  redactor: 4, indexer: 4, inkblot: 2.5, marginwalker: 3
};
const ELITE_XP = 30;
const ELITE_CORES_AVG = 3; // 2 + (threat>=2) + (threat>=4): ~3 in mid run
const ELITE_CACHE_COST = 5;

/** Cumulative-probability bands copied from EncounterDirector.pickEnemyKind. */
const BANDS: { until: number; mix: [Kind, number][] }[] = [
  { until: 0.12, mix: [['palimpsest', 0.48], ['bookmark', 0.38], ['footnote', 0.14]] },
  {
    until: 0.28,
    mix: [['palimpsest', 0.3], ['bookmark', 0.22], ['footnote', 0.1], ['binder', 0.15], ['inkblot', 0.12], ['marginwalker', 0.11]]
  },
  {
    until: 0.55,
    mix: [['palimpsest', 0.19], ['bookmark', 0.15], ['footnote', 0.14], ['binder', 0.13], ['inkblot', 0.11], ['marginwalker', 0.1], ['redactor', 0.09], ['indexer', 0.09]]
  },
  {
    until: 1.01,
    mix: [['palimpsest', 0.13], ['bookmark', 0.14], ['footnote', 0.12], ['binder', 0.13], ['inkblot', 0.12], ['marginwalker', 0.11], ['redactor', 0.12], ['indexer', 0.13]]
  }
];

function xpPerCredit(t01: number) {
  const band = BANDS.find((b) => t01 < b.until) ?? BANDS[BANDS.length - 1];
  let xp = 0, cost = 0;
  for (const [kind, p] of band.mix) {
    xp += p * XP[kind];
    cost += p * COST[kind];
  }
  return { xpPerCredit: xp / cost, killsPerCredit: 1 / cost };
}

const designMinutes = (t: number, run: number) => t / (run / 24);
const worldScale = (t: number, run: number) => { const m = designMinutes(t, run); return 1 + 0.055 * m + 0.0053 * m * m; };
const damageScale = (t: number, run: number) => { const m = designMinutes(t, run); return 1 + 0.018 * m + 0.00065 * m * m; };
const spawnPressure = (t: number, run: number) => { const m = designMinutes(t, run); return 1 + 0.055 * m + 0.0023 * m * m; };

type Curve = { name: string; initial: number; need: (level: number) => number };

const run = argNumber('run', 480);
const killShare = argNumber('kill-share', 0.85);
const xpMul = argNumber('xp-mul', 1);
const mightShare = argNumber('might-share', 0.33);
const coreStep = argNumber('core-step', 0.075);
const targetLevel = argNumber('target-level', 24);
const exponent = argNumber('exponent', 1.6);

/** Hero damage multiplier from level alone (corePower) and from might doctrine picks. */
function heroMultiplier(level: number, mightRanks: number, step = coreStep) {
  return (1 + (level - 1) * step) * (1 + mightRanks * 0.11);
}

function simulateCurve(curve: Curve, dt = 0.25) {
  let level = 1, xp = 0, need = curve.initial, eliteCores = 0, caches = 0;
  let eliteAcc = 0, firstElite = false, elites = 0, levelTimes: number[] = [];
  const rows: Record<string, number>[] = [];
  let nextRow = 30, levelsInWindow = 0, windowsInWindow = 0;
  for (let t = 0; t <= run + 1e-9; t += dt) {
    const band = xpPerCredit(t / run);
    const credits = 8 * spawnPressure(t, run) * dt * killShare;
    xp += credits * band.xpPerCredit * xpMul;
    // Elite cadence (simplified: always under cap, killed on arrival).
    if (t < run * 0.875) {
      eliteAcc += dt;
      const interval = t < 160 ? 20 : t < 320 ? 16 : 12;
      if (!firstElite && t >= 22) { firstElite = true; eliteAcc = 0; elites++; xp += ELITE_XP * xpMul; eliteCores += ELITE_CORES_AVG; }
      else if (firstElite && eliteAcc >= interval) { eliteAcc -= interval; elites++; xp += ELITE_XP * xpMul; eliteCores += ELITE_CORES_AVG; }
      while (eliteCores >= ELITE_CACHE_COST) { eliteCores -= ELITE_CACHE_COST; caches++; windowsInWindow++; }
    }
    while (xp >= need) {
      xp -= need;
      level++;
      need = curve.need(level);
      levelTimes.push(t);
      levelsInWindow++;
      windowsInWindow++;
    }
    if (t >= nextRow - 1e-9) {
      const mightRanks = (level - 1) * mightShare;
      const hero = heroMultiplier(level, mightRanks);
      rows.push({
        t: nextRow,
        level,
        levelUps: levelsInWindow,
        windows: windowsInWindow,
        secPerLevel: levelsInWindow ? round(30 / levelsInWindow, 1) : Infinity,
        xpNeed: need,
        heroMul: round(hero),
        worldHp: round(worldScale(t, run)),
        worldDmg: round(damageScale(t, run)),
        /** >1 means the hero's damage outgrows enemy HP relative to the run start. */
        powerRace: round(hero / worldScale(t, run))
      });
      levelsInWindow = 0;
      windowsInWindow = 0;
      nextRow += 30;
    }
  }
  const gaps = levelTimes.slice(1).map((t, i) => t - levelTimes[i]);
  return {
    curve: curve.name,
    finalLevel: level,
    eliteCaches: caches,
    elites,
    totalWindows: level - 1 + caches,
    minGapSec: gaps.length ? round(Math.min(...gaps), 2) : NaN,
    lastMinuteLevelUps: levelTimes.filter((t) => t >= run - 60).length,
    rows
  };
}

/** Solve c for need(L) = round(14 + c * L^exponent) so that the model ends at targetLevel. */
function solvedCurve(): Curve {
  let lo = 0.01, hi = 200;
  const make = (c: number): Curve => ({
    name: `solved(14+${round(c, 3)}*L^${exponent})`,
    initial: 14,
    need: (level) => Math.round(14 + c * level ** exponent)
  });
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const reached = simulateCurve(make(mid), 0.5).finalLevel;
    if (reached > targetLevel) lo = mid; else hi = mid;
  }
  return make(hi);
}

const curves: Curve[] = [
  { name: 'current', initial: 14, need: (level) => ProgressionRuntime.nextXpNeed(level) },
  // Vampire-Survivors-like: sharp step after the opening so the first minute stays snappy.
  { name: 'vs_like', initial: 14, need: (level) => Math.round(level < 6 ? 14 + 6 * level : 30 + 13 * level + 0.35 * level * level) },
  // Linear-plus: each level costs ~10% more than the last in the mid game.
  { name: 'steep_linear', initial: 14, need: (level) => Math.round(10 + 9 * level + 0.9 * level ** 1.5) },
  solvedCurve()
];

const results = curves.map((curve) => simulateCurve(curve));
const summary = {
  assumptions: { run, killShare, xpMul, mightShare, coreStep, targetLevel, exponent },
  note:
    'kill-share = fraction of the director spawn budget the hero converts into kills. ' +
    '1.0 = hero clears everything; real clean runs should be measured with balance_run_matrix.',
  curves: results.map(({ rows, ...rest }) => rest)
};

if (argFlag('json')) printJson({ summary, results });
else {
  printJson(summary);
  for (const result of results) {
    console.log(`\n== ${result.curve} ==`);
    console.table(result.rows);
  }
}
