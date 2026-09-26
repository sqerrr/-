import {
  activeSkillOrder,
  catalysts,
  catalystPairCompatible,
  doctrines,
  effectGrammar,
  initialCatalystReserve,
  initialCatalysts,
  initialSkillReserve,
  initialSlots,
  mutationDef,
  mutationRoots,
  mutationChildren,
  resonance,
  skills,
  statBase
} from '../content/definitions.js';
import { ActivationPipelineSystem } from './activationPipelineSystem.js';
import { ActivationRuntime } from './activationRuntime.js';
import { BossBehaviorSystem } from './bossBehaviorSystem.js';
import {
  CANONICAL_SCHEMA_VERSION as CANONICAL_RUN_SCHEMA_VERSION,
  CanonicalStateSerializer,
  type CanonicalStateInput
} from './canonicalStateSerializer.js';
import { ConstructSystem } from './constructSystem.js';
import { SnapshotBuilder, type SnapshotBuilderInput } from './snapshotBuilder.js';
import { ChoreographyTraceSystem } from './choreographyTraceSystem.js';
import { ChoiceRuntime } from './choiceRuntime.js';
import { CombatLedger } from './combatLedger.js';
import { CombatTargetingSystem } from './combatTargetingSystem.js';
import { DeathResolutionSystem } from './deathResolutionSystem.js';
import { DelayedStrikeSystem } from './delayedStrikeSystem.js';
import { EncounterDirector } from './encounterDirector.js';
import { EliteAffixSystem } from './eliteAffixSystem.js';
import { EliteBehaviorSystem } from './eliteBehaviorSystem.js';
import { EliteDamageResponseSystem } from './eliteDamageResponseSystem.js';
import { EliteEchoSystem } from './eliteEchoSystem.js';
import { EliteEncounterLedger } from './eliteEncounterLedger.js';
import { EliteProgressionSystem } from './eliteProgressionSystem.js';
import { EliteSpawnSystem } from './eliteSpawnSystem.js';
import { EnemyBehaviorSystem } from './enemyBehaviorSystem.js';
import { EnemySpawnSystem } from './enemySpawnSystem.js';
import { EnemyRecycleSystem } from './enemyRecycleSystem.js';
import { EnemyDamageModifierSystem } from './enemyDamageModifierSystem.js';
import { EntityStore } from './entityStore.js';
import { FieldSystem } from './fieldSystem.js';
import { LegacyCatalystSystem } from './legacyCatalystSystem.js';
import { OrbitSystem } from './orbitSystem.js';
import { PhysicalActivationSystem } from './physicalActivationSystem.js';
import { PhysicalCatalystSystem } from './physicalCatalystSystem.js';
import { PhysicalLifecycle } from './physicalLifecycle.js';
import { PhenomenonCastSystem } from './phenomenonCastSystem.js';
import { PhenomenonKillReactionSystem } from './phenomenonKillReactionSystem.js';
import { PlayerDamageSystem } from './playerDamageSystem.js';
import { PoiSystem } from './poiSystem.js';
import { PlayerMovementSystem } from './playerMovementSystem.js';
import { ProjectileSystem } from './projectileSystem.js';
import { ProgressionOfferSystem } from './progressionOfferSystem.js';
import { RelicRaceSystem } from './relicRaceSystem.js';
import { RewardOfferFactory } from './rewardOfferFactory.js';
import { RefusalLedger } from './refusalLedger.js';
import { Rng } from './rng.js';
import { SquadDirector } from './squadDirector.js';
import { StatefulPhenomenonCastSystem } from './statefulPhenomenonCastSystem.js';
import { StatusSystem } from './statusSystem.js';
import { WorldGeometrySystem } from './worldGeometrySystem.js';
import { circleIntersectsCircle, closestPointOnSegment, combatShapeIntersectsCircle } from './geometry.js';
import {
  HERO_HIT_RADIUS,
  makeEnt,
  type CastFaction,
  type CastSource,
  type ChoreographyCarrier,
  type ChoreographyPoint,
  type Construct,
  type DelayedStrike,
  type Ent,
  type Field,
  type Obstacle,
  type PhysicalEvent,
  type Pickup,
  type Poi,
  type Projectile,
  type Relic
} from './state.js';
import { items, itemRivalEffect } from '../content/items.js';
import type {
  ItemId,
  BossPatternId,
  DamageSourceId,
  EliteActionId,
  DoctrineId,
  DoctrineRuntime,
  CatalystId,
  CatalystRuntime,
  CombatShape,
  Command,
  EliteAffix,
  EliteChassis,
  EliteEncounter,
  EliteRarity,
  EnemyKind,
  GameEvent,
  Metrics,
  MutationId,
  PoiKind,
  PoiState,
  RefusedCard,
  ResonanceId,
  ResonanceRuntime,
  RewardOffer,
  RunMode,
  SkillId,
  SkillRuntime,
  Snapshot
} from './types.js';

export interface SimConfig {
  seed: number;
  hz: 30 | 60;
  runDuration?: number;
  benchmark?: boolean;
  mode?: RunMode;
  startingSkill?: SkillId;
}
export interface BenchmarkLoadout {
  slots: SkillId[];
  catalysts: CatalystId[];
  mutations?: Partial<Record<SkillId, MutationId>>;
  mutationUpgrades?: Partial<Record<SkillId, MutationId>>;
  mutationApotheoses?: Partial<Record<SkillId, MutationId>>;
  level?: number;
  globalPower?: number;
  tempo?: number;
  armor?: number;
  maxHp?: number;
  moveSpeed?: number;
  pickupRadius?: number;
  fortune?: number;
  skillPower?: number;
  skillCoverage?: number;
  skillRange?: number;
  skillDuration?: number;
  skillControl?: number;
  skillStatus?: number;
  skillElite?: number;
  catalystPotency?: number;
}

export class Simulation {
  readonly hz: number;
  readonly dt: number;
  readonly events: GameEvent[] = [];
  readonly metrics: Metrics = {
    spawned: 0,
    killed: 0,
    eliteSpawned: 0,
    eliteKilled: 0,
    damage: 0,
    eliteDamage: 0,
    activations: 0,
    levels: 0,
    mutations: 0,
    healsPicked: 0,
    relicsTakenByHero: 0,
    relicsTakenByElites: 0,
    damageTaken: 0,
    healingReceived: 0,
    barrierGenerated: 0,
    reactions: 0,
    maxEnemies: 0,
    enemyCountSum: 0,
    enemySamples: 0,
    rivalCasts: 0,
    dashes: 0,
    dashIFrameSaves: 0
  };
  readonly runDuration: number;
  readonly mode: RunMode;
  private benchmark = false;
  tick = 0;
  finished = false;
  px = 0;
  pz = 0;
  php = 180;
  maxHp = 180;
  barrier = 0;
  armor = 0;
  moveSpeed = 4.8;
  globalPower = 0;
  pickupRadius = 8.5;
  tempo = 0.08;
  fortune = 0.08;
  aimX = 1;
  aimZ = -1;
  level = 1;
  xp = 0;
  xpNeed = 14;
  eliteCore = 0;
  mutationCores = 0;
  rerolls = 1;
  beat = 0;
  cycle = 0;
  slots: (SkillId | null)[] = [...initialSlots];
  catalysts: (CatalystId | null)[] = [...initialCatalysts];
  skillReserve: (SkillId | null)[] = [...initialSkillReserve];
  catalystReserve: (CatalystId | null)[] = [...initialCatalystReserve];
  resonance: ResonanceRuntime = {
    tempo: 0,
    multiplicity: 0,
    precision: 0,
    persistence: 0,
    conductivity: 0,
    mobility: 0
  };
  doctrines: DoctrineRuntime = {
    might: 0,
    size: 0,
    quantity: 0,
    duration: 0,
    mobility: 0,
    guard: 0,
    force: 0,
    precision: 0
  };
  private rng: Rng;
  private encounterDirector!: EncounterDirector;
  private eliteBehavior!: EliteBehaviorSystem;
  private eliteDamageResponse!: EliteDamageResponseSystem;
  private eliteEchoSystem!: EliteEchoSystem;
  private eliteProgression!: EliteProgressionSystem;
  private eliteSpawns!: EliteSpawnSystem;
  private eliteAffix!: EliteAffixSystem;
  private bossBehavior!: BossBehaviorSystem;
  private enemyBehavior!: EnemyBehaviorSystem;
  private enemySpawns!: EnemySpawnSystem;
  private enemyRecycler!: EnemyRecycleSystem;
  private enemyDamageModifiers!: EnemyDamageModifierSystem;
  private worldGeometry!: WorldGeometrySystem;
  private squadDirector!: SquadDirector;
  private projectileSystem!: ProjectileSystem;
  private fieldSystem!: FieldSystem;
  private constructSystem!: ConstructSystem;
  private combatLedger!: CombatLedger;
  private combatTargeting!: CombatTargetingSystem;
  private legacyCatalysts!: LegacyCatalystSystem;
  private orbitSystem!: OrbitSystem;
  private deathResolution!: DeathResolutionSystem;
  private delayedStrikeSystem!: DelayedStrikeSystem;
  private physicalActivations!: PhysicalActivationSystem;
  private canonicalSerializer = new CanonicalStateSerializer();
  private snapshotBuilder = new SnapshotBuilder();
  private activationPipeline!: ActivationPipelineSystem;
  private physicalCatalysts!: PhysicalCatalystSystem;
  private relicRace!: RelicRaceSystem;
  private rewardOfferFactory!: RewardOfferFactory;
  private progressionOffers!: ProgressionOfferSystem;
  private poiSystem!: PoiSystem;
  private phenomenonCasts!: PhenomenonCastSystem;
  private phenomenonKillReactions!: PhenomenonKillReactionSystem;
  private playerDamage!: PlayerDamageSystem;
  private playerMovement!: PlayerMovementSystem;
  private statefulPhenomenonCasts!: StatefulPhenomenonCastSystem;
  private nextId = 1;
  private entityStore = new EntityStore();
  /** Compatibility view for deterministic iteration and legacy regression fixtures. */
  private get ents(): Ent[] { return this.entityStore.all; }
  private set ents(value: Ent[]) { this.entityStore.replace(value); }
  private pickups: Pickup[] = [];
  /** Compatibility view; ground relic ownership lives in RelicRaceSystem. */
  private get relics(): Relic[] { return this.relicRace.all; }
  private set relics(value: Relic[]) { this.relicRace.replace(value); }
  private get relicAcc(): number { return this.relicRace.accumulatorValue; }
  private set relicAcc(value: number) { this.relicRace.accumulatorValue = value; }
  private relicRng!: Rng;
  /**
   * Items physically captured by elites become knowledge of the enemy ecosystem.
   * Later elites inherit a sample; the final Warden inherits the whole history.
   */
  private eliteLegacyItems: ItemId[] = [];
  /** Autonomous enemy growth is a separate history from physically contested relic captures. */
  private eliteEvolutionHistory: ItemId[] = [];
  /** Everything the hero has picked up, in the order it was taken. No slots, by D14. */
  heldItems: ItemId[] = [];
  private itemDamageMul = 1;
  private itemCrit = 0;
  private itemSiphon = 0;
  private itemEliteDamageMul = 1;
  private itemDamageTakenMul = 1;
  private itemRefusalDamageMul = 1;
  private itemBarrierOnEliteKill = 0;
  private itemXpMul = 1;
  private itemCoreBonus = 0;
  private itemRelicRateMul = 1;
  private dashCooldownMul = 1;
  private dashIFrameMul = 1;
  // D34 asked for twenty or more relics across a run of roughly eight minutes.
  static readonly RELIC_INTERVAL = RelicRaceSystem.INTERVAL;
  static readonly RELIC_REACH = RelicRaceSystem.HERO_REACH;
  static readonly RELIC_ELITE_REACH = RelicRaceSystem.ELITE_REACH;
  private fields: Field[] = [];
  private constructs: Construct[] = [];
  private projectiles: Projectile[] = [];
  private delayedStrikes: DelayedStrike[] = [];
  private readonly world = { minX: -48, maxX: 48, minZ: -36, maxZ: 36 };
  // D20 asks for a semi-open arena: islands of blockers, never corridors and never
  // an empty field. Circles cluster into organic islands and give free sliding, which
  // boxes would not. Laid out from a stream of its own so the roll cannot shift combat.
  /** Compatibility view; obstacle ownership and spatial indexing live in WorldGeometrySystem. */
  private get obstacles(): Obstacle[] { return this.worldGeometry.all; }
  private set obstacles(value: Obstacle[]) { this.worldGeometry.replace(value); }
  private worldRng!: Rng;
  private static readonly OBSTACLE_CELL = WorldGeometrySystem.OBSTACLE_CELL;
  static readonly HERO_BODY_RADIUS = 0.42;
  /** Compatibility view; POI ownership lives in PoiSystem. */
  private get pois(): Poi[] { return this.poiSystem.all; }
  private set pois(value: Poi[]) { this.poiSystem.replace(value); }
  private bossSpawned = false;
  private bossDefeated = false;
  private skillsRuntime = new Map<SkillId, SkillRuntime>();
  private catalystRuntime = new Map<CatalystId, CatalystRuntime>();
  private beatAcc = 0;
  /**
   * Compatibility aliases keep public tuning/tests stable while PlayerMovementSystem owns
   * dash timing and velocity state.
   */
  static readonly DASH_SPEED = PlayerMovementSystem.DASH_SPEED;
  static readonly DASH_DURATION = PlayerMovementSystem.DASH_DURATION;
  static readonly DASH_IFRAMES = PlayerMovementSystem.DASH_IFRAMES;
  static readonly DASH_COOLDOWN = PlayerMovementSystem.DASH_COOLDOWN;
  private get dashUntil() { return this.playerMovement.dashUntil; }
  private set dashUntil(value: number) { this.playerMovement.dashUntil = value; }
  private get dashIFramesUntil() { return this.playerMovement.dashIFramesUntil; }
  private set dashIFramesUntil(value: number) { this.playerMovement.dashIFramesUntil = value; }
  private get dashReadyAt() { return this.playerMovement.dashReadyAt; }
  private set dashReadyAt(value: number) { this.playerMovement.dashReadyAt = value; }
  private get dashWindowSaved() { return this.playerMovement.dashWindowSaved; }
  private set dashWindowSaved(value: boolean) { this.playerMovement.dashWindowSaved = value; }
  private get playerVX() { return this.playerMovement.vx; }
  private set playerVX(value: number) { this.playerMovement.vx = value; }
  private get playerVZ() { return this.playerMovement.vz; }
  private set playerVZ(value: number) { this.playerMovement.vz = value; }
  private charge = 0;
  private butcherStacks = 0;
  private activation = new ActivationRuntime();
  private capacitorCharge = 0;
  private capacitorConsumed = false;
  private overflowCharge = 0;
  private overflowConsumed = false;
  private aegisCharge = 0;
  private backflowBonus = new Map<number, number>();
  private choreography = new ChoreographyTraceSystem();
  // Catalyst 2.1 lifecycle owns activation ids, causal queues and retirement bookkeeping.
  private physical = new PhysicalLifecycle();
  private statusSystem = new StatusSystem();
  private orbitChoreoUntil = -1;
  private orbitChoreoX = 0;
  private orbitChoreoZ = 0;
  private orbitChoreoCarrier: ChoreographyCarrier | null = null;
  private choiceRuntime = new ChoiceRuntime();
  // Compatibility accessors keep deterministic tooling/private fixtures stable while the
  // transient choice window is owned by ChoiceRuntime.
  private get rewardOffers() { return this.choiceRuntime.rewardOffers; }
  private set rewardOffers(value) { this.choiceRuntime.rewardOffers = value; }
  private get mutationOffer() { return this.choiceRuntime.mutationOffer; }
  private set mutationOffer(value) { this.choiceRuntime.mutationOffer = value; }
  private get mutationRefusalToken() { return this.choiceRuntime.mutationRefusalToken; }
  private set mutationRefusalToken(value: boolean) { this.choiceRuntime.mutationRefusalToken = value; }
  private get choiceSerial() { return this.choiceRuntime.serial; }
  private set choiceSerial(value: number) { this.choiceRuntime.serial = value; }
  private get pendingMutationTarget() { return this.choiceRuntime.pendingMutationTarget; }
  private set pendingMutationTarget(value: boolean) { this.choiceRuntime.pendingMutationTarget = value; }

