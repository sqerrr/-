import { skills } from '../content/definitions.js';
import { combatShapeIntersectsCircle, pointAlongPolyline, polylineLength } from './geometry.js';
import type { CatalystBinding, ChoreographyPoint, Ent, PhysicalEvent } from './state.js';
import type { GameEvent } from './types.js';

export interface PhysicalCatalystPort {
  time(): number;
  tick(): number;
  aimX(): number;
  aimZ(): number;
  entities(): readonly Ent[];

  castPayload(
    binding: CatalystBinding,
    x: number,
    z: number,
    aimX?: number,
    aimZ?: number
  ): boolean;
  emit(event: GameEvent): void;
  noteReaction(): void;
}

/**
 * Catalyst 2.x physical binding policy.
 *
 * PhysicalLifecycle owns causal queues/binding lifetime. This system owns how source/carrier/
 * trail/reverse/collapse consume real physical events and where/when the payload Phenomenon fires.
 */
export class PhysicalCatalystSystem {
  constructor(private readonly port: PhysicalCatalystPort) {}

  handle(binding: CatalystBinding, event: PhysicalEvent) {
    if (binding.done || event.activationId !== binding.producerActivationId) return;

    const eventCarrierKey =
      event.carrierKind && event.carrierId !== undefined
        ? event.carrierKind + ':' + event.carrierId
        : null;

    if ((binding.mode === 'trail' || binding.mode === 'reverse') && eventCarrierKey) {
      if (!binding.pathCarrierKey) binding.pathCarrierKey = eventCarrierKey;
      else if (binding.pathCarrierKey !== eventCarrierKey) return;
    }

    if (
      (binding.mode === 'trail' || binding.mode === 'reverse') &&
      event.kind === 'path'
    ) {
      if (event.previousX !== undefined && event.previousZ !== undefined) {
        this.appendPath(binding, [
          { x: event.previousX, z: event.previousZ },
          { x: event.x, z: event.z }
        ]);
      } else {
        this.appendPath(binding, [{ x: event.x, z: event.z }]);
      }
    } else if (
      (binding.mode === 'trail' || binding.mode === 'reverse') &&
      (event.kind === 'impact' || event.kind === 'contact' || event.kind === 'terminal')
    ) {
      const last = binding.path[binding.path.length - 1];
      if (last) this.appendPath(binding, [last, { x: event.x, z: event.z }]);
    }

    if (binding.mode === 'source' && event.kind === 'terminal') {
      if (this.port.castPayload(binding, event.x, event.z)) {
        binding.firedCount = 1;
        binding.done = true;
        this.emitChoreography('source', binding, [
          binding.origin,
          { x: event.x, z: event.z }
        ]);
      }
      return;
    }

    if (
      binding.mode === 'carrier' &&
      (event.kind === 'contact' || event.kind === 'impact') &&
      event.carrierKind &&
      event.carrierId !== undefined
    ) {
      const key = event.carrierKind + ':' + event.carrierId;
      if (binding.carrierKeys.has(key) || binding.firedCount >= 3) return;
      binding.carrierKeys.add(key);

      if (this.port.castPayload(binding, event.x, event.z)) {
        binding.firedCount++;
        this.emitChoreography('carrier', binding, [{ x: event.x, z: event.z }]);
      }
      if (binding.firedCount >= 3) binding.done = true;
      return;
    }

    if (
      binding.mode === 'trail' &&
      (event.kind === 'path' || event.kind === 'impact' || event.kind === 'terminal')
    ) {
      const spacing = binding.toSkill === 'sentry' ? 4.2 : 3.0;
      const max = binding.toSkill === 'sentry' ? 6 : 4;
      let length = polylineLength(binding.path);

      while (
        binding.firedCount < max &&
        length + 1e-6 >= binding.nextTrailDistance
      ) {
        const point = pointAlongPolyline(binding.path, binding.nextTrailDistance);
        if (!point) break;

        const aim = this.trailAim(binding, binding.nextTrailDistance);
        if (
          this.port.castPayload(binding, point.x, point.z, aim.x, aim.z)
        )
          binding.firedCount++;

        binding.nextTrailDistance += spacing;
        length = polylineLength(binding.path);
      }

      if (event.kind === 'terminal') {
        if (!binding.firedCount)
          this.port.castPayload(binding, event.x, event.z);
        binding.done = true;
        this.emitChoreography(
          'trail',
          binding,
          binding.path.length
            ? binding.path
            : [{ x: event.x, z: event.z }]
        );
      }
      return;
    }

    if (binding.mode === 'reverse' && event.kind === 'terminal') {
      // Reverse requires a physically traversed path; a bare endpoint never fabricates one.
      if (binding.path.length < 2) {
        binding.done = true;
        return;
      }

      const path = binding.path;
      const end = path[path.length - 1];
      const previous = path[path.length - 2];
      const dx = previous.x - end.x;
      const dz = previous.z - end.z;

      if (this.port.castPayload(binding, end.x, end.z, dx, dz)) {
        binding.firedCount = 1;
        binding.done = true;
        this.emitChoreography('reverse', binding, [...path].reverse());
      }
      return;
    }

    if (
      binding.mode === 'collapse' &&
      (event.kind === 'area' || event.kind === 'impact')
    )
      this.fireCollapse(binding, event);
  }

