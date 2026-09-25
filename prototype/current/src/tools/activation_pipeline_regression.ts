import { SimulationHarness } from '../testing/simulationHarness.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('activation-pipeline-regression: ' + message);
}

// A normal chain beat is owned by the pipeline and closes its synchronous frame.
const simple = SimulationHarness.create({ seed: 77101, hz: 60, benchmark: true, mode: 'clean' });
simple.sim.configureBenchmarkLoadout({ slots: ['ember_lance'], catalysts: [] });
simple.clearEvents();
const beforeSimple = simple.sim.metrics.activations;
assert(simple.activateSlot(0), 'ordinary slot activation was unexpectedly deferred');
assert(simple.sim.metrics.activations === beforeSimple + 1, 'ordinary activation metric changed');
assert(
  simple.sim.events.some((event) => event.type === 'SkillActivated' && event.skill === 'ember_lance'),
  'pipeline no longer publishes the cast'
);

// A physical A→B edge owns B. Casting A may resolve B as a payload, while B's later clock beat
// must remain suppressed so the chain cannot double-cast it.
const physical = SimulationHarness.create({ seed: 77102, hz: 60, benchmark: true, mode: 'clean' });
const sim = physical.sim;
sim.configureBenchmarkLoadout({
  slots: ['rail_spear', 'chain_arc'],
  catalysts: ['source']
});
physical.setPlayerPosition(0, 0);
sim.aimX = 1;
sim.aimZ = 0;
physical.entities = [];
for (let i = 0; i < 5; i++)
  physical.spawnEnemyAt('footnote', 2.5 + i * 1.05, 0, 0);

physical.clearEvents();
const beforePhysical = sim.metrics.activations;
assert(physical.activateSlot(0), 'producer slot did not activate');

const activatedSkills = sim.events
  .filter((event): event is Extract<typeof event, { type: 'SkillActivated' }> => event.type === 'SkillActivated')
  .map((event) => event.skill);

assert(activatedSkills.includes('rail_spear'), 'producer cast disappeared from activation pipeline');
assert(activatedSkills.includes('chain_arc'), 'physical Source did not resolve B as a nested payload');
assert(sim.metrics.activations >= beforePhysical + 2, 'nested payload was not counted as a real activation');

const beforeDeferredBeat = sim.metrics.activations;
assert(!physical.activateSlot(1), 'physical payload node also fired as an independent clock beat');
assert(sim.metrics.activations === beforeDeferredBeat, 'deferred B beat changed activation metrics');

// The next unrelated activation must still be usable after nested suspend/restore.
sim.configureBenchmarkLoadout({ slots: ['frost_ring'], catalysts: [] });
physical.clearEvents();
assert(physical.activateSlot(0), 'pipeline did not recover after nested physical payload');
assert(
  sim.events.some((event) => event.type === 'SkillActivated' && event.skill === 'frost_ring'),
  'post-payload activation lost its cast/trace frame'
);

console.log('activation-pipeline-regression OK', {
  simpleActivations: simple.sim.metrics.activations - beforeSimple,
  physicalSkills: activatedSkills,
  deferredBeatActivations: sim.metrics.activations - beforeDeferredBeat
});
