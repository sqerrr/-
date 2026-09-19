import { readFileSync } from 'node:fs';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('documentation-regression: ' + message);
}
const read=(p:string)=>readFileSync(p,'utf8');

const root=read('../../00_START_HERE.md');
assert(root.includes('v0.11.3'),'root entry point is not current version');
assert(root.includes('33_ANIMATION_PRESENTATION_LEGACY_AUDIT_2026-09-20.md'),'root entry point does not lead to latest audit');
assert(root.includes('Executable code + passing regression tests'),'authority order no longer identifies code/tests as factual evidence');

const manifest=read('../../MANIFEST.md');
assert(manifest.includes('v0.11.3 current'),'manifest is stale');
assert(manifest.includes('33_ANIMATION_PRESENTATION_LEGACY_AUDIT_2026-09-20.md'),'manifest omits latest audit');

const local=read('README.md');
assert(local.includes('v0.11.3'),'prototype README is stale');
assert(!local.includes('v0.10 — CORE REBUILD SANDBOX'),'old prototype README returned');
assert(!local.includes('?mode=clean&start=ember_lance'),'legacy Phenomenon returned as current launch example');

for(const p of [
  '../../01_PROJECT_HANDOFF.md','../../02_DECISIONS_AND_OPEN_QUESTIONS.md','../../03_NEW_CHAT_PROMPT.md',
  '../../13_V010_CORE_REBUILD_SPEC.md','../../25_CHAT_HANDOFF_2026-09-19.md','../../26_CHAT_HANDOFF_2026-09-19_COMPLETE.md'
]) assert(read(p).startsWith('> **ARCHIVED / HISTORICAL:**'),`${p}: superseded document lacks archive banner`);

console.log('documentation-regression OK');
