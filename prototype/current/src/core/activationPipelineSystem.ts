import { catalystPairCompatible } from '../content/definitions.js';
import { ActivationRuntime } from './activationRuntime.js';
import { ChoreographyTraceSystem } from './choreographyTraceSystem.js';
import { LegacyCatalystSystem } from './legacyCatalystSystem.js';
import { PhysicalActivationSystem } from './physicalActivationSystem.js';
import { PhysicalLifecycle } from './physicalLifecycle.js';
import type { CatalystBinding, CastSource, ChoreographyPoint } from './state.js';
import type { CatalystId, SkillId, SkillRuntime } from './types.js';

export interface ActivationPipelinePort {
  activeSpan(): number;
  skillAt(slot: number): SkillId | null;
  skillRuntime(skill: SkillId): SkillRuntime | undefined;
  incomingCatalyst(slot: number): CatalystId | null;
  conductivity(): number;

  playerPosition(): ChoreographyPoint;
  aim(): ChoreographyPoint;
  setAim(x: number, z: number): void;
  heroSource(): CastSource;
  choreographySource(x: number, z: number, aimX?: number, aimZ?: number): CastSource;
  entityPosition(id: number): ChoreographyPoint | null;

  castWithTrace(skill: SkillId, runtime: SkillRuntime, slot: number, source: CastSource): void;
  prepareOrbitPayload(x: number, z: number): void;
  noteActivation(): void;
  flushPhysicalEvents(): void;
}

/**
 * Application-layer coordinator for one Phenomenon-chain activation.
 *
 * Runtime state, trace evidence and physical causal lifetime each have their own owners. This
 * class only defines the ordering contract between them: defer physical payload nodes, apply
 * legacy compatibility, cast, publish evidence/context, then close the synchronous frame.
 */
export class ActivationPipelineSystem {
  constructor(
    private readonly port: ActivationPipelinePort,
    private readonly activation: ActivationRuntime,
    private readonly choreography: ChoreographyTraceSystem,
    private readonly physical: PhysicalLifecycle,
    private readonly physicalActivations: PhysicalActivationSystem,
    private readonly legacyCatalysts: LegacyCatalystSystem
  ) {}

  activate(slot: number): boolean {
    const id = this.port.skillAt(slot);
    if (!id) return false;

    const runtime = this.port.skillRuntime(id);
    if (!runtime) return false;

    // A compatible physical Catalyst owns the right node completely. B is a payload of A,
    // not an independent clocked cast, even if A resolves after a later chain beat.
    const incomingPhysical = this.port.incomingCatalyst(slot);
    const producerSkill = slot > 0 ? this.port.skillAt(slot - 1) : null;
    if (
      this.physicalActivations.isPhysicalCatalyst(incomingPhysical) &&
      producerSkill &&
      catalystPairCompatible(incomingPhysical, producerSkill, id)
    )
      return false;

    const player = this.port.playerPosition();
    const aim = this.port.aim();

    this.activation.begin(slot);
    const activationId = this.physical.begin(slot, id, player);
    this.choreography.begin(id, player, aim.x, aim.z);

    const incoming = this.port.incomingCatalyst(slot);
    const legacyBefore = this.legacyCatalysts.beforeCast({
      catalyst: incoming,
      slot,
      conductivity: this.port.conductivity(),
      previous: this.activation.context,
      aimX: aim.x,
      aimZ: aim.z,
      activationScale: this.activation.scale,
      activationCountBonus: this.activation.countBonus
    });

    this.port.setAim(legacyBefore.aimX, legacyBefore.aimZ);
    this.activation.scale = legacyBefore.activationScale;
    this.activation.countBonus = legacyBefore.activationCountBonus;

    this.port.noteActivation();
    try {
      // Catalyst 2.x never teleports B onto this beat. A's live physical lifecycle decides
      // when and where a compatible payload fires.
      this.port.castWithTrace(id, runtime, slot, this.port.heroSource());
    } finally {
      this.port.setAim(aim.x, aim.z);
    }

    this.legacyCatalysts.afterCast({
      catalyst: incoming,
      slot,
      skill: id,
      runtime,
      conductivity: this.port.conductivity(),
      previous: this.activation.context,
      currentHits: this.activation.hits,
      currentKills: this.activation.kills
    });

    const center = this.hitCenter(player);
    const trace = this.choreography.finish();
    const physicalOrigin = trace?.origin ?? player;

    this.physical.setLastPoint(activationId, physicalOrigin);
    this.physicalActivations.armOutgoing(slot, id, activationId, physicalOrigin);
    this.physicalActivations.publishImmediate(id, slot, activationId, trace);
    this.port.flushPhysicalEvents();

    const previous = this.activation.publishContext(id, center.x, center.z, trace);
    this.legacyCatalysts.afterContextPublished({
      catalyst: incoming,
      slot,
      conductivity: this.port.conductivity(),
      previous,
      targetX: center.x,
      targetZ: center.z
    });

    if (slot === this.port.activeSpan() - 1) {
      const currentPlayer = this.port.playerPosition();
      this.activation.clearContext(currentPlayer.x, currentPlayer.z);
    }

    this.activation.end();
    this.physical.currentActivationId = 0;
    this.choreography.clear();
    return true;
  }

  castPayload(
    binding: CatalystBinding,
    x: number,
    z: number,
    aimX?: number,
    aimZ?: number
  ): boolean {
    const runtime = this.port.skillRuntime(binding.toSkill);
    if (!runtime) return false;

    const activationFrame = this.activation.suspend();
    const previousActivationId = this.physical.currentActivationId;
    const previousChoreography = this.choreography.suspend();

    this.activation.begin(binding.toSlot, true);

    try {
      const source = this.port.choreographySource(x, z, aimX, aimZ);
      const activationId = this.physical.begin(
        binding.toSlot,
        binding.toSkill,
        { x: source.x, z: source.z }
      );

      if (binding.toSkill === 'orbit_blades')
        this.port.prepareOrbitPayload(source.x, source.z);

      this.choreography.begin(
        binding.toSkill,
        { x: source.x, z: source.z },
        source.aimX,
        source.aimZ
      );

      this.port.noteActivation();
      this.port.castWithTrace(binding.toSkill, runtime, binding.toSlot, source);

      const trace = this.choreography.finish();
      const physicalOrigin = trace?.origin ?? { x: source.x, z: source.z };

      this.physical.setLastPoint(activationId, physicalOrigin);
      this.physicalActivations.armOutgoing(
        binding.toSlot,
        binding.toSkill,
        activationId,
        physicalOrigin
      );
      this.physicalActivations.publishImmediate(
        binding.toSkill,
        binding.toSlot,
        activationId,
        trace
      );
      return true;
    } finally {
      this.activation.restore(activationFrame);
      this.physical.currentActivationId = previousActivationId;
      this.choreography.resume(previousChoreography);
    }
  }

  private hitCenter(fallback: ChoreographyPoint): ChoreographyPoint {
    if (!this.activation.hits.size) return { ...fallback };

    let x = 0;
    let z = 0;
    let count = 0;
    for (const id of this.activation.hits) {
      const point = this.port.entityPosition(id);
      if (!point) continue;
      x += point.x;
      z += point.z;
      count++;
    }

    return count ? { x: x / count, z: z / count } : { ...fallback };
  }
}
