import { makeEnt } from '../core/state.js';
import { StatusSystem } from '../core/statusSystem.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('status-system-regression: ' + message);
}

function entity() {
  return makeEnt({
    id: 1,
    kind: 'footnote',
    x: 0,
    z: 0,
    hp: 100,
    radius: 0.46,
    speed: 1,
    contactDps: 0
  });
}

const statuses = new StatusSystem();

{
  const e = entity();
  statuses.apply(e, 'wound', { time: 10, potency: 2, memoryFactor: 1.5, globalPower: 0.25 });
  assert(e.woundUntil > 10, 'wound duration was not applied');
  assert(e.woundDps === 17.5, 'wound DPS formula changed');
  assert(statuses.active(e, 'wound', 10), 'fresh wound is not active');
  statuses.consume(e, 'wound');
  assert(e.woundUntil === 0 && e.woundDps === 0, 'wound consumption did not clear its payload');
}

{
  const e = entity();
  statuses.apply(e, 'embed', { time: 0, potency: 20, memoryFactor: 1, globalPower: 0 });
  assert(e.embedded === 8, 'embed cap changed');
  statuses.consume(e, 'embed');
  assert(e.embedded === 7, 'embed consumption changed');
}

{
  const e = entity();
  statuses.apply(e, 'toxin', { time: 0, potency: 1, memoryFactor: 1, globalPower: 0 });
  statuses.apply(e, 'wound', { time: 0, potency: 1, memoryFactor: 1, globalPower: 0 });
  const hits:string[]=[];
  statuses.updateDamageOverTime([e], 1, 0.5, (target, amount, source) => {
    hits.push(source + ':' + amount.toFixed(2));
    target.hp -= amount;
  });
  assert(hits.length === 2, 'both active periodic statuses did not tick');
  assert(hits[0].startsWith('wound_dot:'), 'wound must resolve before toxin');
  assert(hits[1].startsWith('toxin_dot:'), 'toxin ordering changed');
}

{
  const e = entity();
  e.chillUntil = 4;
  e.woundUntil = 5;
  e.toxinUntil = 6;
  e.markUntil = 7;
  statuses.clearForRevive(e);
  assert(e.chillUntil === 0 && e.woundUntil === 0 && e.toxinUntil === 0, 'revive reset changed');
  assert(e.markUntil === 7, 'revive reset cleared statuses it did not clear before');
}

console.log('status-system-regression OK');
