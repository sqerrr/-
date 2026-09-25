import { SnapshotBuilder, type SnapshotBuilderInput } from '../core/snapshotBuilder.js';
import { makeEnt, type Relic } from '../core/state.js';
import type { Metrics, RefusedCard, SkillRuntime } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('snapshot-builder-regression: ' + message);
}

const metrics: Metrics = {
  spawned: 2,
  killed: 1,
  eliteSpawned: 1,
  eliteKilled: 0,
  damage: 10,
  eliteDamage: 4,
  activations: 3,
  levels: 1,
  mutations: 0,
  healsPicked: 0,
  relicsTakenByHero: 1,
  relicsTakenByElites: 0,
  damageTaken: 2,
  healingReceived: 0,
  barrierGenerated: 1,
  reactions: 1,
  maxEnemies: 2,
  enemyCountSum: 2,
  enemySamples: 1,
  rivalCasts: 0,
  dashes: 1,
  dashIFrameSaves: 0
};

const runtime: SkillRuntime = {
  id: 'cleaver',
  level: 2,
  power: 1,
  coverage: 0,
  range: 0,
  duration: 0,
  crit: 0.03,
  eliteDamage: 0,
  count: 1,
  control: 0,
  statusPotency: 0,
  mutation: null,
  mutationUpgrade: null,
  mutationApotheosis: null
};

const refusal: RefusedCard = {
  serial: 11,
  kind: 'skill',
  title: 'Тесак',
  icon: '⌁',
  skill: 'cleaver'
};

const elite = makeEnt({
  id: 7,
  kind: 'elite',
  x: 1,
  z: 1,
  hp: 80,
  maxHp: 100,
  radius: 0.8,
  speed: 1,
  contactDps: 0,
  chassis: 'hunter',
  affix: 'regenerating',
  rarity: 'uplifted'
});
elite.repertoire = [11];
elite.relicItems = ['plating'];
elite.evolutionItems = ['quickened'];
elite.markUntil = 20;
elite.igniteUntil = 20;
elite.buffUntil = 20;
elite.orderUntil = 20;
elite.squadTask = 'flank';
elite.squadUntil = 20;
elite.lastDamageAt = 1;

const relics: Relic[] = [
  { id: 20, x: 2, z: 1, item: 'plating', bornAt: 0 }
];
const heldItems = ['plating'] as const;
const slots: ('cleaver' | null)[] = ['cleaver', null];

