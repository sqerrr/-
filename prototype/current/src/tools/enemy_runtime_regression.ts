import { EnemyRuntimeSystem, type EnemyRuntimePort } from '../core/enemyRuntimeSystem.js';
import { makeEnt, type Ent } from '../core/state.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('enemy-runtime-regression: ' + message);
}
function near(actual: number, expected: number, message: string) {
  if (Math.abs(actual - expected) > 1e-9)
    throw new Error(`enemy-runtime-regression: ${message}: ${actual} != ${expected}`);
}

let time = 10;
const dt = 0.1;
let playerX = 0.9;
let playerZ = 0;
let entities: Ent[] = [];
const routes: string[] = [];
const speeds: number[] = [];
const hits: number[] = [];
let skip = false;
let affixMultiplier = 1;

const port: EnemyRuntimePort = {
  dt: () => dt,
  time: () => time,
  playerX: () => playerX,
  playerZ: () => playerZ,
  entities: () => entities,
  earlyAffixTick: (entity) => {
    routes.push('affix:' + entity.id);
  },
  beforeAffixBehavior: () => ({
    skipBehavior: skip,
    speedMultiplier: affixMultiplier
  }),
  updateNormal: (entity, speed) => {
    routes.push('normal:' + entity.id);
    speeds.push(speed);
  },
  steerEliteToRelic: (entity) => {
    routes.push('relic:' + entity.id);
    return entity.id === 2;
  },
  updateElite: (entity, speed) => {
    routes.push('elite:' + entity.id);
    speeds.push(speed);
  },
  updateBoss: (entity, speed) => {
    routes.push('boss:' + entity.id);
    speeds.push(speed);
  },
  hitPlayer: (amount) => {
    hits.push(amount);
  }
};

const system = new EnemyRuntimeSystem(port);

function enemy(id: number, kind: Ent['kind'] = 'footnote') {
  return makeEnt({
    id,
    kind,
    x: 0,
    z: 0,
    hp: 100,
    radius: 0.5,
    speed: 10,
    contactDps: 20,
    cooldown: 2
  });
}

// Normal enemies decay shared timers, face the player and apply freeze/buff/affix speed in order.
{
  routes.length = speeds.length = hits.length = 0;
  skip = false;
  affixMultiplier = 0.5;
  const e = enemy(1);
  e.linkTimer = 2;
  e.stateTimer = 3;
  e.affixTimer = 4;
  e.affixPulse = 5;
  e.adaptCooldown = 6;
  e.frozenUntil = time + 1;
  e.buffUntil = time + 1;
  entities = [e];

  system.update();

  near(e.cooldown, 1.9, 'cooldown did not decay');
  near(e.linkTimer, 1.9, 'link timer did not decay');
  near(e.stateTimer, 2.9, 'state timer did not decay');
  near(e.affixTimer, 4.1, 'affix timer did not advance');
  near(e.affixPulse, 4.9, 'affix pulse did not decay');
  near(e.adaptCooldown, 5.9, 'adapt cooldown did not decay');
  near(e.facingX, 1, 'enemy stopped facing the player');
  near(e.facingZ, 0, 'enemy facing Z drifted');
  assert(routes.join(',') === 'affix:1,normal:1', 'normal dispatch order changed');
  near(speeds[0], 10 * 0.08 * 1.32 * 0.5, 'normal freeze/buff/affix speed order changed');
  assert(hits.length === 1, 'close normal enemy stopped applying contact damage');
  near(hits[0], 20 * 1.28 * dt, 'buffed contact damage changed');
}

// Affix skip is a hard short-circuit: no authored behavior and no contact damage follows it.
{
  routes.length = speeds.length = hits.length = 0;
  skip = true;
  affixMultiplier = 1;
  entities = [enemy(3)];

  system.update();

  assert(routes.join(',') === 'affix:3', 'affix skip no longer short-circuits behavior');
  assert(hits.length === 0, 'affix skip unexpectedly allowed contact damage');
}

// Non-boss elites first get a relic-steering opportunity; looting suppresses chassis AI only.
{
  routes.length = speeds.length = hits.length = 0;
  skip = false;
  const e = enemy(2, 'elite');
  e.chillUntil = time + 1;
  entities = [e];

  system.update();

  assert(routes.join(',') === 'affix:2,relic:2', 'elite relic job routing changed');
  assert(hits.length === 1, 'looting elite lost contact damage');
}

// Bosses bypass relic steering and route directly to boss behavior.
{
  routes.length = speeds.length = hits.length = 0;
  const e = enemy(4, 'elite');
  e.boss = true;
  playerX = 20;
  entities = [e];

  system.update();

  assert(routes.join(',') === 'affix:4,boss:4', 'boss routing changed');
  assert(hits.length === 0, 'distant boss applied contact damage');
}

console.log('enemy-runtime-regression OK', {
  routes,
  timers: true,
  contact: true
});