  private refusalLedger!: RefusalLedger;
  /** Compatibility view for systems/snapshots that consume the live refusal records. */
  private get refusalStore() { return this.refusalLedger.all(); }
  /** All rival capability now comes from effectGrammar; there is no code-side allowlist. */
  /**
   * How far a phenomenon actually reaches from whoever owns it. Ranged work carries
   * baseRange, while a ring or a sweep carries only baseRadius and does nothing at all
   * from across the field. Without this an elite cheerfully swings a 2.35-unit cleaver
   * from twelve units away, which is exactly what the telemetry caught it doing.
   */
  /**
   * D41/v0.11: a declined Phenomenon never calls the hero dispatcher from an elite.
   * The refusal preserves fantasy/identity but is translated to an authored duel pattern
   * with tell -> active -> recovery in EliteEchoSystem. effectGrammar remains
   * useful for ownership/LOS/reach data; it is not an excuse to mirror player geometry.
   */
  /** D28: a phenomenon forks three ways. */
  static readonly MUTATION_BRANCHES = 3;
  private static rivalReach(id: SkillId): number {
    const def = skills[id];
    return Math.max(def.baseRange ?? 0, def.baseRadius ?? 0);
  }
  /**
   * Distance inside which an elite counts as being in the fight for telemetry. Set just past
   * the reach of the longest phenomenon, so the measure tracks time the hero could actually
   * be hitting it. Diagnostic only - nothing in the simulation branches on this.
   */
  private eliteEncountersLedger = new EliteEncounterLedger();
  /** Held only for the length of a rival cast, so its damage can be charged to its owner. */
  private castOwner: Ent | null = null;
  private castRivalConcentration = 1;

