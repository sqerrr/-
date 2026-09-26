import { combatShapeIntersectsCircle } from './geometry.js';
import { makeHeroEnt, type CastSource, type Ent, type Field } from './state.js';
import type { CombatShape } from './types.js';

export interface CombatTargetingPort {
  entities(): Ent[];
  fields(): readonly Field[];
  player(): {
    x: number;
    z: number;
    hp: number;
    maxHp: number;
    facingX: number;
    facingZ: number;
  };
  lineOfSight(
    ax: number,
    az: number,
    bx: number,
    bz: number,
    margin?: number
  ): boolean;
}

/**
 * Owns faction-aware target projection and targeting geometry.
 *
 * Hero casts target the live enemy roster. Rival casts target one synthetic hero combatant
 * refreshed from current player state. Visibility, veil occlusion, ray ordering and aim-point
 * selection live here so cast families consume one targeting contract instead of rebuilding it.
 */
export class CombatTargetingSystem {
  private readonly hero = makeHeroEnt();

  constructor(private readonly port: CombatTargetingPort) {}

  targetsFor(source: CastSource): Ent[] {
    if (source.faction === 'hero') return this.port.entities();

    const player = this.port.player();
    this.hero.x = player.x;
    this.hero.z = player.z;
    this.hero.hp = player.hp;
    this.hero.maxHp = player.maxHp;
    this.hero.facingX = player.facingX;
    this.hero.facingZ = player.facingZ;
    return [this.hero];
  }

  bestTarget(
    source: CastSource,
    predicate: (entity: Ent) => boolean,
    compare: (candidate: Ent, best: Ent) => number
  ) {
    let best: Ent | undefined;
    for (const entity of this.targetsFor(source)) {
      if (entity.hp <= 0 || !predicate(entity)) continue;
      if (!best || compare(entity, best) < 0) best = entity;
    }
    return best;
  }

  rayHits(
    source: CastSource,
    aimX: number,
    aimZ: number,
    range: number,
    width: number,
    maxHits = 99
  ) {
    const magnitude = Math.hypot(aimX, aimZ) || 1;
    const nx = aimX / magnitude;
    const nz = aimZ / magnitude;
    const shape: CombatShape = {
      kind: 'ray',
      x: source.x,
      z: source.z,
      aimX: nx,
      aimZ: nz,
      range,
      halfWidth: width
    };
    const hits: { e: Ent; t: number; lat: number }[] = [];

    for (const entity of this.targetsFor(source)) {
      if (
        entity.hp <= 0 ||
        !this.port.lineOfSight(
          source.x,
          source.z,
          entity.x,
          entity.z,
          width * 0.2
        )
      )
        continue;
      if (
        !combatShapeIntersectsCircle(
          shape,
          entity.x,
          entity.z,
          entity.radius
        )
      )
        continue;

      const dx = entity.x - source.x;
      const dz = entity.z - source.z;
      const t = dx * nx + dz * nz;
      const lat = Math.abs(dx * nz - dz * nx);
      hits.push({ e: entity, t, lat });
    }

    hits.sort((a, b) => a.t - b.t);
    return hits.slice(0, maxHits);
  }

  rotatedAim(source: CastSource, radians: number) {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return {
      x: source.aimX * cos - source.aimZ * sin,
      z: source.aimX * sin + source.aimZ * cos
    };
  }

  targetVisible(source: CastSource, entity: Ent) {
    if (
      !this.port.lineOfSight(
        source.x,
        source.z,
        entity.x,
        entity.z,
        0.1
      )
    )
      return false;

    for (const field of this.port.fields()) {
      if (field.kind !== 'veil') continue;
      const inside =
        Math.hypot(entity.x - field.x, entity.z - field.z) < field.radius;
      const observerInside =
        Math.hypot(source.x - field.x, source.z - field.z) < field.radius;

      if (
        inside &&
        !observerInside &&
        Math.hypot(entity.x - source.x, entity.z - source.z) > 3.6
      )
        return false;
    }

    return true;
  }

  aimPoint(source: CastSource, range: number) {
    let best: Ent | undefined;
    let bestScore = 999;

    for (const entity of this.targetsFor(source)) {
      if (entity.hp <= 0 || !this.targetVisible(source, entity)) continue;

      const dx = entity.x - source.x;
      const dz = entity.z - source.z;
      const distance = Math.hypot(dx, dz);
      if (distance > range || distance < 2) continue;

      const dot =
        (dx / distance) * source.aimX +
        (dz / distance) * source.aimZ;
      if (dot < 0.45) continue;

      const lateral = Math.abs(dx * source.aimZ - dz * source.aimX);
      const score = lateral * 0.9 + distance * 0.04;
      if (score < bestScore) {
        bestScore = score;
        best = entity;
      }
    }

    return best
      ? { x: best.x, z: best.z }
      : {
          x: source.x + source.aimX * range * 0.72,
          z: source.z + source.aimZ * range * 0.72
        };
  }
}
