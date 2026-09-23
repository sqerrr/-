import { SquadDirector, type SquadDirectorPort } from '../core/squadDirector.js';
import { makeEnt, type Ent, type Obstacle } from '../core/state.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('squad-director-regression: ' + message);
}

let time=0, px=0, pz=0, pvx=1, pvz=0, aimX=1, aimZ=0;
const entities:Ent[]=[];
const obstacles:Obstacle[]=[{id:1,x:3,z:0,radius:1.5,hp:-1,maxHp:-1,destructible:false}];
const port:SquadDirectorPort={
  world:{minX:-20,maxX:20,minZ:-20,maxZ:20},
  time:()=>time,
  playerX:()=>px, playerZ:()=>pz,
  playerVX:()=>pvx, playerVZ:()=>pvz,
  aimX:()=>aimX, aimZ:()=>aimZ,
  entities:()=>entities,
  obstacles:()=>obstacles,
  freeOf:(x,z)=>({x,z})
};
const director=new SquadDirector(port);

function enemy(kind:Ent['kind'],id:number,x:number,z:number){
  const e=makeEnt({id,kind,x,z,hp:100,radius:.5,speed:2,contactDps:0});
  entities.push(e);
  return e;
}

assert(director.taskFor(enemy('marginwalker',1,0,0),0)==='flank','marginwalker task changed');
assert(director.taskFor(enemy('redactor',2,0,0),0)==='flank','redactor task changed');
assert(director.taskFor(enemy('bookmark',3,0,0),0)==='intercept','bookmark task changed');
assert(director.taskFor(enemy('binder',4,0,0),0)==='hold','binder task changed');
assert(director.taskFor(enemy('indexer',5,0,0),0)==='hold','indexer task changed');

entities.length=0;
const kinds:Ent['kind'][]=['footnote','marginwalker','bookmark','binder','indexer','palimpsest','redactor','inkblot'];
for(let i=0;i<kinds.length;i++){
  const a=i/kinds.length*Math.PI*2;
  enemy(kinds[i],10+i,Math.cos(a)*8,Math.sin(a)*8);
}
director.update();
const assigned=entities.filter(e=>e.squadUntil>time);
const tasks=new Set(assigned.map(e=>e.squadTask));
for(const task of ['press','flank','intercept','hold'])
  assert(tasks.has(task as any),'mixed pack lost squad task '+task);
const targets=new Set(assigned.map(e=>e.orderX.toFixed(2)+':'+e.orderZ.toFixed(2)));
assert(targets.size>=4,'squad destinations collapsed together');

const firstUntil=assigned.map(e=>e.orderUntil);
time=1;
director.update();
assert(assigned.every((e,i)=>e.orderUntil===firstUntil[i]),'director replanned before 2.6 second cadence');

time=2.61;
director.update();
assert(director.diagnostics().nextPlanAt>5,'director planning cadence did not advance');

console.log('squad-director-regression OK',{tasks:[...tasks].sort(),targets:targets.size,next:director.diagnostics().nextPlanAt});
