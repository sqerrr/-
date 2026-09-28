import { makeEnt, type Ent, type Poi } from './state.js';
import type {
  EliteAffix,
  EliteChassis,
  EliteRarity,
  PoiKind,
  RunMode
} from './types.js';

const RARITY_HP: Record<EliteRarity, number> = {
  common: 2.5,
  uplifted: 5,
  legendary: 9.4
};

const RARITY_SIZE: Record<EliteRarity, number> = {
  common: 1,
  uplifted: 1.1,
  legendary: 1.25
};

const BASE_HP: Record<EliteChassis, number> = {
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

/** Hero base move speed; elite pace is authored relative to it. */
export const HERO_BASE_SPEED = 4.8;

/**
 * Elites used to walk at 0.15-0.37 of hero speed, so every pattern could be kited forever.
 * Regular chassis now move at 0.75-0.9 of the hero; the Predator is faster than the hero.
 */
const SPEED: Record<EliteChassis, number> = {
  marshal: HERO_BASE_SPEED * 0.83,
  hunter: HERO_BASE_SPEED * 1.28,
  bulwark: HERO_BASE_SPEED * 0.75,
  architect: HERO_BASE_SPEED * 0.8,
  harvester: HERO_BASE_SPEED * 0.86,
  shepherd: HERO_BASE_SPEED * 0.9,
  broodmaker: HERO_BASE_SPEED * 0.78,
  archivist: HERO_BASE_SPEED * 0.83,
  warden: HERO_BASE_SPEED * 0.66
};

/** Hard pace ceiling after relic/axis growth (Predator keeps a higher one). */
export function eliteSpeedCap(entity: { chassis?: EliteChassis; affix: EliteAffix }) {
  const fast = entity.chassis === 'hunter' || entity.affix === 'swift';
  return HERO_BASE_SPEED * (fast ? 1.75 : 1.3);
}

/** «Быстрый» must be unmistakable: +45% pace on top of the chassis. */
export const SWIFT_SPEED_MUL = 1.45;

/** Replicator copies carry more of the original's body as rarity rises (up to a full copy). */
const CLONE_HP_SHARE: Record<EliteRarity, number> = {
  common: 0.3,
  uplifted: 0.6,
  legendary: 1
};

/** Affixes that describe the body and therefore carry over to Replicator copies. */
const CLONE_BODY_AFFIXES: ReadonlySet<EliteAffix> = new Set<EliteAffix>([
  'swift',
  'shielded',
  'regenerating'
]);

export const CLONE_CAP: Record<EliteRarity, number> = {
  common: 2,
  uplifted: 3,
  legendary: 3
};

const CONTACT_DPS: Record<EliteChassis, number> = {
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

const REGULAR_CHASSIS: EliteChassis[] = [
  'hunter',
  'architect',
  'broodmaker',
  'bulwark',
  'harvester',
  'shepherd'
];

export interface EliteSpawnPort {
  time(): number;
  runDuration(): number;
  mode(): RunMode;
  playerX(): number;
  playerZ(): number;
  worldBounds(): { minX: number; maxX: number; minZ: number; maxZ: number };
  randomInt(maxExclusive: number): number;
  randomFloat(): number;
  randomRange(min: number, max: number): number;
  worldScale(): number;
  /** Time-of-run HP curve for regular elites (EncounterDirector.eliteHealthCurve). */
  eliteHealthCurve(): number;
  damageScale(): number;
  nextEntityId(): number;
  pointAroundPlayer(min: number, max: number): { x: number; z: number };
  claimRepertoire(entity: Ent): void;
  inheritLegacy(entity: Ent, all?: boolean): void;
  inheritEvolution(entity: Ent): void;
  grantNativeGrowth(entity: Ent): void;
  ecosystemMass(): number;
  pois(): readonly Poi[];
  activePoiGuardians(): number;
  commitElite(
    entity: Ent,
    options: { trackEncounter: boolean; bossEvent: boolean }
  ): void;
  emitBossSpawned(entity: Ent, supports: number, uncleared: number): void;
}

/**
 * Owns elite entity construction and spawn-time identity.
 *
 * EncounterDirector remains the pacing owner. This system owns chassis/rarity/affix rolls,
 * body/combat stats, inherited ecosystem growth, Warden construction and visible boss support.
 */
export class EliteSpawnSystem {
  constructor(private readonly port: EliteSpawnPort) {}

  spawnRegular(opening = false) {
    const p = this.port;
    const chassis = REGULAR_CHASSIS[p.randomInt(REGULAR_CHASSIS.length)];
    const rarity: EliteRarity = opening ? 'common' : this.rollRarity();
    const affix: EliteAffix = opening ? 'none' : this.rollAffix(rarity);
    const point = p.pointAroundPlayer(15, 18.5);

    let hp = BASE_HP[chassis] * p.worldScale() * p.eliteHealthCurve() * RARITY_HP[rarity];
    if (opening && p.mode() === 'clean') hp *= 0.8;

    const entity = makeEnt({
      id: p.nextEntityId(),
      kind: 'elite',
      x: point.x,
      z: point.z,
      hp,
      radius:
        (chassis === 'bulwark'
          ? 1.02
          : chassis === 'broodmaker'
            ? 0.94
            : 0.86) * RARITY_SIZE[rarity],
      speed: SPEED[chassis],
      // Elites now keep pace with the hero, so contact is pressure, not the main threat:
      // authored patterns carry the burst damage.
      contactDps: CONTACT_DPS[chassis] * p.damageScale() * 0.4,
      cooldown: p.randomRange(1.7, 3.0),
      chassis,
      affix,
      adaptAt: hp * 0.6,
      rarity
    });

    if (affix === 'swift') entity.speed *= SWIFT_SPEED_MUL;
    if (!opening) {
      p.claimRepertoire(entity);
      p.inheritLegacy(entity);
      p.grantNativeGrowth(entity);
    }
    if (affix === 'shielded') this.armShield(entity);
    entity.speed = Math.min(entity.speed, eliteSpeedCap(entity));

    p.commitElite(entity, { trackEncounter: true, bossEvent: false });
    return entity;
  }

  /**
   * Replicator copy: same chassis/affix/rarity body, a rarity-scaled share of the original's
   * max HP, no repertoire and no rewards. The copy dies with its original.
   */
  spawnClone(parent: Ent) {
    const p = this.port;
    const angle = p.randomRange(0, Math.PI * 2);
    const world = p.worldBounds();
    const x = Math.max(world.minX + 1, Math.min(world.maxX - 1, parent.x + Math.cos(angle) * 2.2));
    const z = Math.max(world.minZ + 1, Math.min(world.maxZ - 1, parent.z + Math.sin(angle) * 2.2));
    const hp = parent.maxHp * CLONE_HP_SHARE[parent.rarity];
    const entity = makeEnt({
      id: p.nextEntityId(),
      kind: 'elite',
      cloneParent: parent.id,
      x,
      z,
      hp,
      radius: parent.radius * 0.92,
      speed: parent.speed * 1.08,
      contactDps: parent.contactDps * 0.75,
      cooldown: p.randomRange(0.6, 1.4),
      chassis: parent.chassis,
      // Copies inherit the body (speed, shield, regeneration) but not the original's attack
      // affix, so the true Replicator stays the only source of temporal/volatile/vanguard.
      affix: CLONE_BODY_AFFIXES.has(parent.affix) ? parent.affix : 'none',
      adaptAt: -1,
      rarity: parent.rarity,
      growth: parent.growth ?? 0
    });
    if (entity.affix === 'shielded') this.armShield(entity);
    p.commitElite(entity, { trackEncounter: false, bossEvent: false });
    return entity;
  }

  spawnBoss() {
    const p = this.port;
    const x = p.playerX() < 0 ? 34 : -34;
    const z = p.playerZ() < 0 ? 24 : -24;
    const hp =
      BASE_HP.warden *
      p.worldScale() *
      (4.15 + Math.min(1.55, p.ecosystemMass() * 0.035));

    const entity = makeEnt({
      id: p.nextEntityId(),
      kind: 'elite',
      x,
      z,
      hp,
      radius: 1.42,
      speed: SPEED.warden,
      contactDps: CONTACT_DPS.warden * p.damageScale() * 1.22,
      cooldown: 1.8,
      chassis: 'warden',
      boss: true,
      bossPhase: 1,
      rarity: 'legendary'
    });

    // The finale inherits the complete enemy ecosystem built during the run.
    p.claimRepertoire(entity);
    p.inheritLegacy(entity, true);
    p.inheritEvolution(entity);
    p.commitElite(entity, { trackEncounter: false, bossEvent: true });

    const unresolved = p.pois().filter((poi) => poi.state !== 'cleared');
    const cleared = p.pois().length - unresolved.length;
    const desiredSupports = cleared >= 4 ? 0 : cleared >= 2 ? 1 : 2;
    const activeGuardians = p.activePoiGuardians();

    let spawned = 0;
    for (const poi of unresolved) {
      if (activeGuardians + spawned >= desiredSupports) break;
      if (poi.state === 'guarded') continue;
      this.spawnBossSupport(poi.kind, x, z, spawned);
      spawned++;
    }

    const supports = Math.min(desiredSupports, activeGuardians + spawned);
    p.emitBossSpawned(entity, supports, unresolved.length);
    return entity;
  }

  spawnBossSupport(
    kind: PoiKind,
    bossX: number,
    bossZ: number,
    index: number
  ) {
    const p = this.port;
    const [chassis, affix] = this.supportIdentity(kind);
    const angle = 0.8 + index * Math.PI * 0.88;
    const radius = 3.2 + index * 0.55;
    const world = p.worldBounds();
    const x = Math.max(
      world.minX + 1,
      Math.min(world.maxX - 1, bossX + Math.cos(angle) * radius)
    );
    const z = Math.max(
      world.minZ + 1,
      Math.min(world.maxZ - 1, bossZ + Math.sin(angle) * radius)
    );
    const hp = BASE_HP[chassis] * p.worldScale() * 0.66;

    const entity = makeEnt({
      id: p.nextEntityId(),
      kind: 'elite',
      x,
      z,
      hp,
      radius: chassis === 'bulwark' ? 1.02 : 0.9,
      speed: SPEED[chassis],
      contactDps: CONTACT_DPS[chassis] * p.damageScale(),
      cooldown: p.randomRange(1.3, 2.5),
      chassis,
      affix,
      adaptAt: hp * 0.55,
      guardianPoi: -1
    });
    if (affix === 'shielded') this.armShield(entity);

    p.commitElite(entity, { trackEncounter: false, bossEvent: false });
    return entity;
  }

  /** Shielded elites carry an absorbing pool worth 60% of their body (RoR2 Overloading-like). */
  armShield(entity: Ent) {
    entity.shieldMax = entity.maxHp * 0.6;
    entity.shieldHp = entity.shieldMax;
  }

  rollRarity(): EliteRarity {
    const progress = Math.min(1, this.port.time() / this.port.runDuration());
    const roll = this.port.randomFloat();

    if (roll < 0.02 + 0.18 * progress) return 'legendary';
    if (roll < 0.2 + 0.45 * progress) return 'uplifted';
    return 'common';
  }

  rollAffix(rarity: EliteRarity): EliteAffix {
    const progress = Math.min(1, this.port.time() / this.port.runDuration());

    // The opening teaches chassis language before affix combinations appear.
    if (progress < 0.12) return 'none';

    if (rarity === 'common') {
      if (this.port.randomFloat() < 0.58 - progress * 0.18) return 'none';
      const pool: EliteAffix[] = ['regenerating', 'volatile', 'shielded', 'swift'];
      return pool[this.port.randomInt(pool.length)];
    }

    if (rarity === 'uplifted') {
      if (this.port.randomFloat() < 0.12) return 'none';
      const pool: EliteAffix[] = [
        'regenerating',
        'shielded',
        'vanguard',
        'temporal',
        'brood',
        'swift'
      ];
      return pool[this.port.randomInt(pool.length)];
    }

    const pool: EliteAffix[] = [
      'crowned',
      'shielded',
      'vanguard',
      'temporal',
      'brood'
    ];
    return pool[this.port.randomInt(pool.length)];
  }

  supportIdentity(kind: PoiKind): [EliteChassis, EliteAffix] {
    if (kind === 'phenomenon') return ['hunter', 'shielded'];
    if (kind === 'catalyst') return ['architect', 'vanguard'];
    if (kind === 'resonance') return ['bulwark', 'temporal'];
    return ['harvester', 'brood'];
  }
}
