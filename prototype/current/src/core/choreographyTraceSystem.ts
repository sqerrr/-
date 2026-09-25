import type {
  ChoreographyCarrier,
  ChoreographyPoint,
  ChoreographyTrace
} from './state.js';
import type { CombatShape, SkillId } from './types.js';

/**
 * Owns the mutable evidence collected while one Phenomenon activation is being choreographed.
 *
 * Simulation decides when an activation starts and which world objects were created. This class
 * owns how that evidence is de-duplicated, how authored terminal semantics are resolved, and how a
 * finished immutable-by-convention trace is published to the physical Catalyst protocol.
 */
export class ChoreographyTraceSystem {
  private trace: ChoreographyTrace | null = null;

  get active() {
    return this.trace !== null;
  }

  matchesSkill(skill: SkillId) {
    return this.trace?.skill === skill;
  }

  carrierCount() {
    return this.trace?.carriers.length ?? 0;
  }

  begin(skill: SkillId, origin: ChoreographyPoint, aimX: number, aimZ: number) {
    this.trace = {
      skill,
      origin: { ...origin },
      aimX,
      aimZ,
      terminal: null,
      points: [],
      areaPoints: [],
      areas: [],
      contacts: [],
      paths: [],
      carriers: [],
      scheduled: []
    };
  }

  clear() {
    this.trace = null;
  }

  suspend() {
    const saved = this.trace;
    this.trace = null;
    return saved;
  }

  resume(trace: ChoreographyTrace | null) {
    this.trace = trace;
  }

  ensureSource(origin: ChoreographyPoint, aimX: number, aimZ: number) {
    const trace = this.trace;
    if (!trace) return;
    if (trace.points.length || trace.paths.length || trace.scheduled.length) return;
    trace.origin = { ...origin };
    trace.aimX = aimX;
    trace.aimZ = aimZ;
  }

  setOrigin(x: number, z: number) {
    if (this.trace) this.trace.origin = { x, z };
  }

  point(x: number, z: number, terminal = false) {
    const trace = this.trace;
    if (!trace) return;
    const point = { x, z };
    if (!trace.points.some((other) => this.samePoint(other, point))) trace.points.push(point);
    if (terminal) trace.terminal = point;
  }

  area(x: number, z: number, radius: number) {
    const trace = this.trace;
    if (!trace) return;

    this.point(x, z);
    const safeRadius = Math.max(0.35, radius);
    const shape: CombatShape = { kind: 'circle', x, z, radius: safeRadius };

    if (
      !trace.areas.some(
        (other) =>
          other.kind === 'circle' &&
          Math.hypot(other.x - x, other.z - z) < 0.08 &&
          Math.abs(other.radius - safeRadius) < 0.08
      )
    )
      trace.areas.push(shape);

    for (let index = 0; index < 4; index++) {
      const angle = (index * Math.PI) / 2;
      const point = {
        x: x + Math.cos(angle) * safeRadius,
        z: z + Math.sin(angle) * safeRadius
      };
      if (!trace.areaPoints.some((other) => this.samePoint(other, point)))
        trace.areaPoints.push(point);
    }
  }

  segment(a: ChoreographyPoint, b: ChoreographyPoint) {
    const trace = this.trace;
    if (!trace) return;

    const last = trace.paths[trace.paths.length - 1];
    if (last && this.samePoint(last[last.length - 1], a, 0.2)) last.push({ ...b });
    else trace.paths.push([{ ...a }, { ...b }]);

    trace.terminal = { ...b };
  }

