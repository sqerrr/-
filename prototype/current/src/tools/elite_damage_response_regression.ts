import { EliteDamageResponseSystem, type EliteDamageResponsePort } from '../core/eliteDamageResponseSystem.js';
import { makeEnt, type Ent } from '../core/state.js';
import type { EliteChassis, EliteOrderId, SkillId } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('elite-damage-response-regression: ' + message);
}

const numeric = (value: number): number => value;

let now = 10;
let corePower = 1;
const orders: { order: EliteOrderId; count?: number }[] = [];
const clones: number[] = [];
const retinues: number[] = [];
const grown: number[] = [];
const announced: string[] = [];

function makePort(clock: () => number, sink = { clones, retinues, orders }): EliteDamageResponsePort {
  return {
    time: clock,
    corePower: () => corePower,
    spawnClone: (entity) => sink.clones.push(entity.id),
    spawnRetinue: (_entity, count) => sink.retinues.push(count),
    grow: (entity) => grown.push(entity.id),
    announce: (_entity, title) => announced.push(title),
    emitOrder: (_entity, order, count) => sink.orders.push({ order, count })
  };
}

const system = new EliteDamageResponseSystem(makePort(() => now));

function elite(chassis: EliteChassis, id: number): Ent {
  const entity = makeEnt({
    id,
    kind: 'elite',
    x: 0,
    z: 0,
    hp: 1000,
    maxHp: 1000,
    radius: 1,
    speed: 2,
    contactDps: 0
  });
  entity.chassis = chassis;
  return entity;
}

// Prism resists the dominant recent source (x0.3) and lets secondary sources through.
{
  orders.length = 0;
  const entity = elite('bulwark', 1);
  let damage = system.beforeDamage(entity, 100, 'rail_spear', false);
  assert(Math.abs(damage - 30) < 1e-9, 'first Prism source is not treated as dominant');
  assert(entity.prismMemory === 'rail_spear', 'Prism did not remember the dominant source');
  assert(orders.some((entry) => entry.order === 'prism'), 'Prism dominant-source cue disappeared');

  damage = system.beforeDamage(entity, 100, 'rail_spear', false);
  assert(Math.abs(damage - 30) < 1e-9, 'Prism repeated-source resistance changed');

  damage = system.beforeDamage(entity, 100, 'cleaver', false);
  assert(damage === 100, 'Prism secondary source should pass at full damage');
}

// Harvester suppresses derived work, builds adaptation, then rewards a direct hit.
{
  orders.length = 0;
  const entity = elite('harvester', 2);
  entity.adaptStage = 0;
  let damage = system.beforeDamage(entity, 100, null, true);
  assert(Math.abs(damage - 30) < 1e-9, 'Harvester derived suppression changed');
  assert(entity.adaptStage === 1, 'Harvester adaptation did not increment');
  assert(orders.some((entry) => entry.order === 'null' && entry.count === 1),
    'Harvester adaptation cue changed');

  damage = system.beforeDamage(entity, 100, 'rail_spear', false);
  assert(Math.abs(damage - 125) < 1e-9, 'Harvester direct-payoff multiplier changed');
  assert(numeric(entity.adaptStage) === 0, 'Harvester direct hit did not consume adaptation');

  announced.length = 0;
  for (let i = 0; i < 5; i++) system.beforeDamage(entity, 10, null, true);
  assert(numeric(entity.adaptStage) === 5 && announced.includes('НУЛЬ-ТКАЧ НАСЫТИЛСЯ'),
    'Harvester saturation is no longer announced');
}

// Replicator copies itself every BROOD_THRESHOLD hits, no faster than CLONE_SPACING.
{
  clones.length = 0;
  const entity = elite('broodmaker', 3);
  for (let i = 0; i < EliteDamageResponseSystem.BROOD_THRESHOLD - 1; i++)
    system.beforeDamage(entity, 100, 'frost_ring', false);
  assert(clones.length === 0, 'Replicator cloned before its threshold');
  const damage = system.beforeDamage(entity, 100, 'frost_ring', false);
  assert(damage === 100, 'Replicator reaction changed incoming damage');
  assert(numeric(clones.length) === 1 && clones[0] === entity.id, 'Replicator threshold no longer clones');
  for (let i = 0; i < EliteDamageResponseSystem.BROOD_THRESHOLD; i++)
    system.beforeDamage(entity, 100, 'frost_ring', false);
  assert(numeric(clones.length) === 1, 'Replicator ignored its clone spacing');
  now += EliteDamageResponseSystem.CLONE_SPACING;
  system.beforeDamage(entity, 100, 'frost_ring', false);
  assert(numeric(clones.length) === 2, 'Replicator did not clone again after spacing');

  const copy = elite('broodmaker', 33);
  copy.cloneParent = 3;
  for (let i = 0; i < 40; i++) system.beforeDamage(copy, 10, 'frost_ring', false);
  assert(numeric(clones.length) === 2, 'a copy must never replicate');
}

// Shepherd reads previous resolved damage, not the hit that crosses its transform threshold.
{
  orders.length = 0;
  announced.length = 0;
  const entity = elite('shepherd', 4);
  entity.hp = 700;

  for (let i = 0; i < 6; i++) system.noteResolvedDamage('toxin_dot', 30, true);
  let damage = system.beforeDamage(entity, 30, 'rail_spear', false);
  assert(damage === 30, 'Shepherd transform unexpectedly modified direct damage');
  assert(entity.shepherdMode === 'null', 'Shepherd no longer selects null from derived-heavy history');
  assert(orders.some((entry) => entry.order === 'metamorph' && entry.count === 6),
    'Shepherd metamorph cue/sample count changed');
  assert(announced.includes('МЕТАМОРФ: НУЛЬ') && grown.includes(4), 'Shepherd adaptation is not announced/grown');

  damage = system.beforeDamage(entity, 100, null, true);
  assert(Math.abs(damage - 35) < 1e-9, 'null Shepherd derived resistance changed');
}

// Fractured Shepherd calls a heavy retinue of four.
{
  let localNow = 20;
  const sink = { clones: [] as number[], retinues: [] as number[], orders: [] as { order: EliteOrderId; count?: number }[] };
  const local = new EliteDamageResponseSystem(makePort(() => localNow, sink));
  const entity = elite('shepherd', 5);
  entity.hp = 700;
  local.noteResolvedDamage('rail_spear', 140, false);
  local.noteResolvedDamage('cleaver', 120, false);
  local.beforeDamage(entity, 30, 'rail_spear' satisfies SkillId, false);
  assert(entity.shepherdMode === 'fractured', 'Shepherd high-average branch changed');
  assert(sink.retinues.length === 1 && sink.retinues[0] === 4, 'fractured Shepherd no longer calls four');
  assert(sink.orders.some((entry) => entry.order === 'metamorph' && entry.count === 2),
    'fractured Shepherd metamorph evidence changed');

  localNow = 40;
  local.noteResolvedDamage('rail_spear', 1, false);
  const diagnostics = local.diagnostics();
  assert(diagnostics.length === 1 && diagnostics[0].amount === 1,
    'elite damage signature retention window changed');
}

console.log('elite-damage-response-regression OK', {
  orders: orders.length,
  clones,
  samples: system.diagnostics().length
});
