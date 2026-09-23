import { effectGrammar, skills } from '../content/definitions.js';
import { HERO_HIT_RADIUS, type DelayedStrike, type EliteEchoState, type Ent, type Field, type Projectile } from './state.js';
import type { CombatShape, DamageSourceId, GameEvent, RefusedCard, ResonanceId, SkillId } from './types.js';

export interface EliteEchoPort {
  time(): number;
  tick(): number;
  playerX(): number;
  playerZ(): number;
  playerVX(): number;
  playerVZ(): number;

  entityById(id: number): Ent | undefined;
  refusalStore(): readonly RefusedCard[];

  randomRange(min: number, max: number): number;
  randomInt(maxExclusive: number): number;
  axisCount(entity: Ent, axis: ResonanceId): number;
  patternCooldown(base: number, entity: Ent): number;

  lineOfSight(x0: number, z0: number, x1: number, z1: number, radius: number): boolean;
  damageScale(): number;
  damageHero(amount: number, source: DamageSourceId, owner: Ent, concentration: number): void;
  combatShape(source: string, shape: CombatShape, intent?: 'damage' | 'control' | 'field'): void;
  scheduleStrike(strike: Omit<DelayedStrike, 'id'>): void;
  addField(field: Omit<Field, 'id'>): void;
  spawnProjectile(projectile: Omit<Projectile, 'id' | 'guarded'>): void;
  movePlayer(dx: number, dz: number): void;

  emit(event: GameEvent): void;
  noteRivalCast(entity: Ent, skill: SkillId): void;
}

/**
 * State machine for refused-Phenomenon Echoes used by elites and the Warden.
 *
 * It owns tell -> active -> recovery state, rival-cast cooldowns, target selection and authored
 * Echo geometry. Simulation provides combat primitives and telemetry through a narrow port.
 */
export class EliteEchoSystem {
  private readonly states = new Map<number, EliteEchoState>();
  private readonly readyAt = new Map<number, number>();

  constructor(private readonly port: EliteEchoPort) {}

  has(entityId: number) {
    return this.states.has(entityId);
  }

  get(entityId: number) {
    return this.states.get(entityId);
  }

  release(entityId: number) {
    this.states.delete(entityId);
    this.readyAt.delete(entityId);
  }

  clear() {
    this.states.clear();
    this.readyAt.clear();
  }

  fieldRefusals(entity: Ent, distance: number) {
    const p = this.port;
    if (entity.hp <= 0 || !entity.repertoire.length || this.states.has(entity.id)) return;

    const ready = this.readyAt.get(entity.id);
    if (ready === undefined) {
      this.readyAt.set(entity.id, p.time() + p.randomRange(2.6, 4.6));
      return;
    }
    if (p.time() < ready) return;

    const usable = entity.repertoire
      .map((serial) => p.refusalStore().find((card) => card.serial === serial))
      .filter(
        (card): card is RefusedCard =>
          !!card &&
          !!card.skill &&
          distance <= this.rivalReach(card.skill as SkillId) * (entity.relicReachMul ?? 1) &&
          (
            !effectGrammar[card.skill as SkillId].blockedByCover ||
            p.lineOfSight(entity.x, entity.z, p.playerX(), p.playerZ(), 0.12)
          )
      );

    if (!usable.length) {
      const holdsExecutable = entity.repertoire.some((serial) => {
        const card = p.refusalStore().find((candidate) => candidate.serial === serial);
        return !!card?.skill;
      });
      this.readyAt.set(entity.id, p.time() + (holdsExecutable ? 0.35 : 4));
      return;
    }

    this.start(entity, usable[p.randomInt(usable.length)]);
  }

