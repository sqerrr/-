import type {
  BossPatternId,
  CombatShape,
  EliteActionId,
  EliteAffix,
  EliteChassis,
  EliteRarity,
  EnemyKind,
  ItemId,
  MutationId,
  PoiKind,
  PoiState,
  SkillId,
  SquadTask
} from './types.js';

export type EnemyState = 'normal' | 'telegraph' | 'dash';
export type CastFaction = 'hero' | 'rival';

export interface EntityIdentityComponent {
  id: number;
  kind: EnemyKind;
  cloneParent?: number;
}

export interface BodyComponent {
  x: number;
  z: number;
  radius: number;
  speed: number;
  facingX: number;
  facingZ: number;
  state: EnemyState;
  stateTimer: number;
  lockedX: number;
  lockedZ: number;
}

export interface VitalComponent {
  hp: number;
  maxHp: number;
  contactDps: number;
  cooldown: number;
  revivesLeft: number;
  revived: boolean;
  buffUntil: number;
  orbitHitAt: number;
  lastDamageAt: number;
}

export interface RelationComponent {
  linkedTo: number;
  linkTimer: number;
  orderX: number;
  orderZ: number;
  orderUntil: number;
  squadTask?: SquadTask;
  squadUntil?: number;
  guardianPoi: number;
}

export interface EliteRuntimeComponent {
  chassis?: EliteChassis;
  affix: EliteAffix;
  eliteAction?: EliteActionId;
  eliteActionUntil?: number;
  adaptAt: number;
  shieldAngle: number;
  shieldState?: 'guard' | 'commit' | 'broken';
  shieldStability?: number;
  shieldCommitUntil?: number;
  boss: boolean;
  adaptCooldown: number;
  adaptStage: number;
  bossPhase: number;
  bossPattern: BossPatternId | '';
  prismMemory?: SkillId | 'derived';
  shepherdMode?: 'null' | 'condensed' | 'fractured' | 'migratory';
  regenTick: number;
  affixTimer: number;
  affixPulse: number;
  rarity: EliteRarity;
  repertoire: number[];
}

export interface StatusComponent {
  markUntil: number;
  igniteUntil: number;
  chillUntil: number;
  frostMeter?: number;
  frozenUntil?: number;
  woundStacks?: number;
  woundUntil: number;
  woundDps: number;
  toxinUntil: number;
  toxinDps: number;
  exposedUntil: number;
  displacedUntil: number;
  embedded: number;
  lastArcAt: number;
  sentryTouchedUntil: number;
}

export interface EliteProgressionComponent {
  relicCastMul?: number;
  groundRelicCastMul?: number;
  relicGapMul?: number;
  relicReachMul?: number;
  relicItems?: ItemId[];
  evolutionItems?: ItemId[];
  relicDamageTakenMul?: number;
  relicCritChance?: number;
  relicSiphon?: number;
  relicSeekMul?: number;
}

export type Ent =
  & EntityIdentityComponent
  & BodyComponent
  & VitalComponent
  & RelationComponent
  & EliteRuntimeComponent
  & StatusComponent
  & EliteProgressionComponent;

export type EntInit =
  & Pick<Ent, 'id' | 'kind' | 'x' | 'z' | 'hp' | 'radius' | 'speed' | 'contactDps'>
  & Partial<Omit<Ent, 'id' | 'kind' | 'x' | 'z' | 'hp' | 'radius' | 'speed' | 'contactDps'>>;

export const HERO_HIT_RADIUS = 0.45;

/**
 * Single runtime factory for combat entities. The runtime remains flat for cache-friendly
 * iteration, while the type is decomposed by domain so systems can depend on narrower views.
 */
export function makeEnt(init: EntInit): Ent {
  const { id, kind, x, z, hp, radius, speed, contactDps, ...overrides } = init;
  return {
    id,
    kind,
    x,
    z,
    hp,
    maxHp: overrides.maxHp ?? hp,
    radius,
    speed,
    contactDps,
    facingX: 0,
    facingZ: 1,
    state: 'normal',
    stateTimer: 0,
    cooldown: 0,
    lockedX: 0,
    lockedZ: 0,
    linkedTo: 0,
    linkTimer: 0,
    revivesLeft: 0,
    revived: false,
    buffUntil: 0,
    orbitHitAt: -99,
    affix: 'none',
    adaptAt: -1,
    lastDamageAt: -99,
    shieldAngle: 0,
    boss: false,
    guardianPoi: 0,
    adaptCooldown: 0,
    adaptStage: 0,
    bossPhase: 0,
    bossPattern: '',
    orderX: 0,
    orderZ: 0,
    orderUntil: 0,
    regenTick: 0,
    affixTimer: 0,
    affixPulse: 0,
    markUntil: 0,
    igniteUntil: 0,
    chillUntil: 0,
    woundUntil: 0,
    woundDps: 0,
    toxinUntil: 0,
    toxinDps: 0,
    exposedUntil: 0,
    displacedUntil: 0,
    embedded: 0,
    lastArcAt: -99,
    sentryTouchedUntil: -99,
    rarity: 'common',
    repertoire: [],
    ...overrides
  };
}

