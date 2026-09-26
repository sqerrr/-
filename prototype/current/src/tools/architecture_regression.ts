import { readFileSync } from 'node:fs';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('architecture-regression: ' + message);
}

const simulation=readFileSync('src/core/simulation.ts','utf8');
const canonicalState=readFileSync('src/core/canonicalStateSerializer.ts','utf8');
const snapshotBuilder=readFileSync('src/core/snapshotBuilder.ts','utf8');
const state=readFileSync('src/core/state.ts','utf8');
const physical=readFileSync('src/core/physicalLifecycle.ts','utf8');
const physicalActivation=readFileSync('src/core/physicalActivationSystem.ts','utf8');
const physicalCatalyst=readFileSync('src/core/physicalCatalystSystem.ts','utf8');
const projectileSystem=readFileSync('src/core/projectileSystem.ts','utf8');
const phenomenonCastSystem=readFileSync('src/core/phenomenonCastSystem.ts','utf8');
const phenomenonKillReaction=readFileSync('src/core/phenomenonKillReactionSystem.ts','utf8');
const statefulPhenomenonCastSystem=readFileSync('src/core/statefulPhenomenonCastSystem.ts','utf8');
const choreographyTraceSystem=readFileSync('src/core/choreographyTraceSystem.ts','utf8');
const choiceRuntime=readFileSync('src/core/choiceRuntime.ts','utf8');
const activationRuntime=readFileSync('src/core/activationRuntime.ts','utf8');
const activationPipeline=readFileSync('src/core/activationPipelineSystem.ts','utf8');
const combatLedger=readFileSync('src/core/combatLedger.ts','utf8');
const combatTargeting=readFileSync('src/core/combatTargetingSystem.ts','utf8');
const relicRace=readFileSync('src/core/relicRaceSystem.ts','utf8');
const rewardOfferFactory=readFileSync('src/core/rewardOfferFactory.ts','utf8');
const progressionOfferSystem=readFileSync('src/core/progressionOfferSystem.ts','utf8');
const poiSystem=readFileSync('src/core/poiSystem.ts','utf8');
const worldGeometry=readFileSync('src/core/worldGeometrySystem.ts','utf8');
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
const eliteDamageResponse=readFileSync('src/core/eliteDamageResponseSystem.ts','utf8');
const eliteEcho=readFileSync('src/core/eliteEchoSystem.ts','utf8');
const eliteEncounterLedger=readFileSync('src/core/eliteEncounterLedger.ts','utf8');
const eliteProgression=readFileSync('src/core/eliteProgressionSystem.ts','utf8');
const eliteSpawnSystem=readFileSync('src/core/eliteSpawnSystem.ts','utf8');
const eliteAffix=readFileSync('src/core/eliteAffixSystem.ts','utf8');
const bossBehavior=readFileSync('src/core/bossBehaviorSystem.ts','utf8');
const enemyBehavior=readFileSync('src/core/enemyBehaviorSystem.ts','utf8');
const enemySpawnSystem=readFileSync('src/core/enemySpawnSystem.ts','utf8');
const enemyRecycleSystem=readFileSync('src/core/enemyRecycleSystem.ts','utf8');
const enemyDamageModifier=readFileSync('src/core/enemyDamageModifierSystem.ts','utf8');
const playerDamageSystem=readFileSync('src/core/playerDamageSystem.ts','utf8');
const playerMovementSystem=readFileSync('src/core/playerMovementSystem.ts','utf8');
const stateModel=readFileSync('src/core/state.ts','utf8');
const testHarness=readFileSync('src/testing/simulationHarness.ts','utf8');
const statusSystem=readFileSync('src/core/statusSystem.ts','utf8');
const types=readFileSync('src/core/types.ts','utf8');
const ui=readFileSync('src/platform/main.ts','utf8');
const eliteUi=readFileSync('src/content/eliteUi.ts','utf8');

assert(state.includes('export type Ent ='), 'internal entity model is no longer extracted');
assert(canonicalState.includes('export class CanonicalStateSerializer'),
  'deterministic run-state schema has no dedicated serializer');
assert(canonicalState.includes('export const CANONICAL_SCHEMA_VERSION = 6'),
  'canonical schema version changed during serializer extraction');
assert(simulation.includes('private canonicalSerializer = new CanonicalStateSerializer()'),
  'Simulation no longer delegates canonical-state serialization');
assert(simulation.includes('return this.canonicalSerializer.serialize(this.canonicalInput())'),
  'Simulation canonicalState is no longer a thin serializer seam');
