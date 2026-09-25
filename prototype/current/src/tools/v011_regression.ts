import { activeSkillOrder, skills } from '../content/definitions.js';
import { ConstructSystem } from '../core/constructSystem.js';
import { OrbitSystem } from '../core/orbitSystem.js';
import { PhenomenonCastSystem } from '../core/phenomenonCastSystem.js';
import { ProjectileSystem } from '../core/projectileSystem.js';
import { Simulation } from '../core/simulation.js';
import { StatefulPhenomenonCastSystem } from '../core/statefulPhenomenonCastSystem.js';

function assert(c: unknown, m: string): asserts c { if (!c) throw new Error('v0.11 regression: ' + m); }

// Every advertised Apotheosis must have production runtime code. This catches the exact failure
// mode where a beautiful Tier III description is added to data but never changes gameplay.
const classSource = [
  Simulation.toString(),
  ProjectileSystem.toString(),
  ConstructSystem.toString(),
  OrbitSystem.toString(),
  PhenomenonCastSystem.toString(),
  StatefulPhenomenonCastSystem.toString()
].join('\n');
const apotheoses = activeSkillOrder.flatMap((id) => skills[id].mutations.filter((m) => m.apotheosis).map((m) => ({skill:id,id:m.id})));
assert(apotheoses.length === activeSkillOrder.length * 3, `expected three Apotheoses per active skill, got ${apotheoses.length}`);
for (const a of apotheoses) assert(classSource.includes(`'${a.id}'`) || classSource.includes(`\"${a.id}\"`), `${a.skill}/${a.id} is catalogue-only: no runtime branch`);

// Every active player chassis gets an authored Elite Echo tell and never leaks through SkillActivated.
let echoShapes = 0;
for (const skill of activeSkillOrder) {
  const sim: any = new Simulation({seed:91000+activeSkillOrder.indexOf(skill),hz:60,benchmark:true,mode:'clean'});
  sim.spawnElite();
  const owner=sim.ents.find((e:any)=>e.kind==='elite'); assert(owner, `${skill}: failed to spawn elite owner`);
  sim.ents=[owner]; owner.hp=owner.maxHp=1e9; owner.contactDps=0; owner.x=sim.px-8; owner.z=sim.pz;
  sim.events=[];
  sim.startEliteEcho(owner,{serial:1,kind:'skill',title:skills[skill].name,icon:skills[skill].icon,skill,heldBy:owner.id});
  assert(sim.events.some((e:any)=>e.type==='EliteEchoPhase'&&e.phase==='tell'&&e.skill===skill), `${skill}: no Echo tell`);
  const shapes=sim.events.filter((e:any)=>e.type==='CombatShape'&&String(e.source).startsWith(`echo_${skill}_tell`));
  assert(shapes.length>0, `${skill}: no authored Echo telegraph geometry`); echoShapes+=shapes.length;
  const q=sim.eliteEchoSystem.get(owner.id); assert(q, `${skill}: missing Echo state`);
  sim.events=[]; sim.tick=Math.ceil(q.until*sim.hz); sim.updateEliteEchoes();
  assert(sim.events.some((e:any)=>e.type==='EliteEchoPhase'&&e.phase==='active'), `${skill}: no active Echo phase`);
  assert(!sim.events.some((e:any)=>e.type==='SkillActivated'), `${skill}: Echo reused player cast dispatcher`);
}

// Shielded elites must expose an authored melee/Force break window rather than infinitely tracking.
const shield:any=new Simulation({seed:99001,hz:60,benchmark:true});
shield.spawnElite();
const e=shield.ents.find((x:any)=>x.kind==='elite'); assert(e,'shield test: no elite');
e.affix='shielded'; e.shieldState='guard'; e.shieldStability=100; e.shieldAngle=0; e.hp=e.maxHp=1e9;
shield.doctrines.force=12; shield.events=[];
shield.damage(e,3000,'cleaver',true,e.x+5,e.z);
assert(e.shieldState==='broken','Force/melee failed to break shield state');
assert(shield.events.some((x:any)=>x.type==='RareEvent'&&x.title==='ЩИТ СЛОМАН'),'shield break lacks rare/readable event');

// Snapshot must carry physical-behaviour and body-language state to the renderer.
const snap=shield.snapshot();
const se=snap.entities.find((x:any)=>x.id===e.id); assert(se?.shieldState==='broken','snapshot lost shield state');
assert(typeof se?.shieldStability==='number','snapshot lost shield stability');

console.log('v011-regression OK',{active:activeSkillOrder.length,apotheoses:apotheoses.length,echoShapes,shieldBreak:true});
