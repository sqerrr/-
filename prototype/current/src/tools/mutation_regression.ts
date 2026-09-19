import { mutationDef, mutationRoots, skills } from '../content/definitions.js';
import { Simulation } from '../core/simulation.js';

const assert = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
const skill = 'frost_ring' as const;
const sim = new Simulation({ seed: 301991, hz: 60, benchmark: true }) as any;
sim.configureBenchmarkLoadout({ slots: [skill], catalysts: [] });
sim.mutationCores = 3;

sim.generateMutationTargetOffers();
assert(sim.rewardOffers?.length === 1, 'expected one eligible mutation target');
assert(sim.chooseReward(0), 'failed to select mutation target');
let offer = sim.mutationOffer;
assert(offer?.tier === 1 && offer.choices.length === 3, 'Tier I must offer three roots');
const root = offer.choices[0];
assert(!mutationDef(skill, root).parent, 'Tier I leaked a continuation');
assert(sim.chooseMutation(0), 'failed Tier I');

sim.generateMutationTargetOffers(); assert(sim.chooseReward(0), 'failed Tier II target');
offer = sim.mutationOffer;
assert(offer?.tier === 2 && offer.choices.length === 1, 'Tier II must continue chosen branch');
const child = offer.choices[0];
assert(mutationDef(skill, child).parent === root, 'Tier II parent mismatch');
assert(sim.chooseMutation(0), 'failed Tier II');

sim.generateMutationTargetOffers(); assert(sim.chooseReward(0), 'failed Tier III target');
offer = sim.mutationOffer;
assert(offer?.tier === 3 && offer.choices.length === 1, 'Tier III must offer one Apotheosis');
const apoth = offer.choices[0];
const apothDef = mutationDef(skill, apoth);
assert(apothDef.parent === child && apothDef.apotheosis, 'Tier III is not Apotheosis of Tier II');
assert(sim.chooseMutation(0), 'failed Tier III');
const runtime = sim.skillState(skill);
assert(runtime.mutation === root && runtime.mutationUpgrade === child && runtime.mutationApotheosis === apoth, 'three mutation levels not stored independently');
assert(sim.mutationCores === 0, 'three levels must consume three cores');
assert(sim.events.some((e:any)=>e.type==='RareEvent' && e.title==='АПОФЕОЗ'), 'Tier III must emit a rare visual event');

sim.skillReserve[0] = 'rail_spear'; sim.skillsRuntime.set('rail_spear', sim.newSkill('rail_spear'));
assert(sim.swapSkillLocations('active',0,'reserve',0), 'active/reserve swap failed');
assert(sim.mutationCores === 3, 'archiving a three-level mutation must refund three cores');
assert(!runtime.mutation && !runtime.mutationUpgrade && !runtime.mutationApotheosis, 'archived skill kept mutation state');
assert(mutationRoots(skill).length === 3, 'root helper regressed');
assert(skills[skill].mutations.length === 9, 'active skill must expose 9 mutation records');
console.log('mutation-regression OK', { root, child, apoth, refunded: sim.mutationCores });
