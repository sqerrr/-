import {
  activeSkillOrder,
  catalystOrder,
  catalysts,
  catalystPairCompatible,
  doctrineOrder,
  doctrines,
  effectGrammar,
  initialCatalystReserve,
  initialCatalysts,
  initialSkillReserve,
  initialSlots,
  rarityMultiplier,
  rarityOrder,
  mutationDef,
  mutationRoots,
  mutationChildren,
  resonance,
  resonanceOrder,
  skillOrder,
  skills,
  statBase
} from '../content/definitions.js';
import { fnv1a } from './hash.js';
import { BossBehaviorSystem } from './bossBehaviorSystem.js';
import { ConstructSystem } from './constructSystem.js';
import { DeathResolutionSystem } from './deathResolutionSystem.js';
import { DelayedStrikeSystem } from './delayedStrikeSystem.js';
import { EncounterDirector } from './encounterDirector.js';
import { EliteAffixSystem } from './eliteAffixSystem.js';
import { EliteBehaviorSystem } from './eliteBehaviorSystem.js';
import { EliteProgressionSystem } from './eliteProgressionSystem.js';
import { EnemyBehaviorSystem } from './enemyBehaviorSystem.js';
import { EntityStore } from './entityStore.js';
import { FieldSystem } from './fieldSystem.js';
import { LegacyCatalystSystem } from './legacyCatalystSystem.js';
import { OrbitSystem } from './orbitSystem.js';
import { PhysicalActivationSystem } from './physicalActivationSystem.js';
import { PhysicalCatalystSystem } from './physicalCatalystSystem.js';
import { PhysicalLifecycle } from './physicalLifecycle.js';
import { ProjectileSystem } from './projectileSystem.js';
import { Rng } from './rng.js';
import { SquadDirector } from './squadDirector.js';
import { StatusSystem } from './statusSystem.js';
import { circleIntersectsCircle, closestPointOnSegment, combatShapeIntersectsCircle, sweepCircleT } from './geometry.js';
import {
  HERO_HIT_RADIUS,
  makeEnt,
  makeHeroEnt,
  type ActivationContext,
  type CatalystBinding,
  type CastFaction,
  type CastSource,
  type ChoreographyCarrier,
  type ChoreographyPoint,
  type ChoreographyTrace,
  type Construct,
  type DelayedStrike,
  type EliteEchoState,
  type Ent,
  type Field,
  type Obstacle,
  type PhysicalEvent,
  type Pickup,
  type Poi,
  type Projectile,
  type Relic
} from './state.js';
import { items, itemOrder, itemCategoryName, itemRivalEffect } from '../content/items.js';
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
  FieldSnapshot,
  GameEvent,
  Metrics,
  MutationId,
  MutationOffer,
  PoiKind,
  PoiState,
  Rarity,
  RefusedCard,
  ResonanceId,
  ResonanceRuntime,
  RewardOffer,
  RunMode,
  SkillId,
  SkillRuntime,
  Snapshot
} from './types.js';

// Tier tables. D49 fixes the target fight lengths (8-12 / 15-25 / 30-45 s); each tier is a
// step up in durability, payout and repertoire.
/**
 * First calibration against measured contact time. elite_report put the medians at 1 / 2 / 3.3 s
 * against D49 windows centred on 10 / 20 / 37.5 - every tier short by the same factor of ten,
 * with the relative shape already right. So the tiers keep their ratio and the table is lifted
 * bodily. Kept apart from eliteHp so per-chassis identity stays readable next to the tier step.
 */
const ELITE_RARITY_HP: Record<EliteRarity, number> = { common: 2.5, uplifted: 5, legendary: 9.4 };
const ELITE_RARITY_SIZE: Record<EliteRarity, number> = {
  common: 1,
  uplifted: 1.1,
  legendary: 1.25
};

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

