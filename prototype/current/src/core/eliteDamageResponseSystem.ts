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
  corePower(): number;
  /** Replicator copy of the elite itself (bounded by the owner's rarity cap). */
  spawnClone(entity: Ent): void;
  /** Heavy retinue around the elite. */
  spawnRetinue(entity: Ent, count: number): void;
  /** One visible growth tier (body size). */
  grow(entity: Ent): void;
  emitOrder(entity: Ent, order: EliteOrderId, count?: number): void;
  announce(entity: Ent, title: string, detail: string): void;
}

const PRISM_DECAY = 0.7;
const PRISM_DOMINANT_SHARE = 0.34;

/**
 * Reactive elite-chassis rules that answer hero damage.
 *
 * Active movement/attack patterns stay in EliteBehaviorSystem. This system owns the other half
 * of chassis identity: how an elite adapts when damage actually resolves. It also owns the short
 * rolling damage signature used by Shepherd, so Simulation no longer stores adaptation telemetry.
 *
 * Every adaptation is announced and grows the body, so the player can see what the elite learned.
 */
export class EliteDamageResponseSystem {
  static readonly BROOD_THRESHOLD = 10;
  static readonly CLONE_SPACING = 3;
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
    const time = p.time();

    if (entity.chassis === 'bulwark' && (skill || derived)) {
      // PRISM resists whatever currently carries the fight: the dominant recent source is
      // cut to 30%, so one-trick builds must bring a second damage channel.
      const key = skill ?? 'derived';
      const ledger = (entity.prismLedger ??= {});
      const last = ledger.__t ?? time;
      const decay = Math.exp(-(time - last) * PRISM_DECAY);
      let total = 0;
      for (const k of Object.keys(ledger)) {
        if (k === '__t') continue;
        ledger[k] *= decay;
        total += ledger[k];
      }
      ledger.__t = time;
      const share = total > 0 ? (ledger[key] ?? 0) / total : 1;
      ledger[key] = (ledger[key] ?? 0) + damage;
      if (share >= PRISM_DOMINANT_SHARE) {
        if (entity.prismMemory !== key) {
          entity.prismMemory = key;
          p.emitOrder(entity, 'prism');
        }
        damage *= 0.3;
      }
    }

    if (entity.chassis === 'harvester') {
      if (derived) {
        damage *= 0.3;
        const before = entity.adaptStage;
        entity.adaptStage = Math.min(5, entity.adaptStage + 1);
        p.emitOrder(entity, 'null', entity.adaptStage);
        if (before < 5 && entity.adaptStage === 5) {
          p.grow(entity);
          entity.buffUntil = Math.max(entity.buffUntil, time + 5);
          p.announce(entity, 'НУЛЬ-ТКАЧ НАСЫТИЛСЯ', 'Поглотил срабатывания катализаторов: ярость 5 с. Бей прямыми тактами.');
        }
      } else if (skill && entity.adaptStage > 0) {
        entity.adaptStage--;
        damage *= 1.25;
      }
    }

    if (entity.chassis === 'broodmaker' && !entity.cloneParent && (skill || derived)) {
      entity.broodHits = (entity.broodHits ?? 0) + 1;
      if (
        entity.broodHits >= EliteDamageResponseSystem.BROOD_THRESHOLD &&
        time >= (entity.cloneReadyAt ?? 0)
      ) {
        entity.broodHits = 0;
        entity.cloneReadyAt = time + EliteDamageResponseSystem.CLONE_SPACING;
        p.spawnClone(entity);
      }
    }

    if (
      entity.chassis === 'shepherd' &&
      !entity.shepherdMode &&
      entity.hp - damage <= entity.maxHp * 0.68
    ) {
      const recent = this.samples.filter((sample) => sample.t >= time - 5);
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

      p.grow(entity);
      if (entity.shepherdMode === 'fractured') {
        p.spawnRetinue(entity, 4);
        p.announce(entity, 'МЕТАМОРФ: РАСКОЛ', 'Тяжёлые удары расщепили его: 4 тяжёлых спутника.');
      } else if (entity.shepherdMode === 'condensed') {
        entity.speed *= 1.25;
        entity.contactDps *= 1.4;
        p.announce(entity, 'МЕТАМОРФ: СГУСТОК', 'Частые попадания: быстрее и бьёт сильнее при касании.');
      } else if (entity.shepherdMode === 'null') {
        p.announce(entity, 'МЕТАМОРФ: НУЛЬ', 'Производный урон по нему режется до 35%.');
      } else {
        entity.speed *= 1.12;
        p.announce(entity, 'МЕТАМОРФ: МИГРАЦИЯ', 'Обходит по флангу и уводит стаю.');
      }

      p.emitOrder(entity, 'metamorph', recent.length);
    }

    if (entity.chassis === 'shepherd' && entity.shepherdMode === 'null' && derived)
      damage *= 0.35;

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
