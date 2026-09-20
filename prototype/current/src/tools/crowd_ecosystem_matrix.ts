import { Simulation, type BenchmarkLoadout } from '../core/simulation.js';
import type { DoctrineRuntime, Snapshot } from '../core/types.js';

type Build = { name:string; range:number; loadout:BenchmarkLoadout; doctrines:DoctrineRuntime };
const hz=60;
const builds:Build[]=[
  {
    name:'quantity-battery', range:8.5,
    doctrines:{might:3,size:1,quantity:6,duration:2,mobility:2,guard:1,force:1,precision:5},
    loadout:{slots:['rail_spear','sentry','chain_arc','shard_fan'],catalysts:['splinter','relay','capacitor'],level:9,globalPower:.65,tempo:.28,maxHp:100000,armor:30,
      mutations:{rail_spear:'rail_fan',sentry:'sentry_rail',chain_arc:'arc_capacitive',shard_fan:'fan_wide'},
      mutationUpgrades:{rail_spear:'rail_crossfire',sentry:'sentry_salvager',chain_arc:'arc_relay',shard_fan:'fan_storm'},
      mutationApotheoses:{rail_spear:'rail_lattice',sentry:'sentry_hunter_battery',chain_arc:'arc_living_circuit',shard_fan:'returner_carousel'}}
  },
  {
    name:'area-route', range:6.0,
    doctrines:{might:3,size:5,quantity:3,duration:5,mobility:2,guard:1,force:3,precision:1},
    loadout:{slots:['mortar_bloom','toxic_mist','frost_ring','tether_drag'],catalysts:['router','reservoir','conduit'],level:9,globalPower:.62,tempo:.24,maxHp:100000,armor:30,
      mutations:{mortar_bloom:'mortar_cluster',toxic_mist:'toxic_corrosive',frost_ring:'frost_front',tether_drag:'tether_net'},
      mutationUpgrades:{mortar_bloom:'mortar_airburst',toxic_mist:'toxic_reactive',frost_ring:'frost_brittle',tether_drag:'tether_dragnet'},
      mutationApotheoses:{mortar_bloom:'mortar_carpet',toxic_mist:'toxic_septic_bloom',frost_ring:'frost_worldstorm',tether_drag:'gravity_dragnet'}}
  },
  {
    name:'melee-harvest', range:2.5,
    doctrines:{might:4,size:5,quantity:3,duration:2,mobility:4,guard:5,force:5,precision:2},
    loadout:{slots:['cleaver','orbit_blades','frost_ring','tether_drag'],catalysts:['aegis_relay','splinter','backflow'],level:9,globalPower:.68,tempo:.3,maxHp:100000,armor:38,
      mutations:{cleaver:'cleaver_guillotine',orbit_blades:'orbit_saw',frost_ring:'frost_snap',tether_drag:'tether_hook'},
      mutationUpgrades:{cleaver:'cleaver_deep',orbit_blades:'orbit_blood',frost_ring:'frost_skin',tether_drag:'tether_anchor'},
      mutationApotheoses:{cleaver:'cleaver_rupture',orbit_blades:'orbit_sanguine_crown',frost_ring:'frost_glacier_heart',tether_drag:'gravity_singularity'}}
  },
  {
    name:'rolling-network', range:7.0,
    doctrines:{might:4,size:2,quantity:4,duration:3,mobility:2,guard:1,force:4,precision:3},
    loadout:{slots:['mass_driver','chain_arc','mortar_bloom','sentry'],catalysts:['recoil','relay','reservoir'],level:9,globalPower:.66,tempo:.26,maxHp:100000,armor:30,
      mutations:{mass_driver:'mass_rail',chain_arc:'arc_forked',mortar_bloom:'mortar_spotter',sentry:'sentry_relay'},
      mutationUpgrades:{mass_driver:'mass_terminal',chain_arc:'arc_cage',mortar_bloom:'mortar_beacon',sentry:'sentry_grid'},
      mutationApotheoses:{mass_driver:'mass_singularity',chain_arc:'arc_hunting_storm',mortar_bloom:'mortar_hunter_pass',sentry:'sentry_gravity_grid'}}
  }
];