  combatShape(shape: CombatShape) {
    const trace = this.trace;
    if (!trace) return;

    if (shape.kind === 'circle') {
      this.area(shape.x, shape.z, shape.radius);
      return;
    }

    if (shape.kind === 'ray') {
      const end = {
        x: shape.x + shape.aimX * shape.range,
        z: shape.z + shape.aimZ * shape.range
      };
      this.segment({ x: shape.x, z: shape.z }, end);
      return;
    }

    if (
      !trace.areas.some(
        (other) =>
          other.kind === 'sector' &&
          Math.hypot(other.x - shape.x, other.z - shape.z) < 0.08 &&
          Math.abs(other.radius - shape.radius) < 0.08
      )
    )
      trace.areas.push({ ...shape });

    const tip = {
      x: shape.x + shape.aimX * shape.radius,
      z: shape.z + shape.aimZ * shape.radius
    };
    this.segment({ x: shape.x, z: shape.z }, tip);

    const base = Math.atan2(shape.aimZ, shape.aimX);
    for (const offset of [-shape.halfAngle, shape.halfAngle]) {
      const angle = base + offset;
      const point = {
        x: shape.x + Math.cos(angle) * shape.radius,
        z: shape.z + Math.sin(angle) * shape.radius
      };
      if (!trace.areaPoints.some((other) => this.samePoint(other, point)))
        trace.areaPoints.push(point);
    }
  }

  addCarrier(carrier: ChoreographyCarrier) {
    const trace = this.trace;
    if (!trace) return;
    if (
      trace.carriers.some((other) =>
        other.kind === carrier.kind &&
        ('id' in other
          ? 'id' in carrier && other.id === carrier.id
          : 'index' in carrier && other.index === carrier.index)
      )
    )
      return;
    trace.carriers.push({ ...carrier });
  }

  addScheduled(x: number, z: number) {
    const trace = this.trace;
    if (!trace) return;
    const point = { x, z };
    if (!trace.scheduled.some((other) => this.samePoint(other, point)))
      trace.scheduled.push(point);
  }

  addContact(x: number, z: number) {
    const trace = this.trace;
    if (!trace) return;
    const point = { x, z };
    const last = trace.contacts[trace.contacts.length - 1];
    if (!last || !this.samePoint(last, point, 0.02)) trace.contacts.push(point);
  }

  finish(): ChoreographyTrace | null {
    const trace = this.trace;
    if (!trace) return null;

    for (const point of trace.contacts) this.point(point.x, point.z);

    // Contacts are captured before displacement. Terminal semantics stay authored here rather
    // than being re-inferred later by Catalyst code.
    if (
      trace.contacts.length &&
      (trace.skill === 'rail_spear' || trace.skill === 'cleaver')
    ) {
      trace.terminal = {
        ...trace.contacts.reduce((best, point) =>
          Math.hypot(point.x - trace.origin.x, point.z - trace.origin.z) >
          Math.hypot(best.x - trace.origin.x, best.z - trace.origin.z)
            ? point
            : best
        )
      };
    } else if (trace.contacts.length && trace.skill === 'chain_arc') {
      trace.terminal = { ...trace.contacts[trace.contacts.length - 1] };
    } else if (trace.contacts.length && trace.skill !== 'tether_drag') {
      trace.terminal = { ...trace.contacts[trace.contacts.length - 1] };
    } else if (!trace.terminal && trace.points.length) {
      trace.terminal = { ...trace.points[trace.points.length - 1] };
    }

    if (
      trace.skill === 'mortar_bloom' ||
      trace.skill === 'mass_driver' ||
      trace.skill === 'shard_fan'
    ) {
      trace.terminal = null;
      trace.paths = [];
    }

    const finished: ChoreographyTrace = {
      ...trace,
      origin: { ...trace.origin },
      terminal: trace.terminal ? { ...trace.terminal } : null,
      points: trace.points.map((point) => ({ ...point })),
      areaPoints: trace.areaPoints.map((point) => ({ ...point })),
      areas: trace.areas.map((shape) => ({ ...shape })),
      contacts: trace.contacts.map((point) => ({ ...point })),
      paths: trace.paths.map((path) => path.map((point) => ({ ...point }))),
      carriers: trace.carriers.map((carrier) => ({ ...carrier })),
      scheduled: trace.scheduled.map((point) => ({ ...point }))
    };

    this.trace = null;
    return finished;
  }

  private samePoint(a: ChoreographyPoint, b: ChoreographyPoint, epsilon = 0.12) {
    return Math.hypot(a.x - b.x, a.z - b.z) <= epsilon;
  }
}
