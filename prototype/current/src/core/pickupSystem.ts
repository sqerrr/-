import type { Pickup } from './state.js';

export interface PickupSystemPort {
  dt(): number;
  playerX(): number;
  playerZ(): number;
  pickupRadius(): number;
  nextId(): number;
  grantXp(amount: number): void;
  grantEliteCore(amount: number): void;
  grantMutationCore(amount: number): number;
  healPlayer(amount: number): void;
  noteHealPickup(): void;
  emitMutationCore(pickup: Pickup, total: number): void;
}

/**
 * Owns collectible pickup state and lifecycle.
 *
 * Death resolution only creates pickups; this system owns their runtime storage, attraction,
 * collection threshold and routing into the run economy.
 */
export class PickupSystem {
  static readonly COLLECT_RADIUS = 0.42;
  static readonly BASE_ATTRACTION_SPEED = 5.5;
  static readonly ATTRACTION_GAIN = 2.4;

  private pickups: Pickup[] = [];

  constructor(private readonly port: PickupSystemPort) {}

  get all(): Pickup[] {
    return this.pickups;
  }

  replace(pickups: Pickup[]) {
    this.pickups = pickups;
  }

  add(pickup: Omit<Pickup, 'id'>) {
    const created: Pickup = { id: this.port.nextId(), ...pickup };
    this.pickups.push(created);
    return created;
  }

  update() {
    const p = this.port;
    const alive: Pickup[] = [];

    for (const pickup of this.pickups) {
      const dx = p.playerX() - pickup.x;
      const dz = p.playerZ() - pickup.z;
      const distance = Math.hypot(dx, dz);

      if (distance > 1e-6 && distance < p.pickupRadius()) {
        const speed =
          PickupSystem.BASE_ATTRACTION_SPEED +
          Math.max(0, p.pickupRadius() - distance) * PickupSystem.ATTRACTION_GAIN;
        pickup.x += (dx / distance) * speed * p.dt();
        pickup.z += (dz / distance) * speed * p.dt();
      }

      // Preserve the historical cadence: collection is decided from the distance measured
      // before this tick's attraction move.
      if (distance < PickupSystem.COLLECT_RADIUS) {
        if (pickup.kind === 'xp') {
          p.grantXp(pickup.value);
        } else if (pickup.kind === 'core') {
          p.grantEliteCore(pickup.value);
        } else if (pickup.kind === 'mutation') {
          const total = p.grantMutationCore(pickup.value);
          p.emitMutationCore(pickup, total);
        } else {
          p.healPlayer(pickup.value);
          p.noteHealPickup();
        }
        continue;
      }

      alive.push(pickup);
    }

    this.pickups = alive;
  }
}
