import {
  RivalDamageModifierSystem,
  type RivalDamageModifierPort
} from '../core/rivalDamageModifierSystem.js';
import { makeEnt } from '../core/state.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('rival-damage-modifier-regression: ' + message);
}

let randomCalls = 0;
const port: RivalDamageModifierPort = {
  armor: () => 25,
  itemDamageTakenMultiplier: () => 0.8,
  itemRefusalDamageMultiplier: () => 1.5,
  randomFloat: () => {
    randomCalls++;
    return 0.1;
  },
  rivalAxisCount: (_entity, axis) =>
    axis === 'precision' ? 1 : axis === 'multiplicity' ? 2 : 0
};
const system = new RivalDamageModifierSystem(port);

const attacker = makeEnt({
  id: 7,
  kind: 'elite',
  x: 0,
  z: 0,
  hp: 1000,
  maxHp: 1000,
  radius: 1,
  speed: 1,
  contactDps: 0
});
attacker.relicCritChance = 0.5;
attacker.relicCastMul = 1.5;
attacker.groundRelicCastMul = 1.25;

const result = system.resolve(attacker, 100, 1.2);
const beforeItems =
  100 *
  1.2 *
  1.5 *
  1.6 *
  Math.pow(1.3, 1) *
  Math.pow(1.16, 2);
const expectedAmount = beforeItems * 1.5;
const withoutGround = beforeItems * (1.5 / 1.25);
const expectedAmplification =
  (expectedAmount - withoutGround) *
  (1 - 25 / 125) *
  0.8;

assert(randomCalls === 1, 'rival relic crit RNG cadence changed');
assert(Math.abs(result.amount - expectedAmount) < 1e-9,
  'rival concentration/refusal/crit/axis/relic scaling order changed');
assert(Math.abs(result.itemAmplifiedDamage - expectedAmplification) < 1e-9,
  'ground-relic D52 attribution formula changed');

// An attacker with no ground-specific share still receives total relicCastMul but reports no
// ground-item attribution.
attacker.relicCritChance = 0;
attacker.relicCastMul = 1.4;
attacker.groundRelicCastMul = 1;
randomCalls = 0;
const noGround = system.resolve(attacker, 20, 1);
assert(randomCalls === 0, 'zero rival crit chance still consumed RNG');
assert(noGround.itemAmplifiedDamage === 0,
  'non-ground rival power was incorrectly attributed to captured ground relics');
assert(noGround.amount > 20, 'rival modifiers stopped scaling the attack');

// Ownerless hostile damage bypasses all rival-owner scaling exactly as before.
randomCalls = 0;
const ownerless = system.resolve(null, 33, 9);
assert(ownerless.amount === 33 && ownerless.itemAmplifiedDamage === 0,
  'ownerless damage started using rival concentration/items');
assert(randomCalls === 0, 'ownerless damage consumed rival crit RNG');

console.log('rival-damage-modifier-regression OK', {
  amount: result.amount,
  itemAmplifiedDamage: result.itemAmplifiedDamage,
  ownerless: ownerless.amount
});