  start(entity: Ent, card: RefusedCard) {
    if (!card.skill) return;

    const p = this.port;
    const skill = card.skill;
    const dx = p.playerX() - entity.x;
    const dz = p.playerZ() - entity.z;
    const magnitude = Math.hypot(dx, dz) || 1;

    const state: EliteEchoState = {
      entityId: entity.id,
      skill,
      serial: card.serial,
      phase: 'tell',
      until: p.time() + this.tellDuration(skill),
      x: entity.x,
      z: entity.z,
      aimX: dx / magnitude,
      aimZ: dz / magnitude,
      targetX: p.playerX() + p.playerVX() * 0.28,
      targetZ: p.playerZ() + p.playerVZ() * 0.28
    };

    this.states.set(entity.id, state);
    p.emit({
      type: 'EliteEchoPhase',
      tick: p.tick(),
      entity: entity.id,
      skill,
      phase: 'tell',
      x: entity.x,
      z: entity.z,
      aimX: state.aimX,
      aimZ: state.aimZ
    });
    this.telegraph(state);
  }

  update() {
    const p = this.port;

    for (const [entityId, state] of [...this.states]) {
      const entity = p.entityById(entityId);
      if (!entity) {
        this.states.delete(entityId);
        continue;
      }
      if (p.time() + 1e-9 < state.until) continue;

      if (state.phase === 'tell') {
        state.phase = 'active';
        state.until = p.time() + 0.14;
        p.emit({
          type: 'EliteEchoPhase',
          tick: p.tick(),
          entity: entity.id,
          skill: state.skill,
          phase: 'active',
          x: entity.x,
          z: entity.z,
          aimX: state.aimX,
          aimZ: state.aimZ
        });

        this.resolve(entity, state);
        p.noteRivalCast(entity, state.skill);
        p.emit({
          type: 'RivalCast',
          tick: p.tick(),
          entity: entity.id,
          skill: state.skill,
          serial: state.serial,
          x: entity.x,
          z: entity.z
        });
        continue;
      }

      if (state.phase === 'active') {
        state.phase = 'recovery';
        state.until = p.time() + (state.skill === 'rail_spear' ? 0.9 : 0.68);
        p.emit({
          type: 'EliteEchoPhase',
          tick: p.tick(),
          entity: entity.id,
          skill: state.skill,
          phase: 'recovery',
          x: entity.x,
          z: entity.z,
          aimX: state.aimX,
          aimZ: state.aimZ
        });
        continue;
      }

      this.states.delete(entityId);
      const rawGap = Math.max(
        2.25,
        p.randomRange(3.4, 5.0) - entity.repertoire.length * 0.22
      );
      const gap =
        p.patternCooldown(rawGap, entity) *
        Math.pow(0.86, p.axisCount(entity, 'tempo'));
      this.readyAt.set(entity.id, p.time() + gap);
    }
  }

