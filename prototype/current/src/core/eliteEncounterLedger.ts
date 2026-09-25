import type { Ent } from './state.js';
import type { EliteEncounter, ItemId, SkillId } from './types.js';

/**
 * Owns diagnostic lifetime/attribution records for elite encounters.
 *
 * This state is deliberately non-canonical: gameplay never branches on it. Centralizing it keeps
 * combat, movement, relic and death systems from sharing a raw array plus a second mutable index.
 */
export class EliteEncounterLedger {
  private readonly records: EliteEncounter[] = [];
  private readonly byId = new Map<number, EliteEncounter>();

  start(entity: Ent, time: number) {
    if (entity.kind !== 'elite' || !entity.chassis) return;

    const record: EliteEncounter = {
      id: entity.id,
      chassis: entity.chassis,
      rarity: entity.rarity,
      spawnedAt: time,
      engagedAt: -1,
      contactTime: 0,
      endedAt: -1,
      killed: false,
      repertoire: entity.repertoire.length,
      casts: 0,
      castSkills: {},
      damageToHero: 0,
      damageFromHero: 0,
      lastExchangeAt: -1,
      damageFromHeroByNode: {},
      damageToHeroBySource: {},
      refusalDamageToHero: 0,
      itemAmplifiedDamage: 0,
      itemsTaken: [],
      dashes: 0,
      dashIFrameSaves: 0
    };

    this.records.push(record);
    this.byId.set(entity.id, record);
  }

  get(entityId: number) {
    return this.byId.get(entityId);
  }

  all(): EliteEncounter[] {
    return this.records;
  }

  noteContact(entityId: number, time: number, dt: number) {
    const record = this.byId.get(entityId);
    if (!record || record.engagedAt < 0 || record.lastExchangeAt < 0) return;
    if (time - record.lastExchangeAt <= 1.6) record.contactTime += dt;
  }

  noteRivalCast(entityId: number, skill: SkillId) {
    const record = this.byId.get(entityId);
    if (!record) return;
    record.casts++;
    record.castSkills[skill] = (record.castSkills[skill] ?? 0) + 1;
  }

  noteDash(time: number) {
    for (const record of this.records) {
      if (
        record.engagedAt >= 0 &&
        record.endedAt < 0 &&
        record.lastExchangeAt >= 0 &&
        time - record.lastExchangeAt <= 2
      )
        record.dashes++;
    }
  }

  finish(entityId: number, time: number, killed: boolean) {
    const record = this.byId.get(entityId);
    if (!record) return;
    record.endedAt = time;
    record.killed = killed;
  }

  noteItem(entityId: number, item: ItemId) {
    this.byId.get(entityId)?.itemsTaken.push(item);
  }
}
