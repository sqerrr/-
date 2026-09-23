import { Simulation } from '../core/simulation.js';
import {
  activeSkillOrder,
  catalystPairCompatible,
  phenomenonChoreography,
  skills
} from '../content/definitions.js';
import {
  circleIntersectsCircle,
  combatShapeIntersectsCircle,
  sweepCircleT
} from '../core/geometry.js';
import type { CatalystId, SkillId } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('physical-lifecycle-regression: ' + message);
}
const dist=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);

function fixture(left:SkillId,right:SkillId,catalyst:CatalystId){
  const sim:any=new Simulation({seed:95300+left.length*31+right.length*17+catalyst.length,hz:60,benchmark:true,mode:'clean'});
  sim.configureBenchmarkLoadout({
    slots:[left,right],catalysts:[catalyst],level:7,globalPower:.2,
    skillPower:.05,skillCoverage:0,skillRange:0,skillDuration:0
  });
  sim.px=0;sim.pz=0;sim.aimX=1;sim.aimZ=0;sim.playerVX=1;sim.playerVZ=0;
  sim.ents=[];sim.obstacles=[];sim.obstacleGrid=new Map();
  const spots=[[2.6,0],[3.25,.75],[4.2,-.55],[5.1,.35],[6.2,-.9],[7.1,.8],[8.1,-.25],[9,.45],[10,-.65],[11,.15]];
  for(let i=0;i<spots.length;i++){
    sim.spawnEnemyAt(i%3===0?'bookmark':'footnote',spots[i][0],spots[i][1],0);
  }
  for(const e of sim.ents){e.maxHp=1e9;e.hp=1e9;e.speed=0;e.contactDps=0;e.orbitHitAt=-99;}
  sim.events.length=0;
  return sim;
}

function physicalTick(sim:any){
  sim.tick++;
  sim.updateProjectiles();sim.flushPhysicalEvents();
  sim.updateDelayedStrikes();sim.flushPhysicalEvents();
  sim.updateFields();sim.flushPhysicalEvents();
  sim.updateConstructs();sim.flushPhysicalEvents();
  sim.updateOrbitBlades();sim.flushPhysicalEvents();
}
function advance(sim:any,ticks:number){for(let i=0;i<ticks;i++)physicalTick(sim);}
function until(sim:any,pred:()=>boolean,maxTicks=600){
  if(pred())return true;
  for(let i=0;i<maxTicks;i++){physicalTick(sim);if(pred())return true;}
  return false;
}
const cue=(sim:any,mode:string)=>sim.events.find((e:any)=>e.type==='CatalystChoreography'&&e.mode===mode);
const casts=(sim:any,id:SkillId)=>sim.events.filter((e:any)=>e.type==='SkillActivated'&&e.skill===id);
const damage=(sim:any,id:string)=>sim.events.filter((e:any)=>e.type==='DamageResolved'&&e.source===id);

// Shared geometry: actor radius belongs to the same test as the shape visible to the renderer.
assert(circleIntersectsCircle(0,0,1,1.35,0,.4),'circle overlap ignores target radius');
assert(combatShapeIntersectsCircle({kind:'ray',x:0,z:0,aimX:1,aimZ:0,range:5,halfWidth:.2},4.9,.48,.32),
  'ray capsule disagrees with target radius');
assert(combatShapeIntersectsCircle({kind:'sector',x:0,z:0,aimX:1,aimZ:0,radius:4,halfAngle:.3},3.6,1.45,.42),
  'sector edge does not include physical actor radius');
assert(sweepCircleT(0,0,12,0,5,0,.6)!==null,'continuous sweep can tunnel through a circle');

// Rail uses that exact ray/capsule geometry too; a large actor grazing the visible lane is hit.
{
  const sim=fixture('rail_spear','toxic_mist','source');
  sim.catalysts=[null];
  sim.ents=sim.ents.slice(0,1);
  const e=sim.ents[0];e.x=5;e.z=.8;e.radius=.6;
  sim.activateSlot(0);
  assert(damage(sim,'rail_spear').length>0,'Rail still uses a narrower private hitbox than its visible ray');
}

