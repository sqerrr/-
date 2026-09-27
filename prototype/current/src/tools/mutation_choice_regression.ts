import { ChoiceRuntime } from '../core/choiceRuntime.js';
import {
  MutationChoiceSystem,
  type MutationChoicePort
} from '../core/mutationChoiceSystem.js';
import type { MutationId, SkillId, SkillRuntime } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('mutation-choice-regression: ' + message);
}

function freshState(id: SkillId): SkillRuntime {
  return {
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
}

const runtime = new ChoiceRuntime();
const currentOffer = () => runtime.mutationOffer;
function requireOffer() {
  const offer = currentOffer();
  assert(!!offer, 'expected an open mutation offer');
  return offer;
}
const refusalToken = () => runtime.mutationRefusalToken;
const states = new Map<SkillId, SkillRuntime>();
const state = (id: SkillId) => {
  let value = states.get(id);
  if (!value) {
    value = freshState(id);
    states.set(id, value);
  }
  return value;
};

let cores = 2;
let mutations = 0;
const chosen: { skill: SkillId; mutation: MutationId }[] = [];
const rare: { title: string; detail: string }[] = [];
const ints: number[] = [];

const port: MutationChoicePort = {
  randomInt: (max) => {
    const raw = ints.shift() ?? 0;
    return Math.max(0, Math.min(max - 1, raw));
  },
  skillState: state,
  mutationCores: () => cores,
  setMutationCores: (value) => {
    cores = value;
  },
  noteMutation: () => {
    mutations++;
  },
  emitMutationChosen: (skill, mutation) => {
    chosen.push({ skill, mutation });
  },
  emitRareEvent: (title, detail) => {
    rare.push({ title, detail });
  }
};

const system = new MutationChoiceSystem(port, runtime);

// Tier I exposes exactly three authored roots and keeps the one-run refusal token.
{
  const frost = state('frost_ring');
  frost.mutation = null;
  frost.mutationUpgrade = null;
  frost.mutationApotheosis = null;
  runtime.mutationRefusalToken = true;

  system.open('frost_ring');
  const offer = requireOffer();
  assert(offer.tier === 1, 'fresh Phenomenon did not open Tier I');
  assert(offer.choices.length === 3, 'Tier I no longer exposes exactly three branches');
  assert(new Set(offer.choices).size === offer.choices.length, 'Tier I duplicated a branch');
  assert(offer.refusalAvailable, 'fresh Tier I lost its refusal token');

  // Current authored Phenomena expose exactly the three displayed roots. Preserve the
  // existing behavior: refusal cannot fabricate a fourth branch and therefore remains unused.
  const before = [...offer.choices];
  const refused = system.refuse(1);
  assert(!refused, 'refusal fabricated a mutation branch outside authored content');
  assert(refusalToken(), 'failed refusal consumed the one-run token');
  assert(offer.refusalAvailable === true, 'failed refusal changed the visible refusal state');
  assert(offer.choices.every((choice, index) => choice === before[index]),
    'failed refusal mutated the offered branches');
}

// Choosing a mutation reached through a mutation-target reward consumes exactly one core.
{
  const frost = state('frost_ring');
  frost.mutation = null;
  frost.mutationUpgrade = null;
  frost.mutationApotheosis = null;
  cores = 2;
  runtime.beginMutationTarget();
  system.open('frost_ring');

  const picked = requireOffer().choices[0];
  assert(system.choose(0), 'valid Tier I choice was rejected');
  assert(frost.mutation === picked, 'Tier I choice was not applied to the SkillRuntime');
  assert(cores === 1, 'mutation-target choice did not consume exactly one core');
  assert(mutations === 1, 'mutation metric was not recorded');
  assert(chosen.at(-1)?.mutation === picked, 'MutationChosen event payload drifted');
  assert(currentOffer() === null, 'mutation modal stayed open after a valid choice');
}

// Tier II follows the selected root; Tier III follows the continuation and emits Apotheosis.
{
  const frost = state('frost_ring');
  frost.mutation = 'frost_front';
  frost.mutationUpgrade = null;
  frost.mutationApotheosis = null;

  system.open('frost_ring');
  let offer = requireOffer();
  assert(offer.tier === 2, 'selected root did not advance to Tier II');
  const whiteout = offer.choices.indexOf('frost_whiteout');
  assert(whiteout >= 0, 'Frost Front continuation disappeared from Tier II');
  assert(system.choose(whiteout), 'valid Frost continuation was rejected');
  assert(frost.mutationUpgrade === 'frost_whiteout', 'Tier II continuation was not applied');

  system.open('frost_ring');
  offer = requireOffer();
  assert(offer.tier === 3, 'continuation did not advance to Tier III');
  const worldstorm = offer.choices.indexOf('frost_worldstorm');
  assert(worldstorm >= 0, 'Frost Whiteout Apotheosis disappeared from Tier III');
  assert(system.choose(worldstorm), 'valid Apotheosis was rejected');
  assert(frost.mutationApotheosis === 'frost_worldstorm', 'Tier III Apotheosis was not applied');
  assert(rare.at(-1)?.title === 'АПОФЕОЗ', 'Apotheosis lost its RareEvent');
  assert(rare.at(-1)?.detail.includes('Белый шторм'), 'Apotheosis event lost mutation name');
}

// Opening a normal mutation choice without a pending target must not spend a core.
{
  const rail = state('rail_spear');
  rail.mutation = null;
  rail.mutationUpgrade = null;
  rail.mutationApotheosis = null;
  const before = cores;

  system.open('rail_spear');
  assert(system.choose(0), 'normal mutation choice failed');
  assert(cores === before, 'non-target mutation choice consumed a mutation core');
}

console.log('mutation-choice-regression OK', {
  mutations,
  cores,
  lastChoice: chosen.at(-1),
  apotheosisEvents: rare.length
});