assert(simulation.includes('return this.canonicalSerializer.hash(this.canonicalInput())'),
  'Simulation canonicalHash bypasses canonical serializer');
assert(!simulation.includes("put('player.pos'") && !simulation.includes("put('ent'"),
  'canonical field ordering leaked back into Simulation');
assert(snapshotBuilder.includes('export class SnapshotBuilder'),
  'runtime presentation snapshot has no dedicated builder');
assert(simulation.includes('private snapshotBuilder = new SnapshotBuilder()'),
  'Simulation no longer delegates runtime snapshot projection');
const snapshotStart=simulation.indexOf('  snapshot(): Snapshot {');
const snapshotNext=simulation.indexOf('\n  /**', snapshotStart);
const snapshotBlock=simulation.slice(snapshotStart, snapshotNext > snapshotStart ? snapshotNext : snapshotStart + 500);
assert(snapshotBlock.includes('return this.snapshotBuilder.build(this.snapshotInput())'),
  'Simulation snapshot is no longer a thin builder seam');
for (const token of ['refusalTitles:','contested: this.ents.some','fields: this.fields.map','projectiles: this.projectiles.map'])
  assert(!snapshotBlock.includes(token), 'presentation projection leaked back into Simulation.snapshot: '+token);
assert(state.includes('export type PhysicalEvent =') && state.includes('export type CatalystBinding ='),
  'physical lifecycle state leaked back into Simulation');
assert(!simulation.includes("type EnemyState = 'normal'"), 'Simulation owns entity-state declarations again');
assert(!simulation.includes('type CatalystBinding ='), 'Simulation owns Catalyst binding declarations again');
assert(physical.includes('export class PhysicalLifecycle'), 'physical lifecycle has no dedicated owner');
assert(physicalActivation.includes('export class PhysicalActivationSystem'),
  'Catalyst 2.x activation protocol has no dedicated owner');
assert(simulation.includes('private physicalActivations!: PhysicalActivationSystem'),
  'Simulation no longer delegates physical activation protocol');
for (const method of ['isPhysicalCatalyst','armOutgoingPhysicalCatalyst','publishImmediatePhysicalTrace','tracePath'])
  assert(!simulation.includes('private '+method+'('), 'physical activation protocol leaked back into Simulation: '+method);

assert(physicalCatalyst.includes('export class PhysicalCatalystSystem'), 'Catalyst 2.x binding policy has no dedicated owner');
assert(simulation.includes('private physicalCatalysts!: PhysicalCatalystSystem'),
  'Simulation no longer delegates Catalyst 2.x binding policy');
assert(simulation.includes('this.physicalCatalysts.handle(binding, event)'),
  'physical event flush no longer routes through Catalyst 2.x policy');
for (const method of ['handlePhysicalBinding','fireCollapse','appendBindingPath','trailAim','emitChoreography'])
  assert(!simulation.includes('private '+method+'('), 'Catalyst 2.x policy leaked back into Simulation: '+method);
for (const token of ['activationPending =','catalystBindings:','physicalEvents:','activationMeta ='])
  assert(!simulation.includes(token), 'physical lifecycle storage leaked back into Simulation: '+token);
assert(simulation.includes('private physical = new PhysicalLifecycle()'),
  'Simulation no longer delegates causal activation bookkeeping');
assert(phenomenonCastSystem.includes('export class PhenomenonCastSystem'),
  'Phenomenon cast behavior has no dedicated system');
assert(simulation.includes('private phenomenonCasts!: PhenomenonCastSystem'),
  'Simulation no longer delegates migrated Phenomenon casts');
assert(simulation.includes('this.phenomenonCasts.cast(id, st, slot, src)'),
  'dispatchSkill no longer routes through PhenomenonCastSystem');
assert(phenomenonKillReaction.includes('export class PhenomenonKillReactionSystem'),
  'Phenomenon-specific kill reactions have no dedicated owner');
assert(simulation.includes('private phenomenonKillReactions!: PhenomenonKillReactionSystem'),
  'Simulation no longer delegates Phenomenon kill reactions');
const genericDamageBlock=simulation.slice(
  simulation.indexOf('  private damage('),
  simulation.indexOf('  private damageHero(', simulation.indexOf('  private damage('))
);
assert(genericDamageBlock.includes('this.phenomenonKillReactions.onKill(e, source)'),
  'resolved kills no longer route through PhenomenonKillReactionSystem');
assert(!genericDamageBlock.includes('ember_backdraft') &&
       !genericDamageBlock.includes("source === 'ember_lance'"),
  'specific Phenomenon kill policy leaked back into Simulation.damage');
