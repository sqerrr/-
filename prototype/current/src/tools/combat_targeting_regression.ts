import {
  CombatTargetingSystem,
  type CombatTargetingPort
} from '../core/combatTargetingSystem.js';
import { makeEnt, type CastSource, type Ent, type Field } from '../core/state.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('combat-targeting-regression: ' + message);
}

const enemy = (id: number, x: number, z: number, radius = 0.5): Ent =>
  makeEnt({
    id,
    kind: 'footnote',
    x,
    z,
    hp: 100,
    maxHp: 100,
    radius,
    speed: 1,
    contactDps: 0
  });

const entities: Ent[] = [
  enemy(1, 4, 0),
  enemy(2, 7, 0.4),
  enemy(3, -4, 0)
];

let fields: Field[] = [];
let player = {
  x: 2,
  z: -1,
  hp: 77,
  maxHp: 120,
  facingX: 0,
  facingZ: 1
};
let losBlocked = false;

const port: CombatTargetingPort = {
  entities: () => entities,
  fields: () => fields,
  player: () => player,
  lineOfSight: () => !losBlocked
};

const system = new CombatTargetingSystem(port);

const heroSource: CastSource = {
  faction: 'hero',
  owner: null,
  x: 0,
  z: 0,
  aimX: 1,
  aimZ: 0,
  vx: 0,
  vz: 0
};

const rivalSource: CastSource = {
  faction: 'rival',
  owner: entities[0],
  x: 0,
  z: 0,
  aimX: 1,
  aimZ: 0,
  vx: 0,
  vz: 0
};

// Hero casts consume the live enemy roster by reference.
{
  const targets = system.targetsFor(heroSource);
  assert(targets === entities, 'hero cast stopped targeting the live enemy roster');
}

// Rival casts see one synthetic hero, refreshed from current player state every query.
{
  let targets = system.targetsFor(rivalSource);
  assert(targets.length === 1, 'rival cast gained more than one player target');
  assert(system.isSyntheticHero(targets[0]),
    'rival target lost synthetic-hero identity contract');
  assert(
    targets[0].x === 2 &&
    targets[0].z === -1 &&
    targets[0].hp === 77 &&
    targets[0].maxHp === 120 &&
    targets[0].facingX === 0 &&
    targets[0].facingZ === 1,
    'synthetic hero projection lost live player state'
  );

  player = { x: -3, z: 5, hp: 51, maxHp: 140, facingX: -1, facingZ: 0 };
  targets = system.targetsFor(rivalSource);
  assert(
    targets[0].x === -3 &&
    targets[0].z === 5 &&
    targets[0].hp === 51 &&
    targets[0].maxHp === 140,
    'synthetic hero was not refreshed on the next rival query'
  );
}

// bestTarget preserves predicate filtering and comparator semantics.
{
  const best = system.bestTarget(
    heroSource,
    (entity) => entity.x > 0,
    (candidate, current) => candidate.x - current.x
  );
  assert(best?.id === 1, 'bestTarget comparator/predicate semantics changed');
}

// Ray hits are normalized, LOS-gated, ordered front-to-back and maxHits-limited.
{
  losBlocked = false;
  const hits = system.rayHits(heroSource, 5, 0, 10, 0.8, 1);
  assert(hits.length === 1 && hits[0].e.id === 1,
    'rayHits no longer returns nearest forward hit first');

  losBlocked = true;
  assert(system.rayHits(heroSource, 1, 0, 10, 0.8).length === 0,
    'rayHits ignored line-of-sight rejection');
  losBlocked = false;
}

// Visibility combines world LOS with veil semantics.
{
  const target = entities[0];
  losBlocked = true;
  assert(!system.targetVisible(heroSource, target),
    'targetVisible ignored blocked world LOS');

  losBlocked = false;
  fields = [{
    id: 50,
    x: 4,
    z: 0,
    radius: 1.5,
    ttl: 5,
    kind: 'veil',
    dps: 0,
    tickAcc: 0,
    faction: 'hero'
  }];
  assert(!system.targetVisible(heroSource, target),
    'veil stopped hiding a distant target from an outside observer');

  const insideSource: CastSource = { ...heroSource, x: 4, z: 0 };
  assert(system.targetVisible(insideSource, target),
    'observer inside veil can no longer see target inside the same veil');
  fields = [];
}

// Aim point prefers a visible forward target and otherwise falls back to authored 72% range.
{
  const point = system.aimPoint(heroSource, 10);
  assert(point.x === 4 && point.z === 0,
    'aimPoint stopped selecting the best visible forward target');

  losBlocked = true;
  const fallback = system.aimPoint(heroSource, 10);
  assert(
    Math.abs(fallback.x - 7.2) < 1e-9 && Math.abs(fallback.z) < 1e-9,
    'aimPoint fallback distance changed'
  );
  losBlocked = false;
}

// Rotated aim remains a pure normalized-direction rotation helper.
{
  const rotated = system.rotatedAim(heroSource, Math.PI / 2);
  assert(
    Math.abs(rotated.x) < 1e-9 && Math.abs(rotated.z - 1) < 1e-9,
    'rotatedAim geometry changed'
  );
}

console.log('combat-targeting-regression OK', {
  heroTargets: system.targetsFor(heroSource).length,
  rivalTargets: system.targetsFor(rivalSource).length,
  firstRayHit: system.rayHits(heroSource, 1, 0, 10, 0.8, 1)[0]?.e.id ?? null
});
