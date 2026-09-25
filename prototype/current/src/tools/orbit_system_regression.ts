import { OrbitSystem, type OrbitSystemPort } from '../core/orbitSystem.js';
import { makeEnt, type Ent, type PhysicalEvent, type Projectile } from '../core/state.js';
import type { CombatShape, MutationId, SkillRuntime } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('orbit-system-regression: ' + message);
}

let now=0, activationId=77, barrier=0, aegis=0;
const entities:Ent[]=[];
const contacts:PhysicalEvent[]=[];
const projectiles:Omit<Projectile,'id'|'guarded'>[]=[];
const shapes:{source:string;shape:CombatShape}[]=[];
const retired:number[]=[];
const rares:string[]=[];

const runtime:SkillRuntime={
  id:'orbit_blades',level:1,power:0,coverage:0,range:0,duration:0,crit:.03,
  eliteDamage:0,count:1,control:0,statusPotency:0,
  mutation:null,mutationUpgrade:null,mutationApotheosis:null
};

const port:OrbitSystemPort={
  time:()=>now,
  tick:()=>Math.round(now*60),
  heroX:()=>0,
  heroZ:()=>0,
  entities:()=>entities,
  countAlive:(predicate)=>entities.filter(e=>e.hp>0&&predicate(e)).length,
  bestAlive:(compare)=>{
    let best:Ent|undefined;
    for(const e of entities){
      if(e.hp<=0) continue;
      if(!best||compare(e,best)<0) best=e;
    }
    return best;
  },
  powerBucket:()=>1,
  skillRadius:(_runtime,base)=>base,
  hasMutation:(st,id:MutationId)=>st.mutation===id||st.mutationUpgrade===id||st.mutationApotheosis===id,
  multiplicity:()=>0,
  quantityDoctrine:()=>0,
  orbitActivationId:()=>activationId,
  retireOrbitActivation:()=>{retired.push(activationId);activationId=0;},
  queuePhysicalEvent:(event)=>contacts.push(event),
  damageTarget:(target,amount)=>{target.hp-=amount;},
  grantBarrier:(amount)=>{barrier+=amount;},
  aegisCharge:()=>aegis,
  clearAegisCharge:()=>{aegis=0;},
  combatShape:(source,shape)=>shapes.push({source,shape}),
  emitRareEvent:(title)=>rares.push(title),
  spawnProjectile:(projectile)=>projectiles.push(projectile)
};
const system=new OrbitSystem(port);

// One geometry contract drives visible blade positions and damage hitboxes.
{
  entities.length=0;contacts.length=0;now=0;
  const geometry=system.geometry(runtime,{x:0,z:0});
  assert(geometry.profile.count===3 && geometry.blades.length===3,'base orbit blade count changed');
  const blade=geometry.blades[0];
  const e=makeEnt({id:1,kind:'footnote',x:blade.x,z:blade.z,hp:100,radius:.3,speed:0,contactDps:0});
  entities.push(e);
  system.update(runtime,true,0,()=>({x:0,z:0}));
  assert(e.hp<100,'visible blade position no longer matches damage geometry');
  assert(contacts.some(q=>q.kind==='contact'&&q.carrierKind==='orbit'&&q.carrierId===blade.index),
    'Orbit contact lost physical carrier lineage');
}

// Deactivation retires the persistent physical activation at the supplied choreography center.
{
  activationId=88;retired.length=0;
  system.update(undefined,false,-1,()=>({x:4,z:5}));
  assert(retired[0]===88 && activationId===0,'inactive Orbit did not retire async activation');
}

// Phoenix cadence produces one Returner projectile aimed from the shared orbit profile.
{
  activationId=99;projectiles.length=0;entities.length=0;now=10;
  const e=makeEnt({id:2,kind:'elite',x:5,z:0,hp:100,radius:.8,speed:0,contactDps:0});
  entities.push(e);
  runtime.mutationApotheosis='orbit_phoenix';
  system.update(runtime,true,0,()=>({x:0,z:0}));
  assert(projectiles.length===1 && projectiles[0].behavior==='returner'&&projectiles[0].apotheosis==='orbit_phoenix',
    'Orbit Phoenix projectile contract changed');
}

// Aegis Crown still consumes six stored interceptions and emits the readable control pulse.
{
  runtime.mutationApotheosis='orbit_aegis_crown';aegis=6;barrier=0;shapes.length=0;rares.length=0;now=20;
  system.update(runtime,true,0,()=>({x:0,z:0}));
  assert(aegis===0 && barrier>=16,'Aegis Crown charge/barrier exchange changed');
  assert(shapes.some(s=>s.source==='orbit_aegis_crown')&&rares.includes('КОРОНА ЭГИДЫ'),
    'Aegis Crown lost shared shape/readable event');
}

console.log('orbit-system-regression OK',{contacts:contacts.length,projectiles:projectiles.length,barrier,retired});
