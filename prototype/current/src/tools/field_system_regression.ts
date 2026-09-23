import { FieldSystem, type FieldSystemPort } from '../core/fieldSystem.js';
import { makeEnt, type Ent, type Field, type PhysicalEvent } from '../core/state.js';
import type { DamageSourceId } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('field-system-regression: ' + message);
}

let now=10, dt=0.02, heroX=20, heroZ=20;
const entities:Ent[]=[];
const physical:PhysicalEvent[]=[];
const targetHits:{id:number;amount:number;source:string}[]=[];
const heroHits:DamageSourceId[]=[];
let fieldDamage=0;

const port:FieldSystemPort={
  dt:()=>dt,
  time:()=>now,
  heroX:()=>heroX,
  heroZ:()=>heroZ,
  ownerById:(id)=>entities.find(e=>e.id===id) ?? null,
  bestAlive:(compare)=>{
    let best:Ent|undefined;
    for(const e of entities){
      if(e.hp<=0) continue;
      if(!best || compare(e,best)<0) best=e;
    }
    return best;
  },
  entities:()=>entities,
  hitPlayer:()=>{},
  damageHero:(_amount,source)=>heroHits.push(source),
  damageTarget:(target,amount,source)=>{
    targetHits.push({id:target.id,amount,source});
    target.hp-=amount;
  },
  memoryFactor:()=>2,
  addFieldDamage:(amount)=>{fieldDamage+=amount;},
  queuePhysicalEvent:(event)=>physical.push(event)
};
const system=new FieldSystem(port);

function enemy(id:number,x:number,z:number){
  const e=makeEnt({id,kind:'footnote',x,z,hp:100,radius:.5,speed:0,contactDps:0});
  entities.push(e);
  return e;
}

// Periodic toxic damage preserves status payload, corrosive bonus and field telemetry.
{
  entities.length=0; targetHits.length=0; physical.length=0; fieldDamage=0;
  const e=enemy(1,0.5,0);
  e.affix='shielded';
  const field:Field={
    id:10,activationId:77,insideIds:[],x:0,z:0,radius:2,ttl:3,kind:'toxic',dps:40,tickAcc:.24,
    faction:'hero',source:'toxic_mist',sourceSlot:1,mutation:'toxic_corrosive'
  };
  const alive=system.update([field]);
  assert(alive.length===1,'live field was retired');
  assert(targetHits.length===1 && Math.abs(targetHits[0].amount-16.5)<1e-9,'corrosive damage changed');
  assert(e.toxinUntil>now && e.toxinDps===22,'toxin status payload changed');
  assert(fieldDamage===10,'field damage telemetry changed');
  assert(physical.length===1 && physical[0].kind==='contact' && physical[0].targetId===e.id,
    'field entry no longer emits Catalyst contact');

  system.update(alive);
  assert(physical.length===1,'field contact is no longer edge-triggered');
}

// Pull fields move a body toward the actual field center and mark displacement.
{
  entities.length=0;
  const e=enemy(2,1,0);
  const field:Field={
    id:11,x:0,z:0,radius:3,ttl:2,kind:'frost',dps:0,tickAcc:0,faction:'hero',behavior:'pull'
  };
  const before=e.x;
  system.update([field]);
  assert(e.x<before,'pull field stopped moving targets inward');
  assert(e.displacedUntil>now,'pull field lost displaced state');
}

// Host fields still chase the best alive target, preferring elites.
{
  entities.length=0;
  enemy(3,1,0);
  const elite=makeEnt({id:4,kind:'elite',x:3,z:0,hp:100,radius:.8,speed:0,contactDps:0});
  entities.push(elite);
  const field:Field={
    id:12,x:0,z:0,radius:1,ttl:2,kind:'toxic',dps:0,tickAcc:0,faction:'hero',behavior:'host'
  };
  system.update([field]);
  assert(field.x>0,'host field stopped pursuing alive targets');
}

// Rival periodic fields keep their named death-recap source.
{
  entities.length=0; heroHits.length=0; heroX=0; heroZ=0;
  const field:Field={
    id:13,x:0,z:0,radius:2,ttl:2,kind:'fire',dps:20,tickAcc:.24,
    faction:'rival',source:'fire_field',sourceSlot:0
  };
  system.update([field]);
  assert(heroHits[0]==='fire_field','rival field lost named damage source');
}

console.log('field-system-regression OK',{targetHits:targetHits.length,contacts:physical.length,fieldDamage,heroHits});
