import { effectGrammar, skills } from '../content/definitions.js';
import { combatShapeIntersectsCircle } from './geometry.js';
import type { PhenomenonCastPort } from './phenomenonCastSystem.js';
import type { CastSource, Construct, Ent, Pickup } from './state.js';
import type { SkillId, SkillRuntime } from './types.js';

export interface StatefulPhenomenonCastPort extends PhenomenonCastPort {
  resonanceMultiplicity(): number;
  doctrineQuantity(): number;
  activationCountBonus(): number;
  mutationCountAdd(runtime: SkillRuntime): number;
  multiplicityFor(runtime: SkillRuntime): number;

  butcherStacks(): number;
  setButcherStacks(value: number): void;
  randomFloat(): number;
  randomRange(min: number, max: number): number;

  constructs(): readonly Construct[];
  nearestEntity(
    x: number,
    z: number,
    predicate: (entity: Ent) => boolean,
    maxDistance: number
  ): Ent | undefined;

  prepareOrbitActivation(source: CastSource): void;

  freeOf(x: number, z: number, radius: number): { x: number; z: number };
  currentPhysicalActivationId(): number;
  addSentryConstruct(construct: Omit<Construct, 'id'>): number;
  trimConstructs(max: number): void;

  charge(): number;
  setCharge(value: number): void;

  cargoCount(source: CastSource, range: number): number;
  displaceSource(source: CastSource, dx: number, dz: number): void;
  grantHeroDashIFrames(duration: number): void;
}

/**
 * Stateful / persistent Phenomenon casts.
 *
 * These casts interact with run-local state or persistent physical actors, so they stay separate
 * from the mostly self-contained geometry/status family in PhenomenonCastSystem. They still see
 * only explicit combat/run callbacks, never Simulation itself.
 */
export class StatefulPhenomenonCastSystem {
  constructor(private readonly port: StatefulPhenomenonCastPort) {}

  cast(id: SkillId, runtime: SkillRuntime, slot: number, source: CastSource): boolean {
    switch (id) {
      case 'cleaver':
        this.castCleaver(runtime, slot, source);
        return true;
      case 'chain_arc':
        this.castArc(runtime, slot, source);
        return true;
      case 'orbit_blades':
        this.castOrbit(runtime, slot, source);
        return true;
      case 'mortar_bloom':
        this.castMortar(runtime, slot, source);
        return true;
      case 'sentry':
        this.castSentry(runtime, slot, source);
        return true;
      case 'repulse_halo':
        this.castRepulse(runtime, slot, source);
        return true;
      case 'mass_driver':
        this.castMassDriver(runtime, slot, source);
        return true;
      default:
        return false;
    }
  }

