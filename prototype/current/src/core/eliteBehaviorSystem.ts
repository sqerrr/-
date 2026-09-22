import { HERO_HIT_RADIUS, type Ent, type Field } from './state.js';
import type { CombatShape, DamageSourceId, EliteActionId } from './types.js';

export interface EliteBehaviorPort {
  readonly runDuration: number;
  readonly world: { minX: number; maxX: number; minZ: number; maxZ: number };

  time(): number;
  tick(): number;
  dt(): number;
  playerX(): number;
  playerZ(): number;
  playerVX(): number;
  playerVZ(): number;

  hasEcho(entityId: number): boolean;
  noteContact(entity: Ent, distance: number): void;
  fieldRefusals(entity: Ent, distance: number): void;
  steerTo(entity: Ent, x: number, z: number, speed: number, multiplier?: number): void;
  freeOf(x: number, z: number, radius: number): { x: number; z: number };
  addField(field: Omit<Field, 'id'>): void;
  emitCombatShape(source: string, shape: CombatShape, intent?: 'damage' | 'control' | 'field'): void;
  combatShape(source: string, shape: CombatShape, intent?: 'damage' | 'control' | 'field'): void;
  emitOrder(entity: Ent, order: EliteActionId): void;
  hitPlayer(amount: number, attacker: Ent, source: DamageSourceId): void;
  damageScale(): number;
  spawnReplicant(entity: Ent): void;
  playerInSector(x: number, z: number, ax: number, az: number, radius: number, halfAngle: number): boolean;
  movePlayer(dx: number, dz: number): void;
  entities(): readonly Ent[];
}

/**
 * Authored non-boss elite behavior.
 *
 * Simulation still owns world/combat services through EliteBehaviorPort. This class owns the
 * six chassis state machines and their tells/commit/recovery cadence, keeping update order explicit
 * without letting AI reach into the whole Simulation object.
 */
export class EliteBehaviorSystem {
  constructor(private readonly port: EliteBehaviorPort) {}

  patternCooldown(base: number, entity: Ent) {
    const t = Math.min(1, this.port.time() / this.port.runDuration);
    const rarity = entity.rarity === 'legendary' ? 0.72 : entity.rarity === 'uplifted' ? 0.86 : 1;
    return Math.max(1.2, base * (1 - 0.22 * t) * rarity * (entity.relicGapMul ?? 1));
  }

  private beginPattern(
    entity: Ent,
    source: string,
    shape: CombatShape,
    duration: number,
    order: Exclude<EliteActionId, 'predator_dash'>
  ) {
    entity.eliteAction = order;
    entity.eliteActionUntil = this.port.time() + duration;
    entity.cooldown = 99;
    this.port.emitCombatShape(source, shape, 'damage');
    this.port.emitOrder(entity, order);
  }

