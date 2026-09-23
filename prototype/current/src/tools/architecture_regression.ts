import { readFileSync } from 'node:fs';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('architecture-regression: ' + message);
}

const simulation=readFileSync('src/core/simulation.ts','utf8');
const state=readFileSync('src/core/state.ts','utf8');
const physical=readFileSync('src/core/physicalLifecycle.ts','utf8');
const projectileSystem=readFileSync('src/core/projectileSystem.ts','utf8');
const delayedStrikeSystem=readFileSync('src/core/delayedStrikeSystem.ts','utf8');
const orbitSystem=readFileSync('src/core/orbitSystem.ts','utf8');
const fieldSystem=readFileSync('src/core/fieldSystem.ts','utf8');
const legacyCatalyst=readFileSync('src/core/legacyCatalystSystem.ts','utf8');
const constructSystem=readFileSync('src/core/constructSystem.ts','utf8');
const entityStore=readFileSync('src/core/entityStore.ts','utf8');
const deathResolution=readFileSync('src/core/deathResolutionSystem.ts','utf8');
const encounterDirector=readFileSync('src/core/encounterDirector.ts','utf8');
const squadDirector=readFileSync('src/core/squadDirector.ts','utf8');
const eliteBehavior=readFileSync('src/core/eliteBehaviorSystem.ts','utf8');
const eliteAffix=readFileSync('src/core/eliteAffixSystem.ts','utf8');
const bossBehavior=readFileSync('src/core/bossBehaviorSystem.ts','utf8');
const enemyBehavior=readFileSync('src/core/enemyBehaviorSystem.ts','utf8');
const stateModel=readFileSync('src/core/state.ts','utf8');
const testHarness=readFileSync('src/testing/simulationHarness.ts','utf8');
const statusSystem=readFileSync('src/core/statusSystem.ts','utf8');
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
assert(delayedStrikeSystem.includes('export class DelayedStrikeSystem'), 'delayed impacts have no dedicated runtime system');
assert(simulation.includes('private delayedStrikeSystem!: DelayedStrikeSystem'),
  'Simulation no longer delegates delayed impacts');
const delayedUpdate=simulation.slice(
  simulation.indexOf('private updateDelayedStrikes()'),
  simulation.indexOf('private scheduleStrike(', simulation.indexOf('private updateDelayedStrikes()'))
);
assert(delayedUpdate.includes('this.delayedStrikeSystem.update(this.delayedStrikes)'),
  'Simulation updateDelayedStrikes is no longer a thin orchestration wrapper');
for (const token of ['areaPoints=[0,1,2,3]','fieldKind','_impact'])
  assert(!delayedUpdate.includes(token), 'delayed strike runtime leaked back into Simulation: '+token);

assert(projectileSystem.includes('export class ProjectileSystem'), 'moving projectiles have no dedicated runtime system');
assert(simulation.includes('private projectileSystem!: ProjectileSystem'), 'Simulation no longer delegates projectile runtime');
const projectileUpdate=simulation.slice(
  simulation.indexOf('private updateProjectiles()'),
  simulation.indexOf('private scheduleStrike(', simulation.indexOf('private updateProjectiles()'))
);
assert(projectileUpdate.includes('this.projectileSystem.update(this.projectiles)'),
  'Simulation updateProjectiles is no longer a thin orchestration wrapper');
for (const token of ["behavior === 'returner'","behavior === 'roller'","returner_phoenix","orbit_guard"])
  assert(!projectileUpdate.includes(token), 'projectile runtime behavior leaked back into Simulation: '+token);
assert(fieldSystem.includes('export class FieldSystem'), 'persistent fields have no dedicated runtime system');
assert(simulation.includes('private fieldSystem!: FieldSystem'), 'Simulation no longer delegates field runtime');
const fieldUpdate=simulation.slice(
  simulation.indexOf('private updateFields()'),
  simulation.indexOf('private updateDots(', simulation.indexOf('private updateFields()'))
);
assert(fieldUpdate.includes('this.fieldSystem.update(this.fields)'),
  'Simulation updateFields is no longer a thin orchestration wrapper');
for (const token of ["behavior === 'host'","behavior==='pull'","toxic_corrosive","insideIds"])
  assert(!fieldUpdate.includes(token), 'field runtime behavior leaked back into Simulation: '+token);
assert(constructSystem.includes('export class ConstructSystem'), 'persistent constructs have no dedicated runtime system');
assert(simulation.includes('private constructSystem!: ConstructSystem'), 'Simulation no longer delegates construct runtime');
const constructUpdate=simulation.slice(
  simulation.indexOf('private updateConstructs()'),
  simulation.indexOf('private updateOrbitBlades(', simulation.indexOf('private updateConstructs()'))
);
assert(constructUpdate.includes('this.constructSystem.update(this.constructs)'),
  'Simulation updateConstructs is no longer a thin orchestration wrapper');
