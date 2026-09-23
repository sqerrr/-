import { itemOrder } from '../content/definitions.js';
import type { Ent } from './state.js';
import type { ItemId, RefusedCard, ResonanceId } from './types.js';

const ELITE_RARITY_CAPACITY = {
  common: 2,
  uplifted: 4,
  legendary: 6
} as const;

export interface EliteProgressionPort {
  time(): number;
  runDuration(): number;
  refusalStore(): readonly RefusedCard[];
  legacyItems(): ItemId[];
  evolutionHistory(): ItemId[];
  mainRandomInt(maxExclusive: number): number;
  relicRandomInt(maxExclusive: number): number;
}

/**
 * Owns elite ecosystem progression policy.
 *
 * This includes refusal repertoire capacity, enemy-side relic effects, native evolution and
 * inheritance across the run. Simulation keeps presentation/events and Echo runtime; this class
 * owns the mechanical growth rules so they are no longer scattered across spawn and relic code.
 */
export class EliteProgressionSystem {
  constructor(private readonly port: EliteProgressionPort) {}

  repertoireCapacity(entity: Ent) {
    const t = this.progress();
    const base = ELITE_RARITY_CAPACITY[entity.rarity];

    // Early elites teach chassis first. Later the ecosystem accumulates a broad vocabulary.
    if (this.port.time() < 60) return Math.min(1, base);
    if (this.port.time() < 120) return Math.min(3, base + 1);

    const growth =
      entity.rarity === 'legendary'
        ? Math.floor(t * 7)
        : Math.floor(t * 6);
    return Math.min(12, base + growth);
  }

  rivalAxisCount(entity: Ent, axis: ResonanceId) {
    let count = 0;
    for (const serial of entity.repertoire) {
      const card = this.card(serial);
      if (card?.kind === 'axis' && card.resonance === axis) count++;
    }
    return count;
  }

  claimRepertoire(entity: Ent) {
    const pool = [...this.port.refusalStore()];
    this.shuffle(pool, false);

    // Prefer at least one executable rival Phenomenon when one is available.
    const armed = pool.findIndex((card) => !!card.skill);
    if (armed > 0) {
      const lead = pool[armed];
      pool.splice(armed, 1);
      pool.unshift(lead);
    }

    for (const card of pool.slice(0, this.repertoireCapacity(entity))) {
      if (card.heldBy === 0) card.heldBy = entity.id;
      entity.repertoire.push(card.serial);
    }

    this.applyRefusedAxes(entity);
  }

  releaseRepertoire(entity: Ent) {
    if (!entity.repertoire.length) return;
    for (const card of this.port.refusalStore())
      if (card.heldBy === entity.id) card.heldBy = 0;
    entity.repertoire.length = 0;
  }

  applyRefusedAxes(entity: Ent) {
    for (const serial of entity.repertoire) {
      const card = this.card(serial);
      if (card?.kind === 'item' && card.item)
        this.applyItem(entity, card.item, false);
    }

    // Persistence is mirrored elsewhere by field/construct duration. Do not touch max HP here.
    const sharp = this.rivalAxisCount(entity, 'conductivity');
    if (sharp) entity.contactDps *= Math.pow(1.12, sharp);

    const quick = this.rivalAxisCount(entity, 'mobility');
    if (quick) entity.speed *= Math.pow(1.12, quick);
  }

  applyItem(entity: Ent, id: ItemId, allowClaim: boolean) {
    switch (id) {
      case 'plating':
        this.scaleDurability(entity, 1.16);
        break;
      case 'vitality':
        this.scaleDurability(entity, 1.22);
        break;
      case 'aegis_core':
        entity.relicDamageTakenMul = (entity.relicDamageTakenMul ?? 1) * 0.88;
        break;
      case 'ablation':
        entity.relicDamageTakenMul = (entity.relicDamageTakenMul ?? 1) * 0.9;
        break;
      case 'keen_edge':
        entity.relicCastMul = (entity.relicCastMul ?? 1) * 1.16;
        entity.contactDps *= 1.08;
        if (allowClaim)
          entity.groundRelicCastMul = (entity.groundRelicCastMul ?? 1) * 1.16;
        break;
      case 'hollow_point':
        entity.relicCritChance = (entity.relicCritChance ?? 0) + 0.12;
        break;
      case 'siphon':
        entity.relicSiphon = (entity.relicSiphon ?? 0) + 0.035;
        break;
      case 'bane':
        entity.relicCastMul = (entity.relicCastMul ?? 1) * 1.18;
        entity.relicReachMul = (entity.relicReachMul ?? 1) * 1.08;
        if (allowClaim)
          entity.groundRelicCastMul = (entity.groundRelicCastMul ?? 1) * 1.18;
        break;
      case 'light_step':
        entity.speed *= 1.12;
        break;
      case 'quickened':
        entity.relicGapMul = (entity.relicGapMul ?? 1) * 0.82;
        break;
      case 'short_cord':
        entity.relicGapMul = (entity.relicGapMul ?? 1) * 0.9;
        entity.speed *= 1.05;
        break;
      case 'afterimage':
        entity.relicDamageTakenMul = (entity.relicDamageTakenMul ?? 1) * 0.92;
        entity.speed *= 1.04;
        break;
      case 'lodestone':
        entity.relicSeekMul = (entity.relicSeekMul ?? 1) * 1.55;
        break;
      case 'keen_eye':
        entity.relicSeekMul = (entity.relicSeekMul ?? 1) * 1.25;
        if (allowClaim) this.claimOneMoreRefusal(entity);
        break;
      case 'scavenger':
        this.scaleDurability(entity, 1.08);
        entity.relicCastMul = (entity.relicCastMul ?? 1) * 1.06;
        break;
      case 'beacon':
        entity.relicSeekMul = (entity.relicSeekMul ?? 1) * 1.75;
        entity.relicGapMul = (entity.relicGapMul ?? 1) * 0.94;
        break;
      case 'spoils':
        entity.affixPulse = Math.min(entity.affixPulse, 1.5);
        entity.buffUntil = Math.max(entity.buffUntil, this.port.time() + 1.8);
        break;
      case 'unravel':
        entity.relicDamageTakenMul = (entity.relicDamageTakenMul ?? 1) * 0.88;
        break;
      case 'tribute':
        this.scaleDurability(entity, 1.15);
        entity.contactDps *= 1.08;
        break;
      case 'reprisal':
        entity.relicCastMul = (entity.relicCastMul ?? 1) * 1.2;
        entity.relicGapMul = (entity.relicGapMul ?? 1) * 0.92;
        if (allowClaim)
          entity.groundRelicCastMul = (entity.groundRelicCastMul ?? 1) * 1.2;
        break;
    }
  }

