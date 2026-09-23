import { DelayedStrikeSystem, type DelayedStrikeSystemPort } from '../core/delayedStrikeSystem.js';
import { makeEnt, type DelayedStrike, type Ent, type Field, type PhysicalEvent } from '../core/state.js';
import type { CombatShape, DamageSourceId } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('delayed-strike-regression: ' + message);
}

let now=1, heroX=0, heroZ=0;
const entities:Ent[]=[];
const shapes:{source:string;intent:string;shape:CombatShape}[]=[];
const physical:PhysicalEvent[]=[];
const fields:Omit<Field,'id'>[]=[];
const heroHits:DamageSourceId[]=[];
const targetHits:{id:number;amount:number;source:string}[]=[];
const finishes:number[]=[];

const port:DelayedStrikeSystemPort={
  time:()=>now,
  tick:()=>Math.round(now*60),
  heroX:()=>heroX,
  heroZ:()=>heroZ,
  ownerById:(id)=>entities.find(e=>e.id===id) ?? null,
  entities:()=>entities,
  emitImpactShape:(source,intent,shape)=>shapes.push({source,intent,shape}),
  queuePhysicalEvent:(event)=>physical.push(event),
  damageHero:(_amount,source)=>heroHits.push(source),
  damageTarget:(target,amount,source)=>{target.hp-=amount;targetHits.push({id:target.id,amount,source});},
  addField:(field)=>fields.push(field),
  finishAsyncPhysical:(activationId)=>{if(activationId) finishes.push(activationId);}
};
const system=new DelayedStrikeSystem(port);

function strike(patch:Partial<DelayedStrike>={}):DelayedStrike{
  return {
    id:10,activationId:77,at:2,x:0,z:0,radius:2,damage:30,faction:'hero',ownerId:0,
    source:'mortar_bloom',sourceSlot:0,intent:'damage',telegraph:'mortar_tell',...patch
  };
}

// Pending strike remains inert before authored impact time.
{
  shapes.length=0;physical.length=0;targetHits.length=0;finishes.length=0;
  const q=strike();
  const keep=system.update([q]);
  assert(keep.length===1 && shapes.length===0 && physical.length===0 && finishes.length===0,
    'delayed strike resolved before authored impact time');
}

// Hero impact uses one shared circle for presentation, physical lineage and damage, then retires async ownership.
{
  entities.length=0;shapes.length=0;physical.length=0;targetHits.length=0;finishes.length=0;fields.length=0;
  const target=makeEnt({id:1,kind:'footnote',x:1.8,z:0,hp:100,maxHp:100,radius:.4,speed:0,contactDps:0});
  entities.push(target);
  now=2;
  const q=strike({fieldKind:'fire',fieldDuration:3,fieldDps:7});
  const keep=system.update([q]);
  assert(keep.length===0,'resolved strike remained scheduled');
  assert(shapes.length===1&&shapes[0].source==='mortar_bloom_impact'&&shapes[0].shape.kind==='circle',
    'impact presentation shape changed');
  assert(target.hp===70&&targetHits.length===1,'impact damage no longer matches shared circle');
  assert(physical.length===1&&physical[0].kind==='impact'&&physical[0].carrierKind==='impact'&&physical[0].areaPoints?.length===4,
    'impact lost physical Catalyst lineage');
  assert(fields.length===1&&fields[0].kind==='fire'&&fields[0].ttl===3&&fields[0].dps===7,
    'post-impact field contract changed');
  assert(finishes[0]===77,'impact no longer retires async physical activation');
}

// Rival impact tests hero hit circle and keeps named death-recap source.
{
  heroHits.length=0;shapes.length=0;physical.length=0;finishes.length=0;now=5;heroX=0;heroZ=0;
  const owner=makeEnt({id:2,kind:'elite',x:3,z:0,hp:100,maxHp:100,radius:.8,speed:0,contactDps:0});
  entities.splice(0,entities.length,owner);
  system.update([strike({
    id:11,activationId:undefined,at:5,faction:'rival',ownerId:2,source:'elite_volatile',sourceSlot:-1
  })]);
  assert(heroHits[0]==='elite_volatile','rival delayed strike lost named damage source');
  assert(physical.length===0,'rival delayed strike emitted hero physical lineage');
}

console.log('delayed-strike-regression OK',{
  sharedShape:true,physicalImpact:true,field:true,rivalSource:heroHits[0]
});
