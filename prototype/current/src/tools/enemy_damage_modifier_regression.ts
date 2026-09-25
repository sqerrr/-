import {
  EnemyDamageModifierSystem,
  type AffixDamageModifier,
  type EliteDamageModifier,
  type EnemyDamageModifierPort
} from '../core/enemyDamageModifierSystem.js';
import { makeEnt, type Ent } from '../core/state.js';
import type { SkillRuntime } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('enemy-damage-modifier-regression: ' + message);
}

const numeric = (value: number): number => value;

let now = 10;
let randomCalls = 0;
let derived = false;
const binder = makeEnt({
  id: 2,
  kind: 'binder',
  x: 0,
  z: 0,
  hp: 100,
  maxHp: 100,
  radius: 0.4,
  speed: 1,
  contactDps: 0
});
const runtimes = new Map<string, SkillRuntime>();
runtimes.set('rail_spear', {
  id: 'rail_spear',
  crit: 0.1,
  eliteDamage: 0.2
} as SkillRuntime);
runtimes.set('ember_lance', {
  id: 'ember_lance',
  crit: 0,
  eliteDamage: 0
} as SkillRuntime);

const eliteInputs: number[] = [];
const affixInputs: number[] = [];

const eliteDamage: EliteDamageModifier = {
  beforeDamage: (_entity, damage) => {
    eliteInputs.push(damage);
    return damage * 0.8;
  }
};
const affixDamage: AffixDamageModifier = {
  modifyIncomingDamage: (_entity, damage) => {
    affixInputs.push(damage);
    return damage * 0.5;
  }
};

const port: EnemyDamageModifierPort = {
  time: () => now,
  itemDamageMultiplier: () => 2,
  itemEliteDamageMultiplier: () => 1.5,
  itemCritBonus: () => 0.05,
  doctrinePrecision: () => 1,
  resonancePrecision: () => 2,
  supportsPrecision: () => true,
  randomFloat: () => {
    randomCalls++;
    return 0.1;
  },
  skillRuntime: (source) => runtimes.get(source),
  getAliveEntity: (id) => id === binder.id ? binder : undefined,
  derived: () => derived
};
const system = new EnemyDamageModifierSystem(port, eliteDamage, affixDamage);

const elite = makeEnt({
  id: 1,
  kind: 'elite',
  x: 0,
  z: 0,
  hp: 1000,
  maxHp: 1000,
  radius: 1,
  speed: 1,
  contactDps: 0
});
elite.relicDamageTakenMul = 1.1;
elite.markUntil = 20;
elite.exposedUntil = 20;
elite.linkedTo = binder.id;

const result = system.resolve(elite, 100, 'rail_spear', true, 5, 0);
assert(result.scaledBase === 300, 'item/base elite scaling order changed');
assert(randomCalls === 1, 'skill crit RNG cadence changed');
assert(Math.abs(eliteInputs[0] - 693) < 1e-9,
  'elite chassis response moved before relic/skill/crit modifiers');
assert(Math.abs(affixInputs[0] - 632.4318) < 1e-6,
  'affix response moved before mark/exposed/binder modifiers');
assert(Math.abs(result.actual - 316.2159) < 1e-6,
  'full incoming-damage modifier order changed');
assert(elite.markUntil === 0, 'non-Ember hit stopped consuming mark');
assert(!result.crit,
  'crit presentation contract changed when later target mitigation suppresses the final hit');

// Ember deliberately does not consume its own mark.
const marked = makeEnt({
  id: 3,
  kind: 'footnote',
  x: 0,
  z: 0,
  hp: 100,
  maxHp: 100,
  radius: 0.4,
  speed: 1,
  contactDps: 0
});
marked.markUntil = 20;
const ember = system.resolve(marked, 10, 'ember_lance', false, 0, 0);
assert(marked.markUntil === 20, 'Ember started consuming its own mark');
assert(ember.skill?.id === 'ember_lance', 'skill identity was lost in modifier result');

// Non-skill derived damage never rolls crit and still tells elite response that it is derived.
let sawDerived = false;
const derivedSystem = new EnemyDamageModifierSystem(
  {
    ...port,
    randomFloat: () => {
      throw new Error('derived non-skill damage rolled crit RNG');
    },
    skillRuntime: () => undefined,
    derived: () => true
  },
  {
    beforeDamage: (_entity, damage, skill, isDerived) => {
      sawDerived = skill === null && isDerived;
      return damage;
    }
  },
  { modifyIncomingDamage: (_entity, damage) => damage }
);
const normal = makeEnt({
  id: 4,
  kind: 'footnote',
  x: 0,
  z: 0,
  hp: 100,
  maxHp: 100,
  radius: 0.4,
  speed: 1,
  contactDps: 0
});
const derivedResult = derivedSystem.resolve(normal, 20, 'backdraft', false, 0, 0);
assert(sawDerived, 'derived flag no longer reaches elite response stage');
assert(!derivedResult.skill && !derivedResult.crit, 'non-skill derived hit gained skill/crit identity');
assert(numeric(derivedResult.actual) === 40, 'generic item multiplier changed for derived damage');

console.log('enemy-damage-modifier-regression OK', {
  actual: result.actual,
  scaledBase: result.scaledBase,
  randomCalls,
  eliteInput: eliteInputs[0],
  affixInput: affixInputs[0]
});