// Gravity Grid damage/control is exactly the rendered capsule, not a second wider hand-written lane.
{
  const sim=fixture('sentry','rail_spear','carrier');
  sim.catalysts=[null];
  sim.ents=sim.ents.slice(0,2);
  const inside=sim.ents[0], outside=sim.ents[1];
  inside.x=3;inside.z=.8;inside.radius=.4;
  outside.x=3;outside.z=1.1;outside.radius=.4;
  const common={ttl:2,cooldown:99,range:0,power:1,skill:'sentry',faction:'hero',ownerId:0,sourceSlot:0,mutation:null,mutationUpgrade:null,mutationApotheosis:'sentry_gravity_grid',rivalConcentration:1};
  sim.constructs=[
    {id:98001,x:0,z:0,...common},
    {id:98002,x:6,z:0,...common}
  ];
  const hpIn=inside.hp,hpOut=outside.hp;
  // Let the construct-owned cadence reach its real 280 ms Grid pulse; do not reach into runtime state.
  for(let i=0;i<18;i++) sim.updateConstructs();
  assert(inside.hp<hpIn,'Gravity Grid missed an actor whose circle overlaps the visible lane');
  assert(outside.hp===hpOut,'Gravity Grid damaged an actor outside the visible/shared capsule');
}

// Field damage/contact uses the same circle hitbox, including enemy radius.
{
  const sim=fixture('toxic_mist','frost_ring','collapse');
  sim.catalysts=[null];
  const e=sim.ents[0];e.x=1.3;e.z=0;e.radius=.4;
  const before=e.hp;
  sim.fields=[{id:99001,x:0,z:0,radius:1,ttl:2,kind:'fire',dps:40,tickAcc:.25,faction:'hero',ownerId:0,source:'toxic_mist',sourceSlot:0,mutation:null,rivalConcentration:1,insideIds:[]}];
  physicalTick(sim);
  assert(e.hp<before,'field edge still tests center point instead of actor hitbox');
}

// MORTAR SOURCE: scheduled marker is not a terminal. B cannot exist before the real impact.
{
  const sim=fixture('mortar_bloom','toxic_mist','source');
  sim.activateSlot(0);
  assert(!cue(sim,'source'),'Mortar Source fired at scheduling time');
  assert(casts(sim,'toxic_mist').length===0,'Mortar Source cast B before impact');
  advance(sim,18); // 0.30 s; base first impact is later.
  assert(!cue(sim,'source'),'Mortar Source fired before its delayed strike resolved');
  assert(until(sim,()=>!!cue(sim,'source'),90),'Mortar Source never fired on real impact completion');
  const c=cue(sim,'source'),
    impacts=sim.events.filter((e:any)=>e.type==='CombatShape'&&e.source==='mortar_bloom_impact'),
    lastImpact=impacts.at(-1);
  assert(lastImpact&&c.tick===lastImpact.tick,'Mortar Source is not synchronized to actual final impact');
  const mist=sim.fields.filter((q:any)=>q.source==='toxic_mist').at(-1);
  assert(mist&&dist(mist,lastImpact.shape)<1.1,'Mortar Source B origin differs from physical impact');
}

// Mortar Gravity is also impact-owned: the telegraph cannot pull bodies before a shell lands.
{
  const sim=fixture('mortar_bloom','toxic_mist','source');
  sim.catalysts=[null];
  sim.ents=sim.ents.slice(0,2);
  sim.skillsRuntime.get('mortar_bloom').mutationApotheosis='mortar_gravity_field';
  const moved=sim.ents[1], before={x:moved.x,z:moved.z};
  sim.activateSlot(0);
  assert(dist(moved,before)<1e-6,'Gravity Bomb displaced a target while only the marker existed');
  advance(sim,18);
  assert(dist(moved,before)<1e-6,'Gravity Bomb started pulling before physical impact');
  assert(until(sim,()=>sim.fields.some((q:any)=>q.source==='mortar_bloom'&&q.behavior==='pull'),90),
    'Gravity Bomb impact never created its persistent pull field');
  const afterImpact={x:moved.x,z:moved.z};
  advance(sim,12);
  assert(dist(moved,afterImpact)>.005,'Gravity Bomb field exists visually but does not pull through its hitbox');
}

