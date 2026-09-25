import type { Command, Metrics } from './types.js';

export interface PlayerMovementPort {
  time(): number;
  dt(): number;
  playerX(): number;
  playerZ(): number;
  setPlayerPosition(x: number, z: number): void;
  aimX(): number;
  aimZ(): number;
  moveSpeed(): number;
  dashCooldownMultiplier(): number;
  dashIFrameMultiplier(): number;
  metrics(): Metrics;
  noteEncounterDash(time: number): void;
  clampWorld(): void;
}

/**
 * Owns hero locomotion and dash runtime state.
 *
 * World position itself remains Simulation state because every gameplay subsystem consumes it.
 * The movement system owns how input changes that position, plus velocity/cooldown/iframe state.
 */
export class PlayerMovementSystem {
  static readonly DASH_SPEED = 22;
  static readonly DASH_DURATION = 0.18;
  static readonly DASH_IFRAMES = 0.13;
  static readonly DASH_COOLDOWN = 1.6;

  dashUntil = -99;
  dashIFramesUntil = -99;
  dashReadyAt = 0;
  dashWindowSaved = false;
  vx = 0;
  vz = 0;

  private dashDirX = 0;
  private dashDirZ = 0;

  constructor(private readonly port: PlayerMovementPort) {}

  update(command: Command) {
    const p = this.port;
    const magnitude = Math.hypot(command.moveX, command.moveZ);

    this.vx = 0;
    this.vz = 0;

    if (
      command.dash &&
      p.time() >= this.dashUntil &&
      p.time() >= this.dashReadyAt
    ) {
      let dx = command.moveX;
      let dz = command.moveZ;
      let directionMagnitude = Math.hypot(dx, dz);

      if (directionMagnitude <= 0.001) {
        dx = p.aimX();
        dz = p.aimZ();
        directionMagnitude = 1;
      }

      this.dashDirX = dx / directionMagnitude;
      this.dashDirZ = dz / directionMagnitude;
      this.dashUntil = p.time() + PlayerMovementSystem.DASH_DURATION;
      this.dashIFramesUntil =
        p.time() +
        PlayerMovementSystem.DASH_IFRAMES * p.dashIFrameMultiplier();
      this.dashReadyAt =
        this.dashUntil +
        PlayerMovementSystem.DASH_COOLDOWN * p.dashCooldownMultiplier();
      this.dashWindowSaved = false;
      p.metrics().dashes++;
      p.noteEncounterDash(p.time());
    }

    let x = p.playerX();
    let z = p.playerZ();

    if (p.time() < this.dashUntil) {
      this.vx = this.dashDirX * PlayerMovementSystem.DASH_SPEED;
      this.vz = this.dashDirZ * PlayerMovementSystem.DASH_SPEED;
      x += this.vx * p.dt();
      z += this.vz * p.dt();
    } else if (magnitude > 0.001) {
      this.vx = (command.moveX / magnitude) * p.moveSpeed();
      this.vz = (command.moveZ / magnitude) * p.moveSpeed();
      x += this.vx * p.dt();
      z += this.vz * p.dt();
    }

    p.setPlayerPosition(x, z);
    p.clampWorld();
  }

  extendIFrames(until: number) {
    this.dashIFramesUntil = Math.max(this.dashIFramesUntil, until);
  }

  isDashing(time: number) {
    return time < this.dashUntil;
  }

  isDashReady(time: number) {
    return time >= this.dashReadyAt && time >= this.dashUntil;
  }

  dashCharge(time: number) {
    return Math.max(
      0,
      Math.min(
        1,
        1 -
          (this.dashReadyAt - time) /
            Math.max(0.0001, PlayerMovementSystem.DASH_COOLDOWN)
      )
    );
  }
}