assert(statefulPhenomenonCastSystem.includes('export class StatefulPhenomenonCastSystem'),
  'stateful Phenomenon behavior has no dedicated cast family');
assert(simulation.includes('private statefulPhenomenonCasts!: StatefulPhenomenonCastSystem'),
  'Simulation no longer delegates stateful Phenomenon casts');
assert(simulation.includes('this.statefulPhenomenonCasts.cast(id, st, slot, src)'),
  'dispatchSkill no longer routes through the stateful Phenomenon family');
assert(choiceRuntime.includes('export class ChoiceRuntime'),
  'progression choice window has no dedicated runtime owner');
assert(simulation.includes('private choiceRuntime = new ChoiceRuntime()'),
  'Simulation no longer delegates progression choice state');
for (const field of [
  'rewardOffers: RewardOffer[]','mutationOffer: MutationOffer',
  'mutationRefusalToken =','choiceSerial =','pendingMutationTarget ='
])
  assert(!simulation.includes('private '+field),
    'raw progression choice state leaked back into Simulation: '+field);
assert(simulation.includes('return this.choiceRuntime.hasChoice'),
  'Simulation.hasChoice no longer reads the choice runtime');
for (const call of [
  'this.choiceRuntime.openRewards(','this.choiceRuntime.takeReward(index)',
  'this.choiceRuntime.openMutation(','this.choiceRuntime.closeMutation()',
  'this.choiceRuntime.beginMutationTarget()','this.choiceRuntime.consumeMutationTarget()',
  'this.choiceRuntime.replaceMutationChoice('
])
  assert(simulation.includes(call),
    'choice lifecycle no longer routes through ChoiceRuntime: '+call);
assert(!simulation.includes('this.choiceSerial++'),
  'choice serial policy leaked back into Simulation');
assert(choreographyTraceSystem.includes('export class ChoreographyTraceSystem'),
  'activation choreography has no dedicated trace owner');
assert(simulation.includes('private choreography = new ChoreographyTraceSystem()'),
  'Simulation no longer delegates choreography trace state');
assert(!simulation.includes('private currentChoreography:'),
  'mutable choreography trace storage leaked back into Simulation');
for (const method of ['sameChoreographyPoint','tracePoint','traceArea','traceSegment','traceCombatShape','beginChoreographyTrace','finishChoreographyTrace'])
  assert(!simulation.includes('private '+method+'('), 'choreography trace policy leaked back into Simulation: '+method);
assert(activationRuntime.includes('export class ActivationRuntime'),
  'Phenomenon activation transaction state has no dedicated owner');
assert(simulation.includes('private activation = new ActivationRuntime()'),
  'Simulation no longer delegates activation transaction state');
for (const field of [
  'currentHits','currentActivationDamage','currentActivationKills','currentActivationOverkill',
  'currentActivationControl','currentProducedState','currentSlot','activationScale',
  'activationCountBonus','activationDerived','lastContext','previousHits'
])
  assert(!simulation.includes('private '+field), 'activation state leaked back into Simulation: '+field);
assert(activationPipeline.includes('export class ActivationPipelineSystem'),
  'Phenomenon activation ordering has no dedicated coordinator');
assert(simulation.includes('private activationPipeline!: ActivationPipelineSystem'),
  'Simulation no longer delegates Phenomenon activation ordering');
assert(simulation.includes('this.activationPipeline.activate(this.beat)'),
  'chain clock no longer routes through ActivationPipelineSystem');
assert(simulation.includes('this.activationPipeline.castPayload(binding, x, z, aimX, aimZ)'),
  'physical Catalyst payload no longer routes through ActivationPipelineSystem');
assert(activationPipeline.includes('this.activation.begin(slot)'),
  'top-level slot activation no longer opens an ActivationRuntime frame');
assert(activationPipeline.includes('this.activation.suspend()') && activationPipeline.includes('this.activation.restore(activationFrame)'),
  'nested Catalyst payload no longer preserves the parent activation frame');
for (const method of ['activateSlot','castCatalystPayload','beginPhysicalActivation'])
  assert(!simulation.includes('private '+method+'('), 'activation orchestration leaked back into Simulation: '+method);
assert(combatTargeting.includes('export class CombatTargetingSystem'),
  'faction-aware combat targeting has no dedicated owner');
assert(simulation.includes('private combatTargeting!: CombatTargetingSystem'),
  'Simulation no longer delegates combat targeting');