// MORTAR CARRIER: the discussed Frost example fires on impact, never on shell scheduling.
{
  const sim=fixture('mortar_bloom','frost_ring','carrier');
  sim.activateSlot(0);
  assert(casts(sim,'frost_ring').length===0,'Mortar Carrier fired Frost at schedule/spawn time');
  assert(until(sim,()=>!!cue(sim,'carrier'),90),'Mortar impact never produced Carrier');
  const impact=sim.events.find((e:any)=>e.type==='CombatShape'&&e.source==='mortar_bloom_impact'),
    frost=casts(sim,'frost_ring')[0];
  assert(impact&&frost&&impact.tick===frost.tick,'Mortar Carrier is not edge-triggered by impact tick');
  assert(dist(frost,impact.shape)<1.0,'Mortar Carrier Frost did not originate at impact');
}

// Recoil cannot leave Catalyst origin at the hero's pre-recoil position: the moving body owns it.
{
  const sim=fixture('mass_driver','toxic_mist','trail');
  sim.skillsRuntime.get('mass_driver').mutation='mass_recoil';
  sim.activateSlot(0);
  const p=sim.projectiles.find((q:any)=>q.source==='mass_driver'),
    binding=sim.physicalDiagnostics().bindings.find((q:any)=>q.fromSkill==='mass_driver');
  assert(p&&binding,'Mass recoil fixture produced no projectile/binding');
  assert(dist(binding.origin,p)<.08,'Catalyst path origin differs from actual post-recoil Mass body spawn');
  assert(Math.abs(sim.px)>0.5,'Mass recoil fixture did not displace the hero');
}

// MASS DRIVER TRAIL: placements appear progressively behind the moving body, never pre-sampled down the aim ray.
{
  const sim=fixture('mass_driver','toxic_mist','trail');
  sim.activateSlot(0);
  assert(casts(sim,'toxic_mist').length===0,'Mass Driver Trail pre-created B at cast time');
  advance(sim,10);
  assert(casts(sim,'toxic_mist').length===0,'Mass Driver Trail appeared before projectile travelled enough distance');
  assert(until(sim,()=>casts(sim,'toxic_mist').length>0,90),'Mass Driver path never produced Trail placement');
  const p=sim.projectiles.find((q:any)=>q.source==='mass_driver'),
    first=casts(sim,'toxic_mist')[0];
  assert(p&&first.x<=p.x+.35,'Trail placement appeared ahead of the physical Mass Driver');
  const before=casts(sim,'toxic_mist').length;
  advance(sim,55);
  assert(casts(sim,'toxic_mist').length>=before,'Trail placements regressed while projectile continued moving');
}

// SHARD CARRIER: B fires on swept-circle contact, not at projectile spawn.
{
  const sim=fixture('shard_fan','frost_ring','carrier');
  sim.activateSlot(0);
  assert(casts(sim,'frost_ring').length===0,'Shard Carrier fired B when shards spawned');
  assert(until(sim,()=>casts(sim,'frost_ring').length>0,90),'Shard contact never fired Carrier');
  const shardHit=damage(sim,'shard_fan')[0], frost=casts(sim,'frost_ring')[0];
  assert(shardHit&&frost&&shardHit.tick===frost.tick,'Shard Carrier B is not synchronized to collision');
  assert(Math.hypot(frost.x-shardHit.x,frost.z-shardHit.z)<1.0,'Shard Carrier B origin differs from collision point');
}

