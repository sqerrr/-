import type { DamageSourceId, EliteOrderId } from './types.js';
import type { Ent } from './state.js';

type NormalEnemyKind = Exclude<Ent['kind'], 'elite' | 'hero'>;

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
  spawnEnemyAt(kind: NormalEnemyKind, x: number, z: number, buffedFor?: number): void;
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

/**
 * Behavioral layer for elite affixes.
 *
 * Chassis identity stays in EliteBehaviorSystem. This system owns the cross-chassis modifiers
 * that alter cadence, summon support, reposition, regenerate, or commit a frontal shield action.
 */
export class EliteAffixSystem {
  constructor(private readonly port: EliteAffixPort) {}

  earlyTick(entity: Ent) {
    if (entity.kind !== 'elite') return;

    const p = this.port;
    const dt = p.dt();

    if (entity.affix === 'crowned') entity.cooldown -= dt * 0.24;

    if (entity.affix === 'brood' && entity.affixPulse <= 0) {
      entity.affixPulse = 7.2;
      for (let i = 0; i < 3; i++) {
        const angle = p.randomRange(0, Math.PI * 2);
        const radius = p.randomRange(1.0, 2.1);
        p.spawnEnemyAt(
          i === 0 ? 'bookmark' : 'palimpsest',
          entity.x + Math.cos(angle) * radius,
          entity.z + Math.sin(angle) * radius,
          1.7
        );
      }
      p.emitOrder(entity, 'brood', 3);
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
      entity.affixPulse = 5.8;
      const lead = 0.65;
      const tx = p.playerX() + p.playerVX() * lead;
      const tz = p.playerZ() + p.playerVZ() * lead;
      let count = 0;
      for (const other of p.entities()) {
        if (
          other.kind === 'elite' ||
          other.hp <= 0 ||
          Math.hypot(other.x - entity.x, other.z - entity.z) > 8.2
        ) continue;
        other.orderX = tx;
        other.orderZ = tz;
        other.orderUntil = time + 2.35;
        other.buffUntil = time + 2.35;
        count++;
        if (count >= 7) break;
      }
      if (count) p.emitOrder(entity, 'surge', count);
    }

    if (entity.affix === 'temporal') {
      if (entity.state === 'telegraph') {
        if (entity.stateTimer <= 0) {
          entity.x = Math.max(p.world.minX + 1, Math.min(p.world.maxX - 1, entity.lockedX));
          entity.z = Math.max(p.world.minZ + 1, Math.min(p.world.maxZ - 1, entity.lockedZ));
          if (Math.hypot(p.playerX() - entity.x, p.playerZ() - entity.z) < 1.8)
            p.hitPlayer(14 * p.damageScale(), entity, 'temporal_shift');
          entity.exposedUntil = time + 1.15;
          entity.state = 'normal';
          entity.affixPulse = 4.9;
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
        entity.stateTimer = 0.76;
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
      entity.shieldStability ??= 100;

      if (entity.shieldState === 'broken') {
        if (time >= (entity.shieldCommitUntil ?? 0)) {
          entity.shieldState = 'guard';
          entity.shieldStability = 100;
          entity.affixPulse = Math.max(entity.affixPulse, 2.8);
        }
      } else if (entity.shieldState === 'commit') {
        speedMultiplier = 1.18;
        if (time >= (entity.shieldCommitUntil ?? 0)) entity.shieldState = 'guard';
      } else {
        const target = Math.atan2(p.playerZ() - entity.z, p.playerX() - entity.x);
        const diff = this.angleDiff(target, entity.shieldAngle);
        entity.shieldAngle += Math.max(-0.82 * dt, Math.min(0.82 * dt, diff));
        if (entity.affixPulse <= 0 && distance < 8.5 && !entity.eliteAction && !p.hasEcho(entity.id)) {
          entity.shieldState = 'commit';
          entity.shieldCommitUntil = time + 0.82;
          entity.affixPulse = 4.6;
          entity.shieldAngle = target;
          p.emitShieldTell(entity, Math.cos(entity.shieldAngle), Math.sin(entity.shieldAngle));
        }
      }
    }

    return { skipBehavior: false, speedMultiplier };
  }

  modifyIncomingDamage(
    entity: Ent,
    damage: number,
    directional: boolean,
    sourceX: number,
    sourceZ: number
  ) {
    if (entity.kind !== 'elite' || entity.affix !== 'shielded' || !directional) return damage;

    const state = entity.shieldState ?? 'guard';
    if (state === 'broken') return damage * 1.3;

    const incoming = Math.atan2(sourceZ - entity.z, sourceX - entity.x);
    const diff = Math.abs(this.angleDiff(incoming, entity.shieldAngle));
    return damage * (
      diff < 0.95
        ? (state === 'commit' ? 0.58 : 0.42)
        : (state === 'commit' ? 1.35 : 1.2)
    );
  }

  afterCloseDamage(entity: Ent, damage: number, forceDoctrine: number) {
    if (
      entity.kind !== 'elite' ||
      entity.affix !== 'shielded' ||
      forceDoctrine <= 0
    ) return;

    entity.shieldStability = Math.max(
      0,
      (entity.shieldStability ?? 100) - damage * (0.018 + forceDoctrine * 0.008)
    );

    if ((entity.shieldStability ?? 0) > 0 || (entity.shieldState ?? 'guard') === 'broken')
      return;

    entity.shieldState = 'broken';
    entity.shieldCommitUntil = this.port.time() + 1.65;
    entity.exposedUntil = Math.max(entity.exposedUntil, this.port.time() + 1.65);
    this.port.emitRareEvent(
      'ЩИТ СЛОМАН',
      'Окно уязвимости элиты',
      entity.x,
      entity.z
    );
  }

  private updateRegeneration(entity: Ent, time: number, dt: number) {
    if (time - entity.lastDamageAt > 3) {
      entity.regenTick += dt;
      if (entity.regenTick >= 0.5) {
        entity.regenTick -= 0.5;
        entity.hp = Math.min(entity.maxHp, entity.hp + entity.maxHp * 0.016);
      }
    } else {
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
