import {
  CANONICAL_SCHEMA_VERSION,
  CanonicalStateSerializer,
  type CanonicalStateInput
} from '../core/canonicalStateSerializer.js';
import { makeEnt } from '../core/state.js';
import type { CatalystRuntime, Metrics, SkillRuntime } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('canonical-state-serializer-regression: ' + message);
}

const skillA: SkillRuntime = {
  id: 'cleaver',
  level: 2,
  power: 1,
  coverage: 2,
  range: 3,
  duration: 4,
  crit: 0.1,
  eliteDamage: 0.2,
  count: 2,
  control: 0.3,
  statusPotency: 0.4,
  mutation: null,
  mutationUpgrade: null,
  mutationApotheosis: null
};
const skillB: SkillRuntime = { ...skillA, id: 'arc_bolt', level: 3 };
const catalystA: CatalystRuntime = { id: 'trail' };
const catalystB: CatalystRuntime = { id: 'source' };
const entity = makeEnt({
  id: 7,
  kind: 'footnote',
  x: 1,
  z: 2,
  hp: 30,
  radius: 0.4,
  speed: 1,
  contactDps: 0
});
entity.relicItems = ['plating'];
entity.evolutionItems = ['quickened'];

const metrics: Metrics = {
  spawned: 10,
  killed: 4,
  eliteSpawned: 2,
  eliteKilled: 1,
  damage: 123,
  eliteDamage: 50,
  activations: 8,
  levels: 3,
  mutations: 1,
  healsPicked: 2,
  relicsTakenByHero: 1,
  relicsTakenByElites: 1,
  damageTaken: 9,
  healingReceived: 5,
  barrierGenerated: 6,
  reactions: 7,
  maxEnemies: 12,
  enemyCountSum: 100,
  enemySamples: 10,
  rivalCasts: 1,
  dashes: 2,
  dashIFrameSaves: 1
};

const input: CanonicalStateInput = {
  mode: 'clean',
  tick: 42,
  rngState: 1234,
  player: {
    x: 1,
    z: -2,
    hp: 90,
    maxHp: 100,
    barrier: 3,
    armor: 0.15,
    dashUntil: 5,
    dashIFramesUntil: 6,
    dashReadyAt: 7,
    level: 4,
    xp: 11,
    xpNeed: 20
  },
  chain: {
    beat: 2,
    cycle: 3,
    capacitorCharge: 4,
    overflowCharge: 5,
    aegisCharge: 6,
    orbitChoreoUntil: 7,
    orbitChoreoX: 8,
    orbitChoreoZ: 9,
    orbitChoreoCarrier: { kind: 'orbit', index: 2 },
    context: {
      skill: null,
      damage: 0,
      kills: 0,
      overkill: 0,
      control: 0,
      state: '',
      hitIds: [9, 3],
      x: 10,
      z: 11,
      trace: null
    }
  },
  growth: {
    tempo: 1.2,
    globalPower: 0.5,
    fortune: 0.25,
    resonance: {
      tempo: 1,
      multiplicity: 2,
      precision: 3,
      persistence: 4,
      conductivity: 5,
      mobility: 6
    }
  },
  economy: {
    eliteCore: 2,
    rerolls: 1,
    mutationRefusalToken: true
  },
  boss: { spawned: true, defeated: false },
  loadout: {
    slots: ['cleaver', null],
    skillReserve: ['arc_bolt'],
    catalysts: ['trail', null],
    catalystReserve: ['source']
  },
  pois: [
    { id: 5, kind: 'vital', x: 4, z: 6, state: 'guarded', guardianId: 7 }
  ],
  skills: [skillA, skillB],
  catalysts: [catalystA, catalystB],
  entities: [entity],
  metrics,
  relicCount: 2,
  heldItems: ['plating'],
  eliteLegacyItems: ['quickened'],
  eliteEvolutionHistory: ['aegis_core']
};

const serializer = new CanonicalStateSerializer();
const parts = serializer.serialize(input);

assert(CANONICAL_SCHEMA_VERSION === 6, 'schema version changed during extraction');
assert(parts[0] === 'schema' && parts[1] === 6, 'schema prefix changed');
assert(parts.includes('chain.orbitChoreo'), 'orbit choreography state disappeared');
assert(parts.includes('chain.context'), 'activation context disappeared');

const axes = parts.indexOf('growth.axes');
assert(
  axes >= 0 &&
  parts.slice(axes + 1, axes + 7).join(',') === '1,2,3,4,5,6',
  'resonance axis ordering changed'
);

const skillRows: string[] = [];
for (let i = 0; i < parts.length; i++)
  if (parts[i] === 'skill') skillRows.push(String(parts[i + 1]));
assert(skillRows.join(',') === 'arc_bolt,cleaver', 'skill canonical sort changed');

const catalystRows: string[] = [];
for (let i = 0; i < parts.length; i++)
  if (parts[i] === 'catalyst') catalystRows.push(String(parts[i + 1]));
assert(catalystRows.join(',') === 'source,trail', 'catalyst canonical sort changed');

const economy = parts.indexOf('economy.mutationRefusal');
assert(parts[economy + 1] === 1, 'boolean normalization changed');

const slots = parts.indexOf('loadout.slots');
assert(parts[slots + 1] === 'cleaver' && parts[slots + 2] === '-', 'null normalization changed');

const entityRow = parts.indexOf('ent');
assert(entityRow >= 0 && parts[entityRow + 1] === 7, 'entity row disappeared');
assert(parts.includes('plating') && parts.includes('quickened'), 'entity progression payload disappeared');

const hashA = serializer.hash(input);
const hashB = serializer.hash(input);
assert(hashA === hashB && /^[0-9a-f]{8}$/.test(hashA), 'canonical hash is not stable');

console.log('canonical-state-serializer-regression OK', {
  schema: CANONICAL_SCHEMA_VERSION,
  atoms: parts.length,
  hash: hashA
});