  constructor(cfg: SimConfig) {
    this.hz = cfg.hz;
    this.dt = 1 / cfg.hz;
    this.rng = new Rng(cfg.seed);
    this.encounterDirector = new EncounterDirector(this.rng);
    const refusalRng = new Rng((cfg.seed ^ 0x5bf03635) >>> 0);
    this.refusalLedger = new RefusalLedger((maxExclusive) => refusalRng.int(maxExclusive));
    this.worldRng = new Rng((cfg.seed ^ 0x27d4eb2f) >>> 0);
    this.relicRng = new Rng((cfg.seed ^ 0x6a09e667) >>> 0);
    this.worldGeometry = new WorldGeometrySystem(this.world, {
      worldRandomRange: (min, max) => this.worldRng.range(min, max),
      worldRandomInt: (maxExclusive) => this.worldRng.int(maxExclusive),
      spawnRandomRange: (min, max) => this.rng.range(min, max),
      playerX: () => this.px,
      playerZ: () => this.pz
    });
    this.runDuration = cfg.runDuration ?? 480;
    this.enemySpawns = new EnemySpawnSystem({
      time: () => this.time,
      randomRange: (min, max) => this.rng.range(min, max),
      worldScale: () => this.worldScale(),
      damageScale: () => this.damageScale(),
      populationTarget: () => this.populationTarget(),
      normalCount: () => this.entityStore.countAlive((entity) => entity.kind !== 'elite'),
      nextEntityId: () => this.nextId++,
      pointAroundPlayer: (min, max) => this.pointAroundPlayer(min, max),
      addEntity: (entity) => this.entityStore.add(entity),
      onSpawn: (entity) => {
        this.metrics.spawned++;
        this.events.push({
          type: 'EntitySpawned',
          tick: this.tick,
          entity: entity.id,
          kind: entity.kind,
          x: entity.x,
          z: entity.z
        });
      }
    });
    this.enemyRecycler = new EnemyRecycleSystem({
      dt: () => this.dt,
      playerX: () => this.px,
      playerZ: () => this.pz,
      entities: () => this.ents,
      pointAroundPlayer: (min, max) => this.pointAroundPlayer(min, max),
      emitEliteReacquired: (entity) => {
        this.events.push({
          type: 'EliteReacquired',
          tick: this.tick,
          entity: entity.id,
          x: entity.x,
          z: entity.z
        });
      }
    });
    this.eliteSpawns = new EliteSpawnSystem({
      time: () => this.time,
      runDuration: () => this.runDuration,
      mode: () => this.mode,
      playerX: () => this.px,
      playerZ: () => this.pz,
      worldBounds: () => this.world,
      randomInt: (maxExclusive) => this.rng.int(maxExclusive),
      randomFloat: () => this.rng.float(),
      randomRange: (min, max) => this.rng.range(min, max),
      worldScale: () => this.worldScale(),
      damageScale: () => this.damageScale(),
      nextEntityId: () => this.nextId++,
      pointAroundPlayer: (min, max) => this.pointAroundPlayer(min, max),
      claimRepertoire: (entity) => this.claimRepertoire(entity),
      inheritLegacy: (entity, all) => this.inheritEliteLegacy(entity, all),
      inheritEvolution: (entity) => this.inheritEliteEvolution(entity),
      grantNativeGrowth: (entity) => this.grantNativeEliteGrowth(entity),
      ecosystemMass: () => this.eliteLegacyItems.length + this.eliteEvolutionHistory.length,
      pois: () => this.pois,
      activePoiGuardians: () =>
        this.entityStore.countAlive(
          (entity) => entity.kind === 'elite' && !entity.boss && entity.guardianPoi > 0
        ),
      commitElite: (entity, options) => {
        if (options.trackEncounter) this.noteEliteSpawn(entity);
        this.entityStore.add(entity);
        this.metrics.spawned++;
        this.metrics.eliteSpawned++;
        this.events.push({
          type: 'EntitySpawned',
          tick: this.tick,
          entity: entity.id,
          kind: 'elite',
          x: entity.x,
          z: entity.z,
          chassis: entity.chassis,
          affix: entity.affix,
          ...(options.bossEvent ? { boss: true } : {})
        });
      },
      emitBossSpawned: (entity, supports, uncleared) => {
        this.events.push({
          type: 'BossSpawned',
          tick: this.tick,
          entity: entity.id,
          x: entity.x,
          z: entity.z,
          supports,
          uncleared
        });
      }
    });
    this.rewardOfferFactory = new RewardOfferFactory({
      randomInt: (maxExclusive) => this.rng.int(maxExclusive),
      randomFloat: () => this.rng.float(),
      nextU32: () => this.rng.nextU32(),
      fortune: () => this.fortune,
      resonanceLevel: (id) => this.resonance[id],
      doctrineLevel: (id) => this.doctrines[id],
      slots: () => this.slots,
      catalystCompatibleEdges: (id) => this.catalystCompatibleEdges(id)
    });
    this.progressionOffers = new ProgressionOfferSystem(
      {
        randomInt: (maxExclusive) => this.rng.int(maxExclusive),
        randomFloat: () => this.rng.float(),
        refusalInt: (maxExclusive) => this.refusalLedger.pickIndex(maxExclusive),
        slots: () => this.slots,
        skillReserve: () => this.skillReserve,
        catalysts: () => this.catalysts,
        catalystReserve: () => this.catalystReserve,
        skillState: (id) => this.skillState(id),
        mutationCores: () => this.mutationCores,
        catalystCompatibleEdges: (id) => this.catalystCompatibleEdges(id)
      },
      this.rewardOfferFactory
    );
    this.poiSystem = new PoiSystem({
      tick: () => this.tick,
      bossSpawned: () => this.bossSpawned,
      playerX: () => this.px,
      playerZ: () => this.pz,
      maxHp: () => this.maxHp,
      hasChoice: () => this.choiceRuntime.hasChoice,
      hasUnownedSkills: () => this.progressionOffers.hasUnownedSkills(),
      emit: (event) => this.events.push(event),
      healPlayer: (amount) => this.healPlayer(amount),
      grantBarrier: (amount) => this.grantBarrier(amount),
      openPhenomenonDiscovery: () =>
        this.choiceRuntime.openRewards(this.progressionOffers.discovery()),
      openCatalystDiscovery: () =>
        this.choiceRuntime.openRewards(this.progressionOffers.catalystDiscovery()),
      openResonanceChoice: () =>
        this.choiceRuntime.openRewards(this.progressionOffers.resonanceChoice())
    });
    this.playerMovement = new PlayerMovementSystem({
      time: () => this.time,
      dt: () => this.dt,
      playerX: () => this.px,
      playerZ: () => this.pz,
      setPlayerPosition: (x, z) => {
        this.px = x;
        this.pz = z;
      },
      aimX: () => this.aimX,
      aimZ: () => this.aimZ,
      moveSpeed: () => this.moveSpeed,
      dashCooldownMultiplier: () => this.dashCooldownMul,
      dashIFrameMultiplier: () => this.dashIFrameMul,
      metrics: () => this.metrics,
      noteEncounterDash: (time) => this.eliteEncountersLedger.noteDash(time),
      clampWorld: () => this.clampWorld()
    });
    this.combatLedger = new CombatLedger({
      time: () => this.time,
      metrics: () => this.metrics,
      eliteEncounter: (entityId) => this.eliteEncountersLedger.get(entityId),
      slotIndex: (skill) => this.slots.indexOf(skill)
    });
    this.combatTargeting = new CombatTargetingSystem({
      entities: () => this.ents,
      fields: () => this.fields,
      player: () => ({
        x: this.px,
        z: this.pz,
        hp: this.php,
        maxHp: this.maxHp,
        facingX: this.aimX,
        facingZ: this.aimZ
      }),
      lineOfSight: (ax, az, bx, bz, margin) =>
        this.lineOfSight(ax, az, bx, bz, margin)
    });
    this.eliteProgression = new EliteProgressionSystem({
      time: () => this.time,
      runDuration: () => this.runDuration,
      refusalStore: () => this.refusalStore,
      legacyItems: () => this.eliteLegacyItems,
      evolutionHistory: () => this.eliteEvolutionHistory,
      mainRandomInt: (maxExclusive) => this.rng.int(maxExclusive),
      relicRandomInt: (maxExclusive) => this.relicRng.int(maxExclusive)
    });
    this.eliteEchoSystem = new EliteEchoSystem({
      time: () => this.time,
      tick: () => this.tick,
      playerX: () => this.px,
      playerZ: () => this.pz,
      playerVX: () => this.playerVX,
      playerVZ: () => this.playerVZ,
      entityById: (id) => this.entityStore.getAlive(id),
      refusalStore: () => this.refusalStore,
      randomRange: (min, max) => this.rng.range(min, max),
      randomInt: (maxExclusive) => this.rng.int(maxExclusive),
      axisCount: (entity, axis) => this.eliteProgression.rivalAxisCount(entity, axis),
      patternCooldown: (base, entity) => this.elitePatternCooldown(base, entity),
      lineOfSight: (x0, z0, x1, z1, radius) =>
        this.lineOfSight(x0, z0, x1, z1, radius),
      damageScale: () => this.damageScale(),
      damageHero: (amount, source, owner, concentration) =>
        this.damageHero(amount, source, owner, concentration),
      combatShape: (source, shape, intent = 'damage') =>
        this.combatShape(source, shape, intent),
      scheduleStrike: (strike) => this.scheduleStrike(strike),
      addField: (field) => this.fields.push({ id: this.nextId++, ...field }),
      spawnProjectile: (projectile) => { this.spawnProjectile(projectile); },
      movePlayer: (dx, dz) => {
        this.px += dx;
        this.pz += dz;
        this.clampWorld();
      },
      emit: (event) => this.events.push(event),
      noteRivalCast: (entity, skill) => {
        this.metrics.rivalCasts++;
        this.eliteEncountersLedger.noteRivalCast(entity.id, skill);
      }
    });
    this.relicRace = new RelicRaceSystem({
      world: this.world,
      dt: () => this.dt,
      time: () => this.time,
      tick: () => this.tick,
      playerX: () => this.px,
      playerZ: () => this.pz,
      relicRateMultiplier: () => this.itemRelicRateMul,
      entities: () => this.ents,
      hasEcho: (entityId) => this.eliteEchoSystem.has(entityId),
      blocked: (x, z, radius) => this.blocked(x, z, radius),
      steerTo: (entity, x, z, speed, multiplier = 1) =>
        this.steerTo(entity, x, z, speed, multiplier),
      randomFloat: () => this.relicRng.float(),
      randomInt: (maxExclusive) => this.relicRng.int(maxExclusive),
      nextId: () => this.nextId++,
      onHeroClaim: (relic) => this.takeRelic(relic),
      onEliteClaim: (entity, relic) => this.giveEliteRelic(entity, relic),
      emitAppeared: (relic, name) =>
        this.events.push({
          type: 'RelicAppeared',
          tick: this.tick,
          item: relic.item,
          name,
          x: relic.x,
          z: relic.z
        })
    });
    this.eliteBehavior = new EliteBehaviorSystem({
      runDuration: this.runDuration,
      world: this.world,
      time: () => this.time,
      tick: () => this.tick,
      dt: () => this.dt,
      playerX: () => this.px,
      playerZ: () => this.pz,
      playerVX: () => this.playerVX,
      playerVZ: () => this.playerVZ,
      hasEcho: (entityId) => this.eliteEchoSystem.has(entityId),
      noteContact: (entity, distance) => this.noteEliteContact(entity, distance),
      fieldRefusals: (entity, distance) => this.fieldRefusals(entity, distance),
      steerTo: (entity, x, z, speed, multiplier = 1) =>
        this.steerTo(entity, x, z, speed, multiplier),
      freeOf: (x, z, radius) => this.freeOf(x, z, radius),
      addField: (field) => this.fields.push({ id: this.nextId++, ...field }),
      emitCombatShape: (source, shape, intent = 'damage') =>
        this.events.push({ type: 'CombatShape', tick: this.tick, source, intent, shape }),
      combatShape: (source, shape, intent = 'damage') => this.combatShape(source, shape, intent),
      emitOrder: (entity, order) =>
        this.events.push({
          type: 'EliteOrder',
          tick: this.tick,
          entity: entity.id,
          order,
          x: entity.x,
          z: entity.z
        }),
      hitPlayer: (amount, attacker, source) => this.hitPlayer(amount, attacker, source),
      damageScale: () => this.damageScale(),
      spawnReplicant: (entity) => this.spawnReplicant(entity),
      playerInSector: (x, z, ax, az, radius, halfAngle) =>
        this.playerInSector(x, z, ax, az, radius, halfAngle),
      movePlayer: (dx, dz) => {
        this.px += dx;
        this.pz += dz;
        this.clampWorld();
      },
      entities: () => this.ents
    });
    this.bossBehavior = new BossBehaviorSystem({
      world: this.world,
      time: () => this.time,
      tick: () => this.tick,
      dt: () => this.dt,
      playerX: () => this.px,
      playerZ: () => this.pz,
      playerVX: () => this.playerVX,
      playerVZ: () => this.playerVZ,
      hasEcho: (entityId) => this.eliteEchoSystem.has(entityId),
      fieldRefusals: (entity, distance) => this.fieldRefusals(entity, distance),
      steerTo: (entity, x, z, speed, multiplier = 1) =>
        this.steerTo(entity, x, z, speed, multiplier),
      playerInSector: (x, z, ax, az, radius, halfAngle) =>
        this.playerInSector(x, z, ax, az, radius, halfAngle),
      playerInRay: (x, z, ax, az, range, halfWidth) =>
        this.playerInRay(x, z, ax, az, range, halfWidth),
      hitPlayer: (amount, attacker, source) => this.hitPlayer(amount, attacker, source),
      damageScale: () => this.damageScale(),
      addField: (field) => this.fields.push({ id: this.nextId++, ...field }),
      spawnEnemyAt: (kind, x, z, buffedFor = 0) => {
        this.spawnEnemyAt(kind, x, z, buffedFor);
      },
      randomFloat: () => this.rng.float(),
      randomRange: (min, max) => this.rng.range(min, max),
      emitPhase: (entity, phase) =>
        this.events.push({
          type: 'BossPhase',
          tick: this.tick,
          entity: entity.id,
          phase,
          x: entity.x,
          z: entity.z
        }),
      emitTelegraph: (source, shape) =>
        this.events.push({ type: 'CombatShape', tick: this.tick, source, intent: 'damage', shape }),
      emitPattern: (entity, pattern) =>
        this.events.push({
          type: 'BossPattern',
          tick: this.tick,
          entity: entity.id,
          pattern,
          x: entity.x,
          z: entity.z
        })
    });
    this.enemyBehavior = new EnemyBehaviorSystem({
      time: () => this.time,
      dt: () => this.dt,
      playerX: () => this.px,
      playerZ: () => this.pz,
      playerVX: () => this.playerVX,
      playerVZ: () => this.playerVZ,
      steerTo: (entity, x, z, speed, multiplier = 1) =>
        this.steerTo(entity, x, z, speed, multiplier),
      lineOfSight: (x0, z0, x1, z1, radius) =>
        this.lineOfSight(x0, z0, x1, z1, radius),
      getAliveEntity: (id) => this.entityStore.getAlive(id),
      entities: () => this.ents,
      fields: () => this.fields,
      addField: (field) => this.fields.push({ id: this.nextId++, ...field }),
      randomRange: (min, max) => this.rng.range(min, max),
      damageScale: () => this.damageScale()
    });
    this.eliteAffix = new EliteAffixSystem({
      world: this.world,
      time: () => this.time,
      dt: () => this.dt,
      tick: () => this.tick,
      playerX: () => this.px,
      playerZ: () => this.pz,
      playerVX: () => this.playerVX,
      playerVZ: () => this.playerVZ,
      hasEcho: (entityId) => this.eliteEchoSystem.has(entityId),
      entities: () => this.ents,
      randomRange: (min, max) => this.rng.range(min, max),
      spawnEnemyAt: (kind, x, z, buffedFor = 0) => {
        this.spawnEnemyAt(kind, x, z, buffedFor);
      },
      emitOrder: (entity, order, count) =>
        this.events.push({
          type: 'EliteOrder',
          tick: this.tick,
          entity: entity.id,
          order,
          x: entity.x,
          z: entity.z,
          ...(count === undefined ? {} : { count })
        }),
      emitTemporalTell: (entity) =>
        this.events.push({
          type: 'CombatShape',
          tick: this.tick,
          source: 'telegraph_temporal_shift',
          intent: 'control',
          shape: { kind: 'circle', x: entity.lockedX, z: entity.lockedZ, radius: 1.8 }
        }),
      emitShieldTell: (entity, aimX, aimZ) =>
        this.events.push({
          type: 'CombatShape',
          tick: this.tick,
          source: 'shield_commit',
          intent: 'control',
          shape: { kind: 'sector', x: entity.x, z: entity.z, radius: 3.4, aimX, aimZ, halfAngle: 0.72 }
        }),
      emitRareEvent: (title, detail, x, z) =>
        this.events.push({ type: 'RareEvent', tick: this.tick, title, detail, x, z }),
      hitPlayer: (amount, attacker, source) => this.hitPlayer(amount, attacker, source),
      damageScale: () => this.damageScale()
    });
    this.eliteDamageResponse = new EliteDamageResponseSystem({
      time: () => this.time,
      conductivity: () => this.resonance.conductivity,
      corePower: () => this.corePower(),
      spawnReplicant: (entity) => this.spawnReplicant(entity),
      emitOrder: (entity, order, count) =>
        this.events.push({
          type: 'EliteOrder',
          tick: this.tick,
          entity: entity.id,
          order,
          x: entity.x,
          z: entity.z,
          ...(count === undefined ? {} : { count })
        })
    });
    this.enemyDamageModifiers = new EnemyDamageModifierSystem(
      {
        time: () => this.time,
        itemDamageMultiplier: () => this.itemDamageMul,
        itemEliteDamageMultiplier: () => this.itemEliteDamageMul,
        itemCritBonus: () => this.itemCrit,
        doctrinePrecision: () => this.doctrines.precision,
        resonancePrecision: () => this.resonance.precision,
        supportsPrecision: (skill) => this.supportsAxis(skill, 'precision'),
        randomFloat: () => this.rng.float(),
        skillRuntime: (source) => this.skillsRuntime.get(source as SkillId),
        getAliveEntity: (id) => this.entityStore.getAlive(id),
        derived: () => this.activation.derived
      },
      this.eliteDamageResponse,
      this.eliteAffix
    );
    this.phenomenonKillReactions = new PhenomenonKillReactionSystem({
      entities: () => this.ents,
      globalPower: () => this.globalPower,
      hasMutation: (skill, mutation) => {
        const runtime = this.skillsRuntime.get(skill);
        return !!runtime && this.mutationIs(runtime, mutation);
      },
      damage: (target, amount, source, sourceX, sourceZ) => {
        this.damage(target, amount, source, false, sourceX, sourceZ);
      }
    });
    this.playerDamage = new PlayerDamageSystem({
      time: () => this.time,
      tick: () => this.tick,
      playerX: () => this.px,
      playerZ: () => this.pz,
      playerHp: () => this.php,
      setPlayerHp: (value) => {
        this.php = value;
      },
      barrier: () => this.barrier,
      setBarrier: (value) => {
        this.barrier = value;
      },
      armor: () => this.armor,
      guardDoctrine: () => this.doctrines.guard,
      itemDamageTakenMultiplier: () => this.itemDamageTakenMul,
      itemRefusalDamageMultiplier: () => this.itemRefusalDamageMul,
      dashIFramesUntil: () => this.dashIFramesUntil,
      dashWindowSaved: () => this.dashWindowSaved,
      setDashWindowSaved: (value) => {
        this.dashWindowSaved = value;
      },
      metrics: () => this.metrics,
      entities: () => this.ents,
      eliteEncounter: (entityId) => this.eliteEncountersLedger.get(entityId),
      randomFloat: () => this.rng.float(),
      rivalAxisCount: (entity, axis) => this.rivalAxisCount(entity, axis),
      emit: (event) => this.events.push(event)
    });
    this.squadDirector = new SquadDirector({
      world: this.world,
      time: () => this.time,
      playerX: () => this.px,
      playerZ: () => this.pz,
      playerVX: () => this.playerVX,
      playerVZ: () => this.playerVZ,
      aimX: () => this.aimX,
      aimZ: () => this.aimZ,
      entities: () => this.ents,
      obstacles: () => this.obstacles,
      freeOf: (x, z, radius) => this.freeOf(x, z, radius)
    });
    this.projectileSystem = new ProjectileSystem({
      world: this.world,
      dt: () => this.dt,
      time: () => this.time,
      tick: () => this.tick,
      heroX: () => this.px,
      heroZ: () => this.pz,
      finishAsyncPhysical: (activationId, x, z) => this.finishAsyncPhysical(activationId, x, z),
      queuePhysicalEvent: (event) => this.queuePhysicalEvent(event),
      scheduleStrike: (strike) => this.scheduleStrike(strike),
      addField: (field) => this.fields.push({ id: this.nextId++, ...field }),
      projectileOwner: (projectile) => this.projectileOwner(projectile),
      hasMutation: (skill, mutation) => {
        const runtime = this.skillsRuntime.get(skill);
        return !!runtime && this.mutationIs(runtime, mutation);
      },
      gainAegisCharge: () => {
        this.aegisCharge = Math.min(12, this.aegisCharge + 1);
      },
      emitReaction: (reaction, x, z, amount) =>
        this.events.push({ type: 'Reaction', tick: this.tick, reaction, x, z, amount }),
      obstaclesNear: (x, z, radius) => this.worldGeometry.nearShared(x, z, radius),
      targetsFor: (projectile, x, z) => {
        const owner = projectile.faction === 'rival' ? this.projectileOwner(projectile) : null;
        const source: CastSource = {
          faction: projectile.faction,
          owner,
          x,
          z,
          aimX: projectile.vx,
          aimZ: projectile.vz,
          vx: projectile.vx,
          vz: projectile.vz
        };
        return this.targetsFor(source);
      },
      damageObstacle: (obstacle, amount) => this.damageObstacle(obstacle, amount),
      damageTarget: (target, amount, source, x, z, sourceSlot) => {
        this.damage(target, amount, source, true, x, z, sourceSlot);
      },
      applyFanBurn: (target) => {
        target.igniteUntil = Math.max(target.igniteUntil, this.time + 2.6 * this.memoryFactor());
        this.noteState('ignite');
      },
      forceDoctrine: () => this.doctrines.force,
      damageHero: (amount, source, owner, concentration) => {
        this.damageHero(amount, source, owner, concentration);
      }
    });
    this.fieldSystem = new FieldSystem({
      dt: () => this.dt,
      time: () => this.time,
      heroX: () => this.px,
      heroZ: () => this.pz,
      ownerById: (id) => this.entityStore.get(id) ?? null,
      bestAlive: (compare) => this.entityStore.bestAlive(compare),
      entities: () => this.ents,
      hitPlayer: (amount, owner) => this.hitPlayer(amount, owner),
      damageHero: (amount, source, owner, concentration) => {
        this.damageHero(amount, source, owner, concentration);
      },
      damageTarget: (target, amount, source, x, z, sourceSlot) => {
        this.damage(target, amount, source, false, x, z, sourceSlot);
      },
      memoryFactor: () => this.memoryFactor(),
      queuePhysicalEvent: (event) => this.queuePhysicalEvent(event)
    });
    this.constructSystem = new ConstructSystem({
      dt: () => this.dt,
      time: () => this.time,
      heroX: () => this.px,
      heroZ: () => this.pz,
      ownerById: (id) => this.entityStore.get(id) ?? null,
      entities: () => this.ents,
      targetsFor: (construct) => {
        const owner = construct.ownerId ? this.entityStore.get(construct.ownerId) ?? null : null;
        const source: CastSource = {
          faction: construct.faction,
          owner,
          x: construct.x,
          z: construct.z,
          aimX: 1,
          aimZ: 0,
          vx: 0,
          vz: 0
        };
        return this.targetsFor(source);
      },
      targetVisible: (construct, target) => {
        const owner = construct.ownerId ? this.entityStore.get(construct.ownerId) ?? null : null;
        const source: CastSource = {
          faction: construct.faction,
          owner,
          x: construct.x,
          z: construct.z,
          aimX: 1,
          aimZ: 0,
          vx: 0,
          vz: 0
        };
        return this.targetVisible(source, target);
      },
      damageTarget: (construct, target, amount, x, z) => {
        const previousOwner = this.castOwner;
        const previousConcentration = this.castRivalConcentration;
        if (construct.faction === 'rival') {
          this.castOwner = construct.ownerId ? this.entityStore.get(construct.ownerId) ?? null : null;
          this.castRivalConcentration = construct.rivalConcentration;
        }
        try {
          this.damage(target, amount, 'sentry', true, x, z, construct.sourceSlot);
        } finally {
          this.castOwner = previousOwner;
          this.castRivalConcentration = previousConcentration;
        }
      },
      combatShape: (source, shape, intent = 'damage') => this.combatShape(source, shape, intent),
      queuePhysicalEvent: (event) => this.queuePhysicalEvent(event),
      finishAsyncPhysical: (activationId, x, z) => this.finishAsyncPhysical(activationId, x, z),
      scheduleStrike: (strike) => this.scheduleStrike(strike),
      memoryFactor: () => this.memoryFactor(),
      corePower: () => this.corePower(),
      grantBarrier: (amount) => this.grantBarrier(amount)
    });
    this.legacyCatalysts = new LegacyCatalystSystem({
      time: () => this.time,
      tick: () => this.tick,
      playerX: () => this.px,
      playerZ: () => this.pz,
      movePlayer: (dx, dz) => {
        this.px += dx;
        this.pz += dz;
        this.clampWorld();
      },
      getAliveEntity: (id) => this.entityStore.getAlive(id),
      entities: () => this.ents,
      skillAt: (slot) => this.slots[slot] ?? null,
      skillRuntime: (id) => this.skillsRuntime.get(id),
      applyState: (entity, state, potency) => this.applyState(entity, state, potency),
      healPlayer: (amount) => this.healPlayer(amount),
      grantBarrier: (amount) => this.grantBarrier(amount),
      damageEcho: (entity, amount, x, z) =>
        this.activation.withDerived({}, () =>
          this.damage(entity, amount, 'echo', false, x, z)
        ),
      castDerived: (skill, runtime, slot, scale) =>
        this.activation.withDerived({ slot, scale }, () =>
          this.castWithTrace(skill, runtime, slot, this.heroSource())
        ),
      noteReaction: () => {
        this.metrics.reactions++;
      },
      emitReaction: (reaction, x, z, amount) =>
        this.events.push({
          type: 'Reaction',
          tick: this.tick,
          reaction,
          x,
          z,
          ...(amount === undefined ? {} : { amount })
        }),
      emitCatalystTriggered: (catalyst, fromSlot, toSlot, sourceX, sourceZ, targetX, targetZ) =>
        this.events.push({
          type: 'CatalystTriggered',
          tick: this.tick,
          catalyst,
          fromSlot,
          toSlot,
          sourceX,
          sourceZ,
          targetX,
          targetZ
        })
    });
    this.orbitSystem = new OrbitSystem({
      time: () => this.time,
      tick: () => this.tick,
      heroX: () => this.px,
      heroZ: () => this.pz,
      entities: () => this.ents,
      countAlive: (predicate) => this.entityStore.countAlive(predicate),
      bestAlive: (compare) => this.entityStore.bestAlive(compare),
      powerBucket: (runtime) => this.powerBucket(runtime),
      skillRadius: (runtime, base) => this.skillRadius(runtime, base),
      hasMutation: (runtime, mutation) => this.mutationIs(runtime, mutation),
      multiplicity: () =>
        this.supportsAxis('orbit_blades', 'multiplicity') ? this.resonance.multiplicity : 0,
      quantityDoctrine: () => this.doctrines.quantity,
      orbitActivationId: () => this.physical.orbitActivationId,
      retireOrbitActivation: (x, z) => {
        const activationId = this.physical.orbitActivationId;
        this.physical.orbitActivationId = 0;
        if (activationId) this.finishAsyncPhysical(activationId, x, z);
      },
      queuePhysicalEvent: (event) => this.queuePhysicalEvent(event),
      damageTarget: (target, amount, x, z, slot) =>
        this.damage(target, amount, 'orbit_blades', false, x, z, slot),
      grantBarrier: (amount) => this.grantBarrier(amount),
      aegisCharge: () => this.aegisCharge,
      clearAegisCharge: () => {
        this.aegisCharge = 0;
      },
      combatShape: (source, shape, intent = 'damage') => this.combatShape(source, shape, intent),
      emitRareEvent: (title, detail, x, z) =>
        this.events.push({ type: 'RareEvent', tick: this.tick, title, detail, x, z }),
      spawnProjectile: (projectile) => {
        this.spawnProjectile(projectile);
      }
    });
    this.deathResolution = new DeathResolutionSystem({
      time: () => this.time,
      tick: () => this.tick,
      mode: () => this.mode,
      entities: () => this.ents,
      clearForRevive: (entity) => this.statusSystem.clearForRevive(entity),
      hasMutation: (skill, mutation) => {
        const runtime = this.skillsRuntime.get(skill);
        return !!runtime && this.mutationIs(runtime, mutation);
      },
      memoryFactor: () => this.memoryFactor(),
      noteKill: (elite) => {
        this.metrics.killed++;
        if (elite) this.metrics.eliteKilled++;
      },
      resolveEliteDeath: (entity) => {
        this.releaseRepertoire(entity);
        this.grantBarrier(this.itemBarrierOnEliteKill);
        this.eliteCore += this.itemCoreBonus;
        this.eliteEncountersLedger.finish(entity.id, this.time, true);
      },
      emit: (event) => this.events.push(event),
      markBossDefeated: () => {
        this.bossDefeated = true;
      },
      getAliveEntity: (id) => this.entityStore.getAlive(id),
      addField: (field) => this.fields.push({ id: this.nextId++, ...field }),
      scheduleStrike: (strike) => this.scheduleStrike(strike),
      addPickup: (pickup) => this.pickups.push({ id: this.nextId++, ...pickup }),
      damageScale: () => this.damageScale(),
      xpMultiplier: () => this.itemXpMul,
      ownedCatalystCount: () => this.allOwnedCatalysts().length,
      completePoi: (id) => this.completePoi(id),
      randomFloat: () => this.rng.float()
    });
    this.delayedStrikeSystem = new DelayedStrikeSystem({
      time: () => this.time,
      tick: () => this.tick,
      heroX: () => this.px,
      heroZ: () => this.pz,
      ownerById: (id) => this.entityStore.get(id) ?? null,
      entities: () => this.ents,
      emitImpactShape: (source, intent, shape) =>
        this.events.push({ type: 'CombatShape', tick: this.tick, source, intent, shape }),
      queuePhysicalEvent: (event) => this.queuePhysicalEvent(event),
      damageHero: (amount, source, owner) => this.damageHero(amount, source, owner, 1),
      damageTarget: (target, amount, source, x, z, sourceSlot) =>
        this.damage(target, amount, source, false, x, z, sourceSlot),
      addField: (field) => this.fields.push({ id: this.nextId++, ...field }),
      finishAsyncPhysical: (activationId, x, z) => this.finishAsyncPhysical(activationId, x, z)
    });
    this.physicalCatalysts = new PhysicalCatalystSystem({
      time: () => this.time,
      tick: () => this.tick,
      aimX: () => this.aimX,
      aimZ: () => this.aimZ,
      entities: () => this.ents,
      castPayload: (binding, x, z, aimX, aimZ) =>
        this.activationPipeline.castPayload(binding, x, z, aimX, aimZ),
      emit: (event) => this.events.push(event),
      noteReaction: () => {
        this.metrics.reactions++;
      }
    });
    this.physicalActivations = new PhysicalActivationSystem({
      catalystAt: (slot) => this.catalysts[slot] ?? null,
      skillAt: (slot) => this.slots[slot] ?? null,
      addBinding: (binding) => this.physical.addBinding(binding),
      queueEvent: (event) => this.physical.queue(event)
    });
    this.activationPipeline = new ActivationPipelineSystem(
      {
        activeSpan: () => this.activeSpan(),
        skillAt: (slot) => this.slots[slot] ?? null,
        skillRuntime: (skill) => this.skillsRuntime.get(skill),
        incomingCatalyst: (slot) => this.incomingCatalyst(slot),
        conductivity: () => this.resonance.conductivity,
        playerPosition: () => ({ x: this.px, z: this.pz }),
        aim: () => ({ x: this.aimX, z: this.aimZ }),
        setAim: (x, z) => {
          this.aimX = x;
          this.aimZ = z;
        },
        heroSource: () => this.heroSource(),
        choreographySource: (x, z, aimX, aimZ) =>
          this.choreographySource(x, z, aimX, aimZ),
        entityPosition: (id) => {
          const entity = this.entityStore.get(id);
          return entity ? { x: entity.x, z: entity.z } : null;
        },
        castWithTrace: (skill, runtime, slot, source) =>
          this.castWithTrace(skill, runtime, slot, source),
        prepareOrbitPayload: (x, z) => this.setOrbitChoreography(x, z),
        noteActivation: () => {
          this.metrics.activations++;
        },
        flushPhysicalEvents: () => this.flushPhysicalEvents()
      },
      this.activation,
      this.choreography,
      this.physical,
      this.physicalActivations,
      this.legacyCatalysts
    );
    this.phenomenonCasts = new PhenomenonCastSystem({
      time: () => this.time,
      cycle: () => this.cycle,
      skillRadius: (runtime, base, slot) => this.skillRadius(runtime, base, slot),
      skillRange: (runtime, base) => this.skillRange(runtime, base),
      persistentDuration: (runtime, base, slot) => this.persistentDuration(runtime, base, slot),
      powerBucket: (runtime) => this.powerBucket(runtime),
      slotAmp: (slot, target) => this.slotAmp(slot, target),
      memoryFactor: () => this.memoryFactor(),
      mutationIs: (runtime, mutation) => this.mutationIs(runtime, mutation),
      projectileCount: (runtime, slot) => this.projectileCount(runtime, slot),
      combatShape: (source, shape, intent = 'damage', physicalTrace = true) =>
        this.combatShape(source, shape, intent, physicalTrace),
      targetsFor: (source) => this.targetsFor(source),
      bestTarget: (source, predicate, compare) => this.bestTarget(source, predicate, compare),
      targetVisible: (source, target) => this.targetVisible(source, target),
      aimPoint: (source, range) => this.aimPoint(source, range),
      rotatedAim: (source, radians) => this.rotatedAim(source, radians),
      rayHits: (source, aimX, aimZ, range, width, maxHits = 99) =>
        this.rayHits(source, aimX, aimZ, range, width, maxHits),
      firstBlockingObstacleHit: (x0, z0, x1, z1, padding = 0.08) => {
        const hit = this.firstBlockingObstacleHit(x0, z0, x1, z1, padding);
        return hit ? { t: hit.t } : null;
      },
      damage: (target, amount, source, directional, sourceX, sourceZ, sourceSlot) =>
        this.damage(target, amount, source, directional, sourceX, sourceZ, sourceSlot),
      spawnProjectile: (projectile) => {
        this.spawnProjectile(projectile);
      },
      scheduleStrike: (strike) => this.scheduleStrike(strike),
      addField: (field) => this.fields.push({ id: this.nextId++, ...field }),
      addActivationControl: (amount) => this.activation.addControl(amount),
      noteState: (state) => this.noteState(state),
      noteReaction: () => {
        this.metrics.reactions++;
      },
      emitReaction: (reaction, x, z, amount) =>
        this.events.push({ type: 'Reaction', tick: this.tick, reaction, x, z, amount }),
      emitRareEvent: (title, detail, x, z) =>
        this.events.push({ type: 'RareEvent', tick: this.tick, title, detail, x, z }),
      grantBarrier: (amount) => this.grantBarrier(amount),
      doctrineForce: () => this.doctrines.force
    });
    this.statefulPhenomenonCasts = new StatefulPhenomenonCastSystem({
      time: () => this.time,
      cycle: () => this.cycle,
      skillRadius: (runtime, base, slot) => this.skillRadius(runtime, base, slot),
      skillRange: (runtime, base) => this.skillRange(runtime, base),
      persistentDuration: (runtime, base, slot) => this.persistentDuration(runtime, base, slot),
      powerBucket: (runtime) => this.powerBucket(runtime),
      slotAmp: (slot, target) => this.slotAmp(slot, target),
      memoryFactor: () => this.memoryFactor(),
      mutationIs: (runtime, mutation) => this.mutationIs(runtime, mutation),
      projectileCount: (runtime, slot) => this.projectileCount(runtime, slot),
      combatShape: (source, shape, intent = 'damage', physicalTrace = true) =>
        this.combatShape(source, shape, intent, physicalTrace),
      targetsFor: (source) => this.targetsFor(source),
      bestTarget: (source, predicate, compare) => this.bestTarget(source, predicate, compare),
      targetVisible: (source, target) => this.targetVisible(source, target),
      aimPoint: (source, range) => this.aimPoint(source, range),
      rotatedAim: (source, radians) => this.rotatedAim(source, radians),
      rayHits: (source, aimX, aimZ, range, width, maxHits = 99) =>
        this.rayHits(source, aimX, aimZ, range, width, maxHits),
      firstBlockingObstacleHit: (x0, z0, x1, z1, padding = 0.08) => {
        const hit = this.firstBlockingObstacleHit(x0, z0, x1, z1, padding);
        return hit ? { t: hit.t } : null;
      },
      damage: (target, amount, source, directional, sourceX, sourceZ, sourceSlot) =>
        this.damage(target, amount, source, directional, sourceX, sourceZ, sourceSlot),
      spawnProjectile: (projectile) => {
        this.spawnProjectile(projectile);
      },
      scheduleStrike: (strike) => this.scheduleStrike(strike),
      addField: (field) => this.fields.push({ id: this.nextId++, ...field }),
      addActivationControl: (amount) => this.activation.addControl(amount),
      noteState: (state) => this.noteState(state),
      noteReaction: () => {
        this.metrics.reactions++;
      },
      emitReaction: (reaction, x, z, amount) =>
        this.events.push({ type: 'Reaction', tick: this.tick, reaction, x, z, amount }),
      emitRareEvent: (title, detail, x, z) =>
        this.events.push({ type: 'RareEvent', tick: this.tick, title, detail, x, z }),
      grantBarrier: (amount) => this.grantBarrier(amount),
      doctrineForce: () => this.doctrines.force,

      resonanceMultiplicity: () => this.resonance.multiplicity,
      doctrineQuantity: () => this.doctrines.quantity,
      activationCountBonus: () => this.activation.countBonus,
      mutationCountAdd: (runtime) => this.mutationContinuation(runtime)?.countAdd ?? 0,
      multiplicityFor: (runtime) =>
        this.supportsAxis(runtime.id, 'multiplicity') ? this.resonance.multiplicity : 0,

      butcherStacks: () => this.butcherStacks,
      setButcherStacks: (value) => {
        this.butcherStacks = value;
      },
      randomFloat: () => this.rng.float(),
      randomRange: (min, max) => this.rng.range(min, max),

      constructs: () => this.constructs,
      nearestEntity: (x, z, predicate, maxDistance) =>
        this.entityStore.nearest(x, z, predicate, maxDistance),

      prepareOrbitActivation: (source) => {
        if (source.faction !== 'hero') return;
        if (
          this.physical.orbitActivationId &&
          this.physical.orbitActivationId !== this.physical.currentActivationId
        ) {
          const oldCenter = this.orbitCenter();
          this.finishAsyncPhysical(
            this.physical.orbitActivationId,
            oldCenter.x,
            oldCenter.z
          );
        }
        if (
          this.physical.currentActivationId &&
          this.physical.orbitActivationId !== this.physical.currentActivationId
        )
          this.registerAsyncPhysical(this.physical.currentActivationId);
        this.physical.orbitActivationId = this.physical.currentActivationId;
      },

      freeOf: (x, z, radius) => this.freeOf(x, z, radius),
      currentPhysicalActivationId: () => this.physical.currentActivationId,
      addSentryConstruct: (construct) => {
        const id = this.nextId++;
        this.constructs.push({ id, ...construct });
        if (construct.activationId) this.registerAsyncPhysical(construct.activationId);
        if (construct.faction === 'hero')
          this.choreography.addCarrier({ kind: 'construct', id });
        this.events.push({
          type: 'ConstructSpawned',
          tick: this.tick,
          skill: 'sentry',
          x: construct.x,
          z: construct.z
        });
        return id;
      },
      trimConstructs: (max) => {
        while (this.constructs.length > max) {
          const removed = this.constructs.shift();
          if (removed?.activationId)
            this.finishAsyncPhysical(removed.activationId, removed.x, removed.z);
        }
      },

      charge: () => this.charge,
      setCharge: (value) => {
        this.charge = value;
      },

      cargoCount: (source, range) => {
        let cargo = 0;
        for (const construct of this.constructs) {
          const dx = construct.x - source.x,
            dz = construct.z - source.z,
            along = dx * source.aimX + dz * source.aimZ,
            lateral = Math.abs(dx * source.aimZ - dz * source.aimX);
          if (along > 0 && along < range && lateral < 1.5) cargo++;
        }
        for (const pickup of this.pickups) {
          const dx = pickup.x - source.x,
            dz = pickup.z - source.z,
            along = dx * source.aimX + dz * source.aimZ,
            lateral = Math.abs(dx * source.aimZ - dz * source.aimX);
          if (along > 0 && along < range && lateral < 1.1) cargo++;
        }
        return cargo;
      },
      displaceSource: (source, dx, dz) => this.displaceSource(source, dx, dz),
      grantHeroDashIFrames: (duration) => {
        this.playerMovement.extendIFrames(this.time + duration);
      }
    });
    this.benchmark = !!cfg.benchmark;
    this.mode = cfg.mode ?? 'clean';
    if (this.mode === 'clean') {
      const start = activeSkillOrder.includes(cfg.startingSkill as SkillId)
        ? (cfg.startingSkill as SkillId)
        : 'cleaver';
      this.slots = [start, null, null, null];
      this.catalysts = [null, null, null];
      this.skillReserve = [null];
      this.catalystReserve = [null, null];
      this.tempo = 0;
      this.globalPower = 0;
      this.fortune = 0;
    }
    for (const id of [...this.slots, ...this.skillReserve])
      if (id && !this.skillsRuntime.has(id)) this.skillsRuntime.set(id, this.newSkill(id));
    for (const id of [...this.catalysts, ...this.catalystReserve])
      if (id && !this.catalystRuntime.has(id)) this.catalystRuntime.set(id, { id });
    this.initPois();
    this.initObstacles();
  }

