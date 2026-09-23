import { PhysicalCatalystSystem, type PhysicalCatalystPort } from '../core/physicalCatalystSystem.js';
import { makeEnt, type CatalystBinding, type Ent, type PhysicalEvent } from '../core/state.js';
import type { GameEvent } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('physical-catalyst-system-regression: ' + message);
}

let now=10, reactions=0;
const entities:Ent[]=[];
const casts:{x:number;z:number;aimX?:number;aimZ?:number;skill:string}[]=[];
const events:GameEvent[]=[];

const port:PhysicalCatalystPort={
  time:()=>now,
  tick:()=>600,
  aimX:()=>1,
  aimZ:()=>0,
  entities:()=>entities,
  castPayload:(binding,x,z,aimX,aimZ)=>{
    casts.push({x,z,aimX,aimZ,skill:binding.toSkill});
    return true;
  },
  emit:(event)=>events.push(event),
  noteReaction:()=>{reactions++;}
};
const system=new PhysicalCatalystSystem(port);

function binding(mode:CatalystBinding['mode'], toSkill:CatalystBinding['toSkill']='frost_ring'):CatalystBinding{
  return {
    producerActivationId:77,fromSlot:0,toSlot:1,fromSkill:'rail_spear',toSkill,mode,
    origin:{x:0,z:0},path:[],areaPoints:[],nextTrailDistance:1,
    firedCount:0,carrierKeys:new Set<string>(),pathCarrierKey:null,done:false
  };
}
function event(kind:PhysicalEvent['kind'], patch:Partial<PhysicalEvent>={}):PhysicalEvent{
  return {activationId:77,slot:0,skill:'rail_spear',kind,x:4,z:0,...patch};
}
const reset=()=>{casts.length=0;events.length=0;reactions=0;entities.length=0;};

// Source fires once at a real terminal.
{
  reset(); const b=binding('source');
  system.handle(b,event('terminal',{x:5,z:1}));
  assert(b.done&&b.firedCount===1&&casts.length===1&&casts[0].x===5&&casts[0].z===1,
    'Source no longer fires once at terminal');
  assert(events.some(e=>e.type==='CatalystChoreography'&&e.mode==='source')&&reactions===1,
    'Source choreography event/reaction changed');
}

// Carrier deduplicates one physical carrier identity.
{
  reset(); const b=binding('carrier');
  const hit=event('contact',{carrierKind:'projectile',carrierId:9,x:3,z:2});
  system.handle(b,hit);system.handle(b,hit);
  assert(casts.length===1&&b.firedCount===1,'Carrier stopped deduplicating physical carrier identity');
}

// Trail consumes accumulated physical path and finishes on terminal.
{
  reset(); const b=binding('trail','sentry');
  system.handle(b,event('path',{previousX:0,previousZ:0,x:3,z:0,carrierKind:'projectile',carrierId:1}));
  system.handle(b,event('path',{previousX:3,previousZ:0,x:6,z:0,carrierKind:'projectile',carrierId:1}));
  system.handle(b,event('terminal',{x:7,z:0,carrierKind:'projectile',carrierId:1}));
  assert(b.done&&b.path.length>=3&&casts.length>=1,'Trail stopped consuming real path');
  assert(events.some(e=>e.type==='CatalystChoreography'&&e.mode==='trail'),
    'Trail choreography event missing');
}

// Reverse refuses a bare endpoint, then aims backward along a real traversed route.
{
  reset();
  const bare=binding('reverse');
  system.handle(bare,event('terminal',{x:5,z:0}));
  assert(bare.done&&Number(casts.length)===0,'Reverse fabricated a route from bare terminal');

  const b=binding('reverse');
  system.handle(b,event('path',{previousX:0,previousZ:0,x:3,z:0,carrierKind:'projectile',carrierId:2}));
  system.handle(b,event('terminal',{x:5,z:0,carrierKind:'projectile',carrierId:2}));
  assert(Number(casts.length)===1&&Number(casts[0].x)===5&&Number(casts[0].aimX)<0,
    'Reverse no longer starts at endpoint facing back along route');
}

// Collapse pulls bodies through the same area shape and casts radial payload at its center.
{
  reset(); const b=binding('collapse','frost_ring');
  const target=makeEnt({id:1,kind:'footnote',x:1.5,z:0,hp:100,radius:.4,speed:0,contactDps:0});
  entities.push(target);
  const before=target.x;
  system.handle(b,event('area',{x:0,z:0,radius:2,shape:{kind:'circle',x:0,z:0,radius:2}}));
  assert(target.x<before&&target.displacedUntil>now,'Collapse stopped pulling bodies in shared area');
  assert(Number(casts.length)===1&&Number(casts[0].x)===0&&Number(casts[0].z)===0,'radial Collapse payload moved off center');
  assert(events.some(e=>e.type==='CatalystChoreography'&&e.mode==='collapse'),
    'Collapse choreography event missing');
}

console.log('physical-catalyst-system-regression OK',{
  modes:['source','carrier','trail','reverse','collapse'],reactions
});
