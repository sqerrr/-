import { phenomenonChoreography } from '../content/definitions.js';
import type { SkillId } from './types.js';
import type { CatalystBinding, ChoreographyPoint, PhysicalEvent } from './state.js';

/**
 * Owns the causal bookkeeping for physical Phenomenon activations.
 *
 * Simulation still decides what a Catalyst does. This class owns when an activation is alive,
 * which physical events belong to it, and when it is safe to retire. Keeping that state in one
 * place prevents queue/cleanup ordering from being spread across the entire Simulation object.
 */
export class PhysicalLifecycle {
  private nextActivationId = 1;
  currentActivationId = 0;
  orbitActivationId = 0;

  private bindings: CatalystBinding[] = [];
  private events: PhysicalEvent[] = [];
  private draining = false;
  private pending = new Map<number, number>();
  private completed = new Set<number>();
  private terminalSeen = new Set<number>();
  private lastPoint = new Map<number, ChoreographyPoint>();
  private meta = new Map<number, { skill: SkillId; slot: number }>();

  begin(slot: number, skill: SkillId, origin: ChoreographyPoint) {
    const id = this.nextActivationId++;
    this.currentActivationId = id;
    this.meta.set(id, { skill, slot });
    this.lastPoint.set(id, { ...origin });
    return id;
  }

  addBinding(binding: CatalystBinding) {
    this.bindings.push(binding);
  }

  registerAsync(activationId: number) {
    if (activationId <= 0) return;
    this.pending.set(activationId, (this.pending.get(activationId) ?? 0) + 1);
  }

  finishAsync(activationId: number | undefined, x: number, z: number) {
    if (!activationId) return;
    this.setLastPoint(activationId, { x, z });
    const n = Math.max(0, (this.pending.get(activationId) ?? 1) - 1);
    if (n > 0) {
      this.pending.set(activationId, n);
      return;
    }
    this.pending.delete(activationId);
    const meta = this.meta.get(activationId);
    if (
      meta &&
      phenomenonChoreography[meta.skill].emits.includes('terminal') &&
      !this.terminalSeen.has(activationId)
    ) {
      this.queue({
        activationId,
        slot: meta.slot,
        skill: meta.skill,
        kind: 'terminal',
        x,
        z
      });
    }
    this.completed.add(activationId);
  }

  queue(event: PhysicalEvent) {
    if (!event.activationId) return;
    this.events.push(event);
    if (event.kind === 'terminal') this.terminalSeen.add(event.activationId);
    this.setLastPoint(event.activationId, { x: event.x, z: event.z });
  }

  setLastPoint(activationId: number, point: ChoreographyPoint) {
    if (!activationId) return;
    this.lastPoint.set(activationId, { ...point });
  }

  flush(
    handle: (binding: CatalystBinding, event: PhysicalEvent) => void,
    hasOwnedConstruct: (activationId: number) => boolean
  ) {
    if (this.draining) return;
    this.draining = true;
    let guard = 0;
    try {
      while (this.events.length && guard++ < 256) {
        const event = this.events.shift()!;
        for (const binding of this.bindings) handle(binding, event);
      }
    } finally {
      this.draining = false;
    }

    if (this.completed.size) {
      this.bindings = this.bindings.filter(
        (binding) => !binding.done && !this.completed.has(binding.producerActivationId)
      );
      for (const id of [...this.completed]) this.retire(id);
      this.completed.clear();
    } else {
      this.bindings = this.bindings.filter((binding) => !binding.done);
    }

    for (const id of [...this.meta.keys()]) this.retireIfIdle(id, hasOwnedConstruct);
  }

  diagnostics() {
    return {
      bindings: this.bindings.map((binding) => ({
        ...binding,
        origin: { ...binding.origin },
        path: binding.path.map((point) => ({ ...point })),
        areaPoints: binding.areaPoints.map((point) => ({ ...point })),
        carrierKeys: new Set(binding.carrierKeys)
      })),
      pendingCount: this.pending.size,
      metadataCount: this.meta.size,
      queuedEventCount: this.events.length
    };
  }

  private retireIfIdle(id: number, hasOwnedConstruct: (activationId: number) => boolean) {
    if (
      !id ||
      this.pending.has(id) ||
      id === this.orbitActivationId ||
      this.bindings.some((binding) => !binding.done && binding.producerActivationId === id) ||
      hasOwnedConstruct(id)
    ) return;
    this.retire(id);
  }

  private retire(id: number) {
    if (!id) return;
    this.meta.delete(id);
    this.lastPoint.delete(id);
    this.terminalSeen.delete(id);
    this.completed.delete(id);
  }
}
