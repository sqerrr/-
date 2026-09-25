import { skillOrder } from '../content/definitions.js';
import type { Ent } from './state.js';
import type { DamageSourceId, EliteEncounter, GameEvent, Metrics, SkillId } from './types.js';

export interface PlayerDamagePort {
  time(): number;
  tick(): number;
  playerX(): number;
  playerZ(): number;
  playerHp(): number;
  setPlayerHp(value: number): void;
  barrier(): number;
  setBarrier(value: number): void;
  armor(): number;
  guardDoctrine(): number;
  itemDamageTakenMultiplier(): number;
  itemRefusalDamageMultiplier(): number;
  dashIFramesUntil(): number;
  dashWindowSaved(): boolean;
  setDashWindowSaved(value: boolean): void;
  metrics(): Metrics;
  entities(): readonly Ent[];
  eliteEncounter(entityId: number): EliteEncounter | undefined;
  randomFloat(): number;
  rivalAxisCount(entity: Ent, axis: 'precision' | 'multiplicity'): number;
  emit(event: Extract<GameEvent, { type: 'PlayerHit' }>): void;
}

/**
 * Owns all resolved damage landing on the hero.
 *
 * Rival cast amplification and the hero's mitigation/barrier/iframe rules intentionally live in
 * the same pipeline so the ordering stays explicit. Callers still decide which attacker/source
 * produced a hit; this class decides how much of that hit reaches barrier/HP and how it is
 * attributed to the active elite encounter.
 */
export class PlayerDamageSystem {
  constructor(private readonly port: PlayerDamagePort) {}

  hit(
    amount: number,
    attacker: Ent | null = null,
    source: DamageSourceId = 'contact'
  ): boolean {
    const p = this.port;
    if (amount <= 0 || p.playerHp() <= 0) return p.playerHp() <= 0;

    if (p.time() < p.dashIFramesUntil()) {
      if (!p.dashWindowSaved()) {
        p.setDashWindowSaved(true);
        p.metrics().dashIFrameSaves++;
        if (attacker) {
          const record = p.eliteEncounter(attacker.id);
          if (record) record.dashIFrameSaves++;
        }
      }
      return false;
    }

    const reduction = p.armor() / (p.armor() + 100);
    const closeThreat = p.entities().some(
      (entity) =>
        entity.hp > 0 &&
        Math.hypot(entity.x - p.playerX(), entity.z - p.playerZ()) < 3.6
    );
    const guardMultiplier = closeThreat ? Math.pow(0.94, p.guardDoctrine()) : 1;
    const mitigated =
      amount *
      (1 - reduction) *
      p.itemDamageTakenMultiplier() *
      guardMultiplier;

    if (attacker) this.recordEliteExchange(attacker, source, mitigated);

    let left = mitigated;
    let barrierDamage = 0;
    let hpDamage = 0;
    const barrier = p.barrier();

    if (barrier > 0) {
      barrierDamage = Math.min(barrier, left);
      p.setBarrier(barrier - barrierDamage);
      left -= barrierDamage;
    }

    if (left > 0) {
      hpDamage = left;
      p.setPlayerHp(Math.max(0, p.playerHp() - left));
      p.metrics().damageTaken += left;
    }

    p.emit({
      type: 'PlayerHit',
      tick: p.tick(),
      amount: mitigated,
      hpDamage,
      barrierDamage,
      x: p.playerX(),
      z: p.playerZ(),
      source,
      attackerId: attacker?.id ?? 0,
      attackerKind: attacker?.kind,
      attackerChassis: attacker?.chassis,
      attackerAffix: attacker?.affix,
      attackerBoss: attacker?.boss ?? false
    });

    return p.playerHp() <= 0;
  }

  damageFromRival(
    amount: number,
    source: DamageSourceId,
    attacker: Ent | null,
    concentration: number
  ): boolean {
    const p = this.port;

    if (attacker) {
      amount *= concentration;
      amount *= p.itemRefusalDamageMultiplier();

      if (
        (attacker.relicCritChance ?? 0) > 0 &&
        p.randomFloat() < Math.min(0.65, attacker.relicCritChance ?? 0)
      )
        amount *= 1.6;

      amount *= Math.pow(1.3, p.rivalAxisCount(attacker, 'precision'));
      amount *= Math.pow(1.16, p.rivalAxisCount(attacker, 'multiplicity'));

      const allItemMultiplier = attacker.relicCastMul ?? 1;
      const groundMultiplier = attacker.groundRelicCastMul ?? 1;

      if (groundMultiplier > 1) {
        const withoutGround = amount * (allItemMultiplier / groundMultiplier);
        const reduction = p.armor() / (p.armor() + 100);
        const record = p.eliteEncounter(attacker.id);
        if (record)
          record.itemAmplifiedDamage +=
            (amount * allItemMultiplier - withoutGround) *
            (1 - reduction) *
            p.itemDamageTakenMultiplier();
      }

      amount *= allItemMultiplier;
    }

    if (p.playerHp() <= 0) return false;

    const killed = this.hit(amount, attacker, source);

    if (attacker && (attacker.relicSiphon ?? 0) > 0)
      attacker.hp = Math.min(
        attacker.maxHp,
        attacker.hp + amount * (attacker.relicSiphon ?? 0)
      );

    return killed;
  }

  private recordEliteExchange(
    attacker: Ent,
    source: DamageSourceId,
    mitigated: number
  ) {
    const record = this.port.eliteEncounter(attacker.id);
    if (!record) return;

    record.damageToHero += mitigated;
    record.damageToHeroBySource[source] =
      (record.damageToHeroBySource[source] ?? 0) + mitigated;
    if (skillOrder.includes(source as SkillId))
      record.refusalDamageToHero += mitigated;
    if (record.engagedAt < 0) record.engagedAt = this.port.time();
    record.lastExchangeAt = this.port.time();
  }
}
