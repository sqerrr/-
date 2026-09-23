import type { DelayedStrike, Ent, Field, Pickup } from './state.js';
import type {
  EliteAffix,
  EliteRarity,
  GameEvent,
  MutationId,
  RunMode,
  SkillId
} from './types.js';

const ELITE_RARITY_CORE: Record<EliteRarity, number> = {
  common: 1,
  uplifted: 2,
  legendary: 3
};

const ELITE_AFFIX_THREAT: Record<EliteAffix, number> = {
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

export interface DeathResolutionPort {
  time(): number;
  tick(): number;
  mode(): RunMode;
  entities(): readonly Ent[];

  clearForRevive(entity: Ent): void;
  hasMutation(skill: SkillId, mutation: MutationId): boolean;
  memoryFactor(): number;

  noteKill(elite: boolean): void;
  resolveEliteDeath(entity: Ent): void;
  emit(event: GameEvent): void;
  markBossDefeated(): void;

  getAliveEntity(id: number): Ent | undefined;
  addField(field: Omit<Field, 'id'>): void;
  scheduleStrike(strike: Omit<DelayedStrike, 'id'>): void;
  addPickup(pickup: Omit<Pickup, 'id'>): void;

  damageScale(): number;
  xpMultiplier(): number;
  ownedCatalystCount(): number;
  completePoi(id: number): void;
  randomFloat(): number;
}

/**
 * Resolves combat-entity death consequences in deterministic iteration order.
 *
 * Simulation still owns run economy, RNG streams, POIs, metrics and entity identity. This system
 * owns the policy that turns a dead entity into revive/death events, contagion, hostile aftermath
 * and pickups.
 */
export class DeathResolutionSystem {
  constructor(private readonly port: DeathResolutionPort) {}

  resolve(entities: readonly Ent[]): Ent[] {
    const p = this.port;
    const time = p.time();
    const alive: Ent[] = [];

    for (const entity of entities) {
      if (entity.hp > 0) {
        alive.push(entity);
        continue;
      }

      if (entity.kind === 'palimpsest' && entity.revivesLeft > 0) {
        entity.revivesLeft--;
        entity.revived = true;
        entity.hp = entity.maxHp * 0.42;
        entity.speed *= 1.32;
        p.clearForRevive(entity);
        alive.push(entity);
        p.emit({
          type: 'EnemyRevived',
          tick: p.tick(),
          entity: entity.id,
          x: entity.x,
          z: entity.z
        });
        continue;
      }

      if (
        entity.toxinUntil > time &&
        p.hasMutation('toxic_mist', 'toxic_contagion')
      ) {
        for (const other of p.entities()) {
          if (
            other !== entity &&
            other.hp > 0 &&
            Math.hypot(other.x - entity.x, other.z - entity.z) < 2.8
          ) {
            other.toxinUntil = Math.max(
              other.toxinUntil,
              time + 2.8 * p.memoryFactor()
            );
            other.toxinDps = Math.max(
              other.toxinDps,
              Math.max(5, entity.toxinDps * 0.72)
            );
          }
        }
      }

      const elite = entity.kind === 'elite';
      p.noteKill(elite);
      if (elite) p.resolveEliteDeath(entity);

      p.emit({
        type: 'EntityDied',
        tick: p.tick(),
        entity: entity.id,
        kind: entity.kind,
        x: entity.x,
        z: entity.z,
        elite,
        boss: entity.boss
      });

      if (entity.boss) {
        p.markBossDefeated();
        continue;
      }

      if (entity.cloneParent) {
        const parent = p.getAliveEntity(entity.cloneParent);
        if (parent) {
          const feedback = parent.maxHp * 0.055;
          parent.hp -= feedback;
          p.emit({
            type: 'DamageResolved',
            tick: p.tick(),
            entity: parent.id,
            amount: feedback,
            source: 'replicant_feedback',
            x: parent.x,
            z: parent.z,
            sourceX: entity.x,
            sourceZ: entity.z,
            elite: true,
            crit: false
          });
        }
        continue;
      }

      if (entity.kind === 'inkblot') {
        p.addField({
          x: entity.x,
          z: entity.z,
          radius: 1.75,
          ttl: 3.3,
          kind: 'ink',
          dps: 11 * p.damageScale(),
          tickAcc: 0
        });
      }

      if (elite && entity.affix === 'volatile') {
        p.scheduleStrike({
          at: time + 0.62,
          x: entity.x,
          z: entity.z,
          radius: 2.6,
          damage: 24 * p.damageScale(),
          faction: 'rival',
          ownerId: entity.id,
          source: 'elite_volatile',
          sourceSlot: -1,
          intent: 'damage',
          telegraph: 'elite_volatile_tell'
        });
      }

      const xpValue =
        elite
          ? 30
          : entity.kind === 'binder' ||
              entity.kind === 'redactor' ||
              entity.kind === 'indexer'
            ? 4.0
            : entity.kind === 'marginwalker'
              ? 3.0
              : entity.kind === 'bookmark'
                ? 2.5
                : entity.kind === 'footnote'
                  ? 2.1
                  : entity.kind === 'inkblot'
                    ? 2.4
                    : 1.8;

      p.addPickup({
        x: entity.x,
        z: entity.z,
        value: xpValue * p.xpMultiplier(),
        kind: 'xp'
      });

      if (elite && entity.guardianPoi > 0) {
        p.completePoi(entity.guardianPoi);
        continue;
      }
      if (elite && entity.guardianPoi < 0) continue;

      if (elite) {
        if (entity.rarity === 'uplifted' || entity.rarity === 'legendary') {
          p.addPickup({
            x: entity.x + 0.12,
            z: entity.z + 0.34,
            value: 1,
            kind: 'mutation'
          });
        }

        const threat = ELITE_AFFIX_THREAT[entity.affix];
        let core = 2 + (threat >= 2 ? 1 : 0) + (threat >= 4 ? 1 : 0);

        if (p.mode() === 'clean' && p.ownedCatalystCount() === 0)
          core = Math.max(core, 5);

        if (
          p.hasMutation('sentry', 'sentry_salvager') &&
          entity.sentryTouchedUntil > time
        )
          core += 1;

        p.addPickup({
          x: entity.x + 0.35,
          z: entity.z - 0.2,
          value: Math.round(core * ELITE_RARITY_CORE[entity.rarity]),
          kind: 'core'
        });

        if (p.randomFloat() < 0.18) {
          p.addPickup({
            x: entity.x - 0.28,
            z: entity.z + 0.18,
            value: 50,
            kind: 'heal'
          });
        }
      }
    }

    return alive;
  }
}
