declare const process: { exit(code?: number): never };
import { readFileSync } from 'node:fs';
import { Simulation } from '../core/simulation.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('ui-information-architecture-regression: ' + message);
}

const ui=readFileSync('src/platform/main.ts','utf8');
const html=readFileSync('public/index.html','utf8');
const simulation=readFileSync('src/core/simulation.ts','utf8');
const eliteAffix=readFileSync('src/core/eliteAffixSystem.ts','utf8');

assert(ui.includes("itemRivalEffect"), 'elite inspection does not expose concrete captured-item effects');
assert(ui.includes("plannerElites"), 'Tab/planner has no elite inspection layer');
assert(ui.includes("drawEliteGrowthRow"), 'combat HUD has no separate elite growth channel');
assert(ui.includes("ЭВО ${romanTier(evolution)}"), 'combat evolution is not aggregated into one tier');
assert(!ui.includes('ПОДГОТОВКА — красная геометрия показывает опасную область до удара.'),
  'Echo returned to a sentence-sized live-combat toast');
assert(!ui.includes('Она стала опаснее.'), 'elite relic event regressed to a vague message');
assert(html.includes('id="plannerElites"'), 'elite inspection container missing');
assert(html.includes('id="overCause"') && html.includes('id="overHint"'), 'death recap containers missing');
assert(html.includes('.card p{font-size:14px'), 'choice description typography is still too small');
assert(!html.includes('до 4 феноменов. Катализатор физически меняет постановку двух соседних феноменов.'),
  'combat chain HUD still carries the permanent tutorial sentence');

const sim:any=new Simulation({seed:91321,hz:60,runDuration:480,mode:'clean'});
sim.spawnElite();
const elite=sim.ents.find((e:any)=>e.kind==='elite');
assert(elite,'elite subject missing');
elite.repertoire=[];
elite.relicItems=['siphon'];
elite.evolutionItems=['plating','quickened'];
let snap=sim.snapshot();
let se=snap.entities.find((e:any)=>e.id===elite.id)!;
assert(se.refusalTitles.length===0, 'snapshot still mixes relic/evolution data into refusals');
assert(se.relicItems.length===1 && se.relicItems[0]==='siphon', 'captured relics missing from inspection contract');
assert(se.evolutionItems.length===2, 'passive evolution missing from inspection contract');

sim.php=50;
sim.barrier=6;
sim.events.length=0;
sim.hitPlayer(20,elite,'null_harvest');
const hit=sim.events.find((e:any)=>e.type==='PlayerHit') as any;
assert(hit && hit.source==='null_harvest', 'PlayerHit lost its attack source');
assert(hit.attackerId===elite.id && hit.attackerChassis===elite.chassis, 'PlayerHit lost elite identity');
assert(hit.barrierDamage>0 && hit.hpDamage>0, 'PlayerHit does not split barrier and health damage');

assert(eliteAffix.includes("p.hitPlayer(14 * p.damageScale(), entity, 'temporal_shift')"),
  'temporal hit still lacks a named death-recap source');

console.log('ui-information-architecture-regression OK', {
  relic:se.relicItems[0],
  evolution:se.evolutionItems.length,
  fatalContext:{source:hit.source,hpDamage:hit.hpDamage,barrierDamage:hit.barrierDamage}
});
