import { effectGrammar, skills } from '../content/definitions.js';
import { combatShapeIntersectsCircle } from './geometry.js';
import type { CastSource, DelayedStrike, Ent, Projectile } from './state.js';
import type { CombatShape, MutationId, SkillId, SkillRuntime } from './types.js';

export interface PhenomenonCastPort {
  time(): number;
  cycle(): number;

  skillRadius(runtime: SkillRuntime, base: number, slot: number): number;
  skillRange(runtime: SkillRuntime, base: number): number;
  powerBucket(runtime: SkillRuntime): number;
  slotAmp(slot: number, target?: Ent): number;
  memoryFactor(): number;
  mutationIs(runtime: SkillRuntime, mutation: MutationId): boolean;
  projectileCount(runtime: SkillRuntime, slot: number): number;

  combatShape(
    source: string,
    shape: CombatShape,
    intent?: 'damage' | 'control' | 'field',
    physicalTrace?: boolean
  ): void;
  targetsFor(source: CastSource): readonly Ent[];
  bestTarget(
    source: CastSource,
    predicate: (entity: Ent) => boolean,
    compare: (candidate: Ent, best: Ent) => number
  ): Ent | undefined;
  targetVisible(source: CastSource, target: Ent): boolean;
  aimPoint(source: CastSource, range: number): { x: number; z: number };

  damage(
    target: Ent,
    amount: number,
    source: SkillId,
    directional: boolean,
    sourceX?: number,
    sourceZ?: number,
    sourceSlot?: number
  ): void;
  spawnProjectile(projectile: Omit<Projectile, 'id' | 'guarded'>): void;
  scheduleStrike(strike: Omit<DelayedStrike, 'id'>): void;

  addCloseDamage(amount: number): void;
  addActivationControl(amount: number): void;
  noteState(state: string): void;
}

/**
 * Authored cast behavior for Phenomena.
 *
 * This starts with the compact geometry/contact family and is intentionally extensible: the
 * remaining Phenomena can migrate here without giving cast code access to the whole Simulation.
 */
export class PhenomenonCastSystem {
  constructor(private readonly port: PhenomenonCastPort) {}

  handles(id: SkillId) {
    return (
      id === 'breach_line' ||
      id === 'contact_saw' ||
      id === 'backhand' ||
      id === 'spreading_front' ||
      id === 'shard_fan' ||
      id === 'tether_drag' ||
      id === 'pin_burst'
    );
  }

  cast(id: SkillId, runtime: SkillRuntime, slot: number, source: CastSource): boolean {
    switch (id) {
      case 'breach_line':
        this.castBreachLine(runtime, slot, source);
        return true;
      case 'contact_saw':
        this.castContactSaw(runtime, slot, source);
        return true;
      case 'backhand':
        this.castBackhand(runtime, slot, source);
        return true;
      case 'spreading_front':
        this.castSpreadingFront(runtime, slot, source);
        return true;
      case 'shard_fan':
        this.castShardFan(runtime, slot, source);
        return true;
      case 'tether_drag':
        this.castTetherDrag(runtime, slot, source);
        return true;
      case 'pin_burst':
        this.castPinBurst(runtime, slot, source);
        return true;
      default:
        return false;
    }
  }

  private castBreachLine(st: SkillRuntime, slot: number, src: CastSource) {
    const p = this.port;
    const mut = st.mutation;
    let range = skills.breach_line.baseRange * (1 + st.range);
    let width = p.skillRadius(st, skills.breach_line.baseRadius, slot);
    if (mut === 'breach_wide') width *= 1.6;
    if (mut === 'breach_deep') {
      width *= 0.7;
      range *= 1.25;
    }
    p.combatShape('breach_line', {
      kind: 'sector',
      x: src.x,
      z: src.z,
      radius: range,
      aimX: src.aimX,
      aimZ: src.aimZ,
      halfAngle: Math.atan2(width, Math.max(0.6, range * 0.5))
    });
    for (const e of p.targetsFor(src)) {
      const dx = e.x - src.x,
        dz = e.z - src.z,
        along = dx * src.aimX + dz * src.aimZ;
      if (along < -e.radius || along > range) continue;
      if (Math.abs(dx * src.aimZ - dz * src.aimX) > width + e.radius) continue;
      let dmg = skills.breach_line.baseDamage * p.powerBucket(st) * p.slotAmp(slot, e);
      if (mut === 'breach_wide') dmg *= 0.78;
      if (mut === 'breach_deep') dmg *= 1.3;
      p.damage(e, dmg, 'breach_line', true);
      if (mut === 'breach_stagger') {
        e.displacedUntil = Math.max(e.displacedUntil, p.time() + 0.6 * p.memoryFactor());
        p.noteState('displaced');
      }
    }
  }