  private newSkill(id: SkillId): SkillRuntime {
    return {
      id,
      level: 1,
      power: 0,
      coverage: 0,
      range: 0,
      duration: 0,
      crit: skills[id].baseCrit ?? 0.03,
      eliteDamage: 0,
      count: 1,
      control: 0,
      statusPotency: 0,
      mutation: null,
      mutationUpgrade: null,
      mutationApotheosis: null
    };
  }
  get time() {
    return this.tick / this.hz;
  }
  get hasChoice() {
    return this.choiceRuntime.hasChoice;
  }

  private initObstacles() {
    this.worldGeometry.initialize(this.pois);
  }

  private buildObstacleGrid() {
    this.worldGeometry.rebuild();
  }

  private obstaclesNear(x: number, z: number, radius: number, out: Obstacle[]) {
    return this.worldGeometry.near(x, z, radius, out);
  }

  private freeOf(x: number, z: number, radius: number) {
    return this.worldGeometry.freeOf(x, z, radius);
  }

  private blocked(x: number, z: number, radius: number) {
    return this.worldGeometry.blocked(x, z, radius);
  }

  // One sweep after every mover has had its turn, so teleports and shoves are covered
  // alongside ordinary steering without touching each of them.
  private resolveEntityObstacles() {
    for (const e of this.ents) {
      if (e.hp <= 0) continue;
      const p = this.freeOf(e.x, e.z, e.radius * 0.7);
      e.x = p.x;
      e.z = p.z;
    }
  }

