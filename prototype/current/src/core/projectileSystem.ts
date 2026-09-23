import { sweepCircleT } from './geometry.js';
import type {
  DelayedStrike,
  Ent,
  Field,
  Obstacle,
  PhysicalEvent,
  Projectile
} from './state.js';
import type { DamageSourceId, MutationId, SkillId } from './types.js';

export interface ProjectileSystemPort {
  readonly world: { minX: number; maxX: number; minZ: number; maxZ: number };

  dt(): number;
  time(): number;
  tick(): number;
  heroX(): number;
  heroZ(): number;

  finishAsyncPhysical(activationId: number | undefined, x: number, z: number): void;
  queuePhysicalEvent(event: PhysicalEvent): void;
  scheduleStrike(strike: Omit<DelayedStrike, 'id'>): void;
  addField(field: Omit<Field, 'id'>): void;

  projectileOwner(projectile: Projectile): Ent | null;
  hasMutation(skill: SkillId, mutation: MutationId): boolean;
  gainAegisCharge(): void;
  emitReaction(reaction: string, x: number, z: number, amount: number): void;

  obstaclesNear(x: number, z: number, radius: number): readonly Obstacle[];
  targetsFor(projectile: Projectile, x: number, z: number): readonly Ent[];
  damageObstacle(obstacle: Obstacle, amount: number): boolean;
  damageTarget(
    target: Ent,
    amount: number,
    source: SkillId,
    x: number,
    z: number,
    sourceSlot: number
  ): void;
  applyFanBurn(target: Ent): void;
  forceDoctrine(): number;
  damageHero(
    amount: number,
    source: DamageSourceId,
    owner: Ent | null,
    concentration: number
  ): void;
}

/**
 * Runtime lifecycle for moving projectile actors.
 *
 * Casting still belongs to Phenomenon code and shared combat services stay in Simulation.
 * This system owns movement, swept collisions, Returner/Roller phases and projectile-specific
 * physical-event lineage.
 */
export class ProjectileSystem {
  constructor(private readonly port: ProjectileSystemPort) {}

