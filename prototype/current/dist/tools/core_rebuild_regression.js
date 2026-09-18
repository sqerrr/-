import { Simulation } from '../core/simulation.js';
function assert(c, m) { if (!c)
    throw new Error('core rebuild regression: ' + m); }
const run = (slots) => { const sim = new Simulation({ seed: 9191, hz: 60, mode: 'clean', benchmark: true }); sim.configureBenchmarkLoadout({ slots, catalysts: [] }); for (let i = 0; i < 600; i++)
    sim.step({ moveX: 0, moveZ: 0, aimX: 1, aimZ: 0 }); return sim.snapshot().metrics.activations; };
const one = run(['ember_lance']), four = run(['ember_lance', 'frost_ring', 'cleaver', 'chain_arc']);
const ratio = four / Math.max(1, one);
assert(ratio > 3.5 && ratio < 4.5, `fixed-cycle invariant failed: 1=${one}, 4=${four}, ratio=${ratio}`);
const s = new Simulation({ seed: 1, hz: 60, mode: 'showcase' }).snapshot();
assert(s.chain.catalystRuntime.every(c => Object.keys(c).length === 1 && 'id' in c), 'Catalysts must not expose level/potency runtime state');
assert(s.skills.every(x => x.level === 1), 'Phenomenon personal levels must stay neutral in v0.10');
console.log('core-rebuild-regression OK', { one, four, ratio: +ratio.toFixed(2) });
