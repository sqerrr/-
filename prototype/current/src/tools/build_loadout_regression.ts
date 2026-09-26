import {
  catalystOrder,
  catalystPairCompatible
} from '../content/definitions.js';
import {
  BuildLoadoutSystem,
  type BuildLoadoutPort
} from '../core/buildLoadoutSystem.js';
import type {
  CatalystId,
  CatalystRuntime,
  SkillId,
  SkillRuntime
} from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('build-loadout-regression: ' + message);
}

let slots: (SkillId | null)[] = ['rail_spear', 'frost_ring', null, null];
let skillReserve: (SkillId | null)[] = [null];
let catalysts: (CatalystId | null)[] = [null, null, null];
let catalystReserve: (CatalystId | null)[] = [null, null];
let mutationCores = 0;
let capacitorResets = 0;

const skillRuntime = new Map<SkillId, SkillRuntime>();
const catalystRuntime = new Map<CatalystId, CatalystRuntime>();

function freshSkill(id: SkillId): SkillRuntime {
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
for (const id of slots) if (id) skillRuntime.set(id, freshSkill(id));

const port: BuildLoadoutPort = {
  slots: () => slots,
  skillReserve: () => skillReserve,
  catalysts: () => catalysts,
  catalystReserve: () => catalystReserve,
  newSkill: freshSkill,
  skillState: (id) => {
    const state = skillRuntime.get(id);
    if (!state) throw new Error('missing runtime ' + id);
    return state;
  },
  setSkillRuntime: (id, runtime) => skillRuntime.set(id, runtime),
  deleteSkillRuntime: (id) => {
    skillRuntime.delete(id);
  },
  setCatalystRuntime: (id, runtime) => catalystRuntime.set(id, runtime),
  mutationCores: () => mutationCores,
  setMutationCores: (value) => {
    mutationCores = value;
  },
  resetCapacitor: () => {
    capacitorResets++;
  }
};

const system = new BuildLoadoutSystem(port);

// Owned lists are unique across active and reserve.
{
  skillReserve[0] = 'rail_spear';
  assert(system.allOwnedSkills().filter((id) => id === 'rail_spear').length === 1,
    'owned skill list stopped deduplicating active/reserve');
  skillReserve[0] = null;
}

// Discovery fills active before reserve and duplicate acquisition is idempotent.
{
  assert(system.addSkill('cleaver'), 'new skill was rejected with active space available');
  assert(slots[2] === 'cleaver' && skillRuntime.has('cleaver'),
    'new skill did not enter first free active slot');

  const before = [...slots];
  assert(system.addSkill('cleaver'), 'duplicate skill should be an idempotent success');
  assert(JSON.stringify(slots) === JSON.stringify(before),
    'duplicate acquisition moved/duplicated an owned skill');

  assert(system.addSkill('chain_arc'), 'second skill was rejected with active space');
  assert(slots[3] === 'chain_arc', 'second skill did not fill remaining active slot');

  assert(system.addSkill('orbit_blades'), 'new skill was rejected with reserve space');
  assert(skillReserve[0] === 'orbit_blades',
    'full active bar did not route new skill into reserve');
}

// Explicit swap-in keeps the leaving active skill and drops the prior reserve occupant if full.
{
  const dropped = skillReserve[0]!;
  assert(system.swapInSkill('toxic_mist', 1), 'valid skill swap-in failed');
  assert(slots[1] === 'toxic_mist' && skillReserve[0] === 'frost_ring',
    'swap-in did not move leaving active skill into reserve');
  assert(!skillRuntime.has(dropped),
    'full-reserve swap did not discard the displaced reserve runtime');
  assert(skillRuntime.has('toxic_mist'), 'incoming swap skill runtime was not created');
}

// Catalyst compatibility reports the same authored pair truth and placement prefers such an edge.
{
  catalysts = [null, null, null];
  catalystReserve = [null, null];
  const candidate = catalystOrder.find((id) =>
    slots.some((left, index) => {
      const right = slots[index + 1];
      return !!left && !!right && catalystPairCompatible(id, left, right);
    })
  );
  assert(!!candidate, 'fixture found no compatible Catalyst');

  const expected: number[] = [];
  for (let index = 0; index < catalysts.length; index++) {
    const left = slots[index];
    const right = slots[index + 1];
    if (left && right && catalystPairCompatible(candidate!, left, right))
      expected.push(index);
  }
  assert(JSON.stringify(system.catalystCompatibleEdges(candidate!)) === JSON.stringify(expected),
    'compatible Catalyst edge query diverged from authored pair compatibility');

  assert(system.placeCatalyst(candidate!), 'compatible Catalyst placement failed');
  assert(catalysts[expected[0]] === candidate,
    'Catalyst placement did not prefer first compatible free edge');
  assert(catalystRuntime.has(candidate!), 'placed Catalyst runtime was not registered');
}

// Crossing active/reserve refunds every occupied mutation tier and clears the branch.
{
  const leaving = slots[0]!;
  const state = skillRuntime.get(leaving)!;
  state.mutation = 'root';
  state.mutationUpgrade = 'child';
  state.mutationApotheosis = 'apoth';
  mutationCores = 2;

  assert(system.swapSkillLocations('active', 0, 'reserve', 0),
    'active/reserve skill swap failed');
  assert(mutationCores === 5,
    'active/reserve transition refunded the wrong mutation core count');
  assert(!state.mutation && !state.mutationUpgrade && !state.mutationApotheosis,
    'refunded mutation branch was not cleared');
}

// Same-zone skill reorder does not refund mutations.
{
  const active = slots[1]!;
  const state = skillRuntime.get(active)!;
  state.mutation = 'root';
  const before = mutationCores;
  assert(system.swapSkillLocations('active', 1, 'active', 2),
    'same-zone active reorder failed');
  assert(mutationCores === before && state.mutation === 'root',
    'same-zone reorder incorrectly refunded/cleared mutation');
}

// Catalyst rearrangement resets capacitor exactly once.
{
  catalysts = ['source', 'carrier', null];
  catalystReserve = ['trail', null];
  capacitorResets = 0;
  assert(system.swapCatalystLocations('active', 0, 'reserve', 0),
    'Catalyst active/reserve swap failed');
  assert(catalysts[0] === 'trail' && catalystReserve[0] === 'source',
    'Catalyst swap moved wrong values');
  assert(capacitorResets === 1, 'Catalyst swap did not reset capacitor exactly once');
}

console.log('build-loadout-regression OK', {
  slots,
  skillReserve,
  catalysts,
  catalystReserve,
  mutationCores,
  capacitorResets
});