  private firstBlockingObstacleHit(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    padding = 0.08
  ) {
    return this.worldGeometry.firstBlockingHit(x0, z0, x1, z1, padding);
  }

  private firstBlockingObstacle(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    padding = 0.08
  ) {
    return this.worldGeometry.firstBlockingObstacle(x0, z0, x1, z1, padding);
  }

  private lineOfSight(x0: number, z0: number, x1: number, z1: number, padding = 0.08) {
    return this.worldGeometry.lineOfSight(x0, z0, x1, z1, padding);
  }

  private damageObstacle(obstacle: Obstacle, amount: number) {
    return this.worldGeometry.damageObstacle(obstacle, amount);
  }

  private spawnProjectile(p: Omit<Projectile, 'id' | 'guarded'>) {
    const id = this.nextId++,
      activationId = p.faction === 'hero' ? (p.activationId ?? this.physical.currentActivationId) : 0;
    this.projectiles.push({ id, guarded: false, ...p, activationId });
    if (activationId) this.registerAsyncPhysical(activationId);
    if (
      p.faction === 'hero' &&
      p.sourceSlot === this.activation.slot &&
      this.choreography.matchesSkill(p.source)
    ) {
      // For an async path Phenomenon, the first real moving body owns the route origin.
      // This matters when the cast itself displaced its source (Mass recoil) or spawns offset shards.
      if (
        this.choreography.carrierCount() === 0 &&
        (p.source === 'mass_driver' || p.source === 'shard_fan')
      ) {
        this.choreography.setOrigin(p.x, p.z);
        if (activationId) this.physical.setLastPoint(activationId, { x: p.x, z: p.z });
      }
      this.choreography.addCarrier({ kind: 'projectile', id });
    }
    return id;
  }

  private projectileOwner(p: Projectile) {
    return p.ownerId ? this.entityStore.get(p.ownerId) ?? null : null;
  }

  /**
   * D20 / step 5: moving attacks share the same physical world as bodies. A projectile
   * can be stopped by intact cover, can open a destructible lane, and a hostile one can
   * be weakened by orbit_guard before it reaches the hero. Segment tests avoid tunnelling
   * at 30 Hz and make this primitive safe for faster later phenomena as well.
   */
  private updateProjectiles() {
    this.projectiles = this.projectileSystem.update(this.projectiles);
  }

  private scheduleStrike(strike: Omit<DelayedStrike, 'id'>) {
    const activationId = strike.faction === 'hero' ? (strike.activationId ?? this.physical.currentActivationId) : 0;
    this.delayedStrikes.push({ id: this.nextId++, activationId, ...strike });
    if (activationId) this.registerAsyncPhysical(activationId);
    if (strike.faction === 'hero' && strike.sourceSlot === this.activation.slot) {
      // This is a PLAN only. It is deliberately excluded from terminal/area/path truth.
      this.choreography.addScheduled(strike.x, strike.z);
    }
    this.events.push({
      type: 'CombatShape',
      tick: this.tick,
      source: strike.telegraph,
      intent: strike.intent,
      shape: { kind: 'circle', x: strike.x, z: strike.z, radius: strike.radius }
    });
  }

  /**
   * Delayed impacts are a first-class combat primitive in v0.11: the tell is emitted when
   * scheduled and the active impact is emitted here. That makes artillery, sky-lances and
   * elite Echoes readable without pretending an instantaneous circle was an animation.
   */
  private updateDelayedStrikes() {
    this.delayedStrikes = this.delayedStrikeSystem.update(this.delayedStrikes);
  }

  private initPois() {
    this.poiSystem.initialize();
  }
  private clampWorld() {
    this.px = Math.max(this.world.minX + 0.7, Math.min(this.world.maxX - 0.7, this.px));
    this.pz = Math.max(this.world.minZ + 0.7, Math.min(this.world.maxZ - 0.7, this.pz));
    // Every path the hero can move along ends here, dash included: D20 forbids
    // passing through cover, so there is no branch that skips this.
    const p = this.freeOf(this.px, this.pz, Simulation.HERO_BODY_RADIUS);
    this.px = p.x;
    this.pz = p.z;
  }
  private pointAroundPlayer(min = 13, max = 19) {
    return this.worldGeometry.pointAroundPlayer(min, max);
  }

  private updatePoiDirector() {
    this.poiSystem.update();
  }

  private completePoi(id: number) {
    return this.poiSystem.complete(id);
  }
  private bossDirector() {
    if (this.encounterDirector.shouldSpawnBoss(this.time, this.runDuration, this.bossSpawned))
      this.spawnBoss();
  }
  private bossSupportForPoi(kind: PoiKind): [EliteChassis, EliteAffix] {
    return this.eliteSpawns.supportIdentity(kind);
  }
  private spawnBossSupport(kind: PoiKind, bossX: number, bossZ: number, index: number) {
    return this.eliteSpawns.spawnBossSupport(kind, bossX, bossZ, index);
  }
  private spawnBoss() {
    this.bossSpawned = true;
    return this.eliteSpawns.spawnBoss();
  }

  private recycleFarEnemies() {
    this.enemyRecycler.update();
  }

  step(cmd: Command = { moveX: 0, moveZ: 0, aimX: 1, aimZ: -1 }) {
    this.events.length = 0;
    if (this.php <= 0 || this.finished || this.hasChoice) return;
    this.tick++;
    const aimMag = Math.hypot(cmd.aimX, cmd.aimZ);
    if (aimMag > 0.001) {
      this.aimX = cmd.aimX / aimMag;
      this.aimZ = cmd.aimZ / aimMag;
    }
    this.playerMovement.update(cmd);
    this.updatePoiDirector();
    this.bossDirector();
    this.spawnDirector();
    this.eliteDirector();
    this.recycleFarEnemies();
    this.updateSquadTasks();
    this.updateEnemyAI();
    this.updateEliteEchoes();
    this.resolveEntityObstacles();
    this.updateProjectiles();
    this.flushPhysicalEvents();
    this.updateDelayedStrikes();
    this.flushPhysicalEvents();
    this.updateFields();
    this.flushPhysicalEvents();
    this.updateConstructs();
    this.flushPhysicalEvents();
    this.updateDots();
    this.updatePickups();
    this.updateRelics();
    this.updateOrbitBlades();
    this.flushPhysicalEvents();
    this.chainTick();
    this.flushPhysicalEvents();
    this.cleanup();
    if (!this.benchmark) this.checkProgression();
    const aliveNow = this.entityStore.countAlive();
    this.metrics.maxEnemies = Math.max(this.metrics.maxEnemies, aliveNow);
    this.metrics.enemyCountSum += aliveNow;
    this.metrics.enemySamples++;
    if (this.bossDefeated) this.finished = true;
  }

  private designMinutes() {
    return this.encounterDirector.designMinutes(this.time, this.runDuration);
  }
  private worldScale() {
    return this.encounterDirector.worldScale(this.time, this.runDuration);
  }
  private damageScale() {
    return this.encounterDirector.damageScale(this.time, this.runDuration);
  }
  private spawnPressure() {
    return this.encounterDirector.spawnPressure(this.time, this.runDuration);
  }

  private bossPhaseTwoActive() {
    return this.ents.some((e) => e.boss && e.bossPhase >= 2);
  }

  private populationTarget(t = this.time) {
    return this.encounterDirector.populationTarget(
      t,
      this.bossSpawned && !this.bossDefeated,
      this.bossPhaseTwoActive()
    );
  }
  private spawnDirector() {
    const normals = this.entityStore.countAlive((e) => e.kind !== 'elite');
    this.encounterDirector.tickNormalSpawns({
      time: this.time,
      runDuration: this.runDuration,
      dt: this.dt,
      normalCount: normals,
      bossActive: this.bossSpawned && !this.bossDefeated,
      bossPhaseTwo: this.bossPhaseTwoActive(),
      spawn: (kind) => this.spawnEnemy(kind)
    });
  }
  private spawnEnemy(kind: Exclude<EnemyKind, 'elite' | 'hero'>) {
    return this.enemySpawns.spawn(kind);
  }
  private spawnEnemyAt(
    kind: Exclude<EnemyKind, 'elite' | 'hero'>,
    x: number,
    z: number,
    buffedFor = 0,
    cloneParent = 0
  ) {
    return this.enemySpawns.spawnAt(kind, x, z, buffedFor, cloneParent);
  }

  private eliteDirector() {
    const active = this.entityStore.countAlive((e) => e.kind === 'elite' && !e.boss);
    const request = this.encounterDirector.tickElite({
      time: this.time,
      dt: this.dt,
      bossSpawned: this.bossSpawned,
      activeElites: active
    });
    if (request) this.spawnElite(request === 'opening');
  }
  /** D9 compatibility seam; spawn-time rarity policy lives in EliteSpawnSystem. */
  private rollEliteRarity(): EliteRarity {
    return this.eliteSpawns.rollRarity();
  }
  private rollEliteAffix(rarity: EliteRarity): EliteAffix {
    return this.eliteSpawns.rollAffix(rarity);
  }

  /**
   * Refusal repertoire is learned ecosystem knowledge. Early encounters are intentionally
   * narrow for readability; later elites can carry a much broader selection.
   */

  private claimRepertoire(e: Ent) {
    this.eliteProgression.claimRepertoire(e);
  }
  /** How many cards of one growth direction this elite is holding. */
  private rivalAxisCount(e: Ent, axis: ResonanceId): number {
    return this.eliteProgression.rivalAxisCount(e, axis);
  }
  /**
   * Roughly half of what the hero declines is a growth direction rather than a weapon,
   * and until now an elite holding one simply wore the icon and did nothing with it -
   * the card was conceded for no consequence at all, which is the failure doc 16 calls
   * an unreadable link between refusal and outcome. D41 forbids copying the hero's
   * version, so the mirror is by function: the direction the hero turned down grows the
   * elite that took it. Endurance makes it harder to put down, conductivity sharpens its
   * touch, mobility quickens it, and the two applied at the moment of the cast live in
   * damageHero and in the cadence below. Figures are provisional and stated in doc 23.
   */

  /** heldBy is first-carrier bookkeeping; death clears that marker, not ecosystem knowledge. */
  private releaseRepertoire(e: Ent) {
    this.eliteEchoSystem.release(e.id);
    this.eliteProgression.releaseRepertoire(e);
  }

  /**
   * The payoff of the draft: an elite turns a phenomenon the hero declined back on them.
   * Cadence and reach are deliberately slack - the point here is that the link reads, and
   * D49 calibration only becomes possible once the telemetry of step 11 exists.
   */




  private startEliteEcho(e: Ent, card: RefusedCard) {
    this.eliteEchoSystem.start(e, card);
  }



  private updateEliteEchoes() {
    this.eliteEchoSystem.update();
  }

  /**
   * A declined Phenomenon is inherited as an Elite Echo, never as the player's cast. The
   * fantasy is recognisable, but its duel grammar is authored around one hero and always
   * exposes tell -> active -> recovery.
   */
  private fieldRefusals(e: Ent, d: number) {
    this.eliteEchoSystem.fieldRefusals(e, d);
  }
  /**
   * Accumulates the seconds an elite spends inside the hero's reach. Wall-clock from the first
   * blow to the death overstates the fight badly: a tougher elite survives the first exchange,
   * wanders off and comes back, and the clock keeps running through the gap.
   */
  private noteEliteContact(e: Ent, _d: number) {
    this.eliteEncountersLedger.noteContact(e.id, this.time, this.dt);
  }

  private noteEliteSpawn(e: Ent) {
    this.eliteEncountersLedger.start(e, this.time);
  }

  /** D52: every elite fight of the run, for calibrating the D49 target length. */
  eliteEncounters(): EliteEncounter[] {
    return this.eliteEncountersLedger.all();
  }

  private spawnElite(opening = false) {
    return this.eliteSpawns.spawnRegular(opening);
  }

  private steerTo(e: Ent, tx: number, tz: number, speed: number, mul = 1) {
    let gx = tx,
      gz = tz;
    const blocker = this.firstBlockingObstacle(e.x, e.z, tx, tz, e.radius * 0.72 + 0.08);
    if (blocker) {
      const txd = tx - e.x,
        tzd = tz - e.z,
        td = Math.hypot(txd, tzd) || 1,
        ux = txd / td,
        uz = tzd / td,
        side = e.id % 2 ? 1 : -1,
        clearance = blocker.radius + e.radius * 0.78 + 0.72;
      // Aim beside and slightly beyond the blocking island. A pure tangent target makes
      // the actor orbit the same circle forever because the direct goal remains occluded;
      // this far-side component ensures it actually clears the obstacle before reacquiring.
      gx = blocker.x + ux * clearance * 0.8 + -uz * side * clearance;
      gz = blocker.z + uz * clearance * 0.8 + ux * side * clearance;
    }
    const dx = gx - e.x,
      dz = gz - e.z,
      d = Math.hypot(dx, dz) || 1;
    e.x += (dx / d) * speed * mul * this.dt;
    e.z += (dz / d) * speed * mul * this.dt;
  }

  private updateSquadTasks() {
    this.squadDirector.update();
  }

  private steerEliteToRelic(e: Ent, speed: number, playerDistance: number) {
    return this.relicRace.steerElite(e, speed, playerDistance);
  }

