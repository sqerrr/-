import {
  catalystPairCompatible,
  phenomenonChoreography
} from '../content/definitions.js';
import type {
  CatalystBinding,
  ChoreographyPoint,
  ChoreographyTrace,
  PhysicalEvent
} from './state.js';
import type { CatalystId, SkillId } from './types.js';

export type PhysicalCatalystId =
  | 'source'
  | 'carrier'
  | 'trail'
  | 'reverse'
  | 'collapse';

export interface PhysicalActivationPort {
  catalystAt(slot: number): CatalystId | null;
  skillAt(slot: number): SkillId | null;
  addBinding(binding: CatalystBinding): void;
  queueEvent(event: PhysicalEvent): void;
}

/**
 * Creates Catalyst 2.x causal bindings and publishes immediate physical evidence from a cast trace.
 *
 * PhysicalLifecycle owns storage/lifetime; PhysicalCatalystSystem consumes the events. This layer
 * is the protocol between a Phenomenon activation and those two runtime owners.
 */
export class PhysicalActivationSystem {
  constructor(private readonly port: PhysicalActivationPort) {}

  isPhysicalCatalyst(id: CatalystId | null): id is PhysicalCatalystId {
    return (
      id === 'source' ||
      id === 'carrier' ||
      id === 'trail' ||
      id === 'reverse' ||
      id === 'collapse'
    );
  }

  armOutgoing(
    fromSlot: number,
    fromSkill: SkillId,
    activationId: number,
    origin: ChoreographyPoint
  ) {
    const catalyst = this.port.catalystAt(fromSlot);
    const toSlot = fromSlot + 1;
    const toSkill = this.port.skillAt(toSlot);

    if (!this.isPhysicalCatalyst(catalyst) || !toSkill) return false;
    if (!catalystPairCompatible(catalyst, fromSkill, toSkill)) return false;

    this.port.addBinding({
      producerActivationId: activationId,
      fromSlot,
      toSlot,
      fromSkill,
      toSkill,
      mode: catalyst,
      origin: { ...origin },
      path: [],
      areaPoints: [],
      nextTrailDistance: toSkill === 'sentry' ? 1.8 : 1.35,
      firedCount: 0,
      carrierKeys: new Set<string>(),
      pathCarrierKey: null,
      done: false
    });
    return true;
  }

  publishImmediate(
    skill: SkillId,
    slot: number,
    activationId: number,
    trace: ChoreographyTrace | null
  ) {
    if (!trace || !activationId) return;

    const asyncSkill =
      skill === 'mortar_bloom' ||
      skill === 'mass_driver' ||
      skill === 'shard_fan';

    if (!asyncSkill && phenomenonChoreography[skill].emits.includes('path')) {
      const path = this.tracePath(trace);
      for (let index = 1; index < path.length; index++) {
        this.port.queueEvent({
          activationId,
          slot,
          skill,
          kind: 'path',
          previousX: path[index - 1].x,
          previousZ: path[index - 1].z,
          x: path[index].x,
          z: path[index].z
        });
      }
    }

    if (
      trace.areas.length &&
      phenomenonChoreography[skill].emits.includes('area')
    ) {
      for (const shape of trace.areas) {
        const radius =
          shape.kind === 'ray' ? shape.halfWidth : shape.radius;
        const areaPoints: ChoreographyPoint[] = [];

        if (shape.kind === 'circle') {
          for (let index = 0; index < 4; index++) {
            const angle = index * Math.PI / 2;
            areaPoints.push({
              x: shape.x + Math.cos(angle) * shape.radius,
              z: shape.z + Math.sin(angle) * shape.radius
            });
          }
        } else if (shape.kind === 'sector') {
          const base = Math.atan2(shape.aimZ, shape.aimX);
          for (const offset of [-shape.halfAngle, 0, shape.halfAngle]) {
            const angle = base + offset;
            areaPoints.push({
              x: shape.x + Math.cos(angle) * shape.radius,
              z: shape.z + Math.sin(angle) * shape.radius
            });
          }
        }

        this.port.queueEvent({
          activationId,
          slot,
          skill,
          kind: 'area',
          x: shape.x,
          z: shape.z,
          radius,
          areaPoints,
          shape: { ...shape }
        });
      }
    }

    if (
      !asyncSkill &&
      trace.terminal &&
      (
        skill === 'rail_spear' ||
        skill === 'cleaver' ||
        skill === 'chain_arc' ||
        skill === 'tether_drag'
      )
    ) {
      this.port.queueEvent({
        activationId,
        slot,
        skill,
        kind: 'terminal',
        x: trace.terminal.x,
        z: trace.terminal.z
      });
    }
  }

  private tracePath(trace: ChoreographyTrace) {
    let best: ChoreographyPoint[] = [];
    let bestLength = 0;

    for (const path of trace.paths) {
      let length = 0;
      for (let index = 1; index < path.length; index++)
        length += Math.hypot(
          path[index].x - path[index - 1].x,
          path[index].z - path[index - 1].z
        );

      if (length > bestLength) {
        bestLength = length;
        best = path;
      }
    }

    if (best.length >= 2) return best.map((point) => ({ ...point }));

    if (
      trace.terminal &&
      Math.hypot(
        trace.origin.x - trace.terminal.x,
        trace.origin.z - trace.terminal.z
      ) > 0.05
    ) {
      return [{ ...trace.origin }, { ...trace.terminal }];
    }

    return [];
  }
}
