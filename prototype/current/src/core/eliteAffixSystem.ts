import type { DamageSourceId, EliteOrderId } from './types.js';
import type { Ent } from './state.js';

export interface EliteAffixPort {
  readonly world: { minX: number; maxX: number; minZ: number; maxZ: number };

  time(): number;
  dt(): number;
  tick(): number;
  playerX(): number;
  playerZ(): number;
  playerVX(): number;
  playerVZ(): number;
  hasEcho(entityId: number): boolean;
  entities(): readonly Ent[];
  randomRange(min: number, max: number): number;
  /** Heavy retinue summoned around the elite (bounded per summoner by the owner). */
  spawnRetinue(entity: Ent, count: number): void;
  emitOrder(entity: Ent, order: EliteOrderId, count?: number): void;
  emitTemporalTell(entity: Ent): void;
  emitShieldTell(entity: Ent, aimX: number, aimZ: number): void;
  emitRareEvent(title: string, detail: string, x: number, z: number): void;
  hitPlayer(amount: number, attacker: Ent, source: DamageSourceId): void;
  damageScale(): number;
}

export interface EliteAffixBehaviorResult {
  skipBehavior: boolean;
  speedMultiplier: number;
}

/** Shield pool share of max HP and its regeneration rules (RoR2 Overloading-like). */
export const SHIELD_POOL_SHARE = 0.6;
const SHIELD_REGEN_DELAY = 4;
const SHIELD_REGEN_PER_SECOND = 0.22;
const SHIELD_BROKEN_SECONDS = 3.5;

/**
 * Behavioral layer for elite affixes.
 *
 * Chassis identity stays in EliteBehaviorSystem. This system owns the cross-chassis modifiers
 * that alter cadence, summon support, reposition, regenerate, or commit a frontal shield action.
 *
 * v0.14 "hard" pass: every affix must be felt within seconds — summoners keep a heavy retinue,
 * shields are a real absorbing pool, temporal blinks hit hard, regeneration never fully stops.
 */
export class EliteAffixSystem {
  constructor(private readonly port: EliteAffixPort) {}

  earlyTick(entity: Ent) {
    if (entity.kind !== 'elite') return;

    const p = this.port;
    const dt = p.dt();

    if (entity.affix === 'crowned') entity.cooldown -= dt * 0.6;

    if (entity.affix === 'brood' && entity.affixPulse <= 0) {
      entity.affixPulse = 3.5;
      const count = entity.rarity === 'legendary' ? 3 : 2;
      p.spawnRetinue(entity, count);
      p.emitOrder(entity, 'brood', count);
    }
  }

  beforeBehavior(entity: Ent, distance: number): EliteAffixBehaviorResult {
    const p = this.port;
    const time = p.time();
    const dt = p.dt();

    if (entity.kind !== 'elite') {
      if (entity.affix === 'regenerating') this.updateRegeneration(entity, time, dt);
      else entity.regenTick = 0;
      return { skipBehavior: false, speedMultiplier: 1 };
    }

    if (entity.affix === 'vanguard' && entity.affixPulse <= 0) {
      entity.affixPulse = 3.4;
      const lead = 0.65;
      const tx = p.playerX() + p.playerVX() * lead;
      const tz = p.playerZ() + p.playerVZ() * lead;
      let count = 0;
      for (const other of p.entities()) {
        if (
          other.kind === 'elite' ||
          other.hp <= 0 ||
          Math.hypot(other.x - entity.x, other.z - entity.z) > 10
        ) continue;
        other.orderX = tx;
        other.orderZ = tz;
        other.orderUntil = time + 2.8;
        other.buffUntil = time + 2.8;
        count++;
        if (count >= 12) break;
      }
      if (count) p.emitOrder(entity, 'surge', count);
    }

    if (entity.affix === 'temporal') {
      if (entity.state === 'telegraph') {
        if (entity.stateTimer <= 0) {
          entity.x = Math.max(p.world.minX + 1, Math.min(p.world.maxX - 1, entity.lockedX));
          entity.z = Math.max(p.world.minZ + 1, Math.min(p.world.maxZ - 1, entity.lockedZ));
          if (Math.hypot(p.playerX() - entity.x, p.playerZ() - entity.z) < 2.6)
            p.hitPlayer(30 * p.damageScale(), entity, 'temporal_shift');
          entity.exposedUntil = time + 0.9;
          entity.state = 'normal';
          entity.affixPulse = 2.8;
        } else {
          return { skipBehavior: true, speedMultiplier: 1 };
        }
      } else if (entity.affixPulse <= 0 && !entity.eliteAction && !p.hasEcho(entity.id)) {
        entity.lockedX = Math.max(
          p.world.minX + 1,
          Math.min(p.world.maxX - 1, p.playerX() + p.playerVX() * 0.46)
        );
        entity.lockedZ = Math.max(
          p.world.minZ + 1,
          Math.min(p.world.maxZ - 1, p.playerZ() + p.playerVZ() * 0.46)
        );
        entity.state = 'telegraph';
        entity.stateTimer = 0.6;
        entity.affixPulse = 99;
        p.emitTemporalTell(entity);
        return { skipBehavior: true, speedMultiplier: 1 };
      }
    }

    if (entity.affix === 'regenerating') this.updateRegeneration(entity, time, dt);
    else entity.regenTick = 0;

    let speedMultiplier = 1;
    if (entity.affix === 'shielded') {
      entity.shieldState ??= 'guard';
      this.ensurePool(entity);

      if (entity.shieldState === 'broken') {
        if (time >= (entity.shieldCommitUntil ?? 0)) {
          entity.shieldState = 'guard';
          entity.shieldHp = entity.shieldMax;
          entity.affixPulse = Math.max(entity.affixPulse, 2.4);
        }
      } else {
        if (time - entity.lastDamageAt > SHIELD_REGEN_DELAY)
          entity.shieldHp = Math.min(
            entity.shieldMax ?? 0,
            (entity.shieldHp ?? 0) + (entity.shieldMax ?? 0) * SHIELD_REGEN_PER_SECOND * dt
          );

        if (entity.shieldState === 'commit') {
          speedMultiplier = 1.25;
          if (time >= (entity.shieldCommitUntil ?? 0)) entity.shieldState = 'guard';
        } else {
          const target = Math.atan2(p.playerZ() - entity.z, p.playerX() - entity.x);
          const diff = this.angleDiff(target, entity.shieldAngle);
          entity.shieldAngle += Math.max(-1.4 * dt, Math.min(1.4 * dt, diff));
          if (entity.affixPulse <= 0 && distance < 9 && !entity.eliteAction && !p.hasEcho(entity.id)) {
            entity.shieldState = 'commit';
            entity.shieldCommitUntil = time + 0.82;
            entity.affixPulse = 3.6;
            entity.shieldAngle = target;
            p.emitShieldTell(entity, Math.cos(entity.shieldAngle), Math.sin(entity.shieldAngle));
          }
        }
      }
      entity.shieldStability = this.poolPercent(entity);
    }

    return { skipBehavior: false, speedMultiplier };
  }

