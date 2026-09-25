import { Rng } from '../core/rng.js';
import { WorldGeometrySystem, type WorldGeometryPort } from '../core/worldGeometrySystem.js';
import type { Obstacle, Poi } from '../core/state.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('world-geometry-system-regression: ' + message);
}

const world = { minX: -48, maxX: 48, minZ: -36, maxZ: 36 };
const worldRng = new Rng(1234);
let px = 0;
let pz = 0;
let spawnCalls = 0;

const port: WorldGeometryPort = {
  worldRandomRange: (min, max) => worldRng.range(min, max),
  worldRandomInt: (maxExclusive) => worldRng.int(maxExclusive),
  spawnRandomRange: (min, max) => {
    spawnCalls++;
    return min === 0 ? 0 : min;
  },
  playerX: () => px,
  playerZ: () => pz
};

const system = new WorldGeometrySystem(world, port);

// Authored generation keeps the opening and POIs clear.
const pois: Poi[] = [
  { id: 1, kind: 'phenomenon', x: 14, z: -7, state: 'dormant', guardianId: 0 },
  { id: 2, kind: 'catalyst', x: -19, z: 9, state: 'dormant', guardianId: 0 }
];
system.initialize(pois);
assert(system.all.length > 0, 'arena generation produced no cover');
assert(system.all.every((o) => Math.hypot(o.x, o.z) >= 12.4 - 1e-9),
  'generated cover violated the opening cluster-safe contract');
for (const poi of pois)
  assert(system.all.every((o) => Math.hypot(o.x - poi.x, o.z - poi.z) >= 6.9 - 1e-9),
    'generated cover violated a POI cluster-safe contract');

// Manual fixtures exercise the spatial grid independently from generator randomness.
const hard: Obstacle = {
  id: 100, x: 0, z: 0, radius: 2, hp: -1, maxHp: -1, destructible: false
};
const soft: Obstacle = {
  id: 101, x: 8, z: 0, radius: 1.5, hp: 10, maxHp: 10, destructible: true
};
system.replace([hard, soft]);

assert(system.blocked(0, 0, 0.5), 'blocked query missed permanent cover');
assert(!system.blocked(4, 4, 0.5), 'blocked query reported free space as occupied');

const pushed = system.freeOf(0.5, 0, 0.5);
assert(Math.hypot(pushed.x - hard.x, pushed.z - hard.z) >= 2.5 - 1e-9,
  'freeOf failed to resolve a body outside cover');

const hit = system.firstBlockingHit(-5, 0, 5, 0, 0.1);
assert(hit?.obstacle.id === hard.id && hit.t > 0 && hit.t < 1,
  'swept LOS query lost nearest blocker');
assert(!system.lineOfSight(-5, 0, 5, 0, 0.1),
  'lineOfSight ignored blocking cover');
assert(system.firstBlockingObstacle(-5, 0, 5, 0, 0.1)?.id === hard.id,
  'firstBlockingObstacle disagrees with hit query');

assert(!system.damageObstacle(hard, 999), 'permanent cover became destructible');
assert(system.damageObstacle(soft, 20), 'lethal cover damage did not destroy soft cover');
assert(system.all.length === 1 && system.all[0].id === hard.id,
  'destroyed cover remained in owned obstacle list');
assert(!system.nearShared(8, 0, 0.5).some((o) => o.id === soft.id),
  'spatial grid retained destroyed cover');

// Spawn placement uses its own callback stream and respects world bounds/cover.
system.replace([]);
px = 0;
pz = 0;
spawnCalls = 0;
const point = system.pointAroundPlayer(13, 19);
assert(point.x === 13 && Math.abs(point.z) < 1e-9,
  'pointAroundPlayer placement contract changed');
assert(spawnCalls === 2, 'successful placement consumed an unexpected number of spawn RNG calls');

console.log('world-geometry-system-regression OK', {
  generated: system.all.length,
  point,
  spawnCalls
});
