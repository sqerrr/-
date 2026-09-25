import { RewardOfferFactory } from '../core/rewardOfferFactory.js';
import {
  ProgressionOfferSystem,
  type ProgressionOfferPort
} from '../core/progressionOfferSystem.js';
import type {
  CatalystId,
  DoctrineId,
  ResonanceId,
  SkillId,
  SkillRuntime
} from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('progression-offer-regression: ' + message);
}

let slots: (SkillId | null)[] = ['rail_spear', null, null, null];
let reserve: (SkillId | null)[] = [null, null];
let catalystSlots: (CatalystId | null)[] = [null, null, null];
let catalystReserve: (CatalystId | null)[] = [null, null];
let mutationCores = 2;
let u32 = 1000;
const mainInts: number[] = [];
const mainFloats: number[] = [];
const refusalInts: number[] = [];

const states = new Map<SkillId, SkillRuntime>();
function state(id: SkillId): SkillRuntime {
  let current = states.get(id);
  if (!current) {
    current = {
      id,
      level: 1,
      power: 0,
      coverage: 0,
      range: 0,
      duration: 0,
      crit: 0,
      eliteDamage: 0,
      count: 1,
      control: 0,
      statusPotency: 0,
      mutation: null,
      mutationUpgrade: null,
      mutationApotheosis: null
    };
    states.set(id, current);
  }
  return current;
}

const randomInt = (max: number) => {
  const raw = mainInts.shift() ?? 0;
  return Math.max(0, Math.min(max - 1, raw));
};
const randomFloat = () => mainFloats.shift() ?? 0;
const compatibleEdges = (id: CatalystId) => id === 'source' ? [0] : [];

const factory = new RewardOfferFactory({
  randomInt,
  randomFloat,
  nextU32: () => u32++,
  fortune: () => 0,
  resonanceLevel: (_id: ResonanceId) => 0,
  doctrineLevel: (_id: DoctrineId) => 0,
  slots: () => slots,
  catalystCompatibleEdges: compatibleEdges
});

const port: ProgressionOfferPort = {
  randomInt,
  randomFloat,
  refusalInt: (max) => {
    const raw = refusalInts.shift() ?? 0;
    return Math.max(0, Math.min(max - 1, raw));
  },
  slots: () => slots,
  skillReserve: () => reserve,
  catalysts: () => catalystSlots,
  catalystReserve: () => catalystReserve,
  skillState: state,
  mutationCores: () => mutationCores,
  catalystCompatibleEdges: compatibleEdges
};
const system = new ProgressionOfferSystem(port, factory);

// A free active/reserve position turns discovery into additions.
{
  slots = ['rail_spear', null, null, null];
  reserve = [null, null];
  const offers = system.discovery();
  assert(offers.length === 3, 'discovery no longer shows three choices');
  assert(offers.every((offer) => offer.kind === 'skill_add'),
    'free-space discovery stopped offering additions');
  assert(offers.every((offer) => offer.skill !== 'rail_spear'),
    'owned Phenomenon leaked into discovery');
  assert(system.hasUnownedSkills(), 'unowned-skill query disagrees with discovery');
}

// With every position occupied the exact same discovery policy becomes swaps.
{
  slots = ['rail_spear', 'frost_ring', 'cleaver', 'chain_arc'];
  reserve = ['orbit_blades', 'toxic_mist'];
  const offers = system.discovery();
  assert(offers.length === 3 && offers.every((offer) => offer.kind === 'skill_swap'),
    'full build no longer converts discoveries into swaps');
  assert(offers.every((offer) => offer.swapSlot !== undefined),
    'swap discovery lost target slot');
}

// Catalyst discovery prefers currently compatible unowned Catalysts before the broad pool.
{
  catalystSlots = [null, null, null];
  catalystReserve = [null, null];
  const offers = system.catalystDiscovery();
  assert(offers.length === 1, 'compatible Catalyst priority should narrow this fixture to one card');
  assert(offers[0].catalyst === 'source' && offers[0].kind === 'catalyst_add',
    'Catalyst discovery stopped preferring a currently compatible edge');
}

// Mutation target selection follows the current branch depth and exposes the core count.
{
  slots = ['frost_ring', null, null, null];
  reserve = [null, null];
  const frost = state('frost_ring');
  frost.mutation = null;
  frost.mutationUpgrade = null;
  frost.mutationApotheosis = null;

  assert(system.hasEvolvableSkill(), 'fresh Phenomenon stopped qualifying for mutation core');
  let offers = system.mutationTargetOffers();
  assert(offers.length === 1 && offers[0].kind === 'mutation_target',
    'Tier I mutation target offer disappeared');
  assert(offers[0].subtitle.includes('МУТАЦИЯ') && offers[0].subtitle.includes(String(mutationCores)),
    'Tier I mutation target copy lost tier/core state');

  // Use declared Frost branch ids from the production mutation graph.
  frost.mutation = 'frost_front';
  offers = system.mutationTargetOffers();
  assert(offers.length === 1 && offers[0].subtitle.includes('ПРОДОЛЖЕНИЕ'),
    'Tier II mutation target no longer follows the selected root');

  frost.mutationUpgrade = 'frost_whiteout';
  offers = system.mutationTargetOffers();
  assert(offers.length === 1 && offers[0].subtitle.includes('АПОФЕОЗ'),
    'Tier III mutation target no longer advertises Apotheosis');
}

// Elite cache uses a useful Catalyst while space exists and marks exactly the refusal target.
{
  slots = ['rail_spear', 'toxic_mist', null, null];
  reserve = [null, null];
  catalystSlots = [null, null, null];
  catalystReserve = [null, null];
  refusalInts.push(0);

  const offers = system.eliteCache();
  assert(offers.length === 1 && offers[0].kind === 'elite' && offers[0].catalyst === 'source',
    'elite cache stopped prioritizing a useful new Catalyst');
  assert(offers.filter((offer) => offer.marked).length === 1,
    'elite cache must mark exactly one displayed refusal target');
  assert(offers[0].subtitle.includes('ТАЙНИК ЭЛИТЫ'),
    'elite Catalyst card lost elite-cache presentation');
}

// Resonance POI remains three distinct cards selected by the main RNG stream.
{
  const offers = system.resonanceChoice();
  assert(offers.length === 3 && offers.every((offer) => offer.kind === 'resonance'),
    'resonance POI selection changed');
  assert(new Set(offers.map((offer) => offer.resonance)).size === offers.length,
    'resonance POI produced duplicate axes');
}

console.log('progression-offer-regression OK', {
  discovery: system.discovery().map((offer) => offer.kind),
  mutationCores,
  eliteCacheMarked: system.eliteCache().filter((offer) => offer.marked).length
});
