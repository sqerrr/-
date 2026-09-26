import { RefusalLedger } from '../core/refusalLedger.js';
import type { RewardOffer } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('refusal-ledger-regression: ' + message);
}

const random: number[] = [];
const calls: number[] = [];
const ledger = new RefusalLedger((max) => {
  calls.push(max);
  const raw = random.shift() ?? 0;
  return Math.max(0, Math.min(max - 1, raw));
});

const skill: RewardOffer = {
  id: 's',
  kind: 'skill_add',
  title: 'Феномен',
  subtitle: '',
  description: '',
  skill: 'rail_spear'
};
const catalyst: RewardOffer = {
  id: 'c',
  kind: 'catalyst_add',
  title: 'Катализатор',
  subtitle: '',
  description: '',
  catalyst: 'source'
};
const item: RewardOffer = {
  id: 'i',
  kind: 'item_grant',
  title: 'Предмет',
  subtitle: '',
  description: '',
  item: 'plating'
};
const axis: RewardOffer = {
  id: 'a',
  kind: 'resonance',
  title: 'Ось',
  subtitle: '',
  description: '',
  resonance: 'mobility'
};
const global: RewardOffer = {
  id: 'g',
  kind: 'global',
  title: 'Броня',
  subtitle: '',
  description: '',
  stat: 'armor',
  amount: 10
};

// Reward -> refusal conversion preserves mechanical payload and authored compact icon.
{
  const s = ledger.fromOffer(skill);
  const c = ledger.fromOffer(catalyst);
  const i = ledger.fromOffer(item);
  const a = ledger.fromOffer(axis);
  const g = ledger.fromOffer(global);

  assert(s?.kind === 'skill' && s.skill === 'rail_spear' && !!s.icon,
    'skill refusal conversion changed');
  assert(c?.kind === 'catalyst' && c.catalyst === 'source' && !!c.icon,
    'Catalyst refusal conversion changed');
  assert(i?.kind === 'item' && i.item === 'plating' && !!i.icon,
    'item refusal conversion changed');
  assert(a?.kind === 'axis' && a.resonance === 'mobility' && a.amount === 1 && a.icon === 'ПОДВ',
    'axis refusal conversion/default amount changed');
  assert(g?.kind === 'global' && g.stat === 'armor' && g.amount === 10 && g.icon === 'БРОН',
    'global refusal conversion changed');
}

// A marked displayed offer wins without consuming fallback refusal RNG.
{
  const marked = { ...catalyst, marked: true };
  const beforeCalls = calls.length;
  const card = ledger.concede([skill, marked, item]);
  assert(card?.kind === 'catalyst' && card.catalyst === 'source',
    'marked refusal target stopped taking priority');
  assert(card.serial === 1, 'first refusal serial changed');
  assert(calls.length === beforeCalls,
    'marked refusal unexpectedly consumed fallback RNG');
}

// Without a mark, the dedicated stream selects exactly one convertible card.
{
  random.push(1);
  const beforeCalls = calls.length;
  const card = ledger.concede([skill, item, global]);
  assert(card?.kind === 'item' && card.item === 'plating',
    'fallback refusal RNG selected a different card');
  assert(card.serial === 2, 'refusal serial did not advance monotonically');
  assert(calls.length === beforeCalls + 1 && calls.at(-1) === 3,
    'fallback refusal RNG cadence/bounds changed');
}

// Non-convertible offers do not create history or consume RNG.
{
  const mutationTarget: RewardOffer = {
    id: 'm',
    kind: 'mutation_target',
    title: 'Мутация',
    subtitle: '',
    description: ''
  };
  const beforeCards = ledger.all().length;
  const beforeCalls = calls.length;
  assert(ledger.concede([mutationTarget]) === null,
    'non-convertible offer unexpectedly became a refusal');
  assert(ledger.all().length === beforeCards && calls.length === beforeCalls,
    'empty refusal conversion mutated history/RNG');
}

// Elites intentionally mutate heldBy on the live ledger record.
{
  const first = ledger.all()[0];
  first.heldBy = 77;
  assert(ledger.all()[0].heldBy === 77,
    'refusal ledger stopped exposing live heldBy ownership');
}

// Elite-cache marking uses the same dedicated refusal stream through pickIndex.
{
  random.push(2);
  assert(ledger.pickIndex(4) === 2 && calls.at(-1) === 4,
    'shared refusal selection stream changed');
}

console.log('refusal-ledger-regression OK', {
  cards: ledger.all().length,
  serials: ledger.all().map((card) => card.serial),
  randomCalls: calls
});
