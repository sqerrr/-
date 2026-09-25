import {
  EnemyRecycleSystem,
  type EnemyRecyclePort
} from '../core/enemyRecycleSystem.js';
import { makeEnt, type Ent } from '../core/state.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('enemy-recycle-regression: ' + message);
}

let dt = 0.1;
let px = 0;
let pz = 0;
const entities: Ent[] = [];
const pointCalls: [number, number][] = [];
const reacquired: number[] = [];

const port: EnemyRecyclePort = {
  dt: () => dt,
  playerX: () => px,
  playerZ: () => pz,
  entities: () => entities,
  pointAroundPlayer: (min, max) => {
    pointCalls.push([min, max]);
    return { x: min, z: -max };
  },
  emitEliteReacquired: (entity) => reacquired.push(entity.id)
};
const system = new EnemyRecycleSystem(port);

const normal = makeEnt({
  id: 1,
  kind: 'footnote',
  x: 35,
  z: 0,
  hp: 100,
  maxHp: 100,
  radius: 0.4,
  speed: 1,
  contactDps: 0
});
normal.orderUntil = 9;
normal.state = 'dash';
normal.stateTimer = 2;

const elite = makeEnt({
  id: 2,
  kind: 'elite',
  x: 34,
  z: 0,
  hp: 1000,
  maxHp: 1000,
  radius: 1,
  speed: 1,
  contactDps: 0,
  chassis: 'hunter'
});
elite.state = 'dash';
elite.stateTimer = 2;
elite.adaptStage = 4;

const boss = makeEnt({
  id: 3,
  kind: 'elite',
  x: 39,
  z: 0,
  hp: 1000,
  maxHp: 1000,
  radius: 1,
  speed: 1,
  contactDps: 0,
  chassis: 'warden',
  boss: true
});

const dead = makeEnt({
  id: 4,
  kind: 'footnote',
  x: 50,
  z: 0,
  hp: 0,
  maxHp: 100,
  radius: 0.4,
  speed: 1,
  contactDps: 0
});
entities.push(normal, elite, boss, dead);

// Cadence is 0.35 s; no actor moves before the threshold.
system.update();
system.update();
system.update();
assert(normal.x === 35 && elite.x === 34 && boss.x === 39,
  'recycle ran before 0.35 s cadence');
assert(pointCalls.length === 0, 'early recycle consumed placement callbacks');

// Fourth 0.1 s tick crosses the cadence and reacquires each live out-of-range actor.
system.update();
assert(Number(normal.x) === 14 && Number(normal.z) === -19,
  'ordinary enemy recycle ring changed');
assert(normal.orderUntil === 0 && normal.state === 'normal' && normal.stateTimer === 0,
  'ordinary recycle no longer clears transient movement/order state');

assert(Number(elite.x) === 12 && Number(elite.z) === -16,
  'regular elite recycle ring changed');
assert(elite.state === 'normal' && elite.stateTimer === 0 && elite.adaptStage === 0,
  'regular elite recycle no longer resets adaptation/runtime state');
assert(reacquired.includes(elite.id), 'regular elite reacquire event disappeared');

assert(Number(boss.x) === 11 && Number(boss.z) === -15,
  'boss recycle ring changed');
assert(reacquired.includes(boss.id), 'boss reacquire event disappeared');
assert(dead.x === 50, 'dead entity was recycled');

assert(
  pointCalls.some(([min, max]) => min === 14 && max === 19) &&
  pointCalls.some(([min, max]) => min === 12 && max === 16) &&
  pointCalls.some(([min, max]) => min === 11 && max === 15),
  'one of the authored recycle rings changed'
);

// Near actors remain untouched on later cadence passes.
normal.x = 5;
normal.z = 0;
elite.x = 6;
elite.z = 0;
boss.x = 7;
boss.z = 0;
reacquired.length = 0;
pointCalls.length = 0;
dt = 0.4;
system.update();
assert(pointCalls.length === 0 && reacquired.length === 0,
  'nearby actors were unnecessarily recycled');

console.log('enemy-recycle-regression OK', {
  accumulator: system.accumulatorValue,
  pointCalls: pointCalls.length,
  reacquired: reacquired.length
});
