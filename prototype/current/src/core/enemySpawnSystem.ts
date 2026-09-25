import { makeEnt, type Ent } from './state.js';
import type { EnemyKind } from './types.js';

export type NormalEnemyKind = Exclude<EnemyKind, 'elite' | 'hero'>;

const BASE_HP: Record<NormalEnemyKind, number> = {
  footnote: 42,
  bookmark: 63,
  binder: 101,
  redactor: 92,
  palimpsest: 84,
  indexer: 97,
  inkblot: 55,
  marginwalker: 76
};

const SPEED: Record<NormalEnemyKind, number> = {
  footnote: 1.23,
  bookmark: 1.32,
  binder: 0.91,
  redactor: 0.98,
  palimpsest: 1.17,
  indexer: 0.96,
  inkblot: 1.14,
  marginwalker: 1.64
};

const CONTACT_DPS: Record<NormalEnemyKind, number> = {
  footnote: 14,
  bookmark: 19,
  binder: 12,
  redactor: 13,
  palimpsest: 14,
  indexer: 13,
  inkblot: 15,
  marginwalker: 16
};

export interface EnemySpawnPort {
  time(): number;
  randomRange(min: number, max: number): number;
  worldScale(): number;
  damageScale(): number;
  populationTarget(): number;
  normalCount(): number;
  nextEntityId(): number;
  pointAroundPlayer(min: number, max: number): { x: number; z: number };
  addEntity(entity: Ent): void;
  onSpawn(entity: Ent): void;
}

/**
 * Owns construction and admission rules for ordinary enemies.
 *
 * EncounterDirector decides WHEN and WHICH kind should spawn. This system decides whether the
 * world may admit it and constructs the entity with the authored per-kind body/combat stats.
 */
export class EnemySpawnSystem {
  constructor(private readonly port: EnemySpawnPort) {}

  spawn(kind: NormalEnemyKind) {
    const point = this.port.pointAroundPlayer(13.5, 19.5);
    return this.spawnAt(kind, point.x, point.z);
  }

  spawnAt(
    kind: NormalEnemyKind,
    x: number,
    z: number,
    buffedFor = 0,
    cloneParent = 0
  ) {
    const normalCount = this.port.normalCount();
    if (normalCount >= 198) return undefined;
    if (
      buffedFor > 0 &&
      normalCount >= Math.min(180, this.port.populationTarget() + 18)
    )
      return undefined;

    const hp = BASE_HP[kind] * this.port.worldScale();
    const entity = makeEnt({
      id: this.port.nextEntityId(),
      kind,
      cloneParent: cloneParent || undefined,
      x,
      z,
      hp,
      radius:
        kind === 'binder' || kind === 'redactor' || kind === 'indexer'
          ? 0.58
          : 0.46,
      speed: SPEED[kind],
      contactDps: CONTACT_DPS[kind] * this.port.damageScale() * 0.42,
      cooldown: this.port.randomRange(0.3, 1.9),
      revivesLeft: kind === 'palimpsest' ? 1 : 0,
      buffUntil: buffedFor > 0 ? this.port.time() + buffedFor : 0
    });

    this.port.addEntity(entity);
    this.port.onSpawn(entity);
    return entity;
  }
}
