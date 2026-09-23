import { DeathResolutionSystem, type DeathResolutionPort } from '../core/deathResolutionSystem.js';
import { makeEnt, type DelayedStrike, type Ent, type Field, type Pickup } from '../core/state.js';
import type { GameEvent, MutationId, RunMode, SkillId } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('death-resolution-regression: ' + message);
}

let now=10, tick=600, mode:RunMode='clean', xpMul=1.5, ownedCatalysts=0;
const entities:Ent[]=[];
const events:GameEvent[]=[];
const fields:Omit<Field,'id'>[]=[];
const strikes:Omit<DelayedStrike,'id'>[]=[];
const pickups:Omit<Pickup,'id'>[]=[];
const completed:number[]=[];
const eliteResolved:number[]=[];
let kills=0, eliteKills=0, bossDefeated=false, random=0.5;
const mutations=new Set<string>();

const port:DeathResolutionPort={
  time:()=>now,
  tick:()=>tick,
  mode:()=>mode,
  entities:()=>entities,
  clearForRevive:(entity)=>{
    entity.chillUntil=0; entity.igniteUntil=0; entity.toxinUntil=0; entity.toxinDps=0;
  },
  hasMutation:(skill:SkillId,mutation:MutationId)=>mutations.has(skill+':'+mutation),
  memoryFactor:()=>2,
  noteKill:(elite)=>{kills++;if(elite)eliteKills++;},
  resolveEliteDeath:(entity)=>eliteResolved.push(entity.id),
  emit:(event)=>events.push(event),
  markBossDefeated:()=>{bossDefeated=true;},
  getAliveEntity:(id)=>entities.find(e=>e.id===id&&e.hp>0),
  addField:(field)=>fields.push(field),
  scheduleStrike:(strike)=>strikes.push(strike),
  addPickup:(pickup)=>pickups.push(pickup),
  damageScale:()=>2,
  xpMultiplier:()=>xpMul,
  ownedCatalystCount:()=>ownedCatalysts,
  completePoi:(id)=>completed.push(id),
  randomFloat:()=>random
};
const system=new DeathResolutionSystem(port);
const reset=()=>{entities.length=0;events.length=0;fields.length=0;strikes.length=0;pickups.length=0;completed.length=0;eliteResolved.length=0;kills=0;eliteKills=0;bossDefeated=false;mutations.clear();random=.5;mode='clean';ownedCatalysts=0;};

function enemy(kind:Ent['kind'],id:number,patch:Partial<Ent>={}){
  const e=makeEnt({id,kind,x:0,z:0,hp:0,maxHp:100,radius:.5,speed:1,contactDps:0,...patch});
  entities.push(e);return e;
}

// Palimpsest revive is not counted as a kill and clears transient damage statuses.
{
  reset();
  const e=enemy('palimpsest',1,{revivesLeft:1,igniteUntil:99,toxinUntil:99,toxinDps:8,chillUntil:99});
  const alive=system.resolve(entities);
  assert(alive[0]===e && e.hp===42 && e.revivesLeft===0 && e.revived,'palimpsest revive contract changed');
  assert(kills===0 && events.some(x=>x.type==='EnemyRevived'),'revive incorrectly resolved as death');
  assert(e.igniteUntil===0&&e.toxinUntil===0&&e.chillUntil===0,'revive no longer clears status lifecycle');
}

// Toxic contagion spreads before the dead carrier is removed.
{
  reset(); mutations.add('toxic_mist:toxic_contagion');
  const dead=enemy('footnote',2,{toxinUntil:20,toxinDps:10});
  const live=makeEnt({id:3,kind:'footnote',x:1,z:0,hp:100,maxHp:100,radius:.5,speed:1,contactDps:0});
  entities.push(live);
  system.resolve(entities);
  assert(live.toxinUntil>now && Math.abs(live.toxinDps-7.2)<1e-9,'toxic contagion payload/order changed');
}

// Replicant death feeds back into the live parent and suppresses normal pickups.
{
  reset();
  const parent=makeEnt({id:4,kind:'elite',x:0,z:0,hp:100,maxHp:200,radius:.8,speed:1,contactDps:0});
  entities.push(parent);
  enemy('footnote',5,{cloneParent:4});
  const alive=system.resolve(entities);
  assert(alive.includes(parent),'live clone parent removed');
  assert(Math.abs(parent.hp-89)<1e-9,'replicant feedback amount changed');
  assert(events.some(x=>x.type==='DamageResolved'&&x.source==='replicant_feedback'),'replicant feedback event missing');
  assert(pickups.length===0,'replicant death started dropping ordinary rewards');
}

// Volatile elite gets readable delayed aftermath and clean-mode minimum core payout.
{
  reset(); random=.99;
  const elite=enemy('elite',6,{affix:'volatile',rarity:'common'});
  system.resolve(entities);
  assert(Number(kills)===1&&Number(eliteKills)===1&&eliteResolved[0]===elite.id,'elite accounting callback changed');
  assert(strikes.length===1&&strikes[0].source==='elite_volatile'&&strikes[0].at===now+.62,
    'volatile death lost delayed telegraph strike');
  const xp=pickups.find(p=>p.kind==='xp'),core=pickups.find(p=>p.kind==='core');
  assert(xp?.value===45,'elite XP multiplier changed');
  assert(core?.value===5,'clean-mode no-catalyst minimum core payout changed');
}

// Uplifted guardian resolves POI but still drops XP; guardian semantics suppress normal elite loot.
{
  reset();
  enemy('elite',7,{rarity:'uplifted',guardianPoi:12});
  system.resolve(entities);
  assert(completed[0]===12,'guardian death stopped clearing POI');
  assert(pickups.filter(p=>p.kind==='xp').length===1,'guardian death lost XP');
  assert(!pickups.some(p=>p.kind==='mutation'||p.kind==='core'),'guardian started dropping ordinary elite loot');
}

// Boss death marks completion and does not create normal pickups.
{
  reset();
  enemy('elite',8,{boss:true,rarity:'legendary'});
  system.resolve(entities);
  assert(bossDefeated,'boss death no longer marks run boss completion');
  assert(pickups.length===0,'boss death started dropping ordinary pickups');
}

console.log('death-resolution-regression OK',{
  revive:true,contagion:true,replicant:true,volatile:true,guardian:true,boss:true
});
