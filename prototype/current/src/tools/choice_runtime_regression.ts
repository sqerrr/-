import { ChoiceRuntime } from '../core/choiceRuntime.js';
import type { MutationOffer, RewardOffer } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('choice-runtime-regression: ' + message);
}

const numeric = (value: number): number => value;
const runtime = new ChoiceRuntime();

const rewards: RewardOffer[] = [
  { id: 'a', kind: 'doctrine', title: 'A', subtitle: '', description: '', doctrine: 'might' },
  { id: 'b', kind: 'doctrine', title: 'B', subtitle: '', description: '', doctrine: 'guard' }
];

assert(!runtime.hasChoice && runtime.serial === 0, 'choice runtime did not start empty');
assert(runtime.mutationRefusalToken, 'one-run mutation refusal token did not start available');

runtime.openRewards(rewards);
assert(runtime.hasChoice, 'opening rewards did not create an active choice');
assert(runtime.serial === 1, 'reward open did not advance choice serial');
assert(runtime.rewardOffers === rewards, 'reward runtime copied/replaced the authored offer array');

assert(runtime.takeReward(99) === null, 'invalid reward index unexpectedly resolved');
assert(runtime.rewardOffers === rewards, 'invalid reward index closed the window');

const selected = runtime.takeReward(1);
assert(selected?.offer === rewards[1] && selected.offers === rewards,
  'reward resolution lost selected/original offer set');
assert(!runtime.rewardOffers && !runtime.hasChoice, 'resolved reward window stayed open');
assert(numeric(runtime.serial) === 1, 'closing reward window changed serial');

// Skip-style close returns all passed cards but does not create a new UI serial.
runtime.openRewards(rewards);
const beforeClearSerial = runtime.serial;
const passed = runtime.clearRewards();
assert(passed === rewards && !runtime.hasChoice, 'clearRewards did not return/close current offers');
assert(numeric(runtime.serial) === beforeClearSerial, 'closing reward window unexpectedly advanced serial');

const mutation: MutationOffer = {
  skill: 'frost_ring',
  choices: ['frost_front', 'frost_snap', 'frost_drift'],
  refusalAvailable: true,
  tier: 1
};
runtime.openMutation(mutation);
assert(runtime.hasChoice && runtime.mutationOffer === mutation,
  'mutation modal did not become active');
assert(runtime.mutationChoice(0) === 'frost_front' && runtime.mutationChoice(9) === null,
  'mutation choice lookup changed');
assert(runtime.canRefuseMutation(), 'fresh Tier I mutation cannot use refusal token');

runtime.beginMutationTarget();
assert(runtime.pendingMutationTarget, 'mutation target did not arm pending core consumption');
assert(runtime.consumeMutationTarget(), 'pending mutation target was not consumed');
assert(!runtime.pendingMutationTarget && !runtime.consumeMutationTarget(),
  'pending mutation target consumed more than once');

const serialBeforeRefusal = runtime.serial;
assert(runtime.replaceMutationChoice(1, 'frost_whiteout'),
  'mutation refusal replacement was rejected');
assert(runtime.mutationOffer?.choices[1] === 'frost_whiteout',
  'mutation refusal did not replace requested branch');
assert(!runtime.mutationRefusalToken && !runtime.mutationOffer?.refusalAvailable,
  'mutation refusal token/modal availability was not consumed together');
assert(runtime.serial === serialBeforeRefusal + 1,
  'mutation refusal did not invalidate UI serial');
assert(!runtime.canRefuseMutation() && !runtime.replaceMutationChoice(0, 'frost_front'),
  'one-run mutation refusal token could be reused');

runtime.closeMutation();
assert(!runtime.hasChoice && runtime.mutationOffer === null,
  'closing mutation modal left an active choice');

console.log('choice-runtime-regression OK', {
  serial: runtime.serial,
  refusalAvailable: runtime.mutationRefusalToken,
  pendingMutationTarget: runtime.pendingMutationTarget
});
