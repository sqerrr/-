import { effectGrammar, skills } from '../content/definitions.js';
import { combatShapeIntersectsCircle } from './geometry.js';
import type { CastSource, DelayedStrike, Ent, Field, Projectile } from './state.js';
import type { CombatShape, MutationId, SkillId, SkillRuntime } from './types.js';

export interface PhenomenonCastPort {
  time(): number;
  cycle(): number;

  skillRadius(runtime: SkillRuntime, base: number, slot: number): number;
  skillRange(runtime: SkillRuntime, base: number): number;
  persistentDuration(runtime: SkillRuntime, base: number, slot: number): number;
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
  rotatedAim(source: CastSource, radians: number): { x: number; z: number };
  rayHits(
    source: CastSource,
    aimX: number,
    aimZ: number,
    range: number,
    width: number,
    maxHits?: number
  ): { e: Ent; t: number; lat: number }[];
  firstBlockingObstacleHit(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    padding?: number
  ): { t: number } | null;

  damage(
    target: Ent,
    amount: number,
    source: string,
    directional: boolean,
    sourceX?: number,
    sourceZ?: number,
    sourceSlot?: number
  ): boolean | void;
  spawnProjectile(projectile: Omit<Projectile, 'id' | 'guarded'>): void;
  scheduleStrike(strike: Omit<DelayedStrike, 'id'>): void;
  addField(field: Omit<Field, 'id'>): void;

  addCloseDamage(amount: number): void;
  addActivationControl(amount: number): void;
  noteState(state: string): void;
  noteReaction(): void;
  emitReaction(reaction: 'thermal_shock', x: number, z: number, amount: number): void;
  emitRareEvent(title: string, detail: string, x: number, z: number): void;
  grantBarrier(amount: number): void;
  doctrineForce(): number;
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
      id === 'pin_burst' ||
      id === 'ember_lance' ||
      id === 'frost_ring' ||
      id === 'rail_spear' ||
      id === 'toxic_mist'
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
      case 'ember_lance':
        this.castEmber(runtime, slot, source);
        return true;
      case 'frost_ring':
        this.castFrost(runtime, slot, source);
        return true;
      case 'rail_spear':
        this.castRail(runtime, slot, source);
        return true;
      case 'toxic_mist':
        this.castToxic(runtime, slot, source);
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
  private castEmber(st: SkillRuntime, slot: number, src: CastSource) {
    const p = this.port;
    const mut = st.mutation,
      count = p.projectileCount(st, slot);
    let rays: number[] = [];
    if (mut === 'ember_volley') {
      const n = Math.max(3, count + 2);
      for (let i = 0; i < n; i++) rays.push((i - (n - 1) / 2) * 0.13);
    } else if (count > 1) {
      for (let i = 0; i < count; i++) rays.push((i - (count - 1) / 2) * 0.08);
    } else rays = [0];

    for (const angle of rays) {
      const aim = p.rotatedAim(src, angle),
        range = p.skillRange(st, mut === 'ember_furnace' ? 8 : skills.ember_lance.baseRange),
        width = p.skillRadius(st, mut === 'ember_furnace' ? 1.05 : 0.4, slot),
        maxHits = p.mutationIs(st, 'ember_impaler') ? 4 : 1;

      p.combatShape('ember_lance', {
        kind: 'ray',
        x: src.x,
        z: src.z,
        aimX: aim.x,
        aimZ: aim.z,
        range,
        halfWidth: width
      });

      for (const hit of p.rayHits(src, aim.x, aim.z, range, width, maxHits)) {
        let damage =
          skills.ember_lance.baseDamage *
          p.powerBucket(st) *
          p.slotAmp(slot, hit.e) *
          (mut === 'ember_volley' ? 0.82 : count > 1 ? 0.86 : 1);

        if (p.mutationIs(st, 'ember_impaler') && hit.e.kind === 'elite') damage *= 1.7;

        const chilled = hit.e.chillUntil > p.time();
        if (chilled) {
          hit.e.chillUntil = 0;
          damage *= 1.25;
          p.noteReaction();
          p.emitReaction('thermal_shock', hit.e.x, hit.e.z, damage * 0.35);
        }

        p.damage(hit.e, damage, 'ember_lance', true);
        hit.e.igniteUntil = Math.max(
          hit.e.igniteUntil,
          p.time() + 3.2 * (1 + st.statusPotency) * p.memoryFactor()
        );
        p.noteState('ignite');

        if (chilled) {
          for (const other of p.targetsFor(src)) {
            if (
              other !== hit.e &&
              other.hp > 0 &&
              Math.hypot(other.x - hit.e.x, other.z - hit.e.z) < 1.65
            )
              p.damage(other, damage * 0.35, 'thermal_shock', false, hit.e.x, hit.e.z);
          }
        }

        if (mut === 'ember_brand')
          hit.e.markUntil = p.time() + 4.5 * p.memoryFactor();
      }
    }

    if (mut === 'ember_furnace') {
      p.addField({
        x: src.x + src.aimX * 3.3,
        z: src.z + src.aimZ * 3.3,
        radius: p.skillRadius(st, 1.5, slot),
        ttl: p.persistentDuration(st, 2.9, slot),
        kind: 'fire',
        dps: 17 * p.powerBucket(st),
        tickAcc: 0,
        faction: src.faction,
        ownerId: src.owner?.id ?? 0,
        source: st.id,
        sourceSlot: slot,
        mutation: st.mutation,
        rivalConcentration: effectGrammar[st.id].rivalConcentration
      });
      p.noteState('field');
    }
  }