  private castCleaver(st: SkillRuntime, slot: number, src: CastSource, repeat = false) {
    const p = this.port;
    const mut = st.mutation,
      radius = p.skillRadius(st, skills.cleaver.baseRadius, slot);
    let halfAngle = mut === 'cleaver_guillotine' ? 0.65 : 1.12;
    if (mut === 'cleaver_roundhouse') halfAngle = Math.PI;

    const shape = {
      kind: 'sector' as const,
      x: src.x,
      z: src.z,
      radius,
      aimX: src.aimX,
      aimZ: src.aimZ,
      halfAngle
    };
    p.combatShape('cleaver', shape);

    let kills = 0,
      hookX = 0,
      hookZ = 0,
      hookN = 0,
      ruptures = 0;

    for (const e of p.targetsFor(src)) {
      const dx = e.x - src.x,
        dz = e.z - src.z,
        distance = Math.hypot(dx, dz);
      if (distance < 0.01 || !combatShapeIntersectsCircle(shape, e.x, e.z, e.radius)) continue;

      let damage =
        skills.cleaver.baseDamage *
        p.powerBucket(st) *
        p.slotAmp(slot, e) *
        (repeat ? 0.65 : 1);
      if (mut === 'cleaver_guillotine' && e.hp / e.maxHp < 0.25) damage *= 2;
      if (p.mutationIs(st, 'cleaver_deep')) damage *= 1.22;

      const killed = p.damage(e, damage, 'cleaver', true, src.x, src.z, slot);
      p.addCloseDamage(damage);
      if (killed) kills++;

      if (p.mutationIs(st, 'cleaver_deep')) {
        const push = e.kind === 'elite' ? 0.22 : 0.62;
        e.x += (dx / distance) * push;
        e.z += (dz / distance) * push;
        e.displacedUntil = Math.max(e.displacedUntil, p.time() + 0.45);
        p.noteState('displaced');
      }

      if (mut === 'cleaver_hook' || p.mutationIs(st, 'cleaver_chainhook')) {
        const tx = src.x - e.x,
          tz = src.z - e.z,
          td = Math.hypot(tx, tz) || 1,
          pull = p.mutationIs(st, 'cleaver_chainhook') ? 1.05 : 0.65;
        e.x += (tx / td) * pull * (1 + st.control);
        e.z += (tz / td) * pull * (1 + st.control);
        hookX += e.x;
        hookZ += e.z;
        hookN++;
      }

      if (p.mutationIs(st, 'cleaver_rupture') && ruptures < 6) {
        ruptures++;
        const burst = skills.cleaver.baseDamage * p.powerBucket(st) * 0.48,
          ruptureRadius = 1.55,
          rupture = { kind: 'circle' as const, x: e.x, z: e.z, radius: ruptureRadius };
        p.combatShape('cleaver_rupture', rupture);
        for (const other of p.targetsFor(src)) {
          if (
            other.hp > 0 &&
            other.id !== e.id &&
            combatShapeIntersectsCircle(rupture, other.x, other.z, other.radius)
          )
            p.damage(other, burst, 'cleaver', false, e.x, e.z, slot);
        }
      }
    }

    if (p.mutationIs(st, 'cleaver_rift_hook') && hookN) {
      const x = hookX / hookN,
        z = hookZ / hookN;
      p.scheduleStrike({
        at: p.time() + 0.24,
        x,
        z,
        radius: 2.1,
        damage: skills.cleaver.baseDamage * p.powerBucket(st) * 0.72,
        faction: src.faction,
        ownerId: src.owner?.id ?? 0,
        source: 'cleaver',
        sourceSlot: slot,
        intent: 'control',
        telegraph: 'cleaver_rift_tell'
      });
    }

    if (p.mutationIs(st, 'cleaver_rhythm') && kills > 0 && !repeat) {
      const stacks = Math.min(6, p.butcherStacks() + kills);
      p.setButcherStacks(stacks);
      if (
        p.mutationIs(st, 'cleaver_harvest_dance') ||
        p.randomFloat() < Math.min(0.65, stacks * 0.16)
      ) {
        const oldAimX = src.aimX,
          oldAimZ = src.aimZ;
        src.aimX = -oldAimZ;
        src.aimZ = oldAimX;
        p.combatShape('cleaver_harvest_dance', {
          kind: 'circle',
          x: src.x,
          z: src.z,
          radius: radius * 1.18
        });
        this.castCleaver(st, slot, src, true);
        src.aimX = oldAimX;
        src.aimZ = oldAimZ;
        if (p.mutationIs(st, 'cleaver_harvest_dance')) p.grantBarrier(3.5 * kills);
        p.setButcherStacks(0);
      }
    }

    if (!repeat) {
      const multiplicity = p.multiplicityFor(st);
      if (multiplicity > 0) {
        const oldAimX = src.aimX,
          oldAimZ = src.aimZ;
        for (let i = 0; i < Math.min(2, multiplicity); i++) {
          const angle = (i % 2 === 0 ? 1 : -1) * (0.22 + 0.08 * i),
            cosine = Math.cos(angle),
            sine = Math.sin(angle);
          src.aimX = oldAimX * cosine - oldAimZ * sine;
          src.aimZ = oldAimX * sine + oldAimZ * cosine;
          this.castCleaver(st, slot, src, true);
        }
        src.aimX = oldAimX;
        src.aimZ = oldAimZ;
      }
    }
  }

