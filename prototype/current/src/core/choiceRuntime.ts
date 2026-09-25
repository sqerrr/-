import type { MutationId, MutationOffer, RewardOffer } from './types.js';

/**
 * Owns the transient UI/application state of progression choices.
 *
 * Offer generation and reward effects stay outside this class. ChoiceRuntime only owns the
 * lifecycle of one visible choice window: which offers are live, which modal follows it,
 * serial invalidation for UI, the one-run mutation refusal token, and pending core consumption.
 */
export class ChoiceRuntime {
  rewardOffers: RewardOffer[] | null = null;
  mutationOffer: MutationOffer | null = null;
  serial = 0;
  mutationRefusalToken = true;
  pendingMutationTarget = false;

  get hasChoice() {
    return this.rewardOffers !== null || this.mutationOffer !== null;
  }

  openRewards(offers: RewardOffer[]) {
    this.rewardOffers = offers;
    this.serial++;
  }

  takeReward(index: number) {
    const offers = this.rewardOffers;
    const offer = offers?.[index];
    if (!offers || !offer) return null;
    this.rewardOffers = null;
    return { offers, offer };
  }

  clearRewards() {
    const offers = this.rewardOffers;
    this.rewardOffers = null;
    return offers;
  }

  openMutation(offer: MutationOffer) {
    this.mutationOffer = offer;
    this.serial++;
  }

  mutationChoice(index: number): MutationId | null {
    return this.mutationOffer?.choices[index] ?? null;
  }

  closeMutation() {
    this.mutationOffer = null;
  }

  beginMutationTarget() {
    this.pendingMutationTarget = true;
  }

  consumeMutationTarget() {
    const pending = this.pendingMutationTarget;
    this.pendingMutationTarget = false;
    return pending;
  }

  canRefuseMutation() {
    return !!this.mutationOffer?.refusalAvailable && this.mutationRefusalToken;
  }

  replaceMutationChoice(index: number, mutation: MutationId) {
    const offer = this.mutationOffer;
    if (!offer || !offer.refusalAvailable || !this.mutationRefusalToken) return false;

    // Keep the existing Simulation contract: callers own index validation, and assignment
    // semantics remain the same as the former direct choices[index] write.
    offer.choices[index] = mutation;
    this.mutationRefusalToken = false;
    offer.refusalAvailable = false;
    this.serial++;
    return true;
  }
}