  private castContactSaw(st: SkillRuntime, slot: number, src: CastSource) {
    const p = this.port;
    const mut = st.mutation,
      r = p.skillRadius(st, skills.contact_saw.baseRadius, slot);
    const half = mut === 'saw_spin' ? Math.PI : 1.0;
    p.combatShape('contact_saw', {
      kind: 'sector',
      x: src.x,
      z: src.z,
      radius: r,
      aimX: src.aimX,
      aimZ: src.aimZ,
      halfAngle: half
    });
    for (const e of p.targetsFor(src)) {
      const dx = e.x - src.x,
        dz = e.z - src.z,
        d = Math.hypot(dx, dz);
      if (d > r + e.radius || d < 0.01) continue;
      const dot = (dx / d) * src.aimX + (dz / d) * src.aimZ;
      if (Math.acos(Math.max(-1, Math.min(1, dot))) > half) continue;
      let dmg = skills.contact_saw.baseDamage * p.powerBucket(st) * p.slotAmp(slot, e);
      if (mut === 'saw_teeth') dmg *= 2;
      if (mut === 'saw_spin') dmg *= 0.7;
      p.damage(e, dmg, 'contact_saw', true);
      p.addCloseDamage(dmg);
      if (mut === 'saw_bleed') {
        e.woundUntil = Math.max(e.woundUntil, p.time() + 3.4 * p.memoryFactor());
        e.woundDps = Math.max(e.woundDps, 5.5 * p.powerBucket(st));
        p.noteState('wound');
      }
    }
  }

  private castBackhand(st: SkillRuntime, slot: number, src: CastSource) {
    const p = this.port;
    const mut = st.mutation;
    let r = p.skillRadius(st, skills.backhand.baseRadius, slot);
    const moving = Math.hypot(src.vx, src.vz);
    let bx = moving > 0.05 ? -src.vx / moving : -src.aimX,
      bz = moving > 0.05 ? -src.vz / moving : -src.aimZ;
    if (mut === 'backhand_wake') r *= 1 + Math.min(0.6, moving * 0.09);
    const half = mut === 'backhand_twin' ? Math.PI : 1.75;
    p.combatShape('backhand', {
      kind: 'sector',
      x: src.x,
      z: src.z,
      radius: r,
      aimX: bx,
      aimZ: bz,
      halfAngle: half
    });
    for (const e of p.targetsFor(src)) {
      const dx = e.x - src.x,
        dz = e.z - src.z,
        d = Math.hypot(dx, dz);
      if (d > r + e.radius || d < 0.01) continue;
      const dot = (dx / d) * bx + (dz / d) * bz;
      if (Math.acos(Math.max(-1, Math.min(1, dot))) > half) continue;
      let dmg = skills.backhand.baseDamage * p.powerBucket(st) * p.slotAmp(slot, e);
      if (mut === 'backhand_twin') dmg *= 0.68;
      p.damage(e, dmg, 'backhand', true);
      p.addCloseDamage(dmg);
      if (mut === 'backhand_shove') {
        e.x += (dx / d) * 1.6;
        e.z += (dz / d) * 1.6;
        e.displacedUntil = Math.max(e.displacedUntil, p.time() + 0.35);
        p.noteState('displaced');
      }
    }
  }

  private castSpreadingFront(st: SkillRuntime, slot: number, src: CastSource) {
    const p = this.port;
    const mut = st.mutation;
    let outer = p.skillRadius(st, skills.spreading_front.baseRadius, slot),
      inner = mut === 'front_inner' ? 0.2 : 2.3;
    if (mut === 'front_far') {
      outer *= 1.3;
      inner *= 1.5;
    }
    p.combatShape('spreading_front', { kind: 'circle', x: src.x, z: src.z, radius: outer });
    for (const e of p.targetsFor(src)) {
      const d = Math.hypot(e.x - src.x, e.z - src.z);
      if (d > outer + e.radius || d < inner - e.radius) continue;
      let dmg = skills.spreading_front.baseDamage * p.powerBucket(st) * p.slotAmp(slot, e);
      if (mut === 'front_far') dmg *= 0.8;
      p.damage(e, dmg, 'spreading_front', false);
      if (mut === 'front_slow') {
        e.chillUntil = Math.max(e.chillUntil, p.time() + 2.2 * p.memoryFactor());
        p.noteState('chill');
      }
    }
  }

