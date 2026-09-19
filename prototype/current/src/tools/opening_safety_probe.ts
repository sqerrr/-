import { Simulation } from '../core/simulation.js';
import { activeSkillOrder } from '../content/definitions.js';
import { pickOffer } from './driver.js';
import type { Snapshot } from '../core/types.js';

function steerOpening(s:Snapshot){
  const owned=s.chain.slots.filter(Boolean).length+s.chain.skillReserve.filter(Boolean).length,
    cats=s.chain.catalysts.filter(Boolean).length+s.chain.catalystReserve.filter(Boolean).length,
    open=s.world.pois.filter(p=>p.state!=='cleared'),
    wanted=owned<2?'phenomenon':cats<1?'catalyst':null;
  let candidates=wanted?open.filter(p=>p.kind===wanted):open;
  if(!candidates.length)candidates=open;
  const p=candidates.sort((a,b)=>Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(b.x-s.player.x,b.z-s.player.z))[0];
  let moveX=0,moveZ=0;if(p){const dx=p.x-s.player.x,dz=p.z-s.player.z,m=Math.hypot(dx,dz)||1;moveX=dx/m;moveZ=dz/m;}
  const e=[...s.entities].sort((a,b)=>Number(b.elite)-Number(a.elite)||Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(b.x-s.player.x,b.z-s.player.z))[0];
  let aimX=1,aimZ=0,danger=false;
  if(e){
    const dx=e.x-s.player.x,dz=e.z-s.player.z,m=Math.hypot(dx,dz)||1;aimX=dx/m;aimZ=dz/m;
    danger=!!e.elite && (!!e.eliteAction || e.echoPhase==='tell' || e.echoPhase==='active' || e.telegraph>0);
    if(danger){
      const directional=['hunter','bulwark','harvester'].includes(e.chassis??'');
      if(directional){const fx=e.facingX||aimX,fz=e.facingZ||aimZ;moveX=-fz;moveZ=fx;}
      else {moveX=-dx/m;moveZ=-dz/m;}
    }
  }
  return {moveX,moveZ,aimX,aimZ,dash:danger&&s.player.dashReady};
}

const rows:any[]=[];
for(const skill of activeSkillOrder){
  const sim:any=new Simulation({seed:7100+activeSkillOrder.indexOf(skill)*113,hz:60,runDuration:480,mode:'clean',startingSkill:skill});
  for(let i=0;i<100*60;i++){
    sim.step(steerOpening(sim.snapshot()));
    let guard=0;
    while(sim.hasChoice&&guard++<12){
      const s=sim.snapshot();
      if(s.mutationOffer)sim.chooseMutation(0);
      else if(s.rewardOffers)sim.chooseReward(pickOffer(s));
    }
    const s=sim.snapshot();
    if(s.player.hp<=0||s.finished)break;
  }
  const s=sim.snapshot();
  rows.push({
    skill,time:+s.time.toFixed(1),alive:s.player.hp>0,hp:Math.round(s.player.hp),
    phenomena:s.chain.slots.filter(Boolean).length+s.chain.skillReserve.filter(Boolean).length,
    catalysts:s.chain.catalysts.filter(Boolean).length+s.chain.catalystReserve.filter(Boolean).length,
    eliteKilled:s.metrics.eliteKilled,eliteSpawned:s.metrics.eliteSpawned,level:s.player.level
  });
}
console.log(JSON.stringify({openingSafety:rows},null,2));
const failed=rows.filter(r=>!r.alive||r.phenomena<2||r.eliteKilled<1);
if(failed.length) console.log('OPENING_SAFETY_WARN',JSON.stringify(failed));