for (const method of [
  ['targetsFor','this.combatTargeting.targetsFor(src)'],
  ['bestTarget','this.combatTargeting.bestTarget(src, predicate, compare)'],
  ['rayHits','this.combatTargeting.rayHits(src, ax, az, range, width, maxHits)'],
  ['rotatedAim','this.combatTargeting.rotatedAim(src, rad)'],
  ['targetVisible','this.combatTargeting.targetVisible(src, e)'],
  ['aimPoint','this.combatTargeting.aimPoint(src, range)']
] as const) {
  const start=simulation.indexOf('  private '+method[0]+'(');
  const next=simulation.indexOf('\n  private ', start + 3);
  const block=simulation.slice(start, next > start ? next : start + 700);
  assert(block.includes(method[1]),
    'combat targeting compatibility seam stopped delegating: '+method[0]);
}
for (const token of [
  'private hero: Ent = makeHeroEnt()','bestScore = 999','observerInside =',
  'this.hero.x = this.px'
])
  assert(!simulation.includes(token),
    'combat targeting policy leaked back into Simulation: '+token);
assert(simulation.includes('this.combatTargeting.isSyntheticHero(e)'),
  'rival damage routing no longer uses targeting-owned synthetic hero identity');
assert(combatLedger.includes('export class CombatLedger'),
  'diagnostic combat source accounting has no dedicated owner');
assert(simulation.includes('private combatLedger!: CombatLedger'),
  'Simulation no longer delegates combat source accounting');
assert(simulation.includes('this.combatLedger.recordEnemyHit(') &&
       simulation.includes('this.combatLedger.recordKill('),
  'resolved enemy combat no longer routes through CombatLedger');
assert(simulation.includes('...this.combatLedger.telemetry()'),
  'telemetry no longer reads source accounting from CombatLedger');
for (const field of [
  'directionalDamage','closeDamage','fieldDamage',
  'damageBySource','killsBySource','hitsBySource','damageToHeroBySource'
])
  assert(!simulation.includes('private '+field),
    'dead/diagnostic combat state leaked back into Simulation: '+field);
assert(!phenomenonCastSystem.includes('addCloseDamage') &&
       !statefulPhenomenonCastSystem.includes('addCloseDamage') &&
       !orbitSystem.includes('addCloseDamage'),
  'retired close-damage telemetry port returned');
assert(!fieldSystem.includes('addFieldDamage'),
  'retired field-damage telemetry port returned');
assert(enemyDamageModifier.includes('export class EnemyDamageModifierSystem'),
  'incoming enemy damage modifiers have no dedicated pipeline');
assert(simulation.includes('private enemyDamageModifiers!: EnemyDamageModifierSystem'),
  'Simulation no longer delegates incoming enemy damage modifiers');
const enemyDamageBlock=simulation.slice(
  simulation.indexOf('  private damage('),
  simulation.indexOf('  private damageHero(', simulation.indexOf('  private damage('))
);
assert(enemyDamageBlock.includes('this.enemyDamageModifiers.resolve('),
  'enemy damage no longer routes through EnemyDamageModifierSystem');
for (const token of [
  'itemDamageMul','itemEliteDamageMul','itemCrit',
  'relicDamageTakenMul','markUntil','linkedTo',
  'eliteDamageResponse.beforeDamage','eliteAffix.modifyIncomingDamage'
])
  assert(!enemyDamageBlock.includes(token),
    'incoming modifier policy leaked back into Simulation.damage: '+token);
assert(eliteEncounterLedger.includes('export class EliteEncounterLedger'),
  'elite encounter diagnostics have no dedicated storage owner');
assert(simulation.includes('private eliteEncountersLedger = new EliteEncounterLedger()'),
  'Simulation no longer delegates elite encounter storage');
assert(!simulation.includes('private eliteLog:') && !simulation.includes('private eliteLogById'),
  'raw elite encounter array/index leaked back into Simulation');
assert(simulation.includes('noteEncounterDash: (time) => this.eliteEncountersLedger.noteDash(time)') &&
       playerMovementSystem.includes('p.noteEncounterDash(p.time())'),
  'dash attribution no longer routes PlayerMovementSystem -> EliteEncounterLedger');
assert(simulation.includes('this.eliteEncountersLedger.noteRivalCast(entity.id, skill)'),
  'rival cast attribution no longer routes through EliteEncounterLedger');
assert(simulation.includes('this.eliteEncountersLedger.finish(entity.id, this.time, true)'),
  'elite death attribution no longer routes through EliteEncounterLedger');
assert(simulation.includes('this.eliteEncountersLedger.noteItem(e.id, r.item)'),
  'elite relic capture attribution no longer routes through EliteEncounterLedger');
assert(playerDamageSystem.includes('export class PlayerDamageSystem'),
  'resolved player damage has no dedicated owner');