  private castShardFan(st: SkillRuntime, slot: number, src: CastSource) {
    const p = this.port;
    const mut = st.mutation,
      range = p.skillRange(st, skills.shard_fan.baseRange);
    let count = Math.min(5, p.projectileCount(st, slot));
    let spread = 0.18,
      speed = 9.2,
      damage = skills.shard_fan.baseDamage * p.powerBucket(st) * p.slotAmp(slot);

    if (mut === 'fan_tight') {
      count = 1;
      speed = 12.4;
      damage *= 1.55;
      spread = 0;
    }
    if (mut === 'fan_wide') {
      count = Math.max(3, count);
      spread = 0.34;
      damage *= 0.82;
    }
    if (p.mutationIs(st, 'fan_storm')) count = Math.min(7, count + 2);

    let baseAimX = src.aimX,
      baseAimZ = src.aimZ;

    if (p.mutationIs(st, 'returner_execution')) {
      const priority = p.bestTarget(
        src,
        (e) => e.kind === 'elite' && p.targetVisible(src, e),
        (a, b) => {
          const marked = Number(b.markUntil > p.time()) - Number(a.markUntil > p.time());
          if (marked) return marked;
          const adx = a.x - src.x,
            adz = a.z - src.z,
            bdx = b.x - src.x,
            bdz = b.z - src.z;
          return adx * adx + adz * adz - (bdx * bdx + bdz * bdz);
        }
      );
      if (priority) {
        const dx = priority.x - src.x,
          dz = priority.z - src.z,
          magnitude = Math.hypot(dx, dz) || 1;
        baseAimX = dx / magnitude;
        baseAimZ = dz / magnitude;
        priority.markUntil = Math.max(priority.markUntil, p.time() + 2.4);
      }
    }

    for (let i = 0; i < count; i++) {
      const angle = count === 1 ? 0 : (i - (count - 1) / 2) * spread,
        cosine = Math.cos(angle),
        sine = Math.sin(angle),
        aimX = baseAimX * cosine - baseAimZ * sine,
        aimZ = baseAimX * sine + baseAimZ * cosine;

      p.combatShape(
        'shard_fan',
        { kind: 'ray', x: src.x, z: src.z, aimX, aimZ, range, halfWidth: 0.18 },
        'damage',
        false
      );

      p.spawnProjectile({
        x: src.x + aimX * 0.55,
        z: src.z + aimZ * 0.55,
        vx: aimX * speed,
        vz: aimZ * speed,
        radius: 0.22,
        ttl: Math.max(1.8, (range / speed) * 2.2),
        damage,
        coverDamage: damage * 0.7,
        faction: src.faction,
        ownerId: src.owner?.id ?? 0,
        source: 'shard_fan',
        sourceSlot: slot,
        mutation: mut,
        apotheosis: st.mutationApotheosis,
        rivalConcentration: effectGrammar.shard_fan.rivalConcentration,
        behavior: 'returner',
        returnAt: Math.max(0.75, (range / speed) * 0.78),
        phase: 0,
        hitIds: [],
        carousel: p.mutationIs(st, 'returner_carousel'),
        trailAcc: 0
      });
    }
  }

