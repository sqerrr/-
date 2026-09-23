import { EliteEchoSystem, type EliteEchoPort } from '../core/eliteEchoSystem.js';
import { makeEnt, type DelayedStrike, type Ent, type Field, type Projectile } from '../core/state.js';
import type { CombatShape, DamageSourceId, GameEvent, RefusedCard, ResonanceId, SkillId } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('elite-echo-system-regression: ' + message);
}

let now=0, playerX=8, playerZ=0, playerVX=0, playerVZ=0;
const owner=makeEnt({id:7,kind:'elite',x:0,z:0,hp:1000,maxHp:1000,radius:.8,speed:1,contactDps:0});
owner.repertoire=[1];
const entities=new Map<number,Ent>([[owner.id,owner]]);
const refusals:RefusedCard[]=[
  {serial:1,kind:'skill',title:'Рельсовое копьё',icon:'',skill:'rail_spear',heldBy:owner.id},
  {serial:2,kind:'skill',title:'Орбита',icon:'',skill:'orbit_blades',heldBy:owner.id}
];
const events:GameEvent[]=[];
const shapes:{source:string;shape:CombatShape}[]=[];
const strikes:Omit<DelayedStrike,'id'>[]=[];
const fields:Omit<Field,'id'>[]=[];
const projectiles:Omit<Projectile,'id'|'guarded'>[]=[];
const heroHits:{amount:number;source:DamageSourceId}[]=[];
let rivalCasts=0,rangeCalls=0,intCalls=0;

const port:EliteEchoPort={
  time:()=>now,
  tick:()=>Math.round(now*60),
  playerX:()=>playerX, playerZ:()=>playerZ,
  playerVX:()=>playerVX, playerVZ:()=>playerVZ,
  entityById:(id)=>entities.get(id),
  refusalStore:()=>refusals,
  randomRange:(min,_max)=>{rangeCalls++;return min;},
  randomInt:(_max)=>{intCalls++;return 0;},
  axisCount:(_entity,_axis:ResonanceId)=>0,
  patternCooldown:(base)=>base,
  lineOfSight:()=>true,
  damageScale:()=>2,
  damageHero:(amount,source)=>heroHits.push({amount,source}),
  combatShape:(source,shape)=>shapes.push({source,shape}),
  scheduleStrike:(strike)=>strikes.push(strike),
  addField:(field)=>fields.push(field),
  spawnProjectile:(projectile)=>projectiles.push(projectile),
  movePlayer:(dx,dz)=>{playerX+=dx;playerZ+=dz;},
  emit:(event)=>events.push(event),
  noteRivalCast:()=>{rivalCasts++;}
};
const system=new EliteEchoSystem(port);

// fieldRefusals owns initial cooldown and only starts once the cooldown matures.
system.fieldRefusals(owner,8);
assert(!system.has(owner.id)&&rangeCalls===1,'initial rival cooldown ownership changed');
now=2.59;
system.fieldRefusals(owner,8);
assert(!system.has(owner.id),'Echo started before initial cooldown');
now=2.61;
system.fieldRefusals(owner,8);
const tell=system.get(owner.id);
assert(tell?.phase==='tell'&&tell.skill==='rail_spear','eligible refusal did not enter tell phase');
assert(events.some(e=>e.type==='EliteEchoPhase'&&e.phase==='tell'),'tell phase event missing');
assert(events.some(e=>e.type==='CombatShape'&&String(e.source).includes('echo_rail_spear_tell')),
  'authored Rail tell geometry missing');

// Tell resolves through active -> recovery without touching the player cast dispatcher.
assert(tell,'tell state missing');
events.length=0;
now=tell.until;
system.update();
const active=system.get(owner.id);
assert(active?.phase==='active','Echo did not enter active phase');
assert(heroHits[0]?.source==='echo_rail_spear'&&heroHits[0].amount===68,'Rail Echo damage/scaling changed');
assert(rivalCasts===1&&events.some(e=>e.type==='RivalCast'&&e.skill==='rail_spear'),
  'rival cast accounting/event changed');

assert(active,'active state missing');
now=active.until;
system.update();
const recovery=system.get(owner.id);
assert(recovery?.phase==='recovery','Echo did not enter recovery');

assert(recovery,'recovery state missing');
now=recovery.until;
system.update();
assert(!system.has(owner.id),'Echo state survived recovery completion');
assert(Number(rangeCalls)===2,'recovery cooldown RNG cadence changed');

// Recovery cooldown blocks immediate reuse, then allows the next authored Echo.
system.fieldRefusals(owner,8);
assert(!system.has(owner.id),'Echo ignored recovery cooldown');
now+=3.2;
system.fieldRefusals(owner,8);
assert(system.has(owner.id),'Echo failed to re-arm after recovery cooldown');

// Orbit Echo keeps its one RNG gap and six hostile projectiles.
system.release(owner.id);
events.length=0; projectiles.length=0; intCalls=0;
system.start(owner,refusals[1]);
const orbitTell=system.get(owner.id);
assert(orbitTell,'Orbit tell missing');
now=orbitTell.until;
system.update();
assert(intCalls===1&&projectiles.length===6,'Orbit Echo gap/projectile cadence changed');

system.release(owner.id);
assert(!system.has(owner.id),'release did not clear owned Echo state');

console.log('elite-echo-system-regression OK',{
  rivalCasts,rangeCalls,intCalls,projectiles:projectiles.length,heroHits:heroHits.length
});
