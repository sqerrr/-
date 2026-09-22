import { Rng } from './rng.js';
import type { EnemyKind } from './types.js';

export type NormalEnemyKind = Exclude<EnemyKind, 'elite' | 'hero'>;
export type EliteSpawnRequest = 'opening' | 'regular';

const enemyCost: Record<NormalEnemyKind, number> = {
  palimpsest: 3.5,
  bookmark: 2.5,
  footnote: 2,
  binder: 4,
  redactor: 4,
  indexer: 4,
  inkblot: 2.5,
  marginwalker: 3
};

/**
 * Owns run pacing policy, not entity creation.
 *
 * Callbacks deliberately execute inside the budget loop. Spawn callbacks consume the same
 * combat RNG stream (position, affix, etc.), so keeping the call interleaving here preserves
 * seeded runs exactly while moving cadence/budget state out of Simulation.
 */
export class EncounterDirector {
  private spawnCredits = 0;
  private eliteAcc = 0;
  private firstElite = false;

  constructor(private readonly rng: Rng) {}

  designMinutes(time: number, runDuration: number) {
    return time / (runDuration / 24);
  }

  worldScale(time: number, runDuration: number) {
    const m = this.designMinutes(time, runDuration);
    return 1 + 0.055 * m + 0.0053 * m * m;
  }

  damageScale(time: number, runDuration: number) {
    const m = this.designMinutes(time, runDuration);
    return 1 + 0.018 * m + 0.00065 * m * m;
  }

  spawnPressure(time: number, runDuration: number) {
    const m = this.designMinutes(time, runDuration);
    return 1 + 0.055 * m + 0.0023 * m * m;
  }

  populationTarget(time: number, bossActive: boolean, bossPhaseTwo: boolean) {
    if (bossActive) return 118 + (bossPhaseTwo ? 28 : 0);
    let target: number;
    if (time < 75) target = 28 + (58 - 28) * (time / 75);
    else if (time < 210) target = 58 + (98 - 58) * ((time - 75) / 135);
    else if (time < 350) target = 98 + (154 - 98) * ((time - 210) / 140);
    else target = 154 + (218 - 154) * Math.min(1, (time - 350) / 80);
    const pulse = Math.max(0, Math.sin(((time - 28) * Math.PI) / 38));
    target += time < 28 ? 0 : pulse * pulse * (time < 220 ? 14 : 26);
    return Math.min(238, target);
  }

  tickNormalSpawns(args: {
    time: number;
    runDuration: number;
    dt: number;
    normalCount: number;
    bossActive: boolean;
    bossPhaseTwo: boolean;
    spawn: (kind: NormalEnemyKind) => void;
  }) {
    const target = this.populationTarget(args.time, args.bossActive, args.bossPhaseTwo);
    this.spawnCredits += args.dt * (8.0 * this.spawnPressure(args.time, args.runDuration));
    if (args.normalCount > target) this.spawnCredits *= 0.92;

    let guard = 0;
    while (
      this.spawnCredits >= 1 &&
      args.normalCount + guard < target &&
      guard < 14
    ) {
      const kind = this.pickEnemyKind(args.time, args.runDuration);
      const cost = enemyCost[kind];
      if (this.spawnCredits < cost) break;
      this.spawnCredits -= cost;
      // Keep this callback here, between RNG picks, to preserve the seeded RNG call order.
      args.spawn(kind);
      guard++;
    }
  }

  tickElite(args: {
    time: number;
    dt: number;
    bossSpawned: boolean;
    activeElites: number;
  }): EliteSpawnRequest | null {
    if (args.bossSpawned) return null;
    this.eliteAcc += args.dt;
    const cap = args.time < 85 ? 1 : args.time < 180 ? 2 : 3;
    if (!this.firstElite && args.time >= 22) {
      this.firstElite = true;
      this.eliteAcc = 0;
      return 'opening';
    }
    const interval = args.time < 160 ? 20 : args.time < 320 ? 16 : 12;
    if (this.firstElite && args.activeElites < cap && this.eliteAcc >= interval) {
      this.eliteAcc -= interval;
      return 'regular';
    }
    return null;
  }

  shouldSpawnBoss(time: number, runDuration: number, bossSpawned: boolean) {
    return !bossSpawned && time >= runDuration * 0.875;
  }

  private pickEnemyKind(time: number, runDuration: number): NormalEnemyKind {
    const t = time / runDuration;
    const r = this.rng.float();
    if (t < 0.12) return r < 0.48 ? 'palimpsest' : r < 0.86 ? 'bookmark' : 'footnote';
    if (t < 0.28)
      return r < 0.3
        ? 'palimpsest'
        : r < 0.52
          ? 'bookmark'
          : r < 0.62
            ? 'footnote'
            : r < 0.77
              ? 'binder'
              : r < 0.89
                ? 'inkblot'
                : 'marginwalker';
    if (t < 0.55)
      return r < 0.19
        ? 'palimpsest'
        : r < 0.34
          ? 'bookmark'
          : r < 0.48
            ? 'footnote'
            : r < 0.61
              ? 'binder'
              : r < 0.72
                ? 'inkblot'
                : r < 0.82
                  ? 'marginwalker'
                  : r < 0.91
                    ? 'redactor'
                    : 'indexer';
    return r < 0.13
      ? 'palimpsest'
      : r < 0.27
        ? 'bookmark'
        : r < 0.39
          ? 'footnote'
          : r < 0.52
            ? 'binder'
            : r < 0.64
              ? 'inkblot'
              : r < 0.75
                ? 'marginwalker'
                : r < 0.87
                  ? 'redactor'
                  : 'indexer';
  }

  diagnostics() {
    return {
      spawnCredits: this.spawnCredits,
      eliteAcc: this.eliteAcc,
      firstElite: this.firstElite
    };
  }
}
