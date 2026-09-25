import { ChoreographyTraceSystem } from '../core/choreographyTraceSystem.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('choreography-trace-regression: ' + message);
}

const trace = new ChoreographyTraceSystem();

// Directional skills resolve their authored terminal from contacts captured before displacement.
trace.begin('rail_spear', { x: 0, z: 0 }, 1, 0);
trace.combatShape({ kind: 'ray', x: 0, z: 0, aimX: 1, aimZ: 0, range: 8, halfWidth: 0.2 });
trace.addContact(2, 0);
trace.addContact(5, 0);
const rail = trace.finish();
assert(rail, 'rail trace was not published');
assert(rail.terminal?.x === 5 && rail.terminal.z === 0, 'rail terminal is not the farthest resolved contact');
assert(rail.contacts.length === 2, 'rail contacts changed while finishing the trace');

// Area evidence is de-duplicated centrally instead of every caller hand-rolling epsilon checks.
trace.begin('frost_ring', { x: 0, z: 0 }, 1, 0);
trace.area(3, 2, 1.4);
trace.area(3.01, 2.01, 1.42);
const area = trace.finish();
assert(area, 'area trace was not published');
assert(area.areas.length === 1, 'near-identical areas were duplicated');
assert(area.areaPoints.length === 4, 'area perimeter evidence changed');

// Async moving Phenomena keep carriers but never lie about a terminal/path that does not exist yet.
trace.begin('mass_driver', { x: 0, z: 0 }, 1, 0);
trace.combatShape({ kind: 'ray', x: 0, z: 0, aimX: 1, aimZ: 0, range: 9, halfWidth: 0.7 });
trace.addCarrier({ kind: 'projectile', id: 41 });
trace.addCarrier({ kind: 'projectile', id: 41 });
const mass = trace.finish();
assert(mass, 'mass-driver trace was not published');
assert(mass.terminal === null && mass.paths.length === 0, 'async projectile advertised an immediate terminal/path');
assert(mass.carriers.length === 1, 'carrier de-duplication changed');

// Planned delayed impacts stay planning evidence; they do not become resolved geometry.
trace.begin('mortar_bloom', { x: 1, z: 1 }, 0, 1);
trace.addScheduled(4, 3);
const mortar = trace.finish();
assert(mortar, 'mortar trace was not published');
assert(mortar.scheduled.length === 1, 'scheduled strike evidence was lost');
assert(mortar.terminal === null && mortar.paths.length === 0, 'planned mortar point became resolved geometry');

// Nested Catalyst payloads can suspend an outer trace without corrupting it.
trace.begin('cleaver', { x: 0, z: 0 }, 1, 0);
trace.point(1, 0);
const outer = trace.suspend();
assert(!trace.active, 'suspend left outer trace active');
trace.begin('chain_arc', { x: 4, z: 0 }, 1, 0);
trace.addContact(5, 0);
const inner = trace.finish();
assert(inner?.skill === 'chain_arc', 'nested payload trace changed owner');
trace.resume(outer);
trace.point(2, 0);
const resumed = trace.finish();
assert(resumed?.skill === 'cleaver', 'outer trace was not restored');
assert(resumed.points.some((point) => point.x === 1) && resumed.points.some((point) => point.x === 2),
  'outer evidence was corrupted by nested payload');

// The actual cast source may replace the provisional player source only before evidence exists.
trace.begin('ember_lance', { x: 0, z: 0 }, 1, 0);
trace.ensureSource({ x: 2, z: 3 }, 0, 1);
trace.point(2, 3);
trace.ensureSource({ x: 9, z: 9 }, -1, 0);
const source = trace.finish();
assert(source, 'source trace was not published');
assert(source.origin.x === 2 && source.origin.z === 3 && source.aimX === 0 && source.aimZ === 1,
  'trace source moved after evidence had already been recorded');

console.log('choreography-trace-regression OK', {
  railContacts: rail.contacts.length,
  areaShapes: area.areas.length,
  massCarriers: mass.carriers.length,
  nestedSkill: inner.skill
});
