import { EliteProgressionSystem, type EliteProgressionPort } from '../core/eliteProgressionSystem.js';
import { makeEnt, type Ent } from '../core/state.js';
import type { ItemId, RefusedCard } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('elite-progression-regression: ' + message);
}

let now=30;
const legacy:ItemId[]=[];
const evolution:ItemId[]=[];
const refusals:RefusedCard[]=[
  {serial:1,kind:'axis',title:'Проводимость',icon:'',resonance:'conductivity',heldBy:0},
  {serial:2,kind:'axis',title:'Мобильность',icon:'',resonance:'mobility',heldBy:0},
  {serial:3,kind:'item',title:'Кромка',icon:'',item:'keen_edge',heldBy:0},
  {serial:4,kind:'skill',title:'Копьё',icon:'',skill:'rail_spear',heldBy:0},
  {serial:5,kind:'skill',title:'Дуга',icon:'',skill:'chain_arc',heldBy:0}
];
let mainCalls=0,relicCalls=0;
const port:EliteProgressionPort={
  time:()=>now,
  runDuration:()=>480,
  refusalStore:()=>refusals,
  legacyItems:()=>legacy,
  evolutionHistory:()=>evolution,
  mainRandomInt:(max)=>{mainCalls++;return max>1?0:0;},
  relicRandomInt:(max)=>{relicCalls++;return max>1?0:0;}
};
const system=new EliteProgressionSystem(port);

function elite(id:number,rarity:Ent['rarity']='common'){
  return makeEnt({
    id,kind:'elite',x:0,z:0,hp:100,maxHp:100,radius:.8,speed:1,contactDps:10,rarity
  });
}

// Capacity grows by run depth and rarity; the first minute stays deliberately simple.
{
  const common=elite(1,'common'),legendary=elite(2,'legendary');
  now=30;
  assert(system.repertoireCapacity(common)===1,'early common repertoire capacity changed');
  assert(system.repertoireCapacity(legendary)===1,'early legendary teaching cap changed');
  now=90;
  assert(system.repertoireCapacity(common)===3,'mid-run common repertoire capacity changed');
  now=300;
  assert(system.repertoireCapacity(legendary)>system.repertoireCapacity(common),
    'late rarity no longer increases repertoire capacity');
}

// Item rules remain enemy-side mechanical rules, not category aliases.
{
  const e=elite(3);
  system.applyItem(e,'keen_edge',true);
  assert(Math.abs((e.relicCastMul??0)-1.16)<1e-9,'keen_edge cast multiplier changed');
  assert(Math.abs(e.contactDps-10.8)<1e-9,'keen_edge contact pressure changed');
  assert(Math.abs((e.groundRelicCastMul??0)-1.16)<1e-9,'captured keen_edge ground legacy changed');

  const hp=e.hp,max=e.maxHp;
  system.applyItem(e,'plating',false);
  assert(Math.abs(e.maxHp-max*1.16)<1e-9&&Math.abs(e.hp-hp*1.16)<1e-9,
    'plating durability scaling changed');
}

// Repertoire claim consumes only the main RNG stream and applies learned item/axis rules once.
{
  const e=elite(4,'uplifted');
  now=180; mainCalls=0; relicCalls=0;
  system.claimRepertoire(e);
  assert(e.repertoire.length===Math.min(system.repertoireCapacity(e),refusals.length),
    'repertoire claim capacity changed');
  assert(mainCalls===refusals.length-1,'repertoire shuffle main-RNG cadence changed');
  assert(relicCalls===0,'repertoire claim leaked into relic RNG stream');
  assert(e.repertoire.some(serial=>refusals.find(c=>c.serial===serial)?.skill),
    'repertoire no longer prioritizes an executable refused Phenomenon');
  assert(e.repertoire.every(serial=>refusals.find(c=>c.serial===serial)?.heldBy===e.id),
    'first visible repertoire carrier ownership changed');
}

// Releasing a carrier clears every refusal ownership record held by that elite.
{
  const e=elite(5);
  e.repertoire=[1];
  refusals[0].heldBy=e.id;
  refusals[4].heldBy=e.id; // protects the historical all-heldBy release semantics.
  system.releaseRepertoire(e);
  assert(e.repertoire.length===0,'release did not clear repertoire');
  assert(refusals[0].heldBy===0&&refusals[4].heldBy===0,'release no longer frees every held refusal');
}

// Native evolution uses main RNG and records a separate evolution history.
{
  const e=elite(6,'uplifted');
  now=210; evolution.length=0; mainCalls=0; relicCalls=0;
  system.grantNativeGrowth(e);
  assert(e.evolutionItems?.length===3,'native growth budget changed at 210s uplifted');
  assert(evolution.length===3,'native evolution history stopped recording gains');
  assert(mainCalls>0&&relicCalls===0,'native growth uses the wrong RNG stream');
}

// Captured relic history and inherited legacy use the relic RNG stream.
{
  legacy.length=0;mainCalls=0;relicCalls=0;now=240;
  const carrier=elite(7);
  system.recordCapturedRelic(carrier,'bane');
  assert(legacy[0]==='bane'&&carrier.relicItems?.[0]==='bane','captured relic history changed');
  assert((carrier.relicCastMul??1)>1,'captured relic did not apply enemy-side effect');

  legacy.push('plating','light_step','reprisal');
  const child=elite(8,'common');
  system.inheritLegacy(child,false);
  assert((child.relicItems?.length??0)>0,'later elite inherited no captured legacy');
  assert(relicCalls>0&&mainCalls===0,'legacy inheritance uses the wrong RNG stream');
}

// Warden-style full inheritance keeps repeated visual history but applies each mechanical rule once.
{
  legacy.splice(0,legacy.length,'plating','plating','keen_edge');
  const warden=elite(9,'legendary');
  system.inheritLegacy(warden,true);
  assert(warden.relicItems?.length===3,'full legacy stopped preserving repeated captured history');
  assert(Math.abs(warden.maxHp-116)<1e-9,'duplicate legacy item compounded mechanically');
  assert(Math.abs((warden.relicCastMul??0)-1.16)<1e-9,'distinct full-legacy rule was not applied');
}

console.log('elite-progression-regression OK',{
  mainCalls,relicCalls,legacy:legacy.length,evolution:evolution.length
});
