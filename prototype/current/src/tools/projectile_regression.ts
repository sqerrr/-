import { SimulationHarness } from '../testing/simulationHarness.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('projectile-regression: ' + message);
}

function projectile(
  h: SimulationHarness,
  faction: 'hero' | 'rival',
  x: number,
  z: number,
  vx: number,
  vz: number,
  damage = 40
) {
  h.spawnProjectile({
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
const hero = SimulationHarness.create({ seed: 12345, hz: 60, benchmark: true });
const victim = hero.spawnEnemyAt('footnote', 3.5, 0, 0);
assert(victim, 'failed to create a projectile target');
const hpBefore = victim.hp;
projectile(hero, 'hero', 0, 0, 24, 0, 25);
assert(hero.sim.snapshot().projectiles.length === 1, 'projectile missing from snapshot');
hero.updateProjectiles(20);
assert(victim.hp < hpBefore, 'hero projectile did not damage an enemy');

// Destructible cover consumes the shot and can be opened; permanent cover cannot be removed.
const cover = SimulationHarness.create({ seed: 777, hz: 60, benchmark: true });
const soft = cover.obstacles.find((o) => o.destructible);
const hard = cover.obstacles.find((o) => !o.destructible);
assert(soft && hard, 'arena must contain both cover classes');
cover.obstacles = [soft];
projectile(cover, 'hero', soft.x - soft.radius - 1.2, soft.z, 60, 0, soft.maxHp + 20);
cover.updateProjectiles(6);
assert(cover.obstacles.length === 0, 'destructible cover survived lethal damage');

const hardHarness = SimulationHarness.create({ seed: 777, hz: 60, benchmark: true });
const hardOnly = hardHarness.obstacles.find((o) => !o.destructible);
assert(hardOnly, 'arena must contain permanent cover');
hardHarness.obstacles = [hardOnly];
projectile(hardHarness, 'hero', hardOnly.x - hardOnly.radius - 1.2, hardOnly.z, 60, 0, 99999);
hardHarness.updateProjectiles(6);
assert(hardHarness.obstacles.length === 1, 'permanent cover was destroyed');

function rivalLoss(guard: boolean) {
  const h = SimulationHarness.create({ seed: 4242, hz: 60, benchmark: true });
  h.setPlayerPosition(0,0);
  h.sim.barrier = 0;
  if (guard) h.ensureSkill('orbit_blades').mutation = 'orbit_guard';
  const hp = h.sim.php;
  projectile(h, 'rival', -3.5, 0, 42, 0, 30);
  h.updateProjectiles(12);
  return hp - h.sim.php;
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