  private fireCollapse(binding: CatalystBinding, event: PhysicalEvent) {
    const multiArea =
      binding.fromSkill === 'mortar_bloom' ||
      binding.fromSkill === 'sentry' ||
      binding.fromSkill === 'orbit_blades' ||
      binding.fromSkill === 'tether_drag';

    // Orbit is one continuous actor: Collapse relocates it once, never clones it per area.
    const limit =
      binding.toSkill === 'orbit_blades'
        ? 1
        : multiArea
          ? 3
          : 1;
    if (binding.firedCount >= limit) return;

    const center = { x: event.x, z: event.z };
    const radius = Math.max(0.35, event.radius ?? 1);
    const shape =
      event.shape ??
      ({ kind: 'circle', x: event.x, z: event.z, radius } as const);

    const outer = event.areaPoints?.length
      ? event.areaPoints
      : shape.kind === 'sector'
        ? [-shape.halfAngle, 0, shape.halfAngle].map((offset) => {
            const angle = Math.atan2(shape.aimZ, shape.aimX) + offset;
            return {
              x: shape.x + Math.cos(angle) * shape.radius,
              z: shape.z + Math.sin(angle) * shape.radius
            };
          })
        : [0, 1, 2, 3].map((index) => {
            const angle = (index * Math.PI) / 2;
            return {
              x: center.x + Math.cos(angle) * radius,
              z: center.z + Math.sin(angle) * radius
            };
          });

    binding.areaPoints.push(...outer.map((point) => ({ ...point })));

    if (skills[binding.toSkill].directional) {
      const spokes =
        outer.length <= 4
          ? outer
          : [outer[0], outer[Math.floor(outer.length / 2)]];

      for (const point of spokes)
        this.port.castPayload(
          binding,
          point.x,
          point.z,
          center.x - point.x,
          center.z - point.z
        );
    } else {
      for (const target of this.port.entities()) {
        if (
          target.hp <= 0 ||
          !combatShapeIntersectsCircle(
            shape,
            target.x,
            target.z,
            target.radius
          )
        )
          continue;

        const dx = center.x - target.x;
        const dz = center.z - target.z;
        const distance = Math.hypot(dx, dz) || 1;
        target.x +=
          (dx / distance) * Math.min(1.1, distance * 0.35);
        target.z +=
          (dz / distance) * Math.min(1.1, distance * 0.35);
        target.displacedUntil = Math.max(
          target.displacedUntil,
          this.port.time() + 0.55
        );
      }

      this.port.castPayload(binding, center.x, center.z);
    }

    binding.firedCount++;
    if (binding.firedCount >= limit) binding.done = true;
    this.emitChoreography(binding.mode, binding, [...outer, center]);
  }

  private appendPath(binding: CatalystBinding, points: ChoreographyPoint[]) {
    for (const point of points) {
      const last = binding.path[binding.path.length - 1];
      if (!last || !this.samePoint(last, point, 0.08))
        binding.path.push({ ...point });
    }
  }

  private trailAim(binding: CatalystBinding, distance: number) {
    const a = pointAlongPolyline(
      binding.path,
      Math.max(0, distance - 0.22)
    );
    const b = pointAlongPolyline(binding.path, distance + 0.22);
    if (!a || !b)
      return { x: this.port.aimX(), z: this.port.aimZ() };

    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const magnitude = Math.hypot(dx, dz) || 1;
    return { x: dx / magnitude, z: dz / magnitude };
  }

  private emitChoreography(
    mode: CatalystBinding['mode'],
    binding: CatalystBinding,
    points: ChoreographyPoint[]
  ) {
    if (!points.length) return;

    const centerX =
      points.reduce((sum, point) => sum + point.x, 0) / points.length;
    const centerZ =
      points.reduce((sum, point) => sum + point.z, 0) / points.length;

    this.port.emit({
      type: 'CatalystChoreography',
      tick: this.port.tick(),
      catalyst: mode,
      fromSlot: binding.fromSlot,
      toSlot: binding.toSlot,
      fromSkill: binding.fromSkill,
      toSkill: binding.toSkill,
      mode,
      points: points.slice(0, 8).map((point) => ({ ...point })),
      centerX,
      centerZ
    });
    this.port.noteReaction();
  }

  private samePoint(a: ChoreographyPoint, b: ChoreographyPoint, epsilon = 0.05) {
    return Math.hypot(a.x - b.x, a.z - b.z) <= epsilon;
  }
}