  private telegraph(state: EliteEchoState) {
    const p = this.port;
    const push = (
      shape: CombatShape,
      intent: 'damage' | 'control' | 'field' = 'damage',
      suffix = ''
    ) =>
      p.emit({
        type: 'CombatShape',
        tick: p.tick(),
        source: `echo_${state.skill}_tell${suffix}`,
        intent,
        shape
      });

    if (
      state.skill === 'rail_spear' ||
      state.skill === 'mass_driver' ||
      state.skill === 'breach_line'
    ) {
      push({
        kind: 'ray',
        x: state.x,
        z: state.z,
        aimX: state.aimX,
        aimZ: state.aimZ,
        range: state.skill === 'rail_spear' ? 26 : 19,
        halfWidth: state.skill === 'rail_spear' ? 0.42 : 0.95
      });
      return;
    }

    if (
      state.skill === 'cleaver' ||
      state.skill === 'contact_saw' ||
      state.skill === 'backhand'
    ) {
      push({
        kind: 'sector',
        x: state.x,
        z: state.z,
        radius: 3.4,
        aimX: state.aimX,
        aimZ: state.aimZ,
        halfAngle: 0.9
      });
      return;
    }

    if (state.skill === 'frost_ring' || state.skill === 'spreading_front') {
      push({ kind: 'circle', x: state.targetX, z: state.targetZ, radius: 2.4 }, 'control');
      return;
    }

    if (state.skill === 'chain_arc') {
      for (let index = 0; index < 3; index++) {
        const angle = index * Math.PI * 2 / 3;
        push(
          {
            kind: 'circle',
            x: state.targetX + Math.cos(angle) * 2.2,
            z: state.targetZ + Math.sin(angle) * 2.2,
            radius: 1.05
          },
          'damage',
          `_${index}`
        );
      }
      return;
    }

    if (state.skill === 'orbit_blades') {
      push({ kind: 'circle', x: state.x, z: state.z, radius: 3.0 });
      return;
    }

    if (state.skill === 'mortar_bloom' || state.skill === 'pin_burst') {
      for (let index = 0; index < 3; index++)
        push(
          {
            kind: 'circle',
            x: state.targetX + state.aimX * index * 1.1,
            z: state.targetZ + state.aimZ * index * 1.1,
            radius: 1.35
          },
          'damage',
          `_${index}`
        );
      return;
    }

    if (state.skill === 'sentry') {
      const px = -state.aimZ;
      const pz = state.aimX;
      for (const side of [-1, 1])
        push(
          {
            kind: 'ray',
            x: state.x + px * side * 1.5,
            z: state.z + pz * side * 1.5,
            aimX: state.aimX,
            aimZ: state.aimZ,
            range: 10,
            halfWidth: 0.24
          },
          'damage',
          side < 0 ? '_l' : '_r'
        );
      return;
    }

    if (state.skill === 'toxic_mist') {
      for (let index = 0; index < 3; index++)
        push(
          {
            kind: 'circle',
            x: state.targetX - state.aimX * index * 1.2,
            z: state.targetZ - state.aimZ * index * 1.2,
            radius: 1.35
          },
          'field',
          `_${index}`
        );
      return;
    }

    if (state.skill === 'shard_fan') {
      push({
        kind: 'ray',
        x: state.x,
        z: state.z,
        aimX: state.aimX,
        aimZ: state.aimZ,
        range: 16,
        halfWidth: 1.15
      });
      return;
    }

    if (state.skill === 'tether_drag') {
      push({ kind: 'circle', x: state.targetX, z: state.targetZ, radius: 1.05 }, 'control');
      return;
    }

    push({ kind: 'circle', x: state.targetX, z: state.targetZ, radius: 1.4 });
  }

