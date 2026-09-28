import {
  activeSkillOrder,
  catalystOrder,
  doctrineMaxRank,
  doctrineOrder,
  doctrineRequiresAxis,
  mutationChildren,
  mutationRoots,
  resonanceOrder,
  skills
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
  hasFreeSkillPlace(): boolean;
  hasFreeCatalystPlace(): boolean;
  doctrineLevel(id: DoctrineId): number;
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
    return this.shuffle(this.usefulResonance())
      .slice(0, 3)
      .map((id) => this.factory.resonance(id));
  }

  discovery(): RewardOffer[] {
    const choices = this.shuffle(this.unownedSkills()).slice(0, 3);
    const free = this.port.hasFreeSkillPlace();

    // Without a free place the cards become swaps; the player picks the replaced location.
    return choices.map((id) =>
      free ? this.factory.skillAdd(id) : this.factory.skillSwap(id)
    );
  }

  levelOffers(): RewardOffer[] {
    // Only doctrines whose next rank changes something for this build: below the ceiling and,
    // for axis-bound doctrines, backed by at least one active Phenomenon with that axis.
    const available = doctrineOrder.filter((id) => this.doctrineUseful(id));
    const ids = this.shuffle([...available]);

    // Soft steering without a hard recipe: close builds see survival/reach more often,
    // projectile/construct builds retain wildcard access to the full doctrine pool.
    const close = this.port
      .slots()
      .filter((id) => id === 'cleaver' || id === 'orbit_blades').length;
    const preferred: DoctrineId[] = (
      close >= 2
        ? (['size', 'guard', 'mobility', 'force'] as DoctrineId[])
        : (['might', 'precision', 'quantity', 'duration'] as DoctrineId[])
    ).filter((id) => available.includes(id));

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

    const offers = selected
      .slice(0, 3)
      .map((id) => this.factory.doctrine(id));

    // Exhausted doctrine pool: fill with rarity-rolled general cards instead of dead ranks.
    while (offers.length < 3) offers.push(this.factory.global());
    return offers;
  }

  /** Catalyst power does nothing until at least one Catalyst stands on a link. */
  private usefulResonance() {
    const linked = this.port.catalysts().some(Boolean);
    return resonanceOrder.filter((id) => id !== 'conductivity' || linked);
  }

  private doctrineUseful(id: DoctrineId) {
    if (this.port.doctrineLevel(id) >= doctrineMaxRank[id]) return false;
    const axis = doctrineRequiresAxis[id];
    if (!axis) return true;
    return this.port
      .slots()
      .some((skill) => !!skill && (skills[skill].axes?.includes(axis) ?? false));
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
    const hasSpace = this.port.hasFreeCatalystPlace();

    if (unowned.length && hasSpace) {
      offers = this.shuffle([...unowned])
        .slice(0, 3)
        .map((id) => this.factory.eliteCatalyst(id));
    } else {
      offers = this.shuffle(this.usefulResonance())
        .slice(0, 2)
        .map((id) => this.factory.eliteResonance(id));

      // Elite caches cannot be skipped, so they must only show rewards that can be applied:
      // a Phenomenon appears only while a free place exists, otherwise a rarity-rolled card.
      const unownedSkills = this.unownedSkills();
      if (unownedSkills.length && this.port.hasFreeSkillPlace()) {
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