  /**
   * Shielded elites carry an absorbing pool (60% of max HP). All hero damage drains the pool
   * first; frontal directional hits are additionally cut. A drained pool breaks the shield for
   * 3.5 s (x1.3 damage taken) before it returns at full strength.
   */
  modifyIncomingDamage(
    entity: Ent,
    damage: number,
    directional: boolean,
    sourceX: number,
    sourceZ: number
  ) {
    if (entity.kind !== 'elite' || entity.affix !== 'shielded') return damage;

    const state = entity.shieldState ?? 'guard';
    if (state === 'broken') return damage * 1.3;

    this.ensurePool(entity);
    let remaining = damage;
    if (directional) {
      const incoming = Math.atan2(sourceZ - entity.z, sourceX - entity.x);
      const diff = Math.abs(this.angleDiff(incoming, entity.shieldAngle));
      remaining *= diff < 0.95
        ? (state === 'commit' ? 0.4 : 0.3)
        : (state === 'commit' ? 1.25 : 1.1);
    }

    const absorbed = Math.min(entity.shieldHp ?? 0, remaining);
    entity.shieldHp = (entity.shieldHp ?? 0) - absorbed;
    remaining -= absorbed;
    if ((entity.shieldHp ?? 0) <= 0) this.breakShield(entity);
    entity.shieldStability = this.poolPercent(entity);
    return remaining;
  }

  afterCloseDamage(entity: Ent, damage: number, forceDoctrine: number) {
    if (
      entity.kind !== 'elite' ||
      entity.affix !== 'shielded' ||
      forceDoctrine <= 0 ||
      (entity.shieldState ?? 'guard') === 'broken'
    ) return;

    this.ensurePool(entity);
    // Impulse doctrine cracks the pool directly on top of normal absorption.
    entity.shieldHp = Math.max(0, (entity.shieldHp ?? 0) - damage * (0.1 + forceDoctrine * 0.05));
    if ((entity.shieldHp ?? 0) <= 0) this.breakShield(entity);
    entity.shieldStability = this.poolPercent(entity);
  }

  private ensurePool(entity: Ent) {
    if (entity.shieldMax === undefined) {
      entity.shieldMax = entity.maxHp * SHIELD_POOL_SHARE;
      entity.shieldHp = entity.shieldMax;
    }
  }

  private poolPercent(entity: Ent) {
    if ((entity.shieldState ?? 'guard') === 'broken') return 0;
    return Math.max(0, Math.min(100, ((entity.shieldHp ?? 0) / Math.max(1, entity.shieldMax ?? 1)) * 100));
  }

  private breakShield(entity: Ent) {
    if ((entity.shieldState ?? 'guard') === 'broken') return;
    const time = this.port.time();
    entity.shieldHp = 0;
    entity.shieldState = 'broken';
    entity.shieldCommitUntil = time + SHIELD_BROKEN_SECONDS;
    entity.exposedUntil = Math.max(entity.exposedUntil, time + SHIELD_BROKEN_SECONDS);
    this.port.emitRareEvent(
      'ЩИТ СЛОМАН',
      'Окно уязвимости элиты: 3.5 с, урон ×1.3',
      entity.x,
      entity.z
    );
  }

  private updateRegeneration(entity: Ent, time: number, dt: number) {
    // Regeneration never stops: 1%/s under fire, 5%/s after 2 s without damage.
    const rate = time - entity.lastDamageAt > 2 ? 0.05 : 0.01;
    entity.regenTick += dt;
    if (entity.regenTick >= 0.25) {
      entity.hp = Math.min(entity.maxHp, entity.hp + entity.maxHp * rate * entity.regenTick);
      entity.regenTick = 0;
    }
  }

  private angleDiff(a: number, b: number) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }
}
