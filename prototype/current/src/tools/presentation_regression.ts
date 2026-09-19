import { Simulation } from '../core/simulation.js';
import { PresentationBridge } from '../presentation/bridge.js';

const fail = (m: string) => {
  throw new Error(m);
};
const sim = new Simulation({ seed: 24681357, hz: 60, runDuration: 150, benchmark: true });
sim.configureBenchmarkLoadout({
  slots: ['rail_spear', 'frost_ring', 'cleaver', 'chain_arc'],
  // Operators that actually fire, so the bridge sees derived casts as well as direct ones.
  // The previous fixture used amplifier/diffuser/hunter, which carried no logic at all.
  catalysts: ['capacitor', 'echo_shard', 'relay'],
  level: 8,
  globalPower: 0.85,
  skillPower: 0.65,
  skillCoverage: 0.45,
  skillRange: 0.35,
  skillControl: 0.3,
  skillStatus: 0.35,
  skillElite: 0.2,
  catalystPotency: 1.25
});
const bridge = new PresentationBridge();
bridge.reset(sim.snapshot());
let shapes = 0,
  hits = 0,
  deaths = 0,
  deathVisuals = 0,
  ray = false,
  circle = false,
  sector = false;
for (let i = 0; i < 5400; i++) {
  const a = i * 0.013,
    moveX = Math.cos(a) * 0.55,
    moveZ = Math.sin(a) * 0.55,
    aimX = Math.cos(a * 0.61),
    aimZ = Math.sin(a * 0.61);
  sim.step({ moveX, moveZ, aimX, aimZ });
  const snap = sim.snapshot();
  for (const e of sim.events) {
    if (e.type === 'CombatShape') {
      shapes++;
      if (e.shape.kind === 'ray') ray = true;
      else if (e.shape.kind === 'circle') circle = true;
      else if (e.shape.kind === 'sector') sector = true;
    } else if (e.type === 'DamageResolved') hits++;
    else if (e.type === 'EntityDied') deaths++;
  }
  bridge.consume(sim.events, sim.time, snap);
  deathVisuals = Math.max(deathVisuals, bridge.frame(sim.time).deaths.length);
}
if (shapes < 20) fail(`too few combat-shape events: ${shapes}`);
if (!ray || !circle || !sector)
  fail(`shape coverage missing ray=${ray} circle=${circle} sector=${sector}`);
if (hits < 20) fail(`too few damage events: ${hits}`);
if (deaths < 1) fail('no deaths observed');
if (deathVisuals < 1)
  fail('presentation bridge did not retain a death visual after gameplay removal');
console.log('presentation-regression OK', {
  shapes,
  hits,
  deaths,
  maxDeathVisuals: deathVisuals,
  shapeKinds: { ray, circle, sector },
  hash: sim.canonicalHash()
});
