import { skills } from '../content/definitions.js';
import {
  StatefulPhenomenonCastSystem,
  type StatefulPhenomenonCastPort
} from '../core/statefulPhenomenonCastSystem.js';
import {
  makeEnt,
  type CastSource,
  type Construct,
  type DelayedStrike,
  type Ent,
  type Field,
  type Projectile
} from '../core/state.js';
import type { CombatShape, MutationId, SkillId, SkillRuntime } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('stateful-phenomenon-cast-regression: ' + message);
}

let now=10, cycle=2, activationControl=0, reactions=0, barrier=0;
let butcher=0, charge=0, physicalActivation=71, orbitPrepared=0, dashIFrames=0;
let nextConstructId=100;
const entities:Ent[]=[];
const constructs:Construct[]=[];
const fields:Omit<Field,'id'>[]=[];
const projectiles:Omit<Projectile,'id'|'guarded'>[]=[];
const strikes:Omit<DelayedStrike,'id'>[]=[];
const shapes:{source:string;shape:CombatShape;physicalTrace:boolean}[]=[];

const source:CastSource={
  faction:'hero',owner:null,x:0,z:0,aimX:1,aimZ:0,vx:1,vz:0
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

const port:StatefulPhenomenonCastPort={
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
  combatShape:(name,shape,_intent='damage',physicalTrace=true)=>shapes.push({source:name,shape,physicalTrace}),
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
    const c=Math.cos(rad),s=Math.sin(rad);
    return {x:src.aimX*c-src.aimZ*s,z:src.aimX*s+src.aimZ*c};
  },
  rayHits:()=>[],
  firstBlockingObstacleHit:()=>null,
  damage:(target,amount)=>{const alive=target.hp>0;target.hp-=amount;return alive&&target.hp<=0;},
  spawnProjectile:(projectile)=>projectiles.push(projectile),
  scheduleStrike:(strike)=>strikes.push(strike),
  addField:(field)=>fields.push(field),
  addActivationControl:(amount)=>{activationControl+=amount;},
  noteState:()=>{},
  noteReaction:()=>{reactions++;},
  emitReaction:()=>{reactions++;},
  emitRareEvent:()=>{},
  grantBarrier:(amount)=>{barrier+=amount;},
  doctrineForce:()=>0,

  resonanceMultiplicity:()=>0,
  doctrineQuantity:()=>0,
  activationCountBonus:()=>0,
  mutationCountAdd:()=>0,
  multiplicityFor:()=>0,

  butcherStacks:()=>butcher,
  setButcherStacks:(value)=>{butcher=value;},
  randomFloat:()=>0,
  randomRange:(min,max)=>(min+max)/2,

  constructs:()=>constructs,
  nearestEntity:(x,z,predicate,maxDistance)=>{
    let best:Ent|undefined,bestD2=maxDistance*maxDistance;
    for(const e of entities){
      if(e.hp<=0||!predicate(e)) continue;
      const dx=e.x-x,dz=e.z-z,d2=dx*dx+dz*dz;
      if(d2<bestD2){bestD2=d2;best=e;}
    }
    return best;
  },

  prepareOrbitActivation:()=>{orbitPrepared++;},
  freeOf:(x,z)=>({x,z}),
  currentPhysicalActivationId:()=>physicalActivation,
  addSentryConstruct:(construct)=>{
    const id=nextConstructId++;
    constructs.push({id,...construct});
    return id;
  },
  trimConstructs:(max)=>{while(constructs.length>max)constructs.shift();},

  charge:()=>charge,
  setCharge:(value)=>{charge=value;},

  cargoCount:()=>3,
  displaceSource:(src,dx,dz)=>{src.x+=dx;src.z+=dz;},
  grantHeroDashIFrames:(duration)=>{dashIFrames=Math.max(dashIFrames,duration);}
};

const system=new StatefulPhenomenonCastSystem(port);

// Cleaver is still the close-range kill/damage path.
{
  entities.length=0;
  const target=enemy(1,1,0);
  const st=runtime('cleaver');
  assert(system.cast('cleaver',st,0,{...source}),'Cleaver not handled');
  assert(target.hp<1000,'Cleaver damage changed');
}

// Arc consumes embedded state as an authored reaction and chains to a nearby body.
{
  entities.length=0;reactions=0;shapes.length=0;
  const a=enemy(2,2,0),b=enemy(3,4,0);
  a.embedded=1;
  const st=runtime('chain_arc');
  system.cast('chain_arc',st,0,{...source});
  assert(a.embedded===0&&reactions>0,'Arc embedded reaction changed');
  assert(a.hp<1000&&b.hp<1000,'Arc chain propagation changed');
  assert(shapes.filter(s=>s.source==='chain_arc').length>=2,'Arc readable chain geometry changed');
}

// Orbit delegates persistent lineage preparation before any outbound pulse.
{
  entities.length=0;orbitPrepared=0;
  const st=runtime('orbit_blades');
  system.cast('orbit_blades',st,0,{...source});
  assert(orbitPrepared===1,'Orbit persistent activation preparation escaped the lifecycle port');
}

// Mortar count remains full-strength independent scheduled impacts.
{
  entities.length=0;strikes.length=0;
  const st=runtime('mortar_bloom');st.count=3;
  system.cast('mortar_bloom',st,0,{...source});
  assert(strikes.length===3&&strikes.every(s=>s.source==='mortar_bloom'),'Mortar impact count changed');
}

// Sentry creates persistent constructs carrying current physical activation lineage.
{
  constructs.length=0;
  const st=runtime('sentry');
  system.cast('sentry',st,0,{...source});
  assert(constructs.length===1,'base Sentry deployment changed');
  assert(constructs[0].activationId===physicalActivation,'Sentry lost physical activation lineage');
  assert(constructs[0].ttl===5.25,'Sentry base persistence changed');
}

// Repulse Relay writes charge through the explicit run-state port.
{
  entities.length=0;activationControl=0;charge=0;
  const target=enemy(4,1,0);
  const st=runtime('repulse_halo');st.mutationUpgrade='repulse_relay';
  system.cast('repulse_halo',st,0,{...source});
  assert(target.hp<1000&&activationControl>0,'Repulse damage/control changed');
  assert(charge>0,'Repulse Relay stopped feeding charge state');
}

// Mass Cargo/Recoil remains a Roller projectile and grants the authored recoil i-frame window.
{
  projectiles.length=0;dashIFrames=0;
  const st=runtime('mass_driver');
  st.mutation='mass_recoil';
  st.mutationUpgrade='mass_counterthrust';
  st.mutationApotheosis='mass_comet_recoil';
  const moving={...source};
  const x0=moving.x;
  system.cast('mass_driver',st,0,moving);
  assert(projectiles.length===1&&projectiles[0].behavior==='roller','Mass Driver actor contract changed');
  assert(moving.x<x0,'Mass recoil stopped displacing its source');
  assert(dashIFrames===0.16,'Mass Comet recoil i-frame window changed');
}

assert(!system.cast('frost_ring',runtime('frost_ring'),0,{...source}),
  'stateful cast system claimed a geometry/status family Phenomenon');

console.log('stateful-phenomenon-cast-regression OK',{
  handled:['cleaver','chain_arc','orbit_blades','mortar_bloom','sentry','repulse_halo','mass_driver'],
  constructs:constructs.length,
  strikes:strikes.length,
  projectiles:projectiles.length
});