// Carrier also reacts to the same swept collision against world cover, not only entity hits.
{
  const sim=fixture('shard_fan','frost_ring','carrier');
  sim.ents=[];
  sim.obstacles=[{id:97901,x:3,z:0,radius:.65,hp:-1,maxHp:-1,destructible:false}];
  sim.buildObstacleGrid();
  sim.activateSlot(0);
  assert(casts(sim,'frost_ring').length===0,'Shard Carrier fired before reaching cover');
  assert(until(sim,()=>casts(sim,'frost_ring').length>0,90),'world collision did not trigger Carrier');
  const frost=casts(sim,'frost_ring')[0];
  assert(frost&&Math.hypot(frost.x-3,frost.z)<1.2,'Carrier origin disagrees with projectile/cover contact');
}

// SENTRY CARRIER: deployment itself is not contact. Rail starts from turret on the first real shot.
{
  const sim=fixture('sentry','rail_spear','carrier');
  sim.activateSlot(0);
  assert(casts(sim,'rail_spear').length===0,'Sentry Carrier fired Rail at construction time');
  assert(until(sim,()=>casts(sim,'rail_spear').length>0,90),'Sentry shot never fired Carrier');
  const sentryHit=damage(sim,'sentry')[0], rail=casts(sim,'rail_spear')[0];
  assert(sentryHit&&rail&&sentryHit.tick===rail.tick,'Sentry Carrier is not synchronized to turret fire');
  const turret=sim.constructs.find((q:any)=>q.skill==='sentry');
  assert(turret&&dist(rail,turret)<.6,'Carrier Rail did not originate at the firing turret');
}

// TTL is a hard physical boundary: an actor that expires this tick cannot create a last ghost contact.
{
  const sim=fixture('sentry','rail_spear','carrier');
  sim.ents=sim.ents.slice(0,1);
  const e=sim.ents[0];e.x=3;e.z=0;
  sim.activateSlot(0);
  for(const c of sim.constructs){c.ttl=sim.dt*.5;c.cooldown=0;}
  const before=casts(sim,'rail_spear').length;
  physicalTick(sim);
  assert(casts(sim,'rail_spear').length===before,'expired Sentry fired a ghost Carrier shot');
}
{
  const sim=fixture('toxic_mist','frost_ring','collapse');
  sim.catalysts=[null];sim.ents=sim.ents.slice(0,1);
  const e=sim.ents[0];e.x=.8;e.z=0;e.radius=.4;
  sim.fields=[{id:97801,x:0,z:0,radius:1,ttl:sim.dt*.5,kind:'fire',dps:999,tickAcc:.25,faction:'hero',ownerId:0,source:'toxic_mist',sourceSlot:0,mutation:null,rivalConcentration:1,insideIds:[]}];
  const hp=e.hp;
  physicalTick(sim);
  assert(e.hp===hp,'expired field applied one final ghost damage/contact tick');
}

// Persistent Carrier lifetime belongs to the actual constructs, not an arbitrary six-second timeout.
{
  const sim=fixture('sentry','rail_spear','carrier');
  sim.ents=[];
  sim.skillsRuntime.get('sentry').duration=1; // ~10.5 s physical turrets.
  sim.activateSlot(0);
  advance(sim,390); // 6.5 s: beyond the removed legacy binding timeout.
  assert(sim.constructs.length>0,'long-lived Sentry fixture expired before timeout audit');
  assert(casts(sim,'rail_spear').length===0,'Sentry Carrier fired without a physical target contact');
  const t=sim.spawnEnemyAt('footnote',4,0,0);t.maxHp=1e9;t.hp=1e9;t.speed=0;t.contactDps=0;
  assert(until(sim,()=>casts(sim,'rail_spear').length>0,120),
    'Sentry Carrier binding expired while its owning turrets were still physically alive');
}