assert(simulation.includes('private playerDamage!: PlayerDamageSystem'),
  'Simulation no longer delegates resolved player damage');
const hitPlayerBlock=simulation.slice(
  simulation.indexOf('  private hitPlayer('),
  simulation.indexOf('  private grantBarrier(', simulation.indexOf('  private hitPlayer('))
);
assert(hitPlayerBlock.includes('this.playerDamage.hit(amount, attacker, source)'),
  'hitPlayer compatibility entry no longer delegates to PlayerDamageSystem');
for (const token of [
  'dashIFramesUntil','dashWindowSaved','damageToHeroBySource',
  'itemDamageTakenMul','Math.pow(0.94','barrierDamage','PlayerHit'
])
  assert(!hitPlayerBlock.includes(token),
    'player mitigation policy leaked back into Simulation.hitPlayer: '+token);
const damageHeroBlock=simulation.slice(
  simulation.indexOf('  private damageHero('),
  simulation.indexOf('  private cleanup()', simulation.indexOf('  private damageHero('))
);
assert(damageHeroBlock.includes('this.playerDamage.damageFromRival('),
  'rival damage compatibility entry no longer delegates to PlayerDamageSystem');
for (const token of [
  'itemRefusalDamageMul','relicCritChance','relicCastMul',
  'groundRelicCastMul','relicSiphon','rivalAxisCount'
])
  assert(!damageHeroBlock.includes(token),
    'rival damage policy leaked back into Simulation.damageHero: '+token);
assert(playerMovementSystem.includes('export class PlayerMovementSystem'),
  'hero movement/dash runtime has no dedicated owner');
assert(simulation.includes('private playerMovement!: PlayerMovementSystem'),
  'Simulation no longer delegates hero movement runtime');
const stepBlock=simulation.slice(
  simulation.indexOf('  step(cmd: Command'),
  simulation.indexOf('  private designMinutes()', simulation.indexOf('  step(cmd: Command'))
);
assert(stepBlock.includes('this.playerMovement.update(cmd)'),
  'Simulation.step no longer delegates locomotion to PlayerMovementSystem');
for (const token of [
  'dashDirX','dashDirZ','DASH_SPEED','dashCooldownMul','dashIFrameMul',
  'this.playerVX =','this.playerVZ =','this.px +=','this.pz +='
])
  assert(!stepBlock.includes(token),
    'movement policy leaked back into Simulation.step: '+token);
for (const field of [
  'moveAmount','movementSamples','movementSum','dashDirX','dashDirZ'
])
  assert(!simulation.includes('private '+field),
    'retired/moved movement state leaked back into Simulation: '+field);
assert(simulation.includes('this.playerMovement.extendIFrames(this.time + duration)'),
  'Phenomenon-granted dash iframes no longer route through PlayerMovementSystem');
assert(simulation.includes('dashing: this.playerMovement.isDashing(this.time)') &&
       simulation.includes('dashReady: this.playerMovement.isDashReady(this.time)') &&
       simulation.includes('dashCharge: this.playerMovement.dashCharge(this.time)'),
  'snapshot duplicates dash runtime policy instead of reading PlayerMovementSystem');
for (const method of [
  'castBreachLine','castContactSaw','castBackhand','castSpreadingFront','castShardFan','castTetherDrag','castPinBurst',
  'castEmber','castFrost','castRail','castToxic',
  'castCleaver','castArc','castOrbit','castMortar','castSentry','castRepulse','castMassDriver'
])
  assert(!simulation.includes('private '+method+'('), 'Phenomenon cast leaked back into Simulation: '+method);
assert(delayedStrikeSystem.includes('export class DelayedStrikeSystem'), 'delayed impacts have no dedicated runtime system');
assert(simulation.includes('private delayedStrikeSystem!: DelayedStrikeSystem'),
  'Simulation no longer delegates delayed impacts');
const delayedUpdate=simulation.slice(
  simulation.indexOf('private updateDelayedStrikes()'),
  simulation.indexOf('private initPois(', simulation.indexOf('private updateDelayedStrikes()'))
);
assert(delayedUpdate.includes('this.delayedStrikeSystem.update(this.delayedStrikes)'),
  'Simulation updateDelayedStrikes is no longer a thin orchestration wrapper');
for (const token of ['areaPoints=[0,1,2,3]','fieldKind','_impact'])
  assert(!delayedUpdate.includes(token), 'delayed strike runtime leaked back into Simulation: '+token);

assert(progressionOfferSystem.includes('export class ProgressionOfferSystem'),
  'progression reward selection has no dedicated policy owner');
