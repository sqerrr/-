import { skills } from '../content/definitions.js';
import type { Ent } from './state.js';
import type { EliteEncounter, Metrics, SkillId } from './types.js';

export interface CombatLedgerPort {
  time(): number;
  metrics(): Metrics;
  eliteEncounter(entityId: number): EliteEncounter | undefined;
  slotIndex(skill: SkillId): number;
}

/**
 * Diagnostic combat accounting.
 *
 * Gameplay never branches on these counters. Keeping them outside Simulation makes that boundary
 * explicit and prevents telemetry-only state from being mistaken for combat state.
 */
export class CombatLedger {
  private readonly damageBySource = new Map<string, number>();
  private readonly killsBySource = new Map<string, number>();
  private readonly hitsBySource = new Map<string, number>();

  constructor(private readonly port: CombatLedgerPort) {}

  recordEnemyHit(
    entity: Ent,
    source: string,
    amount: number,
    sourceSlot: number
  ) {
    const metrics = this.port.metrics();
    metrics.damage += amount;
    this.damageBySource.set(source, (this.damageBySource.get(source) ?? 0) + amount);
    this.hitsBySource.set(source, (this.hitsBySource.get(source) ?? 0) + 1);

    if (entity.kind !== 'elite') return;

    metrics.eliteDamage += amount;
    const record = this.port.eliteEncounter(entity.id);
    if (!record) return;

    record.damageFromHero += amount;

    const delayedOwner: Partial<Record<string, SkillId>> = {
      wound_dot: 'cleaver',
      toxin_dot: 'toxic_mist',
      arc_field: 'chain_arc',
      fire_field: 'ember_lance'
    };
    const ownerSkill =
      delayedOwner[source] ??
      (skills[source as SkillId] ? (source as SkillId) : null);
    const resolvedSlot =
      sourceSlot >= 0
        ? sourceSlot
        : ownerSkill
          ? this.port.slotIndex(ownerSkill)
          : -1;
    const node =
      resolvedSlot >= 0
        ? `${resolvedSlot}:${ownerSkill ?? source}`
        : `derived:${source}`;

    record.damageFromHeroByNode[node] =
      (record.damageFromHeroByNode[node] ?? 0) + amount;
    if (record.engagedAt < 0) record.engagedAt = this.port.time();
    record.lastExchangeAt = this.port.time();
  }

  recordKill(source: string) {
    this.killsBySource.set(source, (this.killsBySource.get(source) ?? 0) + 1);
  }

  recordEliteItemAmplification(entityId: number, amount: number) {
    if (amount <= 0) return;
    const record = this.port.eliteEncounter(entityId);
    if (record) record.itemAmplifiedDamage += amount;
  }

  telemetry() {
    return {
      damageBySource: Object.fromEntries(this.damageBySource),
      killsBySource: Object.fromEntries(this.killsBySource),
      hitsBySource: Object.fromEntries(this.hitsBySource)
    };
  }
}
