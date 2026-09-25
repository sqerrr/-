import { skills } from '../content/definitions.js';
import { PhenomenonCastSystem, type PhenomenonCastPort } from '../core/phenomenonCastSystem.js';
import { makeEnt, type CastSource, type DelayedStrike, type Ent, type Field, type Projectile } from '../core/state.js';
import type { CombatShape, MutationId, SkillId, SkillRuntime } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('phenomenon-cast-system-regression: ' + message);
}

let now=10, cycle=2, closeDamage=0, activationControl=0, reactions=0, barrier=0;
const entities:Ent[]=[];
const projectiles:Omit<Projectile,'id'|'guarded'>[]=[];
const strikes:Omit<DelayedStrike,'id'>[]=[];
const fields:Omit<Field,'id'>[]=[];
const shapes:{source:string;shape:CombatShape;physicalTrace:boolean}[]=[];
const states:string[]=[];
const damageSources:string[]=[];
const rareEvents:string[]=[];

const source:CastSource={
  faction:'hero',owner:null,x:0,z:0,aimX:1,aimZ:0,vx:0,vz:0
};

function runtime(id:SkillId):SkillRuntime {
  return {
    id,level:1,power:0,coverage:0,range:0,duration:0,crit:.03,eliteDamage:0,count:1,
    control:0,statusPotency:0,mutation:null,mutationUpgrade:null,mutationApotheosis:null
  };
}
function enemy(id:number,x:number,z:number,kind:Ent['kind']='footnote'){
  const e=makeEnt({id,kind,x,z,hp:1000,radius:.45,speed:0,contactDps:0});
  entities.push(e);
  return e;
}

const port:PhenomenonCastPort={
  time:()=>now,
  cycle:()=>cycle,
  skillRadius:(_runtime,base)=>base,
  skillRange:(_runtime,base)=>base,
  persistentDuration:(_runtime,base)=>base,
  powerBucket:()=>1,
  slotAmp:()=>1,
  memoryFactor:()=>1,
  mutationIs:(st,id:MutationId)=>st.mutation===id||st.mutationUpgrade===id||st.mutationApotheosis===id,
  projectileCount:(st)=>Math.max(1,Math.round(st.count)),
  combatShape:(src,shape,_intent='damage',physicalTrace=true)=>shapes.push({source:src,shape,physicalTrace}),
  targetsFor:()=>entities,
  bestTarget:(_src,predicate,compare)=>{
    let best:Ent|undefined;
    for(const e of entities){
      if(e.hp<=0||!predicate(e)) continue;
      if(!best||compare(e,best)<0) best=e;
    }
    return best;
  },
  targetVisible:()=>true,
  aimPoint:(src,range)=>({x:src.x+src.aimX*range,z:src.z+src.aimZ*range}),
  rotatedAim:(src,rad)=>{
    const cos=Math.cos(rad),sin=Math.sin(rad);
    return {x:src.aimX*cos-src.aimZ*sin,z:src.aimX*sin+src.aimZ*cos};
  },
  rayHits:(src,ax,az,range,width,maxHits=99)=>{
    const m=Math.hypot(ax,az)||1,nx=ax/m,nz=az/m;
    return entities
      .filter(e=>e.hp>0)
      .map(e=>{const dx=e.x-src.x,dz=e.z-src.z;return {e,t:dx*nx+dz*nz,lat:Math.abs(dx*nz-dz*nx)};})
      .filter(h=>h.t>=-h.e.radius&&h.t<=range+h.e.radius&&h.lat<=width+h.e.radius)
      .sort((a,b)=>a.t-b.t)
      .slice(0,maxHits);
  },
  firstBlockingObstacleHit:()=>null,
  damage:(target,amount,src)=>{
    target.hp-=amount;
    damageSources.push(src);
  },
  spawnProjectile:(projectile)=>projectiles.push(projectile),
  scheduleStrike:(strike)=>strikes.push(strike),
  addField:(field)=>fields.push(field),
  addCloseDamage:(amount)=>{closeDamage+=amount;},
  addActivationControl:(amount)=>{activationControl+=amount;},
  noteState:(state)=>states.push(state),
  noteReaction:()=>{reactions++;},
  emitReaction:()=>{reactions++;},
  emitRareEvent:(title)=>rareEvents.push(title),
  grantBarrier:(amount)=>{barrier+=amount;},
  doctrineForce:()=>0
};
const system=new PhenomenonCastSystem(port);

// Breach retains its directional lane and displacement mutation.
{
  entities.length=0;states.length=0;damageSources.length=0;
  const target=enemy(1,2,0);
  const st=runtime('breach_line'); st.mutation='breach_stagger';
  assert(system.cast('breach_line',st,0,source),'breach_line not handled');
  assert(target.hp<1000 && damageSources[0]==='breach_line','breach damage changed');
  assert(target.displacedUntil>now && states.includes('displaced'),'breach stagger state changed');
}

