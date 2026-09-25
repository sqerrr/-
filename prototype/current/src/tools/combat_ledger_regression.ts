import { CombatLedger, type CombatLedgerPort } from '../core/combatLedger.js';
import { makeEnt } from '../core/state.js';
import type { EliteEncounter, Metrics, SkillId } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('combat-ledger-regression: ' + message);
}

let now = 12;
const metrics = { damage: 0, eliteDamage: 0 } as Metrics;
const encounter: EliteEncounter = {
  id: 10,
  chassis: 'bulwark',
  rarity: 'common',
  spawnedAt: 2,
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
const slots: (SkillId | null)[] = ['rail_spear', 'cleaver', 'toxic_mist'];

const port: CombatLedgerPort = {
  time: () => now,
  metrics: () => metrics,
  eliteEncounter: (entityId) => entityId === encounter.id ? encounter : undefined,
  slotIndex: (skill) => slots.indexOf(skill)
};
const ledger = new CombatLedger(port);

const normal = makeEnt({
  id: 1,
  kind: 'footnote',
  x: 0,
  z: 0,
  hp: 100,
  maxHp: 100,
  radius: 0.4,
  speed: 1,
  contactDps: 0
});
ledger.recordEnemyHit(normal, 'rail_spear', 25, 0);
ledger.recordEnemyHit(normal, 'rail_spear', 5, 0);
ledger.recordKill('rail_spear');

const elite = makeEnt({
  id: encounter.id,
  kind: 'elite',
  x: 0,
  z: 0,
  hp: 1000,
  maxHp: 1000,
  radius: 1,
  speed: 1,
  contactDps: 0
});
ledger.recordEnemyHit(elite, 'cleaver', 80, 1);
assert(metrics.damage === 110, 'total resolved damage accounting changed');
assert(metrics.eliteDamage === 80, 'elite damage accounting changed');
assert(encounter.damageFromHero === 80, 'elite encounter damage total changed');
assert(encounter.damageFromHeroByNode['1:cleaver'] === 80, 'direct slot attribution changed');
assert(encounter.engagedAt === 12 && encounter.lastExchangeAt === 12,
  'elite engagement timestamps changed');

now = 13;
ledger.recordEnemyHit(elite, 'toxin_dot', 20, -1);
assert(encounter.damageFromHeroByNode['2:toxic_mist'] === 20,
  'delayed damage no longer resolves to its owning Phenomenon slot');
assert(encounter.lastExchangeAt === 13, 'last exchange timestamp stopped advancing');

ledger.recordEnemyHit(elite, 'backdraft', 7, -1);
assert(encounter.damageFromHeroByNode['derived:backdraft'] === 7,
  'unknown derived damage attribution changed');

const telemetry = ledger.telemetry();
assert(telemetry.damageBySource.rail_spear === 30, 'damage-by-source aggregation changed');
assert(telemetry.hitsBySource.rail_spear === 2, 'hit-by-source aggregation changed');
assert(telemetry.killsBySource.rail_spear === 1, 'kill-by-source aggregation changed');
assert(telemetry.damageBySource.toxin_dot === 20 && telemetry.damageBySource.backdraft === 7,
  'derived damage sources disappeared from diagnostics');

console.log('combat-ledger-regression OK', {
  telemetry,
  encounterDamage: encounter.damageFromHero,
  nodes: encounter.damageFromHeroByNode
});