function quiet(sim:any,time:number){
  sim.tick=time*hz; sim.spawnCredits=-1e9; sim.eliteAcc=-1e9; sim.firstElite=true; sim.bossSpawned=true;
  sim.relicAcc=-1e9; sim.pois=[]; sim.obstacles=[]; sim.obstacleGrid=new Map(); sim.ents=[]; sim.php=sim.maxHp;
}
function apply(sim:any,b:Build){sim.configureBenchmarkLoadout(b.loadout);Object.assign(sim.doctrines,b.doctrines);}
function steer(s:Snapshot,b:Build,frame:number){
  const elites=s.entities.filter(e=>e.elite), normals=s.entities.filter(e=>!e.elite);
  const t=(elites[0]??normals.sort((a,z)=>Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(z.x-s.player.x,z.z-s.player.z))[0]);
  let aimX=1,aimZ=0,moveX=0,moveZ=0;
  if(t){
    const dx=t.x-s.player.x,dz=t.z-s.player.z,d=Math.hypot(dx,dz)||1; aimX=dx/d;aimZ=dz/d;
    const err=d-b.range, tangent=(Math.floor(frame/(hz*2.5))%2?1:-1);
    moveX=aimX*Math.max(-.85,Math.min(.85,err*.45))-aimZ*.42*tangent;
    moveZ=aimZ*Math.max(-.85,Math.min(.85,err*.45))+aimX*.42*tangent;
    const m=Math.hypot(moveX,moveZ)||1;moveX/=m;moveZ/=m;
  }
  return {moveX,moveZ,aimX,aimZ,dash:false};
}
function spawnCrowd(sim:any){
  for(let i=0;i<84;i++){
    const cluster=i%7, a=cluster*Math.PI*2/7+(i%12)*.055, ring=4.3+Math.floor(i/14)*1.55+(i%3)*.25;
    sim.spawnEnemyAt(i%5===0?'bookmark':i%3===0?'marginwalker':'footnote',Math.cos(a)*ring,Math.sin(a)*ring,1);
  }
  sim.spawnElite();
  const elite=sim.ents.find((e:any)=>e.kind==='elite'); elite.x=7;elite.z=0;elite.rarity='uplifted';elite.maxHp=elite.hp=14500;elite.repertoire=[];
  return elite;
}
function crowdRun(b:Build){
  const sim:any=new Simulation({seed:77000+builds.indexOf(b),hz,runDuration:480,benchmark:true,mode:'clean'});apply(sim,b);quiet(sim,300);
  const elite=spawnCrowd(sim), initial=sim.ents.length;
  for(let i=0;i<20*hz;i++)sim.step(steer(sim.snapshot(),b,i));
  const alive=sim.ents.filter((e:any)=>e.hp>0).length;
  return {killed:initial-alive, eliteKilled:elite.hp<=0, eliteHp:+Math.max(0,elite.hp/elite.maxHp).toFixed(3), damage:Math.round(sim.metrics.damage)};
}
function bossRun(b:Build){
  const sim:any=new Simulation({seed:88000+builds.indexOf(b),hz,runDuration:480,benchmark:true,mode:'clean'});apply(sim,b);quiet(sim,420);
  sim.bossSpawned=false;
  sim.eliteLegacyItems=['plating','vitality','quickened','beacon','reprisal','unravel','keen_edge','hollow_point'];
  sim.refusalStore=[
    {serial:1,kind:'skill',title:'Рельсовое копьё',icon:'R',skill:'rail_spear',heldBy:0},
    {serial:2,kind:'skill',title:'Токсичный туман',icon:'T',skill:'toxic_mist',heldBy:0},
    {serial:3,kind:'skill',title:'Гравиякорь',icon:'G',skill:'tether_drag',heldBy:0},
    {serial:4,kind:'axis',title:'Темп',icon:'Т',resonance:'tempo',heldBy:0}
  ];
  sim.spawnBoss(); const boss=sim.ents.find((e:any)=>e.boss), hp0=boss.hp;
  for(let i=0;i<24*hz && boss.hp>0;i++)sim.step(steer(sim.snapshot(),b,i));
  return {startHp:Math.round(hp0), hpLost:+((hp0-Math.max(0,boss.hp))/hp0).toFixed(3), killed:boss.hp<=0, playerHp:Math.round(sim.php), phase:boss.bossPhase};
}

const rows=builds.map(b=>({build:b.name,crowd:crowdRun(b),boss:bossRun(b)}));
for(const row of rows){
  if(row.crowd.killed<18) throw new Error(`${row.build}: crowd clear collapsed to ${row.crowd.killed}/85`);
  if(row.boss.hpLost<.025) throw new Error(`${row.build}: cannot meaningfully damage late Warden (${row.boss.hpLost})`);
}
console.log('crowd-ecosystem-matrix',JSON.stringify(rows,null,2));
