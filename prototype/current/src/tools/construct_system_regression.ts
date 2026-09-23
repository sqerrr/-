import { ConstructSystem, type ConstructSystemPort } from '../core/constructSystem.js';
import { makeEnt, type Construct, type DelayedStrike, type Ent, type PhysicalEvent } from '../core/state.js';
import type { CombatShape } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('construct-system-regression: ' + message);
}

let now=0, dt=0.02, heroX=0, heroZ=0;
const entities:Ent[]=[];
const physical:PhysicalEvent[]=[];
const strikes:Omit<DelayedStrike,'id'>[]=[];
const shapes:{source:string;shape:CombatShape}[]=[];
const finishes:number[]=[];
let damageCalls=0, barrier=0;

const port:ConstructSystemPort={
  dt:()=>dt,
  time:()=>now,
  heroX:()=>heroX,
  heroZ:()=>heroZ,
  ownerById:(id)=>entities.find(e=>e.id===id) ?? null,
  entities:()=>entities,
  targetsFor:()=>entities,
  targetVisible:()=>true,
  damageTarget:(_construct,target,amount)=>{
    damageCalls++;
    target.hp-=amount;
  },
  combatShape:(source,shape)=>shapes.push({source,shape}),
  queuePhysicalEvent:(event)=>physical.push(event),
  finishAsyncPhysical:(activationId)=>{if(activationId) finishes.push(activationId);},
  scheduleStrike:(strike)=>strikes.push(strike),
  memoryFactor:()=>1,
  corePower:()=>2,
  grantBarrier:(amount)=>{barrier+=amount;}
};
const system=new ConstructSystem(port);

function enemy(id:number,x:number,z:number){
  const e=makeEnt({id,kind:'footnote',x,z,hp:1000,radius:.5,speed:0,contactDps:0});
  entities.push(e); return e;
}
function sentry(id:number,x:number,z:number,patch:Partial<Construct>={}):Construct{
  return {
    id,activationId:100+id,x,z,ttl:10,cooldown:0,range:10,power:1,skill:'sentry',
    faction:'hero',ownerId:0,sourceSlot:0,mutation:null,mutationUpgrade:null,
    mutationApotheosis:null,rivalConcentration:1,...patch
  };
}

// Autonomous shot still creates real damage + Catalyst contact.
{
  entities.length=0; physical.length=0; damageCalls=0;
  const target=enemy(1,3,0);
  const c=sentry(10,0,0);
  const alive=system.update([c]);
  assert(alive.length===1,'live construct retired');
  assert(damageCalls===1 && target.hp<1000,'sentry autonomous shot changed');
  assert(physical.some(e=>e.kind==='contact'&&e.carrierKind==='construct'&&e.targetId===target.id),
    'construct shot lost physical contact lineage');
}

// Expiry closes async physical activation.
{
  finishes.length=0; entities.length=0;
  const c=sentry(11,0,0,{ttl:.01,cooldown:99});
  const alive=system.update([c]);
  assert(alive.length===0 && finishes.includes(c.activationId!),'construct expiry lost async completion');
}

// Hunter Battery coordinates one shared delayed strike instead of multiplying per turret.
{
  entities.length=0; strikes.length=0; shapes.length=0; now=1; dt=.02;
  enemy(2,3,0);
  const a=sentry(20,0,-1,{cooldown:99,mutationApotheosis:'sentry_hunter_battery'});
  const b=sentry(21,0,1,{cooldown:99,mutationApotheosis:'sentry_hunter_battery'});
  system.update([a,b]);
  assert(strikes.length===1 && strikes[0].source==='sentry','Hunter Battery shared salvo changed');
  assert(shapes.filter(s=>s.source==='sentry_battery_tell').length===2,'Hunter Battery tell count changed');
  assert(system.diagnostics().batteryAt>now,'Hunter Battery cadence state not owned by construct system');
}

// Gravity Grid owns its own cadence and damages/control-pulls bodies crossing a link.
{
  entities.length=0; damageCalls=0; shapes.length=0; now=2; dt=.3;
  const target=enemy(3,2,0.6);
  const a=sentry(30,0,0,{cooldown:99,mutationApotheosis:'sentry_gravity_grid'});
  const b=sentry(31,4,0,{cooldown:99,mutationApotheosis:'sentry_gravity_grid'});
  const beforeZ=target.z;
  system.update([a,b]);
  assert(shapes.some(s=>s.source==='sentry_gravity_grid'),'Gravity Grid link presentation missing');
  assert(damageCalls>0 && target.hp<1000,'Gravity Grid damage changed');
  assert(target.z<beforeZ && target.displacedUntil>now,'Gravity Grid control pull changed');
}

console.log('construct-system-regression OK',{damageCalls,contacts:physical.length,strikes:strikes.length,barrier,diagnostics:system.diagnostics()});
