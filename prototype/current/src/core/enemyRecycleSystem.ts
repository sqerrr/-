import type { Ent } from './state.js';

export interface EnemyRecyclePort {
  dt(): number;
  playerX(): number;
  playerZ(): number;
  entities(): Ent[];
  pointAroundPlayer(min: number, max: number): { x: number; z: number };
  emitEliteReacquired(entity: Ent): void;
}

/**
 * Keeps the bounded arena populated by recycling actors that drift too far from the hero.
 *
 * Spawn systems own construction; EncounterDirector owns pacing. This system owns only
 * reacquisition cadence/thresholds and the state reset performed when an existing actor returns.
 */
export class EnemyRecycleSystem {
  accumulatorValue = 0;

  constructor(private readonly port: EnemyRecyclePort) {}

  update() {
    const p = this.port;
    this.accumulatorValue += p.dt();
    if (this.accumulatorValue < 0.35) return;
    this.accumulatorValue = 0;

    const px = p.playerX();
    const pz = p.playerZ();

    for (const entity of p.entities()) {
      if (entity.hp <= 0) continue;

      const distance = Math.hypot(entity.x - px, entity.z - pz);

      if (entity.kind !== 'elite' && distance > 29) {
        const point = p.pointAroundPlayer(14, 19);
        entity.x = point.x;
        entity.z = point.z;
        entity.orderUntil = 0;
        entity.state = 'normal';
        entity.stateTimer = 0;
        continue;
      }

      if (entity.kind === 'elite' && distance > (entity.boss ? 38 : 33)) {
        const point = p.pointAroundPlayer(
          entity.boss ? 11 : 12,
          entity.boss ? 15 : 16
        );
        entity.x = point.x;
        entity.z = point.z;
        entity.state = 'normal';
        entity.stateTimer = 0;
        entity.adaptStage = 0;
        p.emitEliteReacquired(entity);
      }
    }
  }
}