assert(simulation.includes('private progressionOffers!: ProgressionOfferSystem'),
  'Simulation no longer delegates progression offer selection');

assert(poiSystem.includes('export class PoiSystem'), 'world POIs have no dedicated owner');
assert(simulation.includes('private poiSystem!: PoiSystem'), 'Simulation no longer delegates POI lifecycle');
assert(worldGeometry.includes('export class WorldGeometrySystem'),
  'cover geometry/spatial queries have no dedicated owner');
assert(simulation.includes('private worldGeometry!: WorldGeometrySystem'),
  'Simulation no longer delegates world cover geometry');
assert(simulation.includes('private get obstacles(): Obstacle[] { return this.worldGeometry.all; }'),
  'Simulation obstacle compatibility view no longer delegates to WorldGeometrySystem');
assert(!simulation.includes('private obstacleGrid =') && !simulation.includes('private obstacleScratch:'),
  'cover spatial-index storage leaked back into Simulation');
for (const token of ['this.worldGeometry.initialize(this.pois)','this.worldGeometry.freeOf(','this.worldGeometry.lineOfSight(','this.worldGeometry.damageObstacle('])
  assert(simulation.includes(token), 'world geometry seam missing: '+token);
assert(simulation.includes('private get pois(): Poi[] { return this.poiSystem.all; }'),
  'Simulation POI compatibility view no longer delegates to PoiSystem');
const poiDirectorBlock=simulation.slice(
  simulation.indexOf('private updatePoiDirector()'),
  simulation.indexOf('private bossDirector()', simulation.indexOf('private updatePoiDirector()'))
);
assert(poiDirectorBlock.includes('this.poiSystem.update()') &&
       poiDirectorBlock.includes('return this.poiSystem.complete(id)'),
  'Simulation POI seams are no longer thin delegation');
for (const token of ["kind: 'phenomenon', x: 14","type: 'PoiAwakened'","type: 'PoiCleared'"])
  assert(!poiDirectorBlock.includes(token), 'POI lifecycle/policy leaked back into Simulation: '+token);
for (const method of [
  'generateDiscovery','generateLevelOffers','generateMutationTargetOffers','generateEliteCache'
]) {
  const start=simulation.indexOf('  private '+method+'(');
  const next=simulation.indexOf('\n  private ', start + 3);
  const block=simulation.slice(start, next > start ? next : start + 500);
  assert(block.includes('this.progressionOffers.'),
    'progression wrapper stopped delegating to ProgressionOfferSystem: '+method);
}
for (const token of [
  'private skillOrderUnowned(','private catalystOrderUnowned(',
  'this.shuffle([...doctrineOrder])','usefulUnowned =','preferred: DoctrineId[]'
])
  assert(!simulation.includes(token),
    'progression selection policy leaked back into Simulation: '+token);
assert(simulation.includes('this.progressionOffers.hasUnownedSkills()'),
  'Phenomenon POI no longer asks progression policy about discoveries');
assert(simulation.includes('this.progressionOffers.hasEvolvableSkill()'),
  'mutation-core progression no longer asks progression policy about eligibility');
assert(rewardOfferFactory.includes('export class RewardOfferFactory'),
  'player-facing reward cards have no dedicated factory');
assert(simulation.includes('private rewardOfferFactory!: RewardOfferFactory'),
  'Simulation no longer delegates reward card construction');
for (const call of [
  'this.factory.catalystAdd(id)',
  'this.factory.resonance(id)',
  'this.factory.skillAdd(id)',
  'this.factory.skillSwap(id)',
  'this.factory.doctrine(id)',
  'this.factory.global()',
  'this.factory.mutationTarget(',
  'this.factory.eliteCatalyst(id)',
  'this.factory.eliteResonance(id)',
  'this.factory.eliteSkill(id)'
])
  assert(progressionOfferSystem.includes(call),
    'progression selection no longer delegates card construction to RewardOfferFactory: '+call);
for (const method of [
  'fmtSkillStat','axisLabel','statLabel','rollRarity','rollItemId',
  'makeResonanceOffer','makeGlobalOffer','makeCatalystAdd',
  'makeDoctrineOffer','makeItemOffer','makeSkillAdd','makeSkillSwap'
])
  assert(!simulation.includes('private '+method+'('),
    'reward presentation/dead formatter leaked back into Simulation: '+method);
