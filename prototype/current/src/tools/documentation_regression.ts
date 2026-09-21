import { readFileSync } from 'node:fs';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('documentation-regression: ' + message);
}
const read=(p:string)=>readFileSync(p,'utf8');

const root=read('../../00_START_HERE.md');
assert(root.includes('v0.12.1'),'root entry point is not current version');
assert(root.includes('38_ELITE_VISUAL_LANGUAGE_2026-09-22.md'),'root entry point does not lead to elite visual-language authority');
assert(root.includes('37_CATALYST_2_0_CHOREOGRAPHY_2026-09-22.md'),'root entry point does not retain Catalyst 2.0 authority');
assert(root.includes('Executable code + passing regression'),'authority order no longer identifies code/tests as factual evidence');

const manifest=read('../../MANIFEST.md');
assert(manifest.includes('v0.12.1 current'),'manifest is stale');
assert(manifest.includes('38_ELITE_VISUAL_LANGUAGE_2026-09-22.md'),'manifest omits elite visual-language authority');
assert(manifest.includes('37_CATALYST_2_0_CHOREOGRAPHY_2026-09-22.md'),'manifest omits Catalyst 2.0 authority');

const local=read('README.md');
assert(local.includes('v0.12.1'),'prototype README is stale');
assert(!local.includes('v0.10 — CORE REBUILD SANDBOX'),'old prototype README returned');
assert(!local.includes('?mode=clean&start=ember_lance'),'legacy Phenomenon returned as current launch example');
assert(read('../../38_ELITE_VISUAL_LANGUAGE_2026-09-22.md').includes('Red is reserved for immediate hostile danger'),'elite visual-language authority lost the danger-color contract');
assert(read('../../37_CATALYST_2_0_CHOREOGRAPHY_2026-09-22.md').includes('GIF test'),'Catalyst 2.0 authority lost the visual interaction criterion');
assert(read('../../34_BUILDCRAFT_AUDIT_2026-09-20.md').startsWith('> **OWNER CORRECTION'),'audit 34 is not marked subordinate to owner correction');
assert(read('../../35_CHAT_HANDOFF_2026-09-20_BUILDCRAFT.md').startsWith('> **OWNER CORRECTION'),'handoff 35 is not marked subordinate to owner correction');

for(const p of [
  '../../01_PROJECT_HANDOFF.md','../../02_DECISIONS_AND_OPEN_QUESTIONS.md','../../03_NEW_CHAT_PROMPT.md',
  '../../13_V010_CORE_REBUILD_SPEC.md','../../25_CHAT_HANDOFF_2026-09-19.md','../../26_CHAT_HANDOFF_2026-09-19_COMPLETE.md'
]) assert(read(p).startsWith('> **ARCHIVED / HISTORICAL:**'),`${p}: superseded document lacks archive banner`);

console.log('documentation-regression OK');
