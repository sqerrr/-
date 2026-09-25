import type { Ent } from './state.js';
import type { SkillId, SkillRuntime } from './types.js';

export interface EliteDamageModifier {
  beforeDamage(
    entity: Ent,
    damage: number,
    skill: SkillId | null,
    derived: boolean
  ): number;
}

export interface AffixDamageModifier {
  modifyIncomingDamage(
    entity: Ent,
    damage: number,
    directional: boolean,
    sourceX: number,
    sourceZ: number
  ): number;
}

export interface EnemyDamageModifierPort {
  time(): number;
  itemDamageMultiplier(): number;
  itemEliteDamageMultiplier(): number;
  itemCritBonus(): number;
  doctrinePrecision(): number;
  resonancePrecision(): number;
  supportsPrecision(skill: SkillId): boolean;
  randomFloat(): number;
  skillRuntime(source: string): SkillRuntime | undefined;
  getAliveEntity(id: number): Ent | undefined;
  derived(): boolean;
}

export interface EnemyDamageResolution {
  scaledBase: number;
  actual: number;
  skill: SkillRuntime | undefined;
  crit: boolean;
}

/**
 * Ordered pre-resolution modifier pipeline for hero damage against enemies.
 *
 * This owns multiplication/status-consumption order only. Applying HP, publishing combat events,
 * kill reactions and diagnostics remain separate concerns.
 */
export class EnemyDamageModifierSystem {
  constructor(
    private readonly port: EnemyDamageModifierPort,
    private readonly eliteDamage: EliteDamageModifier,
    private readonly affixDamage: AffixDamageModifier
  ) {}

  resolve(
    entity: Ent,
    amount: number,
    source: string,
    directional: boolean,
    sourceX: number,
    sourceZ: number
  ): EnemyDamageResolution {
    const p = this.port;

    let scaledBase = amount * p.itemDamageMultiplier();
    if (entity.kind === 'elite') scaledBase *= p.itemEliteDamageMultiplier();

    let actual = scaledBase;
    if (entity.kind === 'elite') actual *= entity.relicDamageTakenMul ?? 1;

    const skill = p.skillRuntime(source);
    if (skill) {
      if (entity.kind === 'elite') actual *= 1 + skill.eliteDamage;

      const precision = p.supportsPrecision(skill.id)
        ? p.resonancePrecision() * 0.045
        : 0;
      const critChance =
        skill.crit +
        precision +
        p.itemCritBonus() +
        p.doctrinePrecision() * 0.03;

      if (critChance > 0 && p.randomFloat() < critChance) actual *= 1.75;
    }

    actual = this.eliteDamage.beforeDamage(
      entity,
      actual,
      skill?.id ?? null,
      p.derived()
    );

    if (source !== 'ember_lance' && entity.markUntil > p.time()) {
      actual *= 1.35;
      entity.markUntil = 0;
    }

    if (entity.exposedUntil > p.time()) actual *= 1.3;

    if (entity.kind !== 'binder' && entity.linkedTo) {
      const binder = p.getAliveEntity(entity.linkedTo);
      if (binder?.kind === 'binder') actual *= 0.65;
    }

    actual = this.affixDamage.modifyIncomingDamage(
      entity,
      actual,
      directional,
      sourceX,
      sourceZ
    );

    // Preserve the existing presentation contract: "crit" describes a sufficiently amplified
    // skill hit after all target modifiers, not merely whether the RNG crit branch fired.
    const crit = !!skill && actual > scaledBase * 1.55;

    return { scaledBase, actual, skill, crit };
  }
}