  private resolve(entity: Ent, state: EliteEchoState) {
    const p = this.port;
    const scaled = p.damageScale();
    const damage = (
      amount: number,
      source: DamageSourceId = `echo_${state.skill}`
    ) => p.damageHero(amount * scaled, source, entity, 1);

    const hitRay = (range: number, width: number, amount: number) => {
      if (!p.lineOfSight(state.x, state.z, p.playerX(), p.playerZ(), width * 0.2)) return;

      const dx = p.playerX() - state.x;
      const dz = p.playerZ() - state.z;
      const along = dx * state.aimX + dz * state.aimZ;
      const lateral = Math.abs(dx * state.aimZ - dz * state.aimX);
      if (along >= 0 && along <= range && lateral <= width + HERO_HIT_RADIUS)
        damage(amount);
    };

    if (state.skill === 'rail_spear') {
      p.combatShape('echo_rail_spear_active', {
        kind: 'ray',
        x: state.x,
        z: state.z,
        aimX: state.aimX,
        aimZ: state.aimZ,
        range: 26,
        halfWidth: 0.42
      });
      hitRay(26, 0.42, 34);
      return;
    }

    if (state.skill === 'frost_ring' || state.skill === 'spreading_front') {
      const px = -state.aimZ;
      const pz = state.aimX;
      for (const side of [-1, 1])
        p.scheduleStrike({
          at: p.time() + 0.22,
          x: state.targetX + px * side * 2.2,
          z: state.targetZ + pz * side * 2.2,
          radius: 1.55,
          damage: 18 * scaled,
          faction: 'rival',
          ownerId: entity.id,
          source: state.skill,
          sourceSlot: -1,
          intent: 'control',
          telegraph: `echo_${state.skill}_front`
        });

      p.addField({
        x: state.targetX,
        z: state.targetZ,
        radius: 1.45,
        ttl: 2.3,
        kind: 'frost',
        dps: 10 * scaled,
        tickAcc: 0,
        faction: 'rival',
        ownerId: entity.id,
        source: state.skill,
        sourceSlot: -1,
        mutation: null,
        rivalConcentration: 1
      });
      return;
    }

    if (
      state.skill === 'cleaver' ||
      state.skill === 'contact_saw' ||
      state.skill === 'backhand'
    ) {
      p.combatShape(`echo_${state.skill}_active`, {
        kind: 'sector',
        x: state.x,
        z: state.z,
        radius: 3.4,
        aimX: state.aimX,
        aimZ: state.aimZ,
        halfAngle: 0.9
      });
      const dx = p.playerX() - state.x;
      const dz = p.playerZ() - state.z;
      const distance = Math.hypot(dx, dz) || 1;
      const dot = (dx / distance) * state.aimX + (dz / distance) * state.aimZ;
      if (distance <= 3.4 + HERO_HIT_RADIUS && dot > Math.cos(0.9)) damage(28);
      return;
    }

    if (state.skill === 'chain_arc') {
      for (let index = 0; index < 3; index++) {
        const angle = index * Math.PI * 2 / 3 + Math.atan2(state.aimZ, state.aimX);
        p.scheduleStrike({
          at: p.time() + 0.18 + index * 0.1,
          x: state.targetX + Math.cos(angle) * 2.2,
          z: state.targetZ + Math.sin(angle) * 2.2,
          radius: 1.05,
          damage: 14 * scaled,
          faction: 'rival',
          ownerId: entity.id,
          source: state.skill,
          sourceSlot: -1,
          intent: 'damage',
          telegraph: 'echo_chain_node'
        });
      }
      return;
    }

    if (state.skill === 'orbit_blades') {
      const gap = p.randomInt(7);
      for (let index = 0; index < 7; index++) {
        if (index === gap) continue;
        const angle = index * Math.PI * 2 / 7;
        const speed = 5.1;
        p.spawnProjectile({
          x: entity.x + Math.cos(angle) * 1.3,
          z: entity.z + Math.sin(angle) * 1.3,
          vx: Math.cos(angle) * speed,
          vz: Math.sin(angle) * speed,
          radius: 0.26,
          ttl: 2.1,
          damage: 14 * scaled,
          coverDamage: 8,
          faction: 'rival',
          ownerId: entity.id,
          source: 'orbit_blades',
          sourceSlot: -1,
          mutation: null,
          rivalConcentration: 1,
          behavior: 'echo',
          phase: 0,
          hitIds: []
        });
      }
      return;
    }

    if (state.skill === 'mortar_bloom' || state.skill === 'pin_burst') {
      for (let index = 0; index < 3; index++)
        p.scheduleStrike({
          at: p.time() + 0.28 + index * 0.24,
          x: state.targetX + p.playerVX() * index * 0.18,
          z: state.targetZ + p.playerVZ() * index * 0.18,
          radius: 1.35,
          damage: 19 * scaled,
          faction: 'rival',
          ownerId: entity.id,
          source: state.skill,
          sourceSlot: -1,
          intent: 'damage',
          telegraph: 'echo_bombardment'
        });
      return;
    }

    if (state.skill === 'sentry') {
      const perpX = -state.aimZ;
      const perpZ = state.aimX;
      for (const side of [-1, 1]) {
        const x = entity.x + perpX * side * 1.5;
        const z = entity.z + perpZ * side * 1.5;
        const dx = state.targetX - x;
        const dz = state.targetZ - z;
        const magnitude = Math.hypot(dx, dz) || 1;
        p.spawnProjectile({
          x,
          z,
          vx: dx / magnitude * 7.2,
          vz: dz / magnitude * 7.2,
          radius: 0.22,
          ttl: 2.2,
          damage: 18 * scaled,
          coverDamage: 12,
          faction: 'rival',
          ownerId: entity.id,
          source: 'sentry',
          sourceSlot: -1,
          mutation: null,
          rivalConcentration: 1,
          behavior: 'echo',
          phase: 0,
          hitIds: []
        });
      }
      return;
    }

    if (state.skill === 'toxic_mist') {
      for (let index = 0; index < 3; index++)
        p.addField({
          x: state.targetX - p.playerVX() * 0.25 * index,
          z: state.targetZ - p.playerVZ() * 0.25 * index,
          radius: 1.35,
          ttl: 2.8,
          kind: 'toxic',
          dps: 8 * scaled,
          tickAcc: 0,
          faction: 'rival',
          ownerId: entity.id,
          source: state.skill,
          sourceSlot: -1,
          mutation: null,
          rivalConcentration: 1
        });
      return;
    }

    if (state.skill === 'mass_driver') {
      p.spawnProjectile({
        x: entity.x,
        z: entity.z,
        vx: state.aimX * 3.8,
        vz: state.aimZ * 3.8,
        radius: 0.72,
        ttl: 5.0,
        damage: 28 * scaled,
        coverDamage: 75,
        faction: 'rival',
        ownerId: entity.id,
        source: 'mass_driver',
        sourceSlot: -1,
        mutation: null,
        rivalConcentration: 1,
        behavior: 'roller',
        phase: 0,
        hitIds: [],
        growth: 0
      });
      return;
    }

    if (state.skill === 'shard_fan') {
      const perpX = -state.aimZ;
      const perpZ = state.aimX;
      for (const side of [-0.45, 0, 0.45]) {
        const ax = state.aimX + perpX * side;
        const az = state.aimZ + perpZ * side;
        const magnitude = Math.hypot(ax, az) || 1;
        p.spawnProjectile({
          x: entity.x,
          z: entity.z,
          vx: ax / magnitude * 6.4,
          vz: az / magnitude * 6.4,
          radius: 0.24,
          ttl: 2.6,
          damage: 15 * scaled,
          coverDamage: 10,
          faction: 'rival',
          ownerId: entity.id,
          source: 'shard_fan',
          sourceSlot: -1,
          mutation: null,
          rivalConcentration: 1,
          behavior: 'returner',
          returnAt: 1.25,
          phase: 0,
          hitIds: []
        });
      }
      return;
    }

    if (state.skill === 'tether_drag') {
      p.combatShape(
        'echo_tether_active',
        { kind: 'circle', x: state.targetX, z: state.targetZ, radius: 1.05 },
        'control'
      );
      const dx = state.targetX - p.playerX();
      const dz = state.targetZ - p.playerZ();
      const distance = Math.hypot(dx, dz) || 1;
      if (distance < 7.5) {
        p.movePlayer(
          dx / distance * Math.min(1.8, distance * 0.32),
          dz / distance * Math.min(1.8, distance * 0.32)
        );
        damage(10, 'echo_tether_drag');
      }
      return;
    }

    p.spawnProjectile({
      x: entity.x,
      z: entity.z,
      vx: state.aimX * 5.4,
      vz: state.aimZ * 5.4,
      radius: 0.28,
      ttl: 3,
      damage: 17 * scaled,
      coverDamage: 8,
      faction: 'rival',
      ownerId: entity.id,
      source: state.skill,
      sourceSlot: -1,
      mutation: null,
      rivalConcentration: 1,
      behavior: 'echo',
      phase: 0,
      hitIds: []
    });
  }

  private tellDuration(skill: SkillId) {
    if (skill === 'rail_spear') return 0.92;
    if (skill === 'mortar_bloom') return 0.78;
    if (skill === 'mass_driver') return 0.74;
    if (skill === 'tether_drag') return 0.86;
    if (skill === 'cleaver') return 0.58;
    return 0.68;
  }

  private rivalReach(skill: SkillId) {
    const definition = skills[skill];
    return Math.max(definition.baseRange ?? 0, definition.baseRadius ?? 0);
  }
}