  private updateEnemyAI() {
    const dt = this.dt;
    for (const e of this.ents) {
      if (e.hp <= 0) continue;
      e.cooldown -= dt;
      e.linkTimer -= dt;
      e.stateTimer -= dt;
      e.affixTimer += dt;
      e.affixPulse -= dt;
      e.adaptCooldown -= dt;
      this.eliteAffix.earlyTick(e);
      let dx = this.px - e.x,
        dz = this.pz - e.z,
        d = Math.hypot(dx, dz) || 1,
        nx = dx / d,
        nz = dz / d;
      e.facingX = nx;
      e.facingZ = nz;
      let speed =
        e.speed *
        ((e.frozenUntil ?? 0) > this.time ? (e.kind === 'elite' ? 0.45 : 0.08) : e.chillUntil > this.time ? (e.kind === 'elite' ? 0.88 : 0.72) : 1) *
        (e.buffUntil > this.time ? 1.32 : 1);
      const affixBehavior = this.eliteAffix.beforeBehavior(e, d);
      if (affixBehavior.skipBehavior) continue;
      speed *= affixBehavior.speedMultiplier;
      if (e.kind !== 'elite') {
        this.enemyBehavior.update(e, speed, d, nx, nz);
      } else if (e.kind === 'elite' && !e.boss && this.steerEliteToRelic(e, speed, d)) {
        // Looting is a temporary tactical job. Contact damage below still applies if the hero intercepts it.
      } else if (e.kind === 'elite') {
        if (e.boss) this.updateBossAI(e, speed, d, nx, nz);
        else this.updateEliteAI(e, speed, d, nx, nz);
      }
      dx = this.px - e.x;
      dz = this.pz - e.z;
      d = Math.hypot(dx, dz) || 1;
      if (d < e.radius + 0.44)
        this.hitPlayer(e.contactDps * (e.buffUntil > this.time ? 1.28 : 1) * dt, e);
    }
  }
  private elitePatternCooldown(base: number, e: Ent) {
    return this.eliteBehavior.patternCooldown(base, e);
  }

  private updateEliteAI(e: Ent, speed: number, d: number, nx: number, nz: number) {
    this.eliteBehavior.update(e, speed, d, nx, nz);
  }

  private playerInSector(
    x: number,
    z: number,
    ax: number,
    az: number,
    radius: number,
    halfAngle: number
  ) {
    return combatShapeIntersectsCircle(
      {kind:'sector',x,z,aimX:ax,aimZ:az,radius,halfAngle},
      this.px,this.pz,HERO_HIT_RADIUS
    );
  }
  private playerInRay(
    x: number,
    z: number,
    ax: number,
    az: number,
    range: number,
    halfWidth: number
  ) {
    return combatShapeIntersectsCircle(
      {kind:'ray',x,z,aimX:ax,aimZ:az,range,halfWidth},
      this.px,this.pz,HERO_HIT_RADIUS
    );
  }

  private updateBossAI(e: Ent, speed: number, d: number, nx: number, nz: number) {
    this.bossBehavior.update(e, speed, d, nx, nz);
  }

  private hitPlayer(
    amount: number,
    attacker: Ent | null = null,
    source: DamageSourceId = 'contact'
  ) {
    this.playerDamage.hit(amount, attacker, source);
  }
  private grantBarrier(amount: number) {
    if (amount <= 0) return;
    const before = this.barrier;
    this.barrier = Math.min(90, this.barrier + amount);
    this.metrics.barrierGenerated += Math.max(0, this.barrier - before);
  }
  private healPlayer(amount: number) {
    if (amount <= 0) return;
    const before = this.php;
    this.php = Math.min(this.maxHp, this.php + amount);
    this.metrics.healingReceived += Math.max(0, this.php - before);
  }

  private updateFields() {
    this.fields = this.fieldSystem.update(this.fields);
  }

  private updateDots() {
    this.statusSystem.updateDamageOverTime(
      this.ents,
      this.time,
      this.dt,
      (entity, amount, source) => this.damage(entity, amount, source, false, entity.x, entity.z)
    );
  }

  private updatePickups() {
    const alive: Pickup[] = [];
    for (const p of this.pickups) {
      const dx = this.px - p.x,
        dz = this.pz - p.z,
        d = Math.hypot(dx, dz);
      if (d > 1e-6 && d < this.pickupRadius) {
        const sp = 5.5 + Math.max(0, this.pickupRadius - d) * 2.4;
        p.x += (dx / d) * sp * this.dt;
        p.z += (dz / d) * sp * this.dt;
      }
      if (d < 0.42) {
        if (p.kind === 'xp') this.xp += p.value;
        else if (p.kind === 'core') this.eliteCore += p.value;
        else if (p.kind === 'mutation') {
          this.mutationCores += p.value;
          this.events.push({ type: 'RareEvent', tick: this.tick, title: 'ЯДРО МУТАЦИИ', detail: `Ядро получено · запас ${this.mutationCores}`, x: p.x, z: p.z });
        } else {
          this.healPlayer(p.value);
          this.metrics.healsPicked++;
        }
        continue;
      }
      alive.push(p);
    }
    this.pickups = alive;
  }
  /**
   * Relics appear away from the hero on purpose. A relic that spawns underfoot is a gift;
   * one that spawns across the field is a decision, and it is the only thing in the build
   * that an elite and the hero can both want at the same time.
   */
  private updateRelics() {
    this.relicRace.update();
  }
  private spawnRelic() {
    this.relicRace.spawn();
  }
  /**
   * Applies an item to the hero, whether it was lifted off the floor or handed over as a
   * level reward. D14 forbids slots, so nothing is displaced and copies simply stack.
   */
  private grantItem(id: ItemId) {
    this.heldItems.push(id);
    const a = items[id].effect;
    if (a.kind === 'armor') this.armor += a.amount;
    else if (a.kind === 'maxHp') {
      this.maxHp += a.amount;
      this.healPlayer(a.amount);
    } else if (a.kind === 'barrierOnEliteKill') this.itemBarrierOnEliteKill += a.amount;
    else if (a.kind === 'damageTakenMul') this.itemDamageTakenMul *= a.amount;
    else if (a.kind === 'damageMul') this.itemDamageMul *= a.amount;
    else if (a.kind === 'crit') this.itemCrit += a.amount;
    else if (a.kind === 'siphon') this.itemSiphon += a.amount;
    else if (a.kind === 'eliteDamageMul') this.itemEliteDamageMul *= a.amount;
    else if (a.kind === 'moveSpeedMul') this.moveSpeed *= a.amount;
    else if (a.kind === 'tempo') this.tempo += a.amount;
    else if (a.kind === 'dashCooldownMul') this.dashCooldownMul *= a.amount;
    else if (a.kind === 'dashIFrameMul') this.dashIFrameMul *= a.amount;
    else if (a.kind === 'pickupRadiusMul') this.pickupRadius *= a.amount;
    else if (a.kind === 'fortune') this.fortune += a.amount;
    else if (a.kind === 'xpMul') this.itemXpMul *= a.amount;
    else if (a.kind === 'relicRateMul') this.itemRelicRateMul *= a.amount;
    else if (a.kind === 'coreBonus') this.itemCoreBonus += a.amount;
    else if (a.kind === 'refusalDamageMul') this.itemRefusalDamageMul *= a.amount;
  }
  private takeRelic(r: Relic) {
    const def = items[r.item];
    this.grantItem(r.item);
    this.metrics.relicsTakenByHero++;
    this.events.push({
      type: 'RelicTaken',
      tick: this.tick,
      item: r.item,
      name: def.name,
      description: def.description,
      byHero: true,
      x: r.x,
      z: r.z
    });
  }
  /**
   * Enemy-side item effects are authored per item. `allowClaim` is false when an item
   * effect is inherited through a refusal card so "learn one more refusal" cannot recurse.
   */








  private grantNativeEliteGrowth(e: Ent) {
    this.eliteProgression.grantNativeGrowth(e);
  }

  private inheritEliteEvolution(e: Ent) {
    this.eliteProgression.inheritEvolution(e);
  }

  private inheritEliteLegacy(e: Ent, all = false) {
    this.eliteProgression.inheritLegacy(e, all);
  }

  private giveEliteRelic(e: Ent, r: Relic) {
    const def = items[r.item];
    this.metrics.relicsTakenByElites++;
    this.eliteProgression.recordCapturedRelic(e, r.item);
    this.eliteEncountersLedger.noteItem(e.id, r.item);
    this.events.push({
      type: 'RelicTaken',
      tick: this.tick,
      item: r.item,
      name: def.name,
      description: itemRivalEffect[r.item],
      byHero: false,
      x: r.x,
      z: r.z
    });
  }


  private updateConstructs() {
    this.constructs = this.constructSystem.update(this.constructs);
  }



  private updateOrbitBlades() {
    const runtime = this.skillsRuntime.get('orbit_blades');
    this.orbitSystem.update(
      runtime,
      !!runtime && this.isActiveSkill('orbit_blades'),
      this.slots.indexOf('orbit_blades'),
      () => this.orbitCenter()
    );
  }

  private effectiveTempo() {
    return this.tempo + this.resonance.tempo * 0.12;
  }
  private activeSpan() {
    for (let i = this.slots.length - 1; i >= 0; i--) if (this.slots[i]) return i + 1;
    return 1;
  }
  private cycleDuration() {
    return Math.max(0.58, 1.22 / (1 + this.effectiveTempo()));
  }
  private chainTick() {
    const span = this.activeSpan(),
      beatTime = this.cycleDuration() / Math.max(1, span);
    this.beatAcc += this.dt;
    while (this.beatAcc + 1e-9 >= beatTime) {
      this.beatAcc -= beatTime;
      if (this.beat >= span) this.beat = 0;
      this.activationPipeline.activate(this.beat);
      this.beat++;
      if (this.beat >= span) {
        this.beat = 0;
        this.cycle++;
      }
    }
  }
  private skillState(id: SkillId) {
    return this.skillsRuntime.get(id)!;
  }
  private incomingCatalyst(slot: number) {
    return slot > 0 ? this.catalysts[slot - 1] : null;
  }
  private catalystPotency(id: CatalystId | null) {
    return id ? 1 + this.resonance.conductivity * 0.16 : 1;
  }
  private supportsAxis(id: SkillId, axis: ResonanceId) {
    return skills[id].axes?.includes(axis) ?? false;
  }
  private corePower() {
    return 1 + Math.max(0, this.level - 1) * 0.075;
  }
  private slotAmp(_slot: number, _e?: Ent) {
    return this.activation.scale;
  }

  private mutationIs(st: SkillRuntime, id: MutationId) {
    return st.mutation === id || st.mutationUpgrade === id || st.mutationApotheosis === id;
  }
  private mutationContinuation(st: SkillRuntime) {
    return st.mutationUpgrade ? mutationDef(st.id, st.mutationUpgrade).continuation : undefined;
  }
  private powerBucket(st: SkillRuntime) {
    return this.corePower() * (1 + this.globalPower) * (1 + this.doctrines.might * 0.11) * (this.mutationContinuation(st)?.powerMul ?? 1);
  }
  private skillRadius(st: SkillRuntime, base: number, _slot = this.activation.slot) {
    return base * Math.sqrt(1 + Math.max(0, st.coverage)) * (1 + this.doctrines.size * 0.12) * (this.mutationContinuation(st)?.radiusMul ?? 1);
  }
  private skillRange(st: SkillRuntime, base: number) {
    return base * (1 + Math.max(0, st.range)) * (this.mutationContinuation(st)?.rangeMul ?? 1);
  }
  private memoryFactor() {
    return 1 + this.resonance.persistence * 0.18;
  }
  private persistentDuration(st: SkillRuntime, base: number, _slot = this.activation.slot) {
    const rival = this.castOwner;
    const heroAxis = !rival && this.supportsAxis(st.id, 'persistence') ? this.resonance.persistence : 0;
    const rivalAxis = rival ? this.rivalAxisCount(rival, 'persistence') : 0;
    return (
      base *
      (1 + Math.max(0, st.duration)) *
      (1 + heroAxis * 0.22) *
      (1 + (rival ? 0 : this.doctrines.duration) * 0.14) *
      Math.pow(1.22, rivalAxis) *
      (this.mutationContinuation(st)?.durationMul ?? 1)
    );
  }
  private projectileCount(st: SkillRuntime, _slot: number) {
    let c = Math.max(1, Math.round(st.count)) + this.activation.countBonus;
    const mult = this.supportsAxis(st.id, 'multiplicity') ? this.resonance.multiplicity : 0;
    c += Math.min(3, mult);
    if (!this.castOwner) c += Math.min(3, Math.floor(this.doctrines.quantity / 2));
    c += this.mutationContinuation(st)?.countAdd ?? 0;
    return Math.max(1, c);
  }

  /** A wide lane that keeps its full weight through every body standing in it. */

  /** Constant work in contact: no aiming pause, no reach, nothing at all on the retreat. */

  /** Pays for walking through the mass rather than backing away from it. */

  /** A ring that leaves the ground at the feet alone and takes the middle distance. */

  /** Covers an angle instead of a point, so a rough aim still lands something. */





  private dispatchSkill(id: SkillId, st: SkillRuntime, slot: number, src: CastSource) {
    if (this.phenomenonCasts.cast(id, st, slot, src)) return;
    this.statefulPhenomenonCasts.cast(id, st, slot, src);
  }
  private registerAsyncPhysical(activationId: number) {
    this.physical.registerAsync(activationId);
  }

  private finishAsyncPhysical(activationId: number | undefined, x: number, z: number) {
    this.physical.finishAsync(activationId, x, z);
  }

  private queuePhysicalEvent(e: PhysicalEvent) {
    this.physical.queue(e);
  }





  private flushPhysicalEvents() {
    this.physical.flush(
      (binding, event) => this.physicalCatalysts.handle(binding, event),
      (activationId) => this.constructs.some((construct) => construct.activationId === activationId)
    );
  }

  private orbitCenter() {
    if (this.time < this.orbitChoreoUntil) {
      if (this.orbitChoreoCarrier) {
        const p = this.resolveChoreographyCarrier(this.orbitChoreoCarrier);
        if (p) {
          this.orbitChoreoX = p.x;
          this.orbitChoreoZ = p.z;
        }
      }
      return { x: this.orbitChoreoX, z: this.orbitChoreoZ };
    }
    this.orbitChoreoCarrier = null;
    return { x: this.px, z: this.pz };
  }

  private setOrbitChoreography(
    x: number,
    z: number,
    carrier: ChoreographyCarrier | null = null
  ) {
    const safe = this.safeChoreographyPoint(x, z, 0.45);
    this.orbitChoreoX = safe.x;
    this.orbitChoreoZ = safe.z;
    this.orbitChoreoCarrier = carrier;
    this.orbitChoreoUntil = this.time + Math.max(1.0, this.cycleDuration() * 1.35);
  }

  private noteOrbitTrace() {
    const st = this.skillsRuntime.get('orbit_blades');
    if (!this.choreography.active || !st) return;
    const center = this.orbitCenter(),
      geometry = this.orbitSystem.geometry(st, center);
    for (const blade of geometry.blades) {
      this.choreography.area(blade.x, blade.z, geometry.bladeRadius);
      this.choreography.addCarrier({ kind: 'orbit', index: blade.index });
    }
  }

