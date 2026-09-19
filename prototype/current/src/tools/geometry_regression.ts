import { Simulation } from '../core/simulation.js';
import type { Command } from '../core/types.js';

// D20 asks for a semi-open arena: islands of cover, never corridors and never an
// empty field. These checks prove the three properties that claim rests on: the
// arena is neither bare nor a maze, nothing solid can be walked or dashed through,
// and no mover ever ends a tick buried inside cover.

function assert(ok: boolean, msg: string) {
  if (!ok) throw new Error('geometry-regression: ' + msg);
}

const idle: Command = { moveX: 0, moveZ: 0, aimX: 1, aimZ: 0 };

function make(seed: number) {
  return new Simulation({ seed, hz: 60 }) as any;
}

// --- layout properties, checked across several seeds ---------------------------
const seeds = [12345, 777, 4242, 20260919, 31337];
let minCount = 1e9;
let maxCount = 0;
let coverSum = 0;

for (const seed of seeds) {
  const sim = make(seed);
  const obstacles = sim.obstacles as { x: number; z: number; radius: number }[];
  const world = sim.world as { minX: number; maxX: number; minZ: number; maxZ: number };

  assert(obstacles.length >= 18, `seed ${seed}: only ${obstacles.length} obstacles`);
  minCount = Math.min(minCount, obstacles.length);
  maxCount = Math.max(maxCount, obstacles.length);

  // The opening must be approachable: the hero starts at the origin.
  for (const o of obstacles) {
    const edge = Math.hypot(o.x, o.z) - o.radius;
    assert(edge >= 8, `seed ${seed}: cover ${edge.toFixed(1)} from the opening`);
  }

  // Every point of interest must keep room to stand and fight in.
  for (const p of sim.pois as { x: number; z: number }[]) {
    for (const o of obstacles) {
      const edge = Math.hypot(o.x - p.x, o.z - p.z) - o.radius;
      assert(edge >= 3, `seed ${seed}: cover ${edge.toFixed(1)} from a point of interest`);
    }
  }

  // Coverage decides whether this reads as semi-open. Too little is the empty field
  // the design rejects; too much is the corridor maze it rejects just as firmly.
  let inside = 0;
  let total = 0;
  for (let x = world.minX; x <= world.maxX; x += 0.5)
    for (let z = world.minZ; z <= world.maxZ; z += 0.5) {
      total++;
      for (const o of obstacles)
        if (Math.hypot(x - o.x, z - o.z) < o.radius) {
          inside++;
          break;
        }
    }
  const cover = inside / total;
  assert(cover > 0.015, `seed ${seed}: cover ${(cover * 100).toFixed(1)}% is an empty field`);
  assert(cover < 0.16, `seed ${seed}: cover ${(cover * 100).toFixed(1)}% is a maze`);
  coverSum += cover;
}

// --- solidity: the hero cannot pass through cover -------------------------------
function driveInto(dash: boolean) {
  const sim = make(12345);
  const obstacles = sim.obstacles as { x: number; z: number; radius: number }[];
  // Nearest island to the opening, approached from outside along the x axis.
  let target = obstacles[0];
  for (const o of obstacles) if (Math.hypot(o.x, o.z) < Math.hypot(target.x, target.z)) target = o;

  sim.px = target.x + target.radius + 5;
  sim.pz = target.z;
  const body = Simulation.HERO_BODY_RADIUS ?? 0.42;

  let closest = 1e9;
  for (let i = 0; i < 240; i++) {
    sim.step({ moveX: -1, moveZ: 0, aimX: -1, aimZ: 0, dash: dash && i % 120 === 0 });
    closest = Math.min(closest, Math.hypot(sim.px - target.x, sim.pz - target.z));
  }
  return { closest, limit: target.radius + body };
}

const walked = driveInto(false);
assert(
  walked.closest > walked.limit - 0.05,
  `walked into cover: reached ${walked.closest.toFixed(2)} against ${walked.limit.toFixed(2)}`
);
// Reaching the surface is required too, otherwise the check would pass on a hero
// that simply never arrived.
assert(
  walked.closest < walked.limit + 0.6,
  `never reached the cover: stopped at ${walked.closest.toFixed(2)}`
);

const dashed = driveInto(true);
assert(
  dashed.closest > dashed.limit - 0.05,
  `dashed through cover: reached ${dashed.closest.toFixed(2)} against ${dashed.limit.toFixed(2)}`
);

// --- nothing ends a tick inside cover -------------------------------------------
const sim = make(4242);
let worstOverlap = 0;
for (let i = 0; i < 2400; i++) {
  const t = i / 60;
  sim.step({
    moveX: Math.cos(t * 0.8),
    moveZ: Math.sin(t * 0.8),
    aimX: Math.cos(t),
    aimZ: Math.sin(t)
  } as Command);
  if (sim.hasChoice) sim.chooseReward(0);
  if (i % 30 !== 0) continue;
  for (const e of sim.ents as { x: number; z: number; radius: number; hp: number }[]) {
    if (e.hp <= 0) continue;
    for (const o of sim.obstacles as { x: number; z: number; radius: number }[]) {
      const overlap = o.radius + e.radius * 0.7 - Math.hypot(e.x - o.x, e.z - o.z);
      if (overlap > worstOverlap) worstOverlap = overlap;
    }
  }
  const heroOverlap = Math.max(
    0,
    ...(sim.obstacles as { x: number; z: number; radius: number }[]).map(
      (o: { x: number; z: number; radius: number }) =>
        o.radius + 0.42 - Math.hypot(sim.px - o.x, sim.pz - o.z)
    )
  );
  assert(heroOverlap < 0.05, `hero sank ${heroOverlap.toFixed(3)} into cover`);
}
assert(worstOverlap < 0.05, `an entity sank ${worstOverlap.toFixed(3)} into cover`);

console.log('geometry-regression OK', {
  obstacles: `${minCount}..${maxCount}`,
  cover: `${((coverSum / seeds.length) * 100).toFixed(1)}%`,
  walkedTo: +walked.closest.toFixed(2),
  dashedTo: +dashed.closest.toFixed(2),
  surface: +walked.limit.toFixed(2)
});
