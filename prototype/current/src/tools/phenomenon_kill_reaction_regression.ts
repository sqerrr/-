import {
  PhenomenonKillReactionSystem,
  type PhenomenonKillReactionPort
} from '../core/phenomenonKillReactionSystem.js';
import { makeEnt, type Ent } from '../core/state.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('phenomenon-kill-reaction-regression: ' + message);
}

const entities: Ent[] = [];
let enabled = true;
let globalPower = 0.5;
const damageCalls: { id: number; amount: number; source: string; x: number; z: number }[] = [];

const port: PhenomenonKillReactionPort = {
  entities: () => entities,
  globalPower: () => globalPower,
  hasMutation: (skill, mutation) =>
    enabled && skill === 'ember_lance' && mutation === 'ember_backdraft',
  damage: (target, amount, source, sourceX, sourceZ) =>
    damageCalls.push({ id: target.id, amount, source, x: sourceX, z: sourceZ })
};
const system = new PhenomenonKillReactionSystem(port);

const dead = makeEnt({
  id: 1,
  kind: 'footnote',
  x: 0,
  z: 0,
  hp: 0,
  maxHp: 100,
  radius: 0.4,
  speed: 1,
  contactDps: 0
});
const near = makeEnt({
  id: 2,
  kind: 'footnote',
  x: 2,
  z: 0,
  hp: 100,
  maxHp: 100,
  radius: 0.4,
  speed: 1,
  contactDps: 0
});
const far = makeEnt({
  id: 3,
  kind: 'footnote',
  x: 2.31,
  z: 0,
  hp: 100,
  maxHp: 100,
  radius: 0.4,
  speed: 1,
  contactDps: 0
});
const alreadyDead = makeEnt({
  id: 4,
  kind: 'footnote',
  x: 1,
  z: 0,
  hp: 0,
  maxHp: 100,
  radius: 0.4,
  speed: 1,
  contactDps: 0
});
entities.push(dead, near, far, alreadyDead);

system.onKill(dead, 'rail_spear');
assert(damageCalls.length === 0, 'non-Ember kill triggered Backdraft');

system.onKill(dead, 'ember_lance');
assert(Number(damageCalls.length) === 1 && damageCalls[0].id === near.id,
  'Backdraft target radius/dead-target filtering changed');
assert(Math.abs(near.x - 1.55) < 1e-9 && near.z === 0,
  'Backdraft pull distance/direction changed');
assert(Math.abs(damageCalls[0].amount - 27) < 1e-9,
  'Backdraft damage formula no longer uses 18 * (1 + globalPower)');
assert(
  damageCalls[0].source === 'backdraft' &&
  damageCalls[0].x === dead.x &&
  damageCalls[0].z === dead.z,
  'Backdraft secondary damage origin/source changed'
);
assert(far.x === 2.31 && alreadyDead.x === 1,
  'Backdraft moved an out-of-range or already-dead entity');

damageCalls.length = 0;
enabled = false;
near.x = 2;
system.onKill(dead, 'ember_lance');
assert(damageCalls.length === 0 && near.x === 2,
  'Backdraft fired without the mutation');

console.log('phenomenon-kill-reaction-regression OK', {
  damage: 27,
  pulledTo: 1.55,
  filtered: [far.id, alreadyDead.id]
});
