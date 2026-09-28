import { activeSkillOrder } from '../content/definitions.js';
import { ProgressionComposition } from '../core/progressionComposition.js';
import type {
  CatalystId,
  CatalystRuntime,
  DoctrineId,
  ItemId,
  ResonanceId,
  RewardOffer,
  SkillId,
  SkillRuntime
} from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('progression-composition-regression: ' + message);
}

function runtime(id: SkillId): SkillRuntime {
  return {
    id,
    level: 1,
    power: 0,
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
}

let rng = 0;
const slots: (SkillId | null)[] = ['cleaver', null, null, null];
const skillReserve: (SkillId | null)[] = [null];
const catalysts: (CatalystId | null)[] = [null, null, null];
const catalystReserve: (CatalystId | null)[] = [null, null];
const skillStates = new Map<SkillId, SkillRuntime>([['cleaver', runtime('cleaver')]]);
const catalystStates = new Map<CatalystId, CatalystRuntime>();

const state = {
  fortune: 0,
  mutationCores: 0,
  eliteCore: 0,
  xp: 0,
  xpNeed: 14,
  level: 1,
  rerolls: 1,
  capacitorResets: 0,
  mutations: 0,
  levelEvents: [] as number[],
  mutationEvents: [] as string[],
  rareEvents: [] as string[],
  chosen: [] as string[],
  refusals: [] as RewardOffer[][],
  growth: [] as string[]
};

const composition = new ProgressionComposition({
  randomInt: (maxExclusive) => {
    if (maxExclusive <= 0) return 0;
    const value = rng % maxExclusive;
    rng++;
    return value;
  },
  randomFloat: () => {
    rng++;
    return 0.25;
  },
  nextU32: () => ++rng,
  refusalInt: (maxExclusive) => Math.max(0, maxExclusive - 1),
  fortune: () => state.fortune,
  resonanceLevel: (_id: ResonanceId) => 0,
  doctrineLevel: (_id: DoctrineId) => 0,
  slots: () => slots,
  skillReserve: () => skillReserve,
  catalysts: () => catalysts,
  catalystReserve: () => catalystReserve,
  newSkill: (id) => runtime(id),
  skillState: (id) => {
    const value = skillStates.get(id);
    if (!value) throw new Error('missing skill runtime: ' + id);
    return value;
  },
  setSkillRuntime: (id, value) => { skillStates.set(id, value); },
  deleteSkillRuntime: (id) => { skillStates.delete(id); },
  setCatalystRuntime: (id, value) => { catalystStates.set(id, value); },
  mutationCores: () => state.mutationCores,
  setMutationCores: (value) => { state.mutationCores = value; },
  resetCapacitor: () => { state.capacitorResets++; },
  noteMutation: () => { state.mutations++; },
  emitMutationChosen: (skill, mutation) => state.mutationEvents.push(skill + ':' + mutation),
  emitRareEvent: (title, detail) => state.rareEvents.push(title + ':' + detail),
  eliteCore: () => state.eliteCore,
  spendEliteCore: (amount) => { state.eliteCore -= amount; },
  xp: () => state.xp,
  xpNeed: () => state.xpNeed,
  spendXp: (amount) => { state.xp -= amount; },
  addXp: (amount) => { state.xp += amount; },
  level: () => state.level,
  setLevel: (value) => { state.level = value; },
  setXpNeed: (value) => { state.xpNeed = value; },
  noteLevel: () => {},
  emitLevelUp: (level) => state.levelEvents.push(level),
  rerolls: () => state.rerolls,
  spendReroll: () => { state.rerolls--; },
  grantItem: (item: ItemId) => state.growth.push('item:' + item),
  applyDoctrine: (id, amount) => state.growth.push('doctrine:' + id + ':' + amount),
  applyCoreAxis: (id, amount) => state.growth.push('axis:' + id + ':' + amount),
  applyGlobal: (stat, amount) => state.growth.push('global:' + (stat ?? 'none') + ':' + amount),
  emitRewardChosen: (title) => state.chosen.push(title),
  concedeRefusal: (passed) => state.refusals.push(passed)
});

assert(ProgressionComposition.MUTATION_BRANCHES === 3, 'mutation branch compatibility changed');
assert(!composition.hasChoice, 'fresh composition unexpectedly has an open choice');

// Discovery is selected by ProgressionOfferSystem and applied through BuildLoadoutSystem.
composition.openDiscovery();
assert(composition.hasChoice, 'discovery did not open a choice window');
assert((composition.rewardOffers?.length ?? 0) > 0, 'discovery produced no offers');
const discovery = composition.rewardOffers![0];
assert(discovery.kind === 'skill_add', 'free loadout no longer produces skill-add discovery');
assert(composition.chooseReward(0), 'discovery reward was not applied');
assert(!composition.hasChoice, 'ordinary reward did not close its choice window');
assert(!!discovery.skill && composition.allOwnedSkills().includes(discovery.skill),
  'chosen discovery did not enter the composed loadout');
assert(state.chosen.length === 1 && state.refusals.length === 1,
  'reward event/refusal wiring changed');

// XP progression is coordinated by ProgressionRuntime and opens offers through the shared ChoiceRuntime.
state.xp = state.xpNeed;
composition.check();
assert(state.level === 2, 'level progression did not advance');
assert(state.xp === 0, 'level progression did not spend the old XP threshold');
assert(state.xpNeed === 20, 'next XP threshold changed');
assert(state.levelEvents[0] === 2, 'level-up event wiring changed');
assert(composition.hasChoice && composition.rewardOffers?.length === 3,
  'level progression did not open the composed offer window');
assert(composition.chooseReward(0), 'level reward could not be applied');
assert(state.growth.some((entry) => entry.startsWith('doctrine:')),
  'level reward no longer reaches player-growth port');

// Mutation priority flows offer -> pending target -> MutationChoiceSystem through the same composition.
state.mutationCores = 1;
composition.check();
assert(composition.hasChoice, 'mutation core did not open a target choice');
assert(composition.rewardOffers?.some((offer) => offer.kind === 'mutation_target'),
  'mutation target offer policy is disconnected');
const targetIndex = composition.rewardOffers!.findIndex((offer) => offer.skill === 'cleaver');
assert(targetIndex >= 0, 'known evolvable cleaver was not offered for mutation');
assert(composition.chooseReward(targetIndex), 'mutation target handoff failed');
assert(composition.mutationOffer?.skill === 'cleaver',
  'mutation target did not open MutationChoiceSystem');
assert(composition.chooseMutation(0), 'mutation choice could not be applied');
assert(skillStates.get('cleaver')?.mutation, 'mutation was not written to the skill runtime');
assert(state.mutationCores === 0 && state.mutations === 1,
  'mutation core/accounting wiring changed');

// Compatibility state remains writable for deterministic fixtures without exposing ChoiceRuntime itself.
composition.rewardOffers = null;
composition.serial = 77;
composition.pendingMutationTarget = true;
composition.mutationRefusalToken = false;
assert(composition.serial === 77 && composition.pendingMutationTarget &&
       !composition.mutationRefusalToken,
  'choice compatibility view changed');

assert(activeSkillOrder.length > composition.allOwnedSkills().length,
  'regression fixture unexpectedly owns every Phenomenon');

console.log('progression-composition-regression OK', {
  ownedSkills: composition.allOwnedSkills().length,
  level: state.level,
  mutation: skillStates.get('cleaver')?.mutation,
  serial: composition.serial
});
