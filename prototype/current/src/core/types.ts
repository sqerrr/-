export type SkillId =
  | 'ember_lance'
  | 'frost_ring'
  | 'rail_spear'
  | 'cleaver'
  | 'chain_arc'
  | 'orbit_blades'
  | 'mortar_bloom'
  | 'sentry'
  | 'toxic_mist'
  | 'mass_driver'
  | 'repulse_halo'
  | 'breach_line'
  | 'contact_saw'
  | 'backhand'
  | 'spreading_front'
  | 'shard_fan'
  | 'tether_drag'
  | 'pin_burst';
export type CatalystId =
  | 'capacitor'
  | 'anchor'
  | 'reservoir'
  | 'echo_shard'
  | 'relay'
  | 'conduit'
  | 'overflow'
  | 'aegis_relay'
  | 'backflow'
  | 'recoil'
  | 'focus'
  | 'surge'
  | 'glut'
  | 'stagger'
  | 'splinter'
  | 'brand'
  | 'rime'
  | 'harvest'
  | 'vault'
  | 'handoff';
export type EnemyKind =
  | 'footnote'
  | 'bookmark'
  | 'binder'
  | 'redactor'
  | 'palimpsest'
  | 'indexer'
  | 'inkblot'
  | 'marginwalker'
  | 'elite'
  // The hero participates in combat as a target when a rival owns the cast.
  // It never enters the enemy roster, so spawn tables exclude it explicitly.
  | 'hero';
export type EliteChassis =
  | 'marshal'
  | 'hunter'
  | 'bulwark'
  | 'architect'
  | 'harvester'
  | 'shepherd'
  | 'broodmaker'
  | 'archivist'
  | 'warden';
export type EliteAffix =
  | 'swift'
  | 'dense'
  | 'volatile'
  | 'regenerating'
  | 'shielded'
  | 'vanguard'
  | 'temporal'
  | 'brood'
  | 'crowned'
  | 'none';
export type MutationId = string;
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type RunMode = 'clean' | 'showcase';
export type ResonanceId =
  'tempo' | 'multiplicity' | 'precision' | 'persistence' | 'conductivity' | 'mobility';
export type DoctrineId = 'might' | 'size' | 'quantity' | 'duration' | 'mobility' | 'guard' | 'force' | 'precision';
export type DoctrineRuntime = Record<DoctrineId, number>;
// Internal name kept for snapshot compatibility; in v0.10 this is the global Core Axis layer, not per-weapon Resonance.
export type ResonanceRuntime = Record<ResonanceId, number>;
export type PoiKind = 'phenomenon' | 'catalyst' | 'resonance' | 'vital';
export type PoiState = 'dormant' | 'guarded' | 'cleared';
export type SquadTask = 'none' | 'press' | 'flank' | 'intercept' | 'hold';

export type CombatShape =
  | { kind: 'circle'; x: number; z: number; radius: number }
  | {
      kind: 'sector';
      x: number;
      z: number;
      radius: number;
      aimX: number;
      aimZ: number;
      halfAngle: number;
    }
  | {
      kind: 'ray';
      x: number;
      z: number;
      aimX: number;
      aimZ: number;
      range: number;
      halfWidth: number;
    };

export interface Command {
  moveX: number;
  moveZ: number;
  aimX: number;
  aimZ: number;
  /** D17: request a single directional dash with a brief window of invulnerability. */
  dash?: boolean;
}
export interface SkillRuntime {
  id: SkillId;
  level: number;
  power: number;
  coverage: number;
  range: number;
  duration: number;
  crit: number;
  eliteDamage: number;
  count: number;
  control: number;
  statusPotency: number;
  mutation: MutationId | null;
  /** D28/D36: second-level continuation; the root remains active alongside it. */
  mutationUpgrade: MutationId | null;
  /** v0.11: third, branch-preserving transformation. Never a scalar-only reward. */
  mutationApotheosis: MutationId | null;
}
export interface CatalystRuntime {
  id: CatalystId;
}
export interface StatusSnapshot {
  marked: boolean;
  ignited: boolean;
  chilled: boolean;
  frozen: boolean;
  wounded: boolean;
  exposed: boolean;
  embedded: number;
  toxined: boolean;
}
/**
 * D9: how much of the hero's refusal history an elite is allowed to field. The share of
 * the higher tiers grows towards the end of a run.
 */
export type EliteRarity = 'common' | 'uplifted' | 'legendary';
/**
 * Relics are the shared source of power D14 asked for: they lie on the ground and whoever
 * reaches them first keeps them. The category decides what an elite gains from one, which
 * is how D15 is honoured without copying the hero's version of the effect.
 */
