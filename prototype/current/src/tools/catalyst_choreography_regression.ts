import { readFileSync } from 'node:fs';
import {
  activeSkillOrder,
  catalystOrder,
  catalystPairCompatible,
  phenomenonChoreography,
  skills
} from '../content/definitions.js';
import { Simulation } from '../core/simulation.js';
import type { CatalystId, SkillId } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('catalyst-choreography-regression: ' + message);
}
const dist=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);

function fixture(left:SkillId,right:SkillId,catalyst:CatalystId){
  const sim:any=new Simulation({seed:96000+left.length*37+right.length*11+catalyst.length,hz:60,benchmark:true,mode:'clean'});
  sim.configureBenchmarkLoadout({
    slots:[left,right],catalysts:[catalyst],level:7,globalPower:.2,
    skillPower:.05,skillCoverage:0,skillRange:0,skillDuration:0
  });
  sim.tick=60;
  sim.px=0;sim.pz=0;sim.aimX=1;sim.aimZ=0;sim.playerVX=1;sim.playerVZ=0;
  sim.ents=[];sim.obstacles=[];sim.obstacleGrid=new Map();
  const spots=[[2.6,0],[3.25,.75],[4.2,-.55],[5.1,.35],[6.2,-.9],[7.1,.8],[8.1,-.25],[9,.45],[10,-.65],[11,.15]];
  for(let i=0;i<spots.length;i++)sim.spawnEnemyAt(i%3===0?'bookmark':'footnote',spots[i][0],spots[i][1],0);
  for(const e of sim.ents){e.maxHp=1e9;e.hp=1e9;e.speed=0;e.contactDps=0;e.orbitHitAt=-99;}
  if(left==='orbit_blades'){
    const st=sim.skillsRuntime.get('orbit_blades'),
      p=sim.orbitSystem.profile(st,{x:0,z:0}),
      speed=st.mutation==='orbit_saw'?2.55:3.4,
      a=((sim.tick+1)/sim.hz)*speed;
    sim.ents[0].x=Math.cos(a)*p.radius;
    sim.ents[0].z=Math.sin(a)*p.radius;
  }
  sim.events.length=0;
  return sim;
}
function physicalTick(sim:any){
  sim.tick++;
  sim.updateProjectiles();sim.flushPhysicalEvents();
  sim.updateDelayedStrikes();sim.flushPhysicalEvents();
  sim.updateFields();sim.flushPhysicalEvents();
  sim.updateConstructs();sim.flushPhysicalEvents();
  sim.updateOrbitBlades();sim.flushPhysicalEvents();
}
function until(sim:any,pred:()=>boolean,maxTicks=480){
  if(pred())return true;
  for(let i=0;i<maxTicks;i++){physicalTick(sim);if(pred())return true;}
  return false;
}
function runPair(left:SkillId,right:SkillId,cat:CatalystId){
  const sim=fixture(left,right,cat);
  sim.activateSlot(0);
  const ok=until(sim,()=>sim.events.some((e:any)=>e.type==='CatalystChoreography'&&e.mode===cat),480);
  const cues=sim.events.filter((e:any)=>e.type==='CatalystChoreography'&&e.mode===cat);
  const casts=sim.events.filter((e:any)=>e.type==='SkillActivated'&&e.skill===right);
  assert(ok&&cues.length>0,cat+' '+left+'->'+right+': physical lifecycle produced no choreography');
  assert(casts.length>0,cat+' '+left+'->'+right+': right Phenomenon never physically activated');
  return {sim,cues,casts};
}

const matrix:any={};
let expectedPairs=0;
for(const cat of catalystOrder){
  let n=0,total=0;
  for(const a of activeSkillOrder)for(const b of activeSkillOrder)if(a!==b){
    total++;
    if(catalystPairCompatible(cat,a,b)){n++;expectedPairs++;}
  }
  matrix[cat]={compatible:n,total,ratio:+(n/total).toFixed(3)};
  assert(n>0&&n<total,cat+': compatibility became empty or fake-universal');
}

const pairAudit:string[]=[];
const successfulSignals=new Set<string>();
for(const cat of catalystOrder){
  for(const left of activeSkillOrder)for(const right of activeSkillOrder){
    if(left===right||!catalystPairCompatible(cat,left,right))continue;
    const result=runPair(left,right,cat),sim=result.sim,cues=result.cues,casts=result.casts,c=cues[0];

    if(cat==='source'){
      assert(casts.some((q:any)=>Math.hypot(q.x,q.z)>.5),cat+' '+left+'->'+right+': B stayed on hero instead of physical terminal');
    } else if(cat==='carrier'){
      assert(c.points.length>0,cat+' '+left+'->'+right+': cue has no contact origin');
      assert(casts.some((q:any)=>cues.some((ev:any)=>ev.points.some((p:any)=>dist(q,p)<1.0))),
        cat+' '+left+'->'+right+': B is not cast from actual carrier contact');
    } else if(cat==='trail'){
      assert(c.points.length>=2,cat+' '+left+'->'+right+': no real path accumulated');
      assert(casts.some((q:any)=>c.points.some((p:any)=>dist(q,p)<1.5)),
        cat+' '+left+'->'+right+': Trail B does not lie on A path');
    } else if(cat==='reverse'){
      const first=c.points[0],second=c.points[1]??c.points[0],cast=casts[0];
      assert(first&&dist(first,cast)<1.1,cat+' '+left+'->'+right+': B did not begin at real reversed endpoint');
      const dx=second.x-cast.x,dz=second.z-cast.z,m=Math.hypot(dx,dz)||1;
      assert(cast.aimX*dx/m+cast.aimZ*dz/m>.35,cat+' '+left+'->'+right+': B does not face back along real route');
    } else if(cat==='collapse'){
      const center={x:c.centerX,z:c.centerZ};
      if(skills[right].directional){
        assert(casts.some((q:any)=>{
          const dx=center.x-q.x,dz=center.z-q.z,m=Math.hypot(dx,dz)||1;
          return q.aimX*dx/m+q.aimZ*dz/m>.45;
        }),cat+' '+left+'->'+right+': no inward-directed B from exact A area');
      } else {
        assert(casts.some((q:any)=>dist(q,center)<1.2),cat+' '+left+'->'+right+': radial B is not centered on a real A area');
      }
    }

    for(const list of [sim.projectiles,sim.constructs,sim.fields,sim.ents])
      for(const q of list)
        assert(Number.isFinite(q.x)&&Number.isFinite(q.z),cat+' '+left+'->'+right+': invalid world coordinates');

    const signal=cat==='source'||cat==='reverse'?'terminal':cat==='carrier'?'carrier':cat==='trail'?'path':'area';
    successfulSignals.add(left+':'+signal);
    pairAudit.push(cat+':'+left+'->'+right);
  }
}
assert(pairAudit.length===expectedPairs,'pair audit '+pairAudit.length+' != compatibility matrix '+expectedPairs);

