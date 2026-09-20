import { Simulation } from '../core/simulation.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('crowd-build-elite-regression: ' + message);
}
const near=(a:number,b:number,eps=0.08)=>Math.abs(a-b)<=eps*Math.max(1,Math.abs(b));

// Quantity is a real power axis: parallel rail lanes keep full base power.
const rail:any=new Simulation({seed:91001,hz:60,benchmark:true,mode:'clean'});
rail.configureBenchmarkLoadout({slots:['rail_spear'],catalysts:[],level:1,globalPower:0,skillPower:0,skillCoverage:0,skillRange:0});
const rst=rail.skillsRuntime.get('rail_spear'); rst.crit=0; rst.count=1; rail.resonance.multiplicity=0;
const target:any={id:1,kind:'footnote',hp:1e9,maxHp:1e9,x:6,z:0,radius:.4,markUntil:0,embedded:0,exposedUntil:0};
const railAmounts:number[]=[];
rail.rayHits=()=>[{e:target,t:1}];
rail.damage=(_e:any,amount:number)=>{railAmounts.push(amount);return false;};
rail.doctrines.quantity=0; rail.castRail(rst,0,rail.heroSource());
const railBase=railAmounts.reduce((a,b)=>a+b,0), baseRays=railAmounts.length;
railAmounts.length=0; rail.doctrines.quantity=4; rail.castRail(rst,0,rail.heroSource());
const railWide=railAmounts.reduce((a,b)=>a+b,0), wideRays=railAmounts.length;
assert(baseRays===1&&wideRays===3,`rail quantity rays ${baseRays}->${wideRays}`);
assert(railWide>=railBase*2.9,`rail count still carries hidden damage tax: ${railBase}->${railWide}`);

// Mortar count creates full-strength nearby impacts rather than normalized copies.
const mortar:any=new Simulation({seed:91002,hz:60,benchmark:true,mode:'clean'});
mortar.configureBenchmarkLoadout({slots:['mortar_bloom'],catalysts:[],level:1,globalPower:0,skillPower:0,skillCoverage:0,skillRange:0});
const mst=mortar.skillsRuntime.get('mortar_bloom'); mst.count=1; mortar.resonance.multiplicity=0;
const strikes:any[]=[]; mortar.scheduleStrike=(q:any)=>strikes.push(q);
mortar.doctrines.quantity=0; mortar.castMortar(mst,0,mortar.heroSource());
const mortarBase=strikes.reduce((a,q)=>a+q.damage,0), baseMortars=strikes.length;
strikes.length=0; mortar.doctrines.quantity=4; mortar.castMortar(mst,0,mortar.heroSource());
const mortarWide=strikes.reduce((a,q)=>a+q.damage,0), wideMortars=strikes.length;
assert(baseMortars===1&&wideMortars===3,`mortar quantity impacts ${baseMortars}->${wideMortars}`);
assert(mortarWide>=mortarBase*2.9,`mortar count still carries hidden damage tax: ${mortarBase}->${mortarWide}`);

// Orbit density scales approximately linearly with blade population.
const orbit:any=new Simulation({seed:91003,hz:60,benchmark:true,mode:'clean'});
orbit.configureBenchmarkLoadout({slots:['orbit_blades'],catalysts:[],level:1,globalPower:0,skillPower:0,skillCoverage:0});
const ost=orbit.skillsRuntime.get('orbit_blades'); ost.count=1; orbit.resonance.multiplicity=0;
orbit.doctrines.quantity=0; const ob=orbit.orbitProfile(ost);
orbit.doctrines.quantity=6; const og=orbit.orbitProfile(ost);
assert(ob.count===3&&og.count===6,`orbit blade count ${ob.count}->${og.count}`);
assert(near(og.hitInterval,ob.hitInterval/2,0.12),`orbit contact cadence is not near-linear: ${ob.hitInterval}->${og.hitInterval}`);

// Sentry is a chain-cycle deployment, not a permanent bunker, and inherits the build's power.
const sentry:any=new Simulation({seed:91004,hz:60,benchmark:true,mode:'clean'});
sentry.configureBenchmarkLoadout({slots:['sentry'],catalysts:[],level:1,globalPower:1,skillPower:0,skillDuration:0});
const sst=sentry.skillsRuntime.get('sentry');
sentry.castSentry(sst,0,sentry.heroSource());
assert(sentry.constructs.length===1,'base sentry cast did not deploy exactly one turret');
assert(sentry.constructs[0].ttl<4.1,`base sentry persists too long for cycle deployment: ${sentry.constructs[0].ttl}`);
assert(sentry.constructs[0].power>1.9,`sentry did not inherit run power: ${sentry.constructs[0].power}`);

// Hidden multi-cycle stores are retired from the two crowd catalysts.
assert(!('reservoirCharge' in sentry)&&!('vaultCharge' in sentry),'hidden catalyst charge stores returned');

// Precision Doctrine must have a real combat effect.
const precision:any=new Simulation({seed:91005,hz:60,benchmark:true,mode:'clean'});
precision.configureBenchmarkLoadout({slots:['rail_spear'],catalysts:[],level:1,globalPower:0,skillPower:0});
const pst=precision.skillsRuntime.get('rail_spear'); pst.crit=0; precision.resonance.precision=0; precision.doctrines.precision=40;
precision.spawnEnemyAt('footnote',3,0,1);
const pe=precision.ents[0], php=pe.hp;
precision.damage(pe,100,'rail_spear',false);
assert(php-pe.hp>=174,`Precision Doctrine did not create guaranteed crit at high rank: dealt ${php-pe.hp}`);

