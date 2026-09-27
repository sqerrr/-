import { PickupSystem } from '../core/pickupSystem.js';
import type { Pickup } from '../core/state.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('pickup-system-regression: ' + message);
}
function close(actual: number, expected: number, message: string) {
  assert(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, got ${actual}`);
}

const state = {
  dt: 0.1,
  x: 0,
  z: 0,
  radius: 8,
  nextId: 10,
  xp: 0,
  core: 0,
  mutation: 2,
  healed: 0,
  healsPicked: 0,
  mutationEvents: [] as { pickup: Pickup; total: number }[]
};

const system = new PickupSystem({
  dt: () => state.dt,
  playerX: () => state.x,
  playerZ: () => state.z,
  pickupRadius: () => state.radius,
  nextId: () => state.nextId++,
  grantXp: (amount) => { state.xp += amount; },
  grantEliteCore: (amount) => { state.core += amount; },
  grantMutationCore: (amount) => {
    state.mutation += amount;
    return state.mutation;
  },
  healPlayer: (amount) => { state.healed += amount; },
  noteHealPickup: () => { state.healsPicked++; },
  emitMutationCore: (pickup, total) => {
    state.mutationEvents.push({ pickup: { ...pickup }, total });
  }
});

// Creation owns ids but no collection side effects.
const added = system.add({ x: 9, z: 0, value: 1, kind: 'xp' });
assert(added.id === 10 && system.all.length === 1, 'add no longer owns pickup identity/storage');

// Outside attraction radius: no movement.
system.update();
assert(system.all.length === 1, 'outside pickup was collected');
close(system.all[0].x, 9, 'outside pickup moved');

// Inside attraction radius: exact historical attraction speed.
system.replace([{ id: 20, x: 4, z: 0, value: 1, kind: 'xp' }]);
system.update();
assert(system.all.length === 1, 'attracted pickup collected too early');
close(system.all[0].x, 4 - (5.5 + (8 - 4) * 2.4) * 0.1, 'attraction displacement');

// All four pickup kinds route to the correct economy path and leave the field.
system.replace([
  { id: 21, x: 0.3, z: 0, value: 5, kind: 'xp' },
  { id: 22, x: 0.3, z: 0, value: 4, kind: 'core' },
  { id: 23, x: 0.2, z: 0, value: 2, kind: 'mutation' },
  { id: 24, x: 0.3, z: 0, value: 7, kind: 'heal' }
]);
system.update();
assert(Number(system.all.length) === 0, 'collected pickups remained alive');
assert(state.xp === 5, 'xp pickup routed incorrectly');
assert(state.core === 4, 'core pickup routed incorrectly');
assert(state.mutation === 4, 'mutation pickup routed incorrectly');
assert(state.healed === 7 && state.healsPicked === 1, 'heal pickup accounting changed');
assert(state.mutationEvents.length === 1 && state.mutationEvents[0].total === 4,
  'mutation pickup event/total changed');
// The old loop moved a close pickup before emitting its event even though collection used
// the pre-move distance. Preserve that order during extraction.
close(state.mutationEvents[0].pickup.x, -2.222, 'mutation event position/cadence');

// Collection threshold remains strict, and the same tick's attraction cannot collect a pickup
// that began at the boundary.
state.dt = 0.01;
system.replace([{ id: 25, x: PickupSystem.COLLECT_RADIUS, z: 0, value: 3, kind: 'xp' }]);
system.update();
assert(system.all.length === 1, 'threshold changed from strict < to <=');
const movedInside = system.all[0].x;
assert(movedInside < PickupSystem.COLLECT_RADIUS, 'boundary pickup was not attracted inward');
system.update();
assert(Number(system.all.length) === 0 && Number(state.xp) === 8,
  'pre-move collection cadence changed on the following tick');

console.log('pickup-system-regression OK', {
  ids: added.id,
  xp: state.xp,
  core: state.core,
  mutation: state.mutation,
  healsPicked: state.healsPicked
});
