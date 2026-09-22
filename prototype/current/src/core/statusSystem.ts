import type { Ent } from './state.js';

export type StatusId =
  | 'ignite'
  | 'chill'
  | 'wound'
  | 'toxin'
  | 'mark'
  | 'exposed'
  | 'embed'
  | 'displaced';

export interface StatusApplyContext {
  time: number;
  potency?: number;
  memoryFactor: number;
  globalPower: number;
}

/**
 * Owns generic combat-status lifecycle.
 *
 * Authored Phenomena may still have bespoke reactions (freeze meter, thermal shock, etc.),
 * but generic application/consumption and periodic damage no longer live in Simulation.
 */
export class StatusSystem {
  active(entity: Ent, status: StatusId, time: number) {
    switch (status) {
      case 'ignite': return entity.igniteUntil > time;
      case 'chill': return entity.chillUntil > time;
      case 'wound': return entity.woundUntil > time;
      case 'toxin': return entity.toxinUntil > time;
      case 'mark': return entity.markUntil > time;
      case 'exposed': return entity.exposedUntil > time;
      case 'embed': return entity.embedded > 0;
      case 'displaced': return entity.displacedUntil > time;
    }
  }

  consume(entity: Ent, status: StatusId) {
    switch (status) {
      case 'ignite':
        entity.igniteUntil = 0;
        break;
      case 'chill':
        entity.chillUntil = 0;
        break;
      case 'wound':
        entity.woundUntil = 0;
        entity.woundDps = 0;
        break;
      case 'toxin':
        entity.toxinUntil = 0;
        entity.toxinDps = 0;
        break;
      case 'mark':
        entity.markUntil = 0;
        break;
      case 'exposed':
        entity.exposedUntil = 0;
        break;
      case 'embed':
        entity.embedded = Math.max(0, entity.embedded - 1);
        break;
      case 'displaced':
        entity.displacedUntil = 0;
        break;
    }
  }

  apply(entity: Ent, status: string, context: StatusApplyContext) {
    const potency = context.potency ?? 1;
    const duration = 2.6 * Math.max(0.35, potency) * context.memoryFactor;
    switch (status as StatusId) {
      case 'ignite':
        entity.igniteUntil = Math.max(entity.igniteUntil, context.time + duration);
        break;
      case 'chill':
        entity.chillUntil = Math.max(entity.chillUntil, context.time + duration);
        break;
      case 'wound':
        entity.woundUntil = Math.max(entity.woundUntil, context.time + duration * 1.45);
        entity.woundDps = Math.max(entity.woundDps, 7 * potency * (1 + context.globalPower));
        break;
      case 'toxin':
        entity.toxinUntil = Math.max(entity.toxinUntil, context.time + duration * 1.6);
        entity.toxinDps = Math.max(entity.toxinDps, 6 * potency * (1 + context.globalPower));
        break;
      case 'mark':
        entity.markUntil = Math.max(entity.markUntil, context.time + duration * 1.4);
        break;
      case 'exposed':
        entity.exposedUntil = Math.max(entity.exposedUntil, context.time + duration);
        break;
      case 'embed':
        entity.embedded = Math.min(8, entity.embedded + Math.max(1, Math.round(potency)));
        break;
      case 'displaced':
        entity.displacedUntil = Math.max(entity.displacedUntil, context.time + 1.2 * context.memoryFactor);
        break;
    }
  }

  updateDamageOverTime(
    entities: readonly Ent[],
    time: number,
    dt: number,
    damage: (entity: Ent, amount: number, source: 'wound_dot' | 'toxin_dot') => void
  ) {
    for (const entity of entities) {
      if (entity.hp <= 0) continue;
      if (entity.woundUntil > time && entity.woundDps > 0)
        damage(entity, entity.woundDps * dt, 'wound_dot');
      if (entity.hp > 0 && entity.toxinUntil > time && entity.toxinDps > 0)
        damage(entity, entity.toxinDps * dt, 'toxin_dot');
    }
  }

  clearForRevive(entity: Ent) {
    entity.chillUntil = 0;
    entity.woundUntil = 0;
    entity.toxinUntil = 0;
  }
}
