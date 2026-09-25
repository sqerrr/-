import { readFileSync } from 'node:fs';
import { Simulation } from '../core/simulation.js';
import { SimulationHarness } from '../testing/simulationHarness.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('animation-contract-regression: ' + message);
}

// Orbit: the number the renderer receives must be the number gameplay actually uses.
const orbit:any = new Simulation({seed:88001,hz:60,benchmark:true,mode:'clean'});
orbit.configureBenchmarkLoadout({slots:['orbit_blades'],catalysts:[]});
const ost=orbit.skillsRuntime.get('orbit_blades');
ost.count=1; orbit.resonance.multiplicity=0; orbit.doctrines.quantity=0;
const baseProfile=orbit.orbitSystem.profile(ost,orbit.orbitCenter()), baseSnap=orbit.snapshot().orbit;
assert(baseSnap.active && baseSnap.count===baseProfile.count && baseSnap.radius===baseProfile.radius,'orbit snapshot drifted from gameplay profile');
orbit.resonance.multiplicity=2; orbit.doctrines.quantity=6; ost.count=2;
const grown=orbit.orbitSystem.profile(ost,orbit.orbitCenter()), grownSnap=orbit.snapshot().orbit;
assert(grown.count>baseProfile.count,'orbit count modifiers do not change gameplay count');
assert(grown.hitInterval<baseProfile.hitInterval,'more orbit blades do not increase real contact cadence');
assert(grownSnap.count===grown.count && grownSnap.radius===grown.radius,'renderer orbit state is not simulation-authored');
ost.mutation='orbit_many';
assert(orbit.snapshot().orbit.count>grownSnap.count,'Много ножей does not add visible/real blades');

// Sentry: Quantity and transient count operators must create real constructs, whose branch state survives snapshotting.
const sentryHarness=SimulationHarness.create({seed:88002,hz:60,benchmark:true,mode:'clean'});
const sentry:any = sentryHarness.sim;
sentry.configureBenchmarkLoadout({slots:['sentry'],catalysts:[]});
const sst=sentry.skillsRuntime.get('sentry');
sst.mutation='sentry_gatling'; sst.mutationUpgrade='sentry_crawler'; sst.mutationApotheosis='sentry_walker';
sentry.resonance.multiplicity=2; sentry.doctrines.quantity=4; sentry.activationCountBonus=2;
sentryHarness.castSkill('sentry',sst,0,sentryHarness.heroSource());
const sentrySnap=sentry.snapshot();
assert(sentrySnap.constructs.length===5,`expected capped five sentries, got ${sentrySnap.constructs.length}`);
assert(sentrySnap.constructs.every((x:any)=>x.mutationApotheosis==='sentry_walker'&&x.faction==='hero'),'construct branch/ownership lost before renderer');

// Chain Arc: the same count language must affect actual chain length, not only UI text.
const arcHarness=SimulationHarness.create({seed:88003,hz:60,benchmark:true,mode:'clean'});
const arc:any = arcHarness.sim;
arc.configureBenchmarkLoadout({slots:['chain_arc'],catalysts:[]});
arc.ents=[];
for(let i=0;i<11;i++) arc.spawnEnemyAt('footnote',2+i*0.9,(i%2)*0.4,0);
arc.doctrines.quantity=6; arc.resonance.multiplicity=0; arc.activationCountBonus=2;
arc.events=[];
arcHarness.castSkill('chain_arc',arc.skillsRuntime.get('chain_arc'),0,arcHarness.heroSource());
const arcSegments=arc.events.filter((e:any)=>e.type==='CombatShape'&&e.source==='chain_arc').length;
assert(arcSegments>=8,`Quantity/operator bonuses did not become real arc segments: ${arcSegments}`);

