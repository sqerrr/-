import type { CombatShape } from './types.js';

export type Point2 = { x: number; z: number };

export function normalize2(x: number, z: number) {
  const m = Math.hypot(x, z) || 1;
  return { x: x / m, z: z / m };
}

export function circleIntersectsCircle(
  ax: number,
  az: number,
  ar: number,
  bx: number,
  bz: number,
  br: number
) {
  return Math.hypot(ax - bx, az - bz) <= ar + br;
}

/**
 * Continuous collision for a moving circle against a static circle.
 * Returns the first normalized time of impact on [0,1].
 */
export function sweepCircleT(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  cx: number,
  cz: number,
  radius: number
): number | null {
  const dx = x1 - x0,
    dz = z1 - z0,
    fx = x0 - cx,
    fz = z0 - cz,
    a = dx * dx + dz * dz;
  if (a < 1e-8) return Math.hypot(fx, fz) <= radius ? 0 : null;
  const b = 2 * (fx * dx + fz * dz),
    c = fx * fx + fz * fz - radius * radius,
    disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc),
    t0 = (-b - root) / (2 * a),
    t1 = (-b + root) / (2 * a);
  if (t0 >= 0 && t0 <= 1) return t0;
  if (t1 >= 0 && t1 <= 1) return t1;
  return c <= 0 ? 0 : null;
}

export function closestPointOnSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
) {
  const dx = bx - ax,
    dz = bz - az,
    d2 = dx * dx + dz * dz;
  const t = d2 <= 1e-9 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / d2));
  return { x: ax + dx * t, z: az + dz * t, t };
}

/**
 * Single authoritative overlap test for static combat hitboxes.
 * The target is always treated as a circle because actors already own a physical radius.
 */
export function combatShapeIntersectsCircle(
  shape: CombatShape,
  x: number,
  z: number,
  targetRadius: number
) {
  if (shape.kind === 'circle')
    return circleIntersectsCircle(shape.x, shape.z, shape.radius, x, z, targetRadius);

  const aim = normalize2(shape.aimX, shape.aimZ);
  if (shape.kind === 'ray') {
    const endX = shape.x + aim.x * shape.range,
      endZ = shape.z + aim.z * shape.range,
      closest = closestPointOnSegment(x, z, shape.x, shape.z, endX, endZ);
    return Math.hypot(x - closest.x, z - closest.z) <= shape.halfWidth + targetRadius;
  }

  const dx = x - shape.x,
    dz = z - shape.z,
    d = Math.hypot(dx, dz);
  if (d > shape.radius + targetRadius) return false;
  if (d <= targetRadius) return true;
  const dot = Math.max(-1, Math.min(1, (dx / d) * aim.x + (dz / d) * aim.z)),
    angularPadding = Math.asin(Math.min(0.999, targetRadius / Math.max(targetRadius, d)));
  return Math.acos(dot) <= shape.halfAngle + angularPadding;
}

export function pointAlongPolyline(points: Point2[], distance: number) {
  if (!points.length) return null;
  if (points.length === 1) return { ...points[0] };
  let left = Math.max(0, distance);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      len = Math.hypot(b.x - a.x, b.z - a.z);
    if (left <= len || i === points.length - 1) {
      const t = len <= 1e-9 ? 0 : Math.max(0, Math.min(1, left / len));
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    }
    left -= len;
  }
  return { ...points[points.length - 1] };
}

export function polylineLength(points: Point2[]) {
  let n = 0;
  for (let i = 1; i < points.length; i++)
    n += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  return n;
}
