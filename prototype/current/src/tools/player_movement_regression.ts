import {
  PlayerMovementSystem,
  type PlayerMovementPort
} from '../core/playerMovementSystem.js';
import type { Command, Metrics } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('player-movement-regression: ' + message);
}

const numeric = (value: number): number => value;

let now = 0;
const dt = 1 / 60;
let x = 0;
let z = 0;
let aimX = 1;
let aimZ = 0;
let speed = 6;
let cooldownMul = 1;
let iframeMul = 1;
let encounterDashes = 0;
let clampCalls = 0;
const metrics = { dashes: 0 } as Metrics;

const port: PlayerMovementPort = {
  time: () => now,
  dt: () => dt,
  playerX: () => x,
  playerZ: () => z,
  setPlayerPosition: (nextX, nextZ) => {
    x = nextX;
    z = nextZ;
  },
  aimX: () => aimX,
  aimZ: () => aimZ,
  moveSpeed: () => speed,
  dashCooldownMultiplier: () => cooldownMul,
  dashIFrameMultiplier: () => iframeMul,
  metrics: () => metrics,
  noteEncounterDash: () => { encounterDashes++; },
  clampWorld: () => { clampCalls++; }
};
const movement = new PlayerMovementSystem(port);

const idle: Command = { moveX: 0, moveZ: 0, aimX: 1, aimZ: 0 };
movement.update(idle);
assert(x === 0 && z === 0, 'idle input moved the hero');
assert(movement.vx === 0 && movement.vz === 0, 'idle input left stale velocity');
assert(clampCalls === 0, 'idle input started clamping world position');

// Walking owns velocity and advances position exactly once per tick.
movement.update({ ...idle, moveX: 3, moveZ: 4 });
assert(Math.abs(movement.vx - 3.6) < 1e-9 && Math.abs(movement.vz - 4.8) < 1e-9,
  'walk velocity normalization changed');
assert(Math.abs(x - 3.6 * dt) < 1e-9 && Math.abs(z - 4.8 * dt) < 1e-9,
  'walk integration changed');
assert(clampCalls === 1, 'walking no longer clamps exactly once');

// Dash with no movement input falls back to current aim.
x = 0;
z = 0;
aimX = 0;
aimZ = -1;
now = 1;
iframeMul = 1.25;
cooldownMul = 0.8;
movement.update({ ...idle, dash: true });
assert(numeric(metrics.dashes) === 1 && numeric(encounterDashes) === 1, 'dash start accounting changed');
assert(movement.vx === 0 && movement.vz === -PlayerMovementSystem.DASH_SPEED,
  'zero-input dash stopped using aim direction');
assert(Math.abs(movement.dashUntil - (1 + PlayerMovementSystem.DASH_DURATION)) < 1e-9,
  'dash duration changed');
assert(
  Math.abs(
    movement.dashIFramesUntil -
      (1 + PlayerMovementSystem.DASH_IFRAMES * iframeMul)
  ) < 1e-9,
  'dash iframe multiplier/order changed'
);
assert(
  Math.abs(
    movement.dashReadyAt -
      (movement.dashUntil + PlayerMovementSystem.DASH_COOLDOWN * cooldownMul)
  ) < 1e-9,
  'dash cooldown no longer begins after dash end'
);
assert(movement.dashIFramesUntil < movement.dashUntil,
  'iframe window no longer closes before dash movement');

// Requests during the active dash do not restart the window, but movement continues at dash speed.
const originalDashUntil = movement.dashUntil;
const originalReadyAt = movement.dashReadyAt;
now += dt;
const beforeDashZ = z;
movement.update({ ...idle, moveX: 1, dash: true });
assert(metrics.dashes === 1 && encounterDashes === 1, 'active dash restarted');
assert(numeric(movement.dashUntil) === originalDashUntil &&
       numeric(movement.dashReadyAt) === originalReadyAt,
  'active dash timing was rewritten');
assert(Math.abs(z - (beforeDashZ - PlayerMovementSystem.DASH_SPEED * dt)) < 1e-9,
  'active dash stopped following locked direction');

// Extending iframes may lengthen a protection window but must never shorten it.
const currentIFrames = movement.dashIFramesUntil;
movement.extendIFrames(currentIFrames - 1);
assert(numeric(movement.dashIFramesUntil) === currentIFrames,
  'extendIFrames shortened an existing window');
movement.extendIFrames(currentIFrames + 0.5);
assert(Math.abs(movement.dashIFramesUntil - (currentIFrames + 0.5)) < 1e-9,
  'extendIFrames did not extend the window');

// Once dash movement ends, cooldown still rejects a new request and ordinary movement resumes.
now = originalDashUntil + 0.01;
const dashesBeforeCooldownRequest = metrics.dashes;
movement.update({ ...idle, moveX: 1, dash: true });
assert(metrics.dashes === dashesBeforeCooldownRequest, 'cooldown allowed an early second dash');
assert(Math.abs(movement.vx - speed) < 1e-9 && movement.vz === 0,
  'walking did not resume during dash cooldown');
assert(!movement.isDashing(now) && !movement.isDashReady(now),
  'dash readiness helpers disagree with cooldown state');
assert(movement.dashCharge(now) >= 0 && movement.dashCharge(now) < 1,
  'dash charge left its cooldown range');

// At readiness, a new dash may start and charge reports full readiness.
now = originalReadyAt;
assert(movement.isDashReady(now), 'dash did not become ready at authored readyAt');
assert(Math.abs(movement.dashCharge(now) - 1) < 1e-9,
  'dash charge is not full at readyAt');
movement.update({ ...idle, moveX: 1, dash: true });
assert(numeric(metrics.dashes) === 2 && numeric(encounterDashes) === 2, 'ready dash did not start a second time');

// Static tuning contract remains identical to Simulation-facing constants.
assert(PlayerMovementSystem.DASH_SPEED === 22, 'dash speed changed');
assert(PlayerMovementSystem.DASH_DURATION === 0.18, 'dash duration changed');
assert(PlayerMovementSystem.DASH_IFRAMES === 0.13, 'dash iframe base changed');
assert(PlayerMovementSystem.DASH_COOLDOWN === 1.6, 'dash cooldown base changed');

console.log('player-movement-regression OK', {
  dashes: metrics.dashes,
  encounterDashes,
  position: { x, z },
  dashUntil: movement.dashUntil,
  dashReadyAt: movement.dashReadyAt,
  clampCalls
});
