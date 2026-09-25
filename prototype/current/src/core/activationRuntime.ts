import type { ActivationContext, ChoreographyTrace } from './state.js';
import type { SkillId } from './types.js';

export interface ActivationFrame {
  slot: number;
  hits: Set<number>;
  damage: number;
  kills: number;
  overkill: number;
  control: number;
  producedState: string;
  scale: number;
  countBonus: number;
  derived: boolean;
}

type DerivedPatch = {
  slot?: number;
  scale?: number;
};

/**
 * Owns the short-lived transaction state of a Phenomenon activation.
 *
 * This is deliberately separate from PhysicalLifecycle: PhysicalLifecycle tracks causal actors
 * that may outlive a beat, while ActivationRuntime tracks the synchronous scoring/context frame
 * used while one cast (or nested Catalyst payload) is resolving.
 */
export class ActivationRuntime {
  slot = -1;
  hits = new Set<number>();
  damage = 0;
  kills = 0;
  overkill = 0;
  control = 0;
  producedState = '';
  scale = 1;
  countBonus = 0;
  derived = false;

  context: ActivationContext = this.emptyContext(0, 0);

  begin(slot: number, derived = false) {
    this.slot = slot;
    this.hits = new Set<number>();
    this.damage = 0;
    this.kills = 0;
    this.overkill = 0;
    this.control = 0;
    this.producedState = '';
    this.scale = 1;
    this.countBonus = 0;
    this.derived = derived;
  }

  end() {
    this.slot = -1;
    this.scale = 1;
    this.countBonus = 0;
    this.derived = false;
  }

  suspend(): ActivationFrame {
    return {
      slot: this.slot,
      hits: this.hits,
      damage: this.damage,
      kills: this.kills,
      overkill: this.overkill,
      control: this.control,
      producedState: this.producedState,
      scale: this.scale,
      countBonus: this.countBonus,
      derived: this.derived
    };
  }

  restore(frame: ActivationFrame) {
    this.slot = frame.slot;
    this.hits = frame.hits;
    this.damage = frame.damage;
    this.kills = frame.kills;
    this.overkill = frame.overkill;
    this.control = frame.control;
    this.producedState = frame.producedState;
    this.scale = frame.scale;
    this.countBonus = frame.countBonus;
    this.derived = frame.derived;
  }

  withDerived<T>(patch: DerivedPatch, run: () => T): T {
    const slot = this.slot;
    const scale = this.scale;
    const derived = this.derived;

    if (patch.slot !== undefined) this.slot = patch.slot;
    if (patch.scale !== undefined) this.scale = patch.scale;
    this.derived = true;

    try {
      return run();
    } finally {
      this.slot = slot;
      this.scale = scale;
      this.derived = derived;
    }
  }

  addControl(amount: number) {
    this.control += amount;
  }

  noteState(state: string) {
    if (!this.producedState) this.producedState = state;
  }

  recordHit(entityId: number, amount: number) {
    this.hits.add(entityId);
    this.damage += amount;
  }

  recordKill(overkill: number) {
    this.kills++;
    this.overkill += Math.max(0, overkill);
  }

  publishContext(
    skill: SkillId,
    x: number,
    z: number,
    trace: ChoreographyTrace | null
  ): ActivationContext {
    const previous = this.context;
    this.context = {
      skill,
      damage: this.damage,
      kills: this.kills,
      overkill: this.overkill,
      control: this.control,
      state: this.producedState,
      hitIds: [...this.hits],
      x,
      z,
      trace
    };
    return previous;
  }

  clearContext(x: number, z: number) {
    this.context = this.emptyContext(x, z);
  }

  private emptyContext(x: number, z: number): ActivationContext {
    return {
      skill: null,
      damage: 0,
      kills: 0,
      overkill: 0,
      control: 0,
      state: '',
      hitIds: [],
      x,
      z,
      trace: null
    };
  }
}
