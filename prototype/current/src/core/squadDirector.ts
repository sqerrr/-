import type { Ent, Obstacle } from './state.js';
import type { SquadTask } from './types.js';

export interface SquadDirectorPort {
  readonly world: { minX: number; maxX: number; minZ: number; maxZ: number };

  time(): number;
  playerX(): number;
  playerZ(): number;
  playerVX(): number;
  playerVZ(): number;
  aimX(): number;
  aimZ(): number;
  entities(): readonly Ent[];
  obstacles(): readonly Obstacle[];
  freeOf(x: number, z: number, radius: number): { x: number; z: number };
}

/**
 * Short-lived group orchestration layered above each non-elite enemy's native script.
 *
 * This director never owns movement itself. It only assigns temporary jobs and destinations;
 * EnemyBehaviorSystem consumes those orders and falls back to native behavior when they expire.
 */
export class SquadDirector {
  private nextPlanAt = 0;

  constructor(private readonly port: SquadDirectorPort) {}

  update() {
    const p = this.port;
    const time = p.time();
    if (time < this.nextPlanAt) return;
    this.nextPlanAt = time + 2.6;

    const px = p.playerX();
    const pz = p.playerZ();
    const candidates: Ent[] = [];
    for (const entity of p.entities()) {
      if (
        entity.hp <= 0 ||
        entity.kind === 'elite' ||
        entity.kind === 'hero' ||
        entity.orderUntil > time ||
        Math.hypot(entity.x - px, entity.z - pz) >= 21
      ) continue;
      candidates.push(entity);
    }
    candidates.sort((a, b) => a.id - b.id);
    if (candidates.length > 20) candidates.length = 20;

    for (let i = 0; i < candidates.length; i++) {
      const entity = candidates[i];
      // Leave roughly one body in four on its native script at every planning beat.
      if ((entity.id + Math.floor(time * 2)) % 4 === 0) continue;

      const task = this.taskFor(entity, i);
      const target = this.targetFor(entity, task);
      const point = p.freeOf(target.x, target.z, entity.radius * 0.72);

      entity.orderX = Math.max(p.world.minX + 1, Math.min(p.world.maxX - 1, point.x));
      entity.orderZ = Math.max(p.world.minZ + 1, Math.min(p.world.maxZ - 1, point.z));
      entity.orderUntil = time + 1.25 + (entity.id % 4) * 0.12;
      entity.squadTask = task;
      entity.squadUntil = entity.orderUntil;
    }
  }

  taskFor(entity: Ent, index: number): Exclude<SquadTask, 'none'> {
    if (entity.kind === 'marginwalker' || entity.kind === 'redactor') return 'flank';
    if (entity.kind === 'bookmark') return 'intercept';
    if (entity.kind === 'binder' || entity.kind === 'indexer') return 'hold';
    const cycle: Exclude<SquadTask, 'none'>[] = ['press', 'flank', 'intercept', 'hold'];
    return cycle[index % cycle.length];
  }

  targetFor(entity: Ent, task: Exclude<SquadTask, 'none'>) {
    const p = this.port;
    const playerVX = p.playerVX();
    const playerVZ = p.playerVZ();
    const magnitude = Math.hypot(playerVX, playerVZ);
    const moveX = magnitude > 0.15 ? playerVX / magnitude : p.aimX();
    const moveZ = magnitude > 0.15 ? playerVZ / magnitude : p.aimZ();
    const side = entity.id % 2 ? 1 : -1;
    const sideX = -moveZ * side;
    const sideZ = moveX * side;
    const px = p.playerX();
    const pz = p.playerZ();

    if (task === 'press') {
      const lane = ((entity.id % 5) - 2) * 0.48;
      return { x: px + sideX * lane, z: pz + sideZ * lane };
    }

    if (task === 'flank') {
      const radius = 3.6 + (entity.id % 3) * 0.65;
      return {
        x: px + sideX * radius + moveX * 0.7,
        z: pz + sideZ * radius + moveZ * 0.7
      };
    }

    if (task === 'intercept') {
      const lead = magnitude > 0.15 ? 3.7 : 2.1;
      return {
        x: px + moveX * lead + sideX * ((entity.id % 3) - 1) * 0.85,
        z: pz + moveZ * lead + sideZ * ((entity.id % 3) - 1) * 0.85
      };
    }

    const projectedX = px + moveX * 2.2;
    const projectedZ = pz + moveZ * 2.2;
    let best: Obstacle | undefined;
    let score = Infinity;

    for (const obstacle of p.obstacles()) {
      const distance = Math.hypot(obstacle.x - projectedX, obstacle.z - projectedZ);
      if (distance < score && distance < 9.5) {
        score = distance;
        best = obstacle;
      }
    }

    if (best) {
      const dx = px - best.x;
      const dz = pz - best.z;
      const distance = Math.hypot(dx, dz) || 1;
      const edge = best.radius + entity.radius + 0.65;
      return {
        x: best.x + (dx / distance) * edge + (-dz / distance) * side * 0.7,
        z: best.z + (dz / distance) * edge + (dx / distance) * side * 0.7
      };
    }

    return {
      x: px - moveX * 2.8 + sideX * side,
      z: pz - moveZ * 2.8 + sideZ * side
    };
  }

  diagnostics() {
    return { nextPlanAt: this.nextPlanAt };
  }
}
