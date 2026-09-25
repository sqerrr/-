import {
  activeSkillOrder,
  catalystOrder,
  doctrineOrder,
  mutationChildren,
  mutationRoots,
  resonanceOrder
} from '../content/definitions.js';
import type {
  CatalystId,
  DoctrineId,
  RewardOffer,
  SkillId,
  SkillRuntime
} from './types.js';
import { RewardOfferFactory } from './rewardOfferFactory.js';

export interface ProgressionOfferPort {
  randomInt(maxExclusive: number): number;
  randomFloat(): number;
  refusalInt(maxExclusive: number): number;
  slots(): readonly (SkillId | null)[];
  skillReserve(): readonly (SkillId | null)[];
  catalysts(): readonly (CatalystId | null)[];
  catalystReserve(): readonly (CatalystId | null)[];
  skillState(id: SkillId): SkillRuntime;
  mutationCores(): number;
  catalystCompatibleEdges(id: CatalystId): number[];
}

/**
 * Selects which progression cards should be shown.
 *
 * ChoiceRuntime owns the open window; RewardOfferFactory owns card copy/presentation.
 * This system owns only selection policy and its deterministic RNG cadence.
 */
export class ProgressionOfferSystem {
  constructor(
    private readonly port: ProgressionOfferPort,
    private readonly factory: RewardOfferFactory
  ) {}

  hasUnownedSkills() {
    return this.unownedSkills().length > 0;
  }

  hasEvolvableSkill() {
    return this.port.slots().some((id) => {
      if (!id) return false;
      const state = this.port.skillState(id);
      return (
        !state.mutation ||
        (!state.mutationUpgrade &&
          mutationChildren(id, state.mutation).length > 0) ||
        (!!state.mutationUpgrade &&
          !state.mutationApotheosis &&
          mutationChildren(id, state.mutationUpgrade).length > 0)
      );
    });
  }

  catalystDiscovery(): RewardOffer[] {
    const owned = this.allOwnedCatalysts();
    const unowned = catalystOrder.filter((id) => !owned.includes(id));
    const useful = unowned.filter(
      (id) => this.port.catalystCompatibleEdges(id).length > 0
    );
    const pool = useful.length ? useful : unowned;

    if (!pool.length) return this.levelOffers();

    return this.shuffle([...pool])
      .slice(0, 3)
      .map((id) => this.factory.catalystAdd(id));
  }

  resonanceChoice(): RewardOffer[] {
    return this.shuffle([...resonanceOrder])
      .slice(0, 3)
      .map((id) => this.factory.resonance(id));
  }

  discovery(): RewardOffer[] {
    const choices = this.shuffle(this.unownedSkills()).slice(0, 3);
    const free =
      this.port.slots().some((id) => !id) ||
      this.port.skillReserve().some((id) => !id);

    return choices.map((id) =>
      free ? this.factory.skillAdd(id) : this.factory.skillSwap(id)
    );
  }

  levelOffers(): RewardOffer[] {
    const ids = this.shuffle([...doctrineOrder]);

    // Soft steering without a hard recipe: close builds see survival/reach more often,
    // projectile/construct builds retain wildcard access to the full doctrine pool.
    const close = this.port
      .slots()
      .filter((id) => id === 'cleaver' || id === 'orbit_blades').length;
    const preferred: DoctrineId[] =
      close >= 2
        ? ['size', 'guard', 'mobility', 'force']
        : ['might', 'precision', 'quantity', 'duration'];

    const selected: DoctrineId[] = [];
    if (this.port.randomFloat() < 0.7) {
      const candidates = preferred.filter((id) => !selected.includes(id));
      if (candidates.length)
        selected.push(candidates[this.port.randomInt(candidates.length)]);
    }

    while (selected.length < 3 && ids.length) {
      const id = ids.shift()!;
      if (!selected.includes(id)) selected.push(id);
    }

    return selected
      .slice(0, 3)
      .map((id) => this.factory.doctrine(id));
  }

  mutationTargetOffers(): RewardOffer[] {
    const active = this.port.slots().filter((id): id is SkillId => {
      if (!id) return false;
      const state = this.port.skillState(id);
      if (!state.mutation) return mutationRoots(id).length > 0;
      if (!state.mutationUpgrade)
        return mutationChildren(id, state.mutation).length > 0;
      return (
        !state.mutationApotheosis &&
        mutationChildren(id, state.mutationUpgrade).length > 0
      );
    });

    return this.shuffle([...active])
      .slice(0, 3)
      .map((id) => {
        const state = this.port.skillState(id);
        const tier: 1 | 2 | 3 = !state.mutation
          ? 1
          : !state.mutationUpgrade
            ? 2
            : 3;
        const parent =
          tier === 1
            ? null
            : tier === 2
              ? state.mutation
              : state.mutationUpgrade;

        return this.factory.mutationTarget(
          id,
          tier,
          this.port.mutationCores(),
          parent
        );
      });
  }

  eliteCache(): RewardOffer[] {
    const owned = this.allOwnedCatalysts();
    const allUnowned = catalystOrder.filter((id) => !owned.includes(id));
    const usefulUnowned = allUnowned.filter(
      (id) => this.port.catalystCompatibleEdges(id).length > 0
    );
    const unowned = usefulUnowned.length ? usefulUnowned : allUnowned;

    let offers: RewardOffer[] = [];
    const hasSpace =
      this.port.catalystReserve().some((id) => !id) ||
      this.port.catalysts().some((id) => !id);

    if (unowned.length && hasSpace) {
      offers = this.shuffle([...unowned])
        .slice(0, 3)
        .map((id) => this.factory.eliteCatalyst(id));
    } else {
      offers = this.shuffle([...resonanceOrder])
        .slice(0, 2)
        .map((id) => this.factory.eliteResonance(id));

      const unownedSkills = this.unownedSkills();
      if (unownedSkills.length) {
        const id = this.shuffle(unownedSkills)[0];
        offers.push(this.factory.eliteSkill(id));
      } else {
        offers.push(this.factory.global());
      }
    }

    const displayed = offers.slice(0, 3);
    const wanted = this.port.refusalInt(displayed.length);
    displayed[wanted].marked = true;
    return displayed;
  }

  private unownedSkills() {
    const owned = this.allOwnedSkills();
    return activeSkillOrder.filter((id) => !owned.includes(id));
  }

  private allOwnedSkills() {
    return [
      ...new Set(
        [...this.port.slots(), ...this.port.skillReserve()].filter(Boolean) as SkillId[]
      )
    ];
  }

  private allOwnedCatalysts() {
    return [
      ...new Set(
        [...this.port.catalysts(), ...this.port.catalystReserve()].filter(
          Boolean
        ) as CatalystId[]
      )
    ];
  }

  private shuffle<T>(values: T[]) {
    for (let index = values.length - 1; index > 0; index--) {
      const swap = this.port.randomInt(index + 1);
      [values[index], values[swap]] = [values[swap], values[index]];
    }
    return values;
  }
}