export function makeHeroEnt(): Ent {
  return makeEnt({
    id: -1,
    kind: 'hero',
    x: 0,
    z: 0,
    hp: 1,
    radius: HERO_HIT_RADIUS,
    speed: 0,
    contactDps: 0,
    adaptAt: 0,
    lastDamageAt: 0,
    orbitHitAt: 0,
    lastArcAt: 0,
    sentryTouchedUntil: 0
  });
}

export type Pickup = {
  id: number;
  x: number;
  z: number;
  value: number;
  kind: 'xp' | 'core' | 'heal' | 'mutation';
};

export type Relic = { id: number; x: number; z: number; item: ItemId; bornAt: number };

export type Field = {
  id: number;
  activationId?: number;
  insideIds?: number[];
  x: number;
  z: number;
  radius: number;
  ttl: number;
  kind: 'ink' | 'fire' | 'frost' | 'arc' | 'toxic' | 'index' | 'architect' | 'veil';
  dps: number;
  tickAcc: number;
  faction?: CastFaction;
  ownerId?: number;
  source?: string;
  sourceSlot?: number;
  mutation?: MutationId | null;
  rivalConcentration?: number;
  behavior?: 'host' | 'pull';
};

export type Construct = {
  id: number;
  activationId?: number;
  x: number;
  z: number;
  ttl: number;
  cooldown: number;
  range: number;
  power: number;
  skill: SkillId;
  faction: CastFaction;
  ownerId: number;
  sourceSlot: number;
  mutation: MutationId | null;
  mutationUpgrade: MutationId | null;
  mutationApotheosis?: MutationId | null;
  rivalConcentration: number;
};

export type Projectile = {
  id: number;
  activationId?: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  ttl: number;
  damage: number;
  coverDamage: number;
  faction: CastFaction;
  ownerId: number;
  source: SkillId;
  sourceSlot: number;
  mutation: MutationId | null;
  apotheosis?: MutationId | null;
  rivalConcentration: number;
  guarded: boolean;
  behavior?: 'normal' | 'roller' | 'returner' | 'echo';
  returnAt?: number;
  phase?: number;
  hitIds?: number[];
  growth?: number;
  carousel?: boolean;
  phaseAt?: number;
  orbitX?: number;
  orbitZ?: number;
  trailAcc?: number;
};

export type DelayedStrike = {
  id: number;
  activationId?: number;
  at: number;
  x: number;
  z: number;
  radius: number;
  damage: number;
  faction: CastFaction;
  ownerId: number;
  source: SkillId | string;
  sourceSlot: number;
  intent: 'damage' | 'control' | 'field';
  telegraph: string;
  fieldKind?: 'frost' | 'arc' | 'toxic' | 'fire';
  fieldDuration?: number;
  fieldDps?: number;
  fieldBehavior?: 'pull';
};

export type EliteEchoState = {
  entityId: number;
  skill: SkillId;
  serial: number;
  phase: 'tell' | 'active' | 'recovery';
  until: number;
  x: number;
  z: number;
  aimX: number;
  aimZ: number;
  targetX: number;
  targetZ: number;
};

export type Obstacle = {
  id: number;
  x: number;
  z: number;
  radius: number;
  hp: number;
  maxHp: number;
  destructible: boolean;
};

export type Poi = {
  id: number;
  kind: PoiKind;
  x: number;
  z: number;
  state: PoiState;
  guardianId: number;
};

export type CastSource = {
  faction: CastFaction;
  owner: Ent | null;
  x: number;
  z: number;
  aimX: number;
  aimZ: number;
  vx: number;
  vz: number;
};

export type ChoreographyPoint = { x: number; z: number };
export type ChoreographyCarrier =
  | { kind: 'projectile'; id: number }
  | { kind: 'construct'; id: number }
  | { kind: 'orbit'; index: number };

export type ChoreographyTrace = {
  skill: SkillId;
  origin: ChoreographyPoint;
  aimX: number;
  aimZ: number;
  terminal: ChoreographyPoint | null;
  points: ChoreographyPoint[];
  areaPoints: ChoreographyPoint[];
  areas: CombatShape[];
  contacts: ChoreographyPoint[];
  paths: ChoreographyPoint[][];
  carriers: ChoreographyCarrier[];
  scheduled: ChoreographyPoint[];
};

export type PhysicalEventKind = 'path' | 'area' | 'contact' | 'impact' | 'terminal';

export type PhysicalEvent = {
  activationId: number;
  slot: number;
  skill: SkillId;
  kind: PhysicalEventKind;
  x: number;
  z: number;
  previousX?: number;
  previousZ?: number;
  radius?: number;
  areaPoints?: ChoreographyPoint[];
  shape?: CombatShape;
  carrierKind?: 'projectile' | 'construct' | 'orbit' | 'impact';
  carrierId?: number;
  targetId?: number;
};

export type CatalystBinding = {
  producerActivationId: number;
  fromSlot: number;
  toSlot: number;
  fromSkill: SkillId;
  toSkill: SkillId;
  mode: 'source' | 'carrier' | 'trail' | 'reverse' | 'collapse';
  origin: ChoreographyPoint;
  path: ChoreographyPoint[];
  areaPoints: ChoreographyPoint[];
  nextTrailDistance: number;
  firedCount: number;
  carrierKeys: Set<string>;
  pathCarrierKey: string | null;
  done: boolean;
};