assert(relicRace.includes('export class RelicRaceSystem'), 'contested relics have no dedicated runtime owner');
assert(simulation.includes('private relicRace!: RelicRaceSystem'), 'Simulation no longer delegates relic race runtime');
const relicUpdate=simulation.slice(
  simulation.indexOf('private updateRelics()'),
  simulation.indexOf('private spawnRelic(', simulation.indexOf('private updateRelics()'))
);
assert(relicUpdate.includes('this.relicRace.update()'), 'Simulation updateRelics is no longer a thin wrapper');
assert(!simulation.includes('private relics: Relic[] =') && !simulation.includes('private relicAcc = 0'),
  'ground relic state/cadence leaked back into Simulation');
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
assert(eliteEcho.includes('export class EliteEchoSystem'), 'refused Phenomenon Echoes have no dedicated state owner');
assert(simulation.includes('private eliteEchoSystem!: EliteEchoSystem'), 'Simulation no longer delegates Elite Echo runtime');
assert(!simulation.includes('private eliteEchoes =') && !simulation.includes('private rivalCastAt ='),
  'Elite Echo state/cooldown storage leaked back into Simulation');
for (const method of ['echoTellDuration','echoTelegraph','resolveEliteEcho'])
  assert(!simulation.includes('private '+method+'('), 'Elite Echo authored state machine leaked back into Simulation: '+method);
assert(simulation.includes('this.eliteEchoSystem.update()'), 'Simulation no longer advances Elite Echo owner');
assert(eliteSpawnSystem.includes('export class EliteSpawnSystem'),
  'elite/boss construction has no dedicated owner');
assert(simulation.includes('private eliteSpawns!: EliteSpawnSystem'),
  'Simulation no longer delegates elite/boss construction');
for (const method of [
  ['spawnElite','this.eliteSpawns.spawnRegular(opening)'],
  ['rollEliteRarity','this.eliteSpawns.rollRarity()'],
  ['rollEliteAffix','this.eliteSpawns.rollAffix(rarity)'],
  ['bossSupportForPoi','this.eliteSpawns.supportIdentity(kind)'],
  ['spawnBossSupport','this.eliteSpawns.spawnBossSupport(kind, bossX, bossZ, index)']
] as const) {
  const start=simulation.indexOf('  private '+method[0]+'(');
  const next=simulation.indexOf('\n  private ', start + 3);
  const block=simulation.slice(start, next > start ? next : start + 500);
  assert(block.includes(method[1]),
    'elite spawn compatibility seam stopped delegating: '+method[0]);
}
const spawnBossStart=simulation.indexOf('  private spawnBoss()');
const spawnBossNext=simulation.indexOf('\n  private ', spawnBossStart + 3);
const spawnBossBlock=simulation.slice(spawnBossStart, spawnBossNext > spawnBossStart ? spawnBossNext : spawnBossStart + 500);
assert(spawnBossBlock.includes('this.bossSpawned = true') &&
       spawnBossBlock.includes('this.eliteSpawns.spawnBoss()'),
  'boss spawn compatibility seam changed ownership/order');
for (const token of [
  'ELITE_RARITY_HP','ELITE_RARITY_SIZE','const eliteHp:','const eliteSpeed:','const eliteDps:',
  '0.02 + 0.18 * t','0.58 - t * 0.18','const pool: EliteChassis[]'
])
  assert(!simulation.includes(token),
    'elite spawn policy leaked back into Simulation: '+token);
assert(eliteProgression.includes('export class EliteProgressionSystem'), 'elite ecosystem growth has no dedicated system');
assert(simulation.includes('private eliteProgression!: EliteProgressionSystem'),
  'Simulation no longer delegates elite progression policy');
for (const method of ['scaleEliteDurability','eliteInheritanceBudget','nativeEliteGrowthBudget','claimOneMoreRefusal'])
  assert(!simulation.includes('private '+method+'('), 'elite progression policy leaked back into Simulation: '+method);
for (const token of ["case 'plating':","case 'keen_edge':","case 'reprisal':"])
  assert(!simulation.includes(token), 'enemy-side item policy leaked back into Simulation: '+token);
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
assert(enemyRecycleSystem.includes('export class EnemyRecycleSystem'),
  'enemy reacquisition has no dedicated owner');
assert(simulation.includes('private enemyRecycler!: EnemyRecycleSystem'),
  'Simulation no longer delegates enemy reacquisition');
const recycleBlock=simulation.slice(
  simulation.indexOf('  private recycleFarEnemies()'),
  simulation.indexOf('\n  step(cmd: Command', simulation.indexOf('  private recycleFarEnemies()'))
);
assert(recycleBlock.includes('this.enemyRecycler.update()'),
  'recycleFarEnemies compatibility seam no longer delegates');
for (const token of [
  'private recycleAcc =','d > 29','e.boss ? 38 : 33',
  'pointAroundPlayer(e.boss ? 11 : 12'
])
  assert(!simulation.includes(token),
    'enemy recycle policy leaked back into Simulation: '+token);
