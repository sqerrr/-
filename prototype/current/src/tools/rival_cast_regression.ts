// Proves the effect-owner split introduced in step 2: the same phenomenon can be cast by a
// rival instead of the hero, in which case it resolves against the player and leaves the
// enemy roster untouched. Reaches into private state on purpose - this is a harness, and the
// alternative is widening the production surface for the sake of a test.
import { Simulation } from '../core/simulation.js';

function assert(c: unknown, m: string): asserts c {
  if (!c) throw new Error('rival cast regression: ' + m);
}

const sim: any = new Simulation({ seed: 4242, hz: 60, mode: 'clean', benchmark: true });
sim.configureBenchmarkLoadout({ slots: ['cleaver'], catalysts: [] });
for (let i = 0; i < 240; i++) sim.step({ moveX: 0, moveZ: 0, aimX: 1, aimZ: 0 });

const hpBefore = sim.snapshot().player.hp;
const entsBefore = sim.ents.map((e: any) => ({ id: e.id, hp: e.hp }));
assert(entsBefore.length > 0, 'expected a populated roster to prove faction separation');

// A rival standing on top of the player, swinging straight at them.
const rivalOwner = sim.ents[0];
rivalOwner.x = sim.px + 0.6;
rivalOwner.z = sim.pz;
const rivalSrc = {
  faction: 'rival' as const,
  owner: rivalOwner,
  x: rivalOwner.x,
  z: rivalOwner.z,
  aimX: -1,
  aimZ: 0,
  vx: 0,
  vz: 0
};

const heroTargets = sim.targetsFor({ ...rivalSrc, faction: 'hero', owner: null });
assert(heroTargets === sim.ents, 'a hero cast must sweep the live enemy roster');
const rivalTargets = sim.targetsFor(rivalSrc);
assert(rivalTargets.length === 1, 'a rival cast must resolve against exactly one target');
assert(rivalTargets[0].kind === 'hero', 'the sole rival target must be the hero combatant');
assert(
  rivalTargets[0].x === sim.px && rivalTargets[0].z === sim.pz,
  'the hero combatant must track live player position'
);
assert(!sim.ents.includes(sim.hero), 'the hero combatant must never enter the enemy roster');

const blade = sim.newSkill('cleaver');
sim.castCleaver(blade, 0, rivalSrc);

const hpAfter = sim.snapshot().player.hp;
assert(hpAfter < hpBefore, `a rival cast must damage the player (${hpBefore} -> ${hpAfter})`);

for (const before of entsBefore) {
  const now = sim.ents.find((e: any) => e.id === before.id);
  assert(!now || now.hp === before.hp, `rival cast must not damage enemy ${before.id}`);
}

// Mitigation still belongs to the player: armour must reduce an identical blow.
const hpMidpoint = sim.snapshot().player.hp;
sim.armor = 400;
sim.castCleaver(blade, 0, rivalSrc);
const armouredLoss = hpMidpoint - sim.snapshot().player.hp;
const rawLoss = hpBefore - hpAfter;
assert(
  armouredLoss < rawLoss,
  `player mitigation must apply to rival casts (${rawLoss} -> ${armouredLoss})`
);

console.log('rival-cast-regression OK', {
  rawLoss: +rawLoss.toFixed(2),
  armouredLoss: +armouredLoss.toFixed(2),
  rosterUntouched: entsBefore.length
});
