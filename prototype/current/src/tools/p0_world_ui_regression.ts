declare const process: { exit(code?: number): never };
import { readFileSync } from 'node:fs';
import { Simulation } from '../core/simulation.js';
function assert(ok:boolean,msg:string){if(!ok)throw new Error('p0-world-ui-regression: '+msg);}
const sim=new Simulation({seed:12345,hz:60});const s=sim.snapshot();
assert(s.world.pois.filter(p=>p.kind==='phenomenon').length>=3,'need at least three reachable phenomenon sources');
assert(s.world.pois.filter(p=>p.kind==='catalyst').length>=2,'need at least two catalyst sources');
const renderer=readFileSync('dist/renderer/webgl2.js','utf8');
assert(renderer.includes('drawDangerOverlay'),'elite danger overlay missing');
assert(renderer.includes('fracture(')&&renderer.includes('fbm('),'procedural terrain shader missing');
const html=readFileSync('public/index.html','utf8');
for(const id of ['plannerCharacter','plannerDoctrines','plannerDerived','plannerItems']) assert(html.includes(`id="${id}"`),`${id} missing from Tab sheet`);
assert(html.includes('⌑ Феномен')&&html.includes('⧖ Катализатор'),'minimap legend does not explain source shapes');
console.log('p0-world-ui-regression OK',{pois:s.world.pois.length,phenomena:s.world.pois.filter(p=>p.kind==='phenomenon').length,catalysts:s.world.pois.filter(p=>p.kind==='catalyst').length});
