import { BossBehaviorSystem, type BossBehaviorPort } from '../core/bossBehaviorSystem.js';
import { makeEnt } from '../core/state.js';
import type { BossPatternId, CombatShape, DamageSourceId } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('boss-behavior-regression: ' + message);
}

let now=100, tick=6000, px=5, pz=0, pvx=0, pvz=0;
const phases:number[]=[];
const patterns:BossPatternId[]=[];
const telegraphs:CombatShape[]=[];
const hits:{amount:number;source:DamageSourceId}[]=[];
const spawned:string[]=[];
const random=[0.1,0.99]; // sweep, then no phase-two adds.
let ri=0;

const port:BossBehaviorPort={
  world:{minX:-20,maxX:20,minZ:-20,maxZ:20},
  time:()=>now,
  tick:()=>tick,
  dt:()=>1/60,
  playerX:()=>px, playerZ:()=>pz, playerVX:()=>pvx, playerVZ:()=>pvz,
  hasEcho:()=>false,
  fieldRefusals:()=>{},
  steerTo:()=>{},
  playerInSector:()=>true,
  playerInRay:()=>true,
  hitPlayer:(amount,_attacker,source)=>hits.push({amount,source}),
  damageScale:()=>2,
  addField:()=>{},
  spawnEnemyAt:(kind)=>{spawned.push(kind);},
  randomFloat:()=>random[ri++] ?? 0.99,
  randomRange:(min,max)=>(min+max)/2,
  emitPhase:(_entity,phase)=>phases.push(phase),
  emitTelegraph:(_source,shape)=>telegraphs.push(shape),
  emitPattern:(_entity,pattern)=>patterns.push(pattern)
};

const system=new BossBehaviorSystem(port);
const boss=makeEnt({
  id:42,kind:'elite',x:0,z:0,hp:1000,maxHp:1000,radius:1.4,speed:2,contactDps:0,
  boss:true,bossPhase:1,chassis:'warden',rarity:'legendary',adaptCooldown:0
});

// Pattern selection remains explicit and deterministic under the supplied RNG stream.
system.update(boss,boss.speed,5,1,0);
assert(boss.bossPattern==='sweep','first pattern selection changed');
assert(boss.adaptStage===1,'boss did not enter tell/commit stage');
assert(patterns[0]==='sweep','BossPattern event missing');
assert(telegraphs[0]?.kind==='sector','sweep telegraph geometry changed');

// Resolve the committed sweep.
boss.stateTimer=0;
system.update(boss,boss.speed,5,1,0);
assert(hits.some((h)=>h.source==='warden_sweep'),'committed sweep no longer damages through the boss port');
assert(Number(boss.adaptStage)===0 && boss.exposedUntil>now,'boss recovery/exposure changed');

// Crossing 33% from phase two enters phase three and creates four authored supports.
boss.bossPhase=2;
boss.hp=boss.maxHp*0.3;
boss.adaptStage=0;
boss.adaptCooldown=99;
system.update(boss,boss.speed,5,1,0);
assert(phases.includes(3),'phase-three transition event missing');
assert(spawned.length===4,'phase-three support count changed');
assert(spawned.filter((x)=>x==='bookmark').length===2 && spawned.filter((x)=>x==='marginwalker').length===2,
  'phase-three support composition changed');

console.log('boss-behavior-regression OK',{patterns,phases,spawned,hits:hits.map(h=>h.source)});
