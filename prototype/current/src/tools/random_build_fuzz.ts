import { Simulation, type BenchmarkLoadout } from '../core/simulation.js';
import { activeSkillOrder, catalystOrder, catalystPairCompatible, skills } from '../content/definitions.js';
import type { CatalystId, DoctrineRuntime, MutationId, SkillId, Snapshot } from '../core/types.js';

class Rng {
  constructor(private x:number){}
  next(){ this.x=(Math.imul(this.x,1664525)+1013904223)>>>0; return this.x/0x100000000; }
  int(n:number){ return Math.floor(this.next()*n); }
}
const hz=60;
const rng=new Rng(0xB17DCAFE);
const builds=14;

function shuffle<T>(xs:T[],r:Rng){
  const a=[...xs]; for(let i=a.length-1;i>0;i--){const j=r.int(i+1);[a[i],a[j]]=[a[j],a[i]];} return a;
}
function branchFor(skill:SkillId,r:Rng){
  const defs=skills[skill].mutations;
  const roots=defs.filter(d=>!d.parent&&!d.apotheosis);
  const root=roots[r.int(roots.length)];
  const children=defs.filter(d=>d.parent===root.id&&!d.apotheosis);
  const child=children.length?children[r.int(children.length)]:undefined;
  const apoths=child?defs.filter(d=>d.parent===child.id&&d.apotheosis):[];
  const apoth=apoths.length?apoths[r.int(apoths.length)]:undefined;
  return {root:root?.id??null,child:child?.id??null,apoth:apoth?.id??null};
}
function doctrines(r:Rng):DoctrineRuntime{
  return {
    might:1+r.int(5), size:1+r.int(5), quantity:1+r.int(6), duration:1+r.int(5),
    mobility:1+r.int(5), guard:1+r.int(5), force:1+r.int(5), precision:1+r.int(5)
  };
}
function desiredRange(slots:SkillId[]){
  const close=slots.filter(id=>skills[id].baseRange<=0&&skills[id].baseRadius<=4.5).length;
  const field=slots.filter(id=>skills[id].baseRadius>=2.4).length;
  return close>=2?2.8:field>=2?4.5:6.5;
}
function steer(s:Snapshot,range:number,frame:number){
  const targets=[...s.entities].sort((a,b)=>Number(b.elite)-Number(a.elite)||Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(b.x-s.player.x,b.z-s.player.z));
  const t=targets[0]; let aimX=1,aimZ=0,moveX=0,moveZ=0;
  if(t){
    const dx=t.x-s.player.x,dz=t.z-s.player.z,d=Math.hypot(dx,dz)||1; aimX=dx/d;aimZ=dz/d;
    const err=d-range, tangent=(Math.floor(frame/(hz*2.1))%2?1:-1);
    moveX=aimX*Math.max(-.8,Math.min(.8,err*.38))-aimZ*.34*tangent;
    moveZ=aimZ*Math.max(-.8,Math.min(.8,err*.38))+aimX*.34*tangent;
    const m=Math.hypot(moveX,moveZ)||1; moveX/=m;moveZ/=m;
  }
  return {moveX,moveZ,aimX,aimZ,dash:false};
}
function quiet(sim:any,time:number){
  sim.tick=time*hz; sim.spawnCredits=-1e9; sim.eliteAcc=-1e9; sim.firstElite=true; sim.bossSpawned=true;
  sim.relicAcc=-1e9; sim.pois=[]; sim.obstacles=[]; sim.obstacleGrid=new Map(); sim.ents=[]; sim.php=sim.maxHp;
}
function spawnPack(sim:any){
  for(let i=0;i<72;i++){
    const a=(i%9)*Math.PI*2/9+(i%8)*.045, ring=4.2+Math.floor(i/18)*1.8+(i%4)*.2;
    sim.spawnEnemyAt(i%6===0?'bookmark':i%4===0?'marginwalker':'footnote',Math.cos(a)*ring,Math.sin(a)*ring,1);
  }
  sim.spawnElite();
  const e=sim.ents.find((q:any)=>q.kind==='elite'); e.x=7;e.z=0;e.affix='none';e.rarity='uplifted';e.maxHp=e.hp=12000;e.repertoire=[];
  return e;
}

const rows:any[]=[];
for(let n=0;n<builds;n++){
  const slots=shuffle(activeSkillOrder,rng).slice(0,4) as SkillId[];
  const catalysts=slots.slice(0,-1).map((left,i)=>{
    const right=slots[i+1], pool=catalystOrder.filter(id=>catalystPairCompatible(id,left,right));
    if(!pool.length) throw new Error(`no Catalyst 2.0 operator for ${left}->${right}`);
    return pool[rng.int(pool.length)];
  }) as CatalystId[];
  const mutations:any={},mutationUpgrades:any={},mutationApotheoses:any={},branches:any={};
  for(const id of slots){
    const b=branchFor(id,rng); branches[id]=b;
    if(b.root)mutations[id]=b.root as MutationId;
    if(b.child)mutationUpgrades[id]=b.child as MutationId;
    if(b.apoth)mutationApotheoses[id]=b.apoth as MutationId;
  }
  const loadout:BenchmarkLoadout={
    slots,catalysts,level:9,globalPower:.58,tempo:.24,maxHp:100000,armor:30,
    mutations,mutationUpgrades,mutationApotheoses
  };
  const sim:any=new Simulation({seed:93000+n*37,hz,runDuration:480,benchmark:true,mode:'clean'});
  sim.configureBenchmarkLoadout(loadout); Object.assign(sim.doctrines,doctrines(rng)); quiet(sim,300);
  const elite=spawnPack(sim),range=desiredRange(slots),initial=sim.ents.length;
  for(let i=0;i<14*hz;i++)sim.step(steer(sim.snapshot(),range,i));
  const alive=sim.ents.filter((e:any)=>e.hp>0).length, killed=initial-alive;
  const telemetry=sim.telemetry();
  const top=Object.entries(telemetry.damageBySource as Record<string,number>)
    .sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,v])=>[id,Math.round(v)]);
  const row={
    n,slots,catalysts,branches,doctrines:{...sim.doctrines},range,
    killed,eliteHp:+Math.max(0,elite.hp/elite.maxHp).toFixed(3),
    damage:Math.round(sim.metrics.damage),activations:sim.metrics.activations,top
  };
  if(!Number.isFinite(row.damage)||row.damage<=0||row.activations<=0)
    throw new Error('random build produced invalid combat output: '+JSON.stringify(row));
  rows.push(row);
}
const weak=rows.filter(r=>r.killed<20||r.eliteHp>.9).map(r=>({n:r.n,killed:r.killed,eliteHp:r.eliteHp,slots:r.slots,catalysts:r.catalysts}));
console.log('random-build-fuzz',JSON.stringify({rows,weak},null,2));
