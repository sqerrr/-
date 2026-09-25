import { ActivationRuntime } from '../core/activationRuntime.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('activation-runtime-regression: ' + message);
}

const numeric = (value: number): number => value;

const activation = new ActivationRuntime();

// A fresh beat owns one isolated score frame while the previous chain context survives.
activation.begin(1);
activation.recordHit(10, 24);
activation.recordHit(10, 6);
activation.recordHit(11, 8);
activation.recordKill(5);
activation.addControl(2.5);
activation.noteState('chill');
activation.noteState('mark');
assert(activation.hits.size === 2, 'hit identity set no longer de-duplicates entities');
assert(activation.damage === 38, 'repeated hits stopped contributing to activation damage');
assert(activation.kills === 1 && activation.overkill === 5, 'kill/overkill score changed');
assert(activation.control === 2.5, 'activation control score changed');
assert(activation.producedState === 'chill', 'first produced state no longer wins');

// Publishing copies score/context and returns the prior context for Catalyst compatibility.
const prior = activation.publishContext('frost_ring', 3, 4, null);
assert(prior.skill === null, 'first publish did not return the empty previous context');
assert(
  activation.context.skill === 'frost_ring' &&
  activation.context.damage === 38 &&
  activation.context.hitIds.length === 2 &&
  activation.context.x === 3 &&
  activation.context.z === 4,
  'published activation context changed'
);

// Legacy derived casts temporarily alter routing but contribute to the same outer score frame.
activation.withDerived({ slot: 2, scale: 0.75 }, () => {
  assert(activation.slot === 2 && activation.scale === 0.75 && activation.derived,
    'derived scope was not applied');
  activation.recordHit(12, 7);
});
assert(numeric(activation.slot) === 1 && numeric(activation.scale) === 1 && !activation.derived,
  'derived scope did not restore routing modifiers');
assert(numeric(activation.damage) === 45 && activation.hits.has(12),
  'derived work stopped contributing to its outer activation');

// Physical Catalyst payloads instead receive a detached score frame and restore the exact parent.
const parent = activation.suspend();
activation.begin(3, true);
activation.recordHit(99, 100);
activation.addControl(9);
assert(activation.derived && activation.hits.size === 1 && activation.damage === 100,
  'nested physical payload did not get an isolated frame');
activation.restore(parent);
assert(
  numeric(activation.slot) === 1 &&
  numeric(activation.damage) === 45 &&
  numeric(activation.control) === 2.5 &&
  activation.hits.has(10) &&
  !activation.hits.has(99),
  'parent activation frame was corrupted by nested payload'
);

// End only clears transient routing; the completed score remains readable until the next begin.
activation.end();
assert(numeric(activation.slot) === -1 && numeric(activation.scale) === 1 && numeric(activation.countBonus) === 0 && !activation.derived,
  'activation end did not clear transient routing');
assert(numeric(activation.damage) === 45, 'activation end erased completed score too early');

activation.clearContext(8, 9);
assert(
  activation.context.skill === null &&
  activation.context.hitIds.length === 0 &&
  numeric(activation.context.x) === 8 &&
  numeric(activation.context.z) === 9,
  'chain context reset changed'
);

console.log('activation-runtime-regression OK', {
  damage: activation.damage,
  hits: activation.hits.size,
  contextSkill: activation.context.skill
});
