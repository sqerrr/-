import {
  catalystPairCompatible,
  catalysts,
  doctrines,
  resonance,
  skills
} from '../content/definitions.js';
import { RewardOfferFactory, type RewardOfferFactoryPort } from '../core/rewardOfferFactory.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('reward-offer-factory-regression: ' + message);
}

const calls: string[] = [];
let u32 = 100;
const intQueue: number[] = [];
const floatQueue: number[] = [];
const slots = ['rail_spear', 'toxic_mist', 'cleaver', null] as const;
const resonanceLevels = { tempo: 2, multiplicity: 1, precision: 0, persistence: 0, conductivity: 3 };
const doctrineLevels = {
  might: 2, size: 0, quantity: 1, duration: 0,
  mobility: 0, guard: 3, force: 0, precision: 1
};

const port: RewardOfferFactoryPort = {
  randomInt: (max) => {
    calls.push('int:' + max);
    const value = intQueue.shift() ?? 0;
    return Math.max(0, Math.min(max - 1, value));
  },
  randomFloat: () => {
    calls.push('float');
    return floatQueue.shift() ?? 0;
  },
  nextU32: () => {
    calls.push('u32');
    return u32++;
  },
  fortune: () => 0,
  resonanceLevel: (id) => resonanceLevels[id],
  doctrineLevel: (id) => doctrineLevels[id],
  slots: () => slots,
  catalystCompatibleEdges: (id) =>
    catalystPairCompatible(id, slots[0], slots[1]) ? [0] : []
};
const factory = new RewardOfferFactory(port);

// Explicit resonance/doctrine construction must not consume an unnecessary randomInt.
calls.length = 0;
const axis = factory.resonance('tempo');
assert(axis.kind === 'resonance' && axis.title === resonance.tempo.name,
  'resonance offer identity changed');
assert(axis.before === '2' && axis.after === '3' && axis.amount === 1,
  'resonance before/after semantics changed');
assert(calls.join(',') === 'u32', 'explicit resonance offer changed RNG cadence');

calls.length = 0;
const doctrine = factory.doctrine('guard');
assert(doctrine.kind === 'doctrine' && doctrine.title === doctrines.guard.name,
  'doctrine offer identity changed');
assert(doctrine.before === '3' && doctrine.after === '4',
  'doctrine before/after semantics changed');
assert(calls.join(',') === 'u32', 'explicit doctrine offer changed RNG cadence');

// Discovery cards keep concrete Russian player-facing text and stable skill identity.
calls.length = 0;
const add = factory.skillAdd('frost_ring');
assert(add.kind === 'skill_add' && add.title === skills.frost_ring.name,
  'skill discovery identity changed');
assert(add.description.includes(skills.frost_ring.description),
  'skill discovery lost base description');
assert(calls.join(',') === 'u32', 'skill discovery changed RNG cadence');

// Swap chooses one active slot first, then allocates the offer id.
calls.length = 0;
intQueue.push(2);
const swap = factory.skillSwap('frost_ring');
assert(swap.kind === 'skill_swap' && swap.swapSlot === 2,
  'skill swap slot selection changed');
assert(swap.subtitle.includes(skills.cleaver.name),
  'skill swap no longer names the leaving Phenomenon');
assert(calls[0] === 'int:4' && calls[1] === 'u32',
  'skill swap RNG ordering changed');

// Catalyst card copy is derived from the actual compatible edge supplied by progression.
calls.length = 0;
const catalyst = factory.catalystAdd('source');
assert(catalyst.kind === 'catalyst_add' && catalyst.title === catalysts.source.name,
  'Catalyst offer identity changed');
if (catalystPairCompatible('source', slots[0], slots[1])) {
  assert(
    catalyst.description.includes(skills.rail_spear.shortName) &&
    catalyst.description.includes(skills.toxic_mist.shortName),
    'Catalyst offer stopped showing a live compatible pair'
  );
}
assert(calls.join(',') === 'u32', 'Catalyst card changed RNG cadence');

// Global reward preserves stat-roll -> rarity-roll -> id order.
calls.length = 0;
intQueue.push(0);
floatQueue.push(0);
const global = factory.global();
assert(global.kind === 'global' && global.stat === 'hp' && global.title === 'Закалка',
  'global HP reward branch changed');
assert(global.amount && global.amount > 0, 'global HP reward lost amount');
assert(
  calls.length === 3 &&
  calls[0] === 'int:4' &&
  calls[1] === 'float' &&
  calls[2] === 'u32',
  'global reward RNG cadence changed'
);

console.log('reward-offer-factory-regression OK', {
  resonance: axis.title,
  doctrine: doctrine.title,
  discovery: add.title,
  swapSlot: swap.swapSlot,
  catalyst: catalyst.title,
  global: global.title
});
