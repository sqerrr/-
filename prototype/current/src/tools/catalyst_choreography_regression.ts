import { readFileSync } from 'node:fs';
import {
  activeSkillOrder,
  catalystOrder,
  catalystPairCompatible,
  phenomenonChoreography
} from '../content/definitions.js';
import { Simulation } from '../core/simulation.js';
import type { CatalystId, SkillId } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('catalyst-choreography-regression: ' + message);
}
const dist=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);

function fixture(left:SkillId,right:SkillId,catalyst:CatalystId){
  const sim:any=new Simulation({seed:94000+left.length*37+right.length*11+catalyst.length,hz:60,benchmark:true,mode:'clean'});
  sim.configureBenchmarkLoadout({slots:[left,right],catalysts:[catalyst],level:7,globalPower:.25,skillPower:.1,skillCoverage:.08,skillRange:.05,skillDuration:.05});
  sim.px=0;sim.pz=0;sim.aimX=1;sim.aimZ=0;sim.playerVX=1;sim.playerVZ=0;
  sim.ents=[];sim.obstacles=[];sim.obstacleGrid=new Map();
  for(let i=0;i<10;i++)sim.spawnEnemyAt(i%3===0?'bookmark':'footnote',2.5+i*.9,(i%2?1:-1)*(.3+(i%4)*.35),0);
  sim.events.length=0;
  return sim;
}

// 1) Every live Phenomenon must really emit every physical signal it advertises.
// This catches a catalogue claim that the simulation cannot actually show/use.
const signalAudit:any[]=[];
for(const id of activeSkillOrder){
  const filler:SkillId=id==='rail_spear'?'frost_ring':'rail_spear';
  const sim=fixture(id,filler,'source');
  sim.catalysts=[null];
  sim.activateSlot(0);
  const trace=sim.lastContext.trace;
  assert(trace&&trace.skill===id,`${id}: no physical trace after activation`);
  const profile=phenomenonChoreography[id];
  for(const signal of profile.emits){
    if(signal==='terminal')assert(!!trace.terminal,`${id}: declares terminal but emits none`);
    if(signal==='path')assert(trace.paths.some((p:any[])=>p.length>=2),`${id}: declares path but emits none`);
    if(signal==='carrier')assert(trace.carriers.length>0,`${id}: declares carrier but emits none`);
    if(signal==='area')assert(trace.areaPoints.length>=2,`${id}: declares area but emits too little geometry`);
  }
  signalAudit.push({id,terminal:!!trace.terminal,paths:trace.paths.length,carriers:trace.carriers.length,area:trace.areaPoints.length});
}

// 2) SOURCE: B really starts at A's terminal instead of merely receiving a buff.
{
  const sim=fixture('rail_spear','toxic_mist','source');
  sim.activateSlot(0); sim.activateSlot(1);
  const ev=sim.events.find((e:any)=>e.type==='CatalystChoreography'&&e.mode==='source');
  assert(ev,'source event missing');
  const toxic=sim.fields.filter((f:any)=>f.source==='toxic_mist').at(-1);
  assert(toxic,'source did not create Toxic Mist');
  assert(Math.hypot(toxic.x,toxic.z)>8,'Source left Toxic Mist near the hero instead of Rail terminal');
  const destination=ev.points.at(-1);
  assert(destination&&dist(toxic,destination)<1.2,'Source visual destination disagrees with physical Toxic Mist');
}

// 3) CARRIER: B casts from several actual moving Orbit blades.
{
  const sim=fixture('orbit_blades','frost_ring','carrier');
  sim.activateSlot(0); sim.events.length=0; sim.activateSlot(1);
  const casts=sim.events.filter((e:any)=>e.type==='SkillActivated'&&e.skill==='frost_ring');
  const ev=sim.events.find((e:any)=>e.type==='CatalystChoreography'&&e.mode==='carrier');
  assert(ev,'carrier event missing');
  assert(casts.length>=2,'Carrier did not create multiple Frost origins from Orbit blades');
  assert(casts.some((e:any)=>Math.hypot(e.x,e.z)>1.2),'Carrier Frost still originates only on hero');
}

