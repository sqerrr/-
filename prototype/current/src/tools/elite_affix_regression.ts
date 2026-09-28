import { EliteAffixSystem, SHIELD_POOL_SHARE, type EliteAffixPort } from '../core/eliteAffixSystem.js';
import { makeEnt, type Ent } from '../core/state.js';
import type { DamageSourceId, EliteOrderId } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('elite-affix-regression: ' + message);
}

let now=10, tick=600, px=5, pz=0, pvx=1, pvz=0;
const entities:Ent[]=[];
const orders:{order:EliteOrderId;count?:number}[]=[];
const hits:DamageSourceId[]=[];
const tells:string[]=[];
const retinue:number[]=[];
const rare:string[]=[];

const port:EliteAffixPort={
  world:{minX:-20,maxX:20,minZ:-20,maxZ:20},
  time:()=>now, dt:()=>1/60, tick:()=>tick,
  playerX:()=>px, playerZ:()=>pz, playerVX:()=>pvx, playerVZ:()=>pvz,
  hasEcho:()=>false,
  entities:()=>entities,
  randomRange:(min,max)=>(min+max)/2,
  spawnRetinue:(_entity,count)=>{retinue.push(count);},
  emitOrder:(_entity,order,count)=>orders.push({order,count}),
  emitTemporalTell:()=>tells.push('temporal'),
  emitShieldTell:()=>tells.push('shield'),
  emitRareEvent:(title)=>rare.push(title),
  hitPlayer:(_amount,_attacker,source)=>hits.push(source),
  damageScale:()=>2
};
const system=new EliteAffixSystem(port);
function elite(affix:Ent['affix'],id:number){
  const e=makeEnt({id,kind:'elite',x:0,z:0,hp:1000,maxHp:1000,radius:1,speed:2,contactDps:0,affix});
  entities.push(e);
  return e;
}

// Crowned patterns recover 60% faster.
{
  entities.length=0;
  const e=elite('crowned',1);
  e.cooldown=1;
  system.earlyTick(e);
  assert(Math.abs(e.cooldown-(1-(1/60)*0.6))<1e-9,'crowned cooldown modifier changed');
}

// Brood keeps a heavy retinue: two bodies every 3.5 s (three for legendary).
{
  entities.length=0; retinue.length=0; orders.length=0;
  const e=elite('brood',2);
  e.affixPulse=0;
  system.earlyTick(e);
  assert(retinue.length===1 && retinue[0]===2,'brood retinue size changed');
  assert(Math.abs(e.affixPulse-3.5)<1e-9,'brood summon cadence changed');
  assert(orders.some(o=>o.order==='brood'&&o.count===2),'brood order event changed');
  const legend=elite('brood',22);
  legend.rarity='legendary'; legend.affixPulse=0;
  system.earlyTick(legend);
  assert(retinue[1]===3,'legendary brood retinue size changed');
}

// Temporal starts with a tell and deliberately skips chassis/contact behavior that tick.
{
  entities.length=0; tells.length=0;
  const e=elite('temporal',3);
  e.affixPulse=0;
  const r=system.beforeBehavior(e,5);
  assert(r.skipBehavior,'temporal tell no longer suppresses same-tick chassis/contact behavior');
  assert(e.state==='telegraph' && Number(e.stateTimer)===0.6,'temporal tell state changed');
  assert(tells.includes('temporal'),'temporal tell presentation missing');

  e.stateTimer=0;
  e.lockedX=px+2; e.lockedZ=pz;
  const resolved=system.beforeBehavior(e,0);
  assert(!resolved.skipBehavior,'resolved temporal shift still suppresses chassis behavior');
  assert(String(e.state)==='normal' && hits.includes('temporal_shift'),'temporal shift no longer lands within 2.6');
  assert(Math.abs(e.affixPulse-2.8)<1e-9,'temporal blink cadence changed');
}

// Regeneration never stops: 1%/s under fire, 5%/s after 2 s without damage.
{
  entities.length=0;
  const e=elite('regenerating',4);
  const step=0.25+1/60;
  e.hp=500; e.lastDamageAt=now; e.regenTick=0.25;
  system.beforeBehavior(e,5);
  assert(Math.abs(e.hp-(500+1000*0.01*step))<1e-6,'under-fire regeneration changed');
  e.lastDamageAt=0; e.regenTick=0.25; const before=e.hp;
  system.beforeBehavior(e,5);
  assert(Math.abs(e.hp-(before+1000*0.05*step))<1e-6,'idle regeneration changed');
}

// Shielded commit preserves tell and temporary speed multiplier.
{
  entities.length=0; tells.length=0;
  const e=elite('shielded',5);
  e.affixPulse=0; e.shieldAngle=0;
  const start=system.beforeBehavior(e,5);
  assert(!start.skipBehavior && e.shieldState==='commit','shield commit did not arm');
  assert(tells.includes('shield'),'shield commit tell missing');
  assert(e.shieldMax===1000*SHIELD_POOL_SHARE && e.shieldHp===e.shieldMax,'shield pool not armed at 60% HP');

  const commit=system.beforeBehavior(e,5);
  assert(Math.abs(commit.speedMultiplier-1.25)<1e-9,'shield commit speed multiplier changed');
}

// Shield pool absorbs all damage first; frontal hits are cut; a drained pool breaks the shield.
{
  entities.length=0; rare.length=0;
  const e=elite('shielded',6);
  e.shieldState='guard'; e.shieldAngle=0;
  const nondirectional=system.modifyIncomingDamage(e,100,false,5,0);
  assert(nondirectional===0 && Math.abs((e.shieldHp??0)-500)<1e-9,'shield pool no longer absorbs area damage');
  const front=system.modifyIncomingDamage(e,100,true,5,0);
  assert(front===0 && Math.abs((e.shieldHp??0)-470)<1e-9,'frontal guard no longer cuts to 30% before absorption');
  const overflow=system.modifyIncomingDamage(e,1000,true,-5,0);
  assert(Math.abs(overflow-(1100-470))<1e-9,'rear overflow no longer passes through a drained pool');
  assert(String(e.shieldState)==='broken','drained pool did not break the shield');
  assert((e.shieldCommitUntil??0)===now+3.5 && e.exposedUntil===now+3.5,'shield break window changed');
  assert(rare.includes('ЩИТ СЛОМАН'),'shield break feedback disappeared');

  const broken=system.modifyIncomingDamage(e,100,true,5,0);
  assert(Math.abs(broken-130)<1e-9,'broken-shield vulnerability multiplier changed');

  now+=3.6;
  system.beforeBehavior(e,20);
  assert(String(e.shieldState)==='guard' && e.shieldHp===e.shieldMax,'shield did not return at full strength');
}

// Impulse doctrine cracks the pool directly on close hits.
{
  entities.length=0; rare.length=0;
  const e=elite('shielded',7);
  e.shieldState='guard';
  system.beforeBehavior(e,20);
  system.afterCloseDamage(e,1000,10);
  assert(String(e.shieldState)==='broken','Force damage no longer breaks the shield pool');
}

console.log('elite-affix-regression OK',{orders,retinue,tells,hits,rare});
