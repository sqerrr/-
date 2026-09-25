import {
  EnemySpawnSystem,
  type EnemySpawnPort
} from '../core/enemySpawnSystem.js';
import type { Ent } from '../core/state.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('enemy-spawn-regression: ' + message);
}

let now = 10;
let normalCount = 0;
let worldScale = 2;
let damageScale = 3;
let populationTarget = 100;
let nextId = 40;
let rangeCalls = 0;
let pointCalls = 0;
const added: Ent[] = [];
const spawned: Ent[] = [];

const port: EnemySpawnPort = {
  time: () => now,
  randomRange: (min, max) => {
    rangeCalls++;
    assert(min === 0.3 && max === 1.9, 'spawn cooldown RNG bounds changed');
    return 1.1;
  },
  worldScale: () => worldScale,
  damageScale: () => damageScale,
  populationTarget: () => populationTarget,
  normalCount: () => normalCount,
  nextEntityId: () => nextId++,
  pointAroundPlayer: (min, max) => {
    pointCalls++;
    assert(min === 13.5 && max === 19.5, 'ordinary spawn ring changed');
    return { x: 7, z: -4 };
  },
  addEntity: (entity) => added.push(entity),
  onSpawn: (entity) => spawned.push(entity)
};

const system = new EnemySpawnSystem(port);

// Per-kind authored body/combat stats and scaling stay exactly where they were.
{
  const entity = system.spawnAt('bookmark', 3, 5);
  assert(entity, 'bookmark spawn was rejected');
  assert(entity.id === 40 && entity.x === 3 && entity.z === 5,
    'spawn identity/position changed');
  assert(entity.hp === 63 * worldScale && entity.maxHp === entity.hp,
    'bookmark HP scaling changed');
  assert(entity.speed === 1.32, 'bookmark speed changed');
  assert(Math.abs(entity.contactDps - 19 * damageScale * 0.42) < 1e-9,
    'bookmark contact DPS scaling changed');
  assert(entity.radius === 0.46 && entity.cooldown === 1.1,
    'bookmark body/cooldown changed');
  assert(added.at(-1) === entity && spawned.at(-1) === entity,
    'accepted spawn no longer commits exactly one entity');
}

// Larger support bodies, revive count, clone lineage and temporary buff lifetime remain authored.
{
  now = 20;
  const binder = system.spawnAt('binder', 0, 0, 5, 77);
  assert(binder && binder.radius === 0.58, 'binder body radius changed');
  assert(binder.buffUntil === 25 && binder.cloneParent === 77,
    'buffed clone metadata changed');

  const palimpsest = system.spawnAt('palimpsest', 0, 0);
  assert(palimpsest?.revivesLeft === 1, 'palimpsest revive budget changed');
}

// Hard population cap rejects before consuming id/cooldown RNG or emitting side effects.
{
  normalCount = 198;
  const idBefore = nextId;
  const rngBefore = rangeCalls;
  const addedBefore = added.length;
  assert(system.spawnAt('footnote', 0, 0) === undefined,
    'hard normal population cap stopped rejecting');
  assert(nextId === idBefore && rangeCalls === rngBefore && added.length === addedBefore,
    'rejected hard-cap spawn consumed construction side effects');
}

// Buffed/clone-style spawns use the tighter dynamic cap while ordinary spawns may still enter.
{
  normalCount = 118; // populationTarget 100 + authored 18 headroom
  const idBefore = nextId;
  assert(system.spawnAt('redactor', 0, 0, 2) === undefined,
    'buffed spawn ignored dynamic population cap');
  assert(nextId === idBefore, 'dynamic-cap rejection consumed an entity id');

  const ordinary = system.spawnAt('redactor', 0, 0);
  assert(ordinary, 'ordinary spawn incorrectly used buffed dynamic cap');
}

// Ring spawn delegates placement first, then uses the same spawnAt construction path.
{
  normalCount = 0;
  const before = pointCalls;
  const entity = system.spawn('inkblot');
  assert(entity?.x === 7 && entity.z === -4, 'ring spawn ignored placement callback');
  assert(pointCalls === before + 1, 'ring spawn placement callback cadence changed');
}

assert(added.length === spawned.length, 'spawn commit/event hooks diverged');

console.log('enemy-spawn-regression OK', {
  accepted: added.length,
  rangeCalls,
  pointCalls,
  nextId
});
