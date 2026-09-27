import {
  mutationChildren,
  mutationDef,
  mutationRoots,
  skills
} from '../content/definitions.js';
import { ChoiceRuntime } from './choiceRuntime.js';
import type { MutationId, SkillId, SkillRuntime } from './types.js';

export interface MutationChoicePort {
  randomInt(maxExclusive: number): number;
  skillState(id: SkillId): SkillRuntime;
  mutationCores(): number;
  setMutationCores(value: number): void;
  noteMutation(): void;
  emitMutationChosen(skill: SkillId, mutation: MutationId): void;
  emitRareEvent(title: string, detail: string): void;
}

/**
 * Owns mutation branch selection and application.
 *
 * ChoiceRuntime still owns the transient modal state. This system owns the mutation graph rules:
 * which tier is open, Tier-I branch randomisation, refusal replacement, branch continuity and
 * mutation-core consumption.
 */
export class MutationChoiceSystem {
  static readonly BRANCHES = 3;

  constructor(
    private readonly port: MutationChoicePort,
    private readonly choices: ChoiceRuntime
  ) {}

  open(skill: SkillId) {
    const state = this.port.skillState(skill);
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
    const candidates = parent
      ? mutationChildren(skill, parent).map((mutation) => mutation.id)
      : mutationRoots(skill).map((mutation) => mutation.id);

    this.choices.openMutation({
      skill,
      choices:
        tier === 1
          ? this.shuffle([...candidates]).slice(0, MutationChoiceSystem.BRANCHES)
          : candidates,
      refusalAvailable: tier === 1 && this.choices.mutationRefusalToken,
      tier
    });
  }

  choose(index: number) {
    const offer = this.choices.mutationOffer;
    if (!offer) return false;

    const mutation = this.choices.mutationChoice(index);
    if (!mutation) return false;

    const state = this.port.skillState(offer.skill);
    const definition = mutationDef(offer.skill, mutation);

    if (!definition.parent) {
      if (state.mutation) return false;
      state.mutation = mutation;
    } else if (state.mutation === definition.parent) {
      if (state.mutationUpgrade) return false;
      state.mutationUpgrade = mutation;
    } else if (state.mutationUpgrade === definition.parent) {
      if (state.mutationApotheosis) return false;
      state.mutationApotheosis = mutation;
      this.port.emitRareEvent(
        'АПОФЕОЗ',
        `${skills[offer.skill].name}: ${definition.name}`
      );
    } else {
      return false;
    }

    if (this.choices.consumeMutationTarget() && this.port.mutationCores() > 0)
      this.port.setMutationCores(this.port.mutationCores() - 1);

    this.port.noteMutation();
    this.port.emitMutationChosen(offer.skill, mutation);
    this.choices.closeMutation();
    return true;
  }

  refuse(index: number) {
    const offer = this.choices.mutationOffer;
    if (!offer || !this.choices.canRefuseMutation()) return false;

    const current = new Set(offer.choices);
    const alternatives = mutationRoots(offer.skill)
      .map((mutation) => mutation.id)
      .filter((mutation) => !current.has(mutation));
    if (!alternatives.length) return false;

    const replacement = alternatives[this.port.randomInt(alternatives.length)];
    return this.choices.replaceMutationChoice(index, replacement);
  }

  private shuffle<T>(values: T[]) {
    for (let index = values.length - 1; index > 0; index--) {
      const swap = this.port.randomInt(index + 1);
      [values[index], values[swap]] = [values[swap], values[index]];
    }
    return values;
  }
}