  private castArc(st: SkillRuntime, slot: number, src: CastSource) {
    const p = this.port;
    const mut = st.mutation,
      maxJumps =
        (mut === 'arc_forked' ? 7 : 4) +
        Math.max(0, st.count - 1) +
        p.resonanceMultiplicity() +
        (!src.owner ? Math.min(3, Math.floor(p.doctrineQuantity() / 2)) : 0) +
        p.activationCountBonus() +
        p.mutationCountAdd(st),
      jumpRange = p.skillRange(st, p.mutationIs(st, 'arc_relay') ? 5.8 : 4.2);

    const available = [...p.targetsFor(src)].filter(
      (e) =>
        e.hp > 0 &&
        p.targetVisible(src, e) &&
        Math.hypot(e.x - src.x, e.z - src.z) <=
          p.skillRange(st, skills.chain_arc.baseRange) + e.radius
    );

    let current: Ent | undefined;
    const embedded = available.filter((e) => e.embedded > 0);
    if (embedded.length) current = embedded.sort((a, b) => b.embedded - a.embedded)[0];

    if (mut === 'arc_ground')
      current = available
        .filter((e) => e.markUntil > p.time() || e.embedded > 0)
        .sort(
          (a, b) =>
            Math.hypot(a.x - src.x, a.z - src.z) -
            Math.hypot(b.x - src.x, b.z - src.z)
        )[0];

    if (!current)
      current = available.sort(
        (a, b) =>
          Math.hypot(a.x - src.x, a.z - src.z) -
          Math.hypot(b.x - src.x, b.z - src.z)
      )[0];

    if (!current) return;

    const hit = new Set<number>(),
      path: Ent[] = [];
    let jumps = 0,
      previousX = src.x,
      previousZ = src.z;

    while (current && jumps < maxJumps) {
      hit.add(current.id);
      path.push(current);
      let damage =
        skills.chain_arc.baseDamage *
        p.powerBucket(st) *
        p.slotAmp(slot, current) *
        Math.pow(mut === 'arc_forked' ? 0.93 : 0.88, jumps);

      if (mut === 'arc_ground' && (current.markUntil > p.time() || current.embedded > 0))
        damage *= 1.45;
      if (current.embedded > 0) {
        damage *= 1.28;
        current.embedded--;
        p.noteReaction();
      }

      const segmentLength = Math.hypot(current.x - previousX, current.z - previousZ) || 1;
      p.combatShape('chain_arc', {
        kind: 'ray',
        x: previousX,
        z: previousZ,
        aimX: (current.x - previousX) / segmentLength,
        aimZ: (current.z - previousZ) / segmentLength,
        range: segmentLength,
        halfWidth: 0.08
      });
      p.damage(current, damage, 'chain_arc', false, previousX, previousZ, slot);
      p.noteState('charge');

      if (p.mutationIs(st, 'arc_cage') && p.time() - current.lastArcAt < 2.2)
        p.addField({
          x: current.x,
          z: current.z,
          radius: 1.25,
          ttl: 1.7 * (1 + st.duration),
          kind: 'arc',
          dps: 13 * p.powerBucket(st),
          tickAcc: 0,
          faction: src.faction,
          ownerId: src.owner?.id ?? 0,
          source: st.id,
          sourceSlot: slot,
          mutation: st.mutation,
          rivalConcentration: effectGrammar[st.id].rivalConcentration
        });

      current.lastArcAt = p.time();
      previousX = current.x;
      previousZ = current.z;
      jumps++;

      let next: Ent | undefined,
        best = 999;
      for (const e of p.targetsFor(src)) {
        if (e.hp <= 0 || hit.has(e.id)) continue;
        const distance = Math.hypot(e.x - previousX, e.z - previousZ);
        if (distance <= jumpRange + e.radius && distance < best) {
          best = distance;
          next = e;
        }
      }
      current = next;
    }

    if (p.mutationIs(st, 'arc_capacitive') && path.length && jumps < maxJumps) {
      const unused = Math.min(4, maxJumps - jumps),
        target = path[0],
        relay = p.mutationIs(st, 'arc_relay');
      for (let i = 0; i < unused; i++)
        p.scheduleStrike({
          at: p.time() + 0.07 * (i + 1),
          x: target.x,
          z: target.z,
          radius: relay ? 0.72 : 0.46,
          damage: skills.chain_arc.baseDamage * p.powerBucket(st) * (relay ? 0.68 : 0.52),
          faction: src.faction,
          ownerId: src.owner?.id ?? 0,
          source: 'chain_arc',
          sourceSlot: slot,
          intent: 'damage',
          telegraph: 'arc_return_pulse',
          fieldKind: relay ? 'arc' : undefined,
          fieldDuration: relay ? 0.7 : 0,
          fieldDps: relay ? 4 * p.powerBucket(st) : 0
        });
    }

    if (p.mutationIs(st, 'arc_closed_loop') && path.length > 1) {
      const first = path[0],
        last = path[path.length - 1],
        distance = Math.hypot(first.x - last.x, first.z - last.z) || 1;
      p.combatShape('arc_closed_loop', {
        kind: 'ray',
        x: last.x,
        z: last.z,
        aimX: (first.x - last.x) / distance,
        aimZ: (first.z - last.z) / distance,
        range: distance,
        halfWidth: 0.14
      });
      p.damage(
        first,
        skills.chain_arc.baseDamage * p.powerBucket(st) * 1.55,
        'chain_arc',
        false,
        last.x,
        last.z,
        slot
      );
    }

    if (p.mutationIs(st, 'arc_hunting_storm')) {
      const extra = [...p.targetsFor(src)]
        .filter(
          (e) =>
            e.hp > 0 &&
            !hit.has(e.id) &&
            path.some((h) => Math.hypot(e.x - h.x, e.z - h.z) < jumpRange * 1.2)
        )
        .slice(0, 3);
      for (const e of extra)
        p.scheduleStrike({
          at: p.time() + 0.18,
          x: e.x,
          z: e.z,
          radius: 0.72,
          damage: skills.chain_arc.baseDamage * p.powerBucket(st) * 0.82,
          faction: src.faction,
          ownerId: src.owner?.id ?? 0,
          source: 'chain_arc',
          sourceSlot: slot,
          intent: 'damage',
          telegraph: 'arc_hunting_node',
          fieldKind: 'arc',
          fieldDuration: 1.25,
          fieldDps: 7 * p.powerBucket(st)
        });
    }

    if (p.mutationIs(st, 'arc_living_circuit') && src.faction === 'hero') {
      let used = 0;
      for (const construct of p.constructs()) {
        if (construct.faction !== 'hero' || used++ >= 4) continue;
        const target = p.nearestEntity(
          construct.x,
          construct.z,
          (e) => {
            const dx = e.x - construct.x,
              dz = e.z - construct.z,
              reach = construct.range + e.radius;
            return dx * dx + dz * dz <= reach * reach;
          },
          construct.range + 2
        );
        if (!target) continue;
        const dx = target.x - construct.x,
          dz = target.z - construct.z,
          distance = Math.hypot(dx, dz) || 1;
        p.combatShape('arc_living_circuit', {
          kind: 'ray',
          x: construct.x,
          z: construct.z,
          aimX: dx / distance,
          aimZ: dz / distance,
          range: distance,
          halfWidth: 0.1
        });
        p.damage(
          target,
          skills.chain_arc.baseDamage * p.powerBucket(st) * 0.65,
          'chain_arc',
          false,
          construct.x,
          construct.z,
          slot
        );
      }
    }
  }

