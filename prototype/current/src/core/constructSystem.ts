import { skills } from '../content/definitions.js';
import { closestPointOnSegment, combatShapeIntersectsCircle } from './geometry.js';
import type { Construct, DelayedStrike, Ent, PhysicalEvent } from './state.js';
import type { CombatShape } from './types.js';

export interface ConstructSystemPort {
  dt(): number;
  time(): number;
  heroX(): number;
  heroZ(): number;

  ownerById(id: number): Ent | null;
  entities(): readonly Ent[];
  targetsFor(construct: Construct): readonly Ent[];
  targetVisible(construct: Construct, target: Ent): boolean;

  damageTarget(construct: Construct, target: Ent, amount: number, x: number, z: number): void;
  combatShape(source: string, shape: CombatShape, intent?: 'damage' | 'control' | 'field'): void;
  queuePhysicalEvent(event: PhysicalEvent): void;
  finishAsyncPhysical(activationId: number | undefined, x: number, z: number): void;
  scheduleStrike(strike: Omit<DelayedStrike, 'id'>): void;

  memoryFactor(): number;
  corePower(): number;
  grantBarrier(amount: number): void;
}

/**
 * Runtime owner for persistent construct actors (currently Sentry family).
 *
 * Casting/spawn remains with Phenomenon code. This system owns construct lifetime, autonomous
 * targeting, mutation behavior and coordinated Battery/Grid events.
 */
export class ConstructSystem {
  private batteryAt = 0;
  private gridAcc = 0;

  constructor(private readonly port: ConstructSystemPort) {}

  update(constructs: Construct[]): Construct[] {
    const p = this.port;
    const dt = p.dt();
    const time = p.time();
    const alive: Construct[] = [];

    for (const construct of constructs) {
      construct.ttl -= dt;
      if (construct.ttl <= 0) {
        if (construct.activationId)
          p.finishAsyncPhysical(construct.activationId, construct.x, construct.z);
        continue;
      }

      construct.cooldown -= dt;
      const owner = construct.ownerId ? p.ownerById(construct.ownerId) : null;
      const followX = construct.faction === 'rival' && owner ? owner.x : p.heroX();
      const followZ = construct.faction === 'rival' && owner ? owner.z : p.heroZ();

      if (
        construct.mutation === 'sentry_crawler' ||
        construct.mutationUpgrade === 'sentry_crawler' ||
        construct.mutationApotheosis === 'sentry_walker'
      ) {
        const angle = ((construct.id % 7) / 7) * Math.PI * 2 + time * 0.45;
        const orbitRadius = construct.mutationApotheosis === 'sentry_walker' ? 2.1 : 2.6;
        const desiredX = followX + Math.cos(angle) * orbitRadius;
        const desiredZ = followZ + Math.sin(angle) * orbitRadius;
        const dx = desiredX - construct.x;
        const dz = desiredZ - construct.z;
        const distance = Math.hypot(dx, dz) || 1;
        if (distance > 0.25) {
          const speed = construct.mutationApotheosis === 'sentry_walker' ? 2.6 : 1.65;
          construct.x += (dx / distance) * speed * dt;
          construct.z += (dz / distance) * speed * dt;
        }
      }

      if (construct.cooldown <= 0) {
        let interval =
          construct.mutation === 'sentry_gatling'
            ? 0.3
            : construct.mutation === 'sentry_rail'
              ? 1.1
              : 0.62;
        if (construct.mutationApotheosis === 'sentry_hunter_battery') interval = 1.15;
        construct.cooldown = interval;

        const targets = [...p.targetsFor(construct)].filter(
          (entity) =>
            entity.hp > 0 &&
            p.targetVisible(construct, entity) &&
            Math.hypot(entity.x - construct.x, entity.z - construct.z) <=
              construct.range + entity.radius
        );

        if (
          construct.mutation === 'sentry_rail' ||
          construct.mutationApotheosis === 'sentry_hunter_battery'
        ) {
          targets.sort(
            (a, b) =>
              Number(b.markUntil > time || b.kind === 'elite') -
                Number(a.markUntil > time || a.kind === 'elite') ||
              Math.hypot(a.x - construct.x, a.z - construct.z) -
                Math.hypot(b.x - construct.x, b.z - construct.z)
          );
        } else {
          targets.sort(
            (a, b) =>
              Math.hypot(a.x - construct.x, a.z - construct.z) -
              Math.hypot(b.x - construct.x, b.z - construct.z)
          );
        }

        const target = targets[0];
        if (target) {
          let damage = skills.sentry.baseDamage * construct.power;
          if (construct.mutation === 'sentry_gatling') damage *= 0.52;
          if (construct.mutation === 'sentry_rail') damage *= 1.9;
          if (construct.mutationApotheosis === 'sentry_hunter_battery') damage *= 1.02;
          if (
            construct.mutation === 'sentry_relay' &&
            (target.markUntil > time || target.embedded > 0 || time - target.lastArcAt < 2.2)
          )
            damage *= 1.28;

          const dx = target.x - construct.x;
          const dz = target.z - construct.z;
          const distance = Math.hypot(dx, dz) || 1;
          p.combatShape(
            construct.mutationApotheosis === 'sentry_hunter_battery'
              ? 'sentry_hunter_tracking'
              : 'sentry',
            {
              kind: 'ray',
              x: construct.x,
              z: construct.z,
              aimX: dx / distance,
              aimZ: dz / distance,
              range: distance,
              halfWidth:
                construct.mutationApotheosis === 'sentry_hunter_battery' ? 0.13 : 0.08
            }
          );

          p.damageTarget(construct, target, damage, construct.x, construct.z);

          if (construct.faction === 'hero' && construct.activationId) {
            p.queuePhysicalEvent({
              activationId: construct.activationId,
              slot: construct.sourceSlot,
              skill: 'sentry',
              kind: 'contact',
              x: construct.x,
              z: construct.z,
              carrierKind: 'construct',
              carrierId: construct.id,
              targetId: target.id
            });
          }

          target.sentryTouchedUntil = time + 4;

          if (
            construct.mutationApotheosis === 'sentry_hunter_battery' &&
            construct.faction === 'hero'
          )
            target.markUntil = Math.max(target.markUntil, time + 2.0);

          if (construct.mutation === 'sentry_relay' && construct.faction === 'hero') {
            target.markUntil = Math.max(target.markUntil, time + 2.8 * p.memoryFactor());
            target.lastArcAt = time;
          }

          if (
            construct.mutationApotheosis === 'sentry_walker' &&
            construct.faction === 'hero' &&
            Math.hypot(p.heroX() - construct.x, p.heroZ() - construct.z) < 2.5
          )
            p.grantBarrier(1.4);
        }
      }

      alive.push(construct);
    }

    this.updateHunterBattery(alive);
    this.updateGravityGrid(alive);
    return alive;
  }