  private castFrost(st: SkillRuntime, slot: number, src: CastSource) {
    const p = this.port;
    const mut = st.mutation,
      radius = p.skillRadius(st, skills.frost_ring.baseRadius, slot),
      shape: CombatShape = { kind: 'circle', x: src.x, z: src.z, radius };
    p.combatShape('frost_ring', shape, 'control');

    let shattered = 0;
    let firstShatter: Ent | null = null;

    for (const e of p.targetsFor(src)) {
      if (!combatShapeIntersectsCircle(shape, e.x, e.z, e.radius)) continue;
      const distance = Math.hypot(e.x - src.x, e.z - src.z);
      const wasChilled = e.chillUntil > p.time();
      const wasFrozen = (e.frozenUntil ?? 0) > p.time();
      let damage = skills.frost_ring.baseDamage * p.powerBucket(st) * p.slotAmp(slot, e);
      if (mut === 'frost_rim') damage *= distance > radius * 0.62 ? 2 : 0.48;

      const ignited = e.igniteUntil > p.time();
      if (ignited) {
        e.igniteUntil = 0;
        damage *= 1.18;
        p.noteReaction();
        p.emitReaction('thermal_shock', e.x, e.z, damage * 0.42);
      }

      const meterGain = 1 + st.statusPotency * 0.45 + p.doctrineForce() * 0.08;
      e.frostMeter = (e.frostMeter ?? 0) + meterGain;
      const freezeAt = e.kind === 'elite' ? 3.5 : 2.0;
      if ((e.frostMeter ?? 0) >= freezeAt) {
        e.frostMeter = 0;
        e.frozenUntil = p.time() + (e.kind === 'elite' ? 0.7 : 1.35) * p.memoryFactor();
        e.exposedUntil = Math.max(
          e.exposedUntil,
          p.time() + (e.kind === 'elite' ? 0.85 : 0.45)
        );
      }

      const shatter = wasFrozen || (mut === 'frost_snap' && wasChilled);
      if (shatter) {
        damage += 22 * p.powerBucket(st);
        e.frozenUntil = 0;
        e.chillUntil = 0;
        shattered++;
        firstShatter ??= e;
        p.emitRareEvent(
          'РАСКОЛ',
          e.kind === 'elite' ? 'Хрупкость элиты разбита' : 'Лёд расколот',
          e.x,
          e.z
        );
      }

      const killed = p.damage(e, damage, 'frost_ring', false, src.x, src.z, slot);
      e.chillUntil = Math.max(
        e.chillUntil,
        p.time() + 2.4 * (1 + st.statusPotency) * p.memoryFactor()
      );
      p.noteState('chill');
      p.addActivationControl(1 + st.control);

      if (p.mutationIs(st, 'frost_brittle'))
        e.exposedUntil = Math.max(e.exposedUntil, p.time() + 2.8 * p.memoryFactor());

      if (p.mutationIs(st, 'frost_skin') && killed && (wasChilled || ignited || shatter))
        p.grantBarrier(9);

      if (p.mutationIs(st, 'frost_spirefall') && (shatter || e.exposedUntil > p.time())) {
        for (const [ox, oz] of [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) {
          p.scheduleStrike({
            at: p.time() + 0.22,
            x: e.x + ox,
            z: e.z + oz,
            radius: 0.62,
            damage: 11 * p.powerBucket(st),
            faction: src.faction,
            ownerId: src.owner?.id ?? 0,
            source: 'frost_ring',
            sourceSlot: slot,
            intent: 'damage',
            telegraph: 'frost_spire_tell'
          });
        }
      }
    }

    if (mut === 'frost_front') {
      p.addField({
        x: src.x,
        z: src.z,
        radius: radius * 1.12,
        ttl: p.persistentDuration(st, 1.6, slot),
        kind: 'frost',
        dps: 13 * p.powerBucket(st),
        tickAcc: 0,
        faction: src.faction,
        ownerId: src.owner?.id ?? 0,
        source: st.id,
        sourceSlot: slot,
        mutation: st.mutation,
        rivalConcentration: effectGrammar[st.id].rivalConcentration
      });
      p.noteState('field');
    }

    if (p.mutationIs(st, 'frost_glacier_heart') && shattered > 0) {
      const target = firstShatter ?? ({ x: src.x + src.aimX * 2, z: src.z + src.aimZ * 2 } as Ent),
        dx = target.x - src.x,
        dz = target.z - src.z,
        magnitude = Math.hypot(dx, dz) || 1;
      p.spawnProjectile({
        x: src.x,
        z: src.z,
        vx: (dx / magnitude) * 3.1,
        vz: (dz / magnitude) * 3.1,
        radius: 1.15,
        ttl: 4.5,
        damage: 12 * p.powerBucket(st),
        coverDamage: 18,
        faction: src.faction,
        ownerId: src.owner?.id ?? 0,
        source: 'frost_ring',
        sourceSlot: slot,
        mutation: st.mutation,
        apotheosis: st.mutationApotheosis,
        rivalConcentration: 1,
        behavior: 'roller',
        phase: 0,
        hitIds: [],
        growth: 0.02
      });
    }

    if (p.mutationIs(st, 'frost_worldstorm')) {
      p.spawnProjectile({
        x: src.x,
        z: src.z,
        vx: src.aimX * 2.25,
        vz: src.aimZ * 2.25,
        radius: radius * 0.62,
        ttl: 7,
        damage: 9 * p.powerBucket(st),
        coverDamage: 25,
        faction: src.faction,
        ownerId: src.owner?.id ?? 0,
        source: 'frost_ring',
        sourceSlot: slot,
        mutation: st.mutation,
        apotheosis: st.mutationApotheosis,
        rivalConcentration: 1,
        behavior: 'roller',
        phase: 0,
        hitIds: [],
        growth: 0.035
      });
      p.emitRareEvent('БЕЛЫЙ ШТОРМ', 'Ледяной фронт движется через арену', src.x, src.z);
    }
  }

  private castRail(st: SkillRuntime, slot: number, src: CastSource) {
    const p = this.port;
    const mut = st.mutation;
    if (mut === 'rail_gun' && p.cycle() % 2 === 1) return;

    const requestedCount = p.projectileCount(st, slot),
      count = mut === 'rail_gun' ? 1 : requestedCount + (mut === 'rail_fan' ? 2 : 0),
      rays: number[] = [];
    for (let i = 0; i < count; i++)
      rays.push((i - (count - 1) / 2) * (mut === 'rail_fan' ? 0.11 : 0.072));

    let latticePoint: { x: number; z: number } | null = null;

    for (const angle of rays) {
      const aim = p.rotatedAim(src, angle);
      let baseDamage =
        skills.rail_spear.baseDamage *
        p.powerBucket(st) *
        (mut === 'rail_gun' ? 2.35 : mut === 'rail_fan' ? 0.58 : mut === 'rail_rack' ? 0.78 : 1);

      const requestedRange = p.skillRange(
          st,
          mut === 'rail_gun' ? 25 : skills.rail_spear.baseRange
        ),
        width = p.skillRadius(st, 0.34, slot),
        endX = src.x + aim.x * requestedRange,
        endZ = src.z + aim.z * requestedRange,
        block = p.firstBlockingObstacleHit(src.x, src.z, endX, endZ, width * 0.2),
        range = requestedRange * (block?.t ?? 1);

      p.combatShape('rail_spear', {
        kind: 'ray',
        x: src.x,
        z: src.z,
        aimX: aim.x,
        aimZ: aim.z,
        range,
        halfWidth: width
      });

      const hits = p.rayHits(
        src,
        aim.x,
        aim.z,
        range,
        width,
        mut === 'rail_gun' ? 14 : mut === 'rail_fan' ? 5 : 8
      );
      let first = true;

      for (const hit of hits) {
        let damage = baseDamage * p.slotAmp(slot, hit.e);
        if (p.mutationIs(st, 'rail_spot') && hit.e.markUntil > p.time()) damage *= 1.25;

        const hadMark = hit.e.markUntil > p.time();
        p.damage(hit.e, damage, 'rail_spear', true, src.x, src.z, slot);
        hit.e.embedded = Math.min(8, hit.e.embedded + (mut === 'rail_rack' ? 2 : 1));
        p.noteState('embed');

        if ((p.mutationIs(st, 'rail_spot') || hadMark) && hadMark)
          hit.e.exposedUntil = p.time() + 3;

        if (p.mutationIs(st, 'rail_harpoon') && first && hit.e.kind === 'elite') {
          const dx = src.x - hit.e.x,
            dz = src.z - hit.e.z,
            distance = Math.hypot(dx, dz) || 1;
          hit.e.x += (dx / distance) * 1.25;
          hit.e.z += (dz / distance) * 1.25;
        }

        if (p.mutationIs(st, 'rail_execution_line') && first && hit.e.kind === 'elite')
          p.scheduleStrike({
            at: p.time() + 0.55,
            x: hit.e.x,
            z: hit.e.z,
            radius: 0.85,
            damage: baseDamage * 1.25,
            faction: src.faction,
            ownerId: src.owner?.id ?? 0,
            source: 'rail_spear',
            sourceSlot: slot,
            intent: 'damage',
            telegraph: 'rail_execution_beacon'
          });

        if (p.mutationIs(st, 'rail_sky_lance') && hadMark)
          p.scheduleStrike({
            at: p.time() + 0.72,
            x: hit.e.x,
            z: hit.e.z,
            radius: 1,
            damage: baseDamage * 1.7,
            faction: src.faction,
            ownerId: src.owner?.id ?? 0,
            source: 'rail_spear',
            sourceSlot: slot,
            intent: 'damage',
            telegraph: 'rail_sky_lance_beacon'
          });

        latticePoint ??= { x: hit.e.x, z: hit.e.z };
        first = false;
      }
    }

    if (p.mutationIs(st, 'rail_lattice')) {
      const point =
          latticePoint ??
          p.aimPoint(src, p.skillRange(st, skills.rail_spear.baseRange) * 0.75),
        baseAngle = Math.atan2(src.aimZ, src.aimX);

      for (const offset of [0, Math.PI / 2]) {
        for (let i = -3; i <= 3; i++) {
          const angle = baseAngle + offset;
          p.scheduleStrike({
            at: p.time() + 0.42 + Math.abs(i) * 0.035,
            x: point.x + Math.cos(angle) * i * 1.3,
            z: point.z + Math.sin(angle) * i * 1.3,
            radius: 0.42,
            damage: skills.rail_spear.baseDamage * p.powerBucket(st) * 0.48,
            faction: src.faction,
            ownerId: src.owner?.id ?? 0,
            source: 'rail_spear',
            sourceSlot: slot,
            intent: 'damage',
            telegraph: 'rail_lattice_node'
          });
        }
      }
    }
  }

  private castToxic(st: SkillRuntime, slot: number, src: CastSource) {
    const p = this.port;
    let radius = p.skillRadius(st, skills.toxic_mist.baseRadius, slot),
      dps = skills.toxic_mist.baseDamage * p.powerBucket(st) * p.slotAmp(slot);

    if (st.mutation === 'toxic_distilled') {
      radius *= 0.58;
      dps *= 1.85;
    }

    const x = p.mutationIs(st, 'toxic_plume') ? src.x - src.vx * 0.55 : src.x,
      z = p.mutationIs(st, 'toxic_plume') ? src.z - src.vz * 0.55 : src.z,
      mistShape: CombatShape = { kind: 'circle', x, z, radius };

    const reactiveTargets: Ent[] = [];
    if (p.mutationIs(st, 'toxic_reactive')) {
      for (const e of p.targetsFor(src)) {
        if (e.hp <= 0 || !combatShapeIntersectsCircle(mistShape, e.x, e.z, e.radius)) continue;
        const reactive =
          e.igniteUntil > p.time() ||
          e.chillUntil > p.time() ||
          (e.frozenUntil ?? 0) > p.time() ||
          e.exposedUntil > p.time() ||
          e.displacedUntil > p.time();
        if (reactive) {
          p.damage(e, dps * 1.25, 'septic_cut', false, x, z, slot);
          p.noteReaction();
          reactiveTargets.push(e);
        }
      }
    }

    const pushField = (
      fieldX: number,
      fieldZ: number,
      fieldRadius: number,
      ttl: number,
      behavior?: 'host'
    ) =>
      p.addField({
        x: fieldX,
        z: fieldZ,
        radius: fieldRadius,
        ttl,
        kind: 'toxic',
        dps,
        tickAcc: 0,
        faction: src.faction,
        ownerId: src.owner?.id ?? 0,
        source: st.id,
        sourceSlot: slot,
        mutation: st.mutation,
        rivalConcentration: effectGrammar[st.id].rivalConcentration,
        behavior
      });

    p.combatShape('toxic_mist', mistShape, 'field');
    pushField(
      x,
      z,
      radius,
      p.persistentDuration(st, 4.2, slot),
      p.mutationIs(st, 'toxic_pestilent_host') ? 'host' : undefined
    );

    if (p.mutationIs(st, 'toxic_plague_road')) {
      const magnitude = Math.hypot(src.vx, src.vz) || 1,
        dx = src.vx / magnitude,
        dz = src.vz / magnitude;
      for (let i = 1; i <= 3; i++)
        pushField(x - dx * i * 1.3, z - dz * i * 1.3, radius * 0.55, 2.4);
    }

    if (p.mutationIs(st, 'toxic_septic_bloom')) {
      for (const e of reactiveTargets) {
        for (let i = 0; i < 4; i++) {
          const angle = (i * Math.PI) / 2,
            bloomX = e.x + Math.cos(angle) * 1.1,
            bloomZ = e.z + Math.sin(angle) * 1.1;
          pushField(bloomX, bloomZ, radius * 0.42, 2.2);
          p.scheduleStrike({
            at: p.time() + 0.12 + i * 0.04,
            x: bloomX,
            z: bloomZ,
            radius: radius * 0.45,
            damage: dps * 0.72,
            faction: src.faction,
            ownerId: src.owner?.id ?? 0,
            source: 'toxic_mist',
            sourceSlot: slot,
            intent: 'field',
            telegraph: 'septic_bloom'
          });
        }
      }
    }

    p.noteState('toxin');
  }

}
