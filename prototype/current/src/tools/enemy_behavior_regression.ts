import { EnemyBehaviorSystem, type EnemyBehaviorPort } from '../core/enemyBehaviorSystem.js';
import { makeEnt, type Ent, type Field } from '../core/state.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('enemy-behavior-regression: ' + message);
}
const entities:Ent[]=[];
const fields:Field[]=[];
let time=10, px=6, pz=0, pvx=1, pvz=0;
let nextId=100, randomCalls=0;
const port:EnemyBehaviorPort={
  time:()=>time, dt:()=>1/60,
  playerX:()=>px, playerZ:()=>pz, playerVX:()=>pvx, playerVZ:()=>pvz,
  steerTo:(e,x,z,speed,mul=1)=>{
    const dx=x-e.x,dz=z-e.z,d=Math.hypot(dx,dz)||1;
    e.x+=dx/d*speed*mul/60; e.z+=dz/d*speed*mul/60;
  },
  lineOfSight:()=>true,
  getAliveEntity:(id)=>entities.find(e=>e.id===id&&e.hp>0),
  entities:()=>entities,
  fields:()=>fields,
  addField:(f)=>fields.push({id:nextId++,...f}),
  randomRange:(min,max)=>{randomCalls++;return (min+max)/2;},
  damageScale:()=>2
};
const system=new EnemyBehaviorSystem(port);
function enemy(kind:Ent['kind'],id:number,x=0,z=0){
  const e=makeEnt({id,kind,x,z,hp:100,radius:.5,speed:3,contactDps:0});
  entities.push(e); return e;
}

// Bookmark preserves tell -> dash -> recovery state machine.
{
  const e=enemy('bookmark',1);
  e.cooldown=0;
  system.update(e,e.speed,6,1,0);
  assert(e.state==='telegraph' && e.cooldown===99,'bookmark tell changed');
  e.stateTimer=0;
  system.update(e,e.speed,6,1,0);
  assert(String(e.state)==='dash','bookmark did not enter dash');
  e.stateTimer=0;
  system.update(e,e.speed,6,1,0);
  assert(String(e.state)==='normal' && Number(e.cooldown)===2.9,'bookmark recovery changed');
}

// Binder chooses a nearby non-binder and keeps identity by id.
{
  entities.length=0;
  const target=enemy('footnote',2,1,0);
  const binder=enemy('binder',3,0,0);
  binder.linkTimer=0;
  system.update(binder,binder.speed,6,1,0);
  assert(binder.linkedTo===target.id,'binder target selection changed');
}

// Redactor shortens a nearby player-created field.
{
  entities.length=0;
  fields.length=0;
  const redactor=enemy('redactor',4,0,0);
  redactor.cooldown=0;
  fields.push({id:50,x:1,z:0,radius:2,ttl:5,kind:'fire',dps:1,tickAcc:0});
  system.update(redactor,redactor.speed,6,1,0);
  assert(fields[0].ttl===0.25,'redactor field cancellation changed');
}

// Indexer creates a control field and routes nearby bodies to it.
{
  entities.length=0;
  fields.length=0;
  const indexer=enemy('indexer',5,0,0);
  const routed=enemy('footnote',6,1,1);
  indexer.cooldown=0;
  system.update(indexer,indexer.speed,6,1,0);
  assert(fields.some(f=>f.kind==='index'),'indexer no longer creates an index field');
  assert(routed.orderUntil>time,'indexer no longer routes nearby bodies');
}

// Inkblot keeps its authored random cooldown and field damage scaling.
{
  entities.length=0;
  fields.length=0;
  const ink=enemy('inkblot',7,0,0);
  ink.cooldown=0;
  system.update(ink,ink.speed,6,1,0);
  const field=fields.find(f=>f.kind==='ink');
  assert(field && field.dps===28,'inkblot field damage scaling changed');
  assert(randomCalls===1,'inkblot RNG cadence changed');
}

console.log('enemy-behavior-regression OK',{entities:entities.length,fields:fields.length,randomCalls});