// Persistent effects and projectiles must retain identity/ownership instead of flattening in Snapshot.
const fx:any = new Simulation({seed:88004,hz:60,benchmark:true,mode:'clean'});
fx.fields=[{id:900,x:1,z:2,radius:3,ttl:2,kind:'toxic',dps:1,tickAcc:0,faction:'rival',ownerId:0,source:'toxic_mist',sourceSlot:-1,mutation:'toxic_plume',rivalConcentration:1,behavior:'host'}];
fx.spawnProjectile({x:0,z:0,vx:1,vz:0,radius:.2,ttl:2,damage:1,coverDamage:1,faction:'hero',ownerId:0,source:'shard_fan',sourceSlot:0,mutation:'fan_wide',apotheosis:'returner_phoenix',rivalConcentration:1,behavior:'returner',phase:0,hitIds:[],carousel:true});
const fs=fx.snapshot();
assert(fs.fields[0].faction==='rival'&&fs.fields[0].source==='toxic_mist'&&fs.fields[0].behavior==='host','field ownership/behavior lost in snapshot');
assert(fs.projectiles[0].apotheosis==='returner_phoenix'&&fs.projectiles[0].carousel===true,'projectile evolution state lost in snapshot');

// One combined elite state is enough to prove the data path keeps chassis + affix + Echo independent.
const elite:any = new Simulation({seed:88005,hz:60,benchmark:true,mode:'clean'});
elite.spawnElite();
const ee=elite.ents.find((x:any)=>x.kind==='elite');
assert(ee,'no elite fixture');
ee.chassis='broodmaker'; ee.affix='regenerating'; ee.regenerating=true; ee.hp=ee.maxHp=1e9;
elite.startEliteEcho(ee,{serial:1,kind:'skill',title:'Рельсовое копьё',icon:'',skill:'rail_spear',heldBy:ee.id});
const es=elite.snapshot().entities.find((x:any)=>x.id===ee.id);
assert(es?.chassis==='broodmaker'&&es?.affix==='regenerating'&&es?.regenerating&&es?.echoPhase==='tell','combined elite visual state collapsed in snapshot');

const renderer=readFileSync('src/renderer/webgl2.ts','utf8');
const castStart=renderer.indexOf("if (e.type === 'skillCast')");
const castEnd=renderer.indexOf("else if (e.type === 'catalyst')",castStart);
const castBlock=renderer.slice(castStart,castEnd);
assert(castStart>=0&&castEnd>castStart,'skillCast presentation block missing');
for(const stale of ['st?.count','resonance.multiplicity','baseRadius * Math.sqrt','orbit.level >='])
  assert(!castBlock.includes(stale),`renderer still re-simulates gameplay geometry via ${stale}`);
assert(renderer.includes('s.orbit.active')&&renderer.includes('s.orbit.count'),'renderer ignores canonical orbit count');
assert(renderer.includes("f.faction === 'rival'"),'hostile persistent fields are not visually separated');
assert(renderer.includes("c.mutationApotheosis==='sentry_walker'"),'construct mutations are flattened in renderer');
for(const affix of ['volatile','regenerating','shielded','vanguard','temporal','brood','crowned','swift','dense'])
  assert(renderer.includes(`e.affix === '${affix}'`) || renderer.includes(`aff==='${affix}'`),`renderer has no visual branch for elite affix ${affix}`);

// Hero animation frames must share one visual family and use silhouette-trimmed UVs,
// otherwise idle/run/cast visibly jump in apparent size despite identical world-space size.
assert(renderer.includes("{ key: 'player_idle', url: '/assets/v07_player.png' }"),'hero idle art regressed to the undersized legacy sprite');
for(const i of [0,1,2,3])
  assert(renderer.includes(`player_cast_${i}`),`hero cast frame ${i} is not loaded/used`);
assert(renderer.includes('const alphaBox = (img: HTMLImageElement)'), 'actor UVs no longer trim transparent margins');
assert(renderer.includes('dashing || invulnerable') && renderer.includes("'player_cast_' + frame"), 'dash no longer uses authored cast/body animation');

const html=readFileSync('public/index.html','utf8'), platform=readFileSync('src/platform/main.ts','utf8');
assert(!html.includes('legacy-hidden')&&!html.includes('id="eventLog"'),'retired legacy HUD DOM returned');
assert(!platform.includes("\$('eventLog')")&&!platform.includes("\$('perf')")&&!platform.includes("\$('gpuName')"),'platform still updates retired hidden HUD nodes');

console.log('animation-contract-regression OK',{
  orbit:{base:baseProfile.count,grown:grown.count,many:orbit.snapshot().orbit.count},
  sentries:sentrySnap.constructs.length,
  arcSegments,
  hostileField:fs.fields[0].faction,
  combinedElite:`${es.chassis}+${es.affix}+${es.echoPhase}`
});
