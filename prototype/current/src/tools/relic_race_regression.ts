import { RelicRaceSystem, type RelicRacePort } from '../core/relicRaceSystem.js';
import { makeEnt, type Ent, type Relic } from '../core/state.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('relic-race-regression: ' + message);
}

let dt=0,time=0,tick=0,px=0,pz=0,next=100,rate=1;
const entities:Ent[]=[];
const heroClaims:Relic[]=[];
const eliteClaims:{entity:number;relic:number}[]=[];
const appeared:Relic[]=[];
const steers:{entity:number;x:number;z:number;mul:number}[]=[];
let floatCalls=0,intCalls=0;
const floats=[0,0,0.25,0.5];
let fi=0;

const port:RelicRacePort={
  world:{minX:-48,maxX:48,minZ:-36,maxZ:36},
  dt:()=>dt,time:()=>time,tick:()=>tick,
  playerX:()=>px,playerZ:()=>pz,
  relicRateMultiplier:()=>rate,
  entities:()=>entities,
  hasEcho:()=>false,
  blocked:()=>false,
  steerTo:(entity,x,z,_speed,mul=1)=>steers.push({entity:entity.id,x,z,mul}),
  randomFloat:()=>{floatCalls++;return floats[fi++] ?? 0;},
  randomInt:(_max)=>{intCalls++;return 0;},
  nextId:()=>next++,
  onHeroClaim:(relic)=>heroClaims.push(relic),
  onEliteClaim:(entity,relic)=>eliteClaims.push({entity:entity.id,relic:relic.id}),
  emitAppeared:(relic)=>appeared.push(relic)
};
const system=new RelicRaceSystem(port);

// Real cadence reaches a spawn after 20 seconds and consumes exactly angle/distance/item RNG.
dt=20;time=20;
system.update();
assert(system.all.length===1,'20s cadence did not spawn a relic');
assert(appeared.length===1&&appeared[0].id===100,'spawn event/id ownership changed');
assert(floatCalls===2&&intCalls===1,'relic spawn RNG cadence changed');
assert(Math.abs(system.all[0].x-14)<1e-9&&Math.abs(system.all[0].z)<1e-9,
  'relic spawn geometry changed');

// Hero arbitration happens first when both sides are inside pickup reach.
const elite=makeEnt({id:7,kind:'elite',x:0.5,z:0,hp:100,radius:.8,speed:1,contactDps:0});
entities.push(elite);
system.replace([{id:200,x:0.6,z:0,item:'plating',bornAt:0}]);
dt=0;
system.update();
assert(heroClaims.some(r=>r.id===200),'hero lost simultaneous relic pickup priority');
assert(!eliteClaims.some(q=>q.relic===200),'elite claimed a relic already taken by hero');

// Elite reach scales with relicSeekMul and removes the relic exactly once.
px=20;pz=20;elite.x=0;elite.z=0;elite.relicSeekMul=1.5;
system.replace([{id:201,x:2.8,z:0,item:'bane',bornAt:0}]);
system.update();
assert(eliteClaims.some(q=>q.entity===elite.id&&q.relic===201),'elite scaled pickup reach changed');
assert(system.all.length===0,'claimed relic remained on the ground');

// Steering targets the nearest visible find but immediate melee still wins.
px=10;pz=0;elite.x=0;elite.z=0;elite.relicSeekMul=1;
system.replace([
  {id:202,x:8,z:1,item:'plating',bornAt:0},
  {id:203,x:6,z:0,item:'vitality',bornAt:0}
]);
steers.length=0;
assert(system.steerElite(elite,2,10),'elite stopped treating nearby relic as an objective');
assert(steers[0]?.x===6&&steers[0]?.mul===1.24,'elite did not steer to nearest relic with authored pressure');

steers.length=0;
assert(!system.steerElite(elite,2,2),'elite abandoned immediate melee to loot');
assert(steers.length===0,'melee-priority rejection still issued steering');

console.log('relic-race-regression OK',{
  floatCalls,intCalls,heroClaims:heroClaims.length,eliteClaims:eliteClaims.length,steers:steers.length
});
