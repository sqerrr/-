import type {
  CatalystId,
  DoctrineId,
  ItemId,
  ResonanceId,
  RewardOffer,
  SkillId
} from './types.js';

export interface ProgressionSelection {
  offers: RewardOffer[];
  offer: RewardOffer;
}

export interface ProgressionRuntimePort {
  hasChoice(): boolean;
  mutationCores(): number;
  hasEvolvableSkill(): boolean;
  openMutationTargets(): void;

  eliteCore(): number;
  spendEliteCore(amount: number): void;
  openEliteCache(): void;

  xp(): number;
  xpNeed(): number;
  spendXp(amount: number): void;
  addXp(amount: number): void;
  level(): number;
  setLevel(value: number): void;
  setXpNeed(value: number): void;
  noteLevel(): void;
  openLevelOffers(): void;
  emitLevelUp(level: number): void;

  takeReward(index: number): ProgressionSelection | null;
  rewardOffers(): RewardOffer[] | null;
  clearRewards(): RewardOffer[] | null;
  rerolls(): number;
  spendReroll(): void;

  beginMutationTarget(): void;
  openMutation(skill: SkillId): void;
  grantItem(item: ItemId): void;
  swapInSkill(skill: SkillId, slot: number): boolean;
  addSkill(skill: SkillId): boolean;
  placeCatalyst(id: CatalystId): boolean;
  applyDoctrine(id: DoctrineId, amount: number): void;
  applyCoreAxis(id: ResonanceId, amount: number): void;
  applyGlobal(stat: string | undefined, amount: number): void;

  emitRewardChosen(title: string): void;
  concedeRefusal(passed: RewardOffer[]): void;
}

/**
 * Coordinates the run's progression lifecycle after concrete offer generation has been split out.
 *
 * The runtime owns no content definitions and no build mechanics. It only preserves the ordering
 * between progression currencies, choice windows, reward application, rerolls/skips and refusal.
 */
export class ProgressionRuntime {
  constructor(private readonly port: ProgressionRuntimePort) {}

  static nextXpNeed(level: number) {
    return Math.round(12 + level * 1.5 + Math.pow(level, 1.25) * 0.7);
  }

  check() {
    const p = this.port;
    if (p.hasChoice()) return;

    if (p.mutationCores() > 0 && p.hasEvolvableSkill()) {
      p.openMutationTargets();
      return;
    }

    if (p.eliteCore() >= 5) {
      p.spendEliteCore(5);
      p.openEliteCache();
      return;
    }

    if (p.xp() >= p.xpNeed()) {
      const cost = p.xpNeed();
      p.spendXp(cost);
      const level = p.level() + 1;
      p.setLevel(level);
      p.noteLevel();
      p.setXpNeed(ProgressionRuntime.nextXpNeed(level));
      p.openLevelOffers();
      p.emitLevelUp(level);
    }
  }

  chooseReward(index: number) {
    const chosen = this.port.takeReward(index);
    if (!chosen) return false;

    const { offers, offer } = chosen;

    if (offer.kind === 'mutation_target' && offer.skill) {
      this.port.beginMutationTarget();
      this.port.openMutation(offer.skill);
      return true;
    }

    if (offer.kind === 'item_grant' && offer.item) {
      this.port.grantItem(offer.item);
    } else if (offer.kind === 'skill_swap' && offer.skill && offer.swapSlot !== undefined) {
      if (!this.port.swapInSkill(offer.skill, offer.swapSlot)) return false;
    } else if ((offer.kind === 'skill_add' || offer.kind === 'elite') && offer.skill) {
      if (!this.port.addSkill(offer.skill)) return false;
    } else if ((offer.kind === 'catalyst_add' || offer.kind === 'elite') && offer.catalyst) {
      if (!this.port.placeCatalyst(offer.catalyst)) return false;
    } else if (offer.kind === 'doctrine' && offer.doctrine) {
      this.port.applyDoctrine(offer.doctrine, offer.amount ?? 1);
    } else if ((offer.kind === 'resonance' || offer.kind === 'elite') && offer.resonance) {
      this.port.applyCoreAxis(offer.resonance, offer.amount ?? 1);
    } else {
      this.port.applyGlobal(offer.stat, offer.amount ?? 0);
    }

    this.port.emitRewardChosen(offer.title);
    if (!offers.every((candidate) => candidate.kind === 'doctrine'))
      this.port.concedeRefusal(offers.filter((candidate) => candidate !== offer));
    return true;
  }

  rerollRewards() {
    const offers = this.port.rewardOffers();
    if (
      !offers ||
      this.port.rerolls() <= 0 ||
      offers.some((offer) =>
        offer.kind === 'elite' ||
        offer.kind === 'mutation_target' ||
        offer.kind === 'skill_add'
      )
    )
      return false;

    this.port.spendReroll();
    this.port.openLevelOffers();
    return true;
  }

  skipReward() {
    const offers = this.port.rewardOffers();
    if (
      !offers ||
      offers.some((offer) =>
        offer.kind === 'elite' ||
        offer.kind === 'mutation_target' ||
        offer.kind === 'skill_add'
      )
    )
      return false;

    const passed = this.port.clearRewards()!;
    this.port.addXp(this.port.xpNeed() * 0.3);
    this.port.emitRewardChosen('Пропуск награды');
    this.port.concedeRefusal(passed);
    return true;
  }
}
