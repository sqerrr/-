import { Simulation } from '../core/simulation.js';
function assert(c: unknown, m: string): asserts c {
  if (!c) throw new Error('planning regression: ' + m);
}
// Invariant: Archive contents never "age" and a swapped-in Phenomenon fires without any
// start-up tax. The former per-skill Cold counter is gone, so the tax is now structurally
// impossible; the behavioural half of the invariant is asserted below via sawMortar.
const sim = new Simulation({ seed: 424242, hz: 60, mode: 'showcase' });
let s = sim.snapshot();
assert(s.chain.slots[3] === 'chain_arc', 'showcase active slot 4 should contain Chain Arc');
assert(s.chain.skillReserve[0] === 'orbit_blades', 'Orbit should begin in Archive');
assert(sim.swapSkillLocations('reserve', 0, 'active', 3), 'Archive -> active swap rejected');
s = sim.snapshot();
assert(s.chain.slots[3] === 'orbit_blades', 'Orbit not moved active');
assert(s.chain.skillReserve[0] === 'chain_arc', 'Archive did not receive Chain Arc');
let sawOrbit = false;
for (let i = 0; i < 300; i++) {
  sim.step({ moveX: 0, moveZ: 0, aimX: 1, aimZ: 0 });
  if (sim.events.some((e) => e.type === 'SkillActivated' && e.skill === 'orbit_blades')) {
    sawOrbit = true;
    break;
  }
}
assert(sawOrbit, 'swapped-in Phenomenon should participate immediately');
assert(sim.swapCatalystLocations('reserve', 0, 'active', 0), 'Archive catalyst swap rejected');
s = sim.snapshot();
assert(s.chain.catalysts[0] === 'relay', 'Relay not moved active');
assert(s.chain.catalystReserve[0] === 'anchor', 'old active Catalyst not moved to Archive');
console.log(
  'planning-regression OK',
  JSON.stringify(
    {
      slots: s.chain.slots,
      archive: s.chain.skillReserve,
      catalysts: s.chain.catalysts,
      catalystArchive: s.chain.catalystReserve
    },
    null,
    2
  )
);
