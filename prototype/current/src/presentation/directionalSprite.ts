/**
 * Directional sprite helpers for the isometric renderer.
 *
 * Runtime convention:
 * - world movement/facing is expressed as X/Z;
 * - isometric screen projection uses X-Z horizontally and X+Z vertically;
 * - the sprite sheet has nine logical rows: a neutral centre plus eight compass facings.
 *
 * The centre row is only a neutral fallback for a zero-length vector. Real facing uses
 * the eight directional rows. This keeps the asset contract compatible with a 3x3 authoring
 * grid without pretending that "centre" is a physical direction.
 */
export const DIRECTION9 = ['c', 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;
export type Direction9 = (typeof DIRECTION9)[number];

export type DirectionalClip = {
  rows: readonly Direction9[];
  frames: number;
  fps: number;
  cellWidth: number;
  cellHeight: number;
  loop: boolean;
};

export type FrameUv = {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  frame: number;
  row: number;
  direction: Direction9;
};

const TWO_PI = Math.PI * 2;
const OCTANT = TWO_PI / 8;

/**
 * Quantise a world-space X/Z vector using its on-screen isometric direction.
 * Positive screen Y points down, matching the canvas/WebGL presentation layer.
 */
export function direction9FromWorldVector(x: number, z: number, deadzone = 0.045): Direction9 {
  const length = Math.hypot(x, z);
  if (length <= deadzone) return 'c';

  const sx = x - z;
  const sy = x + z;
  const a = Math.atan2(sy, sx);
  const oct = ((Math.round(a / OCTANT) % 8) + 8) % 8;
  return (['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'] as const)[oct];
}

export function animationFrameAt(timeSeconds: number, clip: DirectionalClip): number {
  if (clip.frames <= 1 || clip.fps <= 0) return 0;
  const raw = Math.max(0, Math.floor(timeSeconds * clip.fps));
  return clip.loop ? raw % clip.frames : Math.min(clip.frames - 1, raw);
}

/**
 * UV rectangle for a fixed-cell sheet. No alpha trimming is performed at runtime on purpose:
 * each authored cell shares one canonical canvas/pivot, so transparent margins cannot stretch
 * one animation frame into a different apparent character size.
 */
export function directionalFrameUv(
  direction: Direction9,
  frame: number,
  clip: DirectionalClip
): FrameUv {
  const row = Math.max(0, clip.rows.indexOf(direction));
  const f = Math.max(0, Math.min(clip.frames - 1, Math.floor(frame)));
  const cols = Math.max(1, clip.frames);
  const rows = Math.max(1, clip.rows.length);
  return {
    u0: f / cols,
    v0: row / rows,
    u1: (f + 1) / cols,
    v1: (row + 1) / rows,
    frame: f,
    row,
    direction
  };
}

/**
 * Preserve the last real facing while movement/aim sits inside the deadzone. This prevents
 * idle sprites from snapping to a generic front pose every time an analogue input crosses zero.
 */
export function stableFacing(
  x: number,
  z: number,
  previous: Direction9 = 's',
  deadzone = 0.045
): Direction9 {
  const q = direction9FromWorldVector(x, z, deadzone);
  return q === 'c' ? (previous === 'c' ? 's' : previous) : q;
}