  update(entity: Ent, speed: number, distance: number, nx: number, nz: number) {
    const p = this.port;
    const time = p.time();
    const dt = p.dt();
    const px = p.playerX();
    const pz = p.playerZ();
    const playerVX = p.playerVX();
    const playerVZ = p.playerVZ();

    p.noteContact(entity, distance);
    const chassis = entity.chassis!;
    const echoBusy = p.hasEcho(entity.id);
    if (!entity.eliteAction && entity.state === 'normal' && !echoBusy && entity.adaptStage === 0)
      p.fieldRefusals(entity, distance);

    if (chassis === 'hunter') {
      // PREDATOR: repeated predictive intercept with a fixed, readable red lane.
      if (entity.adaptStage === 2) {
        entity.eliteAction = 'predator_dash';
        entity.x += entity.lockedX * 10.8 * dt;
        entity.z += entity.lockedZ * 10.8 * dt;
        if (time >= (entity.eliteActionUntil ?? 0)) {
          entity.adaptStage = 0;
          entity.eliteAction = undefined;
          entity.eliteActionUntil = 0;
          entity.cooldown = this.patternCooldown(3.0, entity);
          entity.exposedUntil = time + 0.9;
        }
        return;
      }
      if (entity.adaptStage === 1) {
        if (time >= (entity.eliteActionUntil ?? 0)) {
          entity.adaptStage = 2;
          entity.eliteAction = 'predator_dash';
          entity.eliteActionUntil = time + 0.46;
        }
        return;
      }
      const tx = px + playerVX * 0.58;
      const tz = pz + playerVZ * 0.58;
      if (distance > 0.9) p.steerTo(entity, tx, tz, speed, 1.12);
      if (!echoBusy && !entity.eliteAction && entity.cooldown <= 0) {
        const dx = tx - entity.x;
        const dz = tz - entity.z;
        const magnitude = Math.hypot(dx, dz) || 1;
        entity.lockedX = dx / magnitude;
        entity.lockedZ = dz / magnitude;
        entity.adaptStage = 1;
        entity.eliteAction = 'predator';
        entity.eliteActionUntil = time + 0.58;
        entity.cooldown = 99;
        p.emitCombatShape('elite_predator_tell', {
          kind: 'ray',
          x: entity.x,
          z: entity.z,
          aimX: entity.lockedX,
          aimZ: entity.lockedZ,
          range: 8.5,
          halfWidth: 0.72
        });
        p.emitOrder(entity, 'predator');
      }
      return;
    }

    if (chassis === 'architect') {
      // VEIL: destination is forecast first; then the Architect relocates and blooms denial pockets.
      if (entity.eliteAction === 'veil') {
        if (time < (entity.eliteActionUntil ?? 0)) return;
        entity.eliteAction = undefined;
        entity.eliteActionUntil = 0;
        entity.x = Math.max(p.world.minX + 1, Math.min(p.world.maxX - 1, entity.lockedX));
        entity.z = Math.max(p.world.minZ + 1, Math.min(p.world.maxZ - 1, entity.lockedZ));
        for (let i = 0; i < 3; i++) {
          const angle = i * Math.PI * 2 / 3 + entity.id * 0.37;
          const radius = i === 0 ? 0 : 3.1;
          p.addField({
            x: entity.x + Math.cos(angle) * radius,
            z: entity.z + Math.sin(angle) * radius,
            radius: 3.05,
            ttl: 4.8,
            kind: 'veil',
            dps: 0,
            tickAcc: 0
          });
        }
        entity.cooldown = this.patternCooldown(4.6, entity);
        entity.exposedUntil = time + 0.45;
        return;
      }
      if (distance > 7.2) p.steerTo(entity, px, pz, speed, 1.05);
      else if (distance < 3.8) {
        entity.x -= nx * speed * 0.5 * dt;
        entity.z -= nz * speed * 0.5 * dt;
      }
      if (!echoBusy && !entity.eliteAction && entity.cooldown <= 0) {
        const side = entity.id % 2 ? 1 : -1;
        const target = p.freeOf(px - nz * side * 3.6, pz + nx * side * 3.6, entity.radius);
        entity.lockedX = target.x;
        entity.lockedZ = target.z;
        this.beginPattern(
          entity,
          'elite_architect_veil_tell',
          { kind: 'circle', x: target.x, z: target.z, radius: 3.05 },
          0.74,
          'veil'
        );
      }
      return;
    }

    if (chassis === 'broodmaker') {
      // REPLICATOR: reactive cloning remains, but it also declares an active brood pulse.
      if (entity.eliteAction === 'replicate') {
        if (time < (entity.eliteActionUntil ?? 0)) return;
        entity.eliteAction = undefined;
        entity.eliteActionUntil = 0;
        p.combatShape('elite_brood_active', { kind: 'circle', x: entity.x, z: entity.z, radius: 4.2 });
        if (Math.hypot(px - entity.x, pz - entity.z) <= 4.2 + HERO_HIT_RADIUS)
          p.hitPlayer(14 * p.damageScale(), entity, 'brood_pulse');
        p.spawnReplicant(entity);
        entity.cooldown = this.patternCooldown(5.2, entity);
        return;
      }
      if (distance > 5.8) p.steerTo(entity, px, pz, speed, 1.02);
      else if (distance < 3.2) {
        entity.x -= nx * speed * 0.45 * dt;
        entity.z -= nz * speed * 0.45 * dt;
      }
      if (!echoBusy && !entity.eliteAction && entity.cooldown <= 0)
        this.beginPattern(
          entity,
          'elite_brood_tell',
          { kind: 'circle', x: entity.x, z: entity.z, radius: 4.2 },
          0.78,
          'replicate'
        );
      return;
    }

    if (chassis === 'bulwark') {
      // PRISM still rewards alternating sources, but now also commits to a frontal bash.
      if (entity.eliteAction === 'prism') {
        if (time < (entity.eliteActionUntil ?? 0)) return;
        entity.eliteAction = undefined;
        entity.eliteActionUntil = 0;
        p.combatShape('elite_prism_active', {
          kind: 'sector',
          x: entity.x,
          z: entity.z,
          radius: 5.2,
          aimX: entity.lockedX,
          aimZ: entity.lockedZ,
          halfAngle: 0.74
        });
        if (p.playerInSector(entity.x, entity.z, entity.lockedX, entity.lockedZ, 5.2, 0.74)) {
          p.hitPlayer(22 * p.damageScale(), entity, 'prism_bash');
          const dx = px - entity.x;
          const dz = pz - entity.z;
          const magnitude = Math.hypot(dx, dz) || 1;
          p.movePlayer(dx / magnitude * 0.85, dz / magnitude * 0.85);
        }
        entity.cooldown = this.patternCooldown(4.2, entity);
        entity.exposedUntil = time + 0.55;
        return;
      }
      if (distance > 4.2) p.steerTo(entity, px, pz, speed * 0.96);
      else if (distance < 2.2) {
        entity.x -= nx * speed * 0.3 * dt;
        entity.z -= nz * speed * 0.3 * dt;
      }
      if (!echoBusy && !entity.eliteAction && entity.cooldown <= 0) {
        entity.lockedX = nx;
        entity.lockedZ = nz;
        this.beginPattern(
          entity,
          'elite_prism_tell',
          {
            kind: 'sector',
            x: entity.x,
            z: entity.z,
            radius: 5.2,
            aimX: nx,
            aimZ: nz,
            halfAngle: 0.74
          },
          0.72,
          'prism'
        );
      }
      return;
    }

    if (chassis === 'harvester') {
      // NULL WEAVER: a close sweep makes its direct-vs-derived rule an active positioning threat.
      if (entity.eliteAction === 'null') {
        if (time < (entity.eliteActionUntil ?? 0)) return;
        entity.eliteAction = undefined;
        entity.eliteActionUntil = 0;
        p.combatShape('elite_null_active', {
          kind: 'sector',
          x: entity.x,
          z: entity.z,
          radius: 4.8,
          aimX: entity.lockedX,
          aimZ: entity.lockedZ,
          halfAngle: 0.96
        });
        if (p.playerInSector(entity.x, entity.z, entity.lockedX, entity.lockedZ, 4.8, 0.96)) {
          p.hitPlayer(25 * p.damageScale(), entity, 'null_harvest');
          entity.hp = Math.min(entity.maxHp, entity.hp + entity.maxHp * 0.045);
        }
        entity.cooldown = this.patternCooldown(3.8, entity);
        return;
      }
      const side = entity.id % 2 ? 1 : -1;
      const tx = px - nz * side * 3.2;
      const tz = pz + nx * side * 3.2;
      p.steerTo(entity, tx, tz, speed, 1.08);
      if (!echoBusy && entity.cooldown <= 0 && distance < 7.2) {
        entity.lockedX = nx;
        entity.lockedZ = nz;
        this.beginPattern(
          entity,
          'elite_null_tell',
          {
            kind: 'sector',
            x: entity.x,
            z: entity.z,
            radius: 4.8,
            aimX: nx,
            aimZ: nz,
            halfAngle: 0.96
          },
          0.68,
          'null'
        );
      }
      return;
    }

    if (chassis === 'shepherd') {
      // METAMORPH keeps its damage-signature adaptation and periodically rallies the local pack.
      if (entity.eliteAction === 'metamorph') {
        if (time < (entity.eliteActionUntil ?? 0)) return;
        entity.eliteAction = undefined;
        entity.eliteActionUntil = 0;
        p.combatShape(
          'elite_shepherd_active',
          { kind: 'circle', x: entity.x, z: entity.z, radius: 5.2 },
          'control'
        );
        if (Math.hypot(px - entity.x, pz - entity.z) <= 5.2 + HERO_HIT_RADIUS)
          p.hitPlayer(15 * p.damageScale(), entity, 'shepherd_pulse');
        let buffed = 0;
        for (const other of p.entities()) {
          if (
            other === entity ||
            other.kind === 'elite' ||
            other.hp <= 0 ||
            Math.hypot(other.x - entity.x, other.z - entity.z) > 7.5
          )
            continue;
          other.buffUntil = Math.max(other.buffUntil, time + 2.8);
          other.orderX = px;
          other.orderZ = pz;
          other.orderUntil = time + 2.8;
          if (++buffed >= 8) break;
        }
        entity.cooldown = this.patternCooldown(5.0, entity);
        return;
      }
      if (entity.shepherdMode === 'condensed') {
        const tx = px + playerVX * 0.35;
        const tz = pz + playerVZ * 0.35;
        p.steerTo(entity, tx, tz, speed, 1.55);
      } else if (entity.shepherdMode === 'migratory') {
        const side = entity.id % 2 ? 1 : -1;
        const tx = px - nz * side * 4.8;
        const tz = pz + nx * side * 4.8;
        p.steerTo(entity, tx, tz, speed, 1.22);
      } else if (distance > 4.8) p.steerTo(entity, px, pz, speed, 1.05);

      if (!echoBusy && !entity.eliteAction && entity.cooldown <= 0)
        this.beginPattern(
          entity,
          'elite_shepherd_tell',
          { kind: 'circle', x: entity.x, z: entity.z, radius: 5.2 },
          0.82,
          'metamorph'
        );
      return;
    }

    if (distance > 3.6) p.steerTo(entity, px, pz, speed);
  }
}
