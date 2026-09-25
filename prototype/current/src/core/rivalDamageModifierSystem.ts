import type { Ent } from './state.js';
import type { ResonanceId } from './types.js';

export interface RivalDamageModifierPort {
  armor(): number;
  itemDamageTakenMultiplier(): number;
  itemRefusalDamageMultiplier(): number;
  randomFloat(): number;
  rivalAxisCount(entity: Ent, axis: ResonanceId): number;
}

export interface RivalDamageResolution {
  amount: number;
  itemAmplifiedDamage: number;
}

/**
 * Ordered pre-mitigation scaling for damage authored by an enemy/rival owner.
 *
 * Player armor/barrier/i-frames belong to the later hit resolver. This layer only owns
 * attacker-side concentration, refused-card scaling, rival crit/axes and captured-relic power.
 */
export class RivalDamageModifierSystem {
  constructor(private readonly port: RivalDamageModifierPort) {}

  resolve(
    attacker: Ent | null,
    amount: number,
    concentration: number
  ): RivalDamageResolution {
    if (!attacker) return { amount, itemAmplifiedDamage: 0 };

    const p = this.port;
    amount *= concentration;
    amount *= p.itemRefusalDamageMultiplier();

    if (
      (attacker.relicCritChance ?? 0) > 0 &&
      p.randomFloat() < Math.min(0.65, attacker.relicCritChance ?? 0)
    )
      amount *= 1.6;

    amount *= Math.pow(1.3, p.rivalAxisCount(attacker, 'precision'));
    amount *= Math.pow(1.16, p.rivalAxisCount(attacker, 'multiplicity'));

    const allItemMul = attacker.relicCastMul ?? 1;
    const groundMul = attacker.groundRelicCastMul ?? 1;
    let itemAmplifiedDamage = 0;

    if (groundMul > 1) {
      const withoutGround = amount * (allItemMul / groundMul);
      const reduction = p.armor() / (p.armor() + 100);
      itemAmplifiedDamage =
        (amount * allItemMul - withoutGround) *
        (1 - reduction) *
        p.itemDamageTakenMultiplier();
    }

    amount *= allItemMul;
    return { amount, itemAmplifiedDamage };
  }
}
