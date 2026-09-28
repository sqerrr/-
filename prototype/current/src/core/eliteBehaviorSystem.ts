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
  emitOrder(entity: Ent, order: Exclude<EliteActionId, 'predator_dash'>): void;
  hitPlayer(amount: number, attacker: Ent, source: DamageSourceId): void;
  damageScale(): number;
  /** Replicator copy of the elite itself (bounded by rarity cap inside the owner). */
  spawnClone(entity: Ent): void;
  /** Temporary U-shaped wall around (x, z) with its opening facing (openX, openZ). */
  raiseWalls(entity: Ent, x: number, z: number, openX: number, openZ: number): void;
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
 *
 * v0.14 "hard" pass: elites move at 0.75-0.9 of hero pace (Predator faster than the hero), use
 * patterns ~1.6x as often, commit gap-closers (dash chains, prism lunge, null pull) and hit hard
 * enough that a pattern is a real event. Echo cards that need close range make the elite close in.
 */
export class EliteBehaviorSystem {
  /** Global pattern cadence factor; lower = more frequent chassis patterns. */
  static readonly CADENCE = 0.62;

  private moved = false;

  constructor(private readonly port: EliteBehaviorPort) {}

  patternCooldown(base: number, entity: Ent) {
    const t = Math.min(1, this.port.time() / this.port.runDuration);
    const rarity = entity.rarity === 'legendary' ? 0.65 : entity.rarity === 'uplifted' ? 0.82 : 1;
    const swift = entity.affix === 'swift' ? 0.85 : 1;
    return Math.max(
      0.9,
      base * EliteBehaviorSystem.CADENCE * (1 - 0.25 * t) * rarity * swift * (entity.relicGapMul ?? 1)
    );
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

  /** Movement helpers: a closing-in elite ignores its chassis spacing for this tick. */
  private move(entity: Ent, x: number, z: number, speed: number, multiplier = 1) {
    if (this.moved) return;
    this.port.steerTo(entity, x, z, speed, multiplier);
  }

  private retreat(entity: Ent, nx: number, nz: number, speed: number, share: number) {
    if (this.moved) return;
    const dt = this.port.dt();
    entity.x -= nx * speed * share * dt;
    entity.z -= nz * speed * share * dt;
  }

  private strikeScale(entity: Ent) {
    // Echo/relic cast growth also sharpens chassis patterns, so captured relics are felt.
    return this.port.damageScale() * Math.min(2.2, entity.relicCastMul ?? 1);
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
    const dashing = chassis === 'hunter' && entity.adaptStage !== 0;
    if (!entity.eliteAction && entity.state === 'normal' && !echoBusy && !dashing)
      p.fieldRefusals(entity, distance);

    // Close-range Echo cards pull the elite into the hero instead of letting it idle at range.
    this.moved = false;
    if (!entity.eliteAction && !dashing && (entity.closeInUntil ?? 0) > time && distance > 1.4) {
      p.steerTo(entity, px, pz, speed, 1.12);
      this.moved = true;
    }

    if (chassis === 'hunter') {
      this.updatePredator(entity, speed, distance, px, pz, playerVX, playerVZ, echoBusy);
      return;
    }

    if (chassis === 'architect') {
      // VEIL: relocates into a fog bank that swallows hero fire, blinds the hero and raises walls.
      if (entity.eliteAction === 'veil') {
        if (time < (entity.eliteActionUntil ?? 0)) return;
        entity.eliteAction = undefined;
        entity.eliteActionUntil = 0;
        entity.x = Math.max(p.world.minX + 1, Math.min(p.world.maxX - 1, entity.lockedX));
        entity.z = Math.max(p.world.minZ + 1, Math.min(p.world.maxZ - 1, entity.lockedZ));
        for (let i = 0; i < 4; i++) {
          const angle = i * Math.PI * 2 / 3 + entity.id * 0.37;
          const radius = i === 0 ? 0 : 4.2;
          p.addField({
            x: entity.x + Math.cos(angle) * radius,
            z: entity.z + Math.sin(angle) * radius,
            radius: i === 0 ? 4.4 : 3.4,
            ttl: 7.5,
            kind: 'veil',
            dps: 0,
            tickAcc: 0,
            faction: 'rival',
            ownerId: entity.id
          });
        }
        // A blinding bank lands on the hero as well: leave it or fight half-blind.
        p.addField({
          x: px,
          z: pz,
          radius: 3.2,
          ttl: 5,
          kind: 'veil',
          dps: 0,
          tickAcc: 0,
          faction: 'rival',
          ownerId: entity.id
        });
        entity.cooldown = this.patternCooldown(5.2, entity);
        entity.exposedUntil = time + 0.45;
        return;
      }
      if (distance > 8.5) this.move(entity, px, pz, speed, 1.05);
      else if (distance < 4.5) this.retreat(entity, nx, nz, speed, 0.6);

      if ((entity.wallReadyAt ?? 0) === 0) entity.wallReadyAt = time + 3.5;
      if (!echoBusy && !entity.eliteAction && time >= (entity.wallReadyAt ?? 0) && distance < 13) {
        // Walls open toward the Architect: the only exit forces the hero to engage it.
        p.raiseWalls(entity, px, pz, -nx, -nz);
        entity.wallReadyAt = time + this.patternCooldown(10, entity);
      }

      if (!echoBusy && !entity.eliteAction && entity.cooldown <= 0) {
        const side = entity.id % 2 ? 1 : -1;
        const target = p.freeOf(px - nz * side * 6.5, pz + nx * side * 6.5, entity.radius);
        entity.lockedX = target.x;
        entity.lockedZ = target.z;
        this.beginPattern(
          entity,
          'elite_architect_veil_tell',
          { kind: 'circle', x: target.x, z: target.z, radius: 4.4 },
          0.6,
          'veil'
        );
      }
      return;
    }

    if (chassis === 'broodmaker') {
      // REPLICATOR: its pulse throws out real copies of itself.
      if (entity.eliteAction === 'replicate') {
        if (time < (entity.eliteActionUntil ?? 0)) return;
        entity.eliteAction = undefined;
        entity.eliteActionUntil = 0;
        p.combatShape('elite_brood_active', { kind: 'circle', x: entity.x, z: entity.z, radius: 4.6 });
        if (Math.hypot(px - entity.x, pz - entity.z) <= 4.6 + HERO_HIT_RADIUS)
          p.hitPlayer(24 * this.strikeScale(entity), entity, 'brood_pulse');
        if (!entity.cloneParent) p.spawnClone(entity);
        entity.cooldown = this.patternCooldown(5.2, entity);
        return;
      }
      if (distance > 5.2) this.move(entity, px, pz, speed, 1.02);
      else if (distance < 2.6) this.retreat(entity, nx, nz, speed, 0.45);
      if (!echoBusy && !entity.eliteAction && entity.cooldown <= 0 && distance < 9)
        this.beginPattern(
          entity,
          'elite_brood_tell',
          { kind: 'circle', x: entity.x, z: entity.z, radius: 4.6 },
          0.7,
          'replicate'
        );
      return;
    }

    if (chassis === 'bulwark') {
      // PRISM: shield lunge. The plate closes the gap, then bashes the frontal sector.
      if (entity.eliteAction === 'prism') {
        if (time < (entity.eliteActionUntil ?? 0)) return;
        entity.eliteAction = undefined;
        entity.eliteActionUntil = 0;
        const reach = Math.max(0, Math.min(4.8, Math.hypot(px - entity.x, pz - entity.z) - 1.3));
        const landed = p.freeOf(
          entity.x + entity.lockedX * reach,
          entity.z + entity.lockedZ * reach,
          entity.radius
        );
        entity.x = Math.max(p.world.minX + 1, Math.min(p.world.maxX - 1, landed.x));
        entity.z = Math.max(p.world.minZ + 1, Math.min(p.world.maxZ - 1, landed.z));
        p.combatShape('elite_prism_active', {
          kind: 'sector',
          x: entity.x,
          z: entity.z,
          radius: 5.6,
          aimX: entity.lockedX,
          aimZ: entity.lockedZ,
          halfAngle: 0.8
        });
        if (p.playerInSector(entity.x, entity.z, entity.lockedX, entity.lockedZ, 5.6, 0.8)) {
          p.hitPlayer(32 * this.strikeScale(entity), entity, 'prism_bash');
          const dx = px - entity.x;
          const dz = pz - entity.z;
          const magnitude = Math.hypot(dx, dz) || 1;
          p.movePlayer(dx / magnitude * 2.4, dz / magnitude * 2.4);
        }
        entity.cooldown = this.patternCooldown(3.8, entity);
        entity.exposedUntil = time + 0.55;
        return;
      }
      if (distance > 2.6) this.move(entity, px, pz, speed);
      else if (distance < 1.6) this.retreat(entity, nx, nz, speed, 0.3);
      if (!echoBusy && !entity.eliteAction && entity.cooldown <= 0 && distance < 9.5) {
        entity.lockedX = nx;
        entity.lockedZ = nz;
        this.beginPattern(
          entity,
          'elite_prism_tell',
          {
            kind: 'sector',
            x: entity.x + nx * Math.min(4.8, Math.max(0, distance - 1.3)),
            z: entity.z + nz * Math.min(4.8, Math.max(0, distance - 1.3)),
            radius: 5.6,
            aimX: nx,
            aimZ: nz,
            halfAngle: 0.8
          },
          0.62,
          'prism'
        );
      }
      return;
    }

    if (chassis === 'harvester') {
      // NULL WEAVER: drags the hero into its harvesting sector, then reaps and heals.
      if (entity.eliteAction === 'null') {
        if (time < (entity.eliteActionUntil ?? 0)) {
          const dx = entity.x - px;
          const dz = entity.z - pz;
          const d = Math.hypot(dx, dz) || 1;
          if (d > 1.6 && d < 10) p.movePlayer(dx / d * 1.7 * dt, dz / d * 1.7 * dt);
          return;
        }
        entity.eliteAction = undefined;
        entity.eliteActionUntil = 0;
        p.combatShape('elite_null_active', {
          kind: 'sector',
          x: entity.x,
          z: entity.z,
          radius: 5.6,
          aimX: entity.lockedX,
          aimZ: entity.lockedZ,
          halfAngle: 0.85
        });
        if (p.playerInSector(entity.x, entity.z, entity.lockedX, entity.lockedZ, 5.6, 0.85)) {
          p.hitPlayer(38 * this.strikeScale(entity), entity, 'null_harvest');
          entity.hp = Math.min(entity.maxHp, entity.hp + entity.maxHp * 0.08);
        }
        entity.cooldown = this.patternCooldown(3.6, entity);
        return;
      }
      const side = entity.id % 2 ? 1 : -1;
      const tx = px - nz * side * 3.2;
      const tz = pz + nx * side * 3.2;
      this.move(entity, tx, tz, speed, 1.08);
      if (!echoBusy && entity.cooldown <= 0 && distance < 8.5) {
        entity.lockedX = nx;
        entity.lockedZ = nz;
        this.beginPattern(
          entity,
          'elite_null_tell',
          {
            kind: 'sector',
            x: entity.x,
            z: entity.z,
            radius: 5.6,
            aimX: nx,
            aimZ: nz,
            halfAngle: 0.85
          },
          0.66,
          'null'
        );
      }
      return;
    }

    if (chassis === 'shepherd') {
      // METAMORPH: a wide command pulse drives a large pack at the hero.
      if (entity.eliteAction === 'metamorph') {
        if (time < (entity.eliteActionUntil ?? 0)) return;
        entity.eliteAction = undefined;
        entity.eliteActionUntil = 0;
        p.combatShape(
          'elite_shepherd_active',
          { kind: 'circle', x: entity.x, z: entity.z, radius: 6.2 },
          'control'
        );
        if (Math.hypot(px - entity.x, pz - entity.z) <= 6.2 + HERO_HIT_RADIUS)
          p.hitPlayer(22 * this.strikeScale(entity), entity, 'shepherd_pulse');
        let buffed = 0;
        for (const other of p.entities()) {
          if (
            other === entity ||
            other.kind === 'elite' ||
            other.hp <= 0 ||
            Math.hypot(other.x - entity.x, other.z - entity.z) > 11
          )
            continue;
          other.buffUntil = Math.max(other.buffUntil, time + 4);
          other.orderX = px;
          other.orderZ = pz;
          other.orderUntil = time + 4;
          if (++buffed >= 14) break;
        }
        entity.cooldown = this.patternCooldown(4.6, entity);
        return;
      }
      if (entity.shepherdMode === 'condensed') {
        const tx = px + playerVX * 0.35;
        const tz = pz + playerVZ * 0.35;
        this.move(entity, tx, tz, speed, 1.3);
      } else if (entity.shepherdMode === 'migratory') {
        const side = entity.id % 2 ? 1 : -1;
        const tx = px - nz * side * 4.8;
        const tz = pz + nx * side * 4.8;
        this.move(entity, tx, tz, speed, 1.15);
      } else if (distance > 4.2) this.move(entity, px, pz, speed, 1.05);

      if (!echoBusy && !entity.eliteAction && entity.cooldown <= 0 && distance < 11)
        this.beginPattern(
          entity,
          'elite_shepherd_tell',
          { kind: 'circle', x: entity.x, z: entity.z, radius: 6.2 },
          0.76,
          'metamorph'
        );
      return;
    }

    if (distance > 2.4) this.move(entity, px, pz, speed);
  }

  /**
   * PREDATOR: faster than the hero. Locks a predictive lane, dashes through it with a real impact
   * hit, and uplifted/legendary Predators chain one/two re-aimed dashes.
   */
  private updatePredator(
    entity: Ent,
    speed: number,
    distance: number,
    px: number,
    pz: number,
    playerVX: number,
    playerVZ: number,
    echoBusy: boolean
  ) {
    const p = this.port;
    const time = p.time();
    const dt = p.dt();

    if (entity.adaptStage === 2) {
      entity.eliteAction = 'predator_dash';
      entity.x += entity.lockedX * 20 * dt;
      entity.z += entity.lockedZ * 20 * dt;
      entity.x = Math.max(p.world.minX + 1, Math.min(p.world.maxX - 1, entity.x));
      entity.z = Math.max(p.world.minZ + 1, Math.min(p.world.maxZ - 1, entity.z));
      if (
        !entity.dashHit &&
        Math.hypot(px - entity.x, pz - entity.z) < entity.radius + HERO_HIT_RADIUS + 0.3
      ) {
        entity.dashHit = true;
        p.hitPlayer(24 * this.strikeScale(entity), entity, 'predator_dash');
        p.movePlayer(entity.lockedX * 1.4, entity.lockedZ * 1.4);
      }
      if (time >= (entity.eliteActionUntil ?? 0)) {
        if ((entity.dashChain ?? 0) > 0) {
          entity.dashChain = (entity.dashChain ?? 0) - 1;
          this.lockPredatorLane(entity, px + playerVX * 0.4, pz + playerVZ * 0.4, 0.34);
          return;
        }
        entity.adaptStage = 0;
        entity.eliteAction = undefined;
        entity.eliteActionUntil = 0;
        entity.cooldown = this.patternCooldown(2.8, entity);
        entity.exposedUntil = time + 0.8;
      }
      return;
    }
    if (entity.adaptStage === 1) {
      if (time >= (entity.eliteActionUntil ?? 0)) {
        entity.adaptStage = 2;
        entity.dashHit = false;
        entity.eliteAction = 'predator_dash';
        entity.eliteActionUntil = time + 0.5;
      }
      return;
    }
    const tx = px + playerVX * 0.58;
    const tz = pz + playerVZ * 0.58;
    if (distance > 0.9) this.move(entity, tx, tz, speed, 1);
    if (!echoBusy && !entity.eliteAction && entity.cooldown <= 0 && distance < 11) {
      entity.dashChain = entity.rarity === 'legendary' ? 2 : entity.rarity === 'uplifted' ? 1 : 0;
      this.lockPredatorLane(entity, tx, tz, 0.5);
      p.emitOrder(entity, 'predator');
    }
  }

  private lockPredatorLane(entity: Ent, tx: number, tz: number, tell: number) {
    const p = this.port;
    const dx = tx - entity.x;
    const dz = tz - entity.z;
    const magnitude = Math.hypot(dx, dz) || 1;
    entity.lockedX = dx / magnitude;
    entity.lockedZ = dz / magnitude;
    entity.adaptStage = 1;
    entity.eliteAction = 'predator';
    entity.eliteActionUntil = p.time() + tell;
    entity.cooldown = 99;
    p.emitCombatShape('elite_predator_tell', {
      kind: 'ray',
      x: entity.x,
      z: entity.z,
      aimX: entity.lockedX,
      aimZ: entity.lockedZ,
      range: 10,
      halfWidth: 0.95
    });
  }
}
