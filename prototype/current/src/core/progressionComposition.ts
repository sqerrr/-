import { BuildLoadoutSystem } from './buildLoadoutSystem.js';
import { ChoiceRuntime } from './choiceRuntime.js';
import { MutationChoiceSystem } from './mutationChoiceSystem.js';
import { ProgressionOfferSystem } from './progressionOfferSystem.js';
import { ProgressionRuntime } from './progressionRuntime.js';
import { RewardOfferFactory } from './rewardOfferFactory.js';
import type {
  CatalystId,
  CatalystRuntime,
  DoctrineId,
  ItemId,
  MutationId,
  ResonanceId,
  RewardOffer,
  SkillId,
  SkillRuntime
} from './types.js';

export interface ProgressionCompositionPort {
  randomInt(maxExclusive: number): number;
  randomFloat(): number;
  nextU32(): number;
  refusalInt(maxExclusive: number): number;

  fortune(): number;
  resonanceLevel(id: ResonanceId): number;
  doctrineLevel(id: DoctrineId): number;

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

  noteMutation(): void;
  emitMutationChosen(skill: SkillId, mutation: MutationId): void;
  emitRareEvent(title: string, detail: string): void;

  eliteCore(): number;
  spendEliteCore(amount: number): void;
  xp(): number;
  xpNeed(): number;
  spendXp(amount: number): void;
  addXp(amount: number): void;
  level(): number;
  setLevel(value: number): void;
  setXpNeed(value: number): void;
  noteLevel(): void;
  emitLevelUp(level: number): void;
  rerolls(): number;
  spendReroll(): void;

  grantItem(item: ItemId): void;
  applyDoctrine(id: DoctrineId, amount: number): void;
  applyCoreAxis(id: ResonanceId, amount: number): void;
  applyGlobal(stat: string | undefined, amount: number): void;
  emitRewardChosen(title: string): void;
  concedeRefusal(passed: RewardOffer[]): void;
}

/**
 * Composition boundary for the complete player progression slice.
 *
 * Simulation supplies mutable run-state ports once. This object owns the internal wiring between
 * transient choices, loadout transitions, reward-card construction/selection, mutation policy and
 * progression orchestration. The individual systems stay independently testable, while Simulation
 * no longer knows how those systems are connected to each other.
 */
export class ProgressionComposition {
  static readonly MUTATION_BRANCHES = MutationChoiceSystem.BRANCHES;
  private readonly choices = new ChoiceRuntime();
  private readonly loadout: BuildLoadoutSystem;
  private readonly offers: ProgressionOfferSystem;
  private readonly mutations: MutationChoiceSystem;
  private readonly runtime: ProgressionRuntime;

  constructor(private readonly port: ProgressionCompositionPort) {
    this.loadout = new BuildLoadoutSystem({
      slots: port.slots,
      skillReserve: port.skillReserve,
      catalysts: port.catalysts,
      catalystReserve: port.catalystReserve,
      newSkill: port.newSkill,
      skillState: port.skillState,
      setSkillRuntime: port.setSkillRuntime,
      deleteSkillRuntime: port.deleteSkillRuntime,
      setCatalystRuntime: port.setCatalystRuntime,
      mutationCores: port.mutationCores,
      setMutationCores: port.setMutationCores,
      resetCapacitor: port.resetCapacitor
    });

    const factory = new RewardOfferFactory({
      randomInt: port.randomInt,
      randomFloat: port.randomFloat,
      nextU32: port.nextU32,
      fortune: port.fortune,
      resonanceLevel: port.resonanceLevel,
      doctrineLevel: port.doctrineLevel,
      slots: port.slots,
      catalystCompatibleEdges: (id) => this.loadout.catalystCompatibleEdges(id)
    });

    this.offers = new ProgressionOfferSystem(
      {
        randomInt: port.randomInt,
        randomFloat: port.randomFloat,
        refusalInt: port.refusalInt,
        slots: port.slots,
        skillReserve: port.skillReserve,
        catalysts: port.catalysts,
        catalystReserve: port.catalystReserve,
        skillState: port.skillState,
        mutationCores: port.mutationCores,
        catalystCompatibleEdges: (id) => this.loadout.catalystCompatibleEdges(id),
        hasFreeSkillPlace: () => this.loadout.hasFreeSkillPlace(),
        hasFreeCatalystPlace: () => this.loadout.hasFreeCatalystPlace()
      },
      factory
    );

    this.mutations = new MutationChoiceSystem(
      {
        randomInt: port.randomInt,
        skillState: port.skillState,
        mutationCores: port.mutationCores,
        setMutationCores: port.setMutationCores,
        noteMutation: port.noteMutation,
        emitMutationChosen: port.emitMutationChosen,
        emitRareEvent: port.emitRareEvent
      },
      this.choices
    );

    this.runtime = new ProgressionRuntime({
      hasChoice: () => this.hasChoice,
      mutationCores: port.mutationCores,
      hasEvolvableSkill: () => this.hasEvolvableSkill(),
      openMutationTargets: () => this.openMutationTargets(),
      eliteCore: port.eliteCore,
      spendEliteCore: port.spendEliteCore,
      openEliteCache: () => this.openEliteCache(),
      xp: port.xp,
      xpNeed: port.xpNeed,
      spendXp: port.spendXp,
      addXp: port.addXp,
      level: port.level,
      setLevel: port.setLevel,
      setXpNeed: port.setXpNeed,
      noteLevel: port.noteLevel,
      openLevelOffers: () => this.openLevelOffers(),
      emitLevelUp: port.emitLevelUp,
      takeReward: (index) => this.choices.takeReward(index),
      rewardOffers: () => this.choices.rewardOffers,
      clearRewards: () => this.choices.clearRewards(),
      canApplyReward: (offer, target) => this.canApplyReward(offer, target),
      reopenRewards: () => this.reopenRewards(),
      rerolls: port.rerolls,
      spendReroll: port.spendReroll,
      beginMutationTarget: () => this.choices.beginMutationTarget(),
      openMutation: (skill) => this.mutations.open(skill),
      grantItem: port.grantItem,
      swapInSkill: (skill, slot) => this.loadout.swapInSkill(skill, slot),
      addSkill: (skill) => this.loadout.addSkill(skill),
      placeCatalyst: (id) => this.loadout.placeCatalyst(id),
      applyDoctrine: port.applyDoctrine,
      applyCoreAxis: port.applyCoreAxis,
      applyGlobal: port.applyGlobal,
      emitRewardChosen: port.emitRewardChosen,
      concedeRefusal: port.concedeRefusal
    });
  }