export type ItemCategory = 'guard' | 'edge' | 'pace' | 'finding' | 'elite';
export type ItemId =
  | 'plating'
  | 'vitality'
  | 'aegis_core'
  | 'ablation'
  | 'keen_edge'
  | 'hollow_point'
  | 'siphon'
  | 'bane'
  | 'light_step'
  | 'quickened'
  | 'short_cord'
  | 'afterimage'
  | 'lodestone'
  | 'keen_eye'
  | 'scavenger'
  | 'beacon'
  | 'spoils'
  | 'unravel'
  | 'tribute'
  | 'reprisal';
/** A relic waiting on the ground for whichever side reaches it first. */
export interface RelicSnapshot {
  id: number;
  x: number;
  z: number;
  item: ItemId;
  category: ItemCategory;
  contested: boolean;
}
export interface SnapshotEntity {
  id: number;
  kind: EnemyKind;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  radius: number;
  elite: boolean;
  boss: boolean;
  guardianPoi: number;
  chassis?: EliteChassis;
  affix?: EliteAffix;
  facingX: number;
  facingZ: number;
  telegraph: number;
  linkedTo: number;
  revived: boolean;
  buffed: boolean;
  shieldAngle: number;
  /** v0.11 readable shield state: guard turns, commit is locked, broken is punish window. */
  shieldState: 'guard' | 'commit' | 'broken';
  shieldStability: number;
  /** v0.11 body-language state for authored Elite Echo animations. */
  echoPhase?: 'none' | 'tell' | 'active' | 'recovery';
  echoSkill?: SkillId;
  regenerating: boolean;
  orderX: number;
  orderZ: number;
  orderActive: boolean;
  squadTask: SquadTask;
  adaptationStage: number;
  eliteRarity: EliteRarity;
  /** D13: icons of the declined cards this elite is fielding, drawn above its name. */
  refusalIcons: string[];
  /** Names of the held cards, so the hero can read what was taken from him. */
  refusalTitles: string[];
  /** Kinds of the held cards, for colouring: skill | catalyst | axis | global | item. */
  refusalKinds: string[];
  bossPhase: number;
  bossPattern: string;
  status: StatusSnapshot;
}
export interface PickupSnapshot {
  id: number;
  x: number;
  z: number;
  value: number;
  kind: 'xp' | 'core' | 'heal' | 'mutation';
}
export interface FieldSnapshot {
  id: number;
  x: number;
  z: number;
  radius: number;
  ttl: number;
  kind: 'ink' | 'fire' | 'frost' | 'arc' | 'toxic' | 'index' | 'architect' | 'veil';
}
export interface ConstructSnapshot {
  id: number;
  x: number;
  z: number;
  ttl: number;
  range: number;
  kind: 'sentry';
}
export interface ProjectileSnapshot {
  id: number;
  x: number;
  z: number;
  radius: number;
  faction: 'hero' | 'rival';
  source: SkillId;
  guarded: boolean;
  behavior?: 'normal' | 'roller' | 'returner' | 'echo';
  phase?: number;
}
export interface PoiSnapshot {
  id: number;
  kind: PoiKind;
  x: number;
  z: number;
  state: PoiState;
  guardianId: number;
}
export interface ObstacleSnapshot {
  id: number;
  x: number;
  z: number;
  radius: number;
  hp: number;
  maxHp: number;
  destructible: boolean;
}
export interface WorldSnapshot {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  pois: PoiSnapshot[];
  obstacles: ObstacleSnapshot[];
  bossSpawned: boolean;
  bossDefeated: boolean;
}
export interface ChainSnapshot {
  beat: number;
  cycle: number;
  tempo: number;
  slots: (SkillId | null)[];
  catalysts: (CatalystId | null)[];
  skillReserve: (SkillId | null)[];
  catalystReserve: (CatalystId | null)[];
  catalystRuntime: CatalystRuntime[];
}
export interface Metrics {
  spawned: number;
  killed: number;
  eliteSpawned: number;
  eliteKilled: number;
  damage: number;
  eliteDamage: number;
  activations: number;
  levels: number;
  mutations: number;
  healsPicked: number;
  relicsTakenByHero: number;
  relicsTakenByElites: number;
  damageTaken: number;
  healingReceived: number;
  barrierGenerated: number;
  reactions: number;
  maxEnemies: number;
  enemyCountSum: number;
  enemySamples: number;
  /** D52: how often an elite turned one of the hero's declined phenomena back on them. */
  rivalCasts: number;
  /** D52: dashes taken, and how many of those windows actually turned a blow aside. */
  dashes: number;
  dashIFrameSaves: number;
}
export interface RewardOffer {
  id: string;
  kind:
    | 'skill_add'
    | 'catalyst_add'
    | 'resonance'
    | 'global'
    | 'elite'
    | 'mutation_target'
    | 'item_grant'
    | 'skill_swap'
    | 'doctrine';
  title: string;
  subtitle: string;
  description: string;
  skill?: SkillId;
  catalyst?: CatalystId;
  resonance?: ResonanceId;
  doctrine?: DoctrineId;
  item?: ItemId;
  /** For a swap: the slot whose phenomenon steps aside into the reserve (D27). */
  swapSlot?: number;
  /**
   * The card the elites are waiting for. Leave it and they get it; take it and they get
   * one of the others instead. Without this the cost of a refusal is invisible until it
   * comes back minutes later, which doc 16 lists as a failure of the concept.
   */
  marked?: boolean;
  stat?: string;
  amount?: number;
  rarity?: Rarity;
  before?: string;
  after?: string;
}
/** D7/D8: a card the hero declined that the elites may now field against them. */
export type RefusalKind = 'skill' | 'catalyst' | 'axis' | 'global' | 'item';
export interface RefusedCard {
  /** Order of concession within the run; 1 is the earliest. */
  serial: number;
  kind: RefusalKind;
  title: string;
  icon: string;
  skill?: SkillId;
  catalyst?: CatalystId;
  resonance?: ResonanceId;
  doctrine?: DoctrineId;
  item?: ItemId;
  stat?: string;
  amount?: number;
  /** Entity id of the elite currently fielding the card, or 0 while it sits unclaimed. */
  heldBy: number;
}
/**
 * D52: one row per elite fight, so the target length set by D49 can be measured
 * instead of guessed. Diagnostic only, and deliberately outside the canonical hash.
 */
