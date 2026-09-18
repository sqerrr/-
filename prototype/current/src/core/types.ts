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
  | 'repulse_halo';
export type CatalystId =
  | 'capacitor'
  | 'anchor'
  | 'reservoir'
  | 'echo_shard'
  | 'relay'
  | 'conduit'
  | 'overflow'
  | 'aegis_relay'
  | 'backflow';
export type EnemyKind =
  | 'footnote'
  | 'bookmark'
  | 'binder'
  | 'redactor'
  | 'palimpsest'
  | 'indexer'
  | 'inkblot'
  | 'marginwalker'
  | 'elite';
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
// Internal name kept for snapshot compatibility; in v0.10 this is the global Core Axis layer, not per-weapon Resonance.
export type ResonanceRuntime = Record<ResonanceId, number>;
export type PoiKind = 'phenomenon' | 'catalyst' | 'resonance' | 'vital';
export type PoiState = 'dormant' | 'guarded' | 'cleared';

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
}
export interface CatalystRuntime {
  id: CatalystId;
}
export interface StatusSnapshot {
  marked: boolean;
  ignited: boolean;
  chilled: boolean;
  wounded: boolean;
  exposed: boolean;
  embedded: number;
  toxined: boolean;
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
  regenerating: boolean;
  orderX: number;
  orderZ: number;
  orderActive: boolean;
  adaptationStage: number;
  bossPhase: number;
  bossPattern: string;
  status: StatusSnapshot;
}
export interface PickupSnapshot {
  id: number;
  x: number;
  z: number;
  value: number;
  kind: 'xp' | 'core' | 'heal';
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
export interface PoiSnapshot {
  id: number;
  kind: PoiKind;
  x: number;
  z: number;
  state: PoiState;
  guardianId: number;
}
export interface WorldSnapshot {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  pois: PoiSnapshot[];
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
  damageTaken: number;
  healingReceived: number;
  barrierGenerated: number;
  reactions: number;
  maxEnemies: number;
  enemyCountSum: number;
  enemySamples: number;
}
export interface RewardOffer {
  id: string;
  kind: 'skill_add' | 'catalyst_add' | 'resonance' | 'global' | 'elite' | 'mutation_target';
  title: string;
  subtitle: string;
  description: string;
  skill?: SkillId;
  catalyst?: CatalystId;
  resonance?: ResonanceId;
  stat?: string;
  amount?: number;
  rarity?: Rarity;
  before?: string;
  after?: string;
}
export interface MutationOffer {
  skill: SkillId;
  choices: MutationId[];
  refusalAvailable: boolean;
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
  };
  entities: SnapshotEntity[];
  pickups: PickupSnapshot[];
  fields: FieldSnapshot[];
  constructs: ConstructSnapshot[];
  world: WorldSnapshot;
  chain: ChainSnapshot;
  skills: SkillRuntime[];
  resonance: ResonanceRuntime;
  metrics: Metrics;
  eliteCore: number;
  mutationCores: number;
  rewardOffers: RewardOffer[] | null;
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
  | { type: 'RewardChosen'; tick: number; title: string }
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
