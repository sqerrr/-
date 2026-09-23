import { EliteAffixSystem, type EliteAffixPort } from '../core/eliteAffixSystem.js';
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
const spawned:string[]=[];
let randomCalls=0;

const port:EliteAffixPort={
  world:{minX:-20,maxX:20,minZ:-20,maxZ:20},
  time:()=>now, dt:()=>1/60, tick:()=>tick,
  playerX:()=>px, playerZ:()=>pz, playerVX:()=>pvx, playerVZ:()=>pvz,
  hasEcho:()=>false,
  entities:()=>entities,
  randomRange:(min,max)=>{randomCalls++;return (min+max)/2;},
  spawnEnemyAt:(kind)=>{spawned.push(kind);},
  emitOrder:(_entity,order,count)=>orders.push({order,count}),
  emitTemporalTell:()=>tells.push('temporal'),
  emitShieldTell:()=>tells.push('shield'),
  hitPlayer:(_amount,_attacker,source)=>hits.push(source),
  damageScale:()=>2
};
const system=new EliteAffixSystem(port);
function elite(affix:Ent['affix'],id:number){
  const e=makeEnt({id,kind:'elite',x:0,z:0,hp:1000,maxHp:1000,radius:1,speed:2,contactDps:0,affix});
  entities.push(e);
  return e;
}

// Crowned modifies only authored cooldown cadence.
{
  entities.length=0;
  const e=elite('crowned',1);
  e.cooldown=1;
  system.earlyTick(e);
  assert(Math.abs(e.cooldown-(1-(1/60)*0.24))<1e-9,'crowned cooldown modifier changed');
}

// Brood summons exactly three supports using six RNG pulls, preserving call cadence.
{
  entities.length=0; spawned.length=0; orders.length=0; randomCalls=0;
  const e=elite('brood',2);
  e.affixPulse=0;
  system.earlyTick(e);
  assert(spawned.length===3,'brood support count changed');
  assert(spawned[0]==='bookmark' && spawned[1]==='palimpsest' && spawned[2]==='palimpsest',
    'brood support composition changed');
  assert(randomCalls===6,'brood RNG cadence changed');
  assert(orders.some(o=>o.order==='brood'&&o.count===3),'brood order event changed');
}

// Temporal starts with a tell and deliberately skips chassis/contact behavior that tick.
{
  entities.length=0; tells.length=0;
  const e=elite('temporal',3);
  e.affixPulse=0;
  const r=system.beforeBehavior(e,5);
  assert(r.skipBehavior,'temporal tell no longer suppresses same-tick chassis/contact behavior');
  assert(e.state==='telegraph' && Number(e.stateTimer)===0.76,'temporal tell state changed');
  assert(tells.includes('temporal'),'temporal tell presentation missing');

  e.stateTimer=0;
  e.lockedX=px; e.lockedZ=pz;
  const resolved=system.beforeBehavior(e,0);
  assert(!resolved.skipBehavior,'resolved temporal shift still suppresses chassis behavior');
  assert(String(e.state)==='normal' && hits.includes('temporal_shift'),'temporal shift resolution changed');
}

// Regeneration keeps its half-second cadence and 1.6% max-HP pulse.
{
  entities.length=0;
  const e=elite('regenerating',4);
  e.hp=500; e.lastDamageAt=0; e.regenTick=0.49;
  now=10;
  system.beforeBehavior(e,5);
  assert(Math.abs(e.hp-516)<1e-9,'regeneration pulse amount changed');
  assert(e.regenTick<0.01,'regeneration cadence changed');
}

// Shielded commit preserves tell and temporary speed multiplier.
{
  entities.length=0; tells.length=0;
  const e=elite('shielded',5);
  e.affixPulse=0; e.shieldAngle=0;
  const start=system.beforeBehavior(e,5);
  assert(!start.skipBehavior && e.shieldState==='commit','shield commit did not arm');
  assert(tells.includes('shield'),'shield commit tell missing');

  const commit=system.beforeBehavior(e,5);
  assert(Math.abs(commit.speedMultiplier-1.18)<1e-9,'shield commit speed multiplier changed');
}

console.log('elite-affix-regression OK',{orders,spawned,randomCalls,tells,hits});
