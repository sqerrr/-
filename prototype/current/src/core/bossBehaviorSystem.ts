import type { CombatShape, BossPatternId, DamageSourceId, EnemyKind } from './types.js';
import type { Ent, Field } from './state.js';

type NormalEnemyKind = Exclude<EnemyKind, 'elite' | 'hero'>;

export interface BossBehaviorPort {
  readonly world: { minX: number; maxX: number; minZ: number; maxZ: number };

  time(): number;
  tick(): number;
  dt(): number;
  playerX(): number;
  playerZ(): number;
  playerVX(): number;
  playerVZ(): number;

  hasEcho(entityId: number): boolean;
  fieldRefusals(entity: Ent, distance: number): void;
  steerTo(entity: Ent, x: number, z: number, speed: number, multiplier?: number): void;
  playerInSector(x: number, z: number, ax: number, az: number, radius: number, halfAngle: number): boolean;
  playerInRay(x: number, z: number, ax: number, az: number, range: number, halfWidth: number): boolean;
  hitPlayer(amount: number, attacker: Ent, source: DamageSourceId): void;
  damageScale(): number;
  addField(field: Omit<Field, 'id'>): void;
  spawnEnemyAt(kind: NormalEnemyKind, x: number, z: number, buffedFor?: number): void;
  randomFloat(): number;
  randomRange(min: number, max: number): number;
  emitPhase(entity: Ent, phase: number): void;
  emitTelegraph(source: string, shape: CombatShape): void;
  emitPattern(entity: Ent, pattern: BossPatternId): void;
}

/**
 * Final Warden behavior and phase machine.
 *
 * The system owns pattern selection and phase transitions. Simulation remains responsible for
 * combat services (damage, spawning, Echoes, geometry), supplied through a narrow port.
 */
export class BossBehaviorSystem {
  constructor(private readonly port: BossBehaviorPort) {}