export interface EliteEncounter {
  id: number;
  chassis: EliteChassis;
  rarity: EliteRarity;
  /** Seconds since the run began. */
  spawnedAt: number;
  /** First moment this elite and the hero traded damage; -1 if they never met. */
  engagedAt: number;
  /**
   * Seconds of active damage exchange with a short cadence grace. This excludes wall-clock
   * time spent disengaged or merely standing near the hero while the crowd owns the fight.
   */
  contactTime: number;
  /** Seconds since the run began, or -1 while the elite is still standing. */
  endedAt: number;
  killed: boolean;
  /** Cards claimed from the refusal store when it spawned. */
  repertoire: number;
  casts: number;
  castSkills: Record<string, number>;
  damageToHero: number;
  damageFromHero: number;
  /** D52: active exchange timestamp used by the fight-time clock. */
  lastExchangeAt: number;
  /** Hero chain-node contribution; key is slot:source (or derived:source). */
  damageFromHeroByNode: Record<string, number>;
  damageToHeroBySource: Record<string, number>;
  /** Damage delivered by refused Phenomena, separated from chassis/contact pressure. */
  refusalDamageToHero: number;
  /** Estimated post-mitigation bonus damage attributable to ground relic cast multipliers. */
  itemAmplifiedDamage: number;
  /** Ground relics physically collected by this elite during the encounter. */
  itemsTaken: ItemId[];
  dashes: number;
  dashIFrameSaves: number;
}
export interface MutationOffer {
  skill: SkillId;
  choices: MutationId[];
  refusalAvailable: boolean;
  tier: 1 | 2 | 3;
}
export interface Snapshot {
  tick: number;
  time: number;
  runDuration: number;
  finished: boolean;
  mode: RunMode;
  player: {
    x: number;
    z: number;
    hp: number;
    maxHp: number;
    barrier: number;
    armor: number;
    level: number;
    xp: number;
    xpNeed: number;
    moveSpeed: number;
    aimX: number;
    aimZ: number;
    power: number;
    pickupRadius: number;
    fortune: number;
    dashing: boolean;
    dashReady: boolean;
    /** 0 while the dash is on cooldown, 1 the moment it is available again. */
    dashCharge: number;
    invulnerable: boolean;
  };
  entities: SnapshotEntity[];
  pickups: PickupSnapshot[];
  relics: RelicSnapshot[];
  heldItems: ItemId[];
  fields: FieldSnapshot[];
  constructs: ConstructSnapshot[];
  projectiles: ProjectileSnapshot[];
  world: WorldSnapshot;
  chain: ChainSnapshot;
  skills: SkillRuntime[];
  resonance: ResonanceRuntime;
  doctrines: DoctrineRuntime;
  metrics: Metrics;
  eliteCore: number;
  mutationCores: number;
  rewardOffers: RewardOffer[] | null;
  refusals: RefusedCard[];
  mutationOffer: MutationOffer | null;
  rerolls: number;
  choiceSerial: number;
}