  grantNativeGrowth(entity: Ent) {
    const budget = this.nativeGrowthBudget(entity);
    if (!budget) return;

    const owned = new Set<ItemId>([
      ...(entity.relicItems ?? []),
      ...(entity.evolutionItems ?? [])
    ]);
    const pool = itemOrder.filter((id) => !owned.has(id));
    this.shuffle(pool, false);

    entity.evolutionItems ??= [];
    for (const id of pool.slice(0, budget)) {
      entity.evolutionItems.push(id);
      this.port.evolutionHistory().push(id);
      this.applyItem(entity, id, true);
    }
  }

  inheritEvolution(entity: Ent) {
    const history = this.port.evolutionHistory();
    if (!history.length) return;

    entity.evolutionItems ??= [];
    const captured = new Set(entity.relicItems ?? []);
    for (const id of new Set(history)) {
      entity.evolutionItems.push(id);
      if (!captured.has(id)) this.applyItem(entity, id, false);
    }
  }

  inheritLegacy(entity: Ent, all = false) {
    const history = this.port.legacyItems();
    if (!history.length) return;

    entity.relicItems ??= [];
    if (all) {
      // Warden displays the full captured history; repeated mechanics apply only once.
      entity.relicItems.push(...history);
      for (const id of new Set(history)) this.applyItem(entity, id, false);
      return;
    }

    const pool = [...history];
    this.shuffle(pool, true);
    for (const id of pool.slice(0, this.inheritanceBudget(entity))) {
      entity.relicItems.push(id);
      this.applyItem(entity, id, false);
    }
  }

  recordCapturedRelic(entity: Ent, id: ItemId) {
    entity.relicItems ??= [];
    entity.relicItems.push(id);
    this.port.legacyItems().push(id);
    this.applyItem(entity, id, true);
  }

  private claimOneMoreRefusal(entity: Ent) {
    const pool = this.port
      .refusalStore()
      .filter((card) => !entity.repertoire.includes(card.serial));
    if (!pool.length) return;

    const card = pool[this.port.relicRandomInt(pool.length)];
    if (card.heldBy === 0) card.heldBy = entity.id;
    entity.repertoire.push(card.serial);

    // Apply only the newly learned card; replaying all prior cards would compound old modifiers.
    if (card.kind === 'item' && card.item)
      this.applyItem(entity, card.item, false);
    else if (card.kind === 'axis' && card.resonance === 'conductivity')
      entity.contactDps *= 1.12;
    else if (card.kind === 'axis' && card.resonance === 'mobility')
      entity.speed *= 1.12;
  }

  private inheritanceBudget(entity: Ent) {
    const t = this.progress();
    const base =
      entity.rarity === 'legendary'
        ? 2
        : entity.rarity === 'uplifted'
          ? 1
          : 0;

    if (this.port.time() < 90) return Math.min(base, 1);
    return Math.min(10, base + Math.floor(t * 7));
  }

  private nativeGrowthBudget(entity: Ent) {
    if (this.port.time() < 120) return 0;

    const depth = 1 + Math.floor((this.port.time() - 120) / 90);
    const rarity =
      entity.rarity === 'legendary'
        ? 2
        : entity.rarity === 'uplifted'
          ? 1
          : 0;

    return Math.min(6, depth + rarity);
  }

  private scaleDurability(entity: Ent, multiplier: number) {
    if (multiplier <= 0 || Math.abs(multiplier - 1) < 1e-6) return;
    entity.maxHp *= multiplier;
    entity.hp *= multiplier;
  }

  private progress() {
    return Math.max(
      0,
      Math.min(1, this.port.time() / this.port.runDuration())
    );
  }

  private card(serial: number) {
    return this.port.refusalStore().find((candidate) => candidate.serial === serial);
  }

  private shuffle<T>(items: T[], relicStream: boolean) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = relicStream
        ? this.port.relicRandomInt(i + 1)
        : this.port.mainRandomInt(i + 1);
      [items[i], items[j]] = [items[j], items[i]];
    }
  }
}
