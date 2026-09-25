import {
  EliteSpawnSystem,
  type EliteSpawnPort
} from '../core/eliteSpawnSystem.js';
import type { Ent, Poi } from '../core/state.js';
import type { RunMode } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('elite-spawn-regression: ' + message);
}

let now = 0;
let runDuration = 480;
let mode: RunMode = 'clean';
let px = 0;
let pz = 0;
let worldScale = 2;
let damageScale = 3;
let nextId = 100;
let ecosystemMass = 0;
let activeGuardians = 0;
const intQueue: number[] = [];
const floatQueue: number[] = [];
const rangeCalls: [number, number][] = [];
const committed: { entity: Ent; trackEncounter: boolean; bossEvent: boolean }[] = [];
const progression: string[] = [];
const bossEvents: { id: number; supports: number; uncleared: number }[] = [];
let pois: Poi[] = [];

const port: EliteSpawnPort = {
  time: () => now,
  runDuration: () => runDuration,
  mode: () => mode,
  playerX: () => px,
  playerZ: () => pz,
  worldBounds: () => ({ minX: -50, maxX: 50, minZ: -40, maxZ: 40 }),
  randomInt: (max) => {
    const raw = intQueue.shift() ?? 0;
    return Math.max(0, Math.min(max - 1, raw));
  },
  randomFloat: () => floatQueue.shift() ?? 0,
  randomRange: (min, max) => {
    rangeCalls.push([min, max]);
    return (min + max) * 0.5;
  },
  worldScale: () => worldScale,
  damageScale: () => damageScale,
  nextEntityId: () => nextId++,
  pointAroundPlayer: (min, max) => {
    assert(min === 15 && max === 18.5, 'regular elite spawn ring changed');
    return { x: 12, z: -8 };
  },
  claimRepertoire: (entity) => progression.push('claim:' + entity.id),
  inheritLegacy: (entity, all) =>
    progression.push('legacy:' + entity.id + ':' + Boolean(all)),
  inheritEvolution: (entity) => progression.push('evolution:' + entity.id),
  grantNativeGrowth: (entity) => progression.push('native:' + entity.id),
  ecosystemMass: () => ecosystemMass,
  pois: () => pois,
  activePoiGuardians: () => activeGuardians,
  commitElite: (entity, options) =>
    committed.push({
      entity,
      trackEncounter: options.trackEncounter,
      bossEvent: options.bossEvent
    }),
  emitBossSpawned: (entity, supports, uncleared) =>
    bossEvents.push({ id: entity.id, supports, uncleared })
};

const system = new EliteSpawnSystem(port);

// Opening elite teaches chassis only: common/no-affix, clean-mode HP reduction,
// no refusal/legacy/native progression, and exactly one cooldown RNG call.
{
  committed.length = 0;
  progression.length = 0;
  rangeCalls.length = 0;
  intQueue.push(0); // hunter
  const entity = system.spawnRegular(true);

  assert(entity.chassis === 'hunter' && entity.rarity === 'common' && entity.affix === 'none',
    'opening elite identity changed');
  assert(entity.x === 12 && entity.z === -8, 'opening elite placement changed');
  assert(Math.abs(entity.hp - 840 * worldScale * 2.5 * 0.8) < 1e-9,
    'opening clean-mode HP formula changed');
  assert(entity.radius === 0.86 && entity.speed === 1.76,
    'opening hunter body/movement changed');
  assert(Math.abs(entity.contactDps - 34 * damageScale * 0.62) < 1e-9,
    'opening elite contact DPS changed');
  assert(rangeCalls.length === 1 && rangeCalls[0][0] === 1.7 && rangeCalls[0][1] === 3.0,
    'opening elite cooldown RNG cadence/bounds changed');
  assert(progression.length === 0, 'opening elite unexpectedly inherited ecosystem progression');
  assert(
    committed.length === 1 &&
    committed[0].trackEncounter &&
    !committed[0].bossEvent,
    'opening elite commit flags changed'
  );
}