// ORBIT: hitbox is each visible blade. An enemy in the gap of the old annulus is not hit.
{
  const sim=fixture('orbit_blades','frost_ring','carrier');
  sim.tick=60; // past the initial hit interval
  sim.ents=sim.ents.slice(0,1);
  const e=sim.ents[0], st=sim.skillsRuntime.get('orbit_blades'), center={x:0,z:0}, profile=sim.orbitSystem.profile(st,center);
  sim.activateSlot(0);
  const nextTime=(sim.tick+1)/sim.hz, speed=st.mutation==='orbit_saw'?2.55:3.4,
    gap=nextTime*speed+Math.PI/profile.count;
  e.x=Math.cos(gap)*profile.radius;e.z=Math.sin(gap)*profile.radius;e.orbitHitAt=-99;
  physicalTick(sim);
  assert(damage(sim,'orbit_blades').length===0,'Orbit still damages the invisible annulus between blades');
  const next=(sim.tick+1)/sim.hz*speed;
  e.x=Math.cos(next)*profile.radius;e.z=Math.sin(next)*profile.radius;e.orbitHitAt=-99;
  physicalTick(sim);
  const orbitHit=damage(sim,'orbit_blades')[0], frost=casts(sim,'frost_ring')[0];
  assert(orbitHit&&frost,'real blade contact did not trigger Orbit Carrier');
  assert(orbitHit.tick===frost.tick,'Orbit Carrier is not synchronized to blade collision');
}

// Outbound adds a pulse but must not sever the persistent Orbit activation lineage.
{
  const sim=fixture('orbit_blades','frost_ring','carrier');
  sim.tick=60;sim.ents=sim.ents.slice(0,1);
  const st=sim.skillsRuntime.get('orbit_blades');st.mutation='orbit_outbound';
  const e=sim.ents[0],profile=sim.orbitSystem.profile(st,{x:0,z:0});
  e.x=20;e.z=20;
  sim.activateSlot(0);
  assert(casts(sim,'frost_ring').length===0,'Outbound pulse masqueraded as a Carrier contact');
  const next=(sim.tick+1)/sim.hz*3.4;
  e.x=Math.cos(next)*profile.radius;e.z=Math.sin(next)*profile.radius;e.orbitHitAt=-99;
  physicalTick(sim);
  assert(casts(sim,'frost_ring').length>0,'Outbound mutation lost real blade Carrier lineage');
}

// REVERSE requires a path that actually existed. Mortar has impacts but no simulated shell route.
{
  const sim=fixture('mortar_bloom','rail_spear','reverse');
  assert(!sim.catalysts.length || !sim.catalysts[0] || !sim.catalystCompatibleEdges('reverse').some((q:any)=>q.left==='mortar_bloom'&&q.right==='rail_spear'),
    'Mortar falsely advertises Reverse without a physical flight path');
  sim.activateSlot(0);
  advance(sim,120);
  assert(casts(sim,'rail_spear').length===0,'Mortar fabricated origin->impact route for Reverse');
}

// Moving Mass Driver does own a path, so Reverse waits for its real terminal and uses travelled geometry.
{
  const sim=fixture('mass_driver','rail_spear','reverse');
  sim.activateSlot(0);
  assert(casts(sim,'rail_spear').length===0,'Mass Reverse fired before the moving body reached terminal');
  assert(until(sim,()=>!!cue(sim,'reverse'),360),'Mass Driver Reverse never fired at physical terminal');
  const rail=casts(sim,'rail_spear')[0], c=cue(sim,'reverse');
  assert(rail&&c&&c.points.length>=2,'Mass Reverse did not preserve a real travelled route');
  assert(dist(rail,c.points[0])<1.0,'Reverse B did not begin at actual route end');
  const next=c.points[1],dx=next.x-rail.x,dz=next.z-rail.z,m=Math.hypot(dx,dz)||1;
  assert(rail.aimX*dx/m+rail.aimZ*dz/m>.55,'Mass Reverse does not face backward along travelled path');
}

// Terminal coordinates are captured at contact time, before Cleaver Hook moves its victim.
{
  const sim=fixture('cleaver','toxic_mist','source');
  sim.ents=sim.ents.slice(0,1);
  const e=sim.ents[0];e.x=2.6;e.z=0;
  sim.skillsRuntime.get('cleaver').mutation='cleaver_hook';
  const contact={x:e.x,z:e.z};
  sim.activateSlot(0);
  const mist=sim.fields.find((q:any)=>q.source==='toxic_mist');
  assert(mist,'Cleaver Source produced no payload');
  assert(dist(mist,contact)<.12,'Source terminal followed the target after pull instead of preserving contact');
  assert(Math.hypot(e.x-contact.x,e.z-contact.z)>.2,'Cleaver Hook fixture did not actually move the target');
}