const signalAudit:any[]=[];
for(const id of activeSkillOrder){
  const profile=phenomenonChoreography[id];
  for(const signal of profile.emits)
    assert(successfulSignals.has(id+':'+signal),id+': declares '+signal+' but no live Catalyst consumed it');
  signalAudit.push({id,emits:profile.emits});
}

assert(!phenomenonChoreography.mortar_bloom.emits.includes('path'),'Mortar reintroduced a non-simulated flight path');
assert(phenomenonChoreography.mortar_bloom.emits.includes('carrier'),'Mortar impacts are no longer exposed as carriers');

{
  const sim=fixture('rail_spear','sentry','trail');
  const st=sim.skillsRuntime.get('sentry');
  st.mutationApotheosis='sentry_gravity_grid';
  sim.activateSlot(0);
  assert(until(sim,()=>sim.constructs.filter((q:any)=>q.skill==='sentry').length>=3,120),'Trail Grid never deployed');
  const turrets=sim.constructs.filter((q:any)=>q.skill==='sentry');
  const sorted=[...turrets].sort((a:any,b:any)=>a.x-b.x||a.z-b.z);
  let connected=0;
  for(let i=1;i<sorted.length;i++)if(dist(sorted[i-1],sorted[i])<=6.4)connected++;
  assert(connected>=Math.min(2,sorted.length-1),'Trail Grid towers cannot form physical links: '+connected+'/'+(sorted.length-1));
  sim.events.length=0;
  for(let i=0;i<24;i++)physicalTick(sim);
  assert(sim.events.some((e:any)=>e.type==='CombatShape'&&e.source==='sentry_gravity_grid'),
    'Trail Grid towers exist but never create real connecting control geometry');
}

{
  const sim=fixture('rail_spear','toxic_mist','source');
  sim.obstacles=[{id:9001,x:5,z:0,radius:2,hp:-1,maxHp:-1,destructible:false}];
  sim.buildObstacleGrid();
  const safe=sim.safeChoreographyPoint(5,0,.28);
  assert(Math.hypot(safe.x-5,safe.z)>=2.27,'choreography origin remained inside cover');
  const edge=sim.safeChoreographyPoint(999,-999,.28);
  assert(edge.x<=sim.world.maxX-.27&&edge.x>=sim.world.minX+.27&&edge.z<=sim.world.maxZ-.27&&edge.z>=sim.world.minZ+.27,
    'choreography origin escaped arena');
}

{
  const sim=fixture('sentry','rail_spear','source');
  sim.catalysts=[null];sim.activateSlot(0);
  const turrets=sim.constructs.filter((q:any)=>q.skill==='sentry');
  assert(turrets.length>0,'base Sentry deployed nothing');
  assert(turrets.every((q:any)=>q.x>1.2),'base Sentry reverted to hero-local spawn');
}

const simulation=readFileSync('src/core/simulation.ts','utf8');
const activateStart=simulation.indexOf('  private activateSlot('),
  activateEnd=simulation.indexOf('  private isPhysicalCatalyst(',activateStart),
  activateBlock=simulation.slice(activateStart,activateEnd);
assert(!activateBlock.includes('executeChoreography('),'activateSlot resurrected old next-beat Catalyst execution');
assert(simulation.includes('registerAsyncPhysical')&&simulation.includes('finishAsyncPhysical'),
  'async physical lifecycle tracking disappeared');
assert(!simulation.includes('this.tracePoint(p.x, p.z, true)'),'scheduled telegraph became physical terminal again');
assert(simulation.includes('physicalTrace = true'),'render geometry and physical trace are no longer separable');

const renderer=readFileSync('src/renderer/webgl2.ts','utf8');
const bridge=readFileSync('src/presentation/bridge.ts','utf8');
assert(renderer.includes("e.type === 'choreography'"),'renderer ignores physical choreography cue');
for(const mode of ['source','carrier','trail','reverse','collapse'])
  assert(renderer.includes("e.mode === '"+mode+"'")||renderer.includes("e.mode === 'trail' || e.mode === 'reverse'"),
    'renderer has no distinct visual branch for '+mode);
assert(bridge.includes("e.type === 'CatalystChoreography'"),'presentation bridge drops choreography event');

console.log('catalyst-choreography-regression OK',JSON.stringify({
  signalAudit,matrix,pairAuditCount:pairAudit.length
},null,2));
