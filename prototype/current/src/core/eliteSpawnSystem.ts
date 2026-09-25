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

const SPEED: Record<EliteChassis, number> = {
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

    let hp = BASE_HP[chassis] * p.worldScale() * RARITY_HP[rarity];
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
      contactDps: CONTACT_DPS[chassis] * p.damageScale() * 0.62,
      cooldown: p.randomRange(1.7, 3.0),
      chassis,
      affix,
      adaptAt: hp * 0.6,
      rarity
    });

    if (!opening) {
      p.claimRepertoire(entity);
      p.inheritLegacy(entity);
      p.grantNativeGrowth(entity);
    }

    p.commitElite(entity, { trackEncounter: true, bossEvent: false });
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

  private spawnBossSupport(
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

    p.commitElite(entity, { trackEncounter: false, bossEvent: false });
    return entity;
  }

  private rollRarity(): EliteRarity {
    const progress = Math.min(1, this.port.time() / this.port.runDuration());
    const roll = this.port.randomFloat();

    if (roll < 0.02 + 0.18 * progress) return 'legendary';
    if (roll < 0.2 + 0.45 * progress) return 'uplifted';
    return 'common';
  }

  private rollAffix(rarity: EliteRarity): EliteAffix {
    const progress = Math.min(1, this.port.time() / this.port.runDuration());

    // The opening teaches chassis language before affix combinations appear.
    if (progress < 0.12) return 'none';

    if (rarity === 'common') {
      if (this.port.randomFloat() < 0.58 - progress * 0.18) return 'none';
      const pool: EliteAffix[] = ['regenerating', 'volatile', 'shielded'];
      return pool[this.port.randomInt(pool.length)];
    }

    if (rarity === 'uplifted') {
      if (this.port.randomFloat() < 0.12) return 'none';
      const pool: EliteAffix[] = [
        'regenerating',
        'shielded',
        'vanguard',
        'temporal',
        'brood'
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

  private supportIdentity(kind: PoiKind): [EliteChassis, EliteAffix] {
    if (kind === 'phenomenon') return ['hunter', 'shielded'];
    if (kind === 'catalyst') return ['architect', 'vanguard'];
    if (kind === 'resonance') return ['bulwark', 'temporal'];
    return ['harvester', 'brood'];
  }
}