  update(entity: Ent, speed: number, distance: number, nx: number, nz: number) {
    const p = this.port;
    const time = p.time();
    const dt = p.dt();
    const px = p.playerX();
    const pz = p.playerZ();

    const nextPhase =
      entity.bossPhase === 1 && entity.hp <= entity.maxHp * 0.66 ? 2 :
      entity.bossPhase === 2 && entity.hp <= entity.maxHp * 0.33 ? 3 : 0;

    if (nextPhase) {
      entity.bossPhase = nextPhase;
      entity.adaptCooldown = nextPhase === 3 ? 0.15 : 0.45;
      entity.buffUntil = time + 1.1;
      p.emitPhase(entity, nextPhase);
      if (nextPhase === 3) {
        for (let i = 0; i < 4; i++) {
          const angle = i * Math.PI / 2 + 0.35;
          p.spawnEnemyAt(
            i % 2 ? 'bookmark' : 'marginwalker',
            entity.x + Math.cos(angle) * 2.6,
            entity.z + Math.sin(angle) * 2.6,
            2.0
          );
        }
      }
    }

    // Between Warden patterns the boss can field the same authored Echo language as elites.
    if (
      entity.adaptStage === 0 &&
      !entity.eliteAction &&
      !p.hasEcho(entity.id) &&
      entity.repertoire.length
    ) {
      p.fieldRefusals(entity, distance);
      if (p.hasEcho(entity.id)) return;
    }

    if (entity.adaptStage === 2 && entity.bossPattern === 'charge') {
      entity.x += entity.lockedX * (entity.bossPhase >= 3 ? 15.2 : entity.bossPhase >= 2 ? 13.5 : 11.5) * dt;
      entity.z += entity.lockedZ * (entity.bossPhase >= 3 ? 15.2 : entity.bossPhase >= 2 ? 13.5 : 11.5) * dt;
      entity.x = Math.max(p.world.minX + 1, Math.min(p.world.maxX - 1, entity.x));
      entity.z = Math.max(p.world.minZ + 1, Math.min(p.world.maxZ - 1, entity.z));
      if (entity.stateTimer <= 0) {
        entity.adaptStage = 0;
        entity.adaptCooldown = entity.bossPhase >= 3 ? 1.65 : entity.bossPhase >= 2 ? 2.25 : 3.2;
        entity.exposedUntil = time + 1.25;
      }
      return;
    }

    if (entity.adaptStage === 1 && entity.stateTimer <= 0) {
      if (
        entity.bossPattern === 'sweep' &&
        p.playerInSector(
          entity.x,
          entity.z,
          entity.lockedX,
          entity.lockedZ,
          7.8,
          entity.bossPhase >= 2 ? 0.92 : 0.78
        )
      ) {
        p.hitPlayer(
          (entity.bossPhase >= 3 ? 61 : entity.bossPhase >= 2 ? 48 : 39) * p.damageScale(),
          entity,
          'warden_sweep'
        );
      } else if (
        entity.bossPattern === 'rupture' &&
        p.playerInRay(
          entity.x,
          entity.z,
          entity.lockedX,
          entity.lockedZ,
          16,
          entity.bossPhase >= 2 ? 1.85 : 1.55
        )
      ) {
        p.hitPlayer(
          (entity.bossPhase >= 3 ? 55 : entity.bossPhase >= 2 ? 43 : 35) * p.damageScale(),
          entity,
          'warden_rupture'
        );
        p.addField({
          x: px,
          z: pz,
          radius: 1.65,
          ttl: 2.4,
          kind: 'architect',
          dps: 18 * p.damageScale(),
          tickAcc: 0
        });
      } else if (entity.bossPattern === 'charge') {
        entity.adaptStage = 2;
        entity.stateTimer = entity.bossPhase >= 2 ? 0.64 : 0.58;
        return;
      }

      entity.adaptStage = 0;
      entity.adaptCooldown = entity.bossPhase >= 3 ? 1.65 : entity.bossPhase >= 2 ? 2.25 : 3.2;
      entity.exposedUntil = time + 0.7;
      return;
    }

    if (entity.adaptStage !== 0) return;

    if (distance > 6.0)
      p.steerTo(entity, px, pz, speed, entity.bossPhase >= 2 ? 1.22 : 1);
    else if (distance < 3.2) {
      entity.x -= nx * speed * 0.5 * dt;
      entity.z -= nz * speed * 0.5 * dt;
    }

    if (entity.adaptCooldown > 0) return;

    const random = p.randomFloat();
    const pattern: BossPatternId = random < 0.36 ? 'sweep' : random < 0.68 ? 'rupture' : 'charge';
    const tx = px + p.playerVX() * (pattern === 'sweep' ? 0.18 : 0.55);
    const tz = pz + p.playerVZ() * (pattern === 'sweep' ? 0.18 : 0.55);
    const dx = tx - entity.x;
    const dz = tz - entity.z;
    const magnitude = Math.hypot(dx, dz) || 1;

    entity.lockedX = dx / magnitude;
    entity.lockedZ = dz / magnitude;
    entity.bossPattern = pattern;
    entity.adaptStage = 1;
    entity.stateTimer = pattern === 'charge' ? 1.0 : 0.88;

    const shape: CombatShape =
      pattern === 'sweep'
        ? {
            kind: 'sector',
            x: entity.x,
            z: entity.z,
            aimX: entity.lockedX,
            aimZ: entity.lockedZ,
            radius: 7.8,
            halfAngle: entity.bossPhase >= 2 ? 0.92 : 0.78
          }
        : {
            kind: 'ray',
            x: entity.x,
            z: entity.z,
            aimX: entity.lockedX,
            aimZ: entity.lockedZ,
            range: pattern === 'rupture' ? 16 : 15,
            halfWidth: pattern === 'rupture' ? (entity.bossPhase >= 2 ? 1.85 : 1.55) : 1.05
          };

    p.emitTelegraph(`telegraph_boss_${pattern}`, shape);
    p.emitPattern(entity, pattern);

    if (entity.bossPhase >= 2 && p.randomFloat() < 0.55) {
      for (let i = 0; i < 3; i++) {
        const angle = p.randomRange(0, Math.PI * 2);
        p.spawnEnemyAt(
          i === 0 ? 'bookmark' : 'footnote',
          entity.x + Math.cos(angle) * 2.2,
          entity.z + Math.sin(angle) * 2.2,
          1.6
        );
      }
    }
  }
}