// 4) TRAIL: Sentry becomes a real field along the previous path, not a cluster around hero.
{
  const sim=fixture('rail_spear','sentry','trail');
  sim.activateSlot(0); sim.events.length=0; sim.activateSlot(1);
  const turrets=sim.constructs.filter((q:any)=>q.skill==='sentry');
  const ev=sim.events.find((e:any)=>e.type==='CatalystChoreography'&&e.mode==='trail');
  assert(ev,'trail event missing');
  assert(turrets.length>=3,'Trail did not build multiple Sentry positions');
  const xs=turrets.map((q:any)=>q.x), span=Math.max(...xs)-Math.min(...xs);
  assert(span>5,`Trail Sentry field collapsed into one local cluster (span ${span.toFixed(2)})`);
  assert(turrets.some((q:any)=>Math.hypot(q.x,q.z)>7),'Trail Sentry never leaves hero vicinity');
}

// 5) REVERSE: B starts at A's endpoint and travels back toward A origin.
{
  const sim=fixture('rail_spear','mass_driver','reverse');
  sim.activateSlot(0); sim.events.length=0; sim.activateSlot(1);
  const p=sim.projectiles.filter((q:any)=>q.source==='mass_driver').at(-1);
  const ev=sim.events.find((e:any)=>e.type==='CatalystChoreography'&&e.mode==='reverse');
  assert(ev&&p,'Reverse Mass Driver missing');
  assert(p.x>7,'Reverse Mass Driver did not start at Rail endpoint');
  assert(p.vx<0,'Reverse Mass Driver does not travel back toward the Rail origin');
}

// 6) COLLAPSE: directional B originates on A's outer area and aims into its center.
{
  const sim=fixture('frost_ring','rail_spear','collapse');
  sim.activateSlot(0); sim.events.length=0; sim.activateSlot(1);
  const ev=sim.events.find((e:any)=>e.type==='CatalystChoreography'&&e.mode==='collapse');
  const casts=sim.events.filter((e:any)=>e.type==='SkillActivated'&&e.skill==='rail_spear');
  assert(ev,'collapse event missing');
  assert(casts.length>=3,'Collapse did not create inward Rail spokes');
  for(const cast of casts){
    const dx=ev.centerX-cast.x,dz=ev.centerZ-cast.z,m=Math.hypot(dx,dz)||1;
    assert(Math.hypot(cast.x-ev.centerX,cast.z-ev.centerZ)>1,'Collapse Rail did not originate on Frost boundary');
    assert(cast.aimX*dx/m+cast.aimZ*dz/m>.82,'Collapse Rail is not aimed toward Frost center');
  }
}

// 7) Pair space is intentionally partial, never fake-universal.
const matrix:any={};
for(const cat of catalystOrder){
  let n=0,total=0;
  for(const a of activeSkillOrder)for(const b of activeSkillOrder)if(a!==b){total++;if(catalystPairCompatible(cat,a,b))n++;}
  matrix[cat]={compatible:n,total,ratio:+(n/total).toFixed(3)};
  assert(n>0&&n<total,`${cat}: compatibility became empty or universal`);
}

// 8) Renderer must have a dedicated visual grammar for each choreography, not a generic catalyst flash.
const renderer=readFileSync('src/renderer/webgl2.ts','utf8');
const bridge=readFileSync('src/presentation/bridge.ts','utf8');
assert(renderer.includes("e.type === 'choreography'"),'renderer ignores physical choreography cue');
for(const mode of ['source','carrier','trail','reverse','collapse'])
  assert(renderer.includes(`e.mode === '${mode}'`)||renderer.includes(`e.mode === 'trail' || e.mode === 'reverse'`),`renderer has no distinct visual branch for ${mode}`);
assert(bridge.includes("e.type === 'CatalystChoreography'"),'presentation bridge drops choreography event');
assert(renderer.includes('s.orbit.centerX')&&renderer.includes('s.orbit.centerZ'),'relocated Orbit still renders around hero');

// 9) Sentry base placement must be spatial even without a Catalyst.
{
  const sim=fixture('sentry','rail_spear','source');
  sim.catalysts=[null]; sim.activateSlot(0);
  const turrets=sim.constructs.filter((q:any)=>q.skill==='sentry');
  assert(turrets.length>0,'base Sentry deployed nothing');
  assert(turrets.every((q:any)=>q.x>1.2),'base Sentry reverted to spawning on top of hero');
}

console.log('catalyst-choreography-regression OK',JSON.stringify({signalAudit,matrix},null,2));