// Secondary delayed Arc pulses do not postpone/redefine the semantic end of the immediate chain.
{
  const sim=fixture('chain_arc','toxic_mist','source');
  sim.skillsRuntime.get('chain_arc').mutation='arc_capacitive';
  const tick=sim.tick;
  sim.activateSlot(0);
  const mistCast=casts(sim,'toxic_mist')[0];
  assert(mistCast&&mistCast.tick===tick,'Chain Arc Source waited for a secondary delayed pulse');
}

// COLLAPSE uses the actual Frost circle now; it is allowed to fire immediately because the area exists immediately.
{
  const sim=fixture('frost_ring','rail_spear','collapse');
  sim.activateSlot(0);
  const c=cue(sim,'collapse'), rs=casts(sim,'rail_spear');
  assert(c&&rs.length>=2,'immediate physical Frost area did not collapse into Rail spokes');
  for(const r of rs){
    const dx=c.centerX-r.x,dz=c.centerZ-r.z,m=Math.hypot(dx,dz)||1;
    assert(r.aimX*dx/m+r.aimZ*dz/m>.55,'Collapse spoke does not converge on real area center');
  }
}

// A Catalyst-created activation stores the resolved world origin, not a pre-freeOf point inside cover.
{
  const sim:any=new Simulation({seed:96555,hz:60,benchmark:true,mode:'clean'});
  sim.configureBenchmarkLoadout({slots:['cleaver','rail_spear','toxic_mist'],catalysts:['source','source'],level:7});
  sim.px=0;sim.pz=0;sim.aimX=1;sim.aimZ=0;sim.ents=[];
  sim.obstacles=[{id:99101,x:5,z:0,radius:2,hp:-1,maxHp:-1,destructible:false}];
  sim.buildObstacleGrid();
  const parent:any={
    producerActivationId:1,fromSlot:0,toSlot:1,fromSkill:'cleaver',toSkill:'rail_spear',
    mode:'source',createdAt:sim.time,expiresAt:sim.time+5,origin:{x:0,z:0},path:[],areaPoints:[],
    nextTrailDistance:1.35,firedCount:0,carrierKeys:new Set(),pathCarrierKey:null,done:false
  };
  sim.events.length=0;
  assert(sim.castCatalystPayload(parent,5,0),'cascade fixture could not cast remote B');
  const cast=sim.events.find((e:any)=>e.type==='SkillActivated'&&e.skill==='rail_spear'),
    child=sim.physicalDiagnostics().bindings.find((b:any)=>b.fromSlot===1&&b.toSlot===2);
  assert(cast&&child,'remote B did not arm its outgoing Catalyst edge');
  assert(Math.hypot(child.origin.x-cast.x,child.origin.z-cast.z)<0.01,
    'B->C lineage origin differs from B resolved world position');
  assert(Math.hypot(child.origin.x-5,child.origin.z)>=2.27,
    'B->C lineage retained a point inside solid cover');
}

// The right-hand node belongs to the physical edge, not to the chain clock. It stays
// suppressed even after the cycle number advances while a slow producer is still alive.
{
  const sim=fixture('mass_driver','toxic_mist','source');
  sim.activateSlot(0);
  assert(casts(sim,'toxic_mist').length===0,'Mass Source unexpectedly fired immediately');
  sim.cycle += 3;
  sim.activateSlot(1);
  assert(casts(sim,'toxic_mist').length===0,'B regained an ordinary beat in a later cycle');
  assert(until(sim,()=>casts(sim,'toxic_mist').length>0,360),'slow Mass terminal never fired event-owned B');
  const after=casts(sim,'toxic_mist').length;
  sim.cycle += 1;
  sim.activateSlot(1);
  assert(casts(sim,'toxic_mist').length===after,'B duplicated after reactive cast on a later chain cycle');
}