  private castTetherDrag(st: SkillRuntime, slot: number, src: CastSource) {
    const p = this.port;
    const mut = st.mutation,
      range = p.skillRange(st, skills.tether_drag.baseRange),
      base = p.aimPoint(src, range);
    const anchors: { x: number; z: number }[] = [];

    if (p.mutationIs(st, 'gravity_dragnet')) {
      for (let i = 0; i < 3; i++) {
        const angle = (i * Math.PI * 2) / 3 + p.cycle() * 0.4;
        anchors.push({
          x: base.x + Math.cos(angle) * 2.3,
          z: base.z + Math.sin(angle) * 2.3
        });
      }
    } else {
      anchors.push(base);
    }

    const radius = p.skillRadius(
      st,
      mut === 'tether_net' ? 4.8 : mut === 'tether_hook' ? 2.2 : 3.4,
      slot
    );

    for (const anchor of anchors) {
      const dx0 = anchor.x - src.x,
        dz0 = anchor.z - src.z,
        distance0 = Math.hypot(dx0, dz0) || 1;

      p.combatShape(
        'tether_line',
        {
          kind: 'ray',
          x: src.x,
          z: src.z,
          aimX: dx0 / distance0,
          aimZ: dz0 / distance0,
          range: distance0,
          halfWidth: 0.08
        },
        'control'
      );

      const dragShape: CombatShape = {
        kind: 'circle',
        x: anchor.x,
        z: anchor.z,
        radius
      };
      p.combatShape('tether_drag', dragShape, 'control');

      let pulled = 0;
      const candidates = [...p.targetsFor(src)]
        .filter(
          (e) =>
            e.hp > 0 &&
            combatShapeIntersectsCircle(dragShape, e.x, e.z, e.radius)
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - anchor.x, a.z - anchor.z) -
            Math.hypot(b.x - anchor.x, b.z - anchor.z)
        );

      const cap = mut === 'tether_hook' ? 2 : mut === 'tether_net' ? 10 : 6;
      for (const e of candidates) {
        if (pulled++ >= cap) break;
        const dx = anchor.x - e.x,
          dz = anchor.z - e.z,
          distance = Math.hypot(dx, dz) || 1,
          pull = (mut === 'tether_hook' ? 2.4 : 1.35) * (1 + st.control * 0.25);

        p.damage(
          e,
          skills.tether_drag.baseDamage * p.powerBucket(st) * p.slotAmp(slot, e),
          'tether_drag',
          false,
          anchor.x,
          anchor.z,
          slot
        );
        e.x += (dx / distance) * Math.min(pull, distance * 0.62);
        e.z += (dz / distance) * Math.min(pull, distance * 0.62);
        e.displacedUntil = Math.max(
          e.displacedUntil,
          p.time() +
            (p.mutationIs(st, 'tether_lock')
              ? 1.85
              : p.mutationIs(st, 'tether_bind')
                ? 1.2
                : 0.65)
        );
        p.addActivationControl(1.2 + st.control);
        p.noteState('displaced');

        if (p.mutationIs(st, 'gravity_prison') && e.kind === 'elite') {
          e.exposedUntil = Math.max(e.exposedUntil, p.time() + 2.1);
          e.chillUntil = Math.max(e.chillUntil, p.time() + 1.2);
          if (e.affix === 'shielded')
            e.shieldStability = Math.max(0, (e.shieldStability ?? 100) - 28);
          p.combatShape(
            'gravity_prison',
            { kind: 'circle', x: e.x, z: e.z, radius: e.radius + 1.2 },
            'control'
          );
        }
      }

      if (p.mutationIs(st, 'gravity_singularity')) {
        p.scheduleStrike({
          at: p.time() + 0.65,
          x: anchor.x,
          z: anchor.z,
          radius: radius * 0.72,
          damage: skills.tether_drag.baseDamage * p.powerBucket(st) * 2.4,
          faction: src.faction,
          ownerId: src.owner?.id ?? 0,
          source: 'tether_drag',
          sourceSlot: slot,
          intent: 'control',
          telegraph: 'gravity_singularity_tell'
        });
      }
    }
  }

  private castPinBurst(st: SkillRuntime, slot: number, src: CastSource) {
    const p = this.port;
    const mut = st.mutation,
      range = skills.pin_burst.baseRange * (1 + st.range);
    let radius = p.skillRadius(st, skills.pin_burst.baseRadius, slot);
    if (mut === 'pin_deep') radius *= 0.75;

    const targetX = src.x + src.aimX * range,
      targetZ = src.z + src.aimZ * range;
    p.combatShape('pin_burst', {
      kind: 'circle',
      x: targetX,
      z: targetZ,
      radius
    });

    for (const e of p.targetsFor(src)) {
      const distance = Math.hypot(e.x - targetX, e.z - targetZ);
      if (distance > radius + e.radius) continue;
      let damage = skills.pin_burst.baseDamage * p.powerBucket(st) * p.slotAmp(slot, e);
      if (mut === 'pin_deep') damage *= 1.45;
      if (mut === 'pin_twin') damage *= 0.62;
      p.damage(e, damage, 'pin_burst', false);
      e.displacedUntil = Math.max(e.displacedUntil, p.time() + 1.1 * p.memoryFactor());
      p.noteState('displaced');
      if (mut === 'pin_field') {
        e.toxinUntil = Math.max(e.toxinUntil, p.time() + 4.2 * p.memoryFactor());
        e.toxinDps = Math.max(e.toxinDps, 6 * p.powerBucket(st));
        p.noteState('toxin');
      }
    }

    if (mut === 'pin_twin') {
      for (const e of p.targetsFor(src)) {
        const distance = Math.hypot(e.x - targetX, e.z - targetZ);
        if (distance > radius * 1.3 + e.radius) continue;
        p.damage(
          e,
          skills.pin_burst.baseDamage * 0.62 * p.powerBucket(st) * p.slotAmp(slot, e),
          'pin_burst',
          false
        );
      }
    }
  }
}