  private resolveChoreographyCarrier(ref: ChoreographyCarrier): ChoreographyPoint | null {
    if (ref.kind === 'projectile') {
      const p = this.projectiles.find((q) => q.id === ref.id);
      return p ? { x: p.x, z: p.z } : null;
    }
    if (ref.kind === 'construct') {
      const p = this.constructs.find((q) => q.id === ref.id);
      return p ? { x: p.x, z: p.z } : null;
    }
    const st = this.skillsRuntime.get('orbit_blades');
    if (!st || !this.isActiveSkill('orbit_blades')) return null;
    const center = this.orbitCenter(),
      geometry = this.orbitSystem.geometry(st, center),
      index = ref.index % Math.max(1, geometry.profile.count),
      blade = geometry.blades[index];
    return blade ? { x: blade.x, z: blade.z } : null;
  }



  private choreographyAim(x: number, z: number, fallbackX = this.aimX, fallbackZ = this.aimZ) {
    const target = this.entityStore.nearest(x, z);
    if (target) {
      const dx = target.x - x,
        dz = target.z - z,
        m = Math.hypot(dx, dz) || 1;
      return { x: dx / m, z: dz / m };
    }
    const m = Math.hypot(fallbackX, fallbackZ) || 1;
    return { x: fallbackX / m, z: fallbackZ / m };
  }

  private safeChoreographyPoint(x: number, z: number, radius = 0.28) {
    x = Math.max(this.world.minX + radius, Math.min(this.world.maxX - radius, x));
    z = Math.max(this.world.minZ + radius, Math.min(this.world.maxZ - radius, z));
    return this.freeOf(x, z, radius);
  }

  private choreographySource(x: number, z: number, aimX?: number, aimZ?: number): CastSource {
    const safe = this.safeChoreographyPoint(x, z),
      aim =
        aimX !== undefined && aimZ !== undefined
          ? (() => {
              const m = Math.hypot(aimX, aimZ) || 1;
              return { x: aimX / m, z: aimZ / m };
            })()
          : this.choreographyAim(safe.x, safe.z);
    return {
      faction: 'hero',
      owner: null,
      x: safe.x,
      z: safe.z,
      aimX: aim.x,
      aimZ: aim.z,
      vx: this.playerVX,
      vz: this.playerVZ
    };
  }

  private castWithTrace(id: SkillId, st: SkillRuntime, slot: number, src: CastSource) {
    const firstNewId = this.nextId;
    this.choreography.ensureSource({ x: src.x, z: src.z }, src.aimX, src.aimZ);
    this.events.push({
      type: 'SkillActivated',
      tick: this.tick,
      slot,
      skill: id,
      x: src.x,
      z: src.z,
      aimX: src.aimX,
      aimZ: src.aimZ
    });
    this.choreography.point(src.x, src.z);
    this.dispatchSkill(id, st, slot, src);
    for (const projectile of this.projectiles)
      if (projectile.id >= firstNewId && projectile.sourceSlot === slot && projectile.faction === 'hero')
        this.choreography.addCarrier({ kind: 'projectile', id: projectile.id });
    for (const construct of this.constructs)
      if (construct.id >= firstNewId && construct.sourceSlot === slot && construct.faction === 'hero') {
        construct.activationId = this.physical.currentActivationId;
        this.choreography.addCarrier({ kind: 'construct', id: construct.id });
        this.choreography.point(construct.x, construct.z);
        this.choreography.area(construct.x, construct.z, 0.7);
      }
    for (const field of this.fields)
      if (field.id >= firstNewId && field.sourceSlot === slot && field.faction !== 'rival') {
        field.activationId = this.physical.currentActivationId;
        field.insideIds ??= [];
        this.choreography.area(field.x, field.z, field.radius);
      }
    if (id === 'orbit_blades') this.noteOrbitTrace();
  }

  private applyState(e: Ent, state: string, potency = 1) {
    this.statusSystem.apply(e, state, {
      time: this.time,
      potency,
      memoryFactor: this.memoryFactor(),
      globalPower: this.globalPower
    });
  }
  private noteState(state: string) {
    this.activation.noteState(state);
  }

  /** The player as a cast source. Default owner for everything the hero triggers. */
  private heroSource(): CastSource {
    return {
      faction: 'hero',
      owner: null,
      x: this.px,
      z: this.pz,
      aimX: this.aimX,
      aimZ: this.aimZ,
      vx: this.playerVX,
      vz: this.playerVZ
    };
  }
  /** Moves whoever produced the effect, so recoil works the same for hero and rival. */
  private displaceSource(src: CastSource, dx: number, dz: number) {
    src.x += dx;
    src.z += dz;
    if (src.owner) {
      src.owner.x += dx;
      src.owner.z += dz;
    } else {
      this.px += dx;
      this.pz += dz;
    }
  }
  // Who a cast is allowed to hit. A hero cast sweeps the enemy roster; a rival cast
  // resolves against the single synthetic hero combatant, refreshed from live player state.
  private bestTarget(
    src: CastSource,
    predicate: (entity: Ent) => boolean,
    compare: (candidate: Ent, best: Ent) => number
  ) {
    return this.combatTargeting.bestTarget(src, predicate, compare);
  }

  private targetsFor(src: CastSource): Ent[] {
    return this.combatTargeting.targetsFor(src);
  }

  private rayHits(
    src: CastSource,
    ax: number,
    az: number,
    range: number,
    width: number,
    maxHits = 99
  ) {
    return this.combatTargeting.rayHits(src, ax, az, range, width, maxHits);
  }

  private rotatedAim(src: CastSource, rad: number) {
    return this.combatTargeting.rotatedAim(src, rad);
  }

  private targetVisible(src: CastSource, e: Ent) {
    return this.combatTargeting.targetVisible(src, e);
  }

  private spawnReplicant(parent: Ent) {
    const a = this.rng.range(0, Math.PI * 2),
      r = this.rng.range(0.8, 1.8);
    const q = this.spawnEnemyAt(
      'footnote',
      parent.x + Math.cos(a) * r,
      parent.z + Math.sin(a) * r,
      0,
      parent.id
    );
    if (q) {
      q.maxHp *= 1.25;
      q.hp = q.maxHp;
      q.speed *= 1.28;
      q.radius = 0.4;
      this.events.push({
        type: 'EliteOrder',
        tick: this.tick,
        entity: parent.id,
        order: 'replicate',
        x: parent.x,
        z: parent.z,
        count: 1
      });
    }
  }

  private aimPoint(src: CastSource, range: number) {
    return this.combatTargeting.aimPoint(src, range);
  }

  private combatShape(
    source: string,
    shape: CombatShape,
    intent: 'damage' | 'control' | 'field' = 'damage',
    physicalTrace = true
  ) {
    // Render geometry and simulation truth are separate contracts. A moving projectile may
    // draw its intended lane now, but its Catalyst path is published only as the body moves.
    if (physicalTrace) this.choreography.combatShape(shape);
    this.events.push({ type: 'CombatShape', tick: this.tick, source, intent, shape });
  }





















  private damage(
    e: Ent,
    amount: number,
    source: string,
    directional: boolean,
    sourceX = this.px,
    sourceZ = this.pz,
    sourceSlot = this.activation.slot
  ) {
    // A rival-owned cast resolves against the player, not against the enemy roster.
    // None of the bookkeeping below applies: it is all scored from the hero's point of view.
    if (this.combatTargeting.isSyntheticHero(e)) return this.damageHero(amount, source as DamageSourceId);
    // Everything reaching this line is the hero striking an enemy: rival casts resolve
    // against the synthetic hero above and elite contact goes straight to hitPlayer.
    if (e.hp <= 0) return false;
    const resolved = this.enemyDamageModifiers.resolve(
      e,
      amount,
      source,
      directional,
      sourceX,
      sourceZ
    );
    const actual = resolved.actual;
    const skill = resolved.skill;
    const before = e.hp;
    e.hp -= actual;
    e.lastDamageAt = this.time;
    if (source === 'sentry') e.sentryTouchedUntil = this.time + 4;
    this.combatLedger.recordEnemyHit(e, source, actual, sourceSlot);
    this.eliteDamageResponse.noteResolvedDamage(source, actual, this.activation.derived);
    if (source === 'cleaver' || source === 'orbit_blades') {
      if (this.doctrines.guard > 0 && Math.hypot(e.x - this.px, e.z - this.pz) < 4.2)
        this.grantBarrier(Math.min(3.5, actual * (0.0025 + this.doctrines.guard * 0.0014)));
      this.eliteAffix.afterCloseDamage(e, actual, this.doctrines.force);
    }
    if (skill && this.activation.slot >= 0) {
      this.activation.recordHit(e.id, actual);
      if (this.choreography.matchesSkill(skill.id))
        this.choreography.addContact(e.x, e.z);
    }
    this.events.push({
      type: 'DamageResolved',
      tick: this.tick,
      entity: e.id,
      amount: actual,
      source,
      x: e.x,
      z: e.z,
      sourceX,
      sourceZ,
      elite: e.kind === 'elite',
      crit: resolved.crit
    });
    const killed = before > 0 && e.hp <= 0;
    if (this.itemSiphon > 0) this.healPlayer(Math.min(before, actual) * this.itemSiphon);
    if (killed) this.combatLedger.recordKill(source);
    if (killed && skill && this.activation.slot >= 0)
      this.activation.recordKill(actual - before);
    if (killed) this.phenomenonKillReactions.onKill(e, source);
    return killed;
  }
  // Damage landing on the player. Mitigation, barrier and death are owned by hitPlayer,
  // so this only records the source and reports whether the blow was lethal.
  private damageHero(
    amount: number,
    source: DamageSourceId,
    attacker: Ent | null = this.castOwner,
    concentration = this.castRivalConcentration
  ) {
    return this.playerDamage.damageFromRival(
      amount,
      source,
      attacker,
      concentration
    );
  }
  private cleanup() {
    this.ents = this.deathResolution.resolve(this.ents);
    for (const entity of this.ents) if (entity.kind !== 'binder') entity.linkedTo = 0;
    for (const binder of this.ents)
      if (binder.kind === 'binder' && binder.linkedTo) {
        const target = this.entityStore.get(binder.linkedTo);
        if (target) target.linkedTo = binder.id;
      }
  }

