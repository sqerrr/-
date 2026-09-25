import {
  PlayerDamageSystem,
  type PlayerDamagePort
} from '../core/playerDamageSystem.js';
import { makeEnt, type Ent } from '../core/state.js';
import type {
  DamageSourceId,
  EliteEncounter,
  GameEvent,
  Metrics
} from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('player-damage-regression: ' + message);
}

const numeric = (value: number): number => value;

let now = 1;
let tick = 60;
let hp = 100;
let barrier = 0;
let armor = 0;
let guardDoctrine = 0;
let itemDamageTaken = 1;
let itemRefusalDamage = 1;
let dashUntil = 2;
let dashSaved = false;
let randomCalls = 0;
const entities: Ent[] = [];
const events: Extract<GameEvent, { type: 'PlayerHit' }>[] = [];

const metrics = {
  damageTaken: 0,
  dashIFrameSaves: 0
} as Metrics;

const encounter: EliteEncounter = {
  id: 50,
  chassis: 'bulwark',
  rarity: 'common',
  spawnedAt: 0,
  engagedAt: -1,
  contactTime: 0,
  endedAt: -1,
  killed: false,
  repertoire: 0,
  casts: 0,
  castSkills: {},
  damageToHero: 0,
  damageFromHero: 0,
  lastExchangeAt: -1,
  damageFromHeroByNode: {},
  damageToHeroBySource: {},
  refusalDamageToHero: 0,
  itemAmplifiedDamage: 0,
  itemsTaken: [],
  dashes: 0,
  dashIFrameSaves: 0
};

const attacker = makeEnt({
  id: encounter.id,
  kind: 'elite',
  x: 8,
  z: 0,
  hp: 500,
  maxHp: 500,
  radius: 1,
  speed: 1,
  contactDps: 0
});
attacker.chassis = 'bulwark';
entities.push(attacker);

const port: PlayerDamagePort = {
  time: () => now,
  tick: () => tick,
  playerX: () => 0,
  playerZ: () => 0,
  playerHp: () => hp,
  setPlayerHp: (value) => { hp = value; },
  barrier: () => barrier,
  setBarrier: (value) => { barrier = value; },
  armor: () => armor,
  guardDoctrine: () => guardDoctrine,
  itemDamageTakenMultiplier: () => itemDamageTaken,
  itemRefusalDamageMultiplier: () => itemRefusalDamage,
  dashIFramesUntil: () => dashUntil,
  dashWindowSaved: () => dashSaved,
  setDashWindowSaved: (value) => { dashSaved = value; },
  metrics: () => metrics,
  entities: () => entities,
  eliteEncounter: (id) => id === encounter.id ? encounter : undefined,
  randomFloat: () => { randomCalls++; return 0.1; },
  rivalAxisCount: (_entity, axis) => axis === 'precision' ? 1 : 2,
  emit: (event) => events.push(event)
};

const system = new PlayerDamageSystem(port);

// One dash window may reject many blows but counts exactly one global/per-elite save.
system.hit(50, attacker, 'contact');
system.hit(50, attacker, 'contact');
assert(hp === 100, 'dash iframe stopped rejecting damage');
assert(metrics.dashIFrameSaves === 1, 'dash iframe save counted more than once');
assert(encounter.dashIFrameSaves === 1, 'elite encounter iframe save changed');
assert(events.length === 0, 'rejected iframe hit emitted PlayerHit');

// Barrier absorbs mitigated damage before HP; encounter telemetry stores pre-barrier damage.
now = 3;
tick = 180;
dashUntil = 2;
dashSaved = false;
barrier = 10;
armor = 0;
guardDoctrine = 0;
system.hit(25, attacker, 'contact');
assert(barrier === 0, 'barrier absorption changed');
assert(hp === 85, 'HP damage after barrier changed');
assert(metrics.damageTaken === 15, 'damageTaken should count HP loss only');
assert(encounter.damageToHero === 25, 'elite encounter should record mitigated pre-barrier damage');
assert(encounter.damageToHeroBySource.contact === 25, 'per-source encounter accounting changed');
assert(encounter.engagedAt === now && encounter.lastExchangeAt === now,
  'elite exchange timestamps changed');
assert(events.at(-1)?.barrierDamage === 10 && events.at(-1)?.hpDamage === 15,
  'PlayerHit damage split changed');

// Guard doctrine is conditional on a live nearby threat.
const near = makeEnt({
  id: 51,
  kind: 'footnote',
  x: 2,
  z: 0,
  hp: 100,
  maxHp: 100,
  radius: 0.4,
  speed: 1,
  contactDps: 0
});
entities.push(near);
hp = 100;
barrier = 0;
guardDoctrine = 2;
system.hit(100, null, 'contact');
assert(Math.abs(hp - (100 - 100 * Math.pow(0.94, 2))) < 1e-9,
  'close-threat Guard mitigation changed');

// Rival damage preserves concentration -> refusal -> crit -> axes -> relic cast order,
// then hero mitigation, while relic siphon heals from the pre-mitigation rival amount.
entities.splice(entities.indexOf(near), 1);
hp = 100;
barrier = 0;
armor = 20;
guardDoctrine = 0;
itemDamageTaken = 0.8;
itemRefusalDamage = 1.2;
randomCalls = 0;
attacker.relicCritChance = 0.2;
attacker.relicCastMul = 1.5;
attacker.groundRelicCastMul = 1.25;
attacker.relicSiphon = 0.1;
attacker.hp = 300;
attacker.maxHp = 500;
encounter.itemAmplifiedDamage = 0;

const base = 10;
const concentration = 2;
const afterConcentration = base * concentration * itemRefusalDamage;
const afterCrit = afterConcentration * 1.6;
const afterAxes = afterCrit * Math.pow(1.3, 1) * Math.pow(1.16, 2);
const rivalAmount = afterAxes * 1.5;
const expectedMitigated = rivalAmount * (1 - armor / (armor + 100)) * itemDamageTaken;
const withoutGround = afterAxes * (1.5 / 1.25);
const expectedItemAmplified =
  (afterAxes * 1.5 - withoutGround) *
  (1 - armor / (armor + 100)) *
  itemDamageTaken;

const killed = system.damageFromRival(
  base,
  'rail_spear' satisfies DamageSourceId,
  attacker,
  concentration
);
assert(!killed, 'nonlethal rival fixture became lethal');
assert(randomCalls === 1, 'rival relic crit RNG cadence changed');
assert(Math.abs(hp - (100 - expectedMitigated)) < 1e-9,
  'rival damage multiplier/mitigation order changed');
assert(Math.abs(attacker.hp - (300 + rivalAmount * 0.1)) < 1e-9,
  'rival siphon stopped using pre-mitigation damage');
assert(Math.abs(encounter.itemAmplifiedDamage - expectedItemAmplified) < 1e-9,
  'ground relic amplified-damage attribution changed');
assert(encounter.refusalDamageToHero > 0,
  'refused Phenomenon damage is no longer separated in encounter telemetry');

console.log('player-damage-regression OK', {
  iframeSaves: metrics.dashIFrameSaves,
  hp: numeric(hp),
  rivalAmount,
  expectedMitigated,
  itemAmplified: encounter.itemAmplifiedDamage
});
