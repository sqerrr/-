import type { Ent } from './state.js';

export interface EnemyRuntimePort {
  dt(): number;
  time(): number;
  playerX(): number;
  playerZ(): number;
  entities(): readonly Ent[];
  earlyAffixTick(entity: Ent): void;
  beforeAffixBehavior(
    entity: Ent,
    playerDistance: number
  ): { skipBehavior: boolean; speedMultiplier: number };
  updateNormal(
    entity: Ent,
    speed: number,
    playerDistance: number,
    nx: number,
    nz: number
  ): void;
  steerEliteToRelic(entity: Ent, speed: number, playerDistance: number): boolean;
  updateElite(
    entity: Ent,
    speed: number,
    playerDistance: number,
    nx: number,
    nz: number
  ): void;
  updateBoss(
    entity: Ent,
    speed: number,
    playerDistance: number,
    nx: number,
    nz: number
  ): void;
  hitPlayer(amount: number, attacker: Ent): void;
}

/**
 * Owns the per-tick enemy runtime pipeline shared by normal mobs, elites and the boss.
 *
 * Chassis/affix systems still own their authored behavior. This layer owns the order around
 * them: timer decay, facing, status/buff speed modifiers, affix pre-pass, behavior dispatch
 * and final contact damage.
 */
export class EnemyRuntimeSystem {
  constructor(private readonly port: EnemyRuntimePort) {}

  update() {
    const p = this.port;
    const dt = p.dt();
    const time = p.time();

    for (const entity of p.entities()) {
      if (entity.hp <= 0) continue;

      entity.cooldown -= dt;
      entity.linkTimer -= dt;
      entity.stateTimer -= dt;
      entity.affixTimer += dt;
      entity.affixPulse -= dt;
      entity.adaptCooldown -= dt;

      p.earlyAffixTick(entity);

      let dx = p.playerX() - entity.x;
      let dz = p.playerZ() - entity.z;
      let distance = Math.hypot(dx, dz) || 1;
      const nx = dx / distance;
      const nz = dz / distance;
      entity.facingX = nx;
      entity.facingZ = nz;

      let speed =
        entity.speed *
        ((entity.frozenUntil ?? 0) > time
          ? entity.kind === 'elite'
            ? 0.45
            : 0.08
          : entity.chillUntil > time
            ? entity.kind === 'elite'
              ? 0.88
              : 0.72
            : 1) *
        (entity.buffUntil > time ? 1.32 : 1);

      const affix = p.beforeAffixBehavior(entity, distance);
      if (affix.skipBehavior) continue;
      speed *= affix.speedMultiplier;

      if (entity.kind !== 'elite') {
        p.updateNormal(entity, speed, distance, nx, nz);
      } else if (
        !entity.boss &&
        p.steerEliteToRelic(entity, speed, distance)
      ) {
        // Looting is a temporary tactical job. Contact damage below still applies
        // when the hero intercepts the elite.
      } else if (entity.boss) {
        p.updateBoss(entity, speed, distance, nx, nz);
      } else {
        p.updateElite(entity, speed, distance, nx, nz);
      }

      dx = p.playerX() - entity.x;
      dz = p.playerZ() - entity.z;
      distance = Math.hypot(dx, dz) || 1;
      if (distance < entity.radius + 0.44)
        p.hitPlayer(
          entity.contactDps * (entity.buffUntil > time ? 1.28 : 1) * dt,
          entity
        );
    }
  }
}
