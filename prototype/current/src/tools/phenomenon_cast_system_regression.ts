import { skills } from '../content/definitions.js';
import { PhenomenonCastSystem, type PhenomenonCastPort } from '../core/phenomenonCastSystem.js';
import { makeEnt, type CastSource, type DelayedStrike, type Ent, type Projectile } from '../core/state.js';
import type { CombatShape, MutationId, SkillId, SkillRuntime } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('phenomenon-cast-system-regression: ' + message);
}

let now=10, cycle=2, closeDamage=0, activationControl=0;
const entities:Ent[]=[];
const projectiles:Omit<Projectile,'id'|'guarded'>[]=[];
const strikes:Omit<DelayedStrike,'id'>[]=[];
const shapes:{source:string;shape:CombatShape;physicalTrace:boolean}[]=[];
const states:string[]=[];
const damageSources:string[]=[];

const source:CastSource={
  faction:'hero',owner:null,x:0,z:0,aimX:1,aimZ:0,vx:0,vz:0
};

function runtime(id:SkillId):SkillRuntime {
  return {
    id,level:1,power:0,coverage:0,range:0,duration:0,crit:.03,eliteDamage:0,count:1,
    control:0,statusPotency:0,mutation:null,mutationUpgrade:null,mutationApotheosis:null
  };
}
function enemy(id:number,x:number,z:number,kind:Ent['kind']='footnote'){
  const e=makeEnt({id,kind,x,z,hp:1000,radius:.45,speed:0,contactDps:0});
  entities.push(e);
  return e;
}

const port:PhenomenonCastPort={
  time:()=>now,
  cycle:()=>cycle,
  skillRadius:(_runtime,base)=>base,
  skillRange:(_runtime,base)=>base,
  powerBucket:()=>1,
  slotAmp:()=>1,
  memoryFactor:()=>1,
  mutationIs:(st,id:MutationId)=>st.mutation===id||st.mutationUpgrade===id||st.mutationApotheosis===id,
  projectileCount:(st)=>Math.max(1,Math.round(st.count)),
  combatShape:(src,shape,_intent='damage',physicalTrace=true)=>shapes.push({source:src,shape,physicalTrace}),
  targetsFor:()=>entities,
  bestTarget:(_src,predicate,compare)=>{
    let best:Ent|undefined;
    for(const e of entities){
      if(e.hp<=0||!predicate(e)) continue;
      if(!best||compare(e,best)<0) best=e;
    }
    return best;
  },
  targetVisible:()=>true,
  aimPoint:(src,range)=>({x:src.x+src.aimX*range,z:src.z+src.aimZ*range}),
  damage:(target,amount,src)=>{
    target.hp-=amount;
    damageSources.push(src);
  },
  spawnProjectile:(projectile)=>projectiles.push(projectile),
  scheduleStrike:(strike)=>strikes.push(strike),
  addCloseDamage:(amount)=>{closeDamage+=amount;},
  addActivationControl:(amount)=>{activationControl+=amount;},
  noteState:(state)=>states.push(state)
};
const system=new PhenomenonCastSystem(port);

// Breach retains its directional lane and displacement mutation.
{
  entities.length=0;states.length=0;damageSources.length=0;
  const target=enemy(1,2,0);
  const st=runtime('breach_line'); st.mutation='breach_stagger';
  assert(system.cast('breach_line',st,0,source),'breach_line not handled');
  assert(target.hp<1000 && damageSources[0]==='breach_line','breach damage changed');
  assert(target.displacedUntil>now && states.includes('displaced'),'breach stagger state changed');
}

// Contact Saw preserves close-damage telemetry and bleed payload.
{
  entities.length=0;states.length=0;closeDamage=0;
  const target=enemy(2,1,0);
  const st=runtime('contact_saw'); st.mutation='saw_bleed';
  system.cast('contact_saw',st,0,source);
  assert(target.hp<1000 && closeDamage>0,'Contact Saw close damage changed');
  assert(target.woundUntil>now && target.woundDps>0 && states.includes('wound'),'Contact Saw bleed changed');
}

// Shard Fan remains a moving projectile cast and keeps telegraph out of physical trace.
{
  entities.length=0;projectiles.length=0;shapes.length=0;
  const st=runtime('shard_fan'); st.count=3;
  system.cast('shard_fan',st,0,source);
  assert(projectiles.length===3,'Shard Fan projectile multiplicity changed');
  assert(projectiles.every(p=>p.behavior==='returner'&&p.source==='shard_fan'),'Shard Fan projectile contract changed');
  assert(shapes.filter(s=>s.source==='shard_fan').every(s=>!s.physicalTrace),
    'Shard Fan intended lane leaked into Catalyst physical path truth');
}

// Gravity Prison keeps elite control semantics and shield stability damage.
{
  entities.length=0;shapes.length=0;activationControl=0;
  const st=runtime('tether_drag'); st.mutationApotheosis='gravity_prison';
  const anchor=skills.tether_drag.baseRange;
  const target=enemy(3,anchor,0,'elite');
  target.affix='shielded'; target.shieldStability=100;
  system.cast('tether_drag',st,0,source);
  assert(activationControl>0,'Tether no longer records activation control');
  assert(target.exposedUntil>now && target.chillUntil>now,'Gravity Prison elite exposure changed');
  assert((target.shieldStability??100)<100,'Gravity Prison no longer pressures shield stability');
  assert(shapes.some(s=>s.source==='gravity_prison'),'Gravity Prison readable control shape missing');
}

// Pin Field keeps its status payload at the authored target point.
{
  entities.length=0;states.length=0;
  const st=runtime('pin_burst'); st.mutation='pin_field';
  const target=enemy(4,skills.pin_burst.baseRange,0);
  system.cast('pin_burst',st,0,source);
  assert(target.hp<1000 && target.toxinUntil>now && target.toxinDps>0,'Pin Field toxin payload changed');
  assert(states.includes('toxin')&&states.includes('displaced'),'Pin Burst state bookkeeping changed');
}

assert(!system.cast('cleaver',runtime('cleaver'),0,source),'cast system claimed a not-yet-migrated Phenomenon');

console.log('phenomenon-cast-system-regression OK',{
  handled:['breach_line','contact_saw','shard_fan','tether_drag','pin_burst'],
  projectiles:projectiles.length,
  strikes:strikes.length
});
