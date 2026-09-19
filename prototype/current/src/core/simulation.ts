import {
  catalystOrder,
  catalysts,
  initialCatalystReserve,
  initialCatalysts,
  initialSkillReserve,
  initialSlots,
  rarityMultiplier,
  rarityOrder,
  resonance,
  resonanceOrder,
  skillOrder,
  skills,
  statBase
} from '../content/definitions.js';
import { fnv1a } from './hash.js';
import { Rng } from './rng.js';
import type {
  CatalystId,
  CatalystRuntime,
  CombatShape,
  Command,
  EliteAffix,
  EliteChassis,
  EnemyKind,
  FieldSnapshot,
  GameEvent,
  Metrics,
  MutationId,
  MutationOffer,
  PoiKind,
  PoiState,
  Rarity,
  ResonanceId,
  ResonanceRuntime,
  RewardOffer,
  RunMode,
  SkillId,
  SkillRuntime,
  Snapshot
} from './types.js';

type EnemyState = 'normal' | 'telegraph' | 'dash';
type Ent = {
  id: number;
  kind: EnemyKind;
  cloneParent?: number;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  contactDps: number;
  facingX: number;
  facingZ: number;
  state: EnemyState;
  stateTimer: number;
  cooldown: number;
  lockedX: number;
  lockedZ: number;
  linkedTo: number;
  linkTimer: number;
  revivesLeft: number;
  revived: boolean;
  buffUntil: number;
  orbitHitAt: number;
  chassis?: EliteChassis;
  affix: EliteAffix;
  adaptAt: number;
  lastDamageAt: number;
  shieldAngle: number;
  boss: boolean;
  guardianPoi: number;
  adaptCooldown: number;
  adaptStage: number;
  bossPhase: number;
  bossPattern: string;
  orderX: number;
  orderZ: number;
  orderUntil: number;
  regenTick: number;
  affixTimer: number;
  affixPulse: number;
  markUntil: number;
  igniteUntil: number;
  chillUntil: number;
  woundUntil: number;
  woundDps: number;
  toxinUntil: number;
  toxinDps: number;
  exposedUntil: number;
  displacedUntil: number;
  embedded: number;
  lastArcAt: number;
  sentryTouchedUntil: number;
};
type Pickup = { id: number; x: number; z: number; value: number; kind: 'xp' | 'core' | 'heal' };
type Field = {
  id: number;
  x: number;
  z: number;
  radius: number;
  ttl: number;
  kind: 'ink' | 'fire' | 'frost' | 'arc' | 'toxic' | 'index' | 'architect' | 'veil';
  dps: number;
  tickAcc: number;
};
type Construct = {
  id: number;
  x: number;
  z: number;
  ttl: number;
  cooldown: number;
  range: number;
  power: number;
  skill: SkillId;
};
type Poi = { id: number; kind: PoiKind; x: number; z: number; state: PoiState; guardianId: number };

/**
 * Who is producing an effect, and from where.
 *
 * Every cast reads its origin, facing and velocity from this record instead of
 * reaching for player state directly. `owner` is null for the hero and points at
 * the entity for any rival caster, which is what lets an elite run a phenomenon
 * the player refused.
 */
