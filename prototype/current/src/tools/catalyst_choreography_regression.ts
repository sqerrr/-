import { readFileSync } from 'node:fs';
import {
  activeSkillOrder,
  catalysts,
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

// 2a) Gravity Anchor owns a literal world anchor: Source must start from that anchor,
// not from whichever dragged enemy happened to be processed last.
{
  const sim=fixture('tether_drag','toxic_mist','source');
  sim.activateSlot(0);
  const anchorPoint=sim.lastContext.trace?.terminal;
  assert(anchorPoint,'Gravity Anchor emitted no terminal');
  sim.events.length=0;
  sim.activateSlot(1);
  const toxic=sim.fields.filter((q:any)=>q.source==='toxic_mist').at(-1);
  assert(toxic,'Gravity Anchor Source did not create Toxic Mist');
  assert(dist(toxic,anchorPoint)<1.0,'Source detached from the physical Gravity Anchor');
}

// 2b) SOURCE on a moving Phenomenon must use the body that is visibly travelling now,
// not the far telegraph endpoint that it may reach several seconds later.
for (const left of ['mass_driver','shard_fan'] as SkillId[]) {
  const sim=fixture(left,'toxic_mist','source');
  sim.activateSlot(0);
  const projected=sim.lastContext.trace?.terminal;
  assert(projected,`${left}: moving trace has no projected terminal`);
  sim.ents=[];
  for(let i=0;i<8;i++)sim.updateProjectiles();
  const live=sim.projectiles
    .filter((p:any)=>p.source===left)
    .sort((a:any,b:any)=>Math.hypot(b.x,b.z)-Math.hypot(a.x,a.z))[0];
  assert(live,`${left}: moving body disappeared before next Chain beat`);
  assert(dist(live,projected)>2,`${left}: fixture does not separate live body from future endpoint`);
  sim.events.length=0;
  sim.activateSlot(1);
  const toxic=sim.fields.filter((q:any)=>q.source==='toxic_mist').at(-1);
  assert(toxic,`${left}: Source did not create Toxic Mist`);
  assert(dist(toxic,live)<1.25,`${left}: Source fired at a future endpoint instead of the live moving body`);
}

// 2c) TRAIL on a moving actor grows from the segment that actor has actually travelled.
for (const left of ['mass_driver','shard_fan'] as SkillId[]) {
  const sim=fixture(left,'frost_ring','trail');
  sim.activateSlot(0);
  const projected=sim.lastContext.trace?.terminal;
  assert(projected,`${left}: moving Trail has no projected endpoint fixture`);
  sim.ents=[];
  for(let i=0;i<30;i++)sim.updateProjectiles();
  const live=sim.projectiles
    .filter((p:any)=>p.source===left)
    .sort((a:any,b:any)=>Math.hypot(b.x,b.z)-Math.hypot(a.x,a.z))[0];
  assert(live,`${left}: moving body disappeared before Trail test`);
  sim.events.length=0;
  sim.activateSlot(1);
  const cue=sim.events.find((e:any)=>e.type==='CatalystChoreography'&&e.mode==='trail');
  const casts=sim.events.filter((e:any)=>e.type==='SkillActivated'&&e.skill==='frost_ring');
  assert(cue&&casts.length>=2,`${left}: live Trail did not create repeated Frost placements`);
  const span=Math.max(...casts.map((q:any)=>q.x))-Math.min(...casts.map((q:any)=>q.x))+
    Math.max(...casts.map((q:any)=>q.z))-Math.min(...casts.map((q:any)=>q.z));
  assert(span>1.15,`${left}: live travelled segment is still visually collapsed (${span.toFixed(2)})`);
  assert(casts.every((q:any)=>dist(q,projected)>1.5),
    `${left}: Trail leaked into future telegraph geometry instead of travelled space`);
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

// 5b) REVERSE is a staged playback, not just one cast from A's endpoint.
{
  const sim=fixture('chain_arc','rail_spear','reverse');
  sim.activateSlot(0); sim.events.length=0; sim.activateSlot(1);
  const ev=sim.events.find((e:any)=>e.type==='CatalystChoreography'&&e.mode==='reverse');
  const casts=sim.events.filter((e:any)=>e.type==='SkillActivated'&&e.skill==='rail_spear');
  assert(ev&&casts.length>=2,'Reverse did not stage Rail along the Arc path');
  assert(ev.points.length===casts.length,'Reverse cue and physical cast sequence disagree');
  assert(dist(casts[0],casts.at(-1))>1.2,'Reverse Rail sequence is visually collapsed');
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

// 6b) COLLAPSE must remain visible even when A and B are both hero-centred radial Phenomena.
// The crowd itself must physically converge; otherwise Frost -> Toxic would look almost identical
// to two independent casts despite the fancy Catalyst overlay.
{
  const sim=fixture('frost_ring','toxic_mist','collapse');
  sim.activateSlot(0);
  const before=new Map(sim.ents.map((e:any)=>[e.id,{x:e.x,z:e.z}]));
  sim.events.length=0;
  sim.activateSlot(1);
  const ev=sim.events.find((e:any)=>e.type==='CatalystChoreography'&&e.mode==='collapse');
  assert(ev,'radial Collapse event missing');
  let moved=0, inward=0;
  for(const e of sim.ents){
    const b=before.get(e.id) as any;
    if(!b)continue;
    const delta=Math.hypot(e.x-b.x,e.z-b.z);
    if(delta>.12){
      moved++;
      const db=Math.hypot(b.x-ev.centerX,b.z-ev.centerZ),
        da=Math.hypot(e.x-ev.centerX,e.z-ev.centerZ);
      if(da<db-.1)inward++;
    }
  }
  assert(moved>=2&&inward===moved,`radial Collapse did not visibly move the crowd inward: ${inward}/${moved}`);
}

// 6c) Sentry Collapse must build an actual inward field, not one ordinary battery at the centroid.
{
  const sim=fixture('frost_ring','sentry','collapse');
  const st=sim.skillsRuntime.get('sentry');
  st.mutationApotheosis='sentry_gravity_grid';
  sim.activateSlot(0); sim.events.length=0; sim.activateSlot(1);
  const ev=sim.events.find((e:any)=>e.type==='CatalystChoreography'&&e.mode==='collapse');
  const turrets=sim.constructs.filter((q:any)=>q.skill==='sentry');
  assert(ev,'Sentry Collapse event missing');
  assert(turrets.length>=3,`Sentry Collapse did not build perimeter batteries: ${turrets.length}`);
  const xs=turrets.map((q:any)=>q.x),zs=turrets.map((q:any)=>q.z);
  assert(Math.max(...xs)-Math.min(...xs)>2.2||Math.max(...zs)-Math.min(...zs)>2.2,
    'Sentry Collapse batteries collapsed into one local clump');
  sim.events.length=0;
  for(let i=0;i<20;i++)sim.updateConstructs();
  assert(sim.events.some((e:any)=>e.type==='CombatShape'&&e.source==='sentry_gravity_grid'),
    'Sentry Collapse created visible turrets but no real Gravity Grid links');
}

// 7) Pair space is intentionally partial, never fake-universal.
const matrix:any={};
for(const cat of catalystOrder){
  let n=0,total=0;
  for(const a of activeSkillOrder)for(const b of activeSkillOrder)if(a!==b){total++;if(catalystPairCompatible(cat,a,b))n++;}
  matrix[cat]={compatible:n,total,ratio:+(n/total).toFixed(3)};
  assert(n>0&&n<total,`${cat}: compatibility became empty or universal`);
}

assert(!catalystPairCompatible('reverse','rail_spear','chain_arc'),
  'Reverse still advertises target-seeking Chain Arc even though Arc cannot follow a prescribed return path');
assert(!catalystPairCompatible('carrier','sentry','orbit_blades'),
  'Emitter still advertises multiple A objects into a single global Orbit center');

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
      const destination=cue.points[cue.points.length-1];
      assert(destination,`${cat} ${left}->${right}: Source has no physical destination`);
      assert(casts.some((q:any)=>dist(q,destination)<1.0),
        `${cat} ${left}->${right}: B did not originate at A's physical Source destination`);
      // Moving actors can legitimately still be near the hero in this zero-time exhaustive fixture;
      // the dedicated live-motion test above advances them and proves they do not use future endpoints.
    } else if(cat==='carrier'){
      assert(cue.points.length>0,`${cat} ${left}->${right}: carrier cue has no live carriers`);
      assert(casts.some((q:any)=>cue.points.some((p:any)=>dist(q,p)<.9)),`${cat} ${left}->${right}: B is not cast from an A carrier`);
    } else if(cat==='trail'){
      assert(casts.length>=2,`${cat} ${left}->${right}: path did not create repeated B placements`);
      const moving=left==='mass_driver'||left==='shard_fan';
      const span=Math.max(...casts.map((q:any)=>q.x))-Math.min(...casts.map((q:any)=>q.x))+
        Math.max(...casts.map((q:any)=>q.z))-Math.min(...casts.map((q:any)=>q.z));
      if(!moving)
        assert(span>1.2,`${cat} ${left}->${right}: repeated B placements collapsed to one point`);
      else
        assert(casts.every((q:any)=>cue.points.some((p:any)=>dist(q,p)<1.0)),
          `${cat} ${left}->${right}: zero-time moving Trail left its actually travelled segment`);
    } else if(cat==='reverse'){
      assert(casts.length>=2,`${cat} ${left}->${right}: Reverse degraded to a single turned cast`);
      const first=cue.points[0], second=cue.points[1]??cue.points[0], cast=casts[0];
      assert(first&&dist(first,cast)<1.0,`${cat} ${left}->${right}: B did not begin at reversed path head`);
      assert(casts.every((q:any)=>cue.points.some((p:any)=>dist(q,p)<1.0)),
        `${cat} ${left}->${right}: Reverse casts left A's physical path`);
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
      } else if(right==='sentry'){
        // Collapse Sentry is intentionally infrastructure: several perimeter batteries face
        // inward instead of pretending a single ordinary non-directional cast at the centroid.
        assert(casts.length>=3,`${cat} ${left}->${right}: Sentry did not build perimeter batteries`);
        const sentrySpan=Math.max(...casts.map((q:any)=>q.x))-Math.min(...casts.map((q:any)=>q.x))+
          Math.max(...casts.map((q:any)=>q.z))-Math.min(...casts.map((q:any)=>q.z));
        assert(sentrySpan>1.3,`${cat} ${left}->${right}: Sentry perimeter collapsed into one clump`);
        assert(casts.filter((q:any)=>dist(q,center)>.65).length>=2,
          `${cat} ${left}->${right}: too few Sentry batteries use A's perimeter`);
        assert(casts.every((q:any)=>{
          const dx=center.x-q.x,dz=center.z-q.z,m=Math.hypot(dx,dz)||1;
          return q.aimX*dx/m+q.aimZ*dz/m>.35;
        }),`${cat} ${left}->${right}: Sentry batteries do not face the convergence center`);
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
assert(catalysts.carrier.name==='Излучатель','Carrier still exposes misleading attachment/network naming');
assert(renderer.includes("e.type === 'choreography'"),'renderer ignores physical choreography cue');
for(const mode of ['source','carrier','trail','reverse','collapse'])
  assert(renderer.includes(`e.mode === '${mode}'`)||renderer.includes(`e.mode === 'trail' || e.mode === 'reverse'`),`renderer has no distinct visual branch for ${mode}`);
const emitterBlock=renderer.slice(renderer.indexOf("e.mode === 'carrier'"),renderer.indexOf("e.mode === 'trail' || e.mode === 'reverse'"));
assert(!emitterBlock.includes("kind:'bolt'"),'Emitter presentation still falsely connects A carriers into a network');
assert(emitterBlock.includes("for(let arm=0;arm<4;arm++)"),'Emitter has no per-object outward launch signature');
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

// 10b) Quantity must enrich a Sentry Trail without erasing its early nodes via the global cap.
{
  const sim=fixture('rail_spear','sentry','trail');
  sim.doctrines.quantity=6;
  sim.resonance.multiplicity=4;
  const st=sim.skillsRuntime.get('sentry');
  st.count=3;
  sim.activateSlot(0); sim.events.length=0; sim.activateSlot(1);
  const turrets=sim.constructs.filter((q:any)=>q.skill==='sentry');
  assert(turrets.length>=6&&turrets.length<=18,`Quantity Sentry Trail produced implausible node count: ${turrets.length}`);
  const xs=turrets.map((q:any)=>q.x), span=Math.max(...xs)-Math.min(...xs);
  assert(span>5,'Quantity Sentry Trail lost route coverage to local construct-cap churn');
  const cue=sim.events.find((e:any)=>e.type==='CatalystChoreography'&&e.mode==='trail');
  assert(cue&&cue.points.length>=3,'Quantity Sentry Trail lost its choreography route');
  assert(cue.points.slice(0,-1).every((p:any)=>turrets.some((q:any)=>dist(p,q)<4.2)),
    'Quantity Sentry Trail discarded early physical nodes');
}

// 11) Catalyst-created world origins obey the same solid-world rules as ordinary actors.
{
  const sim=fixture('rail_spear','toxic_mist','source');
  sim.obstacles=[{id:9001,x:5,z:0,radius:2,hp:-1,maxHp:-1,destructible:false}];
  sim.buildObstacleGrid();
  const safe=sim.safeChoreographyPoint(5,0,.28);
  assert(Math.hypot(safe.x-5,safe.z)>=2.27,
    `choreography origin remained inside solid cover: ${JSON.stringify(safe)}`);
  const edge=sim.safeChoreographyPoint(999,-999,.28);
  assert(edge.x<=sim.world.maxX-.27&&edge.x>=sim.world.minX+.27&&
         edge.z<=sim.world.maxZ-.27&&edge.z>=sim.world.minZ+.27,
    `choreography origin escaped arena bounds: ${JSON.stringify(edge)}`);
}

// 12) Sentry base placement must be spatial even without a Catalyst.
{
  const sim=fixture('sentry','rail_spear','source');
  sim.catalysts=[null]; sim.activateSlot(0);
  const turrets=sim.constructs.filter((q:any)=>q.skill==='sentry');
  assert(turrets.length>0,'base Sentry deployed nothing');
  assert(turrets.every((q:any)=>q.x>1.2),'base Sentry reverted to spawning on top of hero');
}

console.log('catalyst-choreography-regression OK',JSON.stringify({signalAudit,matrix,pairAuditCount:pairAudit.length},null,2));