// A regular late elite rolls rarity then affix, then inherits refusal/legacy/native growth.
{
  committed.length = 0;
  progression.length = 0;
  rangeCalls.length = 0;
  now = 240; // 50% run depth
  mode = 'showcase';
  intQueue.push(3); // bulwark
  floatQueue.push(0); // legendary rarity
  intQueue.push(0); // crowned affix

  const entity = system.spawnRegular(false);
  assert(
    entity.chassis === 'bulwark' &&
    entity.rarity === 'legendary' &&
    entity.affix === 'crowned',
    'late elite rarity/affix sequence changed'
  );
  assert(Math.abs(entity.hp - 1320 * worldScale * 9.4) < 1e-9,
    'legendary Bulwark HP scaling changed');
  assert(Math.abs(entity.radius - 1.02 * 1.25) < 1e-9,
    'legendary Bulwark size scaling changed');
  assert(
    progression.join('|') ===
      `claim:${entity.id}|legacy:${entity.id}:false|native:${entity.id}`,
    'regular elite ecosystem inheritance order changed'
  );
  assert(committed[0]?.trackEncounter && !committed[0]?.bossEvent,
    'regular elite encounter tracking changed');
}

// Spawn-time support identity is a stable, readable POI -> chassis/affix mapping.
{
  assert(
    system.supportIdentity('phenomenon').join(':') === 'hunter:shielded',
    'Phenomenon support identity changed'
  );
  assert(
    system.supportIdentity('catalyst').join(':') === 'architect:vanguard',
    'Catalyst support identity changed'
  );
  assert(
    system.supportIdentity('resonance').join(':') === 'bulwark:temporal',
    'Resonance support identity changed'
  );
  assert(
    system.supportIdentity('vital').join(':') === 'harvester:brood',
    'Vital support identity changed'
  );
}

// Warden inherits full ecosystem state before commit, then spawns visible support based on POI clear state.
{
  committed.length = 0;
  progression.length = 0;
  bossEvents.length = 0;
  rangeCalls.length = 0;
  px = 5;
  pz = -2;
  ecosystemMass = 10;
  activeGuardians = 0;
  pois = [
    { id: 1, kind: 'phenomenon', x: 0, z: 0, state: 'dormant', guardianId: 0 },
    { id: 2, kind: 'catalyst', x: 0, z: 0, state: 'dormant', guardianId: 0 },
    { id: 3, kind: 'resonance', x: 0, z: 0, state: 'dormant', guardianId: 0 }
  ];

  const boss = system.spawnBoss();
  assert(
    boss.boss &&
    boss.chassis === 'warden' &&
    boss.rarity === 'legendary' &&
    boss.x === -34 &&
    boss.z === 24,
    'Warden identity/opposite-side placement changed'
  );
  const expectedHp =
    5600 * worldScale * (4.15 + Math.min(1.55, ecosystemMass * 0.035));
  assert(Math.abs(boss.hp - expectedHp) < 1e-9, 'Warden ecosystem HP formula changed');
  assert(
    progression.slice(0, 3).join('|') ===
      `claim:${boss.id}|legacy:${boss.id}:true|evolution:${boss.id}`,
    'Warden ecosystem inheritance order changed'
  );
  assert(
    committed.length === 3 &&
    !committed[0].trackEncounter &&
    committed[0].bossEvent &&
    !committed[1].bossEvent &&
    !committed[2].bossEvent,
    'Warden/support commit semantics changed'
  );
  assert(
    bossEvents.length === 1 &&
    bossEvents[0].id === boss.id &&
    bossEvents[0].supports === 2 &&
    bossEvents[0].uncleared === 3,
    'boss support/uncleared event semantics changed'
  );
  assert(
    committed[1].entity.chassis === 'hunter' &&
    committed[1].entity.affix === 'shielded' &&
    committed[2].entity.chassis === 'architect' &&
    committed[2].entity.affix === 'vanguard',
    'boss supports no longer follow unresolved POI order'
  );
  assert(
    rangeCalls.filter(([min, max]) => min === 1.3 && max === 2.5).length === 2,
    'boss support cooldown RNG cadence changed'
  );
}

// Existing active POI guardians count toward the visible support cap.
{
  committed.length = 0;
  bossEvents.length = 0;
  progression.length = 0;
  activeGuardians = 1;
  pois = [
    { id: 1, kind: 'phenomenon', x: 0, z: 0, state: 'dormant', guardianId: 0 },
    { id: 2, kind: 'catalyst', x: 0, z: 0, state: 'dormant', guardianId: 0 },
    { id: 3, kind: 'resonance', x: 0, z: 0, state: 'dormant', guardianId: 0 }
  ];
  const boss = system.spawnBoss();
  const supports = committed.filter((entry) => entry.entity.id !== boss.id);
  assert(supports.length === 1, 'active POI guardian stopped counting toward boss support cap');
  assert(bossEvents[0]?.supports === 2, 'BossSpawned support count changed with active guardian');
}

console.log('elite-spawn-regression OK', {
  nextId,
  committed: committed.length,
  bossEvents: bossEvents.length,
  progressionCalls: progression.length
});