for (const token of ['sentry_hunter_battery','sentry_gravity_grid','sentry_crawler','sentry_walker'])
  assert(!constructUpdate.includes(token), 'construct runtime behavior leaked back into Simulation: '+token);
assert(!simulation.includes('private sentryGridAcc =') && !simulation.includes('private sentryBatteryAt ='),
  'construct-specific cadence state leaked back into Simulation');
assert(legacyCatalyst.includes('export class LegacyCatalystSystem'), 'Catalyst 1.x compatibility has no dedicated owner');
assert(simulation.includes('private legacyCatalysts!: LegacyCatalystSystem'),
  'Simulation no longer delegates Catalyst 1.x compatibility');
const activationMethod=simulation.slice(
  simulation.indexOf('private activateSlot('),
  simulation.indexOf('private isPhysicalCatalyst(', simulation.indexOf('private activateSlot('))
);
for (const token of ["incoming === 'anchor'","incoming === 'capacitor'","incoming === 'relay'","incoming === 'overflow'"])
  assert(!activationMethod.includes(token), 'legacy Catalyst behavior leaked back into activateSlot: '+token);
assert(!simulation.includes('private topologyGuard = false') && !simulation.includes('private feedbackCountBonus ='),
  'legacy Catalyst runtime state leaked back into Simulation');
assert(orbitSystem.includes('export class OrbitSystem'), 'persistent Orbit has no dedicated runtime/geometry owner');
assert(simulation.includes('private orbitSystem!: OrbitSystem'), 'Simulation no longer delegates Orbit runtime');
const orbitUpdate=simulation.slice(
  simulation.indexOf('private updateOrbitBlades()'),
  simulation.indexOf('private updateDots(', simulation.indexOf('private updateOrbitBlades()'))
);
assert(orbitUpdate.includes('this.orbitSystem.update('),
  'Simulation updateOrbitBlades is no longer a thin orchestration wrapper');
assert(!simulation.includes('private orbitProfile('), 'Orbit geometry policy leaked back into Simulation');
assert(!simulation.includes('private orbitPhoenixAt =') && !simulation.includes('private orbitAcc ='),
  'Orbit-specific cadence state leaked back into Simulation');
assert(state.includes('export type ActivationContext ='), 'chain activation context is anonymous again');
assert(deathResolution.includes('export class DeathResolutionSystem'), 'entity death consequences have no dedicated resolver');
assert(simulation.includes('private deathResolution!: DeathResolutionSystem'), 'Simulation no longer delegates entity death consequences');
const cleanupBlock=simulation.slice(
  simulation.indexOf('private cleanup()'),
  simulation.indexOf('private checkProgression(', simulation.indexOf('private cleanup()'))
);
assert(cleanupBlock.includes('this.deathResolution.resolve(this.ents)'),
  'Simulation cleanup no longer delegates death consequences');
for (const token of ["e.affix === 'volatile'","e.kind === 'inkblot'","replicant_feedback","sentry_salvager"])
  assert(!cleanupBlock.includes(token), 'death policy leaked back into Simulation cleanup: '+token);
assert(!simulation.includes('const ELITE_RARITY_CORE:') && !simulation.includes('const eliteAffixThreat:'),
  'death-only elite reward tables leaked back into Simulation');

assert(entityStore.includes('export class EntityStore'), 'entity roster has no dedicated owner/query boundary');
assert(simulation.includes('private entityStore = new EntityStore()'), 'Simulation no longer delegates entity identity/query ownership');
assert(!simulation.includes('this.ents.find('), 'hot-path id lookup bypasses EntityStore index');
assert(!simulation.includes('this.ents.filter('), 'hot-path entity query allocates through raw roster filter again');
assert(encounterDirector.includes('export class EncounterDirector'), 'run pacing has no dedicated director');
for (const token of ['private spawnCredits =','private eliteAcc =','private firstElite ='])
  assert(!simulation.includes(token), 'encounter cadence state leaked back into Simulation: '+token);
assert(simulation.includes('private encounterDirector'), 'Simulation no longer delegates encounter pacing');
assert(squadDirector.includes('export class SquadDirector'), 'squad orchestration has no dedicated director');
assert(simulation.includes('private squadDirector!: SquadDirector'), 'Simulation no longer delegates squad orchestration');
assert(!simulation.includes('private squadTaskFor(') && !simulation.includes('private squadTarget('),
  'squad task/target policy leaked back into Simulation');
assert(eliteBehavior.includes('export class EliteBehaviorSystem'), 'elite chassis behavior has no dedicated system');
for (const chassis of ['hunter','architect','broodmaker','bulwark','harvester','shepherd'])
  assert(eliteBehavior.includes("chassis === '"+chassis+"'"), 'elite behavior system missing chassis: '+chassis);
