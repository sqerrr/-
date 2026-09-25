import { skills } from '../content/definitions.js';
import { circleIntersectsCircle, combatShapeIntersectsCircle } from './geometry.js';
import type { Ent, PhysicalEvent, Projectile } from './state.js';
import type { CombatShape, MutationId, SkillRuntime } from './types.js';

export interface OrbitPoint {
  x: number;
  z: number;
}

export interface OrbitProfile {
  count: number;
  radius: number;
  damageMul: number;
  crowd: number;
  hitInterval: number;
}

export interface OrbitGeometry {
  profile: OrbitProfile;
  angularSpeed: number;
  bladeRadius: number;
  blades: { x: number; z: number; index: number }[];
}

export interface OrbitSystemPort {
  time(): number;
  tick(): number;
  heroX(): number;
  heroZ(): number;

  entities(): readonly Ent[];
  countAlive(predicate: (entity: Ent) => boolean): number;
  bestAlive(compare: (a: Ent, b: Ent) => number): Ent | undefined;

  powerBucket(runtime: SkillRuntime): number;
  skillRadius(runtime: SkillRuntime, base: number): number;
  hasMutation(runtime: SkillRuntime, id: MutationId): boolean;
  multiplicity(): number;
  quantityDoctrine(): number;

  orbitActivationId(): number;
  retireOrbitActivation(x: number, z: number): void;
  queuePhysicalEvent(event: PhysicalEvent): void;

  damageTarget(target: Ent, amount: number, x: number, z: number, slot: number): void;
  grantBarrier(amount: number): void;

  aegisCharge(): number;
  clearAegisCharge(): void;
  combatShape(source: string, shape: CombatShape, intent?: 'damage' | 'control' | 'field'): void;
  emitRareEvent(title: string, detail: string, x: number, z: number): void;

  spawnProjectile(projectile: Omit<Projectile, 'id' | 'guarded'>): void;
}

/**
 * Runtime owner for persistent Orbit Blades.
 *
 * The same geometry contract is reused by damage, Catalyst traces and snapshots so visual blades
 * and gameplay hitboxes cannot silently diverge again.
 */
export class OrbitSystem {
  private phoenixAt = 0;

  constructor(private readonly port: OrbitSystemPort) {}

  profile(runtime: SkillRuntime, center: OrbitPoint): OrbitProfile {
    const p = this.port;
    let count =
      3 +
      Math.max(0, Math.round(runtime.count) - 1) +
      p.multiplicity() +
      Math.min(3, Math.floor(p.quantityDoctrine() / 2));
    let damageMul = 1;

    if (runtime.mutation === 'orbit_many') count += 3;
    else if (runtime.mutation === 'orbit_saw') {
      count = Math.max(2, count - 1);
      damageMul *= 1.4;
    }

    count = Math.max(2, Math.min(12, count));
    let radius = p.skillRadius(runtime, skills.orbit_blades.baseRadius);
    let crowd = 0;

    if (p.hasMutation(runtime, 'orbit_blood')) {
      crowd = p.countAlive((entity) => {
        const dx = entity.x - center.x;
        const dz = entity.z - center.z;
        return dx * dx + dz * dz < 36;
      });
      radius *= 1 + Math.min(0.34, crowd * 0.017);
      damageMul *= 1 + Math.min(0.48, crowd * 0.024);
      if (p.hasMutation(runtime, 'orbit_sanguine_crown'))
        radius *= 1 + Math.min(0.22, crowd * 0.01);
    }

    const hitInterval = Math.max(0.085, Math.min(0.5, 0.38 * (3 / count)));
    return { count, radius, damageMul, crowd, hitInterval };
  }

  geometry(runtime: SkillRuntime, center: OrbitPoint): OrbitGeometry {
    const profile = this.profile(runtime, center);
    const angularSpeed = runtime.mutation === 'orbit_saw' ? 2.55 : 3.4;
    const bladeRadius = runtime.mutation === 'orbit_saw' ? 0.58 : 0.42;
    const blades: OrbitGeometry['blades'] = [];

    for (let index = 0; index < profile.count; index++) {
      const angle = this.port.time() * angularSpeed + (index * Math.PI * 2) / profile.count;
      blades.push({
        x: center.x + Math.cos(angle) * profile.radius,
        z: center.z + Math.sin(angle) * profile.radius,
        index
      });
    }

    return { profile, angularSpeed, bladeRadius, blades };
  }

