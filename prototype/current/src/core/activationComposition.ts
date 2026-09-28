import { ActivationPipelineSystem, type ActivationPipelinePort } from './activationPipelineSystem.js';
import { ActivationRuntime } from './activationRuntime.js';
import { ChoreographyTraceSystem } from './choreographyTraceSystem.js';
import { LegacyCatalystSystem, type LegacyCatalystPort } from './legacyCatalystSystem.js';
import { PhysicalActivationSystem } from './physicalActivationSystem.js';
import { PhysicalCatalystSystem } from './physicalCatalystSystem.js';
import { PhysicalLifecycle } from './physicalLifecycle.js';
import type { CatalystBinding, PhysicalEvent } from './state.js';
import type { CatalystId, GameEvent } from './types.js';

export interface ActivationCompositionPort
  extends LegacyCatalystPort,
    ActivationPipelinePort {
  catalystAt(slot: number): CatalystId | null;
  addBinding(binding: CatalystBinding): void;
  queueEvent(event: PhysicalEvent): void;
  emit(event: GameEvent): void;
}

/**
 * Composition boundary for the complete Phenomenon activation/Catalyst protocol.
 *
 * Catalyst 1.x compatibility remains executable for old seeds/replays, but it is deliberately
 * hidden behind the same activation boundary as Catalyst 2.x. Simulation only drives chain
 * activation and publishes physical events; it no longer knows which protocol implementation
 * handles them.
 */
export class ActivationComposition {
  private readonly legacy: LegacyCatalystSystem;
  private readonly physicalActivations: PhysicalActivationSystem;
  private readonly pipeline: ActivationPipelineSystem;
  private readonly physicalCatalysts: PhysicalCatalystSystem;

  constructor(
    port: ActivationCompositionPort,
    activation: ActivationRuntime,
    choreography: ChoreographyTraceSystem,
    physical: PhysicalLifecycle
  ) {
    this.legacy = new LegacyCatalystSystem(port);

    this.physicalActivations = new PhysicalActivationSystem({
      catalystAt: (slot) => port.catalystAt(slot),
      skillAt: (slot) => port.skillAt(slot),
      addBinding: (binding) => port.addBinding(binding),
      queueEvent: (event) => port.queueEvent(event)
    });

    this.pipeline = new ActivationPipelineSystem(
      port,
      activation,
      choreography,
      physical,
      this.physicalActivations,
      this.legacy
    );

    this.physicalCatalysts = new PhysicalCatalystSystem({
      time: () => port.time(),
      tick: () => port.tick(),
      aimX: () => port.aim().x,
      aimZ: () => port.aim().z,
      entities: () => port.entities(),
      castPayload: (binding, x, z, aimX, aimZ) =>
        this.pipeline.castPayload(binding, x, z, aimX, aimZ),
      emit: (event) => port.emit(event),
      noteReaction: () => port.noteReaction()
    });
  }

  activate(slot: number) {
    return this.pipeline.activate(slot);
  }

  castPayload(
    binding: CatalystBinding,
    x: number,
    z: number,
    aimX?: number,
    aimZ?: number
  ) {
    return this.pipeline.castPayload(binding, x, z, aimX, aimZ);
  }

  handlePhysical(binding: CatalystBinding, event: PhysicalEvent) {
    this.physicalCatalysts.handle(binding, event);
  }
}