  private castOrbit(st: SkillRuntime, slot: number, src: CastSource) {
    const p = this.port;
    p.prepareOrbitActivation(src);

    // A rival cannot borrow the hero's global orbit loop; Outbound adds a pulse without
    // replacing the persistent hero Orbit actor.
    if (src.faction === 'rival' || st.mutation === 'orbit_outbound') {
      const radius = p.skillRadius(st, src.faction === 'rival' ? 2.8 : 4.6, slot),
        shape = { kind: 'circle' as const, x: src.x, z: src.z, radius };
      p.combatShape('orbit_blades', shape);
      for (const e of p.targetsFor(src)) {
        if (!combatShapeIntersectsCircle(shape, e.x, e.z, e.radius)) continue;
        p.damage(
          e,
          skills.orbit_blades.baseDamage *
            (src.faction === 'rival' ? 1.45 : 2.2) *
            p.powerBucket(st) *
            p.slotAmp(slot, e),
          'orbit_blades',
          false,
          src.x,
          src.z,
          slot
        );
      }
    }
  }

  private castMortar(st: SkillRuntime, slot: number, src: CastSource) {
    const p = this.port;
    const mut = st.mutation,
      range = p.skillRange(st, skills.mortar_bloom.baseRange);
    let point = p.aimPoint(src, range),
      radius = p.skillRadius(st, skills.mortar_bloom.baseRadius, slot),
      multiplier = 1;

    if (p.mutationIs(st, 'mortar_spotter')) {
      const marked = p.bestTarget(
        src,
        (e) => {
          if (e.kind !== 'elite' || e.markUntil <= p.time()) return false;
          const dx = e.x - src.x,
            dz = e.z - src.z;
          return dx * dx + dz * dz <= (range + 3) * (range + 3);
        },
        (a, b) => {
          const adx = a.x - point.x,
            adz = a.z - point.z,
            bdx = b.x - point.x,
            bdz = b.z - point.z;
          return adx * adx + adz * adz - (bdx * bdx + bdz * bdz);
        }
      );
      if (marked) point = { x: marked.x, z: marked.z };
    }

    if (mut === 'mortar_fuse') {
      radius *= 1.35;
      multiplier *= 1.35;
    }
    if (p.mutationIs(st, 'mortar_airburst')) {
      radius *= 1.2;
      multiplier *= 0.86;
    }

    const baseDamage =
      skills.mortar_bloom.baseDamage * p.powerBucket(st) * p.slotAmp(slot) * multiplier;
    const points: { x: number; z: number; delay: number }[] = [];

    if (p.mutationIs(st, 'mortar_carpet')) {
      for (let i = -2; i <= 2; i++)
        points.push({
          x: point.x + src.aimX * i * 1.7,
          z: point.z + src.aimZ * i * 1.7,
          delay: 0.25 + (i + 2) * 0.13
        });
    } else if (p.mutationIs(st, 'mortar_hunter_pass')) {
      const elite = p.bestTarget(
        src,
        (e) => e.kind === 'elite',
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
      const target = elite ?? ({ x: point.x, z: point.z } as Ent);
      for (let i = 0; i < 3; i++) {
        const angle = (i * Math.PI * 2) / 3;
        points.push({
          x: target.x + Math.cos(angle) * 1.35,
          z: target.z + Math.sin(angle) * 1.35,
          delay: 0.28 + i * 0.22
        });
      }
    } else {
      const count =
        mut === 'mortar_cluster' ? 3 : Math.max(1, Math.min(3, p.projectileCount(st, slot)));
      for (let i = 0; i < count; i++) {
        const angle = i ? p.randomRange(0, Math.PI * 2) : 0,
          offset = i ? p.randomRange(0.7, 1.5) : 0;
        points.push({
          x: point.x + Math.cos(angle) * offset,
          z: point.z + Math.sin(angle) * offset,
          delay: 0.38 + i * 0.12
        });
      }
    }

    for (const q of points)
      p.scheduleStrike({
        at: p.time() + q.delay,
        x: q.x,
        z: q.z,
        radius,
        damage: baseDamage,
        faction: src.faction,
        ownerId: src.owner?.id ?? 0,
        source: 'mortar_bloom',
        sourceSlot: slot,
        intent: 'damage',
        telegraph: 'bombardier_marker',
        fieldKind: p.mutationIs(st, 'mortar_gravity_field')
          ? 'arc'
          : p.mutationIs(st, 'mortar_crater')
            ? 'frost'
            : undefined,
        fieldDuration: p.mutationIs(st, 'mortar_gravity_field') ? 3.4 : 2.5,
        fieldDps: p.mutationIs(st, 'mortar_gravity_field')
          ? 5 * p.powerBucket(st)
          : 6 * p.powerBucket(st),
        fieldBehavior: p.mutationIs(st, 'mortar_gravity_field') ? 'pull' : undefined
      });

    p.noteState('field');
  }

  private castSentry(st: SkillRuntime, slot: number, src: CastSource) {
    const p = this.port;
    let count =
      Math.max(1, Math.round(st.count)) +
      p.activationCountBonus() +
      p.mutationCountAdd(st);
    count += Math.ceil(p.multiplicityFor(st) / 2);
    if (!src.owner) count += Math.min(2, Math.floor(p.doctrineQuantity() / 2));
    count = Math.max(1, Math.min(5, count));

    const perpX = -src.aimZ,
      perpZ = src.aimX,
      forward = 2.5 + (count > 3 ? 0.35 : 0),
      spacing = 1.05;

    for (let i = 0; i < count; i++) {
      const lane = i - (count - 1) / 2,
        stagger = (i % 2) * 0.35,
        rawX = src.x + src.aimX * (forward + stagger) + perpX * lane * spacing,
        rawZ = src.z + src.aimZ * (forward + stagger) + perpZ * lane * spacing,
        point = p.freeOf(rawX, rawZ, 0.38),
        activationId = src.faction === 'hero' ? p.currentPhysicalActivationId() : 0;

      p.addSentryConstruct({
        activationId: activationId || undefined,
        x: point.x,
        z: point.z,
        ttl: p.persistentDuration(st, 5.25, slot),
        cooldown: p.mutationIs(st, 'sentry_hunter_battery') ? 0 : 0.1 + i * 0.08,
        range: p.skillRange(st, skills.sentry.baseRange),
        power: p.powerBucket(st) * p.slotAmp(slot),
        skill: 'sentry',
        faction: src.faction,
        ownerId: src.owner?.id ?? 0,
        sourceSlot: slot,
        mutation: st.mutation,
        mutationUpgrade: st.mutationUpgrade,
        mutationApotheosis: st.mutationApotheosis,
        rivalConcentration: effectGrammar.sentry.rivalConcentration
      });

      p.combatShape(
        'sentry_placement',
        { kind: 'circle', x: point.x, z: point.z, radius: 0.42 },
        'field'
      );
    }

    p.trimConstructs(18);
    p.noteState('construct');
  }

  private castRepulse(st: SkillRuntime, slot: number, src: CastSource) {
    const p = this.port;
    const mut = st.mutation,
      baseRadius = p.skillRadius(st, skills.repulse_halo.baseRadius, slot),
      passes = p.mutationIs(st, 'repulse_rings') ? 2 : 1;
    let aegisGranted = 0;

    for (let pass = 0; pass < passes; pass++) {
      const radius = baseRadius * (passes === 2 ? (pass === 0 ? 0.72 : 1.05) : 1),
        pull = mut === 'repulse_gravity';

      p.combatShape(
        'repulse_halo',
        { kind: 'circle', x: src.x, z: src.z, radius },
        'control'
      );

      for (const e of p.targetsFor(src)) {
        if (e.hp <= 0) continue;
        const dx = e.x - src.x,
          dz = e.z - src.z,
          distance = Math.hypot(dx, dz) || 1;
        if (distance > radius + e.radius) continue;

        let damage =
          skills.repulse_halo.baseDamage *
          p.powerBucket(st) *
          p.slotAmp(slot, e) *
          (passes === 2 ? 0.7 : 1);
        if (mut === 'repulse_front') damage *= distance > radius * 0.68 ? 2 : 0.42;

        p.damage(e, damage, 'repulse_halo', false);
        const force = (0.72 + 0.58 * st.control) * (pull ? -1 : 1);
        e.x += (dx / distance) * force;
        e.z += (dz / distance) * force;
        e.displacedUntil = p.time() + 1.4;
        p.noteState('displaced');
        p.addActivationControl(1.2 + st.control);

        if (mut === 'repulse_aegis' && aegisGranted < 24) {
          const gain = Math.min(24 - aegisGranted, 2.2 + 1.3 * st.control);
          p.grantBarrier(gain);
          aegisGranted += gain;
        }

        if (p.mutationIs(st, 'repulse_relay'))
          p.setCharge(Math.min(6, p.charge() + 0.22 + st.control * 0.08));
      }
    }
  }

  private castMassDriver(st: SkillRuntime, slot: number, src: CastSource) {
    const p = this.port;
    const mut = st.mutation,
      range = p.skillRange(st, skills.mass_driver.baseRange);
    let speed = 3.8,
      radius = p.skillRadius(st, 0.72, slot),
      damage = skills.mass_driver.baseDamage * p.powerBucket(st) * p.slotAmp(slot),
      coverDamage = 90;

    if (mut === 'mass_rail') {
      speed = 6.2;
      radius *= 0.72;
      damage *= 1.45;
    }
    if (mut === 'mass_snowball') {
      speed = 3.25;
      radius *= 1.08;
    }

    if (p.mutationIs(st, 'mass_cargo')) {
      const cargo = p.cargoCount(src, range);
      damage *= 1 + Math.min(0.9, cargo * 0.14);
      radius *= 1 + Math.min(0.35, cargo * 0.04);
    }

    if (p.mutationIs(st, 'mass_terminal')) {
      speed *= 1.38;
      damage *= 1.42;
      radius *= 0.9;
    }

    if (mut === 'mass_recoil' || p.mutationIs(st, 'mass_counterthrust')) {
      const kick = p.mutationIs(st, 'mass_comet_recoil') ? 1.8 : 1.05;
      p.displaceSource(src, -src.aimX * kick, -src.aimZ * kick);
      if (!src.owner && p.mutationIs(st, 'mass_comet_recoil')) p.grantHeroDashIFrames(0.16);
    }

    if (p.mutationIs(st, 'mass_comet_recoil')) {
      speed *= 1.35;
      damage *= 1.28;
      radius *= 1.18;
    }

    p.combatShape(
      'mass_driver',
      {
        kind: 'ray',
        x: src.x,
        z: src.z,
        aimX: src.aimX,
        aimZ: src.aimZ,
        range,
        halfWidth: radius
      },
      'control',
      false
    );

    p.spawnProjectile({
      x: src.x + src.aimX * (radius + 0.25),
      z: src.z + src.aimZ * (radius + 0.25),
      vx: src.aimX * speed,
      vz: src.aimZ * speed,
      radius,
      ttl: range / speed,
      damage,
      coverDamage: coverDamage + damage * 0.8,
      faction: src.faction,
      ownerId: src.owner?.id ?? 0,
      source: 'mass_driver',
      sourceSlot: slot,
      mutation: mut,
      apotheosis: st.mutationApotheosis,
      rivalConcentration: effectGrammar.mass_driver.rivalConcentration,
      behavior: 'roller',
      phase: 0,
      hitIds: [],
      growth: p.mutationIs(st, 'mass_avalanche') ? 0.12 : mut === 'mass_snowball' ? 0.06 : 0
    });
  }
}