  update(runtime: SkillRuntime | undefined, active: boolean, slot: number, center: () => OrbitPoint) {
    const p = this.port;

    if (!runtime || !active) {
      if (p.orbitActivationId()) {
        const point = center();
        p.retireOrbitActivation(point.x, point.z);
      }
      return;
    }

    const point = center();
    const geometry = this.geometry(runtime, point);
    const { profile, bladeRadius, blades } = geometry;
    const damage =
      skills.orbit_blades.baseDamage *
      p.powerBucket(runtime) *
      0.36 *
      profile.damageMul;

    // Damage uses the same discrete blade circles exposed by geometry().
    for (const entity of p.entities()) {
      if (entity.hp <= 0) continue;
      const blade = blades.find((candidate) =>
        circleIntersectsCircle(
          candidate.x,
          candidate.z,
          bladeRadius,
          entity.x,
          entity.z,
          entity.radius
        )
      );
      if (!blade) continue;
      if (p.time() - entity.orbitHitAt < profile.hitInterval) continue;

      entity.orbitHitAt = p.time();
      let amount = damage;
      if (runtime.mutation === 'orbit_saw' && entity.kind === 'elite') amount *= 1.9;

      p.damageTarget(entity, amount, blade.x, blade.z, slot);

      const activationId = p.orbitActivationId();
      if (activationId) {
        p.queuePhysicalEvent({
          activationId,
          slot,
          skill: 'orbit_blades',
          kind: 'contact',
          x: blade.x,
          z: blade.z,
          radius: bladeRadius,
          carrierKind: 'orbit',
          carrierId: blade.index,
          targetId: entity.id
        });
      }

      if (p.hasMutation(runtime, 'orbit_sanguine_crown') && profile.crowd >= 5)
        p.grantBarrier(Math.min(3.2, amount * 0.02));
    }

    if (p.hasMutation(runtime, 'orbit_aegis_crown') && p.aegisCharge() >= 6) {
      p.clearAegisCharge();
      p.grantBarrier(16);

      const radius = profile.radius + 1.8;
      const shape: CombatShape = {
        kind: 'circle',
        x: point.x,
        z: point.z,
        radius
      };
      p.combatShape('orbit_aegis_crown', shape, 'control');

      for (const entity of p.entities()) {
        if (
          entity.hp <= 0 ||
          !combatShapeIntersectsCircle(shape, entity.x, entity.z, entity.radius)
        )
          continue;

        const dx = entity.x - point.x;
        const dz = entity.z - point.z;
        const distance = Math.hypot(dx, dz) || 1;
        p.damageTarget(entity, 22 * p.powerBucket(runtime), point.x, point.z, slot);
        entity.x += (dx / distance) * 0.75;
        entity.z += (dz / distance) * 0.75;
      }

      p.emitRareEvent(
        'КОРОНА ЭГИДЫ',
        'Перехваты выпущены ударной волной',
        point.x,
        point.z
      );
    }

    if (p.hasMutation(runtime, 'orbit_phoenix') && p.time() >= this.phoenixAt) {
      this.phoenixAt = p.time() + 1.35;

      const target = p.bestAlive((a, b) => {
        const priority =
          Number(b.markUntil > p.time() || b.kind === 'elite') -
          Number(a.markUntil > p.time() || a.kind === 'elite');
        if (priority) return priority;
        const adx = a.x - point.x;
        const adz = a.z - point.z;
        const bdx = b.x - point.x;
        const bdz = b.z - point.z;
        return adx * adx + adz * adz - (bdx * bdx + bdz * bdz);
      });

      if (target) {
        const dx = target.x - point.x;
        const dz = target.z - point.z;
        const magnitude = Math.hypot(dx, dz) || 1;
        p.spawnProjectile({
          x: point.x + (dx / magnitude) * profile.radius,
          z: point.z + (dz / magnitude) * profile.radius,
          vx: (dx / magnitude) * 8.5,
          vz: (dz / magnitude) * 8.5,
          radius: 0.28,
          ttl: 2.8,
          damage: skills.orbit_blades.baseDamage * p.powerBucket(runtime) * 1.25,
          coverDamage: 16,
          faction: 'hero',
          ownerId: 0,
          source: 'orbit_blades',
          sourceSlot: slot,
          mutation: runtime.mutation,
          activationId: p.orbitActivationId() || undefined,
          apotheosis: 'orbit_phoenix',
          rivalConcentration: 1,
          behavior: 'returner',
          returnAt: 1.3,
          phase: 0,
          hitIds: []
        });
      }
    }
  }

  diagnostics() {
    return { phoenixAt: this.phoenixAt };
  }
}