const baseHp: Record<Exclude<EnemyKind, 'elite' | 'hero'>, number> = {
  footnote: 42,
  bookmark: 63,
  binder: 101,
  redactor: 92,
  palimpsest: 84,
  indexer: 97,
  inkblot: 55,
  marginwalker: 76
};
const eliteHp: Record<EliteChassis, number> = {
  marshal: 980,
  hunter: 840,
  bulwark: 1320,
  architect: 1080,
  harvester: 1160,
  shepherd: 930,
  broodmaker: 1120,
  archivist: 1020,
  warden: 5600
};
const eliteSpeed: Record<EliteChassis, number> = {
  marshal: 1.02,
  hunter: 1.76,
  bulwark: 0.74,
  architect: 0.92,
  harvester: 0.9,
  shepherd: 1.08,
  broodmaker: 0.88,
  archivist: 1.02,
  warden: 0.84
};
const eliteDps: Record<EliteChassis, number> = {
  marshal: 26,
  hunter: 34,
  bulwark: 31,
  architect: 24,
  harvester: 28,
  shepherd: 26,
  broodmaker: 27,
  archivist: 27,
  warden: 42
};
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
  private eliteProgression!: EliteProgressionSystem;
  private eliteAffix!: EliteAffixSystem;
  private bossBehavior!: BossBehaviorSystem;
  private enemyBehavior!: EnemyBehaviorSystem;
  private squadDirector!: SquadDirector;
  private projectileSystem!: ProjectileSystem;
  private fieldSystem!: FieldSystem;
  private constructSystem!: ConstructSystem;
  private legacyCatalysts!: LegacyCatalystSystem;
  private orbitSystem!: OrbitSystem;
  private deathResolution!: DeathResolutionSystem;
  private delayedStrikeSystem!: DelayedStrikeSystem;
  private physicalActivations!: PhysicalActivationSystem;
  private physicalCatalysts!: PhysicalCatalystSystem;
  private nextId = 1;
  private entityStore = new EntityStore();
  /** Compatibility view for deterministic iteration and legacy regression fixtures. */
  private get ents(): Ent[] { return this.entityStore.all; }
  private set ents(value: Ent[]) { this.entityStore.replace(value); }
  // Synthetic combatant standing in for the player whenever a rival owns the cast.
  // Deliberately kept OUT of `ents` so every existing loop keeps its exact behaviour.
  private hero: Ent = makeHeroEnt();
  private pickups: Pickup[] = [];
  private relics: Relic[] = [];
  private relicAcc = 0;
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
  static readonly RELIC_INTERVAL = 20;
  static readonly RELIC_REACH = 1.2;
  static readonly RELIC_ELITE_REACH = 2.2;
  private fields: Field[] = [];
  private constructs: Construct[] = [];
  private projectiles: Projectile[] = [];
  private delayedStrikes: DelayedStrike[] = [];
  private eliteEchoes = new Map<number, EliteEchoState>();
  private readonly world = { minX: -48, maxX: 48, minZ: -36, maxZ: 36 };
  // D20 asks for a semi-open arena: islands of blockers, never corridors and never
  // an empty field. Circles cluster into organic islands and give free sliding, which
  // boxes would not. Laid out from a stream of its own so the roll cannot shift combat.
  private obstacles: Obstacle[] = [];
  private obstacleGrid = new Map<number, Obstacle[]>();
  private worldRng!: Rng;
  private static readonly OBSTACLE_CELL = 8;
  static readonly HERO_BODY_RADIUS = 0.42;
  private pois: Poi[] = [];
  private bossSpawned = false;
  private bossDefeated = false;
  private recycleAcc = 0;
  private skillsRuntime = new Map<SkillId, SkillRuntime>();
  private catalystRuntime = new Map<CatalystId, CatalystRuntime>();
  private beatAcc = 0;
  /** Shared cadence for Hunter Battery: the apotheosis is a coordinated volley, not five independent damage multipliers. */
  private moveAmount = 0;
  /**
   * D17. The window is deliberately shorter than the dash itself, so the tail of every
   * dash is exposed, and the cooldown only starts once the dash ends. Together that
   * leaves a guaranteed gap of vulnerability between windows, which is what the design
   * note means by refusing an endless chain of invulnerability. Nothing refunds a dash,
   * kills included.
   */
  static readonly DASH_SPEED = 22;
  static readonly DASH_DURATION = 0.18;
  static readonly DASH_IFRAMES = 0.13;
  static readonly DASH_COOLDOWN = 1.6;
  private dashDirX = 0;
  private dashDirZ = 0;
  private dashUntil = -99;
  private dashIFramesUntil = -99;
  private dashReadyAt = 0;
  private dashWindowSaved = false;
  private playerVX = 0;
  private playerVZ = 0;
  private directionalDamage = 0;
  private closeDamage = 0;
  private fieldDamage = 0;
  private movementSamples = 0;
  private movementSum = 0;
  private charge = 0;
  private butcherStacks = 0;
  private killsBySource = new Map<string, number>();
  private hitsBySource = new Map<string, number>();
  private previousHits = new Set<number>();
  private currentHits = new Set<number>();
  private currentActivationDamage = 0;
  private currentActivationKills = 0;
  private currentActivationOverkill = 0;
  private currentActivationControl = 0;
  private currentProducedState = '';
  private currentSlot = -1;
  private activationScale = 1;
  private capacitorCharge = 0;
  private capacitorConsumed = false;
  private overflowCharge = 0;
  private overflowConsumed = false;
  private aegisCharge = 0;
  private backflowBonus = new Map<number, number>();
  private currentChoreography: ChoreographyTrace | null = null;
  // Catalyst 2.1 lifecycle owns activation ids, causal queues and retirement bookkeeping.
  private physical = new PhysicalLifecycle();
  private statusSystem = new StatusSystem();
  private orbitChoreoUntil = -1;
  private orbitChoreoX = 0;
  private orbitChoreoZ = 0;
  private orbitChoreoCarrier: ChoreographyCarrier | null = null;
  private lastContext: ActivationContext = {
    skill: null,
    damage: 0,
    kills: 0,
    overkill: 0,
    control: 0,
    state: '',
    hitIds: [],
    x: 0,
    z: 0,
    trace: null
  };
  private damageBySource = new Map<string, number>();
  // Mirror of damageBySource for blows that landed on the player. Feeds the "what hit me"
  // half of the elite telemetry (D52). Deliberately kept out of the canonical hash.
  private damageToHeroBySource = new Map<string, number>();
  private rewardOffers: RewardOffer[] | null = null;
  private mutationOffer: MutationOffer | null = null;
  private mutationRefusalToken = true;
  private choiceSerial = 0;
  private pendingMutationTarget = false;
  private activationCountBonus = 0;
  private activationDerived = false;
  private damageSamples: { t: number; source: string; amount: number; derived: boolean }[] = [];
  /**
   * Cards the hero declined, in concession order. Elites draw their repertoire from here,
   * and D11 returns a dead elite's cards to the same store rather than destroying them.
   */
  private refusalStore: RefusedCard[] = [];
  private refusalSerial = 0;
  /**
   * Dedicated stream for deciding which declined card is conceded. Keeping it apart from
   * the combat stream means recording a refusal can never perturb the fight.
   */
  private refusalRng: Rng;
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
   * with tell -> active -> recovery in start/resolveEliteEcho below. effectGrammar remains
   * useful for ownership/LOS/reach data; it is not an excuse to mirror player geometry.
   */
  /** D28: a phenomenon forks three ways. */
  static readonly MUTATION_BRANCHES = 3;
  /**
   * Every direction of growth used to be drawn as the same letter on an elite, so six
   * different things the hero turned down were indistinguishable once they were being
   * used against him.
   */
  static readonly AXIS_GLYPH: Record<string, string> = {
    tempo: 'ТЕМП',
    multiplicity: 'ЧИСЛ',
    precision: 'ТОЧН',
    persistence: 'СРОК',
    conductivity: 'ПРОВ',
    mobility: 'ПОДВ'
  };
  static readonly STAT_GLYPH: Record<string, string> = {
    hp: 'ЗДОР',
    pickup: 'СБОР',
    fortune: 'УДАЧ',
    armor: 'БРОН'
  };
  private static rivalReach(id: SkillId): number {
    const def = skills[id];
    return Math.max(def.baseRange ?? 0, def.baseRadius ?? 0);
  }
  /**
   * Distance inside which an elite counts as being in the fight for telemetry. Set just past
   * the reach of the longest phenomenon, so the measure tracks time the hero could actually
   * be hitting it. Diagnostic only - nothing in the simulation branches on this.
   */
  /** Next moment each elite may field a refusal, keyed by entity id. */
  private rivalCastAt = new Map<number, number>();
  private eliteLog: EliteEncounter[] = [];
  private eliteLogById = new Map<number, EliteEncounter>();
  /** Held only for the length of a rival cast, so its damage can be charged to its owner. */
  private castOwner: Ent | null = null;
  private castRivalConcentration = 1;

  constructor(cfg: SimConfig) {
    this.hz = cfg.hz;
    this.dt = 1 / cfg.hz;
    this.rng = new Rng(cfg.seed);
    this.encounterDirector = new EncounterDirector(this.rng);
    this.refusalRng = new Rng((cfg.seed ^ 0x5bf03635) >>> 0);
    this.worldRng = new Rng((cfg.seed ^ 0x27d4eb2f) >>> 0);
    this.relicRng = new Rng((cfg.seed ^ 0x6a09e667) >>> 0);
    this.runDuration = cfg.runDuration ?? 480;
    this.eliteProgression = new EliteProgressionSystem({
      time: () => this.time,
      runDuration: () => this.runDuration,
      refusalStore: () => this.refusalStore,
      legacyItems: () => this.eliteLegacyItems,
      evolutionHistory: () => this.eliteEvolutionHistory,
      mainRandomInt: (maxExclusive) => this.rng.int(maxExclusive),
      relicRandomInt: (maxExclusive) => this.relicRng.int(maxExclusive)
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
      hasEcho: (entityId) => this.eliteEchoes.has(entityId),
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
      hasEcho: (entityId) => this.eliteEchoes.has(entityId),
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
      hasEcho: (entityId) => this.eliteEchoes.has(entityId),
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
      hitPlayer: (amount, attacker, source) => this.hitPlayer(amount, attacker, source),
      damageScale: () => this.damageScale()
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
      obstaclesNear: (x, z, radius) => this.obstaclesNear(x, z, radius, this.obstacleScratch),
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
      addFieldDamage: (amount) => {
        this.fieldDamage += amount;
      },
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
      damageEcho: (entity, amount, x, z) => {
        const previousDerived = this.activationDerived;
        this.activationDerived = true;
        try {
          this.damage(entity, amount, 'echo', false, x, z);
        } finally {
          this.activationDerived = previousDerived;
        }
      },
      castDerived: (skill, runtime, slot, scale) => {
        const previousSlot = this.currentSlot;
        const previousScale = this.activationScale;
        const previousDerived = this.activationDerived;
        this.currentSlot = slot;
        this.activationScale = scale;
        this.activationDerived = true;
        try {
          this.castWithTrace(skill, runtime, slot, this.heroSource());
        } finally {
          this.activationDerived = previousDerived;
          this.activationScale = previousScale;
          this.currentSlot = previousSlot;
        }
      },
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
      addCloseDamage: (amount) => {
        this.closeDamage += amount;
      },
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
        const record = this.eliteLogById.get(entity.id);
        if (record) {
          record.endedAt = this.time;
          record.killed = true;
        }
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
        this.castCatalystPayload(binding, x, z, aimX, aimZ),
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
    return !!this.rewardOffers || !!this.mutationOffer;
  }

  private initObstacles() {
    this.obstacles = [];
    // Keep the opening and every point of interest approachable.
    const safe = [{ x: 0, z: 0, r: 11 }].concat(this.pois.map((p) => ({ x: p.x, z: p.z, r: 5.5 })));
    let id = 1;
    for (let c = 0; c < 11; c++) {
      for (let attempt = 0; attempt < 30; attempt++) {
        const cx = this.worldRng.range(this.world.minX + 7, this.world.maxX - 7);
        const cz = this.worldRng.range(this.world.minZ + 7, this.world.maxZ - 7);
        if (safe.some((v) => Math.hypot(cx - v.x, cz - v.z) < v.r + 4)) continue;
        // Islands stay apart so lanes between them never close into corridors.
        if (this.obstacles.some((o) => Math.hypot(cx - o.x, cz - o.z) < 11)) continue;
        const n = 2 + this.worldRng.int(3);
        for (let i = 0; i < n; i++) {
          const a = this.worldRng.range(0, Math.PI * 2);
          const d = this.worldRng.range(0, 2.6);
          const radius = this.worldRng.range(1.5, 3);
          const oid = id++;
          // Stable by id rather than another RNG pull: adding durability must not reshuffle
          // the already calibrated arena layout. Roughly half the island pieces can be
          // opened by sustained fire; the rest remain navigation anchors.
          const destructible = oid % 2 === 0;
          const maxHp = destructible ? 72 + radius * 48 : -1;
          this.obstacles.push({
            id: oid,
            x: cx + Math.cos(a) * d,
            z: cz + Math.sin(a) * d,
            radius,
            hp: maxHp,
            maxHp,
            destructible
          });
        }
        break;
      }
    }
    this.buildObstacleGrid();
  }
  private obstacleCellKey(cx: number, cz: number) {
    return (cx + 512) * 4096 + (cz + 512);
  }
  private buildObstacleGrid() {
    this.obstacleGrid.clear();
    const c = Simulation.OBSTACLE_CELL;
    for (const o of this.obstacles) {
      const x0 = Math.floor((o.x - o.radius) / c);
      const x1 = Math.floor((o.x + o.radius) / c);
      const z0 = Math.floor((o.z - o.radius) / c);
      const z1 = Math.floor((o.z + o.radius) / c);
      for (let gx = x0; gx <= x1; gx++)
        for (let gz = z0; gz <= z1; gz++) {
          const k = this.obstacleCellKey(gx, gz);
          const bucket = this.obstacleGrid.get(k);
          if (bucket) bucket.push(o);
          else this.obstacleGrid.set(k, [o]);
        }
    }
  }
  private obstaclesNear(x: number, z: number, radius: number, out: Obstacle[]) {
    out.length = 0;
    const c = Simulation.OBSTACLE_CELL;
    const x0 = Math.floor((x - radius) / c);
    const x1 = Math.floor((x + radius) / c);
    const z0 = Math.floor((z - radius) / c);
    const z1 = Math.floor((z + radius) / c);
    for (let gx = x0; gx <= x1; gx++)
      for (let gz = z0; gz <= z1; gz++) {
        const bucket = this.obstacleGrid.get(this.obstacleCellKey(gx, gz));
        if (!bucket) continue;
        for (const o of bucket) if (out.indexOf(o) < 0) out.push(o);
      }
    return out;
  }
  private obstacleScratch: Obstacle[] = [];
  // Returns the nearest free position for a body of this radius. Two passes, because
  // being pushed clear of one circle can bury the body in its neighbour.
  private freeOf(x: number, z: number, radius: number) {
    for (let pass = 0; pass < 2; pass++) {
      const near = this.obstaclesNear(x, z, radius, this.obstacleScratch);
      let moved = false;
      for (const o of near) {
        const dx = x - o.x;
        const dz = z - o.z;
        const min = o.radius + radius;
        const d = Math.hypot(dx, dz);
        if (d >= min) continue;
        moved = true;
        if (d < 1e-4) {
          x = o.x + min;
          continue;
        }
        const k = (min - d) / d;
        x += dx * k;
        z += dz * k;
      }
      if (!moved) break;
    }
    return { x, z };
  }
  private blocked(x: number, z: number, radius: number) {
    const near = this.obstaclesNear(x, z, radius, this.obstacleScratch);
    for (const o of near) if (Math.hypot(x - o.x, z - o.z) < o.radius + radius) return true;
    return false;
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

  private segmentCircleT(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    cx: number,
    cz: number,
    radius: number
  ) {
    return sweepCircleT(x0, z0, x1, z1, cx, cz, radius);
  }

  private firstBlockingObstacleHit(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    padding = 0.08
  ) {
    const mx = (x0 + x1) * 0.5,
      mz = (z0 + z1) * 0.5,
      reach = Math.hypot(x1 - x0, z1 - z0) * 0.5 + 3.4 + padding;
    let best: Obstacle | null = null,
      bestT = Infinity;
    for (const o of this.obstaclesNear(mx, mz, reach, this.obstacleScratch)) {
      const t = this.segmentCircleT(x0, z0, x1, z1, o.x, o.z, o.radius + padding);
      if (t !== null && t > 0.01 && t < 0.99 && t < bestT) {
        best = o;
        bestT = t;
      }
    }
    return best ? { obstacle: best, t: bestT } : null;
  }

  private firstBlockingObstacle(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    padding = 0.08
  ) {
    return this.firstBlockingObstacleHit(x0,z0,x1,z1,padding)?.obstacle ?? null;
  }

  private lineOfSight(x0: number, z0: number, x1: number, z1: number, padding = 0.08) {
    return !this.firstBlockingObstacleHit(x0, z0, x1, z1, padding);
  }

  private damageObstacle(o: Obstacle, amount: number) {
    if (!o.destructible || o.hp <= 0) return false;
    o.hp -= Math.max(0, amount);
    if (o.hp > 0) return false;
    const at = this.obstacles.indexOf(o);
    if (at >= 0) this.obstacles.splice(at, 1);
    this.buildObstacleGrid();
    return true;
  }

  private spawnProjectile(p: Omit<Projectile, 'id' | 'guarded'>) {
    const id = this.nextId++,
      activationId = p.faction === 'hero' ? (p.activationId ?? this.physical.currentActivationId) : 0;
    this.projectiles.push({ id, guarded: false, ...p, activationId });
    if (activationId) this.registerAsyncPhysical(activationId);
    if (
      this.currentChoreography &&
      p.faction === 'hero' &&
      p.sourceSlot === this.currentSlot &&
      p.source === this.currentChoreography.skill
    ) {
      // For an async path Phenomenon, the first real moving body owns the route origin.
      // This matters when the cast itself displaced its source (Mass recoil) or spawns offset shards.
      if (
        this.currentChoreography.carriers.length===0 &&
        (p.source==='mass_driver'||p.source==='shard_fan')
      ) {
        this.currentChoreography.origin={x:p.x,z:p.z};
        if(activationId)this.physical.setLastPoint(activationId,{x:p.x,z:p.z});
      }
      this.currentChoreography.carriers.push({ kind: 'projectile', id });
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
    if (
      this.currentChoreography &&
      strike.faction === 'hero' &&
      strike.sourceSlot === this.currentSlot
    ) {
      // This is a PLAN only. It is deliberately excluded from terminal/area/path truth.
      this.currentChoreography.scheduled.push({ x: strike.x, z: strike.z });
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
    // Build sources are intentionally distributed around the opening instead of hiding the
    // whole run behind two far-away weapon nodes. The exact rewards stay random; the route to
    // *a* build decision must be visible and reachable from several directions.
    this.pois = [
      { id: 1, kind: 'phenomenon', x: 14, z: -7, state: 'dormant', guardianId: 0 },
      { id: 2, kind: 'catalyst', x: -19, z: 9, state: 'dormant', guardianId: 0 },
      { id: 3, kind: 'resonance', x: -34, z: -23, state: 'dormant', guardianId: 0 },
      { id: 4, kind: 'vital', x: 2, z: 29, state: 'dormant', guardianId: 0 },
      { id: 5, kind: 'phenomenon', x: 34, z: 21, state: 'dormant', guardianId: 0 },
      { id: 6, kind: 'catalyst', x: 35, z: -23, state: 'dormant', guardianId: 0 },
      { id: 7, kind: 'phenomenon', x: -9, z: 15, state: 'dormant', guardianId: 0 },
      { id: 8, kind: 'vital', x: -23, z: -14, state: 'dormant', guardianId: 0 }
    ];
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
    for (let i = 0; i < 12; i++) {
      const a = this.rng.range(0, Math.PI * 2),
        r = this.rng.range(min, max),
        x = this.px + Math.cos(a) * r,
        z = this.pz + Math.sin(a) * r;
      if (
        x > this.world.minX + 1 &&
        x < this.world.maxX - 1 &&
        z > this.world.minZ + 1 &&
        z < this.world.maxZ - 1 &&
        !this.blocked(x, z, 0.9)
      )
        return { x, z };
    }
    const a = this.rng.range(0, Math.PI * 2),
      r = min;
    return {
      x: Math.max(this.world.minX + 1, Math.min(this.world.maxX - 1, this.px + Math.cos(a) * r)),
      z: Math.max(this.world.minZ + 1, Math.min(this.world.maxZ - 1, this.pz + Math.sin(a) * r))
    };
  }
  private updatePoiDirector() {
    if (this.bossSpawned) return;
    for (const p of this.pois) {
      if (p.state !== 'dormant') continue;
      if (Math.hypot(this.px - p.x, this.pz - p.z) <= 3.0) {
        p.state = 'guarded';
        p.guardianId = 0;
        this.events.push({
          type: 'PoiAwakened',
          tick: this.tick,
          poi: p.id,
          kind: p.kind,
          x: p.x,
          z: p.z,
          guardian: 0
        });
        this.completePoi(p.id);
      }
    }
  }

  private completePoi(id: number) {
    const p = this.pois.find((q) => q.id === id);
    if (!p || p.state === 'cleared') return;
    p.state = 'cleared';
    p.guardianId = 0;
    this.events.push({
      type: 'PoiCleared',
      tick: this.tick,
      poi: p.id,
      kind: p.kind,
      x: p.x,
      z: p.z
    });
    if (p.kind === 'vital') {
      this.healPlayer(Math.max(45, this.maxHp * 0.42));
      this.grantBarrier(20);
      return;
    }
    if (this.hasChoice) return;
    if (p.kind === 'phenomenon') {
      if (this.skillOrderUnowned().length) this.generateDiscovery();
      else this.generateResonanceChoice();
      return;
    }
    if (p.kind === 'catalyst') {
      this.generateCatalystDiscovery();
      return;
    }
    this.generateResonanceChoice();
  }
  private generateCatalystDiscovery() {
    const owned = this.allOwnedCatalysts(),
      unowned = catalystOrder.filter((id) => !owned.includes(id)),
      useful = unowned.filter((id) => this.catalystCompatibleEdges(id).length > 0),
      pool = useful.length ? useful : unowned;
    if (!pool.length) {
      this.generateLevelOffers();
      return;
    }
    this.rewardOffers = this.shuffle([...pool])
      .slice(0, 3)
      .map((id) => this.makeCatalystAdd(id));
    this.choiceSerial++;
  }
  private generateResonanceChoice() {
    const ids = this.shuffle([...resonanceOrder]).slice(0, 3);
    this.rewardOffers = ids.map((id) => this.makeResonanceOffer(id));
    this.choiceSerial++;
  }
  private bossDirector() {
    if (this.encounterDirector.shouldSpawnBoss(this.time, this.runDuration, this.bossSpawned))
      this.spawnBoss();
  }
  private bossSupportForPoi(kind: PoiKind): [EliteChassis, EliteAffix] {
    if (kind === 'phenomenon') return ['hunter', 'shielded'];
    if (kind === 'catalyst') return ['architect', 'vanguard'];
    if (kind === 'resonance') return ['bulwark', 'temporal'];
    return ['harvester', 'brood'];
  }
  private spawnBossSupport(kind: PoiKind, bossX: number, bossZ: number, index: number) {
    const [chassis, affix] = this.bossSupportForPoi(kind),
      a = 0.8 + index * Math.PI * 0.88,
      r = 3.2 + index * 0.55,
      x = Math.max(this.world.minX + 1, Math.min(this.world.maxX - 1, bossX + Math.cos(a) * r)),
      z = Math.max(this.world.minZ + 1, Math.min(this.world.maxZ - 1, bossZ + Math.sin(a) * r));
    const hp = eliteHp[chassis] * this.worldScale() * 0.66,
      e = makeEnt({
        id: this.nextId++,
        kind: 'elite',
        x,
        z,
        hp,
        radius: chassis === 'bulwark' ? 1.02 : 0.9,
        speed: eliteSpeed[chassis],
        contactDps: eliteDps[chassis] * this.damageScale(),
        cooldown: this.rng.range(1.3, 2.5),
        chassis,
        affix,
        adaptAt: hp * 0.55,
        guardianPoi: -1
      });
    this.entityStore.add(e);
    this.metrics.spawned++;
    this.metrics.eliteSpawned++;
    this.events.push({
      type: 'EntitySpawned',
      tick: this.tick,
      entity: e.id,
      kind: 'elite',
      x,
      z,
      chassis,
      affix
    });
  }
  private spawnBoss() {
    this.bossSpawned = true;
    const x = this.px < 0 ? 34 : -34,
      z = this.pz < 0 ? 24 : -24,
      ecosystemMass = this.eliteLegacyItems.length + this.eliteEvolutionHistory.length,
      hp = eliteHp.warden * this.worldScale() * (4.15 + Math.min(1.55, ecosystemMass * 0.035));
    const e = makeEnt({
      id: this.nextId++,
      kind: 'elite',
      x,
      z,
      hp,
      radius: 1.42,
      speed: eliteSpeed.warden,
      contactDps: eliteDps.warden * this.damageScale() * 1.22,
      cooldown: 1.8,
      chassis: 'warden',
      boss: true,
      bossPhase: 1,
      rarity: 'legendary'
    });
    // The finale is the enemy ecosystem's payoff: a late legendary repertoire plus every
    // distinct relic effect elites managed to capture during the run.
    this.claimRepertoire(e);
    this.inheritEliteLegacy(e, true);
    this.inheritEliteEvolution(e);
    this.entityStore.add(e);
    this.metrics.spawned++;
    this.metrics.eliteSpawned++;
    this.events.push({
      type: 'EntitySpawned',
      tick: this.tick,
      entity: e.id,
      kind: 'elite',
      x,
      z,
      chassis: 'warden',
      affix: 'none',
      boss: true
    });
    // Exploration must affect the finale without hiding power in a scalar debuff. If the player ignored the archive, visible POI guardians join the boss.
    const unresolved = this.pois.filter((p) => p.state !== 'cleared'),
      cleared = this.pois.length - unresolved.length,
      desiredSupports = cleared >= 4 ? 0 : cleared >= 2 ? 1 : 2;
    const activePoiGuardians = this.entityStore.countAlive(
      (o) => o.kind === 'elite' && !o.boss && o.guardianPoi > 0
    );
    let spawned = 0;
    for (const p of unresolved) {
      if (activePoiGuardians + spawned >= desiredSupports) break;
      if (p.state === 'guarded') continue;
      this.spawnBossSupport(p.kind, x, z, spawned);
      spawned++;
    }
    const supports = Math.min(desiredSupports, activePoiGuardians + spawned);
    this.events.push({
      type: 'BossSpawned',
      tick: this.tick,
      entity: e.id,
      x,
      z,
      supports,
      uncleared: unresolved.length
    });
  }
  private recycleFarEnemies() {
    this.recycleAcc += this.dt;
    if (this.recycleAcc < 0.35) return;
    this.recycleAcc = 0;
    for (const e of this.ents) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - this.px, e.z - this.pz);
      if (e.kind !== 'elite' && d > 29) {
        const q = this.pointAroundPlayer(14, 19);
        e.x = q.x;
        e.z = q.z;
        e.orderUntil = 0;
        e.state = 'normal';
        e.stateTimer = 0;
        continue;
      }
      if (e.kind === 'elite' && d > (e.boss ? 38 : 33)) {
        const q = this.pointAroundPlayer(e.boss ? 11 : 12, e.boss ? 15 : 16);
        e.x = q.x;
        e.z = q.z;
        e.state = 'normal';
        e.stateTimer = 0;
        e.adaptStage = 0;
        this.events.push({
          type: 'EliteReacquired',
          tick: this.tick,
          entity: e.id,
          x: e.x,
          z: e.z
        });
      }
    }
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
    const mag = Math.hypot(cmd.moveX, cmd.moveZ);
    this.moveAmount = Math.min(1, mag);
    this.playerVX = 0;
    this.playerVZ = 0;
    if (cmd.dash && this.time >= this.dashUntil && this.time >= this.dashReadyAt) {
      let dx = cmd.moveX,
        dz = cmd.moveZ,
        dm = Math.hypot(dx, dz);
      if (dm <= 0.001) {
        dx = this.aimX;
        dz = this.aimZ;
        dm = 1;
      }
      this.dashDirX = dx / dm;
      this.dashDirZ = dz / dm;
      this.dashUntil = this.time + Simulation.DASH_DURATION;
      this.dashIFramesUntil = this.time + Simulation.DASH_IFRAMES * this.dashIFrameMul;
      this.dashReadyAt = this.dashUntil + Simulation.DASH_COOLDOWN * this.dashCooldownMul;
      this.dashWindowSaved = false;
      this.metrics.dashes++;
      for (const record of this.eliteLog) {
        if (
          record.engagedAt >= 0 &&
          record.endedAt < 0 &&
          record.lastExchangeAt >= 0 &&
          this.time - record.lastExchangeAt <= 2
        )
          record.dashes++;
      }
    }
    if (this.time < this.dashUntil) {
      this.moveAmount = 1;
      this.playerVX = this.dashDirX * Simulation.DASH_SPEED;
      this.playerVZ = this.dashDirZ * Simulation.DASH_SPEED;
      this.px += this.playerVX * this.dt;
      this.pz += this.playerVZ * this.dt;
      this.clampWorld();
    } else if (mag > 0.001) {
      this.playerVX = (cmd.moveX / mag) * this.moveSpeed;
      this.playerVZ = (cmd.moveZ / mag) * this.moveSpeed;
      this.px += this.playerVX * this.dt;
      this.pz += this.playerVZ * this.dt;
      this.clampWorld();
    }
    this.movementSamples++;
    this.movementSum += this.moveAmount;
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
    const q = this.pointAroundPlayer(13.5, 19.5);
    this.spawnEnemyAt(kind, q.x, q.z);
  }
  private spawnEnemyAt(
    kind: Exclude<EnemyKind, 'elite' | 'hero'>,
    x: number,
    z: number,
    buffedFor = 0,
    cloneParent = 0
  ) {
    const normalCount = this.entityStore.countAlive((e) => e.kind !== 'elite');
    if (normalCount >= 198) return;
    if (buffedFor > 0 && normalCount >= Math.min(180, this.populationTarget() + 18)) return;
    const scale = this.worldScale(),
      hp = baseHp[kind] * scale;
    const speed =
      kind === 'bookmark'
        ? 1.32
        : kind === 'marginwalker'
          ? 1.64
          : kind === 'footnote'
            ? 1.23
            : kind === 'binder'
              ? 0.91
              : kind === 'redactor'
                ? 0.98
                : kind === 'indexer'
                  ? 0.96
                  : kind === 'inkblot'
                    ? 1.14
                    : 1.17;
    const dps =
      (kind === 'bookmark'
        ? 19
        : kind === 'inkblot'
          ? 15
          : kind === 'marginwalker'
            ? 16
            : kind === 'binder'
              ? 12
              : kind === 'redactor'
                ? 13
                : kind === 'indexer'
                  ? 13
                  : 14) *
      this.damageScale() *
      0.42;
    const e = makeEnt({
      id: this.nextId++,
      kind,
      cloneParent: cloneParent || undefined,
      x,
      z,
      hp,
      radius: kind === 'binder' || kind === 'redactor' || kind === 'indexer' ? 0.58 : 0.46,
      speed,
      contactDps: dps,
      cooldown: this.rng.range(0.3, 1.9),
      revivesLeft: kind === 'palimpsest' ? 1 : 0,
      buffUntil: buffedFor > 0 ? this.time + buffedFor : 0
    });
    this.entityStore.add(e);
    this.metrics.spawned++;
    this.events.push({
      type: 'EntitySpawned',
      tick: this.tick,
      entity: e.id,
      kind,
      x: e.x,
      z: e.z
    });
    return e;
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
  /** D9: higher tiers become steadily more common as the run wears on. */
  private rollEliteRarity(): EliteRarity {
    const t = Math.min(1, this.time / this.runDuration);
    const r = this.rng.float();
    if (r < 0.02 + 0.18 * t) return 'legendary';
    if (r < 0.2 + 0.45 * t) return 'uplifted';
    return 'common';
  }
  /**
   * Active affixes were implemented but ordinary elites had been hard-wired to 'none'.
   * Reintroduce them as a run-depth layer: early elites teach the chassis first, later
   * tiers combine one chassis question with one affix question.
   */
  private rollEliteAffix(rarity: EliteRarity): EliteAffix {
    const t = Math.min(1, this.time / this.runDuration);
    // The first minute teaches chassis language before combinations appear.
    if (t < 0.12) return 'none';
    if (rarity === 'common') {
      if (t < 0.12 || this.rng.float() < 0.58 - t * 0.18) return 'none';
      const pool: EliteAffix[] = ['regenerating', 'volatile', 'shielded'];
      return pool[this.rng.int(pool.length)];
    }
    if (rarity === 'uplifted') {
      if (this.rng.float() < 0.12) return 'none';
      const pool: EliteAffix[] = ['regenerating', 'shielded', 'vanguard', 'temporal', 'brood'];
      return pool[this.rng.int(pool.length)];
    }
    const pool: EliteAffix[] = ['crowned', 'shielded', 'vanguard', 'temporal', 'brood'];
    return pool[this.rng.int(pool.length)];
  }
  /**
   * Refusal repertoire is learned ecosystem knowledge. Early encounters are intentionally
   * narrow for readability; later elites can carry a much broader selection.
   */
  private eliteRepertoireCapacity(e: Ent) {
    return this.eliteProgression.repertoireCapacity(e);
  }
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
  private applyRefusedAxes(e: Ent) {
    this.eliteProgression.applyRefusedAxes(e);
  }
  /** heldBy is first-carrier bookkeeping; death clears that marker, not ecosystem knowledge. */
  private releaseRepertoire(e: Ent) {
    this.rivalCastAt.delete(e.id);
    this.eliteEchoes.delete(e.id);
    this.eliteProgression.releaseRepertoire(e);
  }

  /**
   * The payoff of the draft: an elite turns a phenomenon the hero declined back on them.
   * Cadence and reach are deliberately slack - the point here is that the link reads, and
   * D49 calibration only becomes possible once the telemetry of step 11 exists.
   */
  private echoTellDuration(id: SkillId) {
    if (id === 'rail_spear') return 0.92;
    if (id === 'mortar_bloom') return 0.78;
    if (id === 'mass_driver') return 0.74;
    if (id === 'tether_drag') return 0.86;
    if (id === 'cleaver') return 0.58;
    return 0.68;
  }

  private echoTelegraph(q: EliteEchoState) {
    const push = (shape: CombatShape, intent: 'damage' | 'control' | 'field' = 'damage', suffix = '') =>
      this.events.push({ type: 'CombatShape', tick: this.tick, source: `echo_${q.skill}_tell${suffix}`, intent, shape });
    if (q.skill === 'rail_spear' || q.skill === 'mass_driver' || q.skill === 'breach_line') {
      push({ kind: 'ray', x: q.x, z: q.z, aimX: q.aimX, aimZ: q.aimZ, range: q.skill === 'rail_spear' ? 26 : 19, halfWidth: q.skill === 'rail_spear' ? 0.42 : 0.95 });
      return;
    }
    if (q.skill === 'cleaver' || q.skill === 'contact_saw' || q.skill === 'backhand') {
      push({ kind: 'sector', x: q.x, z: q.z, radius: 3.4, aimX: q.aimX, aimZ: q.aimZ, halfAngle: 0.9 });
      return;
    }
    if (q.skill === 'frost_ring' || q.skill === 'spreading_front') {
      push({ kind: 'circle', x: q.targetX, z: q.targetZ, radius: 2.4 }, 'control');
      return;
    }
    if (q.skill === 'chain_arc') {
      for (let i=0;i<3;i++) { const a=i*Math.PI*2/3; push({kind:'circle',x:q.targetX+Math.cos(a)*2.2,z:q.targetZ+Math.sin(a)*2.2,radius:1.05},'damage',`_${i}`); }
      return;
    }
    if (q.skill === 'orbit_blades') {
      push({ kind:'circle', x:q.x, z:q.z, radius:3.0 }, 'damage');
      return;
    }
    if (q.skill === 'mortar_bloom' || q.skill === 'pin_burst') {
      for(let i=0;i<3;i++) push({kind:'circle',x:q.targetX+q.aimX*i*1.1,z:q.targetZ+q.aimZ*i*1.1,radius:1.35},'damage',`_${i}`);
      return;
    }
    if (q.skill === 'sentry') {
      const px=-q.aimZ,pz=q.aimX;
      for(const side of [-1,1]) push({kind:'ray',x:q.x+px*side*1.5,z:q.z+pz*side*1.5,aimX:q.aimX,aimZ:q.aimZ,range:10,halfWidth:0.24},'damage',side<0?'_l':'_r');
      return;
    }
    if (q.skill === 'toxic_mist') {
      for(let i=0;i<3;i++) push({kind:'circle',x:q.targetX-q.aimX*i*1.2,z:q.targetZ-q.aimZ*i*1.2,radius:1.35},'field',`_${i}`);
      return;
    }
    if (q.skill === 'shard_fan') {
      push({kind:'ray',x:q.x,z:q.z,aimX:q.aimX,aimZ:q.aimZ,range:16,halfWidth:1.15});
      return;
    }
    if (q.skill === 'tether_drag') {
      push({ kind: 'circle', x: q.targetX, z: q.targetZ, radius: 1.05 }, 'control');
      return;
    }
    push({ kind: 'circle', x: q.targetX, z: q.targetZ, radius: 1.4 });
  }

  private startEliteEcho(e: Ent, card: RefusedCard) {
    const id = card.skill as SkillId;
    const dx = this.px - e.x, dz = this.pz - e.z, m = Math.hypot(dx, dz) || 1;
    const q: EliteEchoState = {
      entityId: e.id, skill: id, serial: card.serial, phase: 'tell',
      until: this.time + this.echoTellDuration(id), x: e.x, z: e.z,
      aimX: dx / m, aimZ: dz / m,
      targetX: this.px + this.playerVX * 0.28, targetZ: this.pz + this.playerVZ * 0.28
    };
    this.eliteEchoes.set(e.id, q);
    this.events.push({ type: 'EliteEchoPhase', tick: this.tick, entity: e.id, skill: id, phase: 'tell', x: e.x, z: e.z, aimX: q.aimX, aimZ: q.aimZ });
    this.echoTelegraph(q);
  }

  private resolveEliteEcho(e: Ent, q: EliteEchoState) {
    const dmg = (n: number, source: DamageSourceId = `echo_${q.skill}`) => this.damageHero(n * this.damageScale(), source, e, 1);
    const hitRay = (range: number, width: number, amount: number) => {
      if (!this.lineOfSight(q.x, q.z, this.px, this.pz, width * 0.2)) return;
      const dx = this.px - q.x, dz = this.pz - q.z, t = dx * q.aimX + dz * q.aimZ;
      const lat = Math.abs(dx * q.aimZ - dz * q.aimX);
      if (t >= 0 && t <= range && lat <= width + HERO_HIT_RADIUS) dmg(amount);
    };
    if (q.skill === 'rail_spear') {
      this.combatShape('echo_rail_spear_active', { kind: 'ray', x: q.x, z: q.z, aimX: q.aimX, aimZ: q.aimZ, range: 26, halfWidth: 0.42 });
      hitRay(26, 0.42, 34);
    } else if (q.skill === 'frost_ring' || q.skill === 'spreading_front') {
      const px = -q.aimZ, pz = q.aimX;
      for (const side of [-1, 1]) this.scheduleStrike({ at: this.time + 0.22, x: q.targetX + px * side * 2.2, z: q.targetZ + pz * side * 2.2, radius: 1.55, damage: 18 * this.damageScale(), faction: 'rival', ownerId: e.id, source: q.skill, sourceSlot: -1, intent: 'control', telegraph: `echo_${q.skill}_front` });
      this.fields.push({ id: this.nextId++, x: q.targetX, z: q.targetZ, radius: 1.45, ttl: 2.3, kind: 'frost', dps: 10 * this.damageScale(), tickAcc: 0, faction: 'rival', ownerId: e.id, source: q.skill, sourceSlot: -1, mutation: null, rivalConcentration: 1 });
    } else if (q.skill === 'cleaver' || q.skill === 'contact_saw' || q.skill === 'backhand') {
      this.combatShape(`echo_${q.skill}_active`, { kind: 'sector', x: q.x, z: q.z, radius: 3.4, aimX: q.aimX, aimZ: q.aimZ, halfAngle: 0.9 });
      const dx = this.px-q.x, dz=this.pz-q.z, d=Math.hypot(dx,dz)||1, dot=(dx/d)*q.aimX+(dz/d)*q.aimZ;
      if (d <= 3.4 + HERO_HIT_RADIUS && dot > Math.cos(0.9)) dmg(28);
    } else if (q.skill === 'chain_arc') {
      for (let i=0;i<3;i++) {
        const a = i*Math.PI*2/3 + Math.atan2(q.aimZ,q.aimX);
        this.scheduleStrike({ at:this.time+0.18+i*0.1, x:q.targetX+Math.cos(a)*2.2, z:q.targetZ+Math.sin(a)*2.2, radius:1.05, damage:14*this.damageScale(), faction:'rival', ownerId:e.id, source:q.skill, sourceSlot:-1, intent:'damage', telegraph:'echo_chain_node' });
      }
    } else if (q.skill === 'orbit_blades') {
      const gap = this.rng.int(7);
      for (let i=0;i<7;i++) if (i!==gap) {
        const a=i*Math.PI*2/7, speed=5.1;
        this.spawnProjectile({ x:e.x+Math.cos(a)*1.3, z:e.z+Math.sin(a)*1.3, vx:Math.cos(a)*speed, vz:Math.sin(a)*speed, radius:0.26, ttl:2.1, damage:14*this.damageScale(), coverDamage:8, faction:'rival', ownerId:e.id, source:'orbit_blades', sourceSlot:-1, mutation:null, rivalConcentration:1, behavior:'echo', phase:0, hitIds:[] });
      }
    } else if (q.skill === 'mortar_bloom' || q.skill === 'pin_burst') {
      for (let i=0;i<3;i++) this.scheduleStrike({ at:this.time+0.28+i*0.24, x:q.targetX+this.playerVX*i*0.18, z:q.targetZ+this.playerVZ*i*0.18, radius:1.35, damage:19*this.damageScale(), faction:'rival', ownerId:e.id, source:q.skill, sourceSlot:-1, intent:'damage', telegraph:'echo_bombardment' });
    } else if (q.skill === 'sentry') {
      const perpX=-q.aimZ, perpZ=q.aimX;
      for (const side of [-1,1]) {
        const sx=e.x+perpX*side*1.5, sz=e.z+perpZ*side*1.5, dx=q.targetX-sx, dz=q.targetZ-sz, m=Math.hypot(dx,dz)||1;
        this.spawnProjectile({ x:sx,z:sz,vx:dx/m*7.2,vz:dz/m*7.2,radius:0.22,ttl:2.2,damage:18*this.damageScale(),coverDamage:12,faction:'rival',ownerId:e.id,source:'sentry',sourceSlot:-1,mutation:null,rivalConcentration:1,behavior:'echo',phase:0,hitIds:[] });
      }
    } else if (q.skill === 'toxic_mist') {
      for (let i=0;i<3;i++) this.fields.push({ id:this.nextId++, x:q.targetX-this.playerVX*0.25*i, z:q.targetZ-this.playerVZ*0.25*i, radius:1.35, ttl:2.8, kind:'toxic', dps:8*this.damageScale(), tickAcc:0, faction:'rival', ownerId:e.id, source:q.skill, sourceSlot:-1, mutation:null, rivalConcentration:1 });
    } else if (q.skill === 'mass_driver') {
      this.spawnProjectile({ x:e.x,z:e.z,vx:q.aimX*3.8,vz:q.aimZ*3.8,radius:0.72,ttl:5.0,damage:28*this.damageScale(),coverDamage:75,faction:'rival',ownerId:e.id,source:'mass_driver',sourceSlot:-1,mutation:null,rivalConcentration:1,behavior:'roller',phase:0,hitIds:[],growth:0 });
    } else if (q.skill === 'shard_fan') {
      const perpX=-q.aimZ, perpZ=q.aimX;
      for (const side of [-0.45,0,0.45]) {
        const ax=q.aimX+perpX*side, az=q.aimZ+perpZ*side, m=Math.hypot(ax,az)||1;
        this.spawnProjectile({ x:e.x,z:e.z,vx:ax/m*6.4,vz:az/m*6.4,radius:0.24,ttl:2.6,damage:15*this.damageScale(),coverDamage:10,faction:'rival',ownerId:e.id,source:'shard_fan',sourceSlot:-1,mutation:null,rivalConcentration:1,behavior:'returner',returnAt:1.25,phase:0,hitIds:[] });
      }
    } else if (q.skill === 'tether_drag') {
      this.combatShape('echo_tether_active', {kind:'circle',x:q.targetX,z:q.targetZ,radius:1.05}, 'control');
      const dx=q.targetX-this.px,dz=q.targetZ-this.pz,d=Math.hypot(dx,dz)||1;
      if (d < 7.5) { this.px += dx/d*Math.min(1.8,d*0.32); this.pz += dz/d*Math.min(1.8,d*0.32); dmg(10,'echo_tether_drag'); }
    } else {
      this.spawnProjectile({ x:e.x,z:e.z,vx:q.aimX*5.4,vz:q.aimZ*5.4,radius:0.28,ttl:3,damage:17*this.damageScale(),coverDamage:8,faction:'rival',ownerId:e.id,source:q.skill,sourceSlot:-1,mutation:null,rivalConcentration:1,behavior:'echo',phase:0,hitIds:[] });
    }
  }

  private updateEliteEchoes() {
    for (const [id,q] of [...this.eliteEchoes]) {
      const e=this.entityStore.getAlive(id);
      if (!e) { this.eliteEchoes.delete(id); continue; }
      if (this.time + 1e-9 < q.until) continue;
      if (q.phase === 'tell') {
        q.phase='active'; q.until=this.time+0.14;
        this.events.push({type:'EliteEchoPhase',tick:this.tick,entity:e.id,skill:q.skill,phase:'active',x:e.x,z:e.z,aimX:q.aimX,aimZ:q.aimZ});
        this.resolveEliteEcho(e,q);
        this.metrics.rivalCasts++;
        const record=this.eliteLogById.get(e.id); if(record){record.casts++; record.castSkills[q.skill]=(record.castSkills[q.skill]??0)+1;}
        this.events.push({type:'RivalCast',tick:this.tick,entity:e.id,skill:q.skill,serial:q.serial,x:e.x,z:e.z});
      } else if (q.phase === 'active') {
        q.phase='recovery'; q.until=this.time+(q.skill==='rail_spear'?0.9:0.68);
        this.events.push({type:'EliteEchoPhase',tick:this.tick,entity:e.id,skill:q.skill,phase:'recovery',x:e.x,z:e.z,aimX:q.aimX,aimZ:q.aimZ});
      } else {
        this.eliteEchoes.delete(id);
        const rawGap=Math.max(2.25,this.rng.range(3.4,5.0)-e.repertoire.length*0.22);
        const gap=this.elitePatternCooldown(rawGap,e)*Math.pow(0.86,this.rivalAxisCount(e,'tempo'));
        this.rivalCastAt.set(e.id,this.time+gap);
      }
    }
  }

  /**
   * A declined Phenomenon is inherited as an Elite Echo, never as the player's cast. The
   * fantasy is recognisable, but its duel grammar is authored around one hero and always
   * exposes tell -> active -> recovery.
   */
  private fieldRefusals(e: Ent, d: number) {
    if (e.hp <= 0 || !e.repertoire.length || this.eliteEchoes.has(e.id)) return;
    const ready=this.rivalCastAt.get(e.id);
    if (ready===undefined){this.rivalCastAt.set(e.id,this.time+this.rng.range(2.6,4.6));return;}
    if(this.time<ready)return;
    const usable=e.repertoire.map(serial=>this.refusalStore.find(c=>c.serial===serial)).filter((c):c is RefusedCard=>!!c&&!!c.skill&&d<=Simulation.rivalReach(c.skill as SkillId)*(e.relicReachMul??1)&&(!effectGrammar[c.skill as SkillId].blockedByCover||this.lineOfSight(e.x,e.z,this.px,this.pz,0.12)));
    if(!usable.length){const holds=e.repertoire.some(serial=>{const c=this.refusalStore.find(x=>x.serial===serial);return !!c&&!!c.skill;});this.rivalCastAt.set(e.id,this.time+(holds?0.35:4));return;}
    this.startEliteEcho(e,usable[this.rng.int(usable.length)]);
  }
  /**
   * Accumulates the seconds an elite spends inside the hero's reach. Wall-clock from the first
   * blow to the death overstates the fight badly: a tougher elite survives the first exchange,
   * wanders off and comes back, and the clock keeps running through the gap.
   */
  private noteEliteContact(e: Ent, _d: number) {
    const record = this.eliteLogById.get(e.id);
    if (!record || record.engagedAt < 0 || record.lastExchangeAt < 0) return;
    // D49 is time actually spent exchanging blows, not time an elite happens to stand in
    // an arbitrary 11 m circle while the hero is occupied by the crowd. A 1.6 s grace
    // bridges normal weapon cadences without counting long disengages.
    if (this.time - record.lastExchangeAt <= 1.6) record.contactTime += this.dt;
  }
  private noteEliteSpawn(e: Ent) {
    const record: EliteEncounter = {
      id: e.id,
      // Only ever called from spawnElite, where the chassis is already chosen.
      chassis: e.chassis!,
      rarity: e.rarity,
      spawnedAt: this.time,
      engagedAt: -1,
      contactTime: 0,
      endedAt: -1,
      killed: false,
      repertoire: e.repertoire.length,
      casts: 0,
      castSkills: {},
      damageToHero: 0,
      damageFromHero: 0,
      lastExchangeAt: -1,
      damageFromHeroByNode: {},
      damageToHeroBySource: {},
      refusalDamageToHero: 0,
      itemAmplifiedDamage: 0,
      itemsTaken: [],
      dashes: 0,
      dashIFrameSaves: 0
    };
    this.eliteLog.push(record);
    this.eliteLogById.set(e.id, record);
  }

  /** D52: every elite fight of the run, for calibrating the D49 target length. */
  eliteEncounters(): EliteEncounter[] {
    return this.eliteLog;
  }

  private spawnElite(opening = false) {
    const pool: EliteChassis[] = [
      'hunter',
      'architect',
      'broodmaker',
      'bulwark',
      'harvester',
      'shepherd'
    ];
    const chassis = pool[this.rng.int(pool.length)];
    const rarity: EliteRarity = opening ? 'common' : this.rollEliteRarity(),
      affix = opening ? 'none' : this.rollEliteAffix(rarity);
    const q = this.pointAroundPlayer(15, 18.5),
      scale = this.worldScale();
    let hp = eliteHp[chassis] * scale * ELITE_RARITY_HP[rarity],
      speed = eliteSpeed[chassis];
    if (opening && this.mode === 'clean') hp *= 0.8;
    const e = makeEnt({
      id: this.nextId++,
      kind: 'elite',
      x: q.x,
      z: q.z,
      hp,
      radius:
        (chassis === 'bulwark' ? 1.02 : chassis === 'broodmaker' ? 0.94 : 0.86) *
        ELITE_RARITY_SIZE[rarity],
      speed,
      contactDps: eliteDps[chassis] * this.damageScale() * 0.62,
      cooldown: this.rng.range(1.7, 3.0),
      chassis,
      affix,
      adaptAt: hp * 0.6,
      rarity
    });
    if (!opening) {
      this.claimRepertoire(e);
      this.inheritEliteLegacy(e);
      this.grantNativeEliteGrowth(e);
    }
    this.noteEliteSpawn(e);
    this.entityStore.add(e);
    this.metrics.spawned++;
    this.metrics.eliteSpawned++;
    this.events.push({
      type: 'EntitySpawned',
      tick: this.tick,
      entity: e.id,
      kind: 'elite',
      x: e.x,
      z: e.z,
      chassis,
      affix
    });
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
    if (e.state !== 'normal' || e.eliteAction || this.eliteEchoes.has(e.id)) return false;
    const seek = Math.min(46, 24 * (e.relicSeekMul ?? 1));
    let best: Relic | null = null, bestD = seek;
    for (const relic of this.relics) {
      const d = Math.hypot(relic.x - e.x, relic.z - e.z);
      if (d < bestD) { best = relic; bestD = d; }
    }
    if (!best || bestD <= Simulation.RELIC_ELITE_REACH) return false;
    // Do not abandon immediate melee just to loot; otherwise a visible nearby relic is a real objective.
    if (playerDistance < 3.2 && bestD > playerDistance * 0.8) return false;
    this.steerTo(e, best.x, best.z, speed, 1.24);
    return true;
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

  private hitPlayer(amount: number, attacker: Ent | null = null, source: DamageSourceId = 'contact') {
    if (amount <= 0 || this.php <= 0) return;
    if (this.time < this.dashIFramesUntil) {
      if (!this.dashWindowSaved) {
        this.dashWindowSaved = true;
        this.metrics.dashIFrameSaves++;
        if (attacker) {
          const record = this.eliteLogById.get(attacker.id);
          if (record) record.dashIFrameSaves++;
        }
      }
      return;
    }
    const reduction = this.armor / (this.armor + 100),
      closeThreat = this.ents.some((e) => e.hp > 0 && Math.hypot(e.x - this.px, e.z - this.pz) < 3.6),
      guardMul = closeThreat ? Math.pow(0.94, this.doctrines.guard) : 1,
      mitigated = amount * (1 - reduction) * this.itemDamageTakenMul * guardMul;
    if (attacker) {
      const record = this.eliteLogById.get(attacker.id);
      if (record) {
        record.damageToHero += mitigated;
        record.damageToHeroBySource[source] = (record.damageToHeroBySource[source] ?? 0) + mitigated;
        if (skillOrder.includes(source as SkillId)) record.refusalDamageToHero += mitigated;
        if (record.engagedAt < 0) record.engagedAt = this.time;
        record.lastExchangeAt = this.time;
      }
    }
    let left = mitigated,
      barrierDamage = 0,
      hpDamage = 0;
    if (this.barrier > 0) {
      const b = Math.min(this.barrier, left);
      barrierDamage = b;
      this.barrier -= b;
      left -= b;
    }
    if (left > 0) {
      hpDamage = left;
      this.php = Math.max(0, this.php - left);
      this.metrics.damageTaken += left;
    }
    this.events.push({
      type: 'PlayerHit',
      tick: this.tick,
      amount: mitigated,
      hpDamage,
      barrierDamage,
      x: this.px,
      z: this.pz,
      source,
      attackerId: attacker?.id ?? 0,
      attackerKind: attacker?.kind,
      attackerChassis: attacker?.chassis,
      attackerAffix: attacker?.affix,
      attackerBoss: attacker?.boss ?? false
    });
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
    this.relicAcc += this.dt;
    const interval = Simulation.RELIC_INTERVAL * this.itemRelicRateMul;
    if (this.relics.length >= 8) this.relicAcc = Math.min(this.relicAcc, interval);
    else if (this.relicAcc >= interval) {
      this.relicAcc -= interval;
      this.spawnRelic();
    }
    const keep: Relic[] = [];
    for (const r of this.relics) {
      if (Math.hypot(this.px - r.x, this.pz - r.z) < Simulation.RELIC_REACH) {
        this.takeRelic(r);
        continue;
      }
      let claimed = false;
      for (const e of this.ents) {
        if (e.kind !== 'elite') continue;
        const reach = Simulation.RELIC_ELITE_REACH * Math.min(1.8, e.relicSeekMul ?? 1);
        if (Math.hypot(e.x - r.x, e.z - r.z) < reach) {
          this.giveEliteRelic(e, r);
          claimed = true;
          break;
        }
      }
      if (!claimed) keep.push(r);
    }
    this.relics = keep;
  }
  private spawnRelic() {
    for (let i = 0; i < 24; i++) {
      const a = this.relicRng.float() * Math.PI * 2;
      const d = 14 + this.relicRng.float() * 16;
      const x = this.px + Math.cos(a) * d;
      const z = this.pz + Math.sin(a) * d;
      if (x < this.world.minX + 2 || x > this.world.maxX - 2) continue;
      if (z < this.world.minZ + 2 || z > this.world.maxZ - 2) continue;
      if (this.blocked(x, z, 1.1)) continue;
      const item = itemOrder[this.relicRng.int(itemOrder.length)];
      const relic: Relic = { id: this.nextId++, x, z, item, bornAt: this.time };
      this.relics.push(relic);
      this.events.push({
        type: 'RelicAppeared',
        tick: this.tick,
        item,
        name: items[item].name,
        x,
        z
      });
      return;
    }
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
    const record = this.eliteLogById.get(e.id);
    if (record) record.itemsTaken.push(r.item);
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
      this.activateSlot(this.beat);
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
    return this.activationScale;
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
  private skillRadius(st: SkillRuntime, base: number, _slot = this.currentSlot) {
    return base * Math.sqrt(1 + Math.max(0, st.coverage)) * (1 + this.doctrines.size * 0.12) * (this.mutationContinuation(st)?.radiusMul ?? 1);
  }
  private skillRange(st: SkillRuntime, base: number) {
    return base * (1 + Math.max(0, st.range)) * (this.mutationContinuation(st)?.rangeMul ?? 1);
  }
  private memoryFactor() {
    return 1 + this.resonance.persistence * 0.18;
  }
  private persistentDuration(st: SkillRuntime, base: number, _slot = this.currentSlot) {
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
    let c = Math.max(1, Math.round(st.count)) + this.activationCountBonus;
    const mult = this.supportsAxis(st.id, 'multiplicity') ? this.resonance.multiplicity : 0;
    c += Math.min(3, mult);
    if (!this.castOwner) c += Math.min(3, Math.floor(this.doctrines.quantity / 2));
    c += this.mutationContinuation(st)?.countAdd ?? 0;
    return Math.max(1, c);
  }

  /** A wide lane that keeps its full weight through every body standing in it. */
  private castBreachLine(st: SkillRuntime, slot: number, src: CastSource) {
    const mut = st.mutation;
    let range = skills.breach_line.baseRange * (1 + st.range);
    let width = this.skillRadius(st, skills.breach_line.baseRadius, slot);
    if (mut === 'breach_wide') width *= 1.6;
    if (mut === 'breach_deep') {
      width *= 0.7;
      range *= 1.25;
    }
    this.combatShape('breach_line', {
      kind: 'sector',
      x: src.x,
      z: src.z,
      radius: range,
      aimX: src.aimX,
      aimZ: src.aimZ,
      halfAngle: Math.atan2(width, Math.max(0.6, range * 0.5))
    });
    for (const e of this.targetsFor(src)) {
      const dx = e.x - src.x,
        dz = e.z - src.z,
        along = dx * src.aimX + dz * src.aimZ;
      if (along < -e.radius || along > range) continue;
      if (Math.abs(dx * src.aimZ - dz * src.aimX) > width + e.radius) continue;
      let dmg = skills.breach_line.baseDamage * this.powerBucket(st) * this.slotAmp(slot, e);
      if (mut === 'breach_wide') dmg *= 0.78;
      if (mut === 'breach_deep') dmg *= 1.3;
      this.damage(e, dmg, 'breach_line', true);
      if (mut === 'breach_stagger') {
        e.displacedUntil = Math.max(e.displacedUntil, this.time + 0.6 * this.memoryFactor());
        this.noteState('displaced');
      }
    }
  }
  /** Constant work in contact: no aiming pause, no reach, nothing at all on the retreat. */
  private castContactSaw(st: SkillRuntime, slot: number, src: CastSource) {
    const mut = st.mutation,
      r = this.skillRadius(st, skills.contact_saw.baseRadius, slot);
    const half = mut === 'saw_spin' ? Math.PI : 1.0;
    this.combatShape('contact_saw', {
      kind: 'sector',
      x: src.x,
      z: src.z,
      radius: r,
      aimX: src.aimX,
      aimZ: src.aimZ,
      halfAngle: half
    });
    for (const e of this.targetsFor(src)) {
      const dx = e.x - src.x,
        dz = e.z - src.z,
        d = Math.hypot(dx, dz);
      if (d > r + e.radius || d < 0.01) continue;
      const dot = (dx / d) * src.aimX + (dz / d) * src.aimZ;
      if (Math.acos(Math.max(-1, Math.min(1, dot))) > half) continue;
      let dmg = skills.contact_saw.baseDamage * this.powerBucket(st) * this.slotAmp(slot, e);
      if (mut === 'saw_teeth') dmg *= 2;
      if (mut === 'saw_spin') dmg *= 0.7;
      this.damage(e, dmg, 'contact_saw', true);
      this.closeDamage += dmg;
      if (mut === 'saw_bleed') {
        e.woundUntil = Math.max(e.woundUntil, this.time + 3.4 * this.memoryFactor());
        e.woundDps = Math.max(e.woundDps, 5.5 * this.powerBucket(st));
        this.noteState('wound');
      }
    }
  }
  /** Pays for walking through the mass rather than backing away from it. */
  private castBackhand(st: SkillRuntime, slot: number, src: CastSource) {
    const mut = st.mutation;
    let r = this.skillRadius(st, skills.backhand.baseRadius, slot);
    const moving = Math.hypot(src.vx, src.vz);
    let bx = moving > 0.05 ? -src.vx / moving : -src.aimX,
      bz = moving > 0.05 ? -src.vz / moving : -src.aimZ;
    if (mut === 'backhand_wake') r *= 1 + Math.min(0.6, moving * 0.09);
    const half = mut === 'backhand_twin' ? Math.PI : 1.75;
    this.combatShape('backhand', {
      kind: 'sector',
      x: src.x,
      z: src.z,
      radius: r,
      aimX: bx,
      aimZ: bz,
      halfAngle: half
    });
    for (const e of this.targetsFor(src)) {
      const dx = e.x - src.x,
        dz = e.z - src.z,
        d = Math.hypot(dx, dz);
      if (d > r + e.radius || d < 0.01) continue;
      const dot = (dx / d) * bx + (dz / d) * bz;
      if (Math.acos(Math.max(-1, Math.min(1, dot))) > half) continue;
      let dmg = skills.backhand.baseDamage * this.powerBucket(st) * this.slotAmp(slot, e);
      if (mut === 'backhand_twin') dmg *= 0.68;
      this.damage(e, dmg, 'backhand', true);
      this.closeDamage += dmg;
      if (mut === 'backhand_shove') {
        e.x += (dx / d) * 1.6;
        e.z += (dz / d) * 1.6;
        e.displacedUntil = Math.max(e.displacedUntil, this.time + 0.35);
        this.noteState('displaced');
      }
    }
  }
  /** A ring that leaves the ground at the feet alone and takes the middle distance. */
  private castSpreadingFront(st: SkillRuntime, slot: number, src: CastSource) {
    const mut = st.mutation;
    let outer = this.skillRadius(st, skills.spreading_front.baseRadius, slot),
      inner = mut === 'front_inner' ? 0.2 : 2.3;
    if (mut === 'front_far') {
      outer *= 1.3;
      inner *= 1.5;
    }
    this.combatShape('spreading_front', { kind: 'circle', x: src.x, z: src.z, radius: outer });
    for (const e of this.targetsFor(src)) {
      const d = Math.hypot(e.x - src.x, e.z - src.z);
      if (d > outer + e.radius || d < inner - e.radius) continue;
      let dmg = skills.spreading_front.baseDamage * this.powerBucket(st) * this.slotAmp(slot, e);
      if (mut === 'front_far') dmg *= 0.8;
      this.damage(e, dmg, 'spreading_front', false);
      if (mut === 'front_slow') {
        e.chillUntil = Math.max(e.chillUntil, this.time + 2.2 * this.memoryFactor());
        this.noteState('chill');
      }
    }
  }
  /** Covers an angle instead of a point, so a rough aim still lands something. */
  private castShardFan(st: SkillRuntime, slot: number, src: CastSource) {
    const mut=st.mutation, range=this.skillRange(st,skills.shard_fan.baseRange);
    let count=Math.min(5,this.projectileCount(st,slot));
    let spread=0.18, speed=9.2, damage=skills.shard_fan.baseDamage*this.powerBucket(st)*this.slotAmp(slot);
    if(mut==='fan_tight'){count=1;speed=12.4;damage*=1.55;spread=0;}
    if(mut==='fan_wide'){count=Math.max(3,count);spread=0.34;damage*=0.82;}
    if(this.mutationIs(st,'fan_storm')) count=Math.min(7,count+2);
    let baseAimX=src.aimX,baseAimZ=src.aimZ;
    if(this.mutationIs(st,'returner_execution')){
      const priority=this.bestTarget(
        src,
        (e)=>e.kind==='elite'&&this.targetVisible(src,e),
        (a,b)=>{
          const marked=Number(b.markUntil>this.time)-Number(a.markUntil>this.time);
          if(marked) return marked;
          const adx=a.x-src.x,adz=a.z-src.z,bdx=b.x-src.x,bdz=b.z-src.z;
          return adx*adx+adz*adz-(bdx*bdx+bdz*bdz);
        }
      );
      if(priority){const dx=priority.x-src.x,dz=priority.z-src.z,m=Math.hypot(dx,dz)||1;baseAimX=dx/m;baseAimZ=dz/m;priority.markUntil=Math.max(priority.markUntil,this.time+2.4);}
    }
    for(let i=0;i<count;i++){
      const ang=count===1?0:(i-(count-1)/2)*spread, c=Math.cos(ang),sn=Math.sin(ang), ax=baseAimX*c-baseAimZ*sn,az=baseAimX*sn+baseAimZ*c;
      this.combatShape('shard_fan',{kind:'ray',x:src.x,z:src.z,aimX:ax,aimZ:az,range,halfWidth:0.18},'damage',false);
      this.spawnProjectile({x:src.x+ax*0.55,z:src.z+az*0.55,vx:ax*speed,vz:az*speed,radius:0.22,ttl:Math.max(1.8,range/speed*2.2),damage,coverDamage:damage*0.7,faction:src.faction,ownerId:src.owner?.id??0,source:'shard_fan',sourceSlot:slot,mutation:mut,apotheosis:st.mutationApotheosis,rivalConcentration:effectGrammar.shard_fan.rivalConcentration,behavior:'returner',returnAt:Math.max(0.75,range/speed*0.78),phase:0,hitIds:[],carousel:this.mutationIs(st,'returner_carousel'),trailAcc:0});
    }
  }

  private castTetherDrag(st: SkillRuntime, slot: number, src: CastSource) {
    const mut=st.mutation, range=this.skillRange(st,skills.tether_drag.baseRange), base=this.aimPoint(src,range);
    const anchors:{x:number;z:number}[]=[];
    if(this.mutationIs(st,'gravity_dragnet')){
      for(let i=0;i<3;i++){const a=i*Math.PI*2/3+this.cycle*0.4;anchors.push({x:base.x+Math.cos(a)*2.3,z:base.z+Math.sin(a)*2.3});}
    } else anchors.push(base);
    const radius=this.skillRadius(st,mut==='tether_net'?4.8:mut==='tether_hook'?2.2:3.4,slot);
    for(const anchor of anchors){
      const dx0=anchor.x-src.x,dz0=anchor.z-src.z,d0=Math.hypot(dx0,dz0)||1;
      this.combatShape('tether_line',{kind:'ray',x:src.x,z:src.z,aimX:dx0/d0,aimZ:dz0/d0,range:d0,halfWidth:0.08},'control');
      const dragShape:CombatShape={kind:'circle',x:anchor.x,z:anchor.z,radius};
      this.combatShape('tether_drag',dragShape,'control');
      let pulled=0;
      const candidates=this.targetsFor(src).filter(e=>e.hp>0&&combatShapeIntersectsCircle(dragShape,e.x,e.z,e.radius)).sort((a,b)=>Math.hypot(a.x-anchor.x,a.z-anchor.z)-Math.hypot(b.x-anchor.x,b.z-anchor.z));
      const cap=mut==='tether_hook'?2:mut==='tether_net'?10:6;
      for(const e of candidates){if(pulled++>=cap)break;const dx=anchor.x-e.x,dz=anchor.z-e.z,d=Math.hypot(dx,dz)||1,pull=(mut==='tether_hook'?2.4:1.35)*(1+st.control*0.25);this.damage(e,skills.tether_drag.baseDamage*this.powerBucket(st)*this.slotAmp(slot,e),'tether_drag',false,anchor.x,anchor.z,slot);e.x+=dx/d*Math.min(pull,d*0.62);e.z+=dz/d*Math.min(pull,d*0.62);e.displacedUntil=Math.max(e.displacedUntil,this.time+(this.mutationIs(st,'tether_lock')?1.85:this.mutationIs(st,'tether_bind')?1.2:0.65));this.currentActivationControl+=1.2+st.control;this.noteState('displaced');
        if(this.mutationIs(st,'gravity_prison')&&e.kind==='elite'){e.exposedUntil=Math.max(e.exposedUntil,this.time+2.1);e.chillUntil=Math.max(e.chillUntil,this.time+1.2);if(e.affix==='shielded')e.shieldStability=Math.max(0,(e.shieldStability??100)-28);this.combatShape('gravity_prison',{kind:'circle',x:e.x,z:e.z,radius:e.radius+1.2},'control');}
      }
      if(this.mutationIs(st,'gravity_singularity')) this.scheduleStrike({at:this.time+0.65,x:anchor.x,z:anchor.z,radius:radius*0.72,damage:skills.tether_drag.baseDamage*this.powerBucket(st)*2.4,faction:src.faction,ownerId:src.owner?.id??0,source:'tether_drag',sourceSlot:slot,intent:'control',telegraph:'gravity_singularity_tell'});
    }
  }

  private castPinBurst(st: SkillRuntime, slot: number, src: CastSource) {
    const mut = st.mutation,
      range = skills.pin_burst.baseRange * (1 + st.range);
    let r = this.skillRadius(st, skills.pin_burst.baseRadius, slot);
    if (mut === 'pin_deep') r *= 0.75;
    const tx = src.x + src.aimX * range,
      tz = src.z + src.aimZ * range;
    this.combatShape('pin_burst', { kind: 'circle', x: tx, z: tz, radius: r });
    for (const e of this.targetsFor(src)) {
      const d = Math.hypot(e.x - tx, e.z - tz);
      if (d > r + e.radius) continue;
      let dmg = skills.pin_burst.baseDamage * this.powerBucket(st) * this.slotAmp(slot, e);
      if (mut === 'pin_deep') dmg *= 1.45;
      if (mut === 'pin_twin') dmg *= 0.62;
      this.damage(e, dmg, 'pin_burst', false);
      e.displacedUntil = Math.max(e.displacedUntil, this.time + 1.1 * this.memoryFactor());
      this.noteState('displaced');
      if (mut === 'pin_field') {
        e.toxinUntil = Math.max(e.toxinUntil, this.time + 4.2 * this.memoryFactor());
        e.toxinDps = Math.max(e.toxinDps, 6 * this.powerBucket(st));
        this.noteState('toxin');
      }
    }
    if (mut === 'pin_twin') {
      for (const e of this.targetsFor(src)) {
        const d = Math.hypot(e.x - tx, e.z - tz);
        if (d > r * 1.3 + e.radius) continue;
        this.damage(
          e,
          skills.pin_burst.baseDamage * 0.62 * this.powerBucket(st) * this.slotAmp(slot, e),
          'pin_burst',
          false
        );
      }
    }
  }
  private dispatchSkill(id: SkillId, st: SkillRuntime, slot: number, src: CastSource) {
    if (id === 'ember_lance') this.castEmber(st, slot, src);
    else if (id === 'frost_ring') this.castFrost(st, slot, src);
    else if (id === 'rail_spear') this.castRail(st, slot, src);
    else if (id === 'cleaver') this.castCleaver(st, slot, src);
    else if (id === 'chain_arc') this.castArc(st, slot, src);
    else if (id === 'orbit_blades') this.castOrbit(st, slot, src);
    else if (id === 'mortar_bloom') this.castMortar(st, slot, src);
    else if (id === 'sentry') this.castSentry(st, slot, src);
    else if (id === 'toxic_mist') this.castToxic(st, slot, src);
    else if (id === 'repulse_halo') this.castRepulse(st, slot, src);
    else if (id === 'mass_driver') this.castMassDriver(st, slot, src);
    else if (id === 'breach_line') this.castBreachLine(st, slot, src);
    else if (id === 'contact_saw') this.castContactSaw(st, slot, src);
    else if (id === 'backhand') this.castBackhand(st, slot, src);
    else if (id === 'spreading_front') this.castSpreadingFront(st, slot, src);
    else if (id === 'shard_fan') this.castShardFan(st, slot, src);
    else if (id === 'tether_drag') this.castTetherDrag(st, slot, src);
    else if (id === 'pin_burst') this.castPinBurst(st, slot, src);
  }
  private activateSlot(slot: number) {
    const lastSlot = this.activeSpan() - 1,
      id = this.slots[slot];
    if (!id) {
      this.previousHits.clear();
      return;
    }
    const st = this.skillsRuntime.get(id);
    if (!st) return;

    // A compatible physical Catalyst owns the right node completely. B is a payload of A,
    // not an independent clocked cast. This must hold across cycle boundaries: a slow projectile
    // may reach its terminal long after the beat that armed the edge.
    const incomingPhysical = this.incomingCatalyst(slot),
      producerSkill = slot > 0 ? this.slots[slot - 1] : undefined;
    if (
      this.physicalActivations.isPhysicalCatalyst(incomingPhysical) &&
      producerSkill &&
      catalystPairCompatible(incomingPhysical, producerSkill, id)
    )
      return;

    this.currentSlot = slot;
    this.currentHits.clear();
    this.currentActivationDamage = 0;
    this.currentActivationKills = 0;
    this.currentActivationOverkill = 0;
    this.currentActivationControl = 0;
    this.currentProducedState = '';
    this.activationScale = 1;
    this.activationCountBonus = 0;
    this.activationDerived = false;
    const activationId = this.beginPhysicalActivation(slot, id);
    this.beginChoreographyTrace(id);

    const incoming = this.incomingCatalyst(slot);

    // Catalyst 1.x is compatibility-only and isolated from the live physical pipeline.
    const oldAimX = this.aimX,
      oldAimZ = this.aimZ,
      legacyBefore = this.legacyCatalysts.beforeCast({
        catalyst: incoming,
        slot,
        conductivity: this.resonance.conductivity,
        previous: this.lastContext,
        aimX: this.aimX,
        aimZ: this.aimZ,
        activationScale: this.activationScale,
        activationCountBonus: this.activationCountBonus
      });
    this.aimX = legacyBefore.aimX;
    this.aimZ = legacyBefore.aimZ;
    this.activationScale = legacyBefore.activationScale;
    this.activationCountBonus = legacyBefore.activationCountBonus;

    this.metrics.activations++;
    // Catalyst 2.x no longer teleports B on this beat. A's live lifecycle owns when/where B fires.
    this.castWithTrace(id, st, slot, this.heroSource());

    this.aimX = oldAimX;
    this.aimZ = oldAimZ;

    this.legacyCatalysts.afterCast({
      catalyst: incoming,
      slot,
      skill: id,
      runtime: st,
      conductivity: this.resonance.conductivity,
      previous: this.lastContext,
      currentHits: this.currentHits,
      currentKills: this.currentActivationKills
    });

    this.previousHits = new Set(this.currentHits);
    let cx = this.px,
      cz = this.pz;
    if (this.currentHits.size) {
      const ts = [...this.currentHits]
        .map((eid) => this.entityStore.get(eid))
        .filter(Boolean) as Ent[];
      if (ts.length) {
        cx = ts.reduce((a, e) => a + e.x, 0) / ts.length;
        cz = ts.reduce((a, e) => a + e.z, 0) / ts.length;
      }
    }

    const trace = this.finishChoreographyTrace(),
      previous = this.lastContext,
      physicalOrigin = trace?.origin ?? {x:this.px,z:this.pz};
    this.physical.setLastPoint(activationId,{...physicalOrigin});
    this.physicalActivations.armOutgoing(slot,id,activationId,physicalOrigin);
    this.physicalActivations.publishImmediate(id, slot, activationId, trace);
    this.flushPhysicalEvents();
    this.lastContext = {
      skill: id,
      damage: this.currentActivationDamage,
      kills: this.currentActivationKills,
      overkill: this.currentActivationOverkill,
      control: this.currentActivationControl,
      state: this.currentProducedState,
      hitIds: [...this.currentHits],
      x: cx,
      z: cz,
      trace
    };

    this.legacyCatalysts.afterContextPublished({
      catalyst: incoming,
      slot,
      conductivity: this.resonance.conductivity,
      previous,
      targetX: cx,
      targetZ: cz
    });

    if (slot === lastSlot) {
      this.previousHits.clear();
      this.lastContext = {
        skill: null,
        damage: 0,
        kills: 0,
        overkill: 0,
        control: 0,
        state: '',
        hitIds: [],
        x: this.px,
        z: this.pz,
        trace: null
      };
    }
    this.currentSlot = -1;
    this.physical.currentActivationId = 0;
    this.activationScale = 1;
    this.activationCountBonus = 0;
    this.activationDerived = false;
    this.currentChoreography = null;
  }



  private beginPhysicalActivation(slot: number, skill: SkillId, origin: ChoreographyPoint = { x: this.px, z: this.pz }) {
    return this.physical.begin(slot, skill, origin);
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





  private castCatalystPayload(
    binding: CatalystBinding,
    x: number,
    z: number,
    aimX?: number,
    aimZ?: number
  ) {
    const st = this.skillsRuntime.get(binding.toSkill);
    if (!st) return false;
    const save = {
      currentSlot: this.currentSlot,
      currentActivationId: this.physical.currentActivationId,
      currentChoreography: this.currentChoreography,
      currentHits: this.currentHits,
      currentActivationDamage: this.currentActivationDamage,
      currentActivationKills: this.currentActivationKills,
      currentActivationOverkill: this.currentActivationOverkill,
      currentActivationControl: this.currentActivationControl,
      currentProducedState: this.currentProducedState,
      activationScale: this.activationScale,
      activationCountBonus: this.activationCountBonus,
      activationDerived: this.activationDerived
    };
    this.currentSlot = binding.toSlot;
    this.currentHits = new Set<number>();
    this.currentActivationDamage = 0;
    this.currentActivationKills = 0;
    this.currentActivationOverkill = 0;
    this.currentActivationControl = 0;
    this.currentProducedState = '';
    this.activationScale = 1;
    this.activationCountBonus = 0;
    this.activationDerived = true;
    const src = this.choreographySource(x, z, aimX, aimZ),
      activationId = this.beginPhysicalActivation(binding.toSlot, binding.toSkill, { x: src.x, z: src.z });
    this.physical.currentActivationId = activationId;
    if(binding.toSkill==='orbit_blades') this.setOrbitChoreography(src.x,src.z);
    this.beginChoreographyTrace(binding.toSkill);
    this.metrics.activations++;
    this.castWithTrace(binding.toSkill, st, binding.toSlot, src);
    const trace = this.finishChoreographyTrace(),
      physicalOrigin = trace?.origin ?? {x:src.x,z:src.z};
    this.physical.setLastPoint(activationId,{...physicalOrigin});
    this.physicalActivations.armOutgoing(
      binding.toSlot,
      binding.toSkill,
      activationId,
      physicalOrigin
    );
    this.physicalActivations.publishImmediate(binding.toSkill, binding.toSlot, activationId, trace);

    this.currentSlot = save.currentSlot;
    this.physical.currentActivationId = save.currentActivationId;
    this.currentChoreography = save.currentChoreography;
    this.currentHits = save.currentHits;
    this.currentActivationDamage = save.currentActivationDamage;
    this.currentActivationKills = save.currentActivationKills;
    this.currentActivationOverkill = save.currentActivationOverkill;
    this.currentActivationControl = save.currentActivationControl;
    this.currentProducedState = save.currentProducedState;
    this.activationScale = save.activationScale;
    this.activationCountBonus = save.activationCountBonus;
    this.activationDerived = save.activationDerived;
    return true;
  }







  private flushPhysicalEvents() {
    this.physical.flush(
      (binding, event) => this.physicalCatalysts.handle(binding, event),
      (activationId) => this.constructs.some((construct) => construct.activationId === activationId)
    );
  }

  private sameChoreographyPoint(a: ChoreographyPoint, b: ChoreographyPoint, eps = 0.12) {
    return Math.hypot(a.x - b.x, a.z - b.z) <= eps;
  }

  private tracePoint(x: number, z: number, terminal = false) {
    const t = this.currentChoreography;
    if (!t) return;
    const p = { x, z };
    if (!t.points.some((q) => this.sameChoreographyPoint(q, p))) t.points.push(p);
    if (terminal) t.terminal = p;
  }

  private traceArea(x: number, z: number, radius: number) {
    const t = this.currentChoreography;
    if (!t) return;
    this.tracePoint(x, z);
    const r = Math.max(0.35, radius),
      shape:CombatShape={kind:'circle',x,z,radius:r};
    if(!t.areas.some((q)=>q.kind==='circle'&&Math.hypot(q.x-x,q.z-z)<0.08&&Math.abs(q.radius-r)<0.08))
      t.areas.push(shape);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const p = { x: x + Math.cos(a) * r, z: z + Math.sin(a) * r };
      if (!t.areaPoints.some((q) => this.sameChoreographyPoint(q, p))) t.areaPoints.push(p);
    }
  }

  private traceSegment(a: ChoreographyPoint, b: ChoreographyPoint) {
    const t = this.currentChoreography;
    if (!t) return;
    const last = t.paths[t.paths.length - 1];
    if (last && this.sameChoreographyPoint(last[last.length - 1], a, 0.2)) last.push({ ...b });
    else t.paths.push([{ ...a }, { ...b }]);
    t.terminal = { ...b };
  }

  private traceCombatShape(shape: CombatShape) {
    if (!this.currentChoreography) return;
    if (shape.kind === 'circle') {
      this.traceArea(shape.x, shape.z, shape.radius);
      return;
    }
    if (shape.kind === 'ray') {
      const end = { x: shape.x + shape.aimX * shape.range, z: shape.z + shape.aimZ * shape.range };
      this.traceSegment({ x: shape.x, z: shape.z }, end);
      return;
    }
    if(!this.currentChoreography.areas.some((q)=>
      q.kind==='sector'&&Math.hypot(q.x-shape.x,q.z-shape.z)<0.08&&Math.abs(q.radius-shape.radius)<0.08
    )) this.currentChoreography.areas.push({...shape});
    const tip = {
      x: shape.x + shape.aimX * shape.radius,
      z: shape.z + shape.aimZ * shape.radius
    };
    this.traceSegment({ x: shape.x, z: shape.z }, tip);
    const base = Math.atan2(shape.aimZ, shape.aimX);
    for (const off of [-shape.halfAngle, shape.halfAngle]) {
      const a = base + off;
      const p = { x: shape.x + Math.cos(a) * shape.radius, z: shape.z + Math.sin(a) * shape.radius };
      if (!this.currentChoreography.areaPoints.some((q) => this.sameChoreographyPoint(q, p)))
        this.currentChoreography.areaPoints.push(p);
    }
  }

  private beginChoreographyTrace(id: SkillId) {
    this.currentChoreography = {
      skill: id,
      origin: { x: this.px, z: this.pz },
      aimX: this.aimX,
      aimZ: this.aimZ,
      terminal: null,
      points: [],
      areaPoints: [],
      areas: [],
      contacts: [],
      paths: [],
      carriers: [],
      scheduled: []
    };
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
    const t = this.currentChoreography,
      st = this.skillsRuntime.get('orbit_blades');
    if (!t || !st) return;
    const center = this.orbitCenter(),
      geometry = this.orbitSystem.geometry(st, center);
    for (const blade of geometry.blades) {
      this.traceArea(blade.x, blade.z, geometry.bladeRadius);
      t.carriers.push({ kind: 'orbit', index: blade.index });
    }
  }

  private finishChoreographyTrace() {
    const t = this.currentChoreography;
    if (!t) return null;
    const resolvedHits = t.contacts;
    for (const p of resolvedHits) this.tracePoint(p.x, p.z);

    // Contacts are captured at damage time, before pull/knockback can move the target. Terminal
    // semantics are skill-authored: a Rail/Cleaver finishes at its farthest useful contact,
    // Chain Arc at its final hop, while Tether owns its authored anchor independently of targets.
    if (resolvedHits.length && (t.skill === 'rail_spear' || t.skill === 'cleaver')) {
      t.terminal = { ...resolvedHits.reduce((best,p) =>
        Math.hypot(p.x-t.origin.x,p.z-t.origin.z) > Math.hypot(best.x-t.origin.x,best.z-t.origin.z) ? p : best
      ) };
    } else if (resolvedHits.length && t.skill === 'chain_arc') {
      t.terminal = { ...resolvedHits[resolvedHits.length - 1] };
    } else if (resolvedHits.length && t.skill !== 'tether_drag') {
      t.terminal = { ...resolvedHits[resolvedHits.length - 1] };
    } else if (!t.terminal && t.points.length) t.terminal = { ...t.points[t.points.length - 1] };
    if (t.skill === 'mortar_bloom' || t.skill === 'mass_driver' || t.skill === 'shard_fan') {
      t.terminal = null;
      t.paths = [];
    }
    const out: ChoreographyTrace = {
      ...t,
      origin: { ...t.origin },
      terminal: t.terminal ? { ...t.terminal } : null,
      points: t.points.map((p) => ({ ...p })),
      areaPoints: t.areaPoints.map((p) => ({ ...p })),
      areas: t.areas.map((q) => ({ ...q })),
      contacts: t.contacts.map((p) => ({ ...p })),
      paths: t.paths.map((path) => path.map((p) => ({ ...p }))),
      carriers: t.carriers.map((q) => ({ ...q })),
      scheduled: t.scheduled.map((p) => ({ ...p }))
    };
    this.currentChoreography = null;
    return out;
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
    if (
      this.currentChoreography &&
      this.currentChoreography.points.length === 0 &&
      this.currentChoreography.paths.length === 0 &&
      this.currentChoreography.scheduled.length === 0
    ) {
      this.currentChoreography.origin = { x: src.x, z: src.z };
      this.currentChoreography.aimX = src.aimX;
      this.currentChoreography.aimZ = src.aimZ;
    }
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
    this.tracePoint(src.x, src.z);
    this.dispatchSkill(id, st, slot, src);
    const t = this.currentChoreography;
    if (!t) return;
    for (const p of this.projectiles)
      if (p.id >= firstNewId && p.sourceSlot === slot && p.faction === 'hero')
        t.carriers.push({ kind: 'projectile', id: p.id });
    for (const q of this.constructs)
      if (q.id >= firstNewId && q.sourceSlot === slot && q.faction === 'hero') {
        q.activationId = this.physical.currentActivationId;
        t.carriers.push({ kind: 'construct', id: q.id });
        this.tracePoint(q.x, q.z);
        this.traceArea(q.x, q.z, 0.7);
      }
    for (const f of this.fields)
      if (f.id >= firstNewId && f.sourceSlot === slot && f.faction !== 'rival') {
        f.activationId = this.physical.currentActivationId;
        f.insideIds ??= [];
        this.traceArea(f.x, f.z, f.radius);
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
    if (!this.currentProducedState) this.currentProducedState = state;
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
    let best: Ent | undefined;
    for (const entity of this.targetsFor(src)) {
      if (entity.hp <= 0 || !predicate(entity)) continue;
      if (!best || compare(entity, best) < 0) best = entity;
    }
    return best;
  }

  private targetsFor(src: CastSource): Ent[] {
    if (src.faction === 'hero') return this.ents;
    this.hero.x = this.px;
    this.hero.z = this.pz;
    this.hero.hp = this.php;
    this.hero.maxHp = this.maxHp;
    this.hero.facingX = this.aimX;
    this.hero.facingZ = this.aimZ;
    return [this.hero];
  }
  private rayHits(
    src: CastSource,
    ax: number,
    az: number,
    range: number,
    width: number,
    maxHits = 99
  ) {
    const m=Math.hypot(ax,az)||1,
      nx=ax/m,nz=az/m,
      shape:CombatShape={kind:'ray',x:src.x,z:src.z,aimX:nx,aimZ:nz,range,halfWidth:width},
      hits:{ e:Ent;t:number;lat:number }[]=[];
    for(const e of this.targetsFor(src)){
      if(e.hp<=0||!this.lineOfSight(src.x,src.z,e.x,e.z,width*0.2))continue;
      if(!combatShapeIntersectsCircle(shape,e.x,e.z,e.radius))continue;
      const dx=e.x-src.x,dz=e.z-src.z,
        t=dx*nx+dz*nz,
        lat=Math.abs(dx*nz-dz*nx);
      hits.push({e,t,lat});
    }
    hits.sort((a,b)=>a.t-b.t);
    return hits.slice(0,maxHits);
  }

  private rotatedAim(src: CastSource, rad: number) {
    const c = Math.cos(rad),
      s = Math.sin(rad);
    return { x: src.aimX * c - src.aimZ * s, z: src.aimX * s + src.aimZ * c };
  }
  private targetVisible(src: CastSource, e: Ent) {
    if (!this.lineOfSight(src.x, src.z, e.x, e.z, 0.1)) return false;
    for (const f of this.fields) {
      if (f.kind !== 'veil') continue;
      const inside = Math.hypot(e.x - f.x, e.z - f.z) < f.radius,
        observerInside = Math.hypot(src.x - f.x, src.z - f.z) < f.radius;
      if (inside && !observerInside && Math.hypot(e.x - src.x, e.z - src.z) > 3.6) return false;
    }
    return true;
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
    let best: Ent | undefined,
      bestScore = 999;
    for (const e of this.targetsFor(src)) {
      if (e.hp <= 0 || !this.targetVisible(src, e)) continue;
      const dx = e.x - src.x,
        dz = e.z - src.z,
        d = Math.hypot(dx, dz);
      if (d > range || d < 2) continue;
      const dot = (dx / d) * src.aimX + (dz / d) * src.aimZ;
      if (dot < 0.45) continue;
      const lateral = Math.abs(dx * src.aimZ - dz * src.aimX),
        score = lateral * 0.9 + d * 0.04;
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best
      ? { x: best.x, z: best.z }
      : { x: src.x + src.aimX * range * 0.72, z: src.z + src.aimZ * range * 0.72 };
  }
  private combatShape(
    source: string,
    shape: CombatShape,
    intent: 'damage' | 'control' | 'field' = 'damage',
    physicalTrace = true
  ) {
    // Render geometry and simulation truth are separate contracts. A moving projectile may
    // draw its intended lane now, but its Catalyst path is published only as the body moves.
    if (physicalTrace) this.traceCombatShape(shape);
    this.events.push({ type: 'CombatShape', tick: this.tick, source, intent, shape });
  }

  private castEmber(st: SkillRuntime, slot: number, src: CastSource) {
    const mut = st.mutation,
      count = this.projectileCount(st, slot);
    let rays: number[] = [];
    if (mut === 'ember_volley') {
      const n = Math.max(3, count + 2);
      for (let i = 0; i < n; i++) rays.push((i - (n - 1) / 2) * 0.13);
    } else if (count > 1) {
      for (let i = 0; i < count; i++) rays.push((i - (count - 1) / 2) * 0.08);
    } else rays = [0];
    for (const ang of rays) {
      const a = this.rotatedAim(src, ang),
        range = this.skillRange(st, mut === 'ember_furnace' ? 8 : skills.ember_lance.baseRange),
        width = this.skillRadius(st, mut === 'ember_furnace' ? 1.05 : 0.4, slot),
        maxHits = this.mutationIs(st, 'ember_impaler') ? 4 : 1;
      this.combatShape('ember_lance', {
        kind: 'ray',
        x: src.x,
        z: src.z,
        aimX: a.x,
        aimZ: a.z,
        range,
        halfWidth: width
      });
      for (const h of this.rayHits(src, a.x, a.z, range, width, maxHits)) {
        let dmg =
          skills.ember_lance.baseDamage *
          this.powerBucket(st) *
          this.slotAmp(slot, h.e) *
          (mut === 'ember_volley' ? 0.82 : count > 1 ? 0.86 : 1);
        if (this.mutationIs(st, 'ember_impaler') && h.e.kind === 'elite') dmg *= 1.7;
        const chilled = h.e.chillUntil > this.time;
        if (chilled) {
          h.e.chillUntil = 0;
          dmg *= 1.25;
          this.metrics.reactions++;
          this.events.push({
            type: 'Reaction',
            tick: this.tick,
            reaction: 'thermal_shock',
            x: h.e.x,
            z: h.e.z,
            amount: dmg * 0.35
          });
        }
        this.damage(h.e, dmg, 'ember_lance', true);
        h.e.igniteUntil = Math.max(
          h.e.igniteUntil,
          this.time + 3.2 * (1 + st.statusPotency) * this.memoryFactor()
        );
        this.noteState('ignite');
        if (chilled) {
          for (const o of this.targetsFor(src)) {
            if (o !== h.e && o.hp > 0 && Math.hypot(o.x - h.e.x, o.z - h.e.z) < 1.65)
              this.damage(o, dmg * 0.35, 'thermal_shock', false, h.e.x, h.e.z);
          }
        }
        if (mut === 'ember_brand') h.e.markUntil = this.time + 4.5 * this.memoryFactor();
      }
    }
    if (mut === 'ember_furnace') {
      this.fields.push({
        id: this.nextId++,
        x: src.x + src.aimX * 3.3,
        z: src.z + src.aimZ * 3.3,
        radius: this.skillRadius(st, 1.5, slot),
        ttl: this.persistentDuration(st, 2.9, slot),
        kind: 'fire',
        dps: 17 * this.powerBucket(st),
        tickAcc: 0,
        faction: src.faction,
        ownerId: src.owner?.id ?? 0,
        source: st.id,
        sourceSlot: slot,
        mutation: st.mutation,
        rivalConcentration: effectGrammar[st.id].rivalConcentration
      });
      this.noteState('field');
    }
  }
  private castFrost(st: SkillRuntime, slot: number, src: CastSource) {
    const mut=st.mutation,r=this.skillRadius(st,skills.frost_ring.baseRadius,slot),
      shape:CombatShape={kind:'circle',x:src.x,z:src.z,radius:r};
    this.combatShape('frost_ring',shape,'control');
    let shattered=0; let firstShatter:Ent|null=null;
    for(const e of this.targetsFor(src)){
      const d=Math.hypot(e.x-src.x,e.z-src.z); if(!combatShapeIntersectsCircle(shape,e.x,e.z,e.radius))continue;
      const wasChilled=e.chillUntil>this.time, wasFrozen=(e.frozenUntil??0)>this.time;
      let dmg=skills.frost_ring.baseDamage*this.powerBucket(st)*this.slotAmp(slot,e);
      if(mut==='frost_rim')dmg*=d>r*0.62?2:0.48;
      const ignited=e.igniteUntil>this.time;
      if(ignited){e.igniteUntil=0;dmg*=1.18;this.metrics.reactions++;this.events.push({type:'Reaction',tick:this.tick,reaction:'thermal_shock',x:e.x,z:e.z,amount:dmg*0.42});}
      const meterGain=1+st.statusPotency*0.45+(this.doctrines.force*0.08); e.frostMeter=(e.frostMeter??0)+meterGain;
      const freezeAt=e.kind==='elite'?3.5:2.0;
      if((e.frostMeter??0)>=freezeAt){e.frostMeter=0;e.frozenUntil=this.time+(e.kind==='elite'?0.7:1.35)*this.memoryFactor();e.exposedUntil=Math.max(e.exposedUntil,this.time+(e.kind==='elite'?0.85:0.45));}
      let shatter=wasFrozen||(mut==='frost_snap'&&wasChilled);
      if(shatter){dmg+=22*this.powerBucket(st);e.frozenUntil=0;e.chillUntil=0;shattered++;firstShatter??=e;this.events.push({type:'RareEvent',tick:this.tick,title:'РАСКОЛ',detail:e.kind==='elite'?'Хрупкость элиты разбита':'Лёд расколот',x:e.x,z:e.z});}
      const killed=this.damage(e,dmg,'frost_ring',false,src.x,src.z,slot);
      e.chillUntil=Math.max(e.chillUntil,this.time+2.4*(1+st.statusPotency)*this.memoryFactor());this.noteState('chill');this.currentActivationControl+=1+st.control;
      if(this.mutationIs(st,'frost_brittle'))e.exposedUntil=Math.max(e.exposedUntil,this.time+2.8*this.memoryFactor());
      if(this.mutationIs(st,'frost_skin')&&killed&&(wasChilled||ignited||shatter))this.grantBarrier(9);
      if(this.mutationIs(st,'frost_spirefall')&&(shatter||e.exposedUntil>this.time)){
        for(const [ox,oz] of [[1.5,0],[-1.5,0],[0,1.5],[0,-1.5]])this.scheduleStrike({at:this.time+0.22,x:e.x+ox,z:e.z+oz,radius:0.62,damage:11*this.powerBucket(st),faction:src.faction,ownerId:src.owner?.id??0,source:'frost_ring',sourceSlot:slot,intent:'damage',telegraph:'frost_spire_tell'});
      }
    }
    if(mut==='frost_front'){
      this.fields.push({id:this.nextId++,x:src.x,z:src.z,radius:r*1.12,ttl:this.persistentDuration(st,1.6,slot),kind:'frost',dps:13*this.powerBucket(st),tickAcc:0,faction:src.faction,ownerId:src.owner?.id??0,source:st.id,sourceSlot:slot,mutation:st.mutation,rivalConcentration:effectGrammar[st.id].rivalConcentration});this.noteState('field');
    }
    if(this.mutationIs(st,'frost_glacier_heart')&&shattered>0){
      const target=firstShatter??{x:src.x+src.aimX*2,z:src.z+src.aimZ*2} as Ent,dx=target.x-src.x,dz=target.z-src.z,m=Math.hypot(dx,dz)||1;
      this.spawnProjectile({x:src.x,z:src.z,vx:dx/m*3.1,vz:dz/m*3.1,radius:1.15,ttl:4.5,damage:12*this.powerBucket(st),coverDamage:18,faction:src.faction,ownerId:src.owner?.id??0,source:'frost_ring',sourceSlot:slot,mutation:st.mutation,apotheosis:st.mutationApotheosis,rivalConcentration:1,behavior:'roller',phase:0,hitIds:[],growth:0.02});
    }
    if(this.mutationIs(st,'frost_worldstorm')){
      this.spawnProjectile({x:src.x,z:src.z,vx:src.aimX*2.25,vz:src.aimZ*2.25,radius:r*0.62,ttl:7.0,damage:9*this.powerBucket(st),coverDamage:25,faction:src.faction,ownerId:src.owner?.id??0,source:'frost_ring',sourceSlot:slot,mutation:st.mutation,apotheosis:st.mutationApotheosis,rivalConcentration:1,behavior:'roller',phase:0,hitIds:[],growth:0.035});
      this.events.push({type:'RareEvent',tick:this.tick,title:'БЕЛЫЙ ШТОРМ',detail:'Ледяной фронт движется через арену',x:src.x,z:src.z});
    }
  }

  private castRail(st: SkillRuntime, slot: number, src: CastSource) {
    const mut=st.mutation;if(mut==='rail_gun'&&this.cycle%2===1)return;
    const requestedCount=this.projectileCount(st,slot), count=mut==='rail_gun'?1:requestedCount+(mut==='rail_fan'?2:0),rays:number[]=[];
    for(let i=0;i<count;i++)rays.push((i-(count-1)/2)*(mut==='rail_fan'?0.11:0.072));
    let latticePoint:{x:number;z:number}|null=null;
    for(const ang of rays){const a=this.rotatedAim(src,ang);let base=skills.rail_spear.baseDamage*this.powerBucket(st)*(mut==='rail_gun'?2.35:mut==='rail_fan'?0.58:mut==='rail_rack'?0.78:1);const requestedRange=this.skillRange(st,mut==='rail_gun'?25:skills.rail_spear.baseRange),width=this.skillRadius(st,0.34,slot),endX=src.x+a.x*requestedRange,endZ=src.z+a.z*requestedRange,block=this.firstBlockingObstacleHit(src.x,src.z,endX,endZ,width*0.2),range=requestedRange*(block?.t??1);this.combatShape('rail_spear',{kind:'ray',x:src.x,z:src.z,aimX:a.x,aimZ:a.z,range,halfWidth:width});const hits=this.rayHits(src,a.x,a.z,range,width,mut==='rail_gun'?14:mut==='rail_fan'?5:8);let first=true;
      for(const h of hits){let dmg=base*this.slotAmp(slot,h.e);if(this.mutationIs(st,'rail_spot')&&h.e.markUntil>this.time)dmg*=1.25;const hadMark=h.e.markUntil>this.time;this.damage(h.e,dmg,'rail_spear',true,src.x,src.z,slot);h.e.embedded=Math.min(8,h.e.embedded+(mut==='rail_rack'?2:1));this.noteState('embed');if((this.mutationIs(st,'rail_spot')||hadMark)&&hadMark)h.e.exposedUntil=this.time+3;if(this.mutationIs(st,'rail_harpoon')&&first&&h.e.kind==='elite'){const dx=src.x-h.e.x,dz=src.z-h.e.z,d=Math.hypot(dx,dz)||1;h.e.x+=dx/d*1.25;h.e.z+=dz/d*1.25;}
        if(this.mutationIs(st,'rail_execution_line')&&first&&h.e.kind==='elite')this.scheduleStrike({at:this.time+0.55,x:h.e.x,z:h.e.z,radius:0.85,damage:base*1.25,faction:src.faction,ownerId:src.owner?.id??0,source:'rail_spear',sourceSlot:slot,intent:'damage',telegraph:'rail_execution_beacon'});
        if(this.mutationIs(st,'rail_sky_lance')&&hadMark)this.scheduleStrike({at:this.time+0.72,x:h.e.x,z:h.e.z,radius:1.0,damage:base*1.7,faction:src.faction,ownerId:src.owner?.id??0,source:'rail_spear',sourceSlot:slot,intent:'damage',telegraph:'rail_sky_lance_beacon'});
        latticePoint??={x:h.e.x,z:h.e.z};first=false;}
    }
    if(this.mutationIs(st,'rail_lattice')){const p=latticePoint??this.aimPoint(src,this.skillRange(st,skills.rail_spear.baseRange)*0.75),a0=Math.atan2(src.aimZ,src.aimX);for(const off of [0,Math.PI/2])for(let i=-3;i<=3;i++){const a=a0+off;this.scheduleStrike({at:this.time+0.42+Math.abs(i)*0.035,x:p.x+Math.cos(a)*i*1.3,z:p.z+Math.sin(a)*i*1.3,radius:0.42,damage:skills.rail_spear.baseDamage*this.powerBucket(st)*0.48,faction:src.faction,ownerId:src.owner?.id??0,source:'rail_spear',sourceSlot:slot,intent:'damage',telegraph:'rail_lattice_node'});}}
  }

  private castCleaver(st: SkillRuntime, slot: number, src: CastSource, repeat = false) {
    const mut=st.mutation,r=this.skillRadius(st,skills.cleaver.baseRadius,slot);let half=mut==='cleaver_guillotine'?0.65:1.12;if(mut==='cleaver_roundhouse')half=Math.PI;const shape:CombatShape={kind:'sector',x:src.x,z:src.z,radius:r,aimX:src.aimX,aimZ:src.aimZ,halfAngle:half};this.combatShape('cleaver',shape);let kills=0,hookX=0,hookZ=0,hookN=0,ruptures=0;
    for(const e of this.targetsFor(src)){const dx=e.x-src.x,dz=e.z-src.z,d=Math.hypot(dx,dz);if(d<0.01||!combatShapeIntersectsCircle(shape,e.x,e.z,e.radius))continue;let dmg=skills.cleaver.baseDamage*this.powerBucket(st)*this.slotAmp(slot,e)*(repeat?0.65:1);if(mut==='cleaver_guillotine'&&e.hp/e.maxHp<0.25)dmg*=2;if(this.mutationIs(st,'cleaver_deep'))dmg*=1.22;const killed=this.damage(e,dmg,'cleaver',true,src.x,src.z,slot);this.closeDamage+=dmg;if(killed)kills++;
      if(this.mutationIs(st,'cleaver_deep')){const push=e.kind==='elite'?0.22:0.62;e.x+=dx/d*push;e.z+=dz/d*push;e.displacedUntil=Math.max(e.displacedUntil,this.time+0.45);this.noteState('displaced');}
      if(mut==='cleaver_hook'||this.mutationIs(st,'cleaver_chainhook')){const tx=src.x-e.x,tz=src.z-e.z,td=Math.hypot(tx,tz)||1,pull=this.mutationIs(st,'cleaver_chainhook')?1.05:0.65;e.x+=tx/td*pull*(1+st.control);e.z+=tz/td*pull*(1+st.control);hookX+=e.x;hookZ+=e.z;hookN++;}
      if(this.mutationIs(st,'cleaver_rupture')&&ruptures<6){ruptures++;const burst=skills.cleaver.baseDamage*this.powerBucket(st)*0.48,rr=1.55,rupture:CombatShape={kind:'circle',x:e.x,z:e.z,radius:rr};this.combatShape('cleaver_rupture',rupture);for(const o of this.targetsFor(src))if(o.hp>0&&o.id!==e.id&&combatShapeIntersectsCircle(rupture,o.x,o.z,o.radius))this.damage(o,burst,'cleaver',false,e.x,e.z,slot);}
    }
    if(this.mutationIs(st,'cleaver_rift_hook')&&hookN){const x=hookX/hookN,z=hookZ/hookN;this.scheduleStrike({at:this.time+0.24,x,z,radius:2.1,damage:skills.cleaver.baseDamage*this.powerBucket(st)*0.72,faction:src.faction,ownerId:src.owner?.id??0,source:'cleaver',sourceSlot:slot,intent:'control',telegraph:'cleaver_rift_tell'});}
    if(this.mutationIs(st,'cleaver_rhythm')&&kills>0&&!repeat){this.butcherStacks=Math.min(6,this.butcherStacks+kills);if(this.mutationIs(st,'cleaver_harvest_dance')||this.rng.float()<Math.min(0.65,this.butcherStacks*0.16)){const ax=src.aimX,az=src.aimZ;src.aimX=-az;src.aimZ=ax;this.combatShape('cleaver_harvest_dance',{kind:'circle',x:src.x,z:src.z,radius:r*1.18});this.castCleaver(st,slot,src,true);src.aimX=ax;src.aimZ=az;if(this.mutationIs(st,'cleaver_harvest_dance'))this.grantBarrier(3.5*kills);this.butcherStacks=0;}}
    if(!repeat&&this.supportsAxis(st.id,'multiplicity')&&this.resonance.multiplicity>0){const ax=src.aimX,az=src.aimZ;for(let i=0;i<Math.min(2,this.resonance.multiplicity);i++){const a=(i%2===0?1:-1)*(0.22+0.08*i),c=Math.cos(a),q=Math.sin(a);src.aimX=ax*c-az*q;src.aimZ=ax*q+az*c;this.castCleaver(st,slot,src,true);}src.aimX=ax;src.aimZ=az;}
  }

  private castArc(st: SkillRuntime, slot: number, src: CastSource) {
    const mut=st.mutation,
      maxJumps=(mut==='arc_forked'?7:4)+Math.max(0,st.count-1)+this.resonance.multiplicity+
        (!src.owner?Math.min(3,Math.floor(this.doctrines.quantity/2)):0)+
        this.activationCountBonus+(this.mutationContinuation(st)?.countAdd??0),
      jumpRange=this.skillRange(st,this.mutationIs(st,'arc_relay')?5.8:4.2);
    const available=this.targetsFor(src).filter(e=>e.hp>0&&this.targetVisible(src,e)&&Math.hypot(e.x-src.x,e.z-src.z)<=this.skillRange(st,skills.chain_arc.baseRange)+e.radius);
    let current:Ent|undefined;const embedded=available.filter(e=>e.embedded>0);if(embedded.length)current=embedded.sort((a,b)=>b.embedded-a.embedded)[0];if(mut==='arc_ground')current=available.filter(e=>e.markUntil>this.time||e.embedded>0).sort((a,b)=>Math.hypot(a.x-src.x,a.z-src.z)-Math.hypot(b.x-src.x,b.z-src.z))[0];if(!current)current=available.sort((a,b)=>Math.hypot(a.x-src.x,a.z-src.z)-Math.hypot(b.x-src.x,b.z-src.z))[0];if(!current)return;
    const hit=new Set<number>(),path:Ent[]=[];let jumps=0,prevX=src.x,prevZ=src.z;
    while(current&&jumps<maxJumps){hit.add(current.id);path.push(current);let dmg=skills.chain_arc.baseDamage*this.powerBucket(st)*this.slotAmp(slot,current)*Math.pow(mut==='arc_forked'?0.93:0.88,jumps);if(mut==='arc_ground'&&(current.markUntil>this.time||current.embedded>0))dmg*=1.45;if(current.embedded>0){dmg*=1.28;current.embedded--;this.metrics.reactions++;}this.combatShape('chain_arc',{kind:'ray',x:prevX,z:prevZ,aimX:(current.x-prevX)/(Math.hypot(current.x-prevX,current.z-prevZ)||1),aimZ:(current.z-prevZ)/(Math.hypot(current.x-prevX,current.z-prevZ)||1),range:Math.hypot(current.x-prevX,current.z-prevZ),halfWidth:0.08});this.damage(current,dmg,'chain_arc',false,prevX,prevZ,slot);this.noteState('charge');if(this.mutationIs(st,'arc_cage')&&this.time-current.lastArcAt<2.2)this.fields.push({id:this.nextId++,x:current.x,z:current.z,radius:1.25,ttl:1.7*(1+st.duration),kind:'arc',dps:13*this.powerBucket(st),tickAcc:0,faction:src.faction,ownerId:src.owner?.id??0,source:st.id,sourceSlot:slot,mutation:st.mutation,rivalConcentration:effectGrammar[st.id].rivalConcentration});current.lastArcAt=this.time;prevX=current.x;prevZ=current.z;jumps++;let next:Ent|undefined,best=999;for(const e of this.targetsFor(src)){if(e.hp<=0||hit.has(e.id))continue;const dd=Math.hypot(e.x-prevX,e.z-prevZ);if(dd<=jumpRange+e.radius&&dd<best){best=dd;next=e;}}current=next;}
    if(this.mutationIs(st,'arc_capacitive')&&path.length&&jumps<maxJumps){
      const unused=Math.min(4,maxJumps-jumps), target=path[0], relay=this.mutationIs(st,'arc_relay');
      for(let i=0;i<unused;i++)this.scheduleStrike({at:this.time+0.07*(i+1),x:target.x,z:target.z,radius:relay?0.72:0.46,damage:skills.chain_arc.baseDamage*this.powerBucket(st)*(relay?0.68:0.52),faction:src.faction,ownerId:src.owner?.id??0,source:'chain_arc',sourceSlot:slot,intent:'damage',telegraph:'arc_return_pulse',fieldKind:relay?'arc':undefined,fieldDuration:relay?0.7:0,fieldDps:relay?4*this.powerBucket(st):0});
    }
    if(this.mutationIs(st,'arc_closed_loop')&&path.length>1){const first=path[0],last=path[path.length-1],d=Math.hypot(first.x-last.x,first.z-last.z)||1;this.combatShape('arc_closed_loop',{kind:'ray',x:last.x,z:last.z,aimX:(first.x-last.x)/d,aimZ:(first.z-last.z)/d,range:d,halfWidth:0.14});this.damage(first,skills.chain_arc.baseDamage*this.powerBucket(st)*1.55,'chain_arc',false,last.x,last.z,slot);}
    if(this.mutationIs(st,'arc_hunting_storm')){const extra=this.targetsFor(src).filter(e=>e.hp>0&&!hit.has(e.id)&&path.some(h=>Math.hypot(e.x-h.x,e.z-h.z)<jumpRange*1.2)).slice(0,3);for(const e of extra)this.scheduleStrike({at:this.time+0.18,x:e.x,z:e.z,radius:0.72,damage:skills.chain_arc.baseDamage*this.powerBucket(st)*0.82,faction:src.faction,ownerId:src.owner?.id??0,source:'chain_arc',sourceSlot:slot,intent:'damage',telegraph:'arc_hunting_node',fieldKind:'arc',fieldDuration:1.25,fieldDps:7*this.powerBucket(st)});}
    if(this.mutationIs(st,'arc_living_circuit')&&src.faction==='hero'){let used=0;for(const c of this.constructs){if(c.faction!=='hero'||used++>=4)continue;const target=this.entityStore.nearest(c.x,c.z,(e)=>{const dx=e.x-c.x,dz=e.z-c.z,r=c.range+e.radius;return dx*dx+dz*dz<=r*r;},c.range+2);if(!target)continue;const dx=target.x-c.x,dz=target.z-c.z,d=Math.hypot(dx,dz)||1;this.combatShape('arc_living_circuit',{kind:'ray',x:c.x,z:c.z,aimX:dx/d,aimZ:dz/d,range:d,halfWidth:0.1});this.damage(target,skills.chain_arc.baseDamage*this.powerBucket(st)*0.65,'chain_arc',false,c.x,c.z,slot);}}
  }

  private castOrbit(st: SkillRuntime, slot: number, src: CastSource) {
    // The persistent hero Orbit always keeps activation lineage, including the Outbound mutation:
    // Outbound adds a pulse but does not erase the continuously simulated blade actors.
    if(src.faction==='hero'){
      if(this.physical.orbitActivationId && this.physical.orbitActivationId!==this.physical.currentActivationId){
        const oldCenter=this.orbitCenter();
        this.finishAsyncPhysical(this.physical.orbitActivationId,oldCenter.x,oldCenter.z);
      }
      if(this.physical.currentActivationId && this.physical.orbitActivationId!==this.physical.currentActivationId)
        this.registerAsyncPhysical(this.physical.currentActivationId);
      this.physical.orbitActivationId=this.physical.currentActivationId;
    }
    // A rival cannot borrow the hero's global orbit loop; its echo remains an authored pulse.
    if (src.faction === 'rival' || st.mutation === 'orbit_outbound') {
      const r = this.skillRadius(st, src.faction === 'rival' ? 2.8 : 4.6, slot),
        shape:CombatShape={ kind: 'circle', x: src.x, z: src.z, radius: r };
      this.combatShape('orbit_blades', shape);
      for (const e of this.targetsFor(src)) {
        if (!combatShapeIntersectsCircle(shape,e.x,e.z,e.radius)) continue;
        this.damage(
          e,
          skills.orbit_blades.baseDamage *
            (src.faction === 'rival' ? 1.45 : 2.2) *
            this.powerBucket(st) *
            this.slotAmp(slot, e),
          'orbit_blades',
          false,
          src.x,
          src.z,
          slot
        );
      }
    }
  }
  private castMortar(st: SkillRuntime, slot: number, src: CastSource) {
    const mut=st.mutation,range=this.skillRange(st,skills.mortar_bloom.baseRange);let p=this.aimPoint(src,range);let r=this.skillRadius(st,skills.mortar_bloom.baseRadius,slot),mult=1;
    if(this.mutationIs(st,'mortar_spotter')){
      const marked=this.bestTarget(
        src,
        (e)=>{
          if(e.kind!=='elite'||e.markUntil<=this.time) return false;
          const dx=e.x-src.x,dz=e.z-src.z;
          return dx*dx+dz*dz<=(range+3)*(range+3);
        },
        (a,b)=>{
          const adx=a.x-p.x,adz=a.z-p.z,bdx=b.x-p.x,bdz=b.z-p.z;
          return adx*adx+adz*adz-(bdx*bdx+bdz*bdz);
        }
      );
      if(marked)p={x:marked.x,z:marked.z};
    }
    if(mut==='mortar_fuse'){r*=1.35;mult*=1.35;}if(this.mutationIs(st,'mortar_airburst')){r*=1.2;mult*=0.86;}
    const baseDamage=skills.mortar_bloom.baseDamage*this.powerBucket(st)*this.slotAmp(slot)*mult;
    let points:{x:number;z:number;delay:number}[]=[];
    if(this.mutationIs(st,'mortar_carpet')){for(let i=-2;i<=2;i++)points.push({x:p.x+src.aimX*i*1.7,z:p.z+src.aimZ*i*1.7,delay:0.25+(i+2)*0.13});}
    else if(this.mutationIs(st,'mortar_hunter_pass')){const elite=this.bestTarget(src,(e)=>e.kind==='elite',(a,b)=>{const marked=Number(b.markUntil>this.time)-Number(a.markUntil>this.time);if(marked)return marked;const adx=a.x-src.x,adz=a.z-src.z,bdx=b.x-src.x,bdz=b.z-src.z;return adx*adx+adz*adz-(bdx*bdx+bdz*bdz);});const t=elite??({x:p.x,z:p.z} as Ent);for(let i=0;i<3;i++){const a=i*Math.PI*2/3;points.push({x:t.x+Math.cos(a)*1.35,z:t.z+Math.sin(a)*1.35,delay:0.28+i*0.22});}}
    else {const n=mut==='mortar_cluster'?3:Math.max(1,Math.min(3,this.projectileCount(st,slot)));for(let i=0;i<n;i++){const a=i?this.rng.range(0,Math.PI*2):0,rr=i?this.rng.range(0.7,1.5):0;points.push({x:p.x+Math.cos(a)*rr,z:p.z+Math.sin(a)*rr,delay:0.38+i*0.12});}}
    for(const q of points)this.scheduleStrike({
      at:this.time+q.delay,x:q.x,z:q.z,radius:r,damage:baseDamage,faction:src.faction,
      ownerId:src.owner?.id??0,source:'mortar_bloom',sourceSlot:slot,intent:'damage',
      telegraph:'bombardier_marker',
      fieldKind:this.mutationIs(st,'mortar_gravity_field')?'arc':this.mutationIs(st,'mortar_crater')?'frost':undefined,
      fieldDuration:this.mutationIs(st,'mortar_gravity_field')?3.4:2.5,
      fieldDps:this.mutationIs(st,'mortar_gravity_field')?5*this.powerBucket(st):6*this.powerBucket(st),
      fieldBehavior:this.mutationIs(st,'mortar_gravity_field')?'pull':undefined
    });
    this.noteState('field');
  }

  private castSentry(st: SkillRuntime, slot: number, src: CastSource) {
    let count=Math.max(1,Math.round(st.count))+this.activationCountBonus+(this.mutationContinuation(st)?.countAdd??0);
    if(this.supportsAxis(st.id,'multiplicity')) count+=Math.ceil(this.resonance.multiplicity/2);
    if(!src.owner) count+=Math.min(2,Math.floor(this.doctrines.quantity/2));
    count=Math.max(1,Math.min(5,count));

    // Base Sentry is now spatial construction, not "pop a turret beside the hero".
    // Each beat builds a short forward battery. Movement/facing and Catalyst choreography
    // therefore leave a legible field of recent positions that Grid/Arc can actually use.
    const perpX=-src.aimZ, perpZ=src.aimX,
      forward=2.5+(count>3?0.35:0),
      spacing=1.05;
    for(let i=0;i<count;i++){
      const lane=i-(count-1)/2,
        stagger=(i%2)*0.35,
        rawX=src.x+src.aimX*(forward+stagger)+perpX*lane*spacing,
        rawZ=src.z+src.aimZ*(forward+stagger)+perpZ*lane*spacing,
        p=this.freeOf(rawX,rawZ,0.38),
        id=this.nextId++;
      const activationId=src.faction==='hero'?this.physical.currentActivationId:0;
      this.constructs.push({id,activationId:activationId||undefined,x:p.x,z:p.z,ttl:this.persistentDuration(st,5.25,slot),cooldown:this.mutationIs(st,'sentry_hunter_battery')?0:0.1+i*0.08,range:this.skillRange(st,skills.sentry.baseRange),power:this.powerBucket(st)*this.slotAmp(slot),skill:'sentry',faction:src.faction,ownerId:src.owner?.id??0,sourceSlot:slot,mutation:st.mutation,mutationUpgrade:st.mutationUpgrade,mutationApotheosis:st.mutationApotheosis,rivalConcentration:effectGrammar.sentry.rivalConcentration});
      if(activationId)this.registerAsyncPhysical(activationId);
      if(this.currentChoreography&&src.faction==='hero')this.currentChoreography.carriers.push({kind:'construct',id});
      this.events.push({type:'ConstructSpawned',tick:this.tick,skill:'sentry',x:p.x,z:p.z});
      this.combatShape('sentry_placement',{kind:'circle',x:p.x,z:p.z,radius:0.42},'field');
    }
    while(this.constructs.length>18){
      const removed=this.constructs.shift();
      if(removed?.activationId)this.finishAsyncPhysical(removed.activationId,removed.x,removed.z);
    }
    this.noteState('construct');
  }

  private castToxic(st: SkillRuntime, slot: number, src: CastSource) {
    let r=this.skillRadius(st,skills.toxic_mist.baseRadius,slot),dps=skills.toxic_mist.baseDamage*this.powerBucket(st)*this.slotAmp(slot);if(st.mutation==='toxic_distilled'){r*=0.58;dps*=1.85;}const x=this.mutationIs(st,'toxic_plume')?src.x-src.vx*0.55:src.x,z=this.mutationIs(st,'toxic_plume')?src.z-src.vz*0.55:src.z;
    const mistShape:CombatShape={kind:'circle',x,z,radius:r};
    const reactiveTargets:Ent[]=[];if(this.mutationIs(st,'toxic_reactive'))for(const e of this.targetsFor(src)){if(e.hp<=0||!combatShapeIntersectsCircle(mistShape,e.x,e.z,e.radius))continue;const reactive=e.igniteUntil>this.time||e.chillUntil>this.time||(e.frozenUntil??0)>this.time||e.exposedUntil>this.time||e.displacedUntil>this.time;if(reactive){this.damage(e,dps*1.25,'septic_cut',false,x,z,slot);this.metrics.reactions++;reactiveTargets.push(e);}}
    const pushField=(fx:number,fz:number,fr:number,ttl:number,behavior?:'host')=>this.fields.push({id:this.nextId++,x:fx,z:fz,radius:fr,ttl,kind:'toxic',dps,tickAcc:0,faction:src.faction,ownerId:src.owner?.id??0,source:st.id,sourceSlot:slot,mutation:st.mutation,rivalConcentration:effectGrammar[st.id].rivalConcentration,behavior});
    this.combatShape('toxic_mist',mistShape,'field');pushField(x,z,r,this.persistentDuration(st,4.2,slot),this.mutationIs(st,'toxic_pestilent_host')?'host':undefined);
    if(this.mutationIs(st,'toxic_plague_road')){const m=Math.hypot(src.vx,src.vz)||1,dx=src.vx/m,dz=src.vz/m;for(let i=1;i<=3;i++)pushField(x-dx*i*1.3,z-dz*i*1.3,r*0.55,2.4);}
    if(this.mutationIs(st,'toxic_septic_bloom'))for(const e of reactiveTargets){for(let i=0;i<4;i++){const a=i*Math.PI/2;pushField(e.x+Math.cos(a)*1.1,e.z+Math.sin(a)*1.1,r*0.42,2.2);this.scheduleStrike({at:this.time+0.12+i*0.04,x:e.x+Math.cos(a)*1.1,z:e.z+Math.sin(a)*1.1,radius:r*0.45,damage:dps*0.72,faction:src.faction,ownerId:src.owner?.id??0,source:'toxic_mist',sourceSlot:slot,intent:'field',telegraph:'septic_bloom'});}}
    this.noteState('toxin');
  }

  private castRepulse(st: SkillRuntime, slot: number, src: CastSource) {
    const mut = st.mutation,
      r0 = this.skillRadius(st, skills.repulse_halo.baseRadius, slot),
      passes = this.mutationIs(st, 'repulse_rings') ? 2 : 1;
    let aegisGranted = 0;
    for (let pass = 0; pass < passes; pass++) {
      const r = r0 * (passes === 2 ? (pass === 0 ? 0.72 : 1.05) : 1),
        pull = mut === 'repulse_gravity';
      this.combatShape(
        'repulse_halo',
        { kind: 'circle', x: src.x, z: src.z, radius: r },
        'control'
      );
      for (const e of this.targetsFor(src)) {
        if (e.hp <= 0) continue;
        const dx = e.x - src.x,
          dz = e.z - src.z,
          d = Math.hypot(dx, dz) || 1;
        if (d > r + e.radius) continue;
        let dmg =
          skills.repulse_halo.baseDamage *
          this.powerBucket(st) *
          this.slotAmp(slot, e) *
          (passes === 2 ? 0.7 : 1);
        if (mut === 'repulse_front') dmg *= d > r * 0.68 ? 2.0 : 0.42;
        this.damage(e, dmg, 'repulse_halo', false);
        const force = (0.72 + 0.58 * st.control) * (pull ? -1 : 1);
        e.x += (dx / d) * force;
        e.z += (dz / d) * force;
        e.displacedUntil = this.time + 1.4;
        this.noteState('displaced');
        this.currentActivationControl += 1.2 + st.control;
        if (mut === 'repulse_aegis' && aegisGranted < 24) {
          const g = Math.min(24 - aegisGranted, 2.2 + 1.3 * st.control);
          this.grantBarrier(g);
          aegisGranted += g;
        }
        if (this.mutationIs(st, 'repulse_relay'))
          this.charge = Math.min(6, this.charge + 0.22 + st.control * 0.08);
      }
    }
  }

  private castMassDriver(st: SkillRuntime, slot: number, src: CastSource) {
    const mut=st.mutation, range=this.skillRange(st,skills.mass_driver.baseRange);
    let speed=3.8,radius=this.skillRadius(st,0.72,slot),damage=skills.mass_driver.baseDamage*this.powerBucket(st)*this.slotAmp(slot),cover=90;
    if(mut==='mass_rail'){speed=6.2;radius*=0.72;damage*=1.45;}
    if(mut==='mass_snowball'){speed=3.25;radius*=1.08;}
    let cargo=0;
    if(this.mutationIs(st,'mass_cargo')){for(const c of this.constructs){const dx=c.x-src.x,dz=c.z-src.z,t=dx*src.aimX+dz*src.aimZ,lat=Math.abs(dx*src.aimZ-dz*src.aimX);if(t>0&&t<range&&lat<1.5)cargo++;}for(const q of this.pickups){const dx=q.x-src.x,dz=q.z-src.z,t=dx*src.aimX+dz*src.aimZ,lat=Math.abs(dx*src.aimZ-dz*src.aimX);if(t>0&&t<range&&lat<1.1)cargo++;}damage*=1+Math.min(0.9,cargo*0.14);radius*=1+Math.min(0.35,cargo*0.04);}
    if(this.mutationIs(st,'mass_terminal')){speed*=1.38;damage*=1.42;radius*=0.9;}
    if(mut==='mass_recoil'||this.mutationIs(st,'mass_counterthrust')){const kick=this.mutationIs(st,'mass_comet_recoil')?1.8:1.05;this.displaceSource(src,-src.aimX*kick,-src.aimZ*kick);if(!src.owner&&this.mutationIs(st,'mass_comet_recoil'))this.dashIFramesUntil=Math.max(this.dashIFramesUntil,this.time+0.16);}
    if(this.mutationIs(st,'mass_comet_recoil')){speed*=1.35;damage*=1.28;radius*=1.18;}
    this.combatShape('mass_driver',{kind:'ray',x:src.x,z:src.z,aimX:src.aimX,aimZ:src.aimZ,range,halfWidth:radius},'control',false);
    this.spawnProjectile({x:src.x+src.aimX*(radius+0.25),z:src.z+src.aimZ*(radius+0.25),vx:src.aimX*speed,vz:src.aimZ*speed,radius,ttl:range/speed,damage,coverDamage:cover+damage*0.8,faction:src.faction,ownerId:src.owner?.id??0,source:'mass_driver',sourceSlot:slot,mutation:mut,apotheosis:st.mutationApotheosis,rivalConcentration:effectGrammar.mass_driver.rivalConcentration,behavior:'roller',phase:0,hitIds:[],growth:this.mutationIs(st,'mass_avalanche')?0.12:mut==='mass_snowball'?0.06:0});
  }

  private damage(
    e: Ent,
    amount: number,
    source: string,
    directional: boolean,
    sourceX = this.px,
    sourceZ = this.pz,
    sourceSlot = this.currentSlot
  ) {
    // A rival-owned cast resolves against the player, not against the enemy roster.
    // None of the bookkeeping below applies: it is all scored from the hero's point of view.
    if (e === this.hero) return this.damageHero(amount, source as DamageSourceId);
    // Everything reaching this line is the hero striking an enemy: rival casts resolve
    // against the synthetic hero above and elite contact goes straight to hitPlayer.
    amount *= this.itemDamageMul;
    if (e.kind === 'elite') amount *= this.itemEliteDamageMul;
    if (e.hp <= 0) return false;
    let actual = amount;
    if (e.kind === 'elite') actual *= e.relicDamageTakenMul ?? 1;
    const skill = this.skillsRuntime.get(source as SkillId);
    if (skill) {
      if (e.kind === 'elite') actual *= 1 + skill.eliteDamage;
      const precision = this.supportsAxis(skill.id, 'precision')
        ? this.resonance.precision * 0.045
        : 0;
      const critChance = skill.crit + precision + this.itemCrit + this.doctrines.precision * 0.03;
      if (critChance > 0 && this.rng.float() < critChance) actual *= 1.75;
    }
    if (e.kind === 'elite' && !e.boss) {
      if (e.chassis === 'bulwark' && (skill || this.activationDerived)) {
        const key = skill ? skill.id : 'derived';
        if (!e.prismMemory) {
          e.prismMemory = key;
          this.events.push({
            type: 'EliteOrder',
            tick: this.tick,
            entity: e.id,
            order: 'prism',
            x: e.x,
            z: e.z
          });
        } else if (e.prismMemory === key) actual *= 0.28;
        else {
          e.prismMemory = key;
          actual *= 1.34;
          e.exposedUntil = this.time + 0.45;
        }
      }
      if (e.chassis === 'harvester') {
        if (this.activationDerived) {
          actual *= 0.38;
          e.adaptStage = Math.min(5, e.adaptStage + 1);
          this.events.push({
            type: 'EliteOrder',
            tick: this.tick,
            entity: e.id,
            order: 'null',
            x: e.x,
            z: e.z,
            count: e.adaptStage
          });
        } else if (skill && e.adaptStage > 0) {
          e.adaptStage--;
          actual *= 1.24;
        }
      }
      if (e.chassis === 'broodmaker' && (skill || this.activationDerived)) {
        e.affixPulse++;
        const threshold = Math.max(5, 8 - this.resonance.conductivity);
        if (e.affixPulse >= threshold) {
          e.affixPulse = 0;
          this.spawnReplicant(e);
        }
      }
      if (e.chassis === 'shepherd' && !e.shepherdMode && e.hp - actual <= e.maxHp * 0.68) {
        const recent = this.damageSamples.filter((q) => q.t >= this.time - 5),
          sum = recent.reduce((a, q) => a + q.amount, 0),
          derived = recent.reduce((a, q) => a + (q.derived ? q.amount : 0), 0),
          rate = recent.length / 5,
          avg = recent.length ? sum / recent.length : 0;
        e.shepherdMode =
          derived / Math.max(1, sum) > 0.42
            ? 'null'
            : rate > 9
              ? 'condensed'
              : avg > 95 * this.corePower()
                ? 'fractured'
                : 'migratory';
        if (e.shepherdMode === 'fractured') {
          for (let i = 0; i < 3; i++) this.spawnReplicant(e);
        }
        this.events.push({
          type: 'EliteOrder',
          tick: this.tick,
          entity: e.id,
          order: 'metamorph',
          x: e.x,
          z: e.z,
          count: recent.length
        });
      }
      if (e.chassis === 'shepherd' && e.shepherdMode === 'null' && this.activationDerived)
        actual *= 0.48;
    }
    if (source !== 'ember_lance' && e.markUntil > this.time) {
      actual *= 1.35;
      e.markUntil = 0;
    }
    if (e.exposedUntil > this.time) actual *= 1.3;
    if (e.kind !== 'binder' && e.linkedTo) {
      const binder = this.entityStore.getAlive(e.linkedTo);
      if (binder?.kind === 'binder') actual *= 0.65;
    }
    if (e.kind === 'elite' && e.affix === 'shielded' && directional) {
      const state=e.shieldState??'guard';
      if(state==='broken') actual*=1.3;
      else {
        const incoming=Math.atan2(sourceZ-e.z,sourceX-e.x),diff=Math.abs(this.angleDiff(incoming,e.shieldAngle));
        actual*=diff<0.95?(state==='commit'?0.58:0.42):(state==='commit'?1.35:1.2);
      }
    }
    const before = e.hp;
    e.hp -= actual;
    e.lastDamageAt = this.time;
    if (source === 'sentry') e.sentryTouchedUntil = this.time + 4;
    this.metrics.damage += actual;
    this.damageBySource.set(source, (this.damageBySource.get(source) ?? 0) + actual);
    this.hitsBySource.set(source, (this.hitsBySource.get(source) ?? 0) + 1);
    this.damageSamples.push({
      t: this.time,
      source,
      amount: actual,
      derived: this.activationDerived
    });
    while (this.damageSamples.length && this.damageSamples[0].t < this.time - 12)
      this.damageSamples.shift();
    if (e.kind === 'elite') {
      this.metrics.eliteDamage += actual;
      const record = this.eliteLogById.get(e.id);
      if (record) {
        record.damageFromHero += actual;
        const delayedOwner: Partial<Record<string, SkillId>> = {
          wound_dot: 'cleaver',
          toxin_dot: 'toxic_mist',
          arc_field: 'chain_arc',
          fire_field: 'ember_lance'
        };
        const ownerSkill = delayedOwner[source] ?? (skills[source as SkillId] ? (source as SkillId) : null);
        const resolvedSlot = sourceSlot >= 0 ? sourceSlot : ownerSkill ? this.slots.indexOf(ownerSkill) : -1;
        const node = resolvedSlot >= 0 ? `${resolvedSlot}:${ownerSkill ?? source}` : `derived:${source}`;
        record.damageFromHeroByNode[node] = (record.damageFromHeroByNode[node] ?? 0) + actual;
        if (record.engagedAt < 0) record.engagedAt = this.time;
        record.lastExchangeAt = this.time;
      }
    }
    if (directional) this.directionalDamage += actual;
    if (source === 'cleaver' || source === 'orbit_blades') {
      this.closeDamage += actual;
      if (this.doctrines.guard > 0 && Math.hypot(e.x - this.px, e.z - this.pz) < 4.2)
        this.grantBarrier(Math.min(3.5, actual * (0.0025 + this.doctrines.guard * 0.0014)));
      if (e.kind === 'elite' && e.affix === 'shielded' && this.doctrines.force > 0) {
        e.shieldStability = Math.max(0, (e.shieldStability ?? 100) - actual * (0.018 + this.doctrines.force * 0.008));
        if ((e.shieldStability ?? 0) <= 0 && (e.shieldState ?? 'guard') !== 'broken') {
          e.shieldState = 'broken';
          e.shieldCommitUntil = this.time + 1.65;
          e.exposedUntil = Math.max(e.exposedUntil, this.time + 1.65);
          this.events.push({ type:'RareEvent', tick:this.tick, title:'ЩИТ СЛОМАН', detail:'Окно уязвимости элиты', x:e.x, z:e.z });
        }
      }
    }
    if (source.includes('field') || source === 'toxic_mist') this.fieldDamage += actual;
    if (skill && this.currentSlot >= 0) {
      this.currentHits.add(e.id);
      this.currentActivationDamage += actual;
      if (this.currentChoreography?.skill === skill.id) {
        const p={x:e.x,z:e.z},
          last=this.currentChoreography.contacts[this.currentChoreography.contacts.length-1];
        if(!last || !this.sameChoreographyPoint(last,p,0.02))
          this.currentChoreography.contacts.push(p);
      }
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
      crit: !!skill && actual > amount * 1.55
    });
    const killed = before > 0 && e.hp <= 0;
    if (this.itemSiphon > 0) this.healPlayer(Math.min(before, actual) * this.itemSiphon);
    if (killed) this.killsBySource.set(source, (this.killsBySource.get(source) ?? 0) + 1);
    if (killed && skill && this.currentSlot >= 0) {
      this.currentActivationKills++;
      this.currentActivationOverkill += Math.max(0, actual - before);
    }
    if (
      killed &&
      source === 'ember_lance' &&
      (() => { const st = this.skillsRuntime.get('ember_lance'); return !!st && this.mutationIs(st, 'ember_backdraft'); })()
    ) {
      for (const o of this.ents) {
        if (o !== e && o.hp > 0 && Math.hypot(o.x - e.x, o.z - e.z) < 2.3) {
          const dx = e.x - o.x,
            dz = e.z - o.z,
            d = Math.hypot(dx, dz) || 1;
          o.x += (dx / d) * 0.45;
          o.z += (dz / d) * 0.45;
          this.damage(o, 18 * (1 + this.globalPower), 'backdraft', false, e.x, e.z);
        }
      }
    }
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
    if (attacker) {
      amount *= concentration;
      amount *= this.itemRefusalDamageMul;
      if ((attacker.relicCritChance ?? 0) > 0 && this.rng.float() < Math.min(0.65, attacker.relicCritChance ?? 0))
        amount *= 1.6;
      amount *= Math.pow(1.3, this.rivalAxisCount(attacker, 'precision'));
      amount *= Math.pow(1.16, this.rivalAxisCount(attacker, 'multiplicity'));
      const allItemMul = attacker.relicCastMul ?? 1;
      const groundMul = attacker.groundRelicCastMul ?? 1;
      if (groundMul > 1) {
        const withoutGround = amount * (allItemMul / groundMul);
        const reduction = this.armor / (this.armor + 100);
        const record = this.eliteLogById.get(attacker.id);
        if (record)
          record.itemAmplifiedDamage +=
            (amount * allItemMul - withoutGround) * (1 - reduction) * this.itemDamageTakenMul;
      }
      amount *= allItemMul;
    }
    if (this.php <= 0) return false;
    this.hitPlayer(amount, attacker, source);
    if (attacker && (attacker.relicSiphon ?? 0) > 0)
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + amount * (attacker.relicSiphon ?? 0));
    this.damageToHeroBySource.set(source, (this.damageToHeroBySource.get(source) ?? 0) + amount);
    return this.php <= 0;
  }
  private angleDiff(a: number, b: number) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
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
    const evolvable = this.slots.filter((id): id is SkillId => {
      if (!id) return false;
      const st = this.skillState(id);
      return !st.mutation || (!st.mutationUpgrade && mutationChildren(id, st.mutation).length > 0) || (!!st.mutationUpgrade && !st.mutationApotheosis && mutationChildren(id, st.mutationUpgrade).length > 0);
    });
    if (this.mutationCores > 0 && evolvable.length) {
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
  private skillOrderUnowned() {
    const owned = this.allOwnedSkills();
    return activeSkillOrder.filter((id) => !owned.includes(id));
  }
  private shuffle<T>(a: T[]) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.rng.int(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  private rollRarity(min: Rarity = 'common') {
    const F = this.fortune,
      weights = [
        52 / (1 + 0.5 * F),
        28,
        13 * (1 + 0.6 * F),
        5.5 * (1 + 1.1 * F),
        1.5 * (1 + 1.8 * F)
      ],
      minIdx = rarityOrder.indexOf(min);
    for (let i = 0; i < minIdx; i++) weights[i] = 0;
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.rng.float() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return rarityOrder[i];
    }
    return rarityOrder[4];
  }
  private fmtSkillStat(st: SkillRuntime, stat: string, val?: number) {
    const v = val ?? (st as unknown as Record<string, number>)[stat] ?? 0;
    if (
      stat === 'power' ||
      stat === 'coverage' ||
      stat === 'range' ||
      stat === 'duration' ||
      stat === 'eliteDamage' ||
      stat === 'control' ||
      stat === 'statusPotency'
    )
      return `+${Math.round(v * 100)}%`;
    if (stat === 'crit') return `${Math.round(v * 100)}%`;
    if (stat === 'count') return String(Math.round(v));
    return String(v);
  }
  private axisLabel(id: SkillId, stat: string) {
    const custom: Partial<Record<SkillId, Partial<Record<string, string>>>> = {
      ember_lance: {
        power: 'Жар копья',
        range: 'Длина полёта',
        count: 'Число копий',
        statusPotency: 'Горение',
        crit: 'Пробой'
      },
      frost_ring: {
        coverage: 'Радиус фронта',
        statusPotency: 'Глубина холода',
        duration: 'Иней после волны',
        power: 'Удар фронта',
        control: 'Сдерживание'
      },
      cleaver: {
        power: 'Вес удара',
        coverage: 'Дуга и reach',
        control: 'Сдвиг толпы',
        crit: 'Режущая кромка',
        statusPotency: 'Глубина раны'
      },
      chain_arc: {
        power: 'Напряжение',
        count: 'Число переходов',
        range: 'Дальность реле',
        statusPotency: 'Заряд',
        crit: 'Перегрузка'
      },
      orbit_blades: {
        power: 'Масса лезвий',
        count: 'Число лезвий',
        coverage: 'Радиус орбиты',
        crit: 'Кромка',
        eliteDamage: 'Давление на элиту'
      },
      mortar_bloom: {
        power: 'Сила взрыва',
        coverage: 'Радиус взрыва',
        count: 'Снаряды залпа',
        range: 'Дальность наводки',
        crit: 'Точный разрыв'
      },
      sentry: {
        power: 'Калибр турели',
        range: 'Сектор огня',
        duration: 'Время в поле',
        count: 'Число турелей',
        eliteDamage: 'Тяжёлая цель'
      },
      toxic_mist: {
        power: 'Концентрация',
        duration: 'Стойкость облака',
        coverage: 'Площадь облака',
        statusPotency: 'Насыщение токсином',
        control: 'Вязкость'
      }
    };
    return custom[id]?.[stat] ?? this.statLabel(stat);
  }
  private statLabel(stat: string) {
    return (
      (
        {
          power: 'Сила',
          coverage: 'Охват',
          range: 'Дальность',
          duration: 'Длительность',
          crit: 'Крит. шанс',
          eliteDamage: 'Урон по элитам',
          count: 'Количество',
          control: 'Контроль',
          statusPotency: 'Сила статуса'
        } as Record<string, string>
      )[stat] ?? stat
    );
  }
  private makeResonanceOffer(id?: ResonanceId): RewardOffer {
    const rid = id ?? resonanceOrder[this.rng.int(resonanceOrder.length)],
      d = resonance[rid],
      before = this.resonance[rid],
      after = before + 1;
    return {
      id: `axis:${rid}:${this.rng.nextU32()}`,
      kind: 'resonance',
      title: d.name,
      subtitle: `УСИЛЕНИЕ ЯДРА ${before} → ${after}`,
      description: d.description,
      resonance: rid,
      stat: rid,
      amount: 1,
      before: String(before),
      after: String(after)
    };
  }
  private makeGlobalOffer(): RewardOffer {
    const stats = ['hp', 'pickup', 'fortune', 'armor'],
      stat = stats[this.rng.int(stats.length)],
      rarity = this.rollRarity(),
      m = rarityMultiplier[rarity];
    if (stat === 'hp')
      return {
        id: `g:h:${this.rng.nextU32()}`,
        kind: 'global',
        title: 'Закалка',
        subtitle: `+${Math.round(18 * m)} к максимуму здоровья`,
        description: 'Универсальная выживаемость; не привязана к конкретному феномену.',
        stat,
        amount: 18 * m,
        rarity
      };
    if (stat === 'pickup')
      return {
        id: `g:pick:${this.rng.nextU32()}`,
        kind: 'global',
        title: 'Притяжение осколков',
        subtitle: `+${Math.round(15 * m)}% радиуса сбора`,
        description: 'Опыт и подбираемые объекты раньше начинают лететь к игроку.',
        stat,
        amount: 0.15 * m,
        rarity
      };
    if (stat === 'fortune')
      return {
        id: `g:f:${this.rng.nextU32()}`,
        kind: 'global',
        title: 'Удача',
        subtitle: `+${Math.round(8 * m)}% к удаче`,
        description: 'Редкие находки выпадают чаще.',
        stat,
        amount: 0.08 * m,
        rarity
      };
    return {
      id: `g:a:${this.rng.nextU32()}`,
      kind: 'global',
      title: 'Архивная броня',
      subtitle: `+${Math.round(10 * m)} брони`,
      description: 'Снижает входящий урон; каждый следующий пункт брони даёт чуть меньший прирост защиты.',
      stat: 'armor',
      amount: 10 * m,
      rarity
    };
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
  private makeCatalystAdd(id: CatalystId): RewardOffer {
    const edges = this.catalystCompatibleEdges(id),
      examples = edges
        .slice(0, 2)
        .map((edge) => {
          const left = this.slots[edge]!,
            right = this.slots[edge + 1]!;
          return `${skills[left].shortName} → ${skills[right].shortName}`;
        });
    return {
      id: `addcat:${id}:${this.rng.nextU32()}`,
      kind: 'catalyst_add',
      title: catalysts[id].name,
      subtitle: 'КАТАЛИЗАТОР · связь феноменов',
      description:
        catalysts[id].desc +
        (examples.length
          ? ` Сейчас подходит: ${examples.join(' · ')}.`
          : ' Поставьте его между совместимой парой феноменов.'),
      catalyst: id
    };
  }
  private generateDiscovery() {
    const choices = this.shuffle(this.skillOrderUnowned()).slice(0, 3),
      free = this.slots.some((x) => !x) || this.skillReserve.some((x) => !x);
    this.rewardOffers = choices.map((id) => free ? this.makeSkillAdd(id) : this.makeSkillSwap(id));
    this.choiceSerial++;
  }
  private makeDoctrineOffer(id?: DoctrineId): RewardOffer {
    const did = id ?? doctrineOrder[this.rng.int(doctrineOrder.length)],
      d = doctrines[did],
      before = this.doctrines[did],
      after = before + 1;
    return {
      id: `doctrine:${did}:${this.rng.nextU32()}`,
      kind: 'doctrine',
      title: d.name,
      subtitle: `СПЕЦИАЛИЗАЦИЯ ${before} → ${after}`,
      description: d.description,
      doctrine: did,
      amount: 1,
      before: String(before),
      after: String(after)
    };
  }
  /** v0.11: XP answers exactly one question — what kind of build is the hero becoming? */
  private generateLevelOffers() {
    const ids = this.shuffle([...doctrineOrder]);
    // Soft steering without a hard recipe: close builds see survival/reach more often,
    // projectile/construct builds still retain wildcard access to the entire doctrine pool.
    const close = this.slots.filter((id) => id === 'cleaver' || id === 'orbit_blades').length;
    const preferred: DoctrineId[] = close >= 2 ? ['size','guard','mobility','force'] : ['might','precision','quantity','duration'];
    const out: DoctrineId[] = [];
    if (this.rng.float() < 0.7) {
      const p = preferred.filter((x) => !out.includes(x));
      if (p.length) out.push(p[this.rng.int(p.length)]);
    }
    while (out.length < 3 && ids.length) {
      const id = ids.shift()!;
      if (!out.includes(id)) out.push(id);
    }
    this.rewardOffers = out.slice(0,3).map((id) => this.makeDoctrineOffer(id));
    this.choiceSerial++;
  }
  private catalystOrderUnowned() {
    const owned = this.allOwnedCatalysts();
    return catalystOrder.filter((id) => !owned.includes(id));
  }
  private rollItemId(): ItemId | null {
    const ids = itemOrder;
    return ids.length ? ids[this.rng.int(ids.length)] : null;
  }
  private makeItemOffer(id: ItemId): RewardOffer {
    const def = items[id];
    return {
      id: `item:${id}:${this.rng.nextU32()}`,
      kind: 'item_grant',
      title: def.name,
      subtitle: `${itemCategoryName[def.category].toUpperCase()} · находка`,
      description: def.description,
      item: id
    };
  }
  private makeSkillAdd(id: SkillId): RewardOffer {
    return {
      id: `discover:${id}:${this.rng.nextU32()}`,
      kind: 'skill_add',
      title: skills[id].name,
      subtitle: 'НАХОДКА · новый феномен',
      description: `${skills[id].description} Сильная сторона: ${skills[id].identity ?? '—'} Слабость: ${skills[id].weakness ?? '—'}`,
      skill: id
    };
  }
  /** D27: with every place taken, a find arrives as an exchange rather than not at all. */
  private makeSkillSwap(id: SkillId): RewardOffer {
    const slot = this.rng.int(this.slots.length);
    const leaving = this.slots[slot];
    return {
      id: `swap:${id}:${this.rng.nextU32()}`,
      kind: 'skill_swap',
      title: skills[id].name,
      subtitle: `ЗАМЕНА · вместо «${leaving ? skills[leaving].name : '—'}»`,
      description: `${skills[id].description} Снятый феномен уходит в резерв, а не пропадает.`,
      skill: id,
      swapSlot: slot
    };
  }
  private generateMutationTargetOffers() {
    const active = this.slots.filter((id): id is SkillId => {
      if (!id) return false;
      const st = this.skillState(id);
      if (!st.mutation) return mutationRoots(id).length > 0;
      if (!st.mutationUpgrade) return mutationChildren(id, st.mutation).length > 0;
      return !st.mutationApotheosis && mutationChildren(id, st.mutationUpgrade).length > 0;
    });
    if (!active.length) return;
    this.rewardOffers = this.shuffle([...active])
      .slice(0, 3)
      .map((id) => {
        const st = this.skillState(id),
          tier = !st.mutation ? 1 : !st.mutationUpgrade ? 2 : 3;
        return {
          id: `mut-target:${id}:${this.rng.nextU32()}`,
          kind: 'mutation_target' as const,
          title: skills[id].name,
          subtitle: tier === 3 ? `АПОФЕОЗ · ЯДРА: ${this.mutationCores}` : `${tier === 2 ? 'ПРОДОЛЖЕНИЕ' : 'МУТАЦИЯ'} · ЯДРА: ${this.mutationCores}`,
          description: tier === 3
            ? `Третий уровень ветви «${mutationDef(id, st.mutationUpgrade!).name}»: качественная трансформация, а не числовой бонус.`
            : tier === 2
              ? `Продолжить ветвь «${mutationDef(id, st.mutation!).name}». Корень останется активен.`
              : `Выбрать одну из трёх ветвей ${skills[id].name}.`,
          skill: id
        };
      });
    this.choiceSerial++;
  }
  private generateEliteCache() {
    const owned = this.allOwnedCatalysts(),
      allUnowned = catalystOrder.filter((id) => !owned.includes(id)),
      usefulUnowned = allUnowned.filter((id) => this.catalystCompatibleEdges(id).length > 0),
      unowned = usefulUnowned.length ? usefulUnowned : allUnowned;
    let offers: RewardOffer[] = [];
    const hasSpace = this.catalystReserve.some((x) => !x) || this.catalysts.some((x) => !x);
    if (unowned.length && hasSpace) {
      offers = this.shuffle([...unowned])
        .slice(0, 3)
        .map((id) => {
          const o = this.makeCatalystAdd(id);
          o.kind = 'elite';
          o.subtitle = 'ТАЙНИК ЭЛИТЫ · новый катализатор';
          return o;
        });
    } else {
      offers = this.shuffle([...resonanceOrder])
        .slice(0, 2)
        .map((id) => {
          const o = this.makeResonanceOffer(id);
          o.kind = 'elite';
          o.description = o.description + ' Усиливает всю сборку.';
          return o;
        });
      if (this.skillOrderUnowned().length) {
        const id = this.shuffle(this.skillOrderUnowned())[0];
        offers.push({
          id: `elite-discover:${id}:${this.rng.nextU32()}`,
          kind: 'elite',
          title: skills[id].name,
          subtitle: 'ТАЙНИК ЭЛИТЫ · новый феномен',
          description: `${skills[id].description} Сразу использует текущий уровень ядра.`,
          skill: id
        });
      } else offers.push(this.makeGlobalOffer());
    }
    this.rewardOffers = offers.slice(0, 3);
    const wanted = this.refusalRng.int(this.rewardOffers.length);
    this.rewardOffers[wanted].marked = true;
    this.choiceSerial++;
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
    const offers = this.rewardOffers;
    const offer = offers?.[index];
    if (!offers || !offer) return false;
    this.rewardOffers = null;
    if (offer.kind === 'mutation_target' && offer.skill) {
      this.pendingMutationTarget = true;
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
    const cards = passed.map((o) => this.refusalFromOffer(o)).filter((c): c is RefusedCard => !!c);
    if (!cards.length) return;
    // The hero was shown which card the elites were waiting for; honour that if he left
    // it, and fall back to chance only when he denied them by taking it himself.
    const wanted = passed.findIndex((o) => o.marked);
    const card =
      wanted >= 0 && cards[wanted] ? cards[wanted] : cards[this.refusalRng.int(cards.length)];
    card.serial = ++this.refusalSerial;
    this.refusalStore.push(card);
    this.events.push({
      type: 'RewardRefused',
      tick: this.tick,
      title: card.title,
      kind: card.kind,
      serial: card.serial
    });
  }
  private refusalFromOffer(o: RewardOffer): RefusedCard | null {
    const base = { serial: 0, title: o.title, heldBy: 0 };
    if (o.skill) return { ...base, kind: 'skill', icon: skills[o.skill].icon, skill: o.skill };
    if (o.catalyst)
      return {
        ...base,
        kind: 'catalyst',
        icon: catalysts[o.catalyst].shortName,
        catalyst: o.catalyst
      };
    if (o.item) return { ...base, kind: 'item', icon: items[o.item].short, item: o.item };
    if (o.resonance)
      return {
        ...base,
        kind: 'axis',
        icon: Simulation.AXIS_GLYPH[o.resonance] ?? o.resonance.slice(0, 3).toUpperCase(),
        resonance: o.resonance,
        amount: o.amount ?? 1
      };
    if (o.stat)
      return {
        ...base,
        kind: 'global',
        icon: Simulation.STAT_GLYPH[o.stat] ?? o.stat.slice(0, 3).toUpperCase(),
        stat: o.stat,
        amount: o.amount ?? 0
      };
    return null;
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
    this.mutationOffer = {
      skill: id,
      choices: tier === 1 ? this.shuffle([...choices]).slice(0, Simulation.MUTATION_BRANCHES) : choices,
      refusalAvailable: tier === 1 && this.mutationRefusalToken,
      tier
    };
    this.choiceSerial++;
  }
  chooseMutation(index: number) {
    const m = this.mutationOffer;
    if (!m) return false;
    const id = m.choices[index];
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
    if (this.pendingMutationTarget && this.mutationCores > 0) this.mutationCores--;
    this.pendingMutationTarget = false;
    this.metrics.mutations++;
    this.events.push({ type: 'MutationChosen', tick: this.tick, skill: m.skill, mutation: id });
    this.mutationOffer = null;
    return true;
  }
  refuseMutation(index: number) {
    const m = this.mutationOffer;
    if (!m || !m.refusalAvailable || !this.mutationRefusalToken) return false;
    const cur = new Set(m.choices),
      cand = mutationRoots(m.skill).map((x) => x.id).filter((id) => !cur.has(id));
    if (!cand.length) return false;
    m.choices[index] = cand[this.rng.int(cand.length)];
    this.mutationRefusalToken = false;
    m.refusalAvailable = false;
    this.choiceSerial++;
    return true;
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
    const passed = this.rewardOffers;
    this.rewardOffers = null;
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
    this.previousHits.clear();
    return true;
  }
  swapCatalystLocations(za: 'active' | 'reserve', a: number, zb: 'active' | 'reserve', b: number) {
    const A = za === 'active' ? this.catalysts : this.catalystReserve,
      B = zb === 'active' ? this.catalysts : this.catalystReserve;
    if (a < 0 || a >= A.length || b < 0 || b >= B.length || (A === B && a === b)) return false;
    [A[a], B[b]] = [B[b], A[a]];
    this.previousHits.clear();
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
      damageBySource: Object.fromEntries(this.damageBySource),
      killsBySource: Object.fromEntries(this.killsBySource),
      hitsBySource: Object.fromEntries(this.hitsBySource),
      avgEnemies: this.metrics.enemySamples
        ? this.metrics.enemyCountSum / this.metrics.enemySamples
        : 0,
      fieldsAlive: this.fields.length,
      constructsAlive: this.constructs.length
    };
  }

  snapshot(): Snapshot {
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
        dashing: this.time < this.dashUntil,
        dashReady: this.time >= this.dashReadyAt && this.time >= this.dashUntil,
        dashCharge: Math.max(
          0,
          Math.min(
            1,
            1 - (this.dashReadyAt - this.time) / Math.max(0.0001, Simulation.DASH_COOLDOWN)
          )
        ),
        invulnerable: this.time < this.dashIFramesUntil
      },
      entities: this.ents.map((e) => ({
        id: e.id,
        kind: e.kind,
        x: e.x,
        z: e.z,
        hp: e.hp,
        maxHp: e.maxHp,
        radius: e.radius,
        elite: e.kind === 'elite',
        boss: e.boss,
        guardianPoi: e.guardianPoi,
        chassis: e.chassis,
        affix: e.affix,
        facingX: e.facingX,
        facingZ: e.facingZ,
        telegraph: e.state === 'telegraph' ? Math.max(0, e.stateTimer / 0.72) : 0,
        eliteAction: e.eliteAction,
        eliteActionProgress: e.eliteActionUntil && e.eliteActionUntil > this.time
          ? Math.max(0, Math.min(1, (e.eliteActionUntil - this.time) / 0.9))
          : 0,
        linkedTo: e.linkedTo,
        revived: e.revived,
        buffed: e.buffUntil > this.time,
        shieldAngle: e.shieldAngle,
        shieldState: e.shieldState ?? 'guard',
        shieldStability: e.shieldStability ?? 100,
        echoPhase: this.eliteEchoes.get(e.id)?.phase ?? 'none',
        echoSkill: this.eliteEchoes.get(e.id)?.skill,
        regenerating: e.affix === 'regenerating' && this.time - e.lastDamageAt > 3,
        orderX: e.orderX,
        orderZ: e.orderZ,
        orderActive: e.orderUntil > this.time,
        squadTask: e.squadUntil && e.squadUntil > this.time ? (e.squadTask ?? 'none') : 'none',
        adaptationStage: e.adaptStage,
        eliteRarity: e.rarity,
        refusalTitles: e.repertoire
          .map((s: number) => this.refusalStore.find((card) => card.serial === s))
          .filter((card): card is RefusedCard => !!card)
          .map((card) => card.title),
        refusalKinds: e.repertoire
          .map((s: number) => this.refusalStore.find((card) => card.serial === s))
          .filter((card): card is RefusedCard => !!card)
          .map((card) => card.kind as string),
        refusalIcons: e.repertoire
          .map((s) => this.refusalStore.find((card) => card.serial === s)?.icon ?? '')
          .filter((s) => !!s),
        relicItems: [...(e.relicItems ?? [])],
        evolutionItems: [...(e.evolutionItems ?? [])],
        bossPhase: e.bossPhase,
        bossPattern: e.bossPattern,
        status: {
          marked: e.markUntil > this.time,
          ignited: e.igniteUntil > this.time,
          chilled: e.chillUntil > this.time,
          frozen: (e.frozenUntil ?? 0) > this.time,
          wounded: e.woundUntil > this.time,
          exposed: e.exposedUntil > this.time,
          embedded: e.embedded,
          toxined: e.toxinUntil > this.time
        }
      })),
      pickups: this.pickups.map((p) => ({ ...p })),
      relics: this.relics.map((r) => ({
        id: r.id,
        x: r.x,
        z: r.z,
        item: r.item,
        category: items[r.item].category,
        contested: this.ents.some(
          (e) => e.kind === 'elite' && !e.boss && Math.hypot(e.x - r.x, e.z - r.z) < 9
        )
      })),
      heldItems: [...this.heldItems],
      fields: this.fields.map(
        (f) =>
          ({
            id: f.id,
            x: f.x,
            z: f.z,
            radius: f.radius,
            ttl: f.ttl,
            kind: f.kind,
            faction: f.faction ?? 'hero',
            source: f.source ?? f.kind,
            mutation: f.mutation ?? null,
            behavior: f.behavior
          }) as FieldSnapshot
      ),
      constructs: this.constructs.map((c) => ({
        id: c.id,
        x: c.x,
        z: c.z,
        ttl: c.ttl,
        range: c.range,
        kind: 'sentry',
        faction: c.faction,
        mutation: c.mutation,
        mutationUpgrade: c.mutationUpgrade,
        mutationApotheosis: c.mutationApotheosis ?? null
      })),
      projectiles: this.projectiles.map((p) => ({
        id: p.id,
        x: p.x,
        z: p.z,
        radius: p.radius,
        faction: p.faction,
        source: p.source,
        guarded: p.guarded,
        behavior: p.behavior ?? 'normal',
        phase: p.phase ?? 0,
        mutation: p.mutation,
        apotheosis: p.apotheosis ?? null,
        carousel: !!p.carousel
      })),
      orbit: (() => {
        const st=this.skillsRuntime.get('orbit_blades');
        if(!st||!this.isActiveSkill('orbit_blades')) return {active:false,count:0,radius:0,centerX:this.px,centerZ:this.pz,mutation:null,apotheosis:null};
        const center=this.orbitCenter(),p=this.orbitSystem.profile(st,center);
        return {active:true,count:p.count,radius:p.radius,centerX:center.x,centerZ:center.z,mutation:st.mutation,apotheosis:st.mutationApotheosis};
      })(),
      world: {
        ...this.world,
        pois: this.pois.map((p) => ({ ...p })),
        obstacles: this.obstacles.map((o) => ({ ...o })),
        bossSpawned: this.bossSpawned,
        bossDefeated: this.bossDefeated
      },
      chain: {
        beat: this.beat,
        cycle: this.cycle,
        tempo: this.effectiveTempo(),
        slots: [...this.slots],
        catalysts: [...this.catalysts],
        skillReserve: [...this.skillReserve],
        catalystReserve: [...this.catalystReserve],
        catalystRuntime: [...this.catalystRuntime.values()].map((x) => ({ ...x }))
      },
      skills: [...this.skillsRuntime.values()].map((s) => ({ ...s })),
      resonance: { ...this.resonance },
      doctrines: { ...this.doctrines },
      metrics: { ...this.metrics },
      eliteCore: this.eliteCore,
      mutationCores: this.mutationCores,
      rewardOffers: this.rewardOffers ? this.rewardOffers.map((o) => ({ ...o })) : null,
      refusals: this.refusalStore.map((c) => ({ ...c })),
      mutationOffer: this.mutationOffer
        ? {
            skill: this.mutationOffer.skill,
            choices: [...this.mutationOffer.choices],
            refusalAvailable: this.mutationOffer.refusalAvailable,
            tier: this.mutationOffer.tier
          }
        : null,
      rerolls: this.rerolls,
      choiceSerial: this.choiceSerial
    };
  }
  /**
   * Version of the canonical-state layout below.
   *
   * Bump this whenever a field is added, removed, renamed or reordered. The version is
   * folded into the hash, so a stale baseline fails loudly instead of silently matching
   * a different layout. Never change the layout without bumping.
   */
  static readonly CANONICAL_SCHEMA_VERSION = 6;

  /**
   * Explicit, ordered schema of everything that defines a run.
   *
   * Each field is emitted as its own name followed by its value, so the hash input is
   * self-describing: a renamed or reordered field changes the result on purpose, and a
   * dropped field cannot be masked by a neighbour of the same type.
   *
   * Only include state the simulation actually reads back. Derived values, presentation
   * state and diagnostics that never feed a later decision do not belong here.
   */
  private canonicalState(): (number | string)[] {
    const parts: (number | string)[] = [];
    const put = (name: string, ...values: (number | string | boolean | null | undefined)[]) => {
      parts.push(name);
      for (const v of values)
        parts.push(v === null || v === undefined ? '-' : typeof v === 'boolean' ? (v ? 1 : 0) : v);
    };

    put('schema', Simulation.CANONICAL_SCHEMA_VERSION);
    put('mode', this.mode);
    put('tick', this.tick);
    put('rng', this.rng.state());

    put('player.pos', this.px, this.pz);
    put('player.hp', this.php, this.maxHp);
    put('player.mitigation', this.barrier, this.armor);
    put('player.dash', this.dashUntil, this.dashIFramesUntil, this.dashReadyAt);
    put('player.xp', this.level, this.xp, this.xpNeed);

    put('chain.beat', this.beat, this.cycle);
    put('chain.charges', this.capacitorCharge, this.overflowCharge, this.aegisCharge);
    put('chain.orbitChoreo', this.orbitChoreoUntil, this.orbitChoreoX, this.orbitChoreoZ, this.orbitChoreoCarrier?.kind ?? '-', this.orbitChoreoCarrier && 'id' in this.orbitChoreoCarrier ? this.orbitChoreoCarrier.id : this.orbitChoreoCarrier?.kind === 'orbit' ? this.orbitChoreoCarrier.index : -1);
    put('chain.context', this.lastContext.skill ?? '-', this.lastContext.x, this.lastContext.z, ...this.lastContext.hitIds);
    if (this.lastContext.trace) {
      const t=this.lastContext.trace;
      put('chain.trace',t.skill,t.origin.x,t.origin.z,t.aimX,t.aimZ,t.terminal?.x??'-',t.terminal?.z??'-');
      for(const p of t.points) put('chain.trace.point',p.x,p.z);
      for(const p of t.areaPoints) put('chain.trace.area',p.x,p.z);
      for(const path of t.paths) put('chain.trace.path',...path.flatMap((p)=>[p.x,p.z]));
      for(const q of t.carriers) put('chain.trace.carrier',q.kind,'id' in q?q.id:q.index);
      for(const p of t.scheduled) put('chain.trace.scheduled',p.x,p.z);
    }

    put('growth.tempo', this.tempo);
    put('growth.power', this.globalPower);
    put('growth.fortune', this.fortune);
    put('growth.axes', ...resonanceOrder.map((id) => this.resonance[id]));

    put('economy.eliteCore', this.eliteCore);
    put('economy.rerolls', this.rerolls);
    put('economy.mutationRefusal', this.mutationRefusalToken);

    put('boss.spawned', this.bossSpawned);
    put('boss.defeated', this.bossDefeated);

    put('loadout.slots', ...this.slots.map((s) => s ?? '-'));
    put('loadout.skillReserve', ...this.skillReserve.map((s) => s ?? '-'));
    put('loadout.catalysts', ...this.catalysts.map((s) => s ?? '-'));
    put('loadout.catalystReserve', ...this.catalystReserve.map((s) => s ?? '-'));

    for (const p of this.pois) put('poi', p.id, p.kind, p.state, p.guardianId, p.x, p.z);

    for (const s of [...this.skillsRuntime.values()].sort((a, b) => a.id.localeCompare(b.id)))
      put(
        'skill',
        s.id,
        s.level,
        s.power,
        s.coverage,
        s.range,
        s.duration,
        s.crit,
        s.eliteDamage,
        s.count,
        s.control,
        s.statusPotency,
        s.mutation,
        s.mutationUpgrade,
        s.mutationApotheosis
      );

    for (const c of [...this.catalystRuntime.values()].sort((a, b) => a.id.localeCompare(b.id)))
      put('catalyst', c.id);

    for (const e of this.ents)
      put(
        'ent',
        e.id,
        e.kind,
        e.x,
        e.z,
        e.hp,
        e.chassis,
        e.affix,
        e.boss,
        e.guardianPoi,
        e.adaptStage,
        e.adaptCooldown,
        e.eliteAction ?? '-',
        e.eliteActionUntil ?? 0,
        e.bossPhase,
        e.bossPattern,
        e.affixTimer,
        e.affixPulse,
        e.markUntil,
        e.igniteUntil,
        e.chillUntil,
        e.woundUntil,
        e.toxinUntil,
        e.displacedUntil,
        e.embedded,
        e.orderUntil,
        (e.relicItems ?? []).join(','),
        (e.evolutionItems ?? []).join(',')
      );

    const m = this.metrics;
    put('metrics.population', m.spawned, m.killed, m.maxEnemies);
    put('metrics.elites', m.eliteSpawned, m.eliteKilled);
    put('metrics.output', m.damage, m.reactions);
    put('metrics.progression', m.levels, m.mutations);
    put('metrics.survival', m.damageTaken, m.healingReceived, m.barrierGenerated, m.healsPicked);
    put('relics', this.relics.length, this.heldItems.length, this.heldItems.join(','));
    put('eliteLegacyItems', this.eliteLegacyItems.join(','));
    put('eliteEvolutionHistory', this.eliteEvolutionHistory.join(','));

    return parts;
  }

  canonicalHash() {
    return fnv1a(this.canonicalState());
  }
}
