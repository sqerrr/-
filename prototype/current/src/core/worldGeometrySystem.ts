import { sweepCircleT } from './geometry.js';
import type { Obstacle, Poi } from './state.js';

export interface WorldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface WorldGeometryPort {
  worldRandomRange(min: number, max: number): number;
  worldRandomInt(maxExclusive: number): number;
  spawnRandomRange(min: number, max: number): number;
  playerX(): number;
  playerZ(): number;
}

/**
 * Owns static arena cover, its spatial grid and cover-aware geometry queries.
 *
 * Gameplay systems keep using thin Simulation seams, while cover generation/destruction,
 * collision resolution, LOS and spawn placement share one spatial owner.
 */
export class WorldGeometrySystem {
  static readonly OBSTACLE_CELL = 8;

  private obstacles: Obstacle[] = [];
  private grid = new Map<number, Obstacle[]>();
  private scratch: Obstacle[] = [];

  constructor(
    readonly world: WorldBounds,
    private readonly port: WorldGeometryPort
  ) {}

  get all(): Obstacle[] {
    return this.obstacles;
  }

  replace(obstacles: Obstacle[]) {
    this.obstacles = obstacles;
    this.rebuild();
  }

  initialize(pois: readonly Poi[]) {
    this.obstacles = [];

    // Keep the opening and every point of interest approachable.
    const safe = [{ x: 0, z: 0, r: 11 }].concat(
      pois.map((poi) => ({ x: poi.x, z: poi.z, r: 5.5 }))
    );

    let id = 1;
    for (let cluster = 0; cluster < 11; cluster++) {
      for (let attempt = 0; attempt < 30; attempt++) {
        const cx = this.port.worldRandomRange(this.world.minX + 7, this.world.maxX - 7);
        const cz = this.port.worldRandomRange(this.world.minZ + 7, this.world.maxZ - 7);

        if (safe.some((value) => Math.hypot(cx - value.x, cz - value.z) < value.r + 4))
          continue;

        // Islands stay apart so lanes between them never close into corridors.
        if (this.obstacles.some((obstacle) => Math.hypot(cx - obstacle.x, cz - obstacle.z) < 11))
          continue;

        const count = 2 + this.port.worldRandomInt(3);
        for (let index = 0; index < count; index++) {
          const angle = this.port.worldRandomRange(0, Math.PI * 2);
          const distance = this.port.worldRandomRange(0, 2.6);
          const radius = this.port.worldRandomRange(1.5, 3);
          const obstacleId = id++;

          // Stable by id rather than another RNG pull: durability must not reshuffle the
          // calibrated arena. Roughly half the island pieces can be opened by sustained fire.
          const destructible = obstacleId % 2 === 0;
          const maxHp = destructible ? 72 + radius * 48 : -1;

          this.obstacles.push({
            id: obstacleId,
            x: cx + Math.cos(angle) * distance,
            z: cz + Math.sin(angle) * distance,
            radius,
            hp: maxHp,
            maxHp,
            destructible
          });
        }
        break;
      }
    }

    this.rebuild();
  }

  rebuild() {
    this.grid.clear();
    const cell = WorldGeometrySystem.OBSTACLE_CELL;

    for (const obstacle of this.obstacles) {
      const x0 = Math.floor((obstacle.x - obstacle.radius) / cell);
      const x1 = Math.floor((obstacle.x + obstacle.radius) / cell);
      const z0 = Math.floor((obstacle.z - obstacle.radius) / cell);
      const z1 = Math.floor((obstacle.z + obstacle.radius) / cell);

      for (let gx = x0; gx <= x1; gx++) {
        for (let gz = z0; gz <= z1; gz++) {
          const key = this.cellKey(gx, gz);
          const bucket = this.grid.get(key);
          if (bucket) bucket.push(obstacle);
          else this.grid.set(key, [obstacle]);
        }
      }
    }
  }