type CastFaction = 'hero' | 'rival';
type CastSource = {
  faction: CastFaction;
  owner: Ent | null;
  x: number;
  z: number;
  aimX: number;
  aimZ: number;
  vx: number;
  vz: number;
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

const enemyCost: Record<Exclude<EnemyKind, 'elite'>, number> = {
  palimpsest: 3.5,
  bookmark: 2.5,
  footnote: 2,
  binder: 4,
  redactor: 4,
  indexer: 4,
  inkblot: 2.5,
  marginwalker: 3
};
const baseHp: Record<Exclude<EnemyKind, 'elite'>, number> = {
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
const eliteAffixThreat: Record<EliteAffix, number> = {
  none: 0,
  swift: 1,
  dense: 1,
  volatile: 1,
  regenerating: 2,
  shielded: 2,
  vanguard: 4,
  temporal: 4,
  brood: 4,
  crowned: 8
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
    damageTaken: 0,
    healingReceived: 0,
    barrierGenerated: 0,
    reactions: 0,
    maxEnemies: 0,
    enemyCountSum: 0,
    enemySamples: 0
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
  private rng: Rng;
  private nextId = 1;
  private ents: Ent[] = [];
  private pickups: Pickup[] = [];
  private fields: Field[] = [];
  private constructs: Construct[] = [];
  private readonly world = { minX: -48, maxX: 48, minZ: -36, maxZ: 36 };
  private pois: Poi[] = [];
  private bossSpawned = false;
  private bossDefeated = false;
  private recycleAcc = 0;
  private skillsRuntime = new Map<SkillId, SkillRuntime>();
  private catalystRuntime = new Map<CatalystId, CatalystRuntime>();
  private beatAcc = 0;
  private spawnCredits = 0;
  private eliteAcc = 0;
  private firstElite = false;
  private orbitAcc = 0;
  private moveAmount = 0;
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
  private lastContext: {
    skill: SkillId | null;
    damage: number;
    kills: number;
    overkill: number;
    control: number;
    state: string;
    hitIds: number[];
    x: number;
    z: number;
  } = {
    skill: null,
    damage: 0,
    kills: 0,
    overkill: 0,
    control: 0,
    state: '',
    hitIds: [],
    x: 0,
    z: 0
  };
  private damageBySource = new Map<string, number>();
  private rewardOffers: RewardOffer[] | null = null;
  private mutationOffer: MutationOffer | null = null;
  private mutationRefusalToken = true;
  private choiceSerial = 0;
  private pendingMutationTarget = false;
  private activationCountBonus = 0;
  private activationDerived = false;
  private reservoirCharge = 0;
  private topologyGuard = false;
  private feedbackCountBonus = new Map<number, number>();
  private damageSamples: { t: number; source: string; amount: number; derived: boolean }[] = [];

  constructor(cfg: SimConfig) {
    this.hz = cfg.hz;
    this.dt = 1 / cfg.hz;
    this.rng = new Rng(cfg.seed);
    this.runDuration = cfg.runDuration ?? 480;
    this.benchmark = !!cfg.benchmark;
    this.mode = cfg.mode ?? 'clean';
    if (this.mode === 'clean') {
      const start = skillOrder.includes(cfg.startingSkill as SkillId)
        ? (cfg.startingSkill as SkillId)
        : 'ember_lance';
      this.slots = [start, null, null, null];
      this.catalysts = [null, null, null];
      this.skillReserve = [null, null, null];
      this.catalystReserve = [null, null, null, null];
      this.tempo = 0;
      this.globalPower = 0;
      this.fortune = 0;
    }
    for (const id of [...this.slots, ...this.skillReserve])
      if (id && !this.skillsRuntime.has(id)) this.skillsRuntime.set(id, this.newSkill(id));
    for (const id of [...this.catalysts, ...this.catalystReserve])
      if (id && !this.catalystRuntime.has(id)) this.catalystRuntime.set(id, { id });
    this.initPois();
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
      mutation: null
    };
  }
  get time() {
    return this.tick / this.hz;
  }
  get hasChoice() {
    return !!this.rewardOffers || !!this.mutationOffer;
  }

  private initPois() {
    this.pois = [
      { id: 1, kind: 'phenomenon', x: 14, z: -7, state: 'dormant', guardianId: 0 },
      { id: 2, kind: 'catalyst', x: -19, z: 9, state: 'dormant', guardianId: 0 },
      { id: 3, kind: 'resonance', x: -34, z: -23, state: 'dormant', guardianId: 0 },
      { id: 4, kind: 'vital', x: 2, z: 29, state: 'dormant', guardianId: 0 },
      { id: 5, kind: 'phenomenon', x: 34, z: 21, state: 'dormant', guardianId: 0 },
      { id: 6, kind: 'catalyst', x: 35, z: -23, state: 'dormant', guardianId: 0 }
    ];
  }
  private clampWorld() {
    this.px = Math.max(this.world.minX + 0.7, Math.min(this.world.maxX - 0.7, this.px));
    this.pz = Math.max(this.world.minZ + 0.7, Math.min(this.world.maxZ - 0.7, this.pz));
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
        z < this.world.maxZ - 1
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
      if (this.allOwnedSkills().length < 4 && this.skillOrderUnowned().length)
        this.generateDiscovery();
      else this.generateLevelOffers();
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
      pool = catalystOrder.filter((id) => !owned.includes(id));
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
    if (this.bossSpawned || this.time < this.runDuration * 0.875) return;
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
      e: Ent = {
        id: this.nextId++,
        kind: 'elite',
        x,
        z,
        hp,
        maxHp: hp,
        radius: chassis === 'bulwark' ? 1.02 : 0.9,
        speed: eliteSpeed[chassis],
        contactDps: eliteDps[chassis] * this.damageScale(),
        facingX: 0,
        facingZ: 1,
        state: 'normal',
        stateTimer: 0,
        cooldown: this.rng.range(1.3, 2.5),
        lockedX: 0,
        lockedZ: 0,
        linkedTo: 0,
        linkTimer: 0,
        revivesLeft: 0,
        revived: false,
        buffUntil: 0,
        orbitHitAt: -99,
        chassis,
        affix,
        adaptAt: hp * 0.55,
        lastDamageAt: -99,
        shieldAngle: 0,
        boss: false,
        guardianPoi: -1,
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
        sentryTouchedUntil: -99
      };
    this.ents.push(e);
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
      hp = eliteHp.warden * this.worldScale();
    const e: Ent = {
      id: this.nextId++,
      kind: 'elite',
      x,
      z,
      hp,
      maxHp: hp,
      radius: 1.42,
      speed: eliteSpeed.warden,
      contactDps: eliteDps.warden * this.damageScale(),
      facingX: 0,
      facingZ: 1,
      state: 'normal',
      stateTimer: 0,
      cooldown: 1.8,
      lockedX: 0,
      lockedZ: 0,
      linkedTo: 0,
      linkTimer: 0,
      revivesLeft: 0,
      revived: false,
      buffUntil: 0,
      orbitHitAt: -99,
      chassis: 'warden',
      affix: 'none',
      adaptAt: -1,
      lastDamageAt: -99,
      shieldAngle: 0,
      boss: true,
      guardianPoi: 0,
      adaptCooldown: 0,
      adaptStage: 0,
      bossPhase: 1,
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
      sentryTouchedUntil: -99
    };
    this.ents.push(e);
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
    const activePoiGuardians = this.ents.filter(
      (o) => o.kind === 'elite' && !o.boss && o.guardianPoi > 0 && o.hp > 0
    ).length;
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
    if (mag > 0.001) {
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
    this.updateEnemyAI();
    this.updateFields();
    this.updateConstructs();
    this.updateDots();
    this.updatePickups();
    this.updateOrbitBlades();
    this.chainTick();
    this.cleanup();
    if (!this.benchmark) this.checkProgression();
    const aliveNow = this.ents.filter((e) => e.hp > 0).length;
    this.metrics.maxEnemies = Math.max(this.metrics.maxEnemies, aliveNow);
    this.metrics.enemyCountSum += aliveNow;
    this.metrics.enemySamples++;
    if (this.bossDefeated) this.finished = true;
  }

  private designMinutes() {
    return this.time / (this.runDuration / 24);
  }
  private worldScale() {
    const m = this.designMinutes();
    return 1 + 0.055 * m + 0.0053 * m * m;
  }
  private damageScale() {
    const m = this.designMinutes();
    return 1 + 0.018 * m + 0.00065 * m * m;
  }
  private spawnPressure() {
    const m = this.designMinutes();
    return 1 + 0.055 * m + 0.0023 * m * m;
  }

  private populationTarget(t = this.time) {
    if (this.bossSpawned && !this.bossDefeated)
      return 118 + (this.ents.some((e) => e.boss && e.bossPhase >= 2) ? 28 : 0);
    let target: number;
    if (t < 75) target = 28 + (58 - 28) * (t / 75);
    else if (t < 210) target = 58 + (98 - 58) * ((t - 75) / 135);
    else if (t < 350) target = 98 + (154 - 98) * ((t - 210) / 140);
    else target = 154 + (218 - 154) * Math.min(1, (t - 350) / 80);
    const pulse = Math.max(0, Math.sin(((t - 28) * Math.PI) / 38));
    target += t < 28 ? 0 : pulse * pulse * (t < 220 ? 14 : 26);
    return Math.min(238, target);
  }
  private spawnDirector() {
    const target = this.populationTarget();
    // v0.9A: Clean Run gets a calmer opening so the first Phenomenon can be read before density ramps.
    const normals = this.ents.filter((e) => e.kind !== 'elite' && e.hp > 0).length;
    this.spawnCredits += this.dt * (8.0 * this.spawnPressure());
    if (normals > target) this.spawnCredits *= 0.92;
    let guard = 0;
    while (this.spawnCredits >= 1 && normals + guard < target && guard < 14) {
      const kind = this.pickEnemyKind(),
        cost = enemyCost[kind];
      if (this.spawnCredits < cost) break;
      this.spawnCredits -= cost;
      this.spawnEnemy(kind);
      guard++;
    }
  }
  private pickEnemyKind(): Exclude<EnemyKind, 'elite'> {
    const t = this.time / this.runDuration,
      r = this.rng.float();
    if (t < 0.12) return r < 0.48 ? 'palimpsest' : r < 0.86 ? 'bookmark' : 'footnote';
    if (t < 0.28)
      return r < 0.3
        ? 'palimpsest'
        : r < 0.52
          ? 'bookmark'
          : r < 0.62
            ? 'footnote'
            : r < 0.77
              ? 'binder'
              : r < 0.89
                ? 'inkblot'
                : 'marginwalker';
    if (t < 0.55)
      return r < 0.19
        ? 'palimpsest'
        : r < 0.34
          ? 'bookmark'
          : r < 0.48
            ? 'footnote'
            : r < 0.61
              ? 'binder'
              : r < 0.72
                ? 'inkblot'
                : r < 0.82
                  ? 'marginwalker'
                  : r < 0.91
                    ? 'redactor'
                    : 'indexer';
    return r < 0.13
      ? 'palimpsest'
      : r < 0.27
        ? 'bookmark'
        : r < 0.39
          ? 'footnote'
          : r < 0.52
            ? 'binder'
            : r < 0.64
              ? 'inkblot'
              : r < 0.75
                ? 'marginwalker'
                : r < 0.87
                  ? 'redactor'
                  : 'indexer';
  }
  private spawnEnemy(kind: Exclude<EnemyKind, 'elite'>) {
    const q = this.pointAroundPlayer(13.5, 19.5);
    this.spawnEnemyAt(kind, q.x, q.z);
  }
  private spawnEnemyAt(
    kind: Exclude<EnemyKind, 'elite'>,
    x: number,
    z: number,
    buffedFor = 0,
    cloneParent = 0
  ) {
    const normalCount = this.ents.filter((e) => e.kind !== 'elite' && e.hp > 0).length;
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
    const e: Ent = {
      id: this.nextId++,
      kind,
      cloneParent: cloneParent || undefined,
      x,
      z,
      hp,
      maxHp: hp,
      radius: kind === 'binder' || kind === 'redactor' || kind === 'indexer' ? 0.58 : 0.46,
      speed,
      contactDps: dps,
      facingX: 0,
      facingZ: 1,
      state: 'normal',
      stateTimer: 0,
      cooldown: this.rng.range(0.3, 1.9),
      lockedX: 0,
      lockedZ: 0,
      linkedTo: 0,
      linkTimer: 0,
      revivesLeft: kind === 'palimpsest' ? 1 : 0,
      revived: false,
      buffUntil: buffedFor > 0 ? this.time + buffedFor : 0,
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
      sentryTouchedUntil: -99
    };
    this.ents.push(e);
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
    if (this.bossSpawned) return;
    this.eliteAcc += this.dt;
    const active = this.ents.filter((e) => e.kind === 'elite' && e.hp > 0 && !e.boss).length;
    const cap = this.time < 180 ? 2 : 3;
    if (!this.firstElite && this.time >= 22) {
      this.firstElite = true;
      this.eliteAcc = 0;
      this.spawnElite();
      return;
    }
    const interval = this.time < 160 ? 20 : this.time < 320 ? 16 : 12;
    if (this.firstElite && active < cap && this.eliteAcc >= interval) {
      this.eliteAcc -= interval;
      this.spawnElite();
    }
  }
  private spawnElite() {
    const pool: EliteChassis[] = [
      'hunter',
      'architect',
      'broodmaker',
      'bulwark',
      'harvester',
      'shepherd'
    ];
    const chassis = pool[this.rng.int(pool.length)],
      affix: EliteAffix = 'none';
    const q = this.pointAroundPlayer(15, 18.5),
      scale = this.worldScale();
    let hp = eliteHp[chassis] * scale,
      speed = eliteSpeed[chassis];
    if (
      this.mode === 'clean' &&
      this.metrics.eliteSpawned === 0 &&
      this.allOwnedCatalysts().length === 0
    )
      hp *= 0.76;
    const e: Ent = {
      id: this.nextId++,
      kind: 'elite',
      x: q.x,
      z: q.z,
      hp,
      maxHp: hp,
      radius: chassis === 'bulwark' ? 1.02 : chassis === 'broodmaker' ? 0.94 : 0.86,
      speed,
      contactDps: eliteDps[chassis] * this.damageScale() * 0.62,
      facingX: 0,
      facingZ: 1,
      state: 'normal',
      stateTimer: 0,
      cooldown: this.rng.range(2.2, 4.2),
      lockedX: 0,
      lockedZ: 0,
      linkedTo: 0,
      linkTimer: 0,
      revivesLeft: 0,
      revived: false,
      buffUntil: 0,
      orbitHitAt: -99,
      chassis,
      affix,
      adaptAt: hp * 0.6,
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
      sentryTouchedUntil: -99
    };
    this.ents.push(e);
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
    const dx = tx - e.x,
      dz = tz - e.z,
      d = Math.hypot(dx, dz) || 1;
    e.x += (dx / d) * speed * mul * this.dt;
    e.z += (dz / d) * speed * mul * this.dt;
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
      if (e.kind === 'elite' && e.affix === 'crowned') e.cooldown -= dt * 0.24;
      if (e.kind === 'elite' && e.affix === 'brood' && e.affixPulse <= 0) {
        e.affixPulse = 7.2;
        for (let i = 0; i < 3; i++) {
          const a = this.rng.range(0, Math.PI * 2),
            r = this.rng.range(1.0, 2.1);
          this.spawnEnemyAt(
            i === 0 ? 'bookmark' : 'palimpsest',
            e.x + Math.cos(a) * r,
            e.z + Math.sin(a) * r,
            1.7
          );
        }
        this.events.push({
          type: 'EliteOrder',
          tick: this.tick,
          entity: e.id,
          order: 'brood',
          x: e.x,
          z: e.z,
          count: 3
        });
      }
      let dx = this.px - e.x,
        dz = this.pz - e.z,
        d = Math.hypot(dx, dz) || 1,
        nx = dx / d,
        nz = dz / d;
      e.facingX = nx;
      e.facingZ = nz;
      // Affixes are behavioral questions, not hidden +speed/+defense packages.
      if (e.kind === 'elite' && e.affix === 'vanguard' && e.affixPulse <= 0) {
        e.affixPulse = 5.8;
        const lead = 0.65,
          tx = this.px + this.playerVX * lead,
          tz = this.pz + this.playerVZ * lead;
        let count = 0;
        for (const o of this.ents) {
          if (o.kind === 'elite' || o.hp <= 0 || Math.hypot(o.x - e.x, o.z - e.z) > 8.2) continue;
          o.orderX = tx;
          o.orderZ = tz;
          o.orderUntil = this.time + 2.35;
          o.buffUntil = this.time + 2.35;
          count++;
          if (count >= 7) break;
        }
        if (count)
          this.events.push({
            type: 'EliteOrder',
            tick: this.tick,
            entity: e.id,
            order: 'surge',
            x: e.x,
            z: e.z,
            count
          });
      }
      if (e.kind === 'elite' && e.affix === 'temporal') {
        if (e.state === 'telegraph') {
          if (e.stateTimer <= 0) {
            e.x = Math.max(this.world.minX + 1, Math.min(this.world.maxX - 1, e.lockedX));
            e.z = Math.max(this.world.minZ + 1, Math.min(this.world.maxZ - 1, e.lockedZ));
            if (Math.hypot(this.px - e.x, this.pz - e.z) < 1.8)
              this.hitPlayer(14 * this.damageScale());
            e.exposedUntil = this.time + 1.15;
            e.state = 'normal';
            e.affixPulse = 4.9;
          } else continue;
        } else if (e.affixPulse <= 0) {
          e.lockedX = Math.max(
            this.world.minX + 1,
            Math.min(this.world.maxX - 1, this.px + this.playerVX * 0.46)
          );
          e.lockedZ = Math.max(
            this.world.minZ + 1,
            Math.min(this.world.maxZ - 1, this.pz + this.playerVZ * 0.46)
          );
          e.state = 'telegraph';
          e.stateTimer = 0.76;
          e.affixPulse = 99;
          this.events.push({
            type: 'CombatShape',
            tick: this.tick,
            source: 'telegraph_temporal_shift',
            intent: 'control',
            shape: { kind: 'circle', x: e.lockedX, z: e.lockedZ, radius: 1.8 }
          });
          continue;
        }
      }
      let speed =
        e.speed *
        (e.chillUntil > this.time ? (e.kind === 'elite' ? 0.88 : 0.72) : 1) *
        (e.buffUntil > this.time ? 1.32 : 1);
      if (e.affix === 'regenerating' && this.time - e.lastDamageAt > 3) {
        e.regenTick += dt;
        if (e.regenTick >= 0.5) {
          e.regenTick -= 0.5;
          e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.016);
        }
      } else e.regenTick = 0;
      if (e.kind === 'elite' && e.affix === 'shielded') {
        const target = Math.atan2(this.pz - e.z, this.px - e.x);
        let diff = this.angleDiff(target, e.shieldAngle);
        e.shieldAngle += Math.max(-0.82 * dt, Math.min(0.82 * dt, diff));
      }
      if (e.kind !== 'elite' && e.orderUntil > this.time) {
        this.steerTo(e, e.orderX, e.orderZ, speed, 1.15);
        dx = this.px - e.x;
        dz = this.pz - e.z;
        d = Math.hypot(dx, dz) || 1;
      } else if (e.kind === 'footnote') {
        // Baseline swarm pressure: no projectile, just a readable body entering the player's space.
        if (d > 0.58) {
          e.x += nx * speed * dt;
          e.z += nz * speed * dt;
        }
      } else if (e.kind === 'bookmark') {
        if (e.state === 'telegraph') {
          if (e.stateTimer <= 0) {
            e.state = 'dash';
            e.stateTimer = 0.58;
          }
        } else if (e.state === 'dash') {
          e.x += e.lockedX * 7.5 * dt;
          e.z += e.lockedZ * 7.5 * dt;
          if (e.stateTimer <= 0) {
            e.state = 'normal';
            e.cooldown = 2.9;
          }
        } else if (e.cooldown <= 0 && d > 3 && d < 12) {
          e.state = 'telegraph';
          e.stateTimer = 0.72;
          e.lockedX = nx;
          e.lockedZ = nz;
          e.cooldown = 99;
        } else if (d > 0.8) {
          e.x += nx * speed * dt;
          e.z += nz * speed * dt;
        }
      } else if (e.kind === 'binder') {
        if (e.linkTimer <= 0) {
          e.linkTimer = 1.0;
          let best: Ent | undefined,
            bestD = 999;
          for (const o of this.ents) {
            if (o === e || o.kind === 'binder' || o.hp <= 0) continue;
            const od = Math.hypot(o.x - e.x, o.z - e.z);
            if (od < 5.2 && od < bestD) {
              bestD = od;
              best = o;
            }
          }
          e.linkedTo = best?.id ?? 0;
        }
        const target = this.ents.find((o) => o.id === e.linkedTo && o.hp > 0);
        if (target) {
          const td = Math.hypot(target.x - e.x, target.z - e.z) || 1;
          if (td > 3) this.steerTo(e, target.x, target.z, speed);
        } else if (d > 5) this.steerTo(e, this.px, this.pz, speed);
      } else if (e.kind === 'redactor') {
        let best: Field | undefined,
          bestD = 999;
        for (const f of this.fields) {
          if (f.kind === 'ink' || f.kind === 'index' || f.kind === 'architect') continue;
          const fd = Math.hypot(f.x - e.x, f.z - e.z);
          if (fd < bestD) {
            bestD = fd;
            best = f;
          }
        }
        if (best && bestD < 8) {
          if (bestD > 1.4) this.steerTo(e, best.x, best.z, speed);
          if (e.cooldown <= 0 && bestD < 2.5) {
            best.ttl = Math.min(best.ttl, 0.25);
            e.cooldown = 2.8;
          }
        } else if (d > 4) this.steerTo(e, this.px, this.pz, speed);
      } else if (e.kind === 'indexer') {
        if (d > 7.5) this.steerTo(e, this.px, this.pz, speed);
        else if (d < 5.2) {
          e.x -= nx * speed * 0.55 * dt;
          e.z -= nz * speed * 0.55 * dt;
        }
        if (e.cooldown <= 0) {
          e.cooldown = 4.2;
          const pm = Math.hypot(this.playerVX, this.playerVZ),
            vx = pm > 0.1 ? this.playerVX / pm : nx,
            vz = pm > 0.1 ? this.playerVZ / pm : nz;
          e.lockedX = this.px + vx * 3.2;
          e.lockedZ = this.pz + vz * 3.2;
          this.fields.push({
            id: this.nextId++,
            x: e.lockedX,
            z: e.lockedZ,
            radius: 1.25,
            ttl: 2.8,
            kind: 'index',
            dps: 0,
            tickAcc: 0
          });
          for (const o of this.ents) {
            if (o === e || o.kind === 'elite' || o.hp <= 0) continue;
            if (Math.hypot(o.x - e.x, o.z - e.z) < 7) {
              o.orderX = e.lockedX;
              o.orderZ = e.lockedZ;
              o.orderUntil = this.time + 2.8;
            }
          }
        }
      } else if (e.kind === 'inkblot') {
        if (d > 0.75) this.steerTo(e, this.px, this.pz, speed);
        if (e.cooldown <= 0) {
          e.cooldown = 4.0 + this.rng.range(0, 0.8);
          this.fields.push({
            id: this.nextId++,
            x: e.x,
            z: e.z,
            radius: 1.15,
            ttl: 3.2,
            kind: 'ink',
            dps: 14 * this.damageScale(),
            tickAcc: 0
          });
        }
      } else if (e.kind === 'marginwalker') {
        const side = e.id % 2 ? 1 : -1,
          tx = this.px - nz * side * 3.5,
          tz = this.pz + nx * side * 3.5;
        this.steerTo(e, tx, tz, speed, 1.08);
      } else if (e.kind === 'elite') {
        if (e.boss) this.updateBossAI(e, speed, d, nx, nz);
        else this.updateEliteAI(e, speed, d, nx, nz);
      } else if (d > 0.68) {
        e.x += nx * speed * dt;
        e.z += nz * speed * dt;
      }
      dx = this.px - e.x;
      dz = this.pz - e.z;
      d = Math.hypot(dx, dz) || 1;
      if (d < e.radius + 0.44)
        this.hitPlayer(e.contactDps * (e.buffUntil > this.time ? 1.28 : 1) * dt);
    }
  }
  private updateEliteAI(e: Ent, speed: number, d: number, nx: number, nz: number) {
    const c = e.chassis!;
    if (c === 'hunter') {
      // PREDATOR: predictive intercept, not a faster normal mob.
      if (e.adaptStage === 2) {
        e.x += e.lockedX * 10.8 * this.dt;
        e.z += e.lockedZ * 10.8 * this.dt;
        if (e.stateTimer <= 0) {
          e.adaptStage = 0;
          e.cooldown = 2.6;
          e.exposedUntil = this.time + 0.9;
        }
        return;
      }
      if (e.adaptStage === 1 && e.stateTimer <= 0) {
        e.adaptStage = 2;
        e.stateTimer = 0.46;
        return;
      }
      const tx = this.px + this.playerVX * 0.58,
        tz = this.pz + this.playerVZ * 0.58;
      if (d > 0.9) this.steerTo(e, tx, tz, speed, 1.12);
      if (e.cooldown <= 0) {
        const dx = tx - e.x,
          dz = tz - e.z,
          m = Math.hypot(dx, dz) || 1;
        e.lockedX = dx / m;
        e.lockedZ = dz / m;
        e.adaptStage = 1;
        e.stateTimer = 0.55;
        e.cooldown = 99;
        this.events.push({
          type: 'CombatShape',
          tick: this.tick,
          source: 'elite_predator',
          intent: 'damage',
          shape: {
            kind: 'ray',
            x: e.x,
            z: e.z,
            aimX: e.lockedX,
            aimZ: e.lockedZ,
            range: 8.5,
            halfWidth: 0.7
          }
        });
        this.events.push({
          type: 'EliteOrder',
          tick: this.tick,
          entity: e.id,
          order: 'predator',
          x: e.x,
          z: e.z
        });
      }
    } else if (c === 'architect') {
      // VEIL: denies distant auto-lock inside moving fog pockets and relocates through them.
      if (d > 7.2) this.steerTo(e, this.px, this.pz, speed, 1.05);
      else if (d < 3.8) {
        e.x -= nx * speed * 0.5 * this.dt;
        e.z -= nz * speed * 0.5 * this.dt;
      }
      if (e.cooldown <= 0) {
        e.cooldown = 4.8;
        const baseA = this.rng.range(0, Math.PI * 2),
          pick = this.rng.int(3);
        let tx = e.x,
          tz = e.z;
        for (let i = 0; i < 3; i++) {
          const a = baseA + (i * Math.PI * 2) / 3,
            r = i === 0 ? 0 : 3.4;
          const x = e.x + Math.cos(a) * r,
            z = e.z + Math.sin(a) * r;
          this.fields.push({
            id: this.nextId++,
            x,
            z,
            radius: 3.25,
            ttl: 5.6,
            kind: 'veil',
            dps: 0,
            tickAcc: 0
          });
          if (i === pick) {
            tx = x;
            tz = z;
          }
        }
        e.x = Math.max(this.world.minX + 1, Math.min(this.world.maxX - 1, tx));
        e.z = Math.max(this.world.minZ + 1, Math.min(this.world.maxZ - 1, tz));
        this.events.push({
          type: 'EliteOrder',
          tick: this.tick,
          entity: e.id,
          order: 'veil',
          x: e.x,
          z: e.z,
          count: 3
        });
      }
    } else if (c === 'broodmaker') {
      // REPLICATOR: copies are created by repeated incoming hit events, not on a timer.
      if (d > 5.8) this.steerTo(e, this.px, this.pz, speed, 1.02);
      else if (d < 3.2) {
        e.x -= nx * speed * 0.45 * this.dt;
        e.z -= nz * speed * 0.45 * this.dt;
      }
    } else if (c === 'bulwark') {
      // PRISM movement is plain on purpose: its rule lives in damage causality/source alternation.
      if (d > 4.2) this.steerTo(e, this.px, this.pz, speed * 0.96);
      else if (d < 2.2) {
        e.x -= nx * speed * 0.3 * this.dt;
        e.z -= nz * speed * 0.3 * this.dt;
      }
    } else if (c === 'harvester') {
      // NULL WEAVER: direct and catalyst-derived events interact with its visible charge state.
      const side = e.id % 2 ? 1 : -1,
        tx = this.px - nz * side * 3.2,
        tz = this.pz + nx * side * 3.2;
      this.steerTo(e, tx, tz, speed, 1.08);
    } else if (c === 'shepherd') {
      // METAMORPH: first major damage threshold chooses a behavior from the recent combat signature.
      if (e.bossPattern === 'condensed') {
        const tx = this.px + this.playerVX * 0.35,
          tz = this.pz + this.playerVZ * 0.35;
        this.steerTo(e, tx, tz, speed, 1.55);
      } else if (e.bossPattern === 'migratory') {
        const side = e.id % 2 ? 1 : -1,
          tx = this.px - nz * side * 4.8,
          tz = this.pz + nx * side * 4.8;
        this.steerTo(e, tx, tz, speed, 1.22);
      } else if (d > 4.8) this.steerTo(e, this.px, this.pz, speed, 1.05);
    } else {
      if (d > 3.6) this.steerTo(e, this.px, this.pz, speed);
    }
  }
  private playerInSector(
    x: number,
    z: number,
    ax: number,
    az: number,
    radius: number,
    halfAngle: number
  ) {
    const dx = this.px - x,
      dz = this.pz - z,
      d = Math.hypot(dx, dz);
    if (d > radius) return false;
    const m = Math.hypot(ax, az) || 1,
      dot = ((dx / d) * ax) / m + ((dz / d) * az) / m;
    return d < 0.001 || Math.acos(Math.max(-1, Math.min(1, dot))) <= halfAngle;
  }
  private playerInRay(
    x: number,
    z: number,
    ax: number,
    az: number,
    range: number,
    halfWidth: number
  ) {
    const m = Math.hypot(ax, az) || 1;
    ax /= m;
    az /= m;
    const dx = this.px - x,
      dz = this.pz - z,
      t = dx * ax + dz * az,
      lat = Math.abs(dx * az - dz * ax);
    return t >= 0 && t <= range && lat <= halfWidth;
  }
  private updateBossAI(e: Ent, speed: number, d: number, nx: number, nz: number) {
    if (e.bossPhase === 1 && e.hp <= e.maxHp * 0.5) {
      e.bossPhase = 2;
      e.adaptCooldown = 0.5;
      e.buffUntil = this.time + 1.0;
      this.events.push({
        type: 'BossPhase',
        tick: this.tick,
        entity: e.id,
        phase: 2,
        x: e.x,
        z: e.z
      });
    }
    if (e.adaptStage === 2 && e.bossPattern === 'charge') {
      e.x += e.lockedX * (e.bossPhase === 2 ? 13.5 : 11.5) * this.dt;
      e.z += e.lockedZ * (e.bossPhase === 2 ? 13.5 : 11.5) * this.dt;
      e.x = Math.max(this.world.minX + 1, Math.min(this.world.maxX - 1, e.x));
      e.z = Math.max(this.world.minZ + 1, Math.min(this.world.maxZ - 1, e.z));
      if (e.stateTimer <= 0) {
        e.adaptStage = 0;
        e.adaptCooldown = e.bossPhase === 2 ? 2.25 : 3.2;
        e.exposedUntil = this.time + 1.25;
      }
      return;
    }
    if (e.adaptStage === 1 && e.stateTimer <= 0) {
      if (
        e.bossPattern === 'sweep' &&
        this.playerInSector(e.x, e.z, e.lockedX, e.lockedZ, 7.8, e.bossPhase === 2 ? 0.92 : 0.78)
      )
        this.hitPlayer((e.bossPhase === 2 ? 48 : 39) * this.damageScale());
      else if (
        e.bossPattern === 'rupture' &&
        this.playerInRay(e.x, e.z, e.lockedX, e.lockedZ, 16, e.bossPhase === 2 ? 1.85 : 1.55)
      ) {
        this.hitPlayer((e.bossPhase === 2 ? 43 : 35) * this.damageScale());
        this.fields.push({
          id: this.nextId++,
          x: this.px,
          z: this.pz,
          radius: 1.65,
          ttl: 2.4,
          kind: 'architect',
          dps: 18 * this.damageScale(),
          tickAcc: 0
        });
      } else if (e.bossPattern === 'charge') {
        e.adaptStage = 2;
        e.stateTimer = e.bossPhase === 2 ? 0.64 : 0.58;
        return;
      }
      e.adaptStage = 0;
      e.adaptCooldown = e.bossPhase === 2 ? 2.25 : 3.2;
      e.exposedUntil = this.time + 0.7;
      return;
    }
    if (e.adaptStage === 0) {
      if (d > 6.0) this.steerTo(e, this.px, this.pz, speed, e.bossPhase === 2 ? 1.22 : 1);
      else if (d < 3.2) {
        e.x -= nx * speed * 0.5 * this.dt;
        e.z -= nz * speed * 0.5 * this.dt;
      }
      if (e.adaptCooldown <= 0) {
        const r = this.rng.float(),
          pattern = r < 0.36 ? 'sweep' : r < 0.68 ? 'rupture' : 'charge',
          tx = this.px + this.playerVX * (pattern === 'sweep' ? 0.18 : 0.55),
          tz = this.pz + this.playerVZ * (pattern === 'sweep' ? 0.18 : 0.55),
          dx = tx - e.x,
          dz = tz - e.z,
          m = Math.hypot(dx, dz) || 1;
        e.lockedX = dx / m;
        e.lockedZ = dz / m;
        e.bossPattern = pattern;
        e.adaptStage = 1;
        e.stateTimer = pattern === 'charge' ? 1.0 : 0.88;
        const shape: CombatShape =
          pattern === 'sweep'
            ? {
                kind: 'sector',
                x: e.x,
                z: e.z,
                aimX: e.lockedX,
                aimZ: e.lockedZ,
                radius: 7.8,
                halfAngle: e.bossPhase === 2 ? 0.92 : 0.78
              }
            : {
                kind: 'ray',
                x: e.x,
                z: e.z,
                aimX: e.lockedX,
                aimZ: e.lockedZ,
                range: pattern === 'rupture' ? 16 : 15,
                halfWidth: pattern === 'rupture' ? (e.bossPhase === 2 ? 1.85 : 1.55) : 1.05
              };
        this.events.push({
          type: 'CombatShape',
          tick: this.tick,
          source: `telegraph_boss_${pattern}`,
          intent: 'damage',
          shape
        });
        this.events.push({
          type: 'BossPattern',
          tick: this.tick,
          entity: e.id,
          pattern,
          x: e.x,
          z: e.z
        });
        if (e.bossPhase === 2 && this.rng.float() < 0.55) {
          for (let i = 0; i < 3; i++) {
            const a = this.rng.range(0, Math.PI * 2);
            this.spawnEnemyAt(
              i === 0 ? 'bookmark' : 'footnote',
              e.x + Math.cos(a) * 2.2,
              e.z + Math.sin(a) * 2.2,
              1.6
            );
          }
        }
      }
    }
  }

  private hitPlayer(amount: number) {
    if (amount <= 0 || this.php <= 0) return;
    const reduction = this.armor / (this.armor + 100),
      mitigated = amount * (1 - reduction);
    let left = mitigated;
    if (this.barrier > 0) {
      const b = Math.min(this.barrier, left);
      this.barrier -= b;
      left -= b;
    }
    if (left > 0) {
      this.php = Math.max(0, this.php - left);
      this.metrics.damageTaken += left;
    }
    this.events.push({
      type: 'PlayerHit',
      tick: this.tick,
      amount: mitigated,
      x: this.px,
      z: this.pz
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
    const alive: Field[] = [];
    for (const f of this.fields) {
      f.ttl -= this.dt;
      f.tickAcc += this.dt;
      if (f.kind === 'ink' || f.kind === 'architect') {
        if (Math.hypot(this.px - f.x, this.pz - f.z) < f.radius) this.hitPlayer(f.dps * this.dt);
      } else if (f.kind !== 'index' && f.kind !== 'veil' && f.tickAcc >= 0.25) {
        f.tickAcc -= 0.25;
        for (const e of this.ents) {
          if (e.hp <= 0 || Math.hypot(e.x - f.x, e.z - f.z) > f.radius) continue;
          if (f.kind === 'frost')
            e.chillUntil = Math.max(e.chillUntil, this.time + 1.2 * this.memoryFactor());
          if (f.kind === 'fire')
            e.igniteUntil = Math.max(e.igniteUntil, this.time + 1.8 * this.memoryFactor());
          if (f.kind === 'toxic') {
            e.toxinUntil = Math.max(e.toxinUntil, this.time + 2.5 * this.memoryFactor());
            e.toxinDps = Math.max(e.toxinDps, f.dps * 0.55);
          }
          let fieldHit = f.dps * 0.25;
          if (
            f.kind === 'toxic' &&
            this.skillsRuntime.get('toxic_mist')?.mutation === 'toxic_corrosive'
          ) {
            const protectedTarget =
              !!e.linkedTo ||
              e.affix === 'shielded' ||
              this.ents.some(
                (o) =>
                  o.kind === 'elite' &&
                  o.chassis === 'bulwark' &&
                  o.hp > 0 &&
                  Math.hypot(o.x - e.x, o.z - e.z) < 6.5
              );
            if (protectedTarget) fieldHit *= 1.65;
          }
          this.damage(
            e,
            fieldHit,
            f.kind === 'arc' ? 'arc_field' : f.kind === 'toxic' ? 'toxic_mist' : 'fire_field',
            false,
            f.x,
            f.z
          );
          this.fieldDamage += f.dps * 0.25;
        }
      }
      if (f.ttl > 0) alive.push(f);
    }
    this.fields = alive;
  }
  private updateDots() {
    for (const e of this.ents) {
      if (e.hp <= 0) continue;
      if (e.woundUntil > this.time && e.woundDps > 0)
        this.damage(e, e.woundDps * this.dt, 'wound_dot', false, e.x, e.z);
      if (e.hp > 0 && e.toxinUntil > this.time && e.toxinDps > 0)
        this.damage(e, e.toxinDps * this.dt, 'toxin_dot', false, e.x, e.z);
    }
  }

  private updatePickups() {
    const alive: Pickup[] = [];
    for (const p of this.pickups) {
      const dx = this.px - p.x,
        dz = this.pz - p.z,
        d = Math.hypot(dx, dz) || 1;
      if (d < this.pickupRadius) {
        const sp = 5.5 + Math.max(0, this.pickupRadius - d) * 2.4;
        p.x += (dx / d) * sp * this.dt;
        p.z += (dz / d) * sp * this.dt;
      }
      if (d < 0.42) {
        if (p.kind === 'xp') this.xp += p.value;
        else if (p.kind === 'core') this.eliteCore += p.value;
        else {
          this.healPlayer(p.value);
          this.metrics.healsPicked++;
        }
        continue;
      }
      alive.push(p);
    }
    this.pickups = alive;
  }

  private updateConstructs() {
    const alive: Construct[] = [];
    for (const c of this.constructs) {
      c.ttl -= this.dt;
      c.cooldown -= this.dt;
      const st = this.skillsRuntime.get(c.skill);
      if (st?.mutation === 'sentry_crawler') {
        const dx = this.px - c.x,
          dz = this.pz - c.z,
          d = Math.hypot(dx, dz) || 1;
        if (d > 2.6) {
          c.x += (dx / d) * 1.65 * this.dt;
          c.z += (dz / d) * 1.65 * this.dt;
        }
      }
      if (st && c.cooldown <= 0) {
        let interval =
          st.mutation === 'sentry_gatling' ? 0.3 : st.mutation === 'sentry_rail' ? 1.1 : 0.62;
        c.cooldown = interval;
        const constructSrc = this.heroSource();
        let targets = this.ents.filter(
          (e) =>
            e.hp > 0 &&
            this.targetVisible(constructSrc, e) &&
            Math.hypot(e.x - c.x, e.z - c.z) <= c.range
        );
        if (st.mutation === 'sentry_rail')
          targets.sort(
            (a, b) =>
              Number(b.kind === 'elite') - Number(a.kind === 'elite') ||
              Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z)
          );
        else
          targets.sort(
            (a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z)
          );
        const t = targets[0];
        if (t) {
          let dmg = skills.sentry.baseDamage * this.powerBucket(st) * c.power;
          if (st.mutation === 'sentry_gatling') dmg *= 0.52;
          if (st.mutation === 'sentry_rail') dmg *= 1.9;
          if (
            st.mutation === 'sentry_relay' &&
            (t.markUntil > this.time || t.embedded > 0 || this.time - t.lastArcAt < 2.2)
          )
            dmg *= 1.28;
          this.damage(t, dmg, 'sentry', true, c.x, c.z);
          t.sentryTouchedUntil = this.time + 4;
          if (st.mutation === 'sentry_relay') {
            t.markUntil = Math.max(t.markUntil, this.time + 2.8 * this.memoryFactor());
            t.lastArcAt = this.time;
          }
        }
      }
      if (c.ttl > 0) alive.push(c);
    }
    this.constructs = alive;
  }

  private updateOrbitBlades() {
    const st = this.skillsRuntime.get('orbit_blades');
    if (!st || !this.isActiveSkill('orbit_blades')) return;
    this.orbitAcc += this.dt;
    if (this.orbitAcc < 0.13) return;
    this.orbitAcc -= 0.13;
    const mut = st.mutation,
      radius = this.skillRadius(st, skills.orbit_blades.baseRadius);
    let dmg = skills.orbit_blades.baseDamage * this.powerBucket(st) * 0.36;
    let count = 3 + Math.max(0, st.count - 1) + this.resonance.multiplicity;
    if (mut === 'orbit_many') {
      count += 3;
      dmg *= 0.9;
    } else if (mut === 'orbit_saw') {
      count = 2 + Math.max(0, st.count - 1) + this.resonance.multiplicity;
      dmg *= 1.4;
    }
    let blood = 1;
    if (mut === 'orbit_blood') {
      const wounded = this.ents.filter(
        (e) => e.woundUntil > this.time && Math.hypot(e.x - this.px, e.z - this.pz) < 5
      ).length;
      blood = 1 + Math.min(0.6, wounded * 0.06);
    }
    for (const e of this.ents) {
      if (e.hp <= 0 || this.time - e.orbitHitAt < 0.38) continue;
      const d = Math.hypot(e.x - this.px, e.z - this.pz);
      if (Math.abs(d - radius) < 0.62) {
        e.orbitHitAt = this.time;
        let m = dmg * blood;
        if (mut === 'orbit_saw' && e.kind === 'elite') m *= 1.9;
        this.damage(e, m, 'orbit_blades', false);
        this.closeDamage += m;
      }
    }
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

  private powerBucket(_st: SkillRuntime) {
    return this.corePower() * (1 + this.globalPower);
  }
  private skillRadius(st: SkillRuntime, base: number, _slot = this.currentSlot) {
    return base * Math.sqrt(1 + Math.max(0, st.coverage));
  }
  private skillRange(st: SkillRuntime, base: number) {
    return base * (1 + Math.max(0, st.range));
  }
  private memoryFactor() {
    return 1 + this.resonance.persistence * 0.18;
  }
  private persistentDuration(st: SkillRuntime, base: number, _slot = this.currentSlot) {
    const axis = this.supportsAxis(st.id, 'persistence') ? this.resonance.persistence : 0;
    return base * (1 + Math.max(0, st.duration)) * (1 + axis * 0.22);
  }
  private projectileCount(st: SkillRuntime, _slot: number) {
    let c = Math.max(1, Math.round(st.count)) + this.activationCountBonus;
    const mult = this.supportsAxis(st.id, 'multiplicity') ? this.resonance.multiplicity : 0;
    c += Math.min(3, mult);
    return Math.max(1, c);
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
    const incoming = this.incomingCatalyst(slot),
      conduct = 1 + this.resonance.conductivity * 0.16;
    // Operators modify the normal activation instead of merely multiplying its damage.
    const oldAimX = this.aimX,
      oldAimZ = this.aimZ;
    if (incoming === 'anchor' && this.lastContext.hitIds.length) {
      const dx = this.lastContext.x - this.px,
        dz = this.lastContext.z - this.pz,
        m = Math.hypot(dx, dz) || 1;
      this.aimX = dx / m;
      this.aimZ = dz / m;
    }
    if (incoming === 'capacitor') {
      const divisor = Math.max(3, 6 - this.resonance.conductivity);
      this.activationCountBonus += Math.min(
        3,
        Math.floor(this.lastContext.hitIds.length / divisor)
      );
    }
    if (incoming === 'reservoir') {
      this.reservoirCharge += this.lastContext.hitIds.length + this.lastContext.kills * 2;
      const threshold = Math.max(7, 12 - this.resonance.conductivity);
      if (this.reservoirCharge >= threshold) {
        this.reservoirCharge -= threshold;
        this.activationCountBonus += 2 + Math.min(1, this.resonance.conductivity);
        this.metrics.reactions++;
      }
    }
    const feedback = this.feedbackCountBonus.get(slot) ?? 0;
    if (feedback) {
      this.activationCountBonus += feedback;
      this.feedbackCountBonus.delete(slot);
    }
    if (incoming === 'aegis_relay' && this.lastContext.control > 0) {
      const gain = Math.min(
        36,
        (this.lastContext.control * 2.6 + this.lastContext.hitIds.length * 0.35) * conduct
      );
      this.grantBarrier(gain);
      this.events.push({
        type: 'Reaction',
        tick: this.tick,
        reaction: 'aegis',
        x: this.px,
        z: this.pz,
        amount: gain
      });
      this.metrics.reactions++;
    }
    this.metrics.activations++;
    this.events.push({
      type: 'SkillActivated',
      tick: this.tick,
      slot,
      skill: id,
      x: this.px,
      z: this.pz,
      aimX: this.aimX,
      aimZ: this.aimZ
    });
    this.dispatchSkill(id, st, slot, this.heroSource());
    this.aimX = oldAimX;
    this.aimZ = oldAimZ;
    if (incoming === 'relay' && this.lastContext.kills > 0) {
      const need = Math.max(1, 3 - Math.min(2, this.resonance.conductivity));
      if (this.lastContext.kills >= need) {
        const prev = this.activationScale;
        this.activationScale = 0.82;
        this.activationDerived = true;
        this.events.push({
          type: 'SkillActivated',
          tick: this.tick,
          slot,
          skill: id,
          x: this.px,
          z: this.pz,
          aimX: this.aimX,
          aimZ: this.aimZ
        });
        this.dispatchSkill(id, st, slot, this.heroSource());
        this.activationDerived = false;
        this.activationScale = prev;
        this.metrics.reactions++;
      }
    }
    if (incoming === 'conduit' && this.lastContext.state && this.currentHits.size) {
      for (const eid of this.currentHits) {
        const e = this.ents.find((q) => q.id === eid && q.hp > 0);
        if (e) this.applyState(e, this.lastContext.state, 0.65 * conduct);
      }
      this.metrics.reactions++;
      this.events.push({
        type: 'Reaction',
        tick: this.tick,
        reaction: 'conduit',
        x: this.px,
        z: this.pz
      });
    }
    if (incoming === 'echo_shard' && this.lastContext.damage > 0 && this.currentHits.size) {
      const targets = [...this.currentHits]
        .map((eid) => this.ents.find((q) => q.id === eid && q.hp > 0))
        .filter(Boolean) as Ent[];
      if (targets.length) {
        const cx = targets.reduce((a, e) => a + e.x, 0) / targets.length,
          cz = targets.reduce((a, e) => a + e.z, 0) / targets.length,
          r = 1.45,
          per = Math.min(
            160,
            (this.lastContext.damage * 0.48 * conduct) /
              Math.max(1, Math.min(4, this.lastContext.hitIds.length || 1))
          );
        this.activationDerived = true;
        for (const e of this.ents) {
          if (e.hp > 0 && Math.hypot(e.x - cx, e.z - cz) <= r + e.radius)
            this.damage(e, per, 'echo', false, cx, cz);
        }
        this.activationDerived = false;
        this.metrics.reactions++;
        this.events.push({
          type: 'Reaction',
          tick: this.tick,
          reaction: 'echo',
          x: cx,
          z: cz,
          amount: per
        });
      }
    }
    if (incoming === 'backflow' && slot > 0 && this.currentHits.size >= 3) {
      this.feedbackCountBonus.set(slot - 1, 1);
      this.metrics.reactions++;
    }
    this.previousHits = new Set(this.currentHits);
    let cx = this.px,
      cz = this.pz;
    if (this.currentHits.size) {
      const ts = [...this.currentHits]
        .map((eid) => this.ents.find((q) => q.id === eid))
        .filter(Boolean) as Ent[];
      if (ts.length) {
        cx = ts.reduce((a, e) => a + e.x, 0) / ts.length;
        cz = ts.reduce((a, e) => a + e.z, 0) / ts.length;
      }
    }
    const previous = this.lastContext;
    this.lastContext = {
      skill: id,
      damage: this.currentActivationDamage,
      kills: this.currentActivationKills,
      overkill: this.currentActivationOverkill,
      control: this.currentActivationControl,
      state: this.currentProducedState,
      hitIds: [...this.currentHits],
      x: cx,
      z: cz
    };
    if (incoming && slot > 0 && this.slots[slot - 1])
      this.events.push({
        type: 'CatalystTriggered',
        tick: this.tick,
        catalyst: incoming,
        fromSlot: slot - 1,
        toSlot: slot,
        sourceX: previous.x,
        sourceZ: previous.z,
        targetX: cx,
        targetZ: cz
      });
    // Topology operator: a successful B can bounce execution once back to A. Guard forbids recursion.
    if (
      incoming === 'overflow' &&
      slot > 0 &&
      !this.topologyGuard &&
      previous.hitIds.length >= Math.max(5, 8 - this.resonance.conductivity)
    ) {
      const prevId = this.slots[slot - 1];
      if (prevId) {
        const prevSt = this.skillsRuntime.get(prevId);
        if (prevSt) {
          this.topologyGuard = true;
          const saveSlot = this.currentSlot,
            saveScale = this.activationScale,
            saveDerived = this.activationDerived;
          this.currentSlot = slot - 1;
          this.activationScale = 0.78;
          this.activationDerived = true;
          this.events.push({
            type: 'SkillActivated',
            tick: this.tick,
            slot: slot - 1,
            skill: prevId,
            x: this.px,
            z: this.pz,
            aimX: this.aimX,
            aimZ: this.aimZ
          });
          this.dispatchSkill(prevId, prevSt, slot - 1, this.heroSource());
          this.activationDerived = saveDerived;
          this.activationScale = saveScale;
          this.currentSlot = saveSlot;
          this.topologyGuard = false;
          this.metrics.reactions++;
        }
      }
    }
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
        z: this.pz
      };
    }
    this.currentSlot = -1;
    this.activationScale = 1;
    this.activationCountBonus = 0;
    this.activationDerived = false;
  }

  private stateActive(e: Ent, state: string) {
    if (state === 'ignite') return e.igniteUntil > this.time;
    if (state === 'chill') return e.chillUntil > this.time;
    if (state === 'wound') return e.woundUntil > this.time;
    if (state === 'toxin') return e.toxinUntil > this.time;
    if (state === 'mark') return e.markUntil > this.time;
    if (state === 'exposed') return e.exposedUntil > this.time;
    if (state === 'embed') return e.embedded > 0;
    if (state === 'displaced') return e.displacedUntil > this.time;
    return false;
  }
  private consumeState(e: Ent, state: string) {
    if (state === 'ignite') e.igniteUntil = 0;
    else if (state === 'chill') e.chillUntil = 0;
    else if (state === 'wound') {
      e.woundUntil = 0;
      e.woundDps = 0;
    } else if (state === 'toxin') {
      e.toxinUntil = 0;
      e.toxinDps = 0;
    } else if (state === 'mark') e.markUntil = 0;
    else if (state === 'exposed') e.exposedUntil = 0;
    else if (state === 'embed') e.embedded = Math.max(0, e.embedded - 1);
    else if (state === 'displaced') e.displacedUntil = 0;
  }
  private applyState(e: Ent, state: string, potency = 1) {
    const dur = 2.6 * Math.max(0.35, potency) * this.memoryFactor();
    if (state === 'ignite') e.igniteUntil = Math.max(e.igniteUntil, this.time + dur);
    else if (state === 'chill') e.chillUntil = Math.max(e.chillUntil, this.time + dur);
    else if (state === 'wound') {
      e.woundUntil = Math.max(e.woundUntil, this.time + dur * 1.45);
      e.woundDps = Math.max(e.woundDps, 7 * potency * (1 + this.globalPower));
    } else if (state === 'toxin') {
      e.toxinUntil = Math.max(e.toxinUntil, this.time + dur * 1.6);
      e.toxinDps = Math.max(e.toxinDps, 6 * potency * (1 + this.globalPower));
    } else if (state === 'mark') e.markUntil = Math.max(e.markUntil, this.time + dur * 1.4);
    else if (state === 'exposed') e.exposedUntil = Math.max(e.exposedUntil, this.time + dur);
    else if (state === 'embed')
      e.embedded = Math.min(8, e.embedded + Math.max(1, Math.round(potency)));
    else if (state === 'displaced')
      e.displacedUntil = Math.max(e.displacedUntil, this.time + 1.2 * this.memoryFactor());
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
  private rayHits(
    src: CastSource,
    ax: number,
    az: number,
    range: number,
    width: number,
    maxHits = 99
  ) {
    const hits: { e: Ent; t: number; lat: number }[] = [];
    for (const e of this.ents) {
      if (e.hp <= 0) continue;
      const dx = e.x - src.x,
        dz = e.z - src.z,
        t = dx * ax + dz * az;
      if (t < 0 || t > range) continue;
      const lat = Math.abs(dx * az - dz * ax);
      if (lat <= width + e.radius * 0.45) hits.push({ e, t, lat });
    }
    hits.sort((a, b) => a.t - b.t);
    return hits.slice(0, maxHits);
  }
  private rotatedAim(src: CastSource, rad: number) {
    const c = Math.cos(rad),
      s = Math.sin(rad);
    return { x: src.aimX * c - src.aimZ * s, z: src.aimX * s + src.aimZ * c };
  }
  private targetVisible(src: CastSource, e: Ent) {
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
    for (const e of this.ents) {
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
    intent: 'damage' | 'control' | 'field' = 'damage'
  ) {
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
        maxHits = mut === 'ember_impaler' ? 4 : 1;
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
        if (mut === 'ember_impaler' && h.e.kind === 'elite') dmg *= 1.7;
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
          for (const o of this.ents) {
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
        tickAcc: 0
      });
      this.noteState('field');
    }
  }
  private castFrost(st: SkillRuntime, slot: number, src: CastSource) {
    const mut = st.mutation,
      r = this.skillRadius(st, skills.frost_ring.baseRadius, slot),
      capacitive =
        this.skillsRuntime.get('chain_arc')?.mutation === 'arc_capacitive' && this.charge > 0
          ? 1 + Math.min(0.4, this.charge * 0.08)
          : 1;
    this.combatShape('frost_ring', { kind: 'circle', x: src.x, z: src.z, radius: r }, 'control');
    for (const e of this.ents) {
      const d = Math.hypot(e.x - src.x, e.z - src.z);
      if (d > r + e.radius) continue;
      let dmg =
        skills.frost_ring.baseDamage * this.powerBucket(st) * this.slotAmp(slot, e) * capacitive;
      if (mut === 'frost_rim') dmg *= d > r * 0.62 ? 2 : 0.48;
      if (mut === 'frost_snap' && e.chillUntil > this.time) {
        dmg += 18 * this.powerBucket(st);
        e.chillUntil = 0;
      }
      const ignited = e.igniteUntil > this.time;
      if (ignited) {
        e.igniteUntil = 0;
        dmg *= 1.18;
        this.metrics.reactions++;
        this.events.push({
          type: 'Reaction',
          tick: this.tick,
          reaction: 'thermal_shock',
          x: e.x,
          z: e.z,
          amount: dmg * 0.42
        });
        for (const o of this.ents) {
          if (o !== e && o.hp > 0 && Math.hypot(o.x - e.x, o.z - e.z) < 1.7)
            this.damage(o, dmg * 0.42, 'thermal_shock', false, e.x, e.z);
        }
      }
      const was = e.chillUntil > this.time,
        killed = this.damage(e, dmg, 'frost_ring', false);
      e.chillUntil = this.time + 2.4 * (1 + st.statusPotency) * this.memoryFactor();
      this.noteState('chill');
      this.currentActivationControl += 1 + st.control;
      if (mut === 'frost_brittle') e.exposedUntil = this.time + 2.8 * this.memoryFactor();
      if (mut === 'frost_skin' && killed && (was || ignited)) this.grantBarrier(9);
    }
    if (mut === 'frost_front') {
      this.fields.push({
        id: this.nextId++,
        x: src.x,
        z: src.z,
        radius: r * 1.12,
        ttl: this.persistentDuration(st, 1.6, slot),
        kind: 'frost',
        dps: 13 * this.powerBucket(st),
        tickAcc: 0
      });
      this.noteState('field');
    }
    for (
      let i = 0;
      i < Math.min(2, this.supportsAxis(st.id, 'multiplicity') ? this.resonance.multiplicity : 0);
      i++
    )
      this.fields.push({
        id: this.nextId++,
        x: src.x,
        z: src.z,
        radius: r * (0.78 + i * 0.22),
        ttl: 0.55 + i * 0.18,
        kind: 'frost',
        dps: 8 * this.powerBucket(st),
        tickAcc: 0
      });
    if (capacitive > 1) this.charge = 0;
  }
  private castRail(st: SkillRuntime, slot: number, src: CastSource) {
    const mut = st.mutation;
    if (mut === 'rail_gun' && this.cycle % 2 === 1) return;
    const count = this.projectileCount(st, slot) + (mut === 'rail_fan' ? 2 : 0),
      rays: number[] = [];
    for (let i = 0; i < count; i++)
      rays.push((i - (count - 1) / 2) * (mut === 'rail_fan' ? 0.11 : 0.055));
    for (const ang of rays) {
      const a = this.rotatedAim(src, ang);
      let base =
        skills.rail_spear.baseDamage *
        this.powerBucket(st) *
        (mut === 'rail_gun'
          ? 2.35
          : mut === 'rail_fan'
            ? 0.58
            : mut === 'rail_rack'
              ? 0.78
              : count > 1
                ? 0.8
                : 1);
      const range = this.skillRange(st, mut === 'rail_gun' ? 25 : skills.rail_spear.baseRange),
        width = this.skillRadius(st, 0.34, slot);
      this.combatShape('rail_spear', {
        kind: 'ray',
        x: src.x,
        z: src.z,
        aimX: a.x,
        aimZ: a.z,
        range,
        halfWidth: width
      });
      const hits = this.rayHits(
        src,
        a.x,
        a.z,
        range,
        width,
        mut === 'rail_gun' ? 14 : mut === 'rail_fan' ? 5 : 8
      );
      let first = true;
      for (const h of hits) {
        let dmg = base * this.slotAmp(slot, h.e);
        if (mut === 'rail_spot' && h.e.markUntil > this.time) dmg *= 1.25;
        const hadMark = h.e.markUntil > this.time;
        this.damage(h.e, dmg, 'rail_spear', true);
        h.e.embedded = Math.min(8, h.e.embedded + (mut === 'rail_rack' ? 2 : 1));
        this.noteState('embed');
        if ((mut === 'rail_spot' || hadMark) && hadMark) h.e.exposedUntil = this.time + 3;
        if (mut === 'rail_harpoon' && first && h.e.kind === 'elite') {
          const dx = src.x - h.e.x,
            dz = src.z - h.e.z,
            d = Math.hypot(dx, dz) || 1;
          h.e.x += (dx / d) * 1.25;
          h.e.z += (dz / d) * 1.25;
        }
        first = false;
      }
    }
  }
  private castCleaver(st: SkillRuntime, slot: number, src: CastSource, repeat = false) {
    const mut = st.mutation,
      r = this.skillRadius(st, skills.cleaver.baseRadius, slot);
    let half = mut === 'cleaver_guillotine' ? 0.65 : 1.12;
    if (mut === 'cleaver_roundhouse') half = Math.PI;
    this.combatShape('cleaver', {
      kind: 'sector',
      x: src.x,
      z: src.z,
      radius: r,
      aimX: src.aimX,
      aimZ: src.aimZ,
      halfAngle: half
    });
    let kills = 0;
    for (const e of this.ents) {
      const dx = e.x - src.x,
        dz = e.z - src.z,
        d = Math.hypot(dx, dz);
      if (d > r + e.radius || d < 0.01) continue;
      const dot = (dx / d) * src.aimX + (dz / d) * src.aimZ;
      if (Math.acos(Math.max(-1, Math.min(1, dot))) > half) continue;
      let dmg =
        skills.cleaver.baseDamage *
        this.powerBucket(st) *
        this.slotAmp(slot, e) *
        (repeat ? 0.65 : 1);
      if (mut === 'cleaver_roundhouse') dmg *= 1.0;
      if (mut === 'cleaver_guillotine' && e.hp / e.maxHp < 0.25) dmg *= 2;
      if (mut === 'cleaver_deep') dmg *= 0.72;
      const killed = this.damage(e, dmg, 'cleaver', true);
      this.closeDamage += dmg;
      if (killed) kills++;
      e.woundUntil = Math.max(
        e.woundUntil,
        this.time +
          (mut === 'cleaver_deep' ? 4.8 : 2.6) * (1 + st.statusPotency) * this.memoryFactor()
      );
      e.woundDps = Math.max(e.woundDps, (mut === 'cleaver_deep' ? 11 : 4.5) * this.powerBucket(st));
      this.noteState('wound');
      if (mut === 'cleaver_hook') {
        const tx = src.x - e.x,
          tz = src.z - e.z,
          td = Math.hypot(tx, tz) || 1;
        e.x += (tx / td) * 0.65 * (1 + st.control);
        e.z += (tz / td) * 0.65 * (1 + st.control);
      }
      if (mut === 'cleaver_deep') {
        e.woundUntil = this.time + 4 * (1 + st.statusPotency) * this.memoryFactor();
        e.woundDps = Math.max(e.woundDps, 10 * this.powerBucket(st));
      }
    }
    if (mut === 'cleaver_rhythm' && kills > 0 && !repeat) {
      this.butcherStacks = Math.min(4, this.butcherStacks + kills);
      if (this.rng.float() < Math.min(0.65, this.butcherStacks * 0.16)) {
        this.castCleaver(st, slot, src, true);
        this.butcherStacks = 0;
      }
    }
    if (!repeat && this.supportsAxis(st.id, 'multiplicity') && this.resonance.multiplicity > 0) {
      const ax = src.aimX,
        az = src.aimZ;
      for (let i = 0; i < Math.min(2, this.resonance.multiplicity); i++) {
        const a = (i % 2 === 0 ? 1 : -1) * (0.22 + 0.08 * i),
          c = Math.cos(a),
          q = Math.sin(a);
        src.aimX = ax * c - az * q;
        src.aimZ = ax * q + az * c;
        this.castCleaver(st, slot, src, true);
      }
      src.aimX = ax;
      src.aimZ = az;
    }
  }
  private castArc(st: SkillRuntime, slot: number, src: CastSource) {
    const mut = st.mutation,
      maxJumps =
        (mut === 'arc_forked' ? 7 : 4) + Math.max(0, st.count - 1) + this.resonance.multiplicity,
      jumpRange = this.skillRange(st, mut === 'arc_relay' ? 5.8 : 4.2);
    let current: Ent | undefined;
    const available = this.ents.filter(
      (e) =>
        e.hp > 0 &&
        this.targetVisible(src, e) &&
        Math.hypot(e.x - src.x, e.z - src.z) < this.skillRange(st, skills.chain_arc.baseRange)
    );
    const embedded = available.filter((e) => e.embedded > 0);
    if (embedded.length) current = embedded.sort((a, b) => b.embedded - a.embedded)[0];
    if (mut === 'arc_ground')
      current = available
        .filter((e) => e.markUntil > this.time || e.embedded > 0)
        .sort(
          (a, b) => Math.hypot(a.x - src.x, a.z - src.z) - Math.hypot(b.x - src.x, b.z - src.z)
        )[0];
    if (!current)
      current = available.sort(
        (a, b) => Math.hypot(a.x - src.x, a.z - src.z) - Math.hypot(b.x - src.x, b.z - src.z)
      )[0];
    if (!current) return;
    const hit = new Set<number>();
    let jumps = 0,
      prevX = src.x,
      prevZ = src.z;
    while (current && jumps < maxJumps) {
      hit.add(current.id);
      let dmg =
        skills.chain_arc.baseDamage *
        this.powerBucket(st) *
        this.slotAmp(slot, current) *
        Math.pow(mut === 'arc_forked' ? 0.93 : 0.88, jumps);
      if (mut === 'arc_ground' && (current.markUntil > this.time || current.embedded > 0))
        dmg *= 1.45;
      if (current.embedded > 0) {
        dmg *= 1.28;
        current.embedded--;
        this.metrics.reactions++;
      }
      this.damage(current, dmg, 'chain_arc', false, prevX, prevZ);
      this.noteState('charge');
      if (mut === 'arc_cage' && this.time - current.lastArcAt < 2.2)
        this.fields.push({
          id: this.nextId++,
          x: current.x,
          z: current.z,
          radius: 1.25,
          ttl: 1.7 * (1 + st.duration),
          kind: 'arc',
          dps: 13 * this.powerBucket(st),
          tickAcc: 0
        });
      current.lastArcAt = this.time;
      prevX = current.x;
      prevZ = current.z;
      jumps++;
      let next: Ent | undefined,
        best = 999;
      for (const e of this.ents) {
        if (e.hp <= 0 || hit.has(e.id)) continue;
        const dd = Math.hypot(e.x - prevX, e.z - prevZ);
        if (dd < jumpRange && dd < best) {
          best = dd;
          next = e;
        }
      }
      current = next;
    }
    if (mut === 'arc_capacitive' && jumps < maxJumps)
      this.charge = Math.min(5, this.charge + (maxJumps - jumps));
  }
  private castOrbit(st: SkillRuntime, slot: number, src: CastSource) {
    if (st.mutation === 'orbit_outbound') {
      const r = this.skillRadius(st, 4.6, slot);
      this.combatShape('orbit_blades', { kind: 'circle', x: src.x, z: src.z, radius: r });
      for (const e of this.ents) {
        if (Math.hypot(e.x - src.x, e.z - src.z) < r)
          this.damage(
            e,
            skills.orbit_blades.baseDamage * 2.2 * this.powerBucket(st) * this.slotAmp(slot, e),
            'orbit_blades',
            false
          );
      }
    }
  }
  private castMortar(st: SkillRuntime, slot: number, src: CastSource) {
    const mut = st.mutation,
      range = this.skillRange(st, skills.mortar_bloom.baseRange),
      p = this.aimPoint(src, range);
    let r = this.skillRadius(st, skills.mortar_bloom.baseRadius, slot),
      mult = 1;
    if (mut === 'mortar_fuse') {
      r *= 1.35;
      mult *= 1.35;
    } else if (mut === 'mortar_airburst') {
      r *= 1.45;
      mult *= 0.82;
    }
    const explosions = mut === 'mortar_cluster' ? 3 : Math.max(1, this.projectileCount(st, slot));
    for (let n = 0; n < explosions; n++) {
      const a = n ? this.rng.range(0, Math.PI * 2) : 0,
        rr = n ? this.rng.range(0.7, 1.6) : 0,
        cx = p.x + Math.cos(a) * rr,
        cz = p.z + Math.sin(a) * rr;
      this.combatShape('mortar_bloom', { kind: 'circle', x: cx, z: cz, radius: r });
      for (const e of this.ents) {
        const d = Math.hypot(e.x - cx, e.z - cz);
        if (d <= r + e.radius) {
          let dmg =
            skills.mortar_bloom.baseDamage *
            this.powerBucket(st) *
            this.slotAmp(slot, e) *
            mult *
            (explosions > 1 ? 0.86 : 1);
          if (mut === 'mortar_spotter' && e.kind === 'elite' && e.markUntil > this.time)
            dmg *= 1.45;
          this.damage(e, dmg, 'mortar_bloom', false, cx, cz);
        }
      }
      if (mut === 'mortar_crater' && n === 0)
        this.fields.push({
          id: this.nextId++,
          x: cx,
          z: cz,
          radius: r * 0.9,
          ttl: this.persistentDuration(st, 3.3, slot),
          kind: 'frost',
          dps: 6 * this.powerBucket(st),
          tickAcc: 0
        });
    }
    this.noteState('field');
  }
  private castSentry(st: SkillRuntime, slot: number, src: CastSource) {
    const count = Math.max(1, Math.min(5, st.count + Math.ceil(this.resonance.multiplicity / 2)));
    for (let i = 0; i < count; i++) {
      const a = (i * Math.PI * 2) / count + this.cycle * 0.7,
        r = 1.2;
      this.constructs.push({
        id: this.nextId++,
        x: src.x + Math.cos(a) * r,
        z: src.z + Math.sin(a) * r,
        ttl: this.persistentDuration(st, 7.5, slot),
        cooldown: 0.1 + i * 0.08,
        range: this.skillRange(st, skills.sentry.baseRange),
        power: this.slotAmp(slot),
        skill: 'sentry'
      });
      this.events.push({
        type: 'ConstructSpawned',
        tick: this.tick,
        skill: 'sentry',
        x: src.x + Math.cos(a) * r,
        z: src.z + Math.sin(a) * r
      });
    }
    while (this.constructs.length > 5) this.constructs.shift();
    this.noteState('construct');
  }
  private castToxic(st: SkillRuntime, slot: number, src: CastSource) {
    let r = this.skillRadius(st, skills.toxic_mist.baseRadius, slot),
      dps = skills.toxic_mist.baseDamage * this.powerBucket(st) * this.slotAmp(slot);
    if (st.mutation === 'toxic_distilled') {
      r *= 0.58;
      dps *= 1.85;
    }
    const x = st.mutation === 'toxic_plume' ? src.x - src.vx * 0.55 : src.x,
      z = st.mutation === 'toxic_plume' ? src.z - src.vz * 0.55 : src.z;
    this.combatShape('toxic_mist', { kind: 'circle', x, z, radius: r }, 'field');
    if (st.mutation === 'toxic_reactive') {
      for (const e of this.ents) {
        if (e.hp <= 0 || Math.hypot(e.x - x, e.z - z) > r + e.radius) continue;
        const reactive = e.woundUntil > this.time || e.igniteUntil > this.time;
        if (reactive) {
          if (e.woundUntil > this.time) {
            e.woundUntil = 0;
            e.woundDps = 0;
          } else e.igniteUntil = 0;
          this.damage(e, dps * 1.25, 'septic_cut', false, x, z);
          this.metrics.reactions++;
        }
      }
    }
    this.fields.push({
      id: this.nextId++,
      x,
      z,
      radius: r,
      ttl: this.persistentDuration(st, 4.2, slot),
      kind: 'toxic',
      dps,
      tickAcc: 0
    });
    for (let i = 0; i < Math.min(3, this.resonance.multiplicity); i++) {
      const a =
          this.cycle * 0.9 +
          (i * Math.PI * 2) / Math.max(1, Math.min(3, this.resonance.multiplicity)),
        rr = r * 0.48;
      this.fields.push({
        id: this.nextId++,
        x: x + Math.cos(a) * rr,
        z: z + Math.sin(a) * rr,
        radius: r * 0.58,
        ttl: this.persistentDuration(st, 3.0, slot),
        kind: 'toxic',
        dps: dps * 0.58,
        tickAcc: 0
      });
    }
    this.noteState('toxin');
  }
  private castRepulse(st: SkillRuntime, slot: number, src: CastSource) {
    const mut = st.mutation,
      r0 = this.skillRadius(st, skills.repulse_halo.baseRadius, slot),
      passes = mut === 'repulse_rings' ? 2 : 1;
    let aegisGranted = 0;
    for (let pass = 0; pass < passes; pass++) {
      const r = r0 * (passes === 2 ? (pass === 0 ? 0.72 : 1.05) : 1),
        pull = mut === 'repulse_gravity';
      this.combatShape(
        'repulse_halo',
        { kind: 'circle', x: src.x, z: src.z, radius: r },
        'control'
      );
      for (const e of this.ents) {
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
        if (mut === 'repulse_relay')
          this.charge = Math.min(6, this.charge + 0.22 + st.control * 0.08);
      }
    }
  }

  private castMassDriver(st: SkillRuntime, slot: number, src: CastSource) {
    const mut = st.mutation,
      range = this.skillRange(st, mut === 'mass_rail' ? 26 : skills.mass_driver.baseRange),
      width = this.skillRadius(st, mut === 'mass_rail' ? 0.34 : 0.52, slot);
    this.combatShape(
      'mass_driver',
      {
        kind: 'ray',
        x: src.x,
        z: src.z,
        aimX: src.aimX,
        aimZ: src.aimZ,
        range,
        halfWidth: width
      },
      'control'
    );
    const hits = this.rayHits(src, src.aimX, src.aimZ, range, width, 18);
    let cargo = 0;
    if (mut === 'mass_cargo') {
      for (const c of this.constructs) {
        const dx = c.x - src.x,
          dz = c.z - src.z,
          t = dx * src.aimX + dz * src.aimZ,
          lat = Math.abs(dx * src.aimZ - dz * src.aimX);
        if (t > 0 && t < range && lat < 1.2) cargo++;
      }
      for (const p of this.pickups) {
        const dx = p.x - src.x,
          dz = p.z - src.z,
          t = dx * src.aimX + dz * src.aimZ,
          lat = Math.abs(dx * src.aimZ - dz * src.aimX);
        if (t > 0 && t < range && lat < 0.9) cargo++;
      }
    }
    let terminal = 1;
    if (mut === 'mass_terminal') {
      terminal += Math.min(
        1.0,
        this.charge * 0.14 + (this.capacitorCharge + this.overflowCharge) / 260
      );
      this.charge = 0;
    }
    let n = 0;
    for (const h of hits) {
      let dmg =
        skills.mass_driver.baseDamage *
        this.powerBucket(st) *
        this.slotAmp(slot, h.e) *
        (mut === 'mass_rail' ? 1.55 : 1) *
        terminal *
        (mut === 'mass_cargo' ? 1 + Math.min(0.8, cargo * 0.16) : 1);
      if (mut === 'mass_snowball') dmg *= 1 + Math.min(0.9, n * 0.1);
      this.damage(h.e, dmg, 'mass_driver', true);
      const push = 0.7 * (1 + st.control);
      h.e.x += src.aimX * push;
      h.e.z += src.aimZ * push;
      h.e.displacedUntil = this.time + 1.2;
      this.noteState('displaced');
      this.currentActivationControl += 0.8 + st.control;
      n++;
    }
    if (mut === 'mass_recoil') {
      this.displaceSource(src, -src.aimX * 0.9, -src.aimZ * 0.9);
    }
  }

  private damage(
    e: Ent,
    amount: number,
    source: string,
    directional: boolean,
    sourceX = this.px,
    sourceZ = this.pz
  ) {
    if (e.hp <= 0) return false;
    let actual = amount;
    const skill = this.skillsRuntime.get(source as SkillId);
    if (skill) {
      if (e.kind === 'elite') actual *= 1 + skill.eliteDamage;
      const precision = this.supportsAxis(skill.id, 'precision')
        ? this.resonance.precision * 0.045
        : 0;
      if (skill.crit + precision > 0 && this.rng.float() < skill.crit + precision) actual *= 1.75;
    }
    if (e.kind === 'elite' && !e.boss) {
      if (e.chassis === 'bulwark' && (skill || this.activationDerived)) {
        const key = skill ? skill.id : 'derived';
        if (!e.bossPattern) {
          e.bossPattern = key;
          this.events.push({
            type: 'EliteOrder',
            tick: this.tick,
            entity: e.id,
            order: 'prism',
            x: e.x,
            z: e.z
          });
        } else if (e.bossPattern === key) actual *= 0.28;
        else {
          e.bossPattern = key;
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
      if (e.chassis === 'shepherd' && !e.bossPattern && e.hp - actual <= e.maxHp * 0.68) {
        const recent = this.damageSamples.filter((q) => q.t >= this.time - 5),
          sum = recent.reduce((a, q) => a + q.amount, 0),
          derived = recent.reduce((a, q) => a + (q.derived ? q.amount : 0), 0),
          rate = recent.length / 5,
          avg = recent.length ? sum / recent.length : 0;
        e.bossPattern =
          derived / Math.max(1, sum) > 0.42
            ? 'null'
            : rate > 9
              ? 'condensed'
              : avg > 95 * this.corePower()
                ? 'fractured'
                : 'migratory';
        if (e.bossPattern === 'fractured') {
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
      if (e.chassis === 'shepherd' && e.bossPattern === 'null' && this.activationDerived)
        actual *= 0.48;
    }
    if (source !== 'ember_lance' && e.markUntil > this.time) {
      actual *= 1.35;
      e.markUntil = 0;
    }
    if (e.exposedUntil > this.time) actual *= 1.3;
    if (e.kind !== 'binder' && e.linkedTo) {
      const binder = this.ents.find((o) => o.id === e.linkedTo && o.kind === 'binder' && o.hp > 0);
      if (binder) actual *= 0.65;
    }
    if (e.kind === 'elite' && e.affix === 'shielded' && directional) {
      const incoming = Math.atan2(sourceZ - e.z, sourceX - e.x),
        diff = Math.abs(this.angleDiff(incoming, e.shieldAngle));
      actual *= diff < 0.95 ? 0.42 : 1.2;
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
    if (e.kind === 'elite') this.metrics.eliteDamage += actual;
    if (directional) this.directionalDamage += actual;
    if (source === 'cleaver' || source === 'orbit_blades') this.closeDamage += actual;
    if (source.includes('field') || source === 'toxic_mist') this.fieldDamage += actual;
    if (skill && this.currentSlot >= 0) {
      this.currentHits.add(e.id);
      this.currentActivationDamage += actual;
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
    if (killed) this.killsBySource.set(source, (this.killsBySource.get(source) ?? 0) + 1);
    if (killed && skill && this.currentSlot >= 0) {
      this.currentActivationKills++;
      this.currentActivationOverkill += Math.max(0, actual - before);
    }
    if (
      killed &&
      source === 'ember_lance' &&
      this.skillsRuntime.get('ember_lance')?.mutation === 'ember_backdraft'
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
  private angleDiff(a: number, b: number) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  private cleanup() {
    const alive: Ent[] = [];
    for (const e of this.ents) {
      if (e.hp > 0) {
        alive.push(e);
        continue;
      }
      if (e.kind === 'palimpsest' && e.revivesLeft > 0) {
        e.revivesLeft--;
        e.revived = true;
        e.hp = e.maxHp * 0.42;
        e.speed *= 1.32;
        e.chillUntil = 0;
        e.woundUntil = 0;
        e.toxinUntil = 0;
        alive.push(e);
        this.events.push({ type: 'EnemyRevived', tick: this.tick, entity: e.id, x: e.x, z: e.z });
        continue;
      }
      if (
        e.toxinUntil > this.time &&
        this.skillsRuntime.get('toxic_mist')?.mutation === 'toxic_contagion'
      ) {
        for (const o of this.ents) {
          if (o !== e && o.hp > 0 && Math.hypot(o.x - e.x, o.z - e.z) < 2.8) {
            o.toxinUntil = Math.max(o.toxinUntil, this.time + 2.8 * this.memoryFactor());
            o.toxinDps = Math.max(o.toxinDps, Math.max(5, e.toxinDps * 0.72));
          }
        }
      }
      this.metrics.killed++;
      const elite = e.kind === 'elite';
      if (elite) this.metrics.eliteKilled++;
      this.events.push({
        type: 'EntityDied',
        tick: this.tick,
        entity: e.id,
        kind: e.kind,
        x: e.x,
        z: e.z,
        elite,
        boss: e.boss
      });
      if (e.boss) {
        this.bossDefeated = true;
        continue;
      }
      if (e.cloneParent) {
        const parent = this.ents.find((o) => o.id === e.cloneParent && o.hp > 0);
        if (parent) {
          const feedback = parent.maxHp * 0.055;
          parent.hp -= feedback;
          this.events.push({
            type: 'DamageResolved',
            tick: this.tick,
            entity: parent.id,
            amount: feedback,
            source: 'replicant_feedback',
            x: parent.x,
            z: parent.z,
            sourceX: e.x,
            sourceZ: e.z,
            elite: true,
            crit: false
          });
        }
        continue;
      }
      if (e.kind === 'inkblot')
        this.fields.push({
          id: this.nextId++,
          x: e.x,
          z: e.z,
          radius: 1.75,
          ttl: 3.3,
          kind: 'ink',
          dps: 11 * this.damageScale(),
          tickAcc: 0
        });
      if (elite && e.affix === 'volatile') {
        if (Math.hypot(this.px - e.x, this.pz - e.z) < 2.6) this.hitPlayer(24 * this.damageScale());
        for (const o of this.ents) {
          if (o !== e && o.hp > 0 && Math.hypot(o.x - e.x, o.z - e.z) < 2.6)
            this.damage(o, 42 * this.worldScale(), 'elite_volatile', false, e.x, e.z);
        }
      }
      const xpVal = elite
        ? 30
        : e.kind === 'binder' || e.kind === 'redactor' || e.kind === 'indexer'
          ? 4.0
          : e.kind === 'marginwalker'
            ? 3.0
            : e.kind === 'bookmark'
              ? 2.5
              : e.kind === 'footnote'
                ? 2.1
                : e.kind === 'inkblot'
                  ? 2.4
                  : 1.8;
      this.pickups.push({ id: this.nextId++, x: e.x, z: e.z, value: xpVal, kind: 'xp' });
      if (elite && e.guardianPoi > 0) {
        this.completePoi(e.guardianPoi);
        continue;
      }
      if (elite && e.guardianPoi < 0) continue;
      if (elite) {
        let core =
          2 + (eliteAffixThreat[e.affix] >= 2 ? 1 : 0) + (eliteAffixThreat[e.affix] >= 4 ? 1 : 0);
        if (this.mode === 'clean' && this.allOwnedCatalysts().length === 0)
          core = Math.max(core, 5);
        if (
          this.skillsRuntime.get('sentry')?.mutation === 'sentry_salvager' &&
          e.sentryTouchedUntil > this.time
        )
          core += 1;
        this.pickups.push({
          id: this.nextId++,
          x: e.x + 0.35,
          z: e.z - 0.2,
          value: core,
          kind: 'core'
        });
        if (this.rng.float() < 0.18)
          this.pickups.push({
            id: this.nextId++,
            x: e.x - 0.28,
            z: e.z + 0.18,
            value: 50,
            kind: 'heal'
          });
      }
    }
    this.ents = alive;
    for (const e of this.ents) if (e.kind !== 'binder') e.linkedTo = 0;
    for (const b of this.ents)
      if (b.kind === 'binder' && b.linkedTo) {
        const target = this.ents.find((e) => e.id === b.linkedTo);
        if (target) target.linkedTo = b.id;
      }
  }

  private checkProgression() {
    if (this.hasChoice) return;
    const unmutated = this.slots.filter(
      (id): id is SkillId => !!id && !this.skillState(id).mutation
    );
    if (this.mutationCores > 0 && unmutated.length) {
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
      if (this.level === 6 || this.level === 11 || this.level === 17) this.mutationCores++;
      if (this.isDiscoveryLevel(this.level) && this.skillOrderUnowned().length)
        this.generateDiscovery();
      else this.generateLevelOffers();
      this.events.push({ type: 'LevelUp', tick: this.tick, level: this.level });
    }
  }
  private nextXpNeed(level: number) {
    return Math.round(12 + level * 1.5 + Math.pow(level, 1.25) * 0.7);
  }
  private isDiscoveryLevel(level: number) {
    return [2, 4, 7, 10, 14].includes(level);
  }
  private skillOrderUnowned() {
    const owned = this.allOwnedSkills();
    return skillOrder.filter((id) => !owned.includes(id));
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
          eliteDamage: 'Урон по Elite',
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
      subtitle: `CORE AXIS ${before} → ${after}`,
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
        subtitle: `+${Math.round(18 * m)} максимального HP`,
        description: 'Универсальная выживаемость; не привязана к Phenomenon.',
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
        description: 'XP и pickups раньше летят к игроку.',
        stat,
        amount: 0.15 * m,
        rarity
      };
    if (stat === 'fortune')
      return {
        id: `g:f:${this.rng.nextU32()}`,
        kind: 'global',
        title: 'Фортуна',
        subtitle: `+${Math.round(8 * m)}% Fortune`,
        description: 'Усиливает контроль над будущими случайными находками.',
        stat,
        amount: 0.08 * m,
        rarity
      };
    return {
      id: `g:a:${this.rng.nextU32()}`,
      kind: 'global',
      title: 'Архивная броня',
      subtitle: `+${Math.round(10 * m)} Armor`,
      description: 'Diminishing-returns mitigation.',
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
  private makeCatalystAdd(id: CatalystId): RewardOffer {
    return {
      id: `addcat:${id}:${this.rng.nextU32()}`,
      kind: 'catalyst_add',
      title: catalysts[id].name,
      subtitle: `${catalysts[id].scope.toUpperCase()} · готовое правило`,
      description: catalysts[id].desc,
      catalyst: id
    };
  }
  private generateDiscovery() {
    const choices = this.shuffle(this.skillOrderUnowned()).slice(0, 3);
    this.rewardOffers = choices.map((id) => ({
      id: `discover:${id}:${this.rng.nextU32()}`,
      kind: 'skill_add',
      title: skills[id].name,
      subtitle: 'DISCOVERY · полноценный Phenomenon',
      description: `${skills[id].description} Сильная сторона: ${skills[id].identity ?? '—'} Слабость: ${skills[id].weakness ?? '—'} Базовая мощность автоматически соответствует текущему Core Rank.`,
      skill: id
    }));
    this.choiceSerial++;
  }
  private generateLevelOffers() {
    const ids = this.shuffle([...resonanceOrder]).slice(0, 3);
    this.rewardOffers = ids.map((id) => this.makeResonanceOffer(id));
    this.choiceSerial++;
  }
  private generateMutationTargetOffers() {
    const active = this.slots.filter((id): id is SkillId => !!id && !this.skillState(id).mutation);
    if (!active.length) return;
    this.rewardOffers = this.shuffle([...active])
      .slice(0, 3)
      .map((id) => ({
        id: `mut-target:${id}:${this.rng.nextU32()}`,
        kind: 'mutation_target',
        title: skills[id].name,
        subtitle: `MUTATION CORE · доступно ${this.mutationCores}`,
        description: `Эволюционировать ${skills[id].name}. Core принадлежит рану: если мутированный Phenomenon уйдёт в Архив, ядро вернётся.`,
        skill: id
      }));
    this.choiceSerial++;
  }
  private generateEliteCache() {
    const owned = this.allOwnedCatalysts(),
      unowned = catalystOrder.filter((id) => !owned.includes(id));
    let offers: RewardOffer[] = [];
    const hasSpace = this.catalystReserve.some((x) => !x) || this.catalysts.some((x) => !x);
    if (unowned.length && hasSpace) {
      offers = this.shuffle([...unowned])
        .slice(0, 3)
        .map((id) => {
          const o = this.makeCatalystAdd(id);
          o.kind = 'elite';
          o.subtitle = 'ELITE CACHE · новый закон связи';
          return o;
        });
    } else {
      offers = this.shuffle([...resonanceOrder])
        .slice(0, 2)
        .map((id) => {
          const o = this.makeResonanceOffer(id);
          o.kind = 'elite';
          o.description =
            'ELITE CACHE · усиление всей машины, а не конкретного оружия. ' + o.description;
          return o;
        });
      if (this.skillOrderUnowned().length) {
        const id = this.shuffle(this.skillOrderUnowned())[0];
        offers.push({
          id: `elite-discover:${id}:${this.rng.nextU32()}`,
          kind: 'elite',
          title: skills[id].name,
          subtitle: 'ELITE CACHE · альтернативный Phenomenon',
          description: `Полноценная поздняя находка текущего Core Rank. ${skills[id].description}`,
          skill: id
        });
      } else offers.push(this.makeGlobalOffer());
    }
    this.rewardOffers = offers.slice(0, 3);
    this.choiceSerial++;
  }
  private placeCatalyst(id: CatalystId) {
    let edge = this.catalysts.findIndex((c, i) => !c && !!this.slots[i] && !!this.slots[i + 1]);
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
  chooseReward(index: number) {
    const offer = this.rewardOffers?.[index];
    if (!offer) return false;
    this.rewardOffers = null;
    if (offer.kind === 'mutation_target' && offer.skill) {
      this.pendingMutationTarget = true;
      this.generateMutationOffer(offer.skill);
      return true;
    }
    if ((offer.kind === 'skill_add' || offer.kind === 'elite') && offer.skill) {
      if (!this.addSkill(offer.skill)) return false;
    } else if ((offer.kind === 'catalyst_add' || offer.kind === 'elite') && offer.catalyst) {
      if (!this.placeCatalyst(offer.catalyst)) return false;
    } else if ((offer.kind === 'resonance' || offer.kind === 'elite') && offer.resonance) {
      this.applyCoreAxis(offer.resonance, offer.amount ?? 1);
    } else this.applyGlobal(offer.stat, offer.amount ?? 0);
    this.events.push({ type: 'RewardChosen', tick: this.tick, title: offer.title });
    return true;
  }
  private applyCoreAxis(axis: ResonanceId, amount = 1) {
    this.resonance[axis] += amount;
    if (axis === 'mobility') this.moveSpeed *= 1 + 0.045 * amount;
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
  private generateMutationOffer(id: SkillId) {
    const curated: Partial<Record<SkillId, MutationId[]>> = {
      ember_lance: ['ember_volley', 'ember_furnace'],
      frost_ring: ['frost_front', 'frost_snap'],
      cleaver: ['cleaver_roundhouse', 'cleaver_rhythm'],
      chain_arc: ['arc_forked', 'arc_cage'],
      orbit_blades: ['orbit_outbound', 'orbit_guard'],
      mortar_bloom: ['mortar_cluster', 'mortar_crater'],
      sentry: ['sentry_gatling', 'sentry_rail'],
      mass_driver: ['mass_snowball', 'mass_rail']
    };
    const all = curated[id] ?? skills[id].mutations.map((m) => m.id);
    this.mutationOffer = {
      skill: id,
      choices: this.shuffle([...all]).slice(0, 2),
      refusalAvailable: false
    };
    this.choiceSerial++;
  }
  chooseMutation(index: number) {
    const m = this.mutationOffer;
    if (!m) return false;
    const id = m.choices[index];
    if (!id) return false;
    this.skillState(m.skill).mutation = id;
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
      cand = skills[m.skill].mutations.map((x) => x.id).filter((id) => !cur.has(id));
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
    this.rewardOffers = null;
    this.xp += this.xpNeed * 0.3;
    this.events.push({ type: 'RewardChosen', tick: this.tick, title: 'Пропуск награды' });
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
          st.mutation = null;
          this.mutationCores++;
        }
      }
    }
    A[a] = bv;
    B[b] = av;
    this.previousHits.clear();
    this.reservoirCharge = 0;
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
    this.skillReserve = [null, null, null];
    this.catalystReserve = [null, null, null, null];
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
        fortune: this.fortune
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
        linkedTo: e.linkedTo,
        revived: e.revived,
        buffed: e.buffUntil > this.time,
        shieldAngle: e.shieldAngle,
        regenerating: e.affix === 'regenerating' && this.time - e.lastDamageAt > 3,
        orderX: e.orderX,
        orderZ: e.orderZ,
        orderActive: e.orderUntil > this.time,
        adaptationStage: e.adaptStage,
        bossPhase: e.bossPhase,
        bossPattern: e.bossPattern,
        status: {
          marked: e.markUntil > this.time,
          ignited: e.igniteUntil > this.time,
          chilled: e.chillUntil > this.time,
          wounded: e.woundUntil > this.time,
          exposed: e.exposedUntil > this.time,
          embedded: e.embedded,
          toxined: e.toxinUntil > this.time
        }
      })),
      pickups: this.pickups.map((p) => ({ ...p })),
      fields: this.fields.map(
        (f) =>
          ({
            id: f.id,
            x: f.x,
            z: f.z,
            radius: f.radius,
            ttl: f.ttl,
            kind: f.kind
          }) as FieldSnapshot
      ),
      constructs: this.constructs.map((c) => ({
        id: c.id,
        x: c.x,
        z: c.z,
        ttl: c.ttl,
        range: c.range,
        kind: 'sentry'
      })),
      world: {
        ...this.world,
        pois: this.pois.map((p) => ({ ...p })),
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
      metrics: { ...this.metrics },
      eliteCore: this.eliteCore,
      mutationCores: this.mutationCores,
      rewardOffers: this.rewardOffers ? this.rewardOffers.map((o) => ({ ...o })) : null,
      mutationOffer: this.mutationOffer
        ? {
            skill: this.mutationOffer.skill,
            choices: [...this.mutationOffer.choices],
            refusalAvailable: this.mutationOffer.refusalAvailable
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
  static readonly CANONICAL_SCHEMA_VERSION = 2;

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
    put('player.xp', this.level, this.xp, this.xpNeed);

    put('chain.beat', this.beat, this.cycle);
    put('chain.charges', this.capacitorCharge, this.overflowCharge, this.aegisCharge);

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
        s.mutation
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
        e.orderUntil
      );

    const m = this.metrics;
    put('metrics.population', m.spawned, m.killed, m.maxEnemies);
    put('metrics.elites', m.eliteSpawned, m.eliteKilled);
    put('metrics.output', m.damage, m.reactions);
    put('metrics.progression', m.levels, m.mutations);
    put('metrics.survival', m.damageTaken, m.healingReceived, m.barrierGenerated, m.healsPicked);

    return parts;
  }

  canonicalHash() {
    return fnv1a(this.canonicalState());
  }
}