assert(enemySpawnSystem.includes('export class EnemySpawnSystem'),
  'ordinary enemy construction has no dedicated owner');
assert(simulation.includes('private enemySpawns!: EnemySpawnSystem'),
  'Simulation no longer delegates ordinary enemy construction');
const spawnEnemyBlock=simulation.slice(
  simulation.indexOf('  private spawnEnemy('),
  simulation.indexOf('  private eliteDirector()', simulation.indexOf('  private spawnEnemy('))
);
assert(spawnEnemyBlock.includes('this.enemySpawns.spawn(kind)') &&
       spawnEnemyBlock.includes('this.enemySpawns.spawnAt(kind, x, z, buffedFor, cloneParent)'),
  'normal spawn compatibility entries no longer delegate to EnemySpawnSystem');
for (const token of [
  'const baseHp:','normalCount >= 198',"kind === 'bookmark' ? 1.32",
  "kind === 'palimpsest' ? 1 : 0"
])
  assert(!simulation.includes(token),
    'ordinary enemy construction policy leaked back into Simulation: '+token);
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
assert(eliteDamageResponse.includes('entity.shepherdMode') && eliteDamageResponse.includes('entity.prismMemory'),
  'elite-specific adaptation state is not separated from boss attack state');
assert(eliteDamageResponse.includes('export class EliteDamageResponseSystem'),
  'reactive elite damage rules have no dedicated owner');
assert(simulation.includes('private eliteDamageResponse!: EliteDamageResponseSystem'),
  'Simulation no longer delegates reactive elite damage rules');
assert(enemyDamageModifier.includes('this.eliteDamage.beforeDamage(') &&
       simulation.includes('this.eliteDamageResponse.noteResolvedDamage('),
  'enemy damage no longer routes through EliteDamageResponseSystem');
assert(!simulation.includes('private damageSamples:'),
  'Shepherd damage signature storage leaked back into Simulation');
assert(eliteAffix.includes('modifyIncomingDamage(') && eliteAffix.includes('afterCloseDamage('),
  'shield damage semantics are no longer owned by EliteAffixSystem');
assert(enemyDamageModifier.includes('this.affixDamage.modifyIncomingDamage(') &&
       simulation.includes('this.eliteAffix.afterCloseDamage('),
  'shielded damage no longer routes through EliteAffixSystem');

assert(eliteUi.includes('export const eliteChassisUi'), 'elite presentation metadata has no single catalogue');
assert(!ui.includes('const chassisName: Record'), 'platform duplicated chassis metadata again');
assert(ui.includes("from '../content/eliteUi.js'"), 'platform does not consume elite metadata catalogue');

assert(ui.includes('let frameSnapshot: Snapshot | null = null'), 'render frame no longer reuses post-tick snapshot');
assert(ui.includes('function updateDebugState(s: Snapshot)'), 'debug UI serializes its own Snapshot again');
assert(!ui.includes('function updateDebugState() {\n  const s = sim.snapshot()'),
  'hidden debug state performs a duplicate snapshot');

console.log('architecture-regression OK', {
  stateModule:true,
  canonicalStateSerializer:true,
  snapshotBuilder:true,
  typedCombatIds:true,
  separatedEliteAdaptation:true,
  sharedEliteMetadata:true,
  frameSnapshotReuse:true,
  physicalLifecycleOwner:true,
  physicalCatalystSystem:true,
  physicalActivationSystem:true,
  projectileSystem:true,
  phenomenonCastSystem:true,
  phenomenonKillReactionSystem:true,
  statefulPhenomenonCastSystem:true,
  choreographyTraceSystem:true,
  choiceRuntime:true,
  activationRuntime:true,
  activationPipelineSystem:true,
  combatLedger:true,
  combatTargetingSystem:true,
  relicRaceSystem:true,
  rewardOfferFactory:true,
  progressionOfferSystem:true,
  poiSystem:true,
  worldGeometrySystem:true,
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
  eliteDamageResponseSystem:true,
  eliteEchoSystem:true,
  eliteEncounterLedger:true,
  eliteProgressionSystem:true,
  eliteSpawnSystem:true,
  eliteAffixSystem:true,
  bossBehaviorSystem:true,
  enemyBehaviorSystem:true,
  enemySpawnSystem:true,
  enemyRecycleSystem:true,
  enemyDamageModifierSystem:true,
  playerDamageSystem:true,
  playerMovementSystem:true,
  statusSystem:true,
  entityComponents:true,
  typedTestHarness:true
});
