import { combatShapeIntersectsCircle } from './geometry.js';
import { HERO_HIT_RADIUS, type Ent, type Field, type PhysicalEvent } from './state.js';
import type { DamageSourceId, SkillId } from './types.js';

export interface FieldSystemPort {
  dt(): number;
  time(): number;
  heroX(): number;
  heroZ(): number;

  ownerById(id: number): Ent | null;
  bestAlive(compare: (a: Ent, b: Ent) => number): Ent | undefined;
  entities(): readonly Ent[];

  hitPlayer(amount: number, owner: Ent | null): void;
  damageHero(amount: number, source: DamageSourceId, owner: Ent | null, concentration: number): void;
  damageTarget(
    target: Ent,
    amount: number,
    source: string,
    x: number,
    z: number,
    sourceSlot: number
  ): void;

  memoryFactor(): number;
  queuePhysicalEvent(event: PhysicalEvent): void;
}

/**
 * Runtime lifecycle for persistent field actors.
 *
 * Field creation remains with Phenomenon/enemy behavior. This system owns field motion,
 * pull/control, periodic damage/status effects, and edge-triggered Catalyst contact lineage.
 */
export class FieldSystem {
  constructor(private readonly port: FieldSystemPort) {}

  update(fields: Field[]): Field[] {
    if (!fields.length) return fields;

    const p = this.port;
    const dt = p.dt();
    const time = p.time();
    const heroX = p.heroX();
    const heroZ = p.heroZ();
    const alive: Field[] = [];

    for (const field of fields) {
      field.ttl -= dt;
      if (field.ttl <= 0) continue;
      field.tickAcc += dt;

      const compatibilityRival = field.kind === 'ink' || field.kind === 'architect';
      const faction = field.faction ?? (compatibilityRival ? 'rival' : 'hero');
      const owner = field.ownerId ? p.ownerById(field.ownerId) : null;

      if (field.behavior === 'host' && field.faction === 'hero') {
        const target = p.bestAlive((a, b) => {
          const eliteOrder = Number(b.kind === 'elite') - Number(a.kind === 'elite');
          if (eliteOrder) return eliteOrder;
          const adx = a.x - field.x;
          const adz = a.z - field.z;
          const bdx = b.x - field.x;
          const bdz = b.z - field.z;
          return adx * adx + adz * adz - (bdx * bdx + bdz * bdz);
        });
        if (target) {
          const dx = target.x - field.x;
          const dz = target.z - field.z;
          const distance = Math.hypot(dx, dz) || 1;
          field.x += (dx / distance) * 1.75 * dt;
          field.z += (dz / distance) * 1.75 * dt;
        }
      }

      const shape = { kind: 'circle' as const, x: field.x, z: field.z, radius: field.radius };

      if (field.behavior === 'pull' && faction === 'hero') {
        for (const entity of p.entities()) {
          if (entity.hp <= 0 || !combatShapeIntersectsCircle(shape, entity.x, entity.z, entity.radius))
            continue;
          const dx = field.x - entity.x;
          const dz = field.z - entity.z;
          const distance = Math.hypot(dx, dz) || 1;
          const step = Math.min(distance * 0.3, 1.15 * dt);
          if (distance > 0.03) {
            entity.x += (dx / distance) * step;
            entity.z += (dz / distance) * step;
            entity.displacedUntil = Math.max(entity.displacedUntil, time + 0.18);
          }
        }
      }

      if (field.kind === 'ink' || field.kind === 'architect') {
        if (combatShapeIntersectsCircle(shape, heroX, heroZ, HERO_HIT_RADIUS))
          p.hitPlayer(field.dps * dt, owner);
      } else if (field.kind !== 'index' && field.kind !== 'veil' && field.tickAcc >= 0.25) {
        field.tickAcc -= 0.25;

        if (faction === 'rival') {
          if (combatShapeIntersectsCircle(shape, heroX, heroZ, HERO_HIT_RADIUS)) {
            p.damageHero(
              field.dps * 0.25,
              (field.source ?? (field.kind + '_field')) as DamageSourceId,
              owner,
              field.rivalConcentration ?? 1
            );
          }
        } else {
          for (const entity of p.entities()) {
            if (entity.hp <= 0 || !combatShapeIntersectsCircle(shape, entity.x, entity.z, entity.radius))
              continue;

            if (field.kind === 'frost')
              entity.chillUntil = Math.max(entity.chillUntil, time + 1.2 * p.memoryFactor());
            if (field.kind === 'fire')
              entity.igniteUntil = Math.max(entity.igniteUntil, time + 1.8 * p.memoryFactor());
            if (field.kind === 'toxic') {
              entity.toxinUntil = Math.max(entity.toxinUntil, time + 2.5 * p.memoryFactor());
              entity.toxinDps = Math.max(entity.toxinDps, field.dps * 0.55);
            }

            let fieldHit = field.dps * 0.25;
            if (field.kind === 'toxic' && field.mutation === 'toxic_corrosive') {
              const protectedTarget =
                !!entity.linkedTo ||
                entity.affix === 'shielded' ||
                p.entities().some(
                  (other) =>
                    other.kind === 'elite' &&
                    other.chassis === 'bulwark' &&
                    other.hp > 0 &&
                    Math.hypot(other.x - entity.x, other.z - entity.z) < 6.5
                );
              if (protectedTarget) fieldHit *= 1.65;
            }

            p.damageTarget(
              entity,
              fieldHit,
              field.kind === 'arc'
                ? 'arc_field'
                : field.kind === 'toxic'
                  ? 'toxic_mist'
                  : 'fire_field',
              field.x,
              field.z,
              field.sourceSlot ?? -1
            );
          }
        }
      }

      // Contact is edge-triggered independently from the 250 ms damage cadence.
      if (
        faction === 'hero' &&
        field.activationId &&
        field.source &&
        field.sourceSlot !== undefined
      ) {
        const previous = new Set(field.insideIds ?? []);
        const inside: number[] = [];

        for (const entity of p.entities()) {
          if (entity.hp <= 0 || !combatShapeIntersectsCircle(shape, entity.x, entity.z, entity.radius))
            continue;

          inside.push(entity.id);
          if (!previous.has(entity.id)) {
            p.queuePhysicalEvent({
              activationId: field.activationId,
              slot: field.sourceSlot,
              skill: field.source as SkillId,
              kind: 'contact',
              x: entity.x,
              z: entity.z,
              radius: field.radius,
              targetId: entity.id
            });
          }
        }

        field.insideIds = inside;
      }

      alive.push(field);
    }

    return alive;
  }
}
