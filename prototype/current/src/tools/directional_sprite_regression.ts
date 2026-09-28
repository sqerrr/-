import {
  DIRECTION9,
  animationFrameAt,
  direction9FromWorldVector,
  directionalFrameUv,
  stableFacing,
  type DirectionalClip
} from '../presentation/directionalSprite.js';

function assert(v: unknown, m: string): asserts v {
  if (!v) throw new Error(m);
}

assert(direction9FromWorldVector(1, 0) === 'se', '+X must face screen SE');
assert(direction9FromWorldVector(-1, 0) === 'nw', '-X must face screen NW');
assert(direction9FromWorldVector(0, 1) === 'sw', '+Z must face screen SW');
assert(direction9FromWorldVector(0, -1) === 'ne', '-Z must face screen NE');
assert(direction9FromWorldVector(1, -1) === 'e', '+X/-Z must face screen E');
assert(direction9FromWorldVector(-1, 1) === 'w', '-X/+Z must face screen W');
assert(direction9FromWorldVector(1, 1) === 's', '+X/+Z must face screen S');
assert(direction9FromWorldVector(-1, -1) === 'n', '-X/-Z must face screen N');
assert(direction9FromWorldVector(0, 0) === 'c', 'zero vector must map to neutral centre');
assert(stableFacing(0, 0, 'ne') === 'ne', 'deadzone must preserve previous real facing');

const clip: DirectionalClip = {
  rows: DIRECTION9,
  frames: 8,
  fps: 12,
  cellWidth: 192,
  cellHeight: 192,
  loop: true
};
assert(animationFrameAt(0, clip) === 0, 'animation starts on frame 0');
assert(animationFrameAt(8 / 12, clip) === 0, 'loop must wrap after frame count');
const uv = directionalFrameUv('sw', 3, clip);
assert(uv.row === DIRECTION9.indexOf('sw'), 'row lookup must be deterministic');
assert(uv.u0 >= 0 && uv.v0 >= 0 && uv.u1 <= 1 && uv.v1 <= 1, 'UVs must stay inside sheet');
assert(uv.u1 > uv.u0 && uv.v1 > uv.v0, 'UV rectangle must be positive');

console.log('directional sprite regression: ok');