// Contact Saw preserves close-damage telemetry and bleed payload.
{
  entities.length=0;states.length=0;closeDamage=0;
  const target=enemy(2,1,0);
  const st=runtime('contact_saw'); st.mutation='saw_bleed';
  system.cast('contact_saw',st,0,source);
  assert(target.hp<1000 && closeDamage>0,'Contact Saw close damage changed');
  assert(target.woundUntil>now && target.woundDps>0 && states.includes('wound'),'Contact Saw bleed changed');
}

// Shard Fan remains a moving projectile cast and keeps telegraph out of physical trace.
{
  entities.length=0;projectiles.length=0;shapes.length=0;
  const st=runtime('shard_fan'); st.count=3;
  system.cast('shard_fan',st,0,source);
  assert(projectiles.length===3,'Shard Fan projectile multiplicity changed');
  assert(projectiles.every(p=>p.behavior==='returner'&&p.source==='shard_fan'),'Shard Fan projectile contract changed');
  assert(shapes.filter(s=>s.source==='shard_fan').every(s=>!s.physicalTrace),
    'Shard Fan intended lane leaked into Catalyst physical path truth');
}

// Gravity Prison keeps elite control semantics and shield stability damage.
{
  entities.length=0;shapes.length=0;activationControl=0;
  const st=runtime('tether_drag'); st.mutationApotheosis='gravity_prison';
  const anchor=skills.tether_drag.baseRange;
  const target=enemy(3,anchor,0,'elite');
  target.affix='shielded'; target.shieldStability=100;
  system.cast('tether_drag',st,0,source);
  assert(activationControl>0,'Tether no longer records activation control');
  assert(target.exposedUntil>now && target.chillUntil>now,'Gravity Prison elite exposure changed');
  assert((target.shieldStability??100)<100,'Gravity Prison no longer pressures shield stability');
  assert(shapes.some(s=>s.source==='gravity_prison'),'Gravity Prison readable control shape missing');
}

// Pin Field keeps its status payload at the authored target point.
{
  entities.length=0;states.length=0;
  const st=runtime('pin_burst'); st.mutation='pin_field';
  const target=enemy(4,skills.pin_burst.baseRange,0);
  system.cast('pin_burst',st,0,source);
  assert(target.hp<1000 && target.toxinUntil>now && target.toxinDps>0,'Pin Field toxin payload changed');
  assert(states.includes('toxin')&&states.includes('displaced'),'Pin Burst state bookkeeping changed');
}



// Ember preserves thermal shock, splash and ignite state.
{
  entities.length=0;states.length=0;damageSources.length=0;reactions=0;
  const primary=enemy(5,2,0), splash=enemy(6,2.8,0);
  primary.chillUntil=now+2;
  const st=runtime('ember_lance');
  system.cast('ember_lance',st,0,source);
  assert(primary.hp<1000 && primary.igniteUntil>now,'Ember ignite payload changed');
  assert(primary.chillUntil===0,'Ember thermal shock no longer consumes chill');
  assert(splash.hp<1000,'Ember thermal shock splash changed');
  assert(reactions>0,'Ember thermal shock reaction bookkeeping changed');
}

// Frost Snap preserves shatter semantics and control bookkeeping.
{
  entities.length=0;states.length=0;rareEvents.length=0;activationControl=0;
  const target=enemy(7,1,0);
  target.chillUntil=now+2;
  const st=runtime('frost_ring'); st.mutation='frost_snap';
  system.cast('frost_ring',st,0,source);
  assert(target.hp<1000 && target.chillUntil>now,'Frost post-shatter chill application changed');
  assert(rareEvents.includes('РАСКОЛ'),'Frost shatter readable event missing');
  assert(activationControl>0,'Frost control bookkeeping changed');
}

// Rail Lattice keeps its delayed cross-pattern even without a direct hit.
{
  entities.length=0;strikes.length=0;
  const st=runtime('rail_spear'); st.mutationApotheosis='rail_lattice';
  system.cast('rail_spear',st,0,source);
  assert(strikes.length===14,'Rail Lattice delayed node count changed');
  assert(strikes.every(s=>s.source==='rail_spear'&&s.telegraph==='rail_lattice_node'),
    'Rail Lattice delayed strike contract changed');
}

// Toxic Reactive keeps immediate Septic Cut plus the persistent mist actor.
{
  entities.length=0;fields.length=0;damageSources.length=0;reactions=0;
  const target=enemy(8,0.5,0);
  target.igniteUntil=now+2;
  const st=runtime('toxic_mist'); st.mutation='toxic_reactive';
  system.cast('toxic_mist',st,0,source);
  assert(damageSources.includes('septic_cut'),'Toxic Reactive immediate cut changed');
  assert(fields.length===1&&fields[0].kind==='toxic','Toxic Mist persistent field contract changed');
  assert(reactions>0,'Toxic Reactive reaction bookkeeping changed');
}

assert(!system.cast('cleaver',runtime('cleaver'),0,source),'cast system claimed a not-yet-migrated Phenomenon');

console.log('phenomenon-cast-system-regression OK',{
  handled:['breach_line','contact_saw','shard_fan','tether_drag','pin_burst','ember_lance','frost_ring','rail_spear','toxic_mist'],
  projectiles:projectiles.length,
  strikes:strikes.length
});
