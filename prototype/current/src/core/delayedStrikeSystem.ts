import { combatShapeIntersectsCircle } from './geometry.js';
import { HERO_HIT_RADIUS, type DelayedStrike, type Ent, type Field, type PhysicalEvent } from './state.js';
import type { CombatShape, DamageSourceId, SkillId } from './types.js';

export interface DelayedStrikeSystemPort {
  time(): number;
  tick(): number;
  heroX(): number;
  heroZ(): number;

  ownerById(id: number): Ent | null;
  entities(): readonly Ent[];

  emitImpactShape(source: string, intent: DelayedStrike['intent'], shape: CombatShape): void;
  queuePhysicalEvent(event: PhysicalEvent): void;
  damageHero(amount: number, source: DamageSourceId, owner: Ent | null): void;
  damageTarget(
    target: Ent,
    amount: number,
    source: string,
    x: number,
    z: number,
    sourceSlot: number
  ): void;
  addField(field: Omit<Field, 'id'>): void;
  finishAsyncPhysical(activationId: number | undefined, x: number, z: number): void;
}

/**
 * Runtime owner for telegraphed delayed impacts.
 *
 * Scheduling stays with casting/AI. This system resolves the physical impact at its authored time,
 * emits Catalyst impact lineage, applies damage/fields and retires async activation ownership.
 */
export class DelayedStrikeSystem {
  constructor(private readonly port: DelayedStrikeSystemPort) {}

  update(strikes: DelayedStrike[]): DelayedStrike[] {
    if (!strikes.length) return strikes;

    const p = this.port;
    const keep: DelayedStrike[] = [];

    for (const strike of strikes) {
      if (p.time() + 1e-9 < strike.at) {
        keep.push(strike);
        continue;
      }

      const impactShape: CombatShape = {
        kind: 'circle',
        x: strike.x,
        z: strike.z,
        radius: strike.radius
      };

      p.emitImpactShape(String(strike.source) + '_impact', strike.intent, impactShape);

      if (strike.faction === 'hero' && strike.activationId) {
        const areaPoints = [0, 1, 2, 3].map((index) => {
          const angle = index * Math.PI / 2;
          return {
            x: strike.x + Math.cos(angle) * strike.radius,
            z: strike.z + Math.sin(angle) * strike.radius
          };
        });

        // Physical impact exists only when the delayed strike actually lands.
        p.queuePhysicalEvent({
          activationId: strike.activationId,
          slot: strike.sourceSlot,
          skill: strike.source as SkillId,
          kind: 'impact',
          x: strike.x,
          z: strike.z,
          radius: strike.radius,
          areaPoints,
          shape: { ...impactShape },
          carrierKind: 'impact',
          carrierId: strike.id
        });
      }

      const owner = strike.ownerId ? p.ownerById(strike.ownerId) : null;

      if (strike.faction === 'rival') {
        if (
          combatShapeIntersectsCircle(
            impactShape,
            p.heroX(),
            p.heroZ(),
            HERO_HIT_RADIUS
          )
        ) {
          p.damageHero(
            strike.damage,
            strike.source as DamageSourceId,
            owner
          );
        }
      } else {
        for (const entity of p.entities()) {
          if (
            entity.hp <= 0 ||
            !combatShapeIntersectsCircle(
              impactShape,
              entity.x,
              entity.z,
              entity.radius
            )
          )
            continue;

          p.damageTarget(
            entity,
            strike.damage,
            String(strike.source),
            strike.x,
            strike.z,
            strike.sourceSlot
          );
        }
      }

      if (strike.fieldKind) {
        p.addField({
          activationId: strike.activationId,
          insideIds: [],
          x: strike.x,
          z: strike.z,
          radius: strike.radius * 0.92,
          ttl: strike.fieldDuration ?? 2.5,
          kind: strike.fieldKind,
          dps: strike.fieldDps ?? strike.damage * 0.18,
          tickAcc: 0,
          faction: strike.faction,
          ownerId: strike.ownerId,
          source: String(strike.source),
          sourceSlot: strike.sourceSlot,
          mutation: null,
          rivalConcentration: 1,
          behavior: strike.fieldBehavior
        });
      }

      p.finishAsyncPhysical(strike.activationId, strike.x, strike.z);
    }

    return keep;
  }
}