  near(x: number, z: number, radius: number, out: Obstacle[] = []) {
    out.length = 0;
    const cell = WorldGeometrySystem.OBSTACLE_CELL;
    const x0 = Math.floor((x - radius) / cell);
    const x1 = Math.floor((x + radius) / cell);
    const z0 = Math.floor((z - radius) / cell);
    const z1 = Math.floor((z + radius) / cell);

    for (let gx = x0; gx <= x1; gx++) {
      for (let gz = z0; gz <= z1; gz++) {
        const bucket = this.grid.get(this.cellKey(gx, gz));
        if (!bucket) continue;
        for (const obstacle of bucket)
          if (out.indexOf(obstacle) < 0) out.push(obstacle);
      }
    }

    return out;
  }

  blocked(x: number, z: number, radius: number) {
    for (const obstacle of this.near(x, z, radius, this.scratch))
      if (Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.radius + radius)
        return true;
    return false;
  }

  freeOf(x: number, z: number, radius: number) {
    for (let pass = 0; pass < 2; pass++) {
      const near = this.near(x, z, radius, this.scratch);
      let moved = false;

      for (const obstacle of near) {
        const dx = x - obstacle.x;
        const dz = z - obstacle.z;
        const minimum = obstacle.radius + radius;
        const distance = Math.hypot(dx, dz);
        if (distance >= minimum) continue;

        moved = true;
        if (distance < 1e-4) {
          x = obstacle.x + minimum;
          continue;
        }

        const scale = (minimum - distance) / distance;
        x += dx * scale;
        z += dz * scale;
      }

      if (!moved) break;
    }

    return { x, z };
  }

  firstBlockingHit(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    padding = 0.08
  ) {
    const midX = (x0 + x1) * 0.5;
    const midZ = (z0 + z1) * 0.5;
    const reach = Math.hypot(x1 - x0, z1 - z0) * 0.5 + 3.4 + padding;

    let best: Obstacle | null = null;
    let bestT = Infinity;

    for (const obstacle of this.near(midX, midZ, reach, this.scratch)) {
      const t = sweepCircleT(
        x0,
        z0,
        x1,
        z1,
        obstacle.x,
        obstacle.z,
        obstacle.radius + padding
      );
      if (t !== null && t > 0.01 && t < 0.99 && t < bestT) {
        best = obstacle;
        bestT = t;
      }
    }

    return best ? { obstacle: best, t: bestT } : null;
  }

  firstBlockingObstacle(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    padding = 0.08
  ) {
    return this.firstBlockingHit(x0, z0, x1, z1, padding)?.obstacle ?? null;
  }

  lineOfSight(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    padding = 0.08
  ) {
    return !this.firstBlockingHit(x0, z0, x1, z1, padding);
  }

  damageObstacle(obstacle: Obstacle, amount: number) {
    if (!obstacle.destructible || obstacle.hp <= 0) return false;

    obstacle.hp -= Math.max(0, amount);
    if (obstacle.hp > 0) return false;

    const index = this.obstacles.indexOf(obstacle);
    if (index >= 0) this.obstacles.splice(index, 1);
    this.rebuild();
    return true;
  }

  pointAroundPlayer(min = 13, max = 19) {
    const px = this.port.playerX();
    const pz = this.port.playerZ();

    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = this.port.spawnRandomRange(0, Math.PI * 2);
      const radius = this.port.spawnRandomRange(min, max);
      const x = px + Math.cos(angle) * radius;
      const z = pz + Math.sin(angle) * radius;

      if (
        x > this.world.minX + 1 &&
        x < this.world.maxX - 1 &&
        z > this.world.minZ + 1 &&
        z < this.world.maxZ - 1 &&
        !this.blocked(x, z, 0.9)
      )
        return { x, z };
    }

    const angle = this.port.spawnRandomRange(0, Math.PI * 2);
    const radius = min;
    return {
      x: Math.max(
        this.world.minX + 1,
        Math.min(this.world.maxX - 1, px + Math.cos(angle) * radius)
      ),
      z: Math.max(
        this.world.minZ + 1,
        Math.min(this.world.maxZ - 1, pz + Math.sin(angle) * radius)
      )
    };
  }

  private cellKey(cx: number, cz: number) {
    return (cx + 512) * 4096 + (cz + 512);
  }
}