assert(simulation.includes('private eliteBehavior!: EliteBehaviorSystem'), 'Simulation no longer delegates elite chassis AI');
assert(eliteAffix.includes('export class EliteAffixSystem'), 'elite affixes have no dedicated behavior system');
for (const affix of ['crowned','brood','vanguard','temporal','regenerating','shielded'])
  assert(eliteAffix.includes("entity.affix === '"+affix+"'"), 'elite affix system missing behavior: '+affix);
assert(simulation.includes('private eliteAffix!: EliteAffixSystem'), 'Simulation no longer delegates elite affix behavior');
const enemyAiBlock=simulation.slice(
  simulation.indexOf('private updateEnemyAI()'),
  simulation.indexOf('private elitePatternCooldown(', simulation.indexOf('private updateEnemyAI()'))
);
for (const token of ["affix === 'temporal'","affix === 'shielded'","affix === 'vanguard'","affix === 'brood'"])
  assert(!enemyAiBlock.includes(token), 'elite affix behavior leaked back into updateEnemyAI: '+token);
assert(!simulation.includes("if (c === 'hunter')") && !simulation.includes('private beginElitePattern('),
  'authored elite chassis state machines leaked back into Simulation');
assert(bossBehavior.includes('export class BossBehaviorSystem'), 'Warden behavior has no dedicated system');
for (const pattern of ['sweep','rupture','charge'])
  assert(bossBehavior.includes("'"+pattern+"'"), 'boss behavior missing pattern: '+pattern);
assert(simulation.includes('private bossBehavior!: BossBehaviorSystem'), 'Simulation no longer delegates Warden behavior');
assert(!simulation.includes("e.bossPattern === 'sweep'") && !simulation.includes('telegraph_boss_'),
  'Warden phase/pattern state machine leaked back into Simulation');
assert(enemyBehavior.includes('export class EnemyBehaviorSystem'), 'non-elite enemies have no dedicated behavior system');
for (const kind of ['footnote','bookmark','binder','redactor','indexer','inkblot','marginwalker'])
  assert(enemyBehavior.includes("entity.kind === '"+kind+"'"), 'enemy behavior missing native script: '+kind);
assert(simulation.includes('private enemyBehavior!: EnemyBehaviorSystem'), 'Simulation no longer delegates native enemy behavior');
const enemyLoop=simulation.slice(
  simulation.indexOf('private updateEnemyAI()'),
  simulation.indexOf('private elitePatternCooldown(', simulation.indexOf('private updateEnemyAI()'))
);
for (const token of ["e.kind === 'bookmark'","e.kind === 'binder'","e.kind === 'redactor'","e.kind === 'indexer'","e.kind === 'inkblot'"])
  assert(!enemyLoop.includes(token), 'native enemy script leaked back into updateEnemyAI: '+token);
assert(statusSystem.includes('export class StatusSystem'), 'generic combat statuses have no dedicated owner');
assert(simulation.includes('private statusSystem = new StatusSystem()'), 'Simulation no longer delegates generic status lifecycle');
assert(!simulation.includes('private stateActive(') && !simulation.includes('private consumeState('),
  'dead generic status helpers leaked back into Simulation');
for (const component of ['BodyComponent','VitalComponent','RelationComponent','EliteRuntimeComponent','StatusComponent','EliteProgressionComponent'])
  assert(stateModel.includes('export interface '+component), 'entity domain component missing: '+component);
assert(stateModel.includes('export function makeEnt('), 'combat entity construction has no single factory');
assert(!simulation.includes(': Ent = {'), 'Simulation bypasses makeEnt with a duplicated full entity literal');
assert(testHarness.includes('interface SimulationInternals'), 'regression access has no centralized test seam');
assert(testHarness.includes('as unknown as SimulationInternals'), 'test seam no longer owns the explicit unsafe boundary');
for (const file of [
  'src/tools/ux_readability_regression.ts',
  'src/tools/projectile_regression.ts',
  'src/tools/rival_cast_regression.ts',
  'src/tools/relic_regression.ts'
]) {
  const source=readFileSync(file,'utf8');
  assert(!/\bany\b/.test(source), file+' regressed to scattered any-based Simulation access');
}

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
  projectileSystem:true,
  delayedStrikeSystem:true,
  orbitSystem:true,
  fieldSystem:true,
  constructSystem:true,
  legacyCatalystSystem:true,
  entityStore:true,
  deathResolutionSystem:true,
  encounterDirector:true,
  squadDirector:true,
  eliteBehaviorSystem:true,
  eliteAffixSystem:true,
  bossBehaviorSystem:true,
  enemyBehaviorSystem:true,
  statusSystem:true,
  entityComponents:true,
  typedTestHarness:true
});