// Completed causal chains retire their activation bookkeeping instead of leaking every beat forever.
{
  const sim=fixture('rail_spear','toxic_mist','source');
  sim.activateSlot(0);
  sim.flushPhysicalEvents();
  const lifecycle=sim.physicalDiagnostics();
  assert(lifecycle.pendingCount===0,'completed immediate activation retained pending actors');
  assert(lifecycle.bindings.every((b:any)=>!b.done),'completed bindings survived flush cleanup');
  assert(lifecycle.metadataCount===0,'completed immediate Catalyst lineage leaked activation metadata');
}

// The immediate case follows the same rule.
{
  const sim=fixture('rail_spear','toxic_mist','source');
  sim.activateSlot(0);
  const before=casts(sim,'toxic_mist').length;
  assert(before>0,'fixture did not produce reactive Source payload');
  sim.activateSlot(1);
  assert(casts(sim,'toxic_mist').length===before,'ordinary B beat duplicated Catalyst payload');
}

// Every live mutation branch must preserve every physical capability the base Phenomenon advertises.
// This is deliberately lifecycle-driven: the test never activates B directly.
{
  const modeForSignal:any={terminal:'source',carrier:'carrier',path:'trail',area:'collapse'};
  let cases=0,
    expectedCases=0;
  for(const left of activeSkillOrder)
    expectedCases+=(1+skills[left].mutations.length)*phenomenonChoreography[left].emits.length;
  const applyBranch=(sim:any,skill:SkillId,mutationId:string|null)=>{
    if(!mutationId)return;
    const defs=skills[skill].mutations as any[],
      chain:any[]=[];
    let cur=defs.find((q:any)=>q.id===mutationId);
    while(cur){
      chain.unshift(cur);
      if(!cur.parent)break;
      cur=defs.find((q:any)=>q.id===cur.parent);
    }
    const st=sim.skillsRuntime.get(skill);
    st.mutation=chain[0]?.id??null;
    st.mutationUpgrade=chain[1]?.id??null;
    st.mutationApotheosis=chain[2]?.id??null;
  };
  for(const left of activeSkillOrder){
    const variants:[string|null,...string[]]=[null,...skills[left].mutations.map((q:any)=>q.id)] as any;
    for(const mutationId of variants){
      for(const signal of phenomenonChoreography[left].emits){
        const cat=modeForSignal[signal] as CatalystId,
          right=activeSkillOrder.find((q)=>q!==left&&catalystPairCompatible(cat,left,q));
        assert(right,left+' '+String(mutationId)+': no representative right node for '+signal);
        const sim=fixture(left,right!,cat);
        applyBranch(sim,left,mutationId);
        if(left==='orbit_blades'){
          sim.tick=60;
          sim.ents=sim.ents.slice(0,1);
          const st=sim.skillsRuntime.get(left),p=sim.orbitSystem.profile(st,{x:0,z:0}),
            speed=st.mutation==='orbit_saw'?2.55:3.4,a=((sim.tick+1)/sim.hz)*speed;
          sim.ents[0].x=Math.cos(a)*p.radius;
          sim.ents[0].z=Math.sin(a)*p.radius;
          sim.ents[0].orbitHitAt=-99;
        }
        sim.activateSlot(0);
        const ok=until(sim,()=>!!cue(sim,cat),600);
        assert(ok,left+' '+String(mutationId)+': '+signal+' never produced '+cat+' choreography');
        assert(casts(sim,right!).length>0,left+' '+String(mutationId)+': '+cat+' cue had no physical B activation');
        cases++;
      }
    }
  }
  assert(cases===expectedCases,'mutation physical audit '+cases+' != catalogue-derived '+expectedCases);
}

console.log('physical-lifecycle-regression OK',{
  geometry:'shared',
  mortar:'impact-timed source/carrier; no fabricated reverse',
  mass:'progressive trail',
  shard:'contact carrier',
  sentry:'actor-owned carrier lifetime',
  orbit:'discrete blade hitboxes + lineage',
  cleanup:'explicit activation retirement',
  mutations:'all live branches preserve advertised physical signals'
});
