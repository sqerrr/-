import { Simulation } from '../core/simulation.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('projectile-regression: ' + message);
}

function projectile(
  s: any,
  faction: 'hero' | 'rival',
  x: number,
  z: number,
  vx: number,
  vz: number,
  damage = 40
) {
  s.spawnProjectile({
    x,
    z,
    vx,
    vz,
    radius: 0.18,
    ttl: 1,
    damage,
    coverDamage: damage,
    faction,
    ownerId: 0,
    source: 'shard_fan',
    sourceSlot: 0,
    mutation: null,
    rivalConcentration: 1
  });
}

// A hero projectile is a moving object rather than an instant ray.
const heroSim = new Simulation({ seed: 12345, hz: 60, benchmark: true }) as any;
const victim = heroSim.spawnEnemyAt('footnote', 3.5, 0, 0);
assert(victim, 'failed to create a projectile target');
const hpBefore = victim.hp;
projectile(heroSim, 'hero', 0, 0, 24, 0, 25);
assert(heroSim.snapshot().projectiles.length === 1, 'projectile missing from snapshot');
for (let i = 0; i < 20; i++) heroSim.updateProjectiles();
assert(victim.hp < hpBefore, 'hero projectile did not damage an enemy');

// Destructible cover consumes the shot and can be opened; permanent cover cannot be removed.
const coverSim = new Simulation({ seed: 777, hz: 60, benchmark: true }) as any;
const soft = coverSim.obstacles.find((o: any) => o.destructible);
const hard = coverSim.obstacles.find((o: any) => !o.destructible);
assert(soft && hard, 'arena must contain both cover classes');
coverSim.obstacles = [soft];
coverSim.buildObstacleGrid();
projectile(
  coverSim,
  'hero',
  soft.x - soft.radius - 1.2,
  soft.z,
  60,
  0,
  soft.maxHp + 20
);
for (let i = 0; i < 6; i++) coverSim.updateProjectiles();
assert(coverSim.obstacles.length === 0, 'destructible cover survived lethal damage');

const hardSim = new Simulation({ seed: 777, hz: 60, benchmark: true }) as any;
const hardOnly = hardSim.obstacles.find((o: any) => !o.destructible);
assert(hardOnly, 'arena must contain permanent cover');
hardSim.obstacles = [hardOnly];
hardSim.buildObstacleGrid();
projectile(hardSim, 'hero', hardOnly.x - hardOnly.radius - 1.2, hardOnly.z, 60, 0, 99999);
for (let i = 0; i < 6; i++) hardSim.updateProjectiles();
assert(hardSim.obstacles.length === 1, 'permanent cover was destroyed');

function rivalLoss(guard: boolean) {
  const sim = new Simulation({ seed: 4242, hz: 60, benchmark: true }) as any;
  sim.px = 0;
  sim.pz = 0;
  sim.barrier = 0;
  if (guard) {
    const runtime = sim.newSkill('orbit_blades');
    runtime.mutation = 'orbit_guard';
    sim.skillsRuntime.set('orbit_blades', runtime);
  }
  const hp = sim.php;
  projectile(sim, 'rival', -3.5, 0, 42, 0, 30);
  for (let i = 0; i < 12; i++) sim.updateProjectiles();
  return hp - sim.php;
}

const rawLoss = rivalLoss(false);
const guardedLoss = rivalLoss(true);
assert(rawLoss > 0, 'rival projectile did not hit the hero');
assert(guardedLoss > 0, 'orbit guard should weaken, not erase, a projectile');
assert(guardedLoss < rawLoss * 0.5, `orbit guard too weak: ${guardedLoss} vs ${rawLoss}`);

console.log('projectile-regression OK', {
  heroHit: +(hpBefore - victim.hp).toFixed(2),
  coverRemoved: 1,
  rawLoss: +rawLoss.toFixed(2),
  guardedLoss: +guardedLoss.toFixed(2)
});
