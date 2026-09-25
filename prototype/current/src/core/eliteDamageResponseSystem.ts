import type { Ent } from './state.js';
import type { EliteOrderId, SkillId } from './types.js';

interface DamageSample {
  t: number;
  source: string;
  amount: number;
  derived: boolean;
}

export interface EliteDamageResponsePort {
  time(): number;
  conductivity(): number;
  corePower(): number;
  spawnReplicant(entity: Ent): void;
  emitOrder(entity: Ent, order: EliteOrderId, count?: number): void;
}

/**
 * Reactive elite-chassis rules that answer hero damage.
 *
 * Active movement/attack patterns stay in EliteBehaviorSystem. This system owns the other half
 * of chassis identity: how an elite adapts when damage actually resolves. It also owns the short
 * rolling damage signature used by Shepherd, so Simulation no longer stores adaptation telemetry.
 */
export class EliteDamageResponseSystem {
  private readonly samples: DamageSample[] = [];

  constructor(private readonly port: EliteDamageResponsePort) {}

  beforeDamage(
    entity: Ent,
    damage: number,
    skill: SkillId | null,
    derived: boolean
  ): number {
    if (entity.kind !== 'elite' || entity.boss) return damage;

    const p = this.port;

    if (entity.chassis === 'bulwark' && (skill || derived)) {
      const key = skill ?? 'derived';
      if (!entity.prismMemory) {
        entity.prismMemory = key;
        p.emitOrder(entity, 'prism');
      } else if (entity.prismMemory === key) {
        damage *= 0.28;
      } else {
        entity.prismMemory = key;
        damage *= 1.34;
        entity.exposedUntil = p.time() + 0.45;
      }
    }

    if (entity.chassis === 'harvester') {
      if (derived) {
        damage *= 0.38;
        entity.adaptStage = Math.min(5, entity.adaptStage + 1);
        p.emitOrder(entity, 'null', entity.adaptStage);
      } else if (skill && entity.adaptStage > 0) {
        entity.adaptStage--;
        damage *= 1.24;
      }
    }

    if (entity.chassis === 'broodmaker' && (skill || derived)) {
      entity.affixPulse++;
      const threshold = Math.max(5, 8 - p.conductivity());
      if (entity.affixPulse >= threshold) {
        entity.affixPulse = 0;
        p.spawnReplicant(entity);
      }
    }

    if (
      entity.chassis === 'shepherd' &&
      !entity.shepherdMode &&
      entity.hp - damage <= entity.maxHp * 0.68
    ) {
      const recent = this.samples.filter((sample) => sample.t >= p.time() - 5);
      const sum = recent.reduce((total, sample) => total + sample.amount, 0);
      const derivedDamage = recent.reduce(
        (total, sample) => total + (sample.derived ? sample.amount : 0),
        0
      );
      const rate = recent.length / 5;
      const average = recent.length ? sum / recent.length : 0;

      entity.shepherdMode =
        derivedDamage / Math.max(1, sum) > 0.42
          ? 'null'
          : rate > 9
            ? 'condensed'
            : average > 95 * p.corePower()
              ? 'fractured'
              : 'migratory';

      if (entity.shepherdMode === 'fractured')
        for (let i = 0; i < 3; i++) p.spawnReplicant(entity);

      p.emitOrder(entity, 'metamorph', recent.length);
    }

    if (entity.chassis === 'shepherd' && entity.shepherdMode === 'null' && derived)
      damage *= 0.48;

    return damage;
  }

  noteResolvedDamage(source: string, amount: number, derived: boolean) {
    const now = this.port.time();
    this.samples.push({ t: now, source, amount, derived });
    while (this.samples.length && this.samples[0].t < now - 12) this.samples.shift();
  }

  diagnostics() {
    return this.samples.map((sample) => ({ ...sample }));
  }
}