  private checkProgression() {
    if (this.hasChoice) return;
    if (this.mutationCores > 0 && this.progressionOffers.hasEvolvableSkill()) {
      this.generateMutationTargetOffers();
      return;
    }
    if (this.eliteCore >= 5) {
      this.eliteCore -= 5;
      this.generateEliteCache();
      return;
    }
    if (this.xp >= this.xpNeed) {
      this.xp -= this.xpNeed;
      this.level++;
      this.metrics.levels++;
      this.xpNeed = this.nextXpNeed(this.level);
      this.generateLevelOffers();
      this.events.push({ type: 'LevelUp', tick: this.tick, level: this.level });
    }
  }
  private nextXpNeed(level: number) {
    return Math.round(12 + level * 1.5 + Math.pow(level, 1.25) * 0.7);
  }
  private shuffle<T>(a: T[]) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.rng.int(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  private allOwnedSkills() {
    return [...new Set([...this.slots, ...this.skillReserve].filter(Boolean) as SkillId[])];
  }
  private allOwnedCatalysts() {
    return [
      ...new Set([...this.catalysts, ...this.catalystReserve].filter(Boolean) as CatalystId[])
    ];
  }
  private catalystCompatibleEdges(id: CatalystId) {
    const out: number[] = [];
    for (let i = 0; i < this.catalysts.length; i++) {
      const left = this.slots[i],
        right = this.slots[i + 1];
      if (left && right && catalystPairCompatible(id, left, right)) out.push(i);
    }
    return out;
  }
  private generateDiscovery() {
    this.choiceRuntime.openRewards(this.progressionOffers.discovery());
  }
  /** v0.11: XP answers exactly one question — what kind of build is the hero becoming? */
  private generateLevelOffers() {
    this.choiceRuntime.openRewards(this.progressionOffers.levelOffers());
  }
  private generateMutationTargetOffers() {
    const offers = this.progressionOffers.mutationTargetOffers();
    if (offers.length) this.choiceRuntime.openRewards(offers);
  }
  private generateEliteCache() {
    this.choiceRuntime.openRewards(this.progressionOffers.eliteCache());
  }
  private placeCatalyst(id: CatalystId) {
    let edge = this.catalysts.findIndex((c, i) => {
      const left=this.slots[i], right=this.slots[i+1];
      return !c && !!left && !!right && catalystPairCompatible(id,left,right);
    });
    if (edge >= 0) this.catalysts[edge] = id;
    else {
      const reserve = this.catalystReserve.findIndex((x) => !x);
      if (reserve >= 0) this.catalystReserve[reserve] = id;
      else {
        edge = this.catalysts.findIndex((x) => !x);
        if (edge >= 0) this.catalysts[edge] = id;
        else return false;
      }
    }
    this.catalystRuntime.set(id, { id });
    return true;
  }
  private addSkill(id: SkillId) {
    if (this.allOwnedSkills().includes(id)) return true;
    const active = this.slots.findIndex((x) => !x),
      reserve = this.skillReserve.findIndex((x) => !x);
    if (active >= 0) this.slots[active] = id;
    else if (reserve >= 0) this.skillReserve[reserve] = id;
    else return false;
    this.skillsRuntime.set(id, this.newSkill(id));
    return true;
  }
  /**
   * D27: the phenomenon stepping aside goes to the reserve, and whatever was sitting
   * in the reserve is what leaves the run, so a swap is a real decision rather than a
   * free upgrade.
   */
  private swapInSkill(id: SkillId, slot: number) {
    if (this.allOwnedSkills().includes(id)) return true;
    if (slot < 0 || slot >= this.slots.length) return false;
    const leaving = this.slots[slot];
    this.slots[slot] = id;
    this.skillsRuntime.set(id, this.newSkill(id));
    if (leaving) {
      const free = this.skillReserve.findIndex((x) => !x);
      if (free >= 0) this.skillReserve[free] = leaving;
      else {
        const dropped = this.skillReserve[0];
        this.skillReserve[0] = leaving;
        if (dropped) this.skillsRuntime.delete(dropped);
      }
    }
    return true;
  }
  chooseReward(index: number) {
    const chosen = this.choiceRuntime.takeReward(index);
    if (!chosen) return false;
    const { offers, offer } = chosen;
    if (offer.kind === 'mutation_target' && offer.skill) {
      this.choiceRuntime.beginMutationTarget();
      this.generateMutationOffer(offer.skill);
      return true;
    }
    if (offer.kind === 'item_grant' && offer.item) {
      this.grantItem(offer.item);
    } else if (offer.kind === 'skill_swap' && offer.skill && offer.swapSlot !== undefined) {
      if (!this.swapInSkill(offer.skill, offer.swapSlot)) return false;
    } else if ((offer.kind === 'skill_add' || offer.kind === 'elite') && offer.skill) {
      if (!this.addSkill(offer.skill)) return false;
    } else if ((offer.kind === 'catalyst_add' || offer.kind === 'elite') && offer.catalyst) {
      if (!this.placeCatalyst(offer.catalyst)) return false;
    } else if (offer.kind === 'doctrine' && offer.doctrine) {
      this.applyDoctrine(offer.doctrine, offer.amount ?? 1);
    } else if ((offer.kind === 'resonance' || offer.kind === 'elite') && offer.resonance) {
      this.applyCoreAxis(offer.resonance, offer.amount ?? 1);
    } else this.applyGlobal(offer.stat, offer.amount ?? 0);
    this.events.push({ type: 'RewardChosen', tick: this.tick, title: offer.title });
    if (!offers.every((o) => o.kind === 'doctrine')) this.concedeRefusal(offers.filter((o) => o !== offer));
    return true;
  }
  /**
   * D7: of the cards the hero passed over, exactly one is conceded to the elites and the
   * rest simply remain in the pool. D53 applies the same rule to a skipped reward.
   */
  private concedeRefusal(passed: RewardOffer[]) {
    const card = this.refusalLedger.concede(passed);
    if (!card) return;
    this.events.push({
      type: 'RewardRefused',
      tick: this.tick,
      title: card.title,
      kind: card.kind,
      serial: card.serial
    });
  }
  private refusalFromOffer(o: RewardOffer): RefusedCard | null {
    return this.refusalLedger.fromOffer(o);
  }

  private applyCoreAxis(axis: ResonanceId, amount = 1) {
    this.resonance[axis] += amount;
    if (axis === 'mobility') this.moveSpeed *= 1 + 0.045 * amount;
  }
  private applyDoctrine(id: DoctrineId, amount: number) {
    this.doctrines[id] += amount;
    if (id === 'mobility') {
      this.moveSpeed *= Math.pow(1.055, amount);
      this.dashCooldownMul *= Math.pow(0.96, amount);
    }
    if (id === 'guard') {
      this.armor += 4 * amount;
      this.grantBarrier(5 * amount);
    }
  }
  private applyGlobal(stat?: string, amount = 0) {
    if (stat === 'hp') {
      this.maxHp += amount;
      this.php = Math.min(this.maxHp, this.php + amount);
    } else if (stat === 'move') this.moveSpeed *= 1 + amount;
    else if (stat === 'tempo') this.tempo += amount;
    else if (stat === 'globalPower') this.globalPower += amount;
    else if (stat === 'pickup') this.pickupRadius *= 1 + amount;
    else if (stat === 'fortune') this.fortune += amount;
    else if (stat === 'armor') this.armor += amount;
  }
  /**
   * D28 puts three branches on a phenomenon, so a mutation is a fork rather than a coin
   * toss. A hand-written table used to pin eight of the phenomena to two branches each
   * and left the rest of their declared mutations unreachable; with eighteen phenomena
   * in the roster that table was also a standing invitation to forget an entry. The
   * offer is now drawn from whatever the phenomenon itself declares.
   */
  private generateMutationOffer(id: SkillId) {
    const st = this.skillState(id);
    const tier: 1 | 2 | 3 = !st.mutation ? 1 : !st.mutationUpgrade ? 2 : 3;
    const parent = tier === 1 ? null : tier === 2 ? st.mutation : st.mutationUpgrade;
    const choices = parent
      ? mutationChildren(id, parent).map((m) => m.id)
      : mutationRoots(id).map((m) => m.id);
    this.choiceRuntime.openMutation({
      skill: id,
      choices: tier === 1 ? this.shuffle([...choices]).slice(0, Simulation.MUTATION_BRANCHES) : choices,
      refusalAvailable: tier === 1 && this.choiceRuntime.mutationRefusalToken,
      tier
    });
  }
  chooseMutation(index: number) {
    const m = this.mutationOffer;
    if (!m) return false;
    const id = this.choiceRuntime.mutationChoice(index);
    if (!id) return false;
    const st = this.skillState(m.skill);
    const def = mutationDef(m.skill, id);
    if (!def.parent) {
      if (st.mutation) return false;
      st.mutation = id;
    } else if (st.mutation === def.parent) {
      if (st.mutationUpgrade) return false;
      st.mutationUpgrade = id;
    } else if (st.mutationUpgrade === def.parent) {
      if (st.mutationApotheosis) return false;
      st.mutationApotheosis = id;
      this.events.push({ type: 'RareEvent', tick: this.tick, title: 'АПОФЕОЗ', detail: `${skills[m.skill].name}: ${def.name}` });
    } else return false;
    if (this.choiceRuntime.consumeMutationTarget() && this.mutationCores > 0) this.mutationCores--;
    this.metrics.mutations++;
    this.events.push({ type: 'MutationChosen', tick: this.tick, skill: m.skill, mutation: id });
    this.choiceRuntime.closeMutation();
    return true;
  }
  refuseMutation(index: number) {
    const m = this.mutationOffer;
    if (!m || !this.choiceRuntime.canRefuseMutation()) return false;
    const cur = new Set(m.choices),
      cand = mutationRoots(m.skill).map((x) => x.id).filter((id) => !cur.has(id));
    if (!cand.length) return false;
    return this.choiceRuntime.replaceMutationChoice(index, cand[this.rng.int(cand.length)]);
  }
  rerollRewards() {
    if (
      !this.rewardOffers ||
      this.rerolls <= 0 ||
      this.rewardOffers.some(
        (o) => o.kind === 'elite' || o.kind === 'mutation_target' || o.kind === 'skill_add'
      )
    )
      return false;
    this.rerolls--;
    this.generateLevelOffers();
    return true;
  }
  skipReward() {
    if (
      !this.rewardOffers ||
      this.rewardOffers.some(
        (o) => o.kind === 'elite' || o.kind === 'mutation_target' || o.kind === 'skill_add'
      )
    )
      return false;
    const passed = this.choiceRuntime.clearRewards()!;
    this.xp += this.xpNeed * 0.3;
    this.events.push({ type: 'RewardChosen', tick: this.tick, title: 'Пропуск награды' });
    this.concedeRefusal(passed);
    return true;
  }

  private isActiveSkill(id: SkillId) {
    return this.slots.includes(id);
  }
  swapSkillSlots(a: number, b: number) {
    return this.swapSkillLocations('active', a, 'active', b);
  }
  swapCatalysts(a: number, b: number) {
    return this.swapCatalystLocations('active', a, 'active', b);
  }
  swapSkillLocations(za: 'active' | 'reserve', a: number, zb: 'active' | 'reserve', b: number) {
    const A = za === 'active' ? this.slots : this.skillReserve,
      B = zb === 'active' ? this.slots : this.skillReserve;
    if (a < 0 || a >= A.length || b < 0 || b >= B.length || (A === B && a === b)) return false;
    const av = A[a],
      bv = B[b];
    if (za !== zb) {
      const leaving = za === 'active' ? av : bv;
      if (leaving) {
        const st = this.skillState(leaving);
        if (st.mutation) {
          this.mutationCores += 1 + (st.mutationUpgrade ? 1 : 0) + (st.mutationApotheosis ? 1 : 0);
          st.mutation = null;
          st.mutationUpgrade = null;
          st.mutationApotheosis = null;
        }
      }
    }
    A[a] = bv;
    B[b] = av;
    return true;
  }
  swapCatalystLocations(za: 'active' | 'reserve', a: number, zb: 'active' | 'reserve', b: number) {
    const A = za === 'active' ? this.catalysts : this.catalystReserve,
      B = zb === 'active' ? this.catalysts : this.catalystReserve;
    if (a < 0 || a >= A.length || b < 0 || b >= B.length || (A === B && a === b)) return false;
    [A[a], B[b]] = [B[b], A[a]];
    this.capacitorCharge = 0;
    return true;
  }

  configureBenchmarkLoadout(cfg: BenchmarkLoadout) {
    this.slots = Array.from({ length: 4 }, (_, i) => cfg.slots[i] ?? null);
    this.catalysts = Array.from({ length: 3 }, (_, i) => cfg.catalysts[i] ?? null);
    this.skillReserve = [null];
    this.catalystReserve = [null, null];
    this.skillsRuntime.clear();
    this.catalystRuntime.clear();
    const lvl = cfg.level ?? 7;
    for (const id of this.slots) {
      if (!id) continue;
      const st = this.newSkill(id);
      st.level = lvl;
      st.power = cfg.skillPower ?? 0.28;
      st.coverage = cfg.skillCoverage ?? 0.24;
      st.range = cfg.skillRange ?? 0.2;
      st.duration = cfg.skillDuration ?? 0.22;
      st.control = cfg.skillControl ?? 0.2;
      st.statusPotency = cfg.skillStatus ?? 0.24;
      st.eliteDamage = cfg.skillElite ?? 0.12;
      st.crit = 0.1;
      st.mutation = cfg.mutations?.[id] ?? null;
      st.mutationUpgrade = cfg.mutationUpgrades?.[id] ?? null;
      st.mutationApotheosis = cfg.mutationApotheoses?.[id] ?? null;
      this.skillsRuntime.set(id, st);
    }
    for (const id of this.catalysts) {
      if (!id) continue;
      this.catalystRuntime.set(id, { id });
    }
    this.globalPower = cfg.globalPower ?? 0.35;
    this.tempo = cfg.tempo ?? 0.2;
    this.armor = cfg.armor ?? 28;
    this.maxHp = cfg.maxHp ?? 260;
    this.php = this.maxHp;
    this.moveSpeed = cfg.moveSpeed ?? 5.2;
    this.pickupRadius = cfg.pickupRadius ?? 9;
    this.fortune = cfg.fortune ?? 0.15;
  }
  /** Diagnostic contract for regression/probe tooling; gameplay does not branch on it. */
  physicalDiagnostics() {
    return this.physical.diagnostics();
  }

  telemetry() {
    return {
      ...this.combatLedger.telemetry(),
      avgEnemies: this.metrics.enemySamples
        ? this.metrics.enemyCountSum / this.metrics.enemySamples
        : 0,
      fieldsAlive: this.fields.length,
      constructsAlive: this.constructs.length
    };
  }

  private snapshotInput(): SnapshotBuilderInput {
    const orbit = (() => {
      const runtime = this.skillsRuntime.get('orbit_blades');
      if (!runtime || !this.isActiveSkill('orbit_blades'))
        return {
          active: false,
          count: 0,
          radius: 0,
          centerX: this.px,
          centerZ: this.pz,
          mutation: null,
          apotheosis: null
        } as Snapshot['orbit'];

      const center = this.orbitCenter();
      const profile = this.orbitSystem.profile(runtime, center);
      return {
        active: true,
        count: profile.count,
        radius: profile.radius,
        centerX: center.x,
        centerZ: center.z,
        mutation: runtime.mutation,
        apotheosis: runtime.mutationApotheosis
      } as Snapshot['orbit'];
    })();

    return {
      tick: this.tick,
      time: this.time,
      runDuration: this.runDuration,
      finished: this.finished,
      mode: this.mode,
      player: {
        x: this.px,
        z: this.pz,
        hp: this.php,
        maxHp: this.maxHp,
        barrier: this.barrier,
        armor: this.armor,
        level: this.level,
        xp: this.xp,
        xpNeed: this.xpNeed,
        moveSpeed: this.moveSpeed,
        aimX: this.aimX,
        aimZ: this.aimZ,
        power: this.globalPower,
        pickupRadius: this.pickupRadius,
        fortune: this.fortune,
        dashing: this.playerMovement.isDashing(this.time),
        dashReady: this.playerMovement.isDashReady(this.time),
        dashCharge: this.playerMovement.dashCharge(this.time),
        invulnerable: this.time < this.dashIFramesUntil
      },
      entities: this.ents,
      refusalStore: this.refusalStore,
      echoFor: (entityId) => this.eliteEchoSystem.get(entityId),
      pickups: this.pickups,
      relics: this.relics,
      heldItems: this.heldItems,
      fields: this.fields,
      constructs: this.constructs,
      projectiles: this.projectiles,
      orbit,
      world: {
        minX: this.world.minX,
        maxX: this.world.maxX,
        minZ: this.world.minZ,
        maxZ: this.world.maxZ,
        pois: this.pois,
        obstacles: this.obstacles,
        bossSpawned: this.bossSpawned,
        bossDefeated: this.bossDefeated
      },
      chain: {
        beat: this.beat,
        cycle: this.cycle,
        tempo: this.effectiveTempo(),
        slots: this.slots,
        catalysts: this.catalysts,
        skillReserve: this.skillReserve,
        catalystReserve: this.catalystReserve,
        catalystRuntime: this.catalystRuntime.values()
      },
      skills: this.skillsRuntime.values(),
      resonance: this.resonance,
      doctrines: this.doctrines,
      metrics: this.metrics,
      eliteCore: this.eliteCore,
      mutationCores: this.mutationCores,
      rewardOffers: this.rewardOffers,
      refusals: this.refusalStore,
      mutationOffer: this.mutationOffer,
      rerolls: this.rerolls,
      choiceSerial: this.choiceSerial
    };
  }

  snapshot(): Snapshot {
    return this.snapshotBuilder.build(this.snapshotInput());
  }

  /**
   * Compatibility alias for the external deterministic-state contract.
   *
   * The serializer owns ordering/normalization. Keep this alias so tooling that keys baselines
   * by Simulation.CANONICAL_SCHEMA_VERSION does not need to know the implementation owner.
   */
  static readonly CANONICAL_SCHEMA_VERSION = CANONICAL_RUN_SCHEMA_VERSION;

  private canonicalInput(): CanonicalStateInput {
    return {
      mode: this.mode,
      tick: this.tick,
      rngState: this.rng.state(),
      player: {
        x: this.px,
        z: this.pz,
        hp: this.php,
        maxHp: this.maxHp,
        barrier: this.barrier,
        armor: this.armor,
        dashUntil: this.dashUntil,
        dashIFramesUntil: this.dashIFramesUntil,
        dashReadyAt: this.dashReadyAt,
        level: this.level,
        xp: this.xp,
        xpNeed: this.xpNeed
      },
      chain: {
        beat: this.beat,
        cycle: this.cycle,
        capacitorCharge: this.capacitorCharge,
        overflowCharge: this.overflowCharge,
        aegisCharge: this.aegisCharge,
        orbitChoreoUntil: this.orbitChoreoUntil,
        orbitChoreoX: this.orbitChoreoX,
        orbitChoreoZ: this.orbitChoreoZ,
        orbitChoreoCarrier: this.orbitChoreoCarrier,
        context: this.activation.context
      },
      growth: {
        tempo: this.tempo,
        globalPower: this.globalPower,
        fortune: this.fortune,
        resonance: this.resonance
      },
      economy: {
        eliteCore: this.eliteCore,
        rerolls: this.rerolls,
        mutationRefusalToken: this.mutationRefusalToken
      },
      boss: {
        spawned: this.bossSpawned,
        defeated: this.bossDefeated
      },
      loadout: {
        slots: this.slots,
        skillReserve: this.skillReserve,
        catalysts: this.catalysts,
        catalystReserve: this.catalystReserve
      },
      pois: this.pois,
      skills: this.skillsRuntime.values(),
      catalysts: this.catalystRuntime.values(),
      entities: this.ents,
      metrics: this.metrics,
      relicCount: this.relics.length,
      heldItems: this.heldItems,
      eliteLegacyItems: this.eliteLegacyItems,
      eliteEvolutionHistory: this.eliteEvolutionHistory
    };
  }

  private canonicalState(): (number | string)[] {
    return this.canonicalSerializer.serialize(this.canonicalInput());
  }

  canonicalHash() {
    return this.canonicalSerializer.hash(this.canonicalInput());
  }
}
