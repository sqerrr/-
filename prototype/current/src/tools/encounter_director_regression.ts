import { EncounterDirector } from '../core/encounterDirector.js';
import { Rng } from '../core/rng.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('encounter-director-regression: ' + message);
}
function near(a:number,b:number,eps=1e-9){return Math.abs(a-b)<=eps;}

const director=new EncounterDirector(new Rng(12345));
assert(near(director.designMinutes(240,480),12),'design-time mapping changed');
assert(near(director.worldScale(0,480),1),'world scale start changed');
assert(near(director.damageScale(0,480),1),'damage scale start changed');
assert(director.populationTarget(0,false,false)===28,'opening population target changed');
assert(director.populationTarget(999,true,false)===118,'boss population target changed');
assert(director.populationTarget(999,true,true)===146,'phase-two boss population target changed');
assert(!director.shouldSpawnBoss(419,480,false),'boss starts before 87.5% run time');
assert(director.shouldSpawnBoss(420,480,false),'boss start threshold changed');
assert(!director.shouldSpawnBoss(480,480,true),'director requests duplicate boss');

const elite=new EncounterDirector(new Rng(9));
let request:null|string=null;
for(let i=0;i<21*60;i++) request=elite.tickElite({time:(i+1)/60,dt:1/60,bossSpawned:false,activeElites:0});
assert(request===null,'opening elite spawned before 22 seconds');
for(let i=21*60;i<22*60;i++) request=elite.tickElite({time:(i+1)/60,dt:1/60,bossSpawned:false,activeElites:0});
assert(request==='opening','opening elite cadence changed');

const rng=new Rng(77), spawns:string[]=[];
const normal=new EncounterDirector(rng);
normal.tickNormalSpawns({
  time:60,runDuration:480,dt:1,normalCount:0,bossActive:false,bossPhaseTwo:false,
  spawn:(kind)=>{spawns.push(kind); rng.float(); rng.float();}
});
assert(spawns.length>0,'normal spawn budget produced no work');
const d=normal.diagnostics();
assert(d.spawnCredits>=0,'spawn credits became negative');

console.log('encounter-director-regression OK', {spawns:spawns.length, first:spawns[0], diagnostics:d});
