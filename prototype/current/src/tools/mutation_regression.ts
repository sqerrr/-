import { mutationDef, mutationRoots, skills } from '../content/definitions.js';
import { Simulation } from '../core/simulation.js';

const assert = (ok: unknown, message: string) => {
  if (!ok) throw new Error(message);
};

const sim = new Simulation({ seed: 301991, hz: 60, benchmark: true }) as any;
sim.configureBenchmarkLoadout({ slots: ['ember_lance'], catalysts: [] });
sim.mutationCores = 2;

sim.generateMutationTargetOffers();
assert(sim.rewardOffers?.length === 1, 'expected one eligible mutation target');
assert(sim.chooseReward(0), 'failed to select mutation target');
const first = sim.mutationOffer;
assert(first?.choices.length === 3, 'first level must offer exactly three roots');
assert(
  first.choices.every((id: string) => !mutationDef('ember_lance', id as any).parent),
  'first level leaked a continuation into the root offer'
);
const root = first.choices[0];
assert(sim.chooseMutation(0), 'failed to choose mutation root');
let runtime = sim.skillState('ember_lance');
assert(runtime.mutation === root && !runtime.mutationUpgrade, 'root was not stored independently');
assert(sim.mutationCores === 1, 'root should consume one mutation core');

sim.generateMutationTargetOffers();
assert(sim.chooseReward(0), 'failed to select continuation target');
const second = sim.mutationOffer;
assert(second?.choices.length === 1, 'second level must offer exactly one branch continuation');
const child = second.choices[0];
assert(mutationDef('ember_lance', child).parent === root, 'continuation does not belong to chosen root');
assert(sim.chooseMutation(0), 'failed to choose mutation continuation');
runtime = sim.skillState('ember_lance');
assert(runtime.mutation === root, 'continuation erased its root');
assert(runtime.mutationUpgrade === child, 'continuation was not stored separately');
assert(sim.mutationCores === 0, 'continuation should consume the second mutation core');

// Moving a two-level mutated phenomenon to the reserve refunds both run-owned cores.
sim.skillReserve[0] = 'frost_ring';
sim.skillsRuntime.set('frost_ring', sim.newSkill('frost_ring'));
assert(sim.swapSkillLocations('active', 0, 'reserve', 0), 'active/reserve swap failed');
assert(sim.mutationCores === 2, 'archiving a two-level mutation must refund two cores');
assert(!runtime.mutation && !runtime.mutationUpgrade, 'archived phenomenon kept mutation state');

assert(mutationRoots('ember_lance').length === 3, 'catalogue root helper regressed');
assert(skills.ember_lance.mutations.length === 6, 'catalogue must expose six records per phenomenon');
console.log('mutation-regression OK', { root, child, refunded: sim.mutationCores });