export type GameEvent =
  | {
      type: 'SkillActivated';
      tick: number;
      slot: number;
      skill: SkillId;
      x: number;
      z: number;
      aimX: number;
      aimZ: number;
    }
  | {
      type: 'CombatShape';
      tick: number;
      source: string;
      intent: 'damage' | 'control' | 'field';
      shape: CombatShape;
    }
  | {
      type: 'CatalystTriggered';
      tick: number;
      catalyst: CatalystId;
      fromSlot: number;
      toSlot: number;
      sourceX: number;
      sourceZ: number;
      targetX: number;
      targetZ: number;
    }
  | {
      type: 'DamageResolved';
      tick: number;
      entity: number;
      amount: number;
      source: SkillId | string;
      x: number;
      z: number;
      sourceX: number;
      sourceZ: number;
      elite: boolean;
      crit: boolean;
    }
  | {
      type: 'EntitySpawned';
      tick: number;
      entity: number;
      kind: EnemyKind;
      x: number;
      z: number;
      chassis?: EliteChassis;
      affix?: EliteAffix;
      boss?: boolean;
      guardianPoi?: number;
    }
  | {
      type: 'EntityDied';
      tick: number;
      entity: number;
      kind: EnemyKind;
      x: number;
      z: number;
      elite: boolean;
      boss?: boolean;
    }
  | { type: 'EliteReacquired'; tick: number; entity: number; x: number; z: number }
  | {
      type: 'PoiAwakened';
      tick: number;
      poi: number;
      kind: PoiKind;
      x: number;
      z: number;
      guardian: number;
    }
  | { type: 'PoiCleared'; tick: number; poi: number; kind: PoiKind; x: number; z: number }
  | {
      type: 'BossSpawned';
      tick: number;
      entity: number;
      x: number;
      z: number;
      supports: number;
      uncleared: number;
    }
  | { type: 'BossPhase'; tick: number; entity: number; phase: number; x: number; z: number }
  | {
      type: 'BossPattern';
      tick: number;
      entity: number;
      pattern: 'sweep' | 'rupture' | 'charge';
      x: number;
      z: number;
    }
  | { type: 'LevelUp'; tick: number; level: number }
  | { type: 'MutationChosen'; tick: number; skill: SkillId; mutation: MutationId }
  | {
      type: 'EliteEchoPhase';
      tick: number;
      entity: number;
      skill: SkillId;
      phase: 'tell' | 'active' | 'recovery';
      x: number;
      z: number;
      aimX: number;
      aimZ: number;
    }
  | { type: 'RareEvent'; tick: number; title: string; detail: string; x?: number; z?: number }
  | { type: 'RewardChosen'; tick: number; title: string }
  | { type: 'RewardRefused'; tick: number; title: string; kind: RefusalKind; serial: number }
  | {
      type: 'RivalCast';
      tick: number;
      entity: number;
      skill: SkillId;
      serial: number;
      x: number;
      z: number;
    }
  | { type: 'PlayerHit'; tick: number; amount: number; x: number; z: number }
  | { type: 'EnemyRevived'; tick: number; entity: number; x: number; z: number }
  | {
      type: 'EliteOrder';
      tick: number;
      entity: number;
      order:
        | 'surge'
        | 'pack'
        | 'screen'
        | 'wall'
        | 'harvest'
        | 'regroup'
        | 'brood'
        | 'archive'
        | 'predator'
        | 'veil'
        | 'replicate'
        | 'prism'
        | 'null'
        | 'metamorph';
      x: number;
      z: number;
      count?: number;
    }
  | {
      type: 'RelicAppeared';
      tick: number;
      item: ItemId;
      name: string;
      x: number;
      z: number;
    }
  | {
      type: 'RelicTaken';
      tick: number;
      item: ItemId;
      name: string;
      description: string;
      byHero: boolean;
      x: number;
      z: number;
    }
  | {
      type: 'PickupConsumed';
      tick: number;
      entity: number;
      kind: 'xp' | 'heal';
      x: number;
      z: number;
    }
  | { type: 'ConstructSpawned'; tick: number; skill: SkillId; x: number; z: number }
  | {
      type: 'Reaction';
      tick: number;
      reaction: 'thermal_shock' | 'detonation' | 'conduit' | 'echo' | 'aegis';
      x: number;
      z: number;
      amount?: number;
    };
