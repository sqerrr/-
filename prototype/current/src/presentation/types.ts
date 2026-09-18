import type {
  CatalystId,
  CombatShape,
  EliteChassis,
  EnemyKind,
  GameEvent,
  SkillId,
  SnapshotEntity
} from '../core/types.js';

export type PresentationCue =
  | {
      type: 'skillCast';
      time: number;
      skill: SkillId;
      x: number;
      z: number;
      aimX: number;
      aimZ: number;
    }
  | {
      type: 'combatShape';
      time: number;
      source: string;
      shape: CombatShape;
      intent: 'damage' | 'control' | 'field';
    }
  | {
      type: 'catalyst';
      time: number;
      catalyst: CatalystId;
      fromSlot: number;
      toSlot: number;
      sourceX: number;
      sourceZ: number;
      targetX: number;
      targetZ: number;
    }
  | {
      type: 'damage';
      time: number;
      entity: number;
      amount: number;
      source: string;
      x: number;
      z: number;
      sourceX: number;
      sourceZ: number;
      elite: boolean;
      crit: boolean;
      target?: SnapshotEntity;
    }
  | { type: 'death'; time: number; entity: number; x: number; z: number; elite: boolean }
  | {
      type: 'reaction';
      time: number;
      reaction: 'thermal_shock' | 'detonation' | 'conduit' | 'echo' | 'aegis';
      x: number;
      z: number;
      amount?: number;
    }
  | { type: 'eliteSpawn'; time: number; x: number; z: number; chassis?: EliteChassis }
  | { type: 'playerHit'; time: number; amount: number; x: number; z: number }
  | {
      type: 'eliteOrder';
      time: number;
      x: number;
      z: number;
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
      count?: number;
    };

export interface HitVisual {
  entity: number;
  start: number;
  ttl: number;
  x: number;
  z: number;
  radius: number;
  dirX: number;
  dirZ: number;
  intensity: number;
  elite: boolean;
  crit: boolean;
}

export interface DeathVisual {
  entity: number;
  start: number;
  ttl: number;
  x: number;
  z: number;
  dirX: number;
  dirZ: number;
  actor: SnapshotEntity;
}

export interface PresentationFrame {
  time: number;
  hits: readonly HitVisual[];
  deaths: readonly DeathVisual[];
}

export function isPresentationRelevantEvent(e: GameEvent) {
  return (
    e.type === 'SkillActivated' ||
    e.type === 'CombatShape' ||
    e.type === 'CatalystTriggered' ||
    e.type === 'DamageResolved' ||
    e.type === 'Reaction' ||
    e.type === 'EntitySpawned' ||
    e.type === 'EntityDied' ||
    e.type === 'PlayerHit' ||
    e.type === 'EliteOrder'
  );
}

export function fallbackDeadActor(e: Extract<GameEvent, { type: 'EntityDied' }>): SnapshotEntity {
  return {
    id: e.entity,
    kind: e.kind as EnemyKind,
    x: e.x,
    z: e.z,
    hp: 0,
    maxHp: 1,
    radius: e.elite ? 0.8 : 0.42,
    elite: e.elite,
    boss: !!e.boss,
    guardianPoi: 0,
    chassis: e.elite ? 'marshal' : undefined,
    affix: e.elite ? 'none' : undefined,
    facingX: 1,
    facingZ: 0,
    telegraph: 0,
    linkedTo: 0,
    revived: false,
    buffed: false,
    shieldAngle: 0,
    regenerating: false,
    orderX: 0,
    orderZ: 0,
    orderActive: false,
    adaptationStage: 0,
    bossPhase: 0,
    bossPattern: '',
    status: {
      marked: false,
      ignited: false,
      chilled: false,
      wounded: false,
      exposed: false,
      embedded: 0,
      toxined: false
    }
  };
}
