// v0.11 contract: a refused player Phenomenon is NEVER dispatched through the player's cast.
// It becomes an authored Elite Echo with a visible tell, a separate active phase and recovery.
import type { RefusedCard } from '../core/types.js';
import { SimulationHarness } from '../testing/simulationHarness.js';

function assert(c: unknown, m: string): asserts c {
  if (!c) throw new Error('elite echo regression: ' + m);
}

const h = SimulationHarness.create({ seed: 4242, hz: 60, mode: 'clean', benchmark: true });
const sim = h.sim;
sim.configureBenchmarkLoadout({ slots: ['cleaver'], catalysts: [] });
for (let i=0;i<120;i++) sim.step({moveX:0,moveZ:0,aimX:1,aimZ:0});
const owner = h.entities[0];
assert(owner, 'expected an enemy actor');
h.entities = [owner];
owner.hp = owner.maxHp = 1e9;
owner.contactDps = 0;
owner.x = sim.px - 8;
owner.z = sim.pz;
h.clearEvents();

const card: RefusedCard = {
  serial: 777,
  kind:'skill',
  title:'Рельсовое копьё',
  icon:'',
  skill:'rail_spear',
  heldBy:owner.id
};
const hp0 = sim.php;
h.startEliteEcho(owner, card);
const tell = sim.events.find((e)=>e.type==='EliteEchoPhase' && e.phase==='tell');
assert(tell, 'Echo did not emit tell phase');
assert(sim.events.some((e)=>e.type==='CombatShape' && String(e.source).includes('echo_rail_spear_tell')),
  'Rail Echo has no visible telegraph');
assert(sim.php === hp0, 'Rail Echo damaged player during tell');
assert(!sim.events.some((e)=>e.type==='SkillActivated'), 'Elite Echo leaked through player SkillActivated/dispatch path');

const q = h.eliteEcho(owner.id);
assert(q, 'Echo state missing');
h.clearEvents();
h.setTime(q.until);
h.updateEliteEchoes();
assert(sim.events.some((e)=>e.type==='EliteEchoPhase' && e.phase==='active'), 'Echo did not enter active phase');
assert(sim.events.some((e)=>e.type==='RivalCast' && e.skill==='rail_spear'), 'RivalCast accounting missing');
assert(sim.php < hp0, 'telegraphed Rail Echo failed to damage player on locked line');
assert(!sim.events.some((e)=>e.type==='SkillActivated'), 'active Echo invoked player cast dispatcher');

const q2 = h.eliteEcho(owner.id);
assert(q2, 'Echo state disappeared before recovery');
h.clearEvents();
h.setTime(q2.until);
h.updateEliteEchoes();
assert(sim.events.some((e)=>e.type==='EliteEchoPhase' && e.phase==='recovery'), 'Echo has no recovery phase');
console.log('rival-cast-regression OK', {tell:true,active:true,recovery:true,loss:+(hp0-sim.php).toFixed(2)});
