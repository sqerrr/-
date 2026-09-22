import { Simulation } from '../core/simulation.js';
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
  sim.sentryGridAcc=.28;
  const hpIn=inside.hp,hpOut=outside.hp;
  sim.updateConstructs();
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
  const e=sim.ents[0], st=sim.skillsRuntime.get('orbit_blades'), center={x:0,z:0}, profile=sim.orbitProfile(st,center);
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
  const e=sim.ents[0],profile=sim.orbitProfile(st,{x:0,z:0});
  e.x=20;e.z=20;
  sim.activateSlot(0);
  assert(casts(sim,'frost_ring').length===0,'Outbound pulse masqueraded as a Carrier contact');
  const next=(sim.tick+1)/sim.hz*3.4;
  e.x=Math.cos(next)*profile.radius;e.z=Math.sin(next)*profile.radius;e.orbitHitAt=-99;
  physicalTick(sim);
  assert(casts(sim,'frost_ring').length>0,'Outbound mutation lost real blade Carrier lineage');
}

// MORTAR REVERSE: no B at telegraph; actual final impact becomes reversed route head.
{
  const sim=fixture('mortar_bloom','rail_spear','reverse');
  sim.activateSlot(0);
  assert(casts(sim,'rail_spear').length===0,'Reverse fired at Mortar scheduling time');
  assert(until(sim,()=>!!cue(sim,'reverse'),120),'Mortar Reverse never fired');
  const impacts=sim.events.filter((e:any)=>e.type==='CombatShape'&&e.source==='mortar_bloom_impact'),
    impact=impacts.at(-1), rail=casts(sim,'rail_spear')[0], c=cue(sim,'reverse');
  assert(impact&&rail&&c&&dist(rail,impact.shape)<1.0,'Reverse did not begin at actual final impact');
  const toOrigin={x:-rail.x,z:-rail.z},m=Math.hypot(toOrigin.x,toOrigin.z)||1;
  assert(rail.aimX*toOrigin.x/m+rail.aimZ*toOrigin.z/m>.65,'Reverse does not face back toward activation origin');
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
    child=sim.catalystBindings.find((b:any)=>b.fromSlot===1&&b.toSlot===2);
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
  assert(sim.activationPending.size===0,'completed immediate activation retained pending actors');
  assert(sim.catalystBindings.every((b:any)=>!b.done),'completed bindings survived flush cleanup');
  assert(sim.activationMeta.size===0,'completed immediate Catalyst lineage leaked activation metadata');
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

console.log('physical-lifecycle-regression OK',{
  geometry:'shared',
  mortar:'impact-timed source/carrier/reverse',
  mass:'progressive trail',
  shard:'contact carrier',
  sentry:'actor-owned carrier lifetime',
  orbit:'discrete blade hitboxes + lineage',
  cleanup:'explicit activation retirement'
});
