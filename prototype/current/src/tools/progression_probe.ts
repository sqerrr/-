import { Simulation } from '../core/simulation.js';
import { items } from '../content/items.js';
import { pickOffer } from './driver.js';
import type { ItemId, Snapshot } from '../core/types.js';

const hz=60, checkpoints=[120,240,360,470], seeds=[12345,24680,97531];

function routeAwareSteer(s:Snapshot, tick:number, hz:number){
  const ownedPhenomena=s.chain.slots.filter(Boolean).length+s.chain.skillReserve.filter(Boolean).length,
    ownedCatalysts=s.chain.catalysts.filter(Boolean).length+s.chain.catalystReserve.filter(Boolean).length,
    open=s.world.pois.filter(p=>p.state!=='cleared');
  const wanted = ownedPhenomena < 2 ? 'phenomenon' : ownedCatalysts < 1 ? 'catalyst' : null;
  let candidates = wanted ? open.filter(p=>p.kind===wanted) : open;
  if(!candidates.length) candidates=open;
  let target=candidates.sort((a,b)=>Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(b.x-s.player.x,b.z-s.player.z))[0];
  // Nearby contested/non-contested items are worth a short detour once the build has its first connector.
  const nearRelic=[...s.relics].sort((a,b)=>Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(b.x-s.player.x,b.z-s.player.z))[0];
  let moveX=0,moveZ=0;
  if(nearRelic && ownedPhenomena>=2 && Math.hypot(nearRelic.x-s.player.x,nearRelic.z-s.player.z)<7){
    const dx=nearRelic.x-s.player.x,dz=nearRelic.z-s.player.z,m=Math.hypot(dx,dz)||1;moveX=dx/m;moveZ=dz/m;
  } else if(target){
    const dx=target.x-s.player.x,dz=target.z-s.player.z,m=Math.hypot(dx,dz)||1;moveX=dx/m;moveZ=dz/m;
  } else {
    const a=tick/(hz*4.3),sx=Math.cos(a)*.65,sy=Math.sin(a*.73)*.58;moveX=(sx+sy)*.7071;moveZ=(-sx+sy)*.7071;
  }
  const threats=[...s.entities].sort((a,b)=>Number(b.elite)-Number(a.elite)||Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(b.x-s.player.x,b.z-s.player.z));
  const e=threats[0];let aimX=1,aimZ=0,danger=false;
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


function playerDamageFactor(s:any){
  let itemDamage=1;
  for(const id of s.heldItems as ItemId[]){
    const e=items[id].effect;
    if(e.kind==='damageMul') itemDamage*=e.amount;
  }
  return (1+Math.max(0,s.player.level-1)*0.075)*(1+s.player.power)*(1+s.doctrines.might*0.11)*itemDamage;
}

for(const seed of seeds){
  const sim:any=new Simulation({seed,hz,runDuration:480,mode:'clean'});
  const rows:any[]=[];
  let next=0,eliteActions=0;
  for(let i=0;i<480*hz;i++){
    const pre=sim.snapshot(), cmd=routeAwareSteer(pre,i,hz);
    sim.step(cmd);
    for(const ev of sim.events) if(ev.type==='EliteOrder' && ['predator','veil','replicate','prism','null','metamorph'].includes(ev.order)) eliteActions++;
    let guard=0;
    while(sim.hasChoice && guard++<12){
      const s=sim.snapshot();
      if(s.mutationOffer) sim.chooseMutation(0);
      else if(s.rewardOffers) sim.chooseReward(pickOffer(s));
    }
    const s=sim.snapshot();
    while(next<checkpoints.length && s.time>=checkpoints[next]){
      rows.push({
        time:Math.round(s.time),
        hp:Math.round(s.player.hp),
        level:s.player.level,
        damageFactor:+playerDamageFactor(s).toFixed(2),
        phenomena:s.chain.slots.filter(Boolean).length+s.chain.skillReserve.filter(Boolean).length,
        catalysts:s.chain.catalysts.filter(Boolean).length+s.chain.catalystReserve.filter(Boolean).length,
        doctrineRanks:Object.values(s.doctrines).reduce((a:number,b:any)=>a+Number(b),0),
        mutations:s.metrics.mutations,
        items:s.heldItems.length,
        eliteKilled:s.metrics.eliteKilled,
        eliteSpawned:s.metrics.eliteSpawned,
        eliteActions,
        eliteRelicsTaken:s.metrics.relicsTakenByElites,
        enemyItemHistory:sim.eliteLegacyItems.length,
        maxLivingEliteItems:Math.max(0,...sim.ents.filter((e:any)=>e.kind==='elite'&&e.hp>0).map((e:any)=>(e.relicItems??[]).length)),
        maxLivingEliteRepertoire:Math.max(0,...sim.ents.filter((e:any)=>e.kind==='elite'&&e.hp>0).map((e:any)=>e.repertoire.length)),
        worldHp:+sim.worldScale().toFixed(2),
        worldDamage:+sim.damageScale().toFixed(2),
        spawnPressure:+sim.spawnPressure().toFixed(2)
      });
      next++;
    }
    if(s.player.hp<=0||s.finished) break;
  }
  const end=sim.snapshot();
  console.log(JSON.stringify({seed,finished:end.finished,alive:end.player.hp>0,time:+end.time.toFixed(1),rows,final:{
    level:end.player.level,hp:Math.round(end.player.hp),damageFactor:+playerDamageFactor(end).toFixed(2),
    phenomena:end.chain.slots.filter(Boolean).length+end.chain.skillReserve.filter(Boolean).length,
    catalysts:end.chain.catalysts.filter(Boolean).length+end.chain.catalystReserve.filter(Boolean).length,
    mutations:end.metrics.mutations,items:end.heldItems.length,eliteKilled:end.metrics.eliteKilled,
    eliteSpawned:end.metrics.eliteSpawned,eliteActions,
    eliteRelicsTaken:end.metrics.relicsTakenByElites,
    enemyItemHistory:sim.eliteLegacyItems.length,
    maxLivingEliteItems:Math.max(0,...sim.ents.filter((e:any)=>e.kind==='elite'&&e.hp>0).map((e:any)=>(e.relicItems??[]).length)),
    maxLivingEliteRepertoire:Math.max(0,...sim.ents.filter((e:any)=>e.kind==='elite'&&e.hp>0).map((e:any)=>e.repertoire.length))
  }},null,2));
}