  private updateHunterBattery(alive: Construct[]) {
    const p = this.port;
    const time = p.time();
    const battery = alive.filter(
      (construct) =>
        construct.faction === 'hero' &&
        construct.mutationApotheosis === 'sentry_hunter_battery'
    );

    if (!battery.length || time < this.batteryAt) return;

    const candidates = [...p.entities()].filter(
      (entity) =>
        entity.hp > 0 &&
        battery.some(
          (construct) =>
            Math.hypot(entity.x - construct.x, entity.z - construct.z) <=
            construct.range + entity.radius
        )
    );

    candidates.sort(
      (a, b) =>
        Number(b.kind === 'elite') - Number(a.kind === 'elite') ||
        Number(b.markUntil > time) - Number(a.markUntil > time) ||
        Math.hypot(a.x - p.heroX(), a.z - p.heroZ()) -
          Math.hypot(b.x - p.heroX(), b.z - p.heroZ())
    );

    const target = candidates[0];
    if (!target) return;

    this.batteryAt = time + 3.35;
    target.markUntil = Math.max(target.markUntil, time + 2.3);

    let power = 0;
    for (const construct of battery) {
      power += construct.power;
      const dx = target.x - construct.x;
      const dz = target.z - construct.z;
      const distance = Math.hypot(dx, dz) || 1;
      p.combatShape('sentry_battery_tell', {
        kind: 'ray',
        x: construct.x,
        z: construct.z,
        aimX: dx / distance,
        aimZ: dz / distance,
        range: distance,
        halfWidth: 0.11
      });
    }

    const averagePower = power / battery.length;
    p.scheduleStrike({
      at: time + 0.48,
      x: target.x,
      z: target.z,
      radius: 0.82,
      damage: skills.sentry.baseDamage * averagePower * (0.95 + battery.length * 0.38),
      faction: 'hero',
      ownerId: 0,
      source: 'sentry',
      sourceSlot: battery[0].sourceSlot,
      intent: 'damage',
      telegraph: 'sentry_battery_beacon',
      activationId: battery[0].activationId
    });
  }

  private updateGravityGrid(alive: Construct[]) {
    const p = this.port;
    this.gridAcc += p.dt();

    const grid = alive.filter(
      (construct) =>
        construct.faction === 'hero' &&
        construct.mutationApotheosis === 'sentry_gravity_grid'
    );
    if (grid.length < 2 || this.gridAcc < 0.28) return;

    this.gridAcc = 0;
    const links: [Construct, Construct][] = [];
    const seen = new Set<string>();

    for (const a of grid) {
      const near = grid
        .filter((b) => b.id !== a.id)
        .map((b) => ({ b, d: Math.hypot(b.x - a.x, b.z - a.z) }))
        .filter((candidate) => candidate.d <= 6.4)
        .sort((x, y) => x.d - y.d)
        .slice(0, 2);

      for (const candidate of near) {
        const lo = Math.min(a.id, candidate.b.id);
        const hi = Math.max(a.id, candidate.b.id);
        const key = lo + ':' + hi;
        if (!seen.has(key)) {
          seen.add(key);
          links.push([a, candidate.b]);
        }
      }
    }

    for (const [a, b] of links) {
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const length = Math.hypot(dx, dz) || 1;
      const shape: CombatShape = {
        kind: 'ray',
        x: a.x,
        z: a.z,
        aimX: dx / length,
        aimZ: dz / length,
        range: length,
        halfWidth: 0.42
      };

      p.combatShape('sentry_gravity_grid', shape, 'control');

      for (const entity of p.entities()) {
        if (
          entity.hp <= 0 ||
          !combatShapeIntersectsCircle(shape, entity.x, entity.z, entity.radius)
        )
          continue;

        const closest = closestPointOnSegment(entity.x, entity.z, a.x, a.z, b.x, b.z);
        const ddx = closest.x - entity.x;
        const ddz = closest.z - entity.z;
        const distance = Math.hypot(ddx, ddz);

        p.damageTarget(
          a,
          entity,
          skills.sentry.baseDamage * 0.24 * p.corePower(),
          closest.x,
          closest.z
        );

        if (distance > 0.05) {
          entity.x += (ddx / distance) * 0.18;
          entity.z += (ddz / distance) * 0.18;
          entity.displacedUntil = p.time() + 0.45;
        }
      }
    }
  }

  diagnostics() {
    return {
      batteryAt: this.batteryAt,
      gridAcc: this.gridAcc
    };
  }
}
