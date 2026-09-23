import { LegacyCatalystSystem, type LegacyCatalystPort } from '../core/legacyCatalystSystem.js';
import { makeEnt, type ActivationContext, type Ent } from '../core/state.js';
import type { CatalystId, SkillId, SkillRuntime } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('legacy-catalyst-regression: ' + message);
}

let px=0,pz=0,reactions=0,barrier=0,healed=0;
const entities:Ent[]=[];
const derived:{skill:SkillId;slot:number;scale:number}[]=[];
const catalystEvents:CatalystId[]=[];
const reactionEvents:string[]=[];
const states:string[]=[];

const runtime:SkillRuntime={
  id:'cleaver',level:1,power:0,coverage:0,range:0,duration:0,crit:.03,
  eliteDamage:0,count:1,control:0,statusPotency:0,
  mutation:null,mutationUpgrade:null,mutationApotheosis:null
};
const runtimes=new Map<SkillId,SkillRuntime>([['cleaver',runtime]]);
const slots:(SkillId|null)[]=['cleaver','frost_ring','rail_spear',null];

const port:LegacyCatalystPort={
  time:()=>10,
  tick:()=>600,
  playerX:()=>px,
  playerZ:()=>pz,
  movePlayer:(dx,dz)=>{px+=dx;pz+=dz;},
  getAliveEntity:(id)=>entities.find(e=>e.id===id&&e.hp>0),
  entities:()=>entities,
  skillAt:(slot)=>slots[slot] ?? null,
  skillRuntime:(id)=>runtimes.get(id),
  applyState:(_e,state)=>states.push(state),
  healPlayer:(amount)=>{healed+=amount;},
  grantBarrier:(amount)=>{barrier+=amount;},
  damageEcho:(e,amount)=>{e.hp-=amount;},
  castDerived:(skill,_runtime,slot,scale)=>derived.push({skill,slot,scale}),
  noteReaction:()=>{reactions++;},
  emitReaction:(reaction)=>reactionEvents.push(reaction),
  emitCatalystTriggered:(catalyst)=>catalystEvents.push(catalyst)
};
const system=new LegacyCatalystSystem(port);

const empty:ActivationContext={
  skill:null,damage:0,kills:0,overkill:0,control:0,state:'',hitIds:[],x:0,z:0,trace:null
};

// Pre-cast compatibility still owns abstract count/scale modifiers.
{
  const previous={...empty,hitIds:[1,2,3,4,5,6,7,8,9,10,11,12]};
  const capacitor=system.beforeCast({
    catalyst:'capacitor',slot:1,conductivity:0,previous,aimX:1,aimZ:0,
    activationScale:1,activationCountBonus:0
  });
  assert(capacitor.activationCountBonus===2,'capacitor count formula changed');

  px=0;pz=0;
  const recoil=system.beforeCast({
    catalyst:'recoil',slot:1,conductivity:0,previous:empty,aimX:1,aimZ:0,
    activationScale:1,activationCountBonus:0
  });
  assert(Math.abs(recoil.activationScale-1.55)<1e-9 && Math.abs(px+1.2)<1e-9,
    'recoil scale/movement changed');
}

// Backflow writes a one-shot feedback bonus that the previous slot consumes on its next activation.
{
  const a=makeEnt({id:1,kind:'footnote',x:1,z:0,hp:100,radius:.4,speed:0,contactDps:0});
  const b=makeEnt({id:2,kind:'footnote',x:2,z:0,hp:100,radius:.4,speed:0,contactDps:0});
  const c=makeEnt({id:3,kind:'footnote',x:3,z:0,hp:100,radius:.4,speed:0,contactDps:0});
  entities.splice(0,entities.length,a,b,c);
  system.afterCast({
    catalyst:'backflow',slot:2,skill:'cleaver',runtime,conductivity:0,previous:empty,
    currentHits:new Set([1,2,3]),currentKills:0
  });
  const feedback=system.beforeCast({
    catalyst:null,slot:1,conductivity:0,previous:empty,aimX:1,aimZ:0,
    activationScale:1,activationCountBonus:0
  });
  assert(feedback.activationCountBonus===1,'backflow feedback was not consumed by previous slot');
  const spent=system.beforeCast({
    catalyst:null,slot:1,conductivity:0,previous:empty,aimX:1,aimZ:0,
    activationScale:1,activationCountBonus:0
  });
  assert(spent.activationCountBonus===0,'backflow feedback stopped being one-shot');
}

// Conduit and Harvest preserve their side effects.
{
  states.length=0; reactions=0; healed=0;
  const previous={...empty,state:'ignite',kills:2,hitIds:[1]};
  system.afterCast({
    catalyst:'conduit',slot:1,skill:'cleaver',runtime,conductivity:0,previous,
    currentHits:new Set([1]),currentKills:0
  });
  assert(states[0]==='ignite' && reactionEvents.includes('conduit'),'conduit state handoff changed');

  system.afterCast({
    catalyst:'harvest',slot:1,skill:'cleaver',runtime,conductivity:0,previous:empty,
    currentHits:new Set(),currentKills:2
  });
  assert(healed===8,'harvest healing formula changed');
}

// Overflow remains a compatibility recast of the previous slot and publishes the legacy event.
{
  derived.length=0;catalystEvents.length=0;
  const previous={...empty,hitIds:[1,2,3,4,5,6,7,8]};
  system.afterContextPublished({
    catalyst:'overflow',slot:1,conductivity:0,previous,targetX:4,targetZ:5
  });
  assert(catalystEvents[0]==='overflow','legacy CatalystTriggered event disappeared');
  assert(derived.length===1 && derived[0].skill==='cleaver' && derived[0].slot===0 &&
    Math.abs(derived[0].scale-.78)<1e-9,'overflow recast changed');
}

console.log('legacy-catalyst-regression OK',{
  reactions,barrier,healed,derived:derived.length,catalystEvents
});