// Siphon heals from actual damage, not from damage attempted against a dead/overkilled body.
const siphon:any=new Simulation({seed:91006,hz:60,benchmark:true,mode:'clean'});
siphon.php=50; siphon.maxHp=100; siphon.itemSiphon=.1;
siphon.spawnEnemyAt('footnote',3,0,1); const se=siphon.ents[0]; se.hp=10; se.maxHp=10;
siphon.damage(se,100,'echo',false);
assert(near(siphon.php,51,.001),`siphon healed from attempted rather than real damage: hp=${siphon.php}`);
siphon.damage(se,100,'echo',false);
assert(near(siphon.php,51,.001),'siphon healed from an already dead target');

// Refusal knowledge is no longer exclusive to one living elite.
const knowledge:any=new Simulation({seed:91007,hz:60,benchmark:true,mode:'clean'});
knowledge.refusalStore=[{serial:1,kind:'skill',title:'Копьё',icon:'R',skill:'rail_spear',heldBy:0}];
knowledge.spawnElite(); knowledge.spawnElite();
const ke=knowledge.ents.filter((e:any)=>e.kind==='elite').slice(-2);
assert(ke.length===2&&ke.every((e:any)=>e.repertoire.includes(1)),'a held refusal still blocks other elites from learning it');

// Captured items become enemy-ecosystem progression; later elites inherit them.
const legacy:any=new Simulation({seed:91008,hz:60,benchmark:true,mode:'clean'});
legacy.tick=360*60;
legacy.eliteLegacyItems=['plating','quickened','beacon','keen_edge'];
legacy.spawnElite();
const le=legacy.ents.filter((e:any)=>e.kind==='elite').at(-1);
assert((le.relicItems?.length??0)>=3,`late elite inherited too little captured-item history: ${le.relicItems?.length??0}`);
assert((le.evolutionItems?.length??0)>=3,`late elite did not gain autonomous full-pool growth: ${le.evolutionItems?.length??0}`);
assert(legacy.eliteEvolutionHistory.length>=3,'autonomous elite growth did not enter ecosystem history');
assert(le.maxHp>840*legacy.worldScale(),'durability relics are still suppressed on elites');

// Elites actively route toward nearby contested power instead of only taking accidental overlaps.
legacy.relics=[{id:991,x:le.x+5,z:le.z,item:'reprisal'}];
const before=Math.hypot(legacy.relics[0].x-le.x,legacy.relics[0].z-le.z);
const sought=legacy.steerEliteToRelic(le,le.speed,10);
const after=Math.hypot(legacy.relics[0].x-le.x,legacy.relics[0].z-le.z);
assert(sought&&after<before,'elite did not deliberately move toward a nearby relic');

// Final Warden is above late ordinary elites and inherits the full distinct captured-item history.
const boss:any=new Simulation({seed:91009,hz:60,benchmark:true,mode:'clean'});
boss.tick=Math.floor(420*60);
boss.eliteLegacyItems=['plating','vitality','quickened','beacon','reprisal','unravel','plating'];
boss.eliteEvolutionHistory=['hollow_point','siphon','lodestone','hollow_point'];
boss.refusalStore=[
 {serial:1,kind:'skill',title:'Копьё',icon:'R',skill:'rail_spear',heldBy:0},
 {serial:2,kind:'skill',title:'Туман',icon:'T',skill:'toxic_mist',heldBy:0},
 {serial:3,kind:'axis',title:'Темп',icon:'Т',resonance:'tempo',heldBy:0}
];
boss.spawnBoss();
const be=boss.ents.find((e:any)=>e.boss);
assert(be&&be.rarity==='legendary','Warden is not treated as apex rarity');
assert(be.maxHp>80000,`Warden durability is still below late-elite scale: ${be.maxHp}`);
assert((be.relicItems?.length??0)===7,`Warden did not preserve complete elite relic history including repeats: ${be.relicItems?.length??0}`);
assert((be.evolutionItems?.length??0)===3,`Warden did not inherit distinct autonomous evolution history: ${be.evolutionItems?.length??0}`);
assert(be.repertoire.length===3,'Warden did not inherit late elite refusal repertoire');

// A full relic board cannot bank many overdue instant spawns.
const relicTimer:any=new Simulation({seed:91010,hz:60,benchmark:true,mode:'clean'});
relicTimer.relicAcc=100;
relicTimer.relics=Array.from({length:8},(_,i)=>({id:1000+i,x:35+i*.1,z:25,item:'plating'}));
relicTimer.updateRelics();
assert(relicTimer.relicAcc<=Simulation.RELIC_INTERVAL+1e-6,`relic timer banked overdue burst: ${relicTimer.relicAcc}`);

console.log('crowd-build-elite-regression OK',{
  rail:{rays:`${baseRays}->${wideRays}`,damage:+(railWide/railBase).toFixed(2)},
  mortar:{impacts:`${baseMortars}->${wideMortars}`,damage:+(mortarWide/mortarBase).toFixed(2)},
  orbit:{count:`${ob.count}->${og.count}`,interval:`${ob.hitInterval.toFixed(3)}->${og.hitInterval.toFixed(3)}`},
  sentry:{ttl:+sentry.constructs[0].ttl.toFixed(2),power:+sentry.constructs[0].power.toFixed(2)},
  lateEliteItems:le.relicItems?.length??0,
  lateEliteEvolution:le.evolutionItems?.length??0,
  boss:{hp:Math.round(be.maxHp),items:be.relicItems?.length??0,evolution:be.evolutionItems?.length??0,repertoire:be.repertoire.length}
});
