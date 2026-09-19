import { Simulation } from '../core/simulation.js';
import { items } from '../content/items.js';
import { pickOffer, steer } from './driver.js';

const hz=60, checkpoints=[120,240,360,470], seeds=[12345,24680,97531];

function playerDamageFactor(s:any){
  let itemDamage=1;
  for(const id of s.heldItems){
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
    const pre=sim.snapshot(), cmd=steer(pre,i,hz);
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
    eliteSpawned:end.metrics.eliteSpawned,eliteActions
  }},null,2));
}