  get hasChoice() {
    return this.choices.hasChoice;
  }
  get rewardOffers() {
    return this.choices.rewardOffers;
  }
  set rewardOffers(value: RewardOffer[] | null) {
    this.choices.rewardOffers = value;
  }
  get mutationOffer() {
    return this.choices.mutationOffer;
  }
  set mutationOffer(value) {
    this.choices.mutationOffer = value;
  }
  get mutationRefusalToken() {
    return this.choices.mutationRefusalToken;
  }
  set mutationRefusalToken(value: boolean) {
    this.choices.mutationRefusalToken = value;
  }
  get serial() {
    return this.choices.serial;
  }
  set serial(value: number) {
    this.choices.serial = value;
  }
  get pendingMutationTarget() {
    return this.choices.pendingMutationTarget;
  }
  set pendingMutationTarget(value: boolean) {
    this.choices.pendingMutationTarget = value;
  }

  hasUnownedSkills() {
    return this.offers.hasUnownedSkills();
  }
  hasEvolvableSkill() {
    return this.offers.hasEvolvableSkill();
  }
  openDiscovery() {
    this.choices.openRewards(this.offers.discovery(), 'discovery');
  }
  openCatalystDiscovery() {
    this.choices.openRewards(this.offers.catalystDiscovery(), 'catalyst');
  }
  openResonanceChoice() {
    this.choices.openRewards(this.offers.resonanceChoice(), 'resonance');
  }
  openLevelOffers() {
    this.choices.openRewards(this.offers.levelOffers(), 'level');
  }
  get rewardChannel() {
    return this.choices.rewardChannel;
  }

  check() {
    this.runtime.check();
  }
  chooseReward(index: number, target?: number) {
    return this.runtime.chooseReward(index, target);
  }
  canApplyReward(offer: RewardOffer, target?: number) {
    if (offer.kind === 'skill_swap' && offer.skill)
      return this.loadout.canSwapInSkill(offer.skill, target);
    if ((offer.kind === 'skill_add' || offer.kind === 'elite') && offer.skill)
      return this.loadout.canAddSkill(offer.skill);
    if ((offer.kind === 'catalyst_add' || offer.kind === 'elite') && offer.catalyst)
      return this.loadout.canPlaceCatalyst(offer.catalyst);
    return true;
  }
  swapTargetCount() {
    return this.loadout.swapTargetCount();
  }
  rerollRewards() {
    return this.runtime.rerollRewards();
  }
  skipReward() {
    return this.runtime.skipReward();
  }
  chooseMutation(index: number) {
    return this.mutations.choose(index);
  }
  refuseMutation(index: number) {
    return this.mutations.refuse(index);
  }

  allOwnedSkills() {
    return this.loadout.allOwnedSkills();
  }
  allOwnedCatalysts() {
    return this.loadout.allOwnedCatalysts();
  }
  catalystCompatibleEdges(id: CatalystId) {
    return this.loadout.catalystCompatibleEdges(id);
  }
  placeCatalyst(id: CatalystId) {
    return this.loadout.placeCatalyst(id);
  }
  addSkill(id: SkillId) {
    return this.loadout.addSkill(id);
  }
  swapInSkill(id: SkillId, slot: number) {
    return this.loadout.swapInSkill(id, slot);
  }
  swapSkillLocations(
    zoneA: 'active' | 'reserve',
    indexA: number,
    zoneB: 'active' | 'reserve',
    indexB: number
  ) {
    return this.loadout.swapSkillLocations(zoneA, indexA, zoneB, indexB);
  }
  swapCatalystLocations(
    zoneA: 'active' | 'reserve',
    indexA: number,
    zoneB: 'active' | 'reserve',
    indexB: number
  ) {
    return this.loadout.swapCatalystLocations(zoneA, indexA, zoneB, indexB);
  }

  private openMutationTargets() {
    const offers = this.offers.mutationTargetOffers();
    if (offers.length) this.choices.openRewards(offers, 'mutation_target');
  }
  private openEliteCache() {
    this.choices.openRewards(this.offers.eliteCache(), 'elite');
  }
  /** Reroll stays inside the source that opened the window. */
  private reopenRewards() {
    const channel = this.choices.rewardChannel;
    if (channel === 'discovery') this.openDiscovery();
    else if (channel === 'catalyst') this.openCatalystDiscovery();
    else if (channel === 'resonance') this.openResonanceChoice();
    else if (channel === 'elite') this.openEliteCache();
    else if (channel === 'mutation_target') this.openMutationTargets();
    else this.openLevelOffers();
  }
}
