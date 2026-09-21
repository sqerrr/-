import { readFileSync } from 'node:fs';
import {
  activeSkillOrder,
  catalystOrder,
  catalystPairCompatible,
  phenomenonChoreography,
  skills
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

// 8) Exhaustive pair smoke: every pair advertised as compatible must physically fire the
// right Phenomenon through the Catalyst, not merely pass a catalogue predicate. This is the
// mechanical half of the GIF-test; renderer grammar is checked immediately afterwards.
const pairAudit:any[]=[];
for(const cat of catalystOrder){
  for(const left of activeSkillOrder)for(const right of activeSkillOrder){
    if(left===right||!catalystPairCompatible(cat,left,right))continue;
    const sim=fixture(left,right,cat);
    sim.activateSlot(0);
    const leftTrace=sim.lastContext.trace;
    assert(leftTrace,`${cat} ${left}->${right}: left emitted no trace`);
    sim.events.length=0;
    sim.activateSlot(1);
    const cue=sim.events.find((e:any)=>e.type==='CatalystChoreography'&&e.mode===cat);
    const casts=sim.events.filter((e:any)=>e.type==='SkillActivated'&&e.skill===right);
    assert(cue,`${cat} ${left}->${right}: compatible pair did not fire choreography`);
    assert(casts.length>0,`${cat} ${left}->${right}: right Phenomenon never activated`);

    if(cat==='source'){
      assert(casts.some((q:any)=>Math.hypot(q.x,q.z)>.55),`${cat} ${left}->${right}: B still originates on hero`);
    } else if(cat==='carrier'){
      assert(cue.points.length>0,`${cat} ${left}->${right}: carrier cue has no live carriers`);
      assert(casts.some((q:any)=>cue.points.some((p:any)=>dist(q,p)<.9)),`${cat} ${left}->${right}: B is not cast from an A carrier`);
    } else if(cat==='trail'){
      assert(casts.length>=2,`${cat} ${left}->${right}: path did not create repeated B placements`);
      const span=Math.max(...casts.map((q:any)=>q.x))-Math.min(...casts.map((q:any)=>q.x))+
        Math.max(...casts.map((q:any)=>q.z))-Math.min(...casts.map((q:any)=>q.z));
      assert(span>1.2,`${cat} ${left}->${right}: repeated B placements collapsed to one point`);
    } else if(cat==='reverse'){
      const first=cue.points[0], second=cue.points[1]??cue.points[0], cast=casts[0];
      assert(first&&dist(first,cast)<1.0,`${cat} ${left}->${right}: B did not begin at reversed path head`);
      const dx=second.x-cast.x,dz=second.z-cast.z,m=Math.hypot(dx,dz)||1;
      assert(cast.aimX*dx/m+cast.aimZ*dz/m>.45,`${cat} ${left}->${right}: B does not face back along A path`);
    } else if(cat==='collapse'){
      const center={x:cue.centerX,z:cue.centerZ};
      if(skills[right].directional){
        assert(casts.length>=2,`${cat} ${left}->${right}: directional B has no inward spokes`);
        assert(casts.every((q:any)=>{
          const dx=center.x-q.x,dz=center.z-q.z,m=Math.hypot(dx,dz)||1;
          return q.aimX*dx/m+q.aimZ*dz/m>.45;
        }),`${cat} ${left}->${right}: directional spokes do not converge`);
      } else {
        assert(casts.some((q:any)=>dist(q,center)<1.0),`${cat} ${left}->${right}: radial B is not centered on A area`);
      }
    }

    for(const list of [sim.projectiles,sim.constructs,sim.fields,sim.ents])
      for(const q of list)assert(Number.isFinite(q.x)&&Number.isFinite(q.z),`${cat} ${left}->${right}: produced invalid world coordinates`);
    pairAudit.push(`${cat}:${left}->${right}`);
  }
}
assert(pairAudit.length>200,`too few Catalyst 2.0 pairs exercised: ${pairAudit.length}`);

// 9) Renderer must have a dedicated visual grammar for each choreography, not a generic catalyst flash.
const renderer=readFileSync('src/renderer/webgl2.ts','utf8');
const bridge=readFileSync('src/presentation/bridge.ts','utf8');
assert(renderer.includes("e.type === 'choreography'"),'renderer ignores physical choreography cue');
for(const mode of ['source','carrier','trail','reverse','collapse'])
  assert(renderer.includes(`e.mode === '${mode}'`)||renderer.includes(`e.mode === 'trail' || e.mode === 'reverse'`),`renderer has no distinct visual branch for ${mode}`);
assert(bridge.includes("e.type === 'CatalystChoreography'"),'presentation bridge drops choreography event');
assert(renderer.includes('s.orbit.centerX')&&renderer.includes('s.orbit.centerZ'),'relocated Orbit still renders around hero');

// 10) A Trail Sentry battery must be close enough to become an actual network, not decorative dots.
{
  const sim=fixture('rail_spear','sentry','trail');
  const st=sim.skillsRuntime.get('sentry');
  st.mutationApotheosis='sentry_gravity_grid';
  sim.activateSlot(0); sim.activateSlot(1);
  const turrets=sim.constructs.filter((q:any)=>q.skill==='sentry');
  assert(turrets.length>=4,`Trail Grid deployed too few towers to read as infrastructure: ${turrets.length}`);
  const sorted=[...turrets].sort((a:any,b:any)=>a.x-b.x||a.z-b.z);
  let connected=0;
  for(let i=1;i<sorted.length;i++)
    if(dist(sorted[i-1],sorted[i])<=6.4)connected++;
  assert(connected>=Math.min(3,sorted.length-1),`Trail Grid towers are too far apart to form a network: ${connected}/${sorted.length-1}`);
  sim.events.length=0;
  for(let i=0;i<20;i++)sim.updateConstructs();
  assert(sim.events.some((e:any)=>e.type==='CombatShape'&&e.source==='sentry_gravity_grid'),
    'Trail Grid exists visually but never creates real connecting control links');
}

// 11) Sentry base placement must be spatial even without a Catalyst.
{
  const sim=fixture('sentry','rail_spear','source');
  sim.catalysts=[null]; sim.activateSlot(0);
  const turrets=sim.constructs.filter((q:any)=>q.skill==='sentry');
  assert(turrets.length>0,'base Sentry deployed nothing');
  assert(turrets.every((q:any)=>q.x>1.2),'base Sentry reverted to spawning on top of hero');
}

console.log('catalyst-choreography-regression OK',JSON.stringify({signalAudit,matrix,pairAuditCount:pairAudit.length},null,2));
