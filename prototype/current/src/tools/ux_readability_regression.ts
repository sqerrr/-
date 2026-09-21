declare const process: { exit(code?: number): never };
import { readFileSync } from 'node:fs';
import { Simulation } from '../core/simulation.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('ux-readability-regression: ' + message);
}

const scaleSim:any = new Simulation({ seed: 90125, hz: 60, runDuration: 480, mode: 'clean' });
const samples = [120,240,360,480].map((sec) => {
  scaleSim.tick = sec * scaleSim.hz;
  return {
    sec,
    hp: scaleSim.worldScale(),
    damage: scaleSim.damageScale(),
    spawn: scaleSim.spawnPressure()
  };
});
for (let i=1;i<samples.length;i++) {
  assert(samples[i].hp > samples[i-1].hp, 'world HP pressure must rise through the run');
  assert(samples[i].damage > samples[i-1].damage, 'enemy damage must rise through the run');
  assert(samples[i].spawn > samples[i-1].spawn, 'spawn pressure must rise through the run');
}
assert(Math.abs(samples[3].hp - 5.3728) < 0.01, 'end-run HP scale drifted unexpectedly');
assert(Math.abs(samples[3].damage - 1.8064) < 0.01, 'end-run damage scale drifted unexpectedly');

const chassis = ['hunter','architect','broodmaker','bulwark','harvester','shepherd'] as const;
for (const name of chassis) {
  const sim:any = new Simulation({ seed: 4100 + name.length, hz:60, runDuration:480, mode:'clean' });
  sim.spawnElite();
  const e = sim.ents.find((x:any)=>x.kind==='elite');
  assert(e, name + ': no elite subject');
  e.chassis=name; e.affix='none'; e.cooldown=0; e.eliteAction=undefined; e.adaptStage=0;
  e.x=0; e.z=0; sim.px=5; sim.pz=0; sim.playerVX=0; sim.playerVZ=0;
  sim.updateEliteAI(e,e.speed,5,1,0);
  assert(e.eliteAction || e.adaptStage>0, name + ': chassis has no authored active pattern');
}

const affixSim:any = new Simulation({seed:77123,hz:60,runDuration:480,mode:'clean'});
affixSim.tick = 360 * affixSim.hz;
const late = new Set<string>();
for(let i=0;i<32;i++) late.add(affixSim.rollEliteAffix('uplifted'));
assert([...late].some(x=>x!=='none'),'late uplifted elites still never receive affixes');

const renderer=readFileSync('src/renderer/webgl2.ts','utf8');
assert(!renderer.includes("e.orderActive && e.squadTask"),'squad routing lines leaked back into combat presentation');
assert(renderer.includes("archive=texture(u_floor"),'archive floor is no longer the dominant background texture');
assert(renderer.includes("shield_commit/.test"),'shield telegraph is outside hostile-red visual language');
assert(renderer.includes('drawEliteIdentityOverlay(s)'),'elite identity pass is missing');
assert(renderer.indexOf('this.drawEliteIdentityOverlay(s)') < renderer.indexOf('this.drawDangerOverlay(s)'),
  'persistent elite identity must render before final danger overlay');
assert(renderer.includes('Red is forbidden here'),'persistent elite identity no longer reserves red for immediate danger');
assert(renderer.includes("case 'hunter'") && renderer.includes("case 'bulwark'") && renderer.includes("case 'broodmaker'"),
  'chassis visual grammar collapsed back to one generic marker');

const ui=readFileSync('src/platform/main.ts','utf8');
assert(ui.includes("itemGlyph[r.item"),'ground relics do not expose per-item pictograms');
assert(ui.includes("classList.toggle('danger'"),'threat panel lacks imminent-danger state');
assert(ui.includes("Базовый урон"),'build sheet does not expose derived player growth');
assert(ui.includes('drawEliteMapMarker'),'minimap/offscreen elites do not use chassis-specific shapes');
assert(ui.includes('drawAffixBadge2d'),'affix identity lacks its own compact visual channel');
assert(ui.includes('threatFocusId'),'nearest-elite threat panel is not sticky and will flicker between targets');
assert(ui.includes('eliteActionHint'),'active elite patterns lack short action-specific dodge language');
assert(!ui.includes("ctx.fillText(e.boss ? 'ХРАНИТЕЛЬ' : eliteName(e)"),
  'combat HUD leaked full chassis/affix names back over every elite');

const html=readFileSync('public/index.html','utf8');
assert(html.includes('threatChassisGlyph') && html.includes('threatAffixGlyph'),
  'threat panel does not separate chassis and affix channels');
assert(html.includes('phaseBadge') && html.includes('routeBadge') && html.includes('finalBadge'),
  'live objective fell back to one long sentence');
assert(html.includes('формы = тип элиты · красный = атака сейчас'),
  'minimap legend does not teach the new shape/red grammar');

const simulation=readFileSync('src/core/simulation.ts','utf8');
for(const token of [
  'elite_predator_tell','elite_architect_veil_tell','elite_brood_tell',
  'elite_prism_tell','elite_null_tell','elite_shepherd_tell'
]) assert(simulation.includes(token), token + ': missing authored elite tell');

console.log('ux-readability-regression OK', {scales:samples, lateAffixes:[...late]});
