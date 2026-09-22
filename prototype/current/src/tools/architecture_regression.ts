import { readFileSync } from 'node:fs';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('architecture-regression: ' + message);
}

const simulation=readFileSync('src/core/simulation.ts','utf8');
const state=readFileSync('src/core/state.ts','utf8');
const physical=readFileSync('src/core/physicalLifecycle.ts','utf8');
const entityStore=readFileSync('src/core/entityStore.ts','utf8');
const stateModel=readFileSync('src/core/state.ts','utf8');
const types=readFileSync('src/core/types.ts','utf8');
const ui=readFileSync('src/platform/main.ts','utf8');
const eliteUi=readFileSync('src/content/eliteUi.ts','utf8');

assert(state.includes('export type Ent ='), 'internal entity model is no longer extracted');
assert(state.includes('export type PhysicalEvent =') && state.includes('export type CatalystBinding ='),
  'physical lifecycle state leaked back into Simulation');
assert(!simulation.includes("type EnemyState = 'normal'"), 'Simulation owns entity-state declarations again');
assert(!simulation.includes('type CatalystBinding ='), 'Simulation owns Catalyst binding declarations again');
assert(physical.includes('export class PhysicalLifecycle'), 'physical lifecycle has no dedicated owner');
for (const token of ['activationPending =','catalystBindings:','physicalEvents:','activationMeta ='])
  assert(!simulation.includes(token), 'physical lifecycle storage leaked back into Simulation: '+token);
assert(simulation.includes('private physical = new PhysicalLifecycle()'),
  'Simulation no longer delegates causal activation bookkeeping');
assert(entityStore.includes('export class EntityStore'), 'entity roster has no dedicated owner/query boundary');
assert(simulation.includes('private entityStore = new EntityStore()'), 'Simulation no longer delegates entity identity/query ownership');
assert(!simulation.includes('this.ents.find('), 'hot-path id lookup bypasses EntityStore index');
assert(!simulation.includes('this.ents.filter('), 'hot-path entity query allocates through raw roster filter again');
for (const component of ['BodyComponent','VitalComponent','RelationComponent','EliteRuntimeComponent','StatusComponent','EliteProgressionComponent'])
  assert(stateModel.includes('export interface '+component), 'entity domain component missing: '+component);
assert(stateModel.includes('export function makeEnt('), 'combat entity construction has no single factory');
assert(!simulation.includes(': Ent = {'), 'Simulation bypasses makeEnt with a duplicated full entity literal');

assert(types.includes('export type DamageSourceId ='), 'player damage sources are stringly typed again');
assert(types.includes('export type EliteActionId ='), 'elite actions are stringly typed again');
assert(types.includes('export type BossPatternId ='), 'boss patterns are stringly typed again');

assert(!simulation.includes("e.bossPattern === 'condensed'"), 'Shepherd adaptation is stored in bossPattern again');
assert(!simulation.includes('e.bossPattern = key'), 'Bulwark damage memory is stored in bossPattern again');
assert(simulation.includes('e.shepherdMode') && simulation.includes('e.prismMemory'),
  'elite-specific adaptation state is not separated from boss attack state');

assert(eliteUi.includes('export const eliteChassisUi'), 'elite presentation metadata has no single catalogue');
assert(!ui.includes('const chassisName: Record'), 'platform duplicated chassis metadata again');
assert(ui.includes("from '../content/eliteUi.js'"), 'platform does not consume elite metadata catalogue');

assert(ui.includes('let frameSnapshot: Snapshot | null = null'), 'render frame no longer reuses post-tick snapshot');
assert(ui.includes('function updateDebugState(s: Snapshot)'), 'debug UI serializes its own Snapshot again');
assert(!ui.includes('function updateDebugState() {\n  const s = sim.snapshot()'),
  'hidden debug state performs a duplicate snapshot');

console.log('architecture-regression OK', {
  stateModule:true,
  typedCombatIds:true,
  separatedEliteAdaptation:true,
  sharedEliteMetadata:true,
  frameSnapshotReuse:true,
  physicalLifecycleOwner:true,
  entityStore:true,
  entityComponents:true
});
