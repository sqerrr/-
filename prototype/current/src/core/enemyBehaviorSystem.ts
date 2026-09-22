import type { Ent, Field } from './state.js';

export interface EnemyBehaviorPort {
  time(): number;
  dt(): number;
  playerX(): number;
  playerZ(): number;
  playerVX(): number;
  playerVZ(): number;

  steerTo(entity: Ent, x: number, z: number, speed: number, multiplier?: number): void;
  lineOfSight(x0: number, z0: number, x1: number, z1: number, radius: number): boolean;
  getAliveEntity(id: number): Ent | undefined;
  entities(): readonly Ent[];
  fields(): readonly Field[];
  addField(field: Omit<Field, 'id'>): void;
  randomRange(min: number, max: number): number;
  damageScale(): number;
}

/**
 * Native behavior for non-elite enemies.
 *
 * Squad orders remain a higher-level orchestration concern; if one is active it temporarily
 * overrides the native script here. Elite/boss behavior and elite affixes are intentionally
 * separate systems.
 */
export class EnemyBehaviorSystem {
  constructor(private readonly port: EnemyBehaviorPort) {}

  update(entity: Ent, speed: number, distance: number, nx: number, nz: number) {
    const p = this.port;
    const time = p.time();
    const dt = p.dt();
    const px = p.playerX();
    const pz = p.playerZ();

    if (entity.orderUntil > time) {
      p.steerTo(entity, entity.orderX, entity.orderZ, speed, 1.15);
      return;
    }

    if (entity.kind === 'footnote') {
      // Baseline swarm pressure: no projectile, just a readable body entering player space.
      if (distance > 0.58) {
        entity.x += nx * speed * dt;
        entity.z += nz * speed * dt;
      }
      return;
    }

    if (entity.kind === 'bookmark') {
      if (entity.state === 'telegraph') {
        if (entity.stateTimer <= 0) {
          entity.state = 'dash';
          entity.stateTimer = 0.58;
        }
      } else if (entity.state === 'dash') {
        entity.x += entity.lockedX * 7.5 * dt;
        entity.z += entity.lockedZ * 7.5 * dt;
        if (entity.stateTimer <= 0) {
          entity.state = 'normal';
          entity.cooldown = 2.9;
        }
      } else if (
        entity.cooldown <= 0 &&
        distance > 3 &&
        distance < 12 &&
        p.lineOfSight(entity.x, entity.z, px, pz, 0.12)
      ) {
        entity.state = 'telegraph';
        entity.stateTimer = 0.72;
        entity.lockedX = nx;
        entity.lockedZ = nz;
        entity.cooldown = 99;
      } else if (distance > 0.8) {
        entity.x += nx * speed * dt;
        entity.z += nz * speed * dt;
      }
      return;
    }

    if (entity.kind === 'binder') {
      if (entity.linkTimer <= 0) {
        entity.linkTimer = 1.0;
        let best: Ent | undefined;
        let bestDistance = 999;
        for (const other of p.entities()) {
          if (other === entity || other.kind === 'binder' || other.hp <= 0) continue;
          const candidateDistance = Math.hypot(other.x - entity.x, other.z - entity.z);
          if (candidateDistance < 5.2 && candidateDistance < bestDistance) {
            bestDistance = candidateDistance;
            best = other;
          }
        }
        entity.linkedTo = best?.id ?? 0;
      }
      const target = p.getAliveEntity(entity.linkedTo);
      if (target) {
        const targetDistance = Math.hypot(target.x - entity.x, target.z - entity.z) || 1;
        if (targetDistance > 3) p.steerTo(entity, target.x, target.z, speed);
      } else if (distance > 5) {
        p.steerTo(entity, px, pz, speed);
      }
      return;
    }

    if (entity.kind === 'redactor') {
      let best: Field | undefined;
      let bestDistance = 999;
      for (const field of p.fields()) {
        if (field.kind === 'ink' || field.kind === 'index' || field.kind === 'architect') continue;
        const candidateDistance = Math.hypot(field.x - entity.x, field.z - entity.z);
        if (candidateDistance < bestDistance) {
          bestDistance = candidateDistance;
          best = field;
        }
      }
      if (best && bestDistance < 8) {
        if (bestDistance > 1.4) p.steerTo(entity, best.x, best.z, speed);
        if (entity.cooldown <= 0 && bestDistance < 2.5) {
          best.ttl = Math.min(best.ttl, 0.25);
          entity.cooldown = 2.8;
        }
      } else if (distance > 4) {
        p.steerTo(entity, px, pz, speed);
      }
      return;
    }

    if (entity.kind === 'indexer') {
      if (distance > 7.5) p.steerTo(entity, px, pz, speed);
      else if (distance < 5.2) {
        entity.x -= nx * speed * 0.55 * dt;
        entity.z -= nz * speed * 0.55 * dt;
      }
      if (entity.cooldown <= 0) {
        entity.cooldown = 4.2;
        const playerMagnitude = Math.hypot(p.playerVX(), p.playerVZ());
        const vx = playerMagnitude > 0.1 ? p.playerVX() / playerMagnitude : nx;
        const vz = playerMagnitude > 0.1 ? p.playerVZ() / playerMagnitude : nz;
        entity.lockedX = px + vx * 3.2;
        entity.lockedZ = pz + vz * 3.2;
        p.addField({
          x: entity.lockedX,
          z: entity.lockedZ,
          radius: 1.25,
          ttl: 2.8,
          kind: 'index',
          dps: 0,
          tickAcc: 0
        });
        for (const other of p.entities()) {
          if (other === entity || other.kind === 'elite' || other.hp <= 0) continue;
          if (Math.hypot(other.x - entity.x, other.z - entity.z) < 7) {
            other.orderX = entity.lockedX;
            other.orderZ = entity.lockedZ;
            other.orderUntil = time + 2.8;
          }
        }
      }
      return;
    }

    if (entity.kind === 'inkblot') {
      if (distance > 0.75) p.steerTo(entity, px, pz, speed);
      if (entity.cooldown <= 0) {
        entity.cooldown = 4.0 + p.randomRange(0, 0.8);
        p.addField({
          x: entity.x,
          z: entity.z,
          radius: 1.15,
          ttl: 3.2,
          kind: 'ink',
          dps: 14 * p.damageScale(),
          tickAcc: 0
        });
      }
      return;
    }

    if (entity.kind === 'marginwalker') {
      const side = entity.id % 2 ? 1 : -1;
      const tx = px - nz * side * 3.5;
      const tz = pz + nx * side * 3.5;
      p.steerTo(entity, tx, tz, speed, 1.08);
      return;
    }

    // Palimpsest and any future simple melee body fall back to direct pressure.
    if (distance > 0.68) {
      entity.x += nx * speed * dt;
      entity.z += nz * speed * dt;
    }
  }
}