const input: SnapshotBuilderInput = {
  tick: 600,
  time: 10,
  runDuration: 480,
  finished: false,
  mode: 'clean',
  player: {
    x: 0,
    z: 0,
    hp: 90,
    maxHp: 100,
    barrier: 5,
    armor: 0.1,
    level: 2,
    xp: 3,
    xpNeed: 10,
    moveSpeed: 4,
    aimX: 1,
    aimZ: 0,
    power: 0.2,
    pickupRadius: 2,
    fortune: 0.1,
    dashing: true,
    dashReady: false,
    dashCharge: 0.5,
    invulnerable: true
  },
  entities: [elite],
  refusalStore: [refusal],
  echoFor: (id) => id === elite.id ? { phase: 'tell', skill: 'cleaver' } : undefined,
  pickups: [{ id: 1, x: 0, z: 1, value: 2, kind: 'xp' }],
  relics,
  heldItems,
  fields: [{
    id: 2,
    x: 0,
    z: 0,
    radius: 2,
    ttl: 1,
    kind: 'fire',
    dps: 5,
    tickAcc: 0,
    source: 'fire_field'
  }],
  constructs: [{
    id: 3,
    x: 0,
    z: 0,
    ttl: 2,
    cooldown: 0,
    range: 5,
    power: 1,
    skill: 'sentry',
    faction: 'hero',
    ownerId: 0,
    sourceSlot: 0,
    mutation: null,
    mutationUpgrade: null,
    mutationApotheosis: null,
    rivalConcentration: 1
  }],
  projectiles: [{
    id: 4,
    x: 0,
    z: 0,
    vx: 1,
    vz: 0,
    radius: 0.2,
    ttl: 1,
    damage: 5,
    coverDamage: 5,
    faction: 'hero',
    ownerId: 0,
    source: 'cleaver',
    sourceSlot: 0,
    mutation: null,
    rivalConcentration: 1,
    guarded: false
  }],
  orbit: {
    active: true,
    count: 3,
    radius: 2,
    centerX: 0,
    centerZ: 0,
    mutation: null,
    apotheosis: null
  },
  world: {
    minX: -20,
    maxX: 20,
    minZ: -20,
    maxZ: 20,
    pois: [{ id: 1, kind: 'vital', x: 4, z: 4, state: 'guarded', guardianId: elite.id }],
    obstacles: [{ id: 1, x: 3, z: 3, radius: 1, hp: -1, maxHp: -1, destructible: false }],
    bossSpawned: false,
    bossDefeated: false
  },
  chain: {
    beat: 1,
    cycle: 2,
    tempo: 0.5,
    slots,
    catalysts: ['source'],
    skillReserve: [],
    catalystReserve: [],
    catalystRuntime: [{ id: 'source' }]
  },
  skills: [runtime],
  resonance: {
    tempo: 0,
    multiplicity: 0,
    precision: 0,
    persistence: 0,
    conductivity: 0,
    mobility: 0
  },
  doctrines: {
    might: 0,
    size: 0,
    quantity: 0,
    duration: 0,
    mobility: 0,
    guard: 0,
    force: 0,
    precision: 0
  },
  metrics,
  eliteCore: 1,
  mutationCores: 0,
  rewardOffers: null,
  refusals: [refusal],
  mutationOffer: null,
  rerolls: 1,
  choiceSerial: 2
};

const builder = new SnapshotBuilder();
const snapshot = builder.build(input);
const view = snapshot.entities[0];

assert(view.refusalTitles[0] === 'Тесак' && view.refusalKinds[0] === 'skill' && view.refusalIcons[0] === '⌁',
  'refusal repertoire projection changed');
assert(view.echoPhase === 'tell' && view.echoSkill === 'cleaver',
  'Elite Echo presentation projection changed');
assert(view.regenerating && view.buffed && view.orderActive && view.squadTask === 'flank',
  'time-derived elite presentation flags changed');
assert(view.status.marked && view.status.ignited,
  'status projection changed');
assert(view.relicItems[0] === 'plating' && view.evolutionItems[0] === 'quickened',
  'elite growth channels collapsed in snapshot');
assert(snapshot.relics[0].contested && snapshot.relics[0].category === 'guard',
  'contested relic/category projection changed');
assert(snapshot.fields[0].faction === 'hero' && snapshot.fields[0].source === 'fire_field',
  'field presentation defaults changed');
assert(snapshot.projectiles[0].behavior === 'normal' && snapshot.projectiles[0].phase === 0,
  'projectile presentation defaults changed');

assert(snapshot.player !== input.player, 'player snapshot aliases live input');
assert(snapshot.entities[0].relicItems !== elite.relicItems, 'entity relic snapshot aliases runtime array');
assert(snapshot.chain.slots !== input.chain.slots, 'chain slots snapshot aliases runtime array');
assert(snapshot.refusals[0] !== refusal, 'refusal snapshot aliases runtime card');
assert(snapshot.metrics !== metrics, 'metrics snapshot aliases live metrics');
assert(snapshot.orbit !== input.orbit, 'orbit snapshot aliases live view');

runtime.level = 9;
elite.relicItems!.push('vitality');
assert(snapshot.skills[0].level === 2, 'skill snapshot changed after runtime mutation');
assert(snapshot.entities[0].relicItems.length === 1, 'entity snapshot changed after runtime mutation');

console.log('snapshot-builder-regression OK', {
  entities: snapshot.entities.length,
  contestedRelics: snapshot.relics.filter((relic) => relic.contested).length,
  echo: view.echoPhase
});