  update(projectiles: Projectile[]): Projectile[] {
    if (!projectiles.length) return projectiles;

    const p = this.port;
    const dt = p.dt();
    const time = p.time();
    const alive: Projectile[] = [];

    const pathEvent = (projectile: Projectile, x0: number, z0: number, x1: number, z1: number) => {
      if (projectile.faction !== 'hero' || !projectile.activationId) return;
      if (Math.hypot(x1 - x0, z1 - z0) < 1e-5) return;
      p.queuePhysicalEvent({
        activationId: projectile.activationId,
        slot: projectile.sourceSlot,
        skill: projectile.source,
        kind: 'path',
        previousX: x0,
        previousZ: z0,
        x: x1,
        z: z1,
        carrierKind: 'projectile',
        carrierId: projectile.id
      });
    };

    const contactEvent = (projectile: Projectile, target?: Ent) => {
      if (projectile.faction !== 'hero' || !projectile.activationId) return;
      p.queuePhysicalEvent({
        activationId: projectile.activationId,
        slot: projectile.sourceSlot,
        skill: projectile.source,
        kind: 'contact',
        x: projectile.x,
        z: projectile.z,
        radius: projectile.radius,
        carrierKind: 'projectile',
        carrierId: projectile.id,
        targetId: target?.id
      });
    };

    for (const projectile of projectiles) {
      projectile.ttl -= dt;
      if (projectile.ttl <= 0) {
        if (projectile.behavior === 'roller' && projectile.apotheosis === 'mass_singularity') {
          p.scheduleStrike({
            at: time + 0.18,
            x: projectile.x,
            z: projectile.z,
            radius: projectile.radius * 1.8,
            damage: projectile.damage * 1.45,
            faction: projectile.faction,
            ownerId: projectile.ownerId,
            source: 'mass_driver',
            sourceSlot: projectile.sourceSlot,
            intent: 'control',
            telegraph: 'mass_singularity_collapse',
            activationId: projectile.activationId
          });
        }
        p.finishAsyncPhysical(projectile.activationId, projectile.x, projectile.z);
        continue;
      }

      // A Returner is one physical actor. Outward, carousel and return legs share one lineage.
      if (
        projectile.behavior === 'returner' &&
        (projectile.phase ?? 0) === 0 &&
        projectile.returnAt !== undefined &&
        projectile.ttl <= projectile.returnAt
      ) {
        projectile.hitIds = [];
        if (projectile.faction === 'hero' && projectile.activationId) {
          p.queuePhysicalEvent({
            activationId: projectile.activationId,
            slot: projectile.sourceSlot,
            skill: projectile.source,
            kind: 'terminal',
            x: projectile.x,
            z: projectile.z,
            radius: projectile.radius,
            carrierKind: 'projectile',
            carrierId: projectile.id
          });
        }
        if (projectile.carousel) {
          const velocity = Math.hypot(projectile.vx, projectile.vz) || 1;
          projectile.phase = 1;
          projectile.phaseAt = time + 0.72;
          projectile.orbitX = projectile.x - (projectile.vx / velocity) * 1.25;
          projectile.orbitZ = projectile.z - (projectile.vz / velocity) * 1.25;
        } else {
          projectile.phase = 2;
        }
      }

      if (projectile.behavior === 'returner' && (projectile.phase ?? 0) === 1) {
        if (projectile.phaseAt !== undefined && time >= projectile.phaseAt) {
          projectile.phase = 2;
          projectile.hitIds = [];
        } else {
          const orbitX = projectile.orbitX ?? projectile.x;
          const orbitZ = projectile.orbitZ ?? projectile.z;
          const rx = projectile.x - orbitX;
          const rz = projectile.z - orbitZ;
          const radius = Math.hypot(rx, rz) || 1;
          const speed = Math.max(5.2, Math.hypot(projectile.vx, projectile.vz));
          projectile.vx =
            (-rz / radius) * speed + (orbitX + (rx / radius) * 1.25 - projectile.x) * 2.2;
          projectile.vz =
            (rx / radius) * speed + (orbitZ + (rz / radius) * 1.25 - projectile.z) * 2.2;
        }
      }

      if (projectile.behavior === 'returner' && (projectile.phase ?? 0) === 2) {
        const owner = p.projectileOwner(projectile);
        const homeX = projectile.faction === 'hero' ? p.heroX() : (owner?.x ?? projectile.x);
        const homeZ = projectile.faction === 'hero' ? p.heroZ() : (owner?.z ?? projectile.z);
        const dx = homeX - projectile.x;
        const dz = homeZ - projectile.z;
        const distance = Math.hypot(dx, dz) || 1;
        const speed = Math.max(5.2, Math.hypot(projectile.vx, projectile.vz));
        projectile.vx = (dx / distance) * speed;
        projectile.vz = (dz / distance) * speed;
        if (distance < 0.5) {
          p.finishAsyncPhysical(projectile.activationId, projectile.x, projectile.z);
          continue;
        }
      }

      if (projectile.apotheosis === 'returner_phoenix') {
        projectile.trailAcc = (projectile.trailAcc ?? 0) + dt;
        if (projectile.trailAcc >= 0.14) {
          projectile.trailAcc -= 0.14;
          p.addField({
            activationId: projectile.activationId,
            insideIds: [],
            x: projectile.x,
            z: projectile.z,
            radius: 0.46,
            ttl: 1.35,
            kind: 'fire',
            dps: projectile.damage * 0.24,
            tickAcc: 0,
            faction: projectile.faction,
            ownerId: projectile.ownerId,
            source: 'shard_fan',
            sourceSlot: projectile.sourceSlot,
            mutation: projectile.mutation,
            rivalConcentration: projectile.rivalConcentration
          });
        }
      }

      if (projectile.behavior === 'roller' && projectile.growth)
        projectile.radius = Math.min(2.2, projectile.radius + projectile.growth * dt);

      const x0 = projectile.x;
      const z0 = projectile.z;
      const x1 = x0 + projectile.vx * dt;
      const z1 = z0 + projectile.vz * dt;

      if (projectile.faction === 'rival' && !projectile.guarded) {
        if (p.hasMutation('orbit_blades', 'orbit_guard')) {
          const guardT = sweepCircleT(x0, z0, x1, z1, p.heroX(), p.heroZ(), 2.55);
          if (guardT !== null) {
            if (p.hasMutation('orbit_blades', 'orbit_aegis_crown')) {
              projectile.faction = 'hero';
              projectile.ownerId = 0;
              projectile.vx *= -1.1;
              projectile.vz *= -1.1;
              projectile.damage *= 0.82;
              projectile.source = 'orbit_blades';
              projectile.phase = 1;
              projectile.hitIds = [];
              p.gainAegisCharge();
              p.emitReaction('aegis', projectile.x, projectile.z, projectile.damage);
            } else {
              projectile.damage *= 0.35;
            }
            projectile.guarded = true;
          }
        }
      }

      let cover: Obstacle | null = null;
      let coverT = Infinity;
      const midX = (x0 + x1) * 0.5;
      const midZ = (z0 + z1) * 0.5;
      const reach = Math.hypot(x1 - x0, z1 - z0) * 0.5 + projectile.radius + 3.2;
      for (const obstacle of p.obstaclesNear(midX, midZ, reach)) {
        const t = sweepCircleT(
          x0,
          z0,
          x1,
          z1,
          obstacle.x,
          obstacle.z,
          obstacle.radius + projectile.radius
        );
        if (t !== null && t < coverT) {
          cover = obstacle;
          coverT = t;
        }
      }

      let target: Ent | null = null;
      let targetT = Infinity;
      for (const entity of p.targetsFor(projectile, x0, z0)) {
        if (entity.hp <= 0 || (projectile.hitIds ?? []).includes(entity.id)) continue;
        const t = sweepCircleT(
          x0,
          z0,
          x1,
          z1,
          entity.x,
          entity.z,
          entity.radius + projectile.radius
        );
        if (t !== null && t < targetT) {
          target = entity;
          targetT = t;
        }
      }

      if (cover && coverT <= targetT) {
        projectile.x = x0 + (x1 - x0) * coverT;
        projectile.z = z0 + (z1 - z0) * coverT;
        pathEvent(projectile, x0, z0, projectile.x, projectile.z);
        contactEvent(projectile);
        const destroyed = p.damageObstacle(cover, projectile.coverDamage);
        if (projectile.behavior === 'roller' && destroyed) {
          projectile.damage *= 1.06;
          projectile.radius = Math.min(2.2, projectile.radius + 0.09);
          pathEvent(projectile, projectile.x, projectile.z, x1, z1);
          projectile.x = x1;
          projectile.z = z1;
          alive.push(projectile);
        } else {
          p.finishAsyncPhysical(projectile.activationId, projectile.x, projectile.z);
        }
        continue;
      }

      if (target) {
        projectile.x = x0 + (x1 - x0) * targetT;
        projectile.z = z0 + (z1 - z0) * targetT;
        pathEvent(projectile, x0, z0, projectile.x, projectile.z);

        if (projectile.faction === 'hero') {
          p.damageTarget(
            target,
            projectile.damage,
            projectile.source,
            projectile.x,
            projectile.z,
            projectile.sourceSlot
          );
          contactEvent(projectile, target);
          if (projectile.source === 'shard_fan' && projectile.mutation === 'fan_burn')
            p.applyFanBurn(target);

          if (projectile.behavior === 'roller') {
            const magnitude = Math.hypot(projectile.vx, projectile.vz) || 1;
            const push = 0.45 + p.forceDoctrine() * 0.08;
            target.x += (projectile.vx / magnitude) * push;
            target.z += (projectile.vz / magnitude) * push;
            target.displacedUntil = time + 0.8;
          }
        } else {
          p.damageHero(
            projectile.damage,
            projectile.source,
            p.projectileOwner(projectile),
            projectile.rivalConcentration
          );
        }

        if (projectile.behavior === 'roller' || projectile.behavior === 'returner') {
          (projectile.hitIds ??= []).push(target.id);
          pathEvent(projectile, projectile.x, projectile.z, x1, z1);
          projectile.x = x1;
          projectile.z = z1;
          if (projectile.behavior === 'roller') projectile.damage *= 1.035;
          alive.push(projectile);
        } else {
          p.finishAsyncPhysical(projectile.activationId, projectile.x, projectile.z);
        }
        continue;
      }

      pathEvent(projectile, x0, z0, x1, z1);
      projectile.x = x1;
      projectile.z = z1;

      if (
        projectile.x < p.world.minX - 1 ||
        projectile.x > p.world.maxX + 1 ||
        projectile.z < p.world.minZ - 1 ||
        projectile.z > p.world.maxZ + 1
      ) {
        p.finishAsyncPhysical(projectile.activationId, projectile.x, projectile.z);
        continue;
      }

      alive.push(projectile);
    }

    return alive;
  }
}
