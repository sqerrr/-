import { itemOrder } from '../content/items.js';
import { ProgressionRuntime } from '../core/progressionRuntime.js';
import type { RewardOffer } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('progression-runtime-regression: ' + message);
}
function close(actual: number, expected: number, message: string) {
  assert(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, got ${actual}`);
}
function offer(kind: RewardOffer['kind'], patch: Partial<RewardOffer> = {}): RewardOffer {
  return {
    id: `${kind}:test`,
    kind,
    title: kind,
    subtitle: 'test',
    description: 'test',
    ...patch
  };
}

const state = {
  choice: false,
  mutationCores: 0,
  evolvable: true,
  eliteCore: 0,
  xp: 0,
  xpNeed: 14,
  level: 1,
  levels: 0,
  rerolls: 1,
  offers: null as RewardOffer[] | null,
  actions: [] as string[],
  refusals: [] as RewardOffer[][],
  rewardTitles: [] as string[]
};

const runtime = new ProgressionRuntime({
  hasChoice: () => state.choice,
  mutationCores: () => state.mutationCores,
  hasEvolvableSkill: () => state.evolvable,
  openMutationTargets: () => state.actions.push('mutation-targets'),

  eliteCore: () => state.eliteCore,
  spendEliteCore: (amount) => {
    state.eliteCore -= amount;
    state.actions.push(`spend-core:${amount}`);
  },
  openEliteCache: () => state.actions.push('elite-cache'),

  xp: () => state.xp,
  xpNeed: () => state.xpNeed,
  spendXp: (amount) => {
    state.xp -= amount;
    state.actions.push(`spend-xp:${amount}`);
  },
  addXp: (amount) => {
    state.xp += amount;
    state.actions.push(`add-xp:${amount}`);
  },
  level: () => state.level,
  setLevel: (value) => {
    state.level = value;
    state.actions.push(`set-level:${value}`);
  },
  setXpNeed: (value) => {
    state.xpNeed = value;
    state.actions.push(`set-xp-need:${value}`);
  },
  noteLevel: () => {
    state.levels++;
    state.actions.push('note-level');
  },
  openLevelOffers: () => state.actions.push('level-offers'),
  emitLevelUp: (level) => state.actions.push(`level-up:${level}`),

  takeReward: (index) => {
    if (!state.offers || index < 0 || index >= state.offers.length) return null;
    const offers = state.offers;
    const selected = offers[index];
    state.offers = null;
    return { offers, offer: selected };
  },
  rewardOffers: () => state.offers,
  clearRewards: () => {
    const offers = state.offers;
    state.offers = null;
    return offers;
  },
  rerolls: () => state.rerolls,
  spendReroll: () => {
    state.rerolls--;
    state.actions.push('spend-reroll');
  },

  beginMutationTarget: () => state.actions.push('begin-mutation-target'),
  openMutation: (skill) => state.actions.push(`open-mutation:${skill}`),
  grantItem: (item) => state.actions.push(`item:${item}`),
  swapInSkill: (skill, slot) => {
    state.actions.push(`swap:${skill}:${slot}`);
    return skill !== 'rail_spear';
  },
  addSkill: (skill) => {
    state.actions.push(`skill:${skill}`);
    return true;
  },
  placeCatalyst: (id) => {
    state.actions.push(`catalyst:${id}`);
    return true;
  },
  applyDoctrine: (id, amount) => state.actions.push(`doctrine:${id}:${amount}`),
  applyCoreAxis: (id, amount) => state.actions.push(`axis:${id}:${amount}`),
  applyGlobal: (stat, amount) => state.actions.push(`global:${stat ?? 'none'}:${amount}`),

  emitRewardChosen: (title) => state.rewardTitles.push(title),
  concedeRefusal: (passed) => state.refusals.push(passed)
});

const clearTrace = () => {
  state.actions.length = 0;
  state.refusals.length = 0;
  state.rewardTitles.length = 0;
};

// Active choice blocks every progression currency.
state.choice = true;
state.mutationCores = 1;
state.eliteCore = 5;
state.xp = 99;
runtime.check();
assert(state.actions.length === 0, 'active choice no longer blocks progression');
state.choice = false;

// Mutation target has priority over elite cache and XP.
runtime.check();
assert(state.actions.join('|') === 'mutation-targets', 'mutation progression lost top priority');
clearTrace();

// Elite cache is second and spends exactly five cores.
state.mutationCores = 0;
state.eliteCore = 7;
runtime.check();
assert(state.eliteCore === 2, 'elite cache core cost changed');
assert(state.actions.join('|') === 'spend-core:5|elite-cache', 'elite cache ordering changed');
clearTrace();

// XP level-up is last, spends the old threshold and computes the next one before opening offers.
state.eliteCore = 0;
state.xp = 20;
state.xpNeed = 14;
state.level = 1;
state.levels = 0;
runtime.check();
assert(state.xp === 6, 'XP threshold spend changed');
assert(state.level === 2 && state.levels === 1, 'level accounting changed');
assert(state.xpNeed === ProgressionRuntime.nextXpNeed(2) && state.xpNeed === 17,
  'next XP threshold formula changed');
assert(state.actions.join('|') ===
  'spend-xp:14|set-level:2|note-level|set-xp-need:17|level-offers|level-up:2',
  'level-up operation ordering changed');
clearTrace();

// Mutation targets transfer control to MutationChoiceSystem and intentionally emit no RewardChosen/refusal.
state.offers = [offer('mutation_target', { skill: 'cleaver' })];
assert(runtime.chooseReward(0), 'mutation target was not accepted');
assert(state.actions.join('|') === 'begin-mutation-target|open-mutation:cleaver',
  'mutation target handoff changed');
assert(Number(state.rewardTitles.length) === 0 && Number(state.refusals.length) === 0,
  'mutation target started resolving as an ordinary reward');
clearTrace();

// Doctrine-only choice applies the doctrine but does not concede a refusal.
state.offers = [
  offer('doctrine', { doctrine: 'might', amount: 2, title: 'Сила' }),
  offer('doctrine', { doctrine: 'guard', amount: 1 })
];
assert(runtime.chooseReward(0), 'doctrine reward failed');
assert(state.actions.join('|') === 'doctrine:might:2', 'doctrine dispatch changed');
assert(state.rewardTitles[0] === 'Сила', 'RewardChosen title changed');
assert(Number(state.refusals.length) === 0, 'doctrine-only choice incorrectly conceded a refusal');
clearTrace();

// Non-doctrine choices concede every unchosen card to the refusal selector.
state.offers = [
  offer('global', { stat: 'hp', amount: 18, title: 'Закалка' }),
  offer('resonance', { resonance: 'tempo', amount: 1, title: 'Темп' })
];
assert(runtime.chooseReward(0), 'global reward failed');
assert(state.actions.join('|') === 'global:hp:18', 'global dispatch changed');
assert(Number(state.refusals.length) === 1 && Number(state.refusals[0].length) === 1 &&
  state.refusals[0][0].title === 'Темп', 'passed-card refusal set changed');
clearTrace();

// Item, skill, catalyst and resonance dispatch keep their dedicated mechanics.
for (const [candidate, expected] of [
  [offer('item_grant', { item: itemOrder[0] }), `item:${itemOrder[0]}`],
  [offer('skill_add', { skill: 'cleaver' }), 'skill:cleaver'],
  [offer('catalyst_add', { catalyst: 'source' }), 'catalyst:source'],
  [offer('resonance', { resonance: 'tempo', amount: 2 }), 'axis:tempo:2']
] as const) {
  state.offers = [candidate, offer('global')];
  assert(runtime.chooseReward(0), 'typed reward dispatch failed for ' + candidate.kind);
  assert(state.actions[0] === expected, 'wrong dispatch for ' + candidate.kind);
  clearTrace();
}

// A failed swap keeps the historical semantics: the choice was already consumed, but no event/refusal fires.
state.offers = [offer('skill_swap', { skill: 'rail_spear', swapSlot: 2 }), offer('global')];
assert(!runtime.chooseReward(0), 'failed swap incorrectly succeeded');
assert(state.offers === null, 'failed swap no longer consumes the opened choice');
assert(Number(state.rewardTitles.length) === 0 && Number(state.refusals.length) === 0,
  'failed swap emitted post-apply choice effects');
clearTrace();

// Reroll is allowed only for ordinary reward windows and consumes one reroll before reopening level offers.
state.rerolls = 1;
state.offers = [offer('doctrine')];
assert(runtime.rerollRewards(), 'ordinary reward could not reroll');
assert(Number(state.rerolls) === 0, 'reroll charge was not consumed');
assert(state.actions.join('|') === 'spend-reroll|level-offers', 'reroll ordering changed');
clearTrace();
state.rerolls = 1;
state.offers = [offer('elite')];
assert(!runtime.rerollRewards() && Number(state.rerolls) === 1,
  'elite cache became rerollable');
clearTrace();

// Skip refunds 30% of the current XP threshold, emits the skip event, and concedes the whole window.
state.xp = 0;
state.xpNeed = 20;
state.offers = [offer('resonance'), offer('global')];
assert(runtime.skipReward(), 'ordinary reward could not be skipped');
close(state.xp, 6, 'skip XP refund');
assert(String(state.rewardTitles[0]) === 'Пропуск награды', 'skip event title changed');
assert(Number(state.refusals.length) === 1 && Number(state.refusals[0].length) === 2,
  'skip no longer concedes the full passed window');
clearTrace();
state.offers = [offer('skill_add', { skill: 'cleaver' })];
assert(!runtime.skipReward(), 'discovery reward became skippable');

console.log('progression-runtime-regression OK', {
  nextXpNeed: ProgressionRuntime.nextXpNeed(2),
  level: state.level,
  skipXp: state.xp,
  dispatch: true
});
