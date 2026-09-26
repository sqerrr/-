import { catalystPairCompatible } from '../content/definitions.js';
import type {
  CatalystId,
  CatalystRuntime,
  SkillId,
  SkillRuntime
} from './types.js';

export type LoadoutZone = 'active' | 'reserve';

export interface BuildLoadoutPort {
  slots(): (SkillId | null)[];
  skillReserve(): (SkillId | null)[];
  catalysts(): (CatalystId | null)[];
  catalystReserve(): (CatalystId | null)[];
  newSkill(id: SkillId): SkillRuntime;
  skillState(id: SkillId): SkillRuntime;
  setSkillRuntime(id: SkillId, runtime: SkillRuntime): void;
  deleteSkillRuntime(id: SkillId): void;
  setCatalystRuntime(id: CatalystId, runtime: CatalystRuntime): void;
  mutationCores(): number;
  setMutationCores(value: number): void;
  resetCapacitor(): void;
}

/**
 * Owns structural loadout transitions.
 *
 * The arrays remain part of run state, but all rules for discovering, placing and moving
 * Phenomena/Catalysts live here: uniqueness, reserve overflow, mutation-core refunds and
 * Catalyst charge reset on rearrangement.
 */
export class BuildLoadoutSystem {
  constructor(private readonly port: BuildLoadoutPort) {}

  allOwnedSkills() {
    return [
      ...new Set(
        [...this.port.slots(), ...this.port.skillReserve()].filter(Boolean) as SkillId[]
      )
    ];
  }

  allOwnedCatalysts() {
    return [
      ...new Set(
        [...this.port.catalysts(), ...this.port.catalystReserve()].filter(
          Boolean
        ) as CatalystId[]
      )
    ];
  }

  catalystCompatibleEdges(id: CatalystId) {
    const slots = this.port.slots();
    const catalysts = this.port.catalysts();
    const out: number[] = [];

    for (let index = 0; index < catalysts.length; index++) {
      const left = slots[index];
      const right = slots[index + 1];
      if (left && right && catalystPairCompatible(id, left, right))
        out.push(index);
    }

    return out;
  }

  placeCatalyst(id: CatalystId) {
    const slots = this.port.slots();
    const catalysts = this.port.catalysts();
    const reserve = this.port.catalystReserve();

    let edge = catalysts.findIndex((current, index) => {
      const left = slots[index];
      const right = slots[index + 1];
      return (
        !current &&
        !!left &&
        !!right &&
        catalystPairCompatible(id, left, right)
      );
    });

    if (edge >= 0) catalysts[edge] = id;
    else {
      const reserveIndex = reserve.findIndex((current) => !current);
      if (reserveIndex >= 0) reserve[reserveIndex] = id;
      else {
        edge = catalysts.findIndex((current) => !current);
        if (edge >= 0) catalysts[edge] = id;
        else return false;
      }
    }

    this.port.setCatalystRuntime(id, { id });
    return true;
  }

  addSkill(id: SkillId) {
    if (this.allOwnedSkills().includes(id)) return true;

    const slots = this.port.slots();
    const reserve = this.port.skillReserve();
    const activeIndex = slots.findIndex((current) => !current);
    const reserveIndex = reserve.findIndex((current) => !current);

    if (activeIndex >= 0) slots[activeIndex] = id;
    else if (reserveIndex >= 0) reserve[reserveIndex] = id;
    else return false;

    this.port.setSkillRuntime(id, this.port.newSkill(id));
    return true;
  }

  /**
   * The active Phenomenon stepping aside goes to reserve. If reserve is full, its first
   * occupant leaves the run and its runtime is discarded.
   */
  swapInSkill(id: SkillId, slot: number) {
    if (this.allOwnedSkills().includes(id)) return true;

    const slots = this.port.slots();
    const reserve = this.port.skillReserve();
    if (slot < 0 || slot >= slots.length) return false;

    const leaving = slots[slot];
    slots[slot] = id;
    this.port.setSkillRuntime(id, this.port.newSkill(id));

    if (leaving) {
      const free = reserve.findIndex((current) => !current);
      if (free >= 0) reserve[free] = leaving;
      else {
        const dropped = reserve[0];
        reserve[0] = leaving;
        if (dropped) this.port.deleteSkillRuntime(dropped);
      }
    }

    return true;
  }

  swapSkillLocations(
    zoneA: LoadoutZone,
    indexA: number,
    zoneB: LoadoutZone,
    indexB: number
  ) {
    const a = zoneA === 'active' ? this.port.slots() : this.port.skillReserve();
    const b = zoneB === 'active' ? this.port.slots() : this.port.skillReserve();

    if (
      indexA < 0 ||
      indexA >= a.length ||
      indexB < 0 ||
      indexB >= b.length ||
      (a === b && indexA === indexB)
    )
      return false;

    const valueA = a[indexA];
    const valueB = b[indexB];

    if (zoneA !== zoneB) {
      const leaving = zoneA === 'active' ? valueA : valueB;
      if (leaving) {
        const state = this.port.skillState(leaving);
        if (state.mutation) {
          this.port.setMutationCores(
            this.port.mutationCores() +
              1 +
              (state.mutationUpgrade ? 1 : 0) +
              (state.mutationApotheosis ? 1 : 0)
          );
          state.mutation = null;
          state.mutationUpgrade = null;
          state.mutationApotheosis = null;
        }
      }
    }

    a[indexA] = valueB;
    b[indexB] = valueA;
    return true;
  }

  swapCatalystLocations(
    zoneA: LoadoutZone,
    indexA: number,
    zoneB: LoadoutZone,
    indexB: number
  ) {
    const a =
      zoneA === 'active' ? this.port.catalysts() : this.port.catalystReserve();
    const b =
      zoneB === 'active' ? this.port.catalysts() : this.port.catalystReserve();

    if (
      indexA < 0 ||
      indexA >= a.length ||
      indexB < 0 ||
      indexB >= b.length ||
      (a === b && indexA === indexB)
    )
      return false;

    [a[indexA], b[indexB]] = [b[indexB], a[indexA]];
    this.port.resetCapacitor();
    return true;
  }
}
