import type { Ent } from './state.js';

export type EntityPredicate = (entity: Ent) => boolean;

/**
 * Stable owner for the live entity roster.
 *
 * The array remains the deterministic iteration order used by Simulation. Identity lookup is
 * indexed, while higher-level queries avoid filter/sort allocations. Spatial acceleration can
 * be added behind this API later without changing gameplay systems.
 */
export class EntityStore {
  private items: Ent[] = [];
  private byId = new Map<number, Ent>();

  get all(): Ent[] {
    return this.items;
  }

  add(entity: Ent) {
    this.items.push(entity);
    this.byId.set(entity.id, entity);
    return entity;
  }

  replace(entities: Ent[]) {
    this.items = entities;
    this.byId.clear();
    for (const entity of entities) this.byId.set(entity.id, entity);
  }

  get(id: number): Ent | undefined {
    return this.byId.get(id);
  }

  getAlive(id: number): Ent | undefined {
    const entity = this.byId.get(id);
    return entity && entity.hp > 0 ? entity : undefined;
  }

  countAlive(predicate?: EntityPredicate) {
    let count = 0;
    for (const entity of this.items)
      if (entity.hp > 0 && (!predicate || predicate(entity))) count++;
    return count;
  }

  nearest(
    x: number,
    z: number,
    predicate?: EntityPredicate,
    maxDistance = Infinity
  ): Ent | undefined {
    let best: Ent | undefined;
    let bestD2 = maxDistance * maxDistance;
    for (const entity of this.items) {
      if (entity.hp <= 0 || (predicate && !predicate(entity))) continue;
      const dx = entity.x - x;
      const dz = entity.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = entity;
      }
    }
    return best;
  }

  bestAlive(compare: (candidate: Ent, best: Ent) => number): Ent | undefined {
    let best: Ent | undefined;
    for (const entity of this.items) {
      if (entity.hp <= 0) continue;
      if (!best || compare(entity, best) < 0) best = entity;
    }
    return best;
  }

  forEachAlive(callback: (entity: Ent) => void) {
    for (const entity of this.items) if (entity.hp > 0) callback(entity);
  }

  diagnostics() {
    return {
      total: this.items.length,
      indexed: this.byId.size,
      alive: this.countAlive()
    };
  }
}
