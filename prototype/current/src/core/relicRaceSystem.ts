import { itemOrder, items } from '../content/items.js';
import type { Ent, Relic } from './state.js';

export interface RelicRacePort {
  readonly world: { minX: number; maxX: number; minZ: number; maxZ: number };

  dt(): number;
  time(): number;
  tick(): number;
  playerX(): number;
  playerZ(): number;
  relicRateMultiplier(): number;

  entities(): readonly Ent[];
  hasEcho(entityId: number): boolean;
  blocked(x: number, z: number, radius: number): boolean;
  steerTo(entity: Ent, x: number, z: number, speed: number, multiplier?: number): void;

  randomFloat(): number;
  randomInt(maxExclusive: number): number;
  nextId(): number;

  onHeroClaim(relic: Relic): void;
  onEliteClaim(entity: Ent, relic: Relic): void;
  emitAppeared(relic: Relic, name: string): void;
}

/**
 * Runtime owner for contested relics on the map.
 *
 * This system owns spawn cadence, ground relic state, claim arbitration and elite movement toward
 * a visible find. Hero/elite item mechanics stay with their progression owners through callbacks.
 */
export class RelicRaceSystem {
  static readonly INTERVAL = 20;
  static readonly HERO_REACH = 1.2;
  static readonly ELITE_REACH = 2.2;
  static readonly MAX_GROUND = 8;

  private relics: Relic[] = [];
  private accumulator = 0;

  constructor(private readonly port: RelicRacePort) {}

  get all(): Relic[] {
    return this.relics;
  }

  replace(relics: Relic[]) {
    this.relics = relics;
  }

  get accumulatorValue() {
    return this.accumulator;
  }

  set accumulatorValue(value: number) {
    this.accumulator = value;
  }

  update() {
    const p = this.port;
    this.accumulator += p.dt();
    const interval = RelicRaceSystem.INTERVAL * p.relicRateMultiplier();

    if (this.relics.length >= RelicRaceSystem.MAX_GROUND) {
      this.accumulator = Math.min(this.accumulator, interval);
    } else if (this.accumulator >= interval) {
      this.accumulator -= interval;
      this.spawn();
    }

    const keep: Relic[] = [];
    for (const relic of this.relics) {
      if (
        Math.hypot(p.playerX() - relic.x, p.playerZ() - relic.z) <
        RelicRaceSystem.HERO_REACH
      ) {
        p.onHeroClaim(relic);
        continue;
      }

      let claimed = false;
      for (const entity of p.entities()) {
        if (entity.kind !== 'elite') continue;
        const reach =
          RelicRaceSystem.ELITE_REACH *
          Math.min(1.8, entity.relicSeekMul ?? 1);

        if (Math.hypot(entity.x - relic.x, entity.z - relic.z) < reach) {
          p.onEliteClaim(entity, relic);
          claimed = true;
          break;
        }
      }

      if (!claimed) keep.push(relic);
    }

    this.relics = keep;
  }

  spawn() {
    const p = this.port;

    for (let attempt = 0; attempt < 24; attempt++) {
      const angle = p.randomFloat() * Math.PI * 2;
      const distance = 14 + p.randomFloat() * 16;
      const x = p.playerX() + Math.cos(angle) * distance;
      const z = p.playerZ() + Math.sin(angle) * distance;

      if (x < p.world.minX + 2 || x > p.world.maxX - 2) continue;
      if (z < p.world.minZ + 2 || z > p.world.maxZ - 2) continue;
      if (p.blocked(x, z, 1.1)) continue;

      const item = itemOrder[p.randomInt(itemOrder.length)];
      const relic: Relic = {
        id: p.nextId(),
        x,
        z,
        item,
        bornAt: p.time()
      };

      this.relics.push(relic);
      p.emitAppeared(relic, items[item].name);
      return relic;
    }

    return null;
  }

  steerElite(entity: Ent, speed: number, playerDistance: number) {
    const p = this.port;

    if (
      entity.state !== 'normal' ||
      entity.eliteAction ||
      p.hasEcho(entity.id)
    )
      return false;

    const seek = Math.min(46, 24 * (entity.relicSeekMul ?? 1));
    let best: Relic | null = null;
    let bestDistance = seek;

    for (const relic of this.relics) {
      const distance = Math.hypot(relic.x - entity.x, relic.z - entity.z);
      if (distance < bestDistance) {
        best = relic;
        bestDistance = distance;
      }
    }

    if (!best || bestDistance <= RelicRaceSystem.ELITE_REACH) return false;

    // Immediate melee still has priority over looting.
    if (playerDistance < 3.2 && bestDistance > playerDistance * 0.8) return false;

    p.steerTo(entity, best.x, best.z, speed, 1.24);
    return true;
  }
}
