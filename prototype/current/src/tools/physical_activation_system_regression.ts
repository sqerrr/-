import { PhysicalActivationSystem, type PhysicalActivationPort } from '../core/physicalActivationSystem.js';
import type { CatalystBinding, ChoreographyTrace, PhysicalEvent } from '../core/state.js';
import type { CatalystId, SkillId } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('physical-activation-system-regression: ' + message);
}

let catalysts:(CatalystId|null)[]=['trail',null,null];
let skills:(SkillId|null)[]=['rail_spear','sentry',null,null];
const bindings:CatalystBinding[]=[];
const events:PhysicalEvent[]=[];
const port:PhysicalActivationPort={
  catalystAt:(slot)=>catalysts[slot]??null,
  skillAt:(slot)=>skills[slot]??null,
  addBinding:(binding)=>bindings.push(binding),
  queueEvent:(event)=>events.push(event)
};
const system=new PhysicalActivationSystem(port);

// Only a compatible live physical pair creates a causal binding.
{
  bindings.length=0;
  assert(system.armOutgoing(0,'rail_spear',77,{x:0,z:0}),'compatible Trail pair was not armed');
  assert(bindings.length===1&&bindings[0].mode==='trail'&&bindings[0].toSkill==='sentry',
    'armed binding contract changed');
  assert(Math.abs(bindings[0].nextTrailDistance-1.8)<1e-9,'Sentry Trail first spacing changed');

  catalysts=['carrier',null,null];
  skills=['frost_ring','sentry',null,null];
  assert(!system.armOutgoing(0,'frost_ring',78,{x:0,z:0}),
    'incompatible Carrier pair created a fake binding');
  assert(bindings.length===1,'incompatible pair mutated binding storage');
}

// Synchronous Rail publishes its real path and terminal.
{
  events.length=0;
  const trace:ChoreographyTrace={
    skill:'rail_spear',origin:{x:0,z:0},aimX:1,aimZ:0,terminal:{x:6,z:0},
    points:[{x:0,z:0},{x:6,z:0}],areaPoints:[],areas:[],contacts:[],
    paths:[[{x:0,z:0},{x:3,z:0},{x:6,z:0}]],carriers:[],scheduled:[]
  };
  system.publishImmediate('rail_spear',0,100,trace);
  assert(events.filter(e=>e.kind==='path').length===2,'Rail immediate path publication changed');
  assert(events.filter(e=>e.kind==='terminal').length===1,'Rail immediate terminal publication changed');
}

// Area Phenomenon publishes the exact authored shape plus representative boundary points.
{
  events.length=0;
  const trace:ChoreographyTrace={
    skill:'frost_ring',origin:{x:1,z:2},aimX:1,aimZ:0,terminal:null,
    points:[],areaPoints:[],areas:[{kind:'circle',x:1,z:2,radius:3}],contacts:[],
    paths:[],carriers:[],scheduled:[]
  };
  system.publishImmediate('frost_ring',0,101,trace);
  const area=events.find(e=>e.kind==='area');
  assert(area?.shape?.kind==='circle'&&area.radius===3&&area.areaPoints?.length===4,
    'area physical evidence diverged from authored shape');
}

// Async projectiles/impacts never fabricate an immediate path or terminal from cast-time trace.
{
  events.length=0;
  const trace:ChoreographyTrace={
    skill:'shard_fan',origin:{x:0,z:0},aimX:1,aimZ:0,terminal:{x:7,z:0},
    points:[{x:0,z:0},{x:7,z:0}],areaPoints:[],areas:[],contacts:[],
    paths:[[{x:0,z:0},{x:7,z:0}]],carriers:[],scheduled:[]
  };
  system.publishImmediate('shard_fan',0,102,trace);
  assert(events.length===0,'async Shard Fan fabricated physical evidence at cast time');
}

console.log('physical-activation-system-regression OK',{
  binding:true,railSignals:true,area:true,asyncNoFabrication:true
});
