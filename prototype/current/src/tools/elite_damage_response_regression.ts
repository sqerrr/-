import { EliteDamageResponseSystem, type EliteDamageResponsePort } from '../core/eliteDamageResponseSystem.js';
import { makeEnt, type Ent } from '../core/state.js';
import type { EliteChassis, EliteOrderId, SkillId } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('elite-damage-response-regression: ' + message);
}

const numeric = (value: number): number => value;

let now = 10;
let conductivity = 0;
let corePower = 1;
const orders: { order: EliteOrderId; count?: number }[] = [];
const replicated: number[] = [];

const port: EliteDamageResponsePort = {
  time: () => now,
  conductivity: () => conductivity,
  corePower: () => corePower,
  spawnReplicant: (entity) => replicated.push(entity.id),
  emitOrder: (_entity, order, count) => orders.push({ order, count })
};

const system = new EliteDamageResponseSystem(port);

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

// Bulwark remembers the first damage identity, resists repetition, and exposes on alternation.
{
  orders.length = 0;
  const entity = elite('bulwark', 1);
  let damage = system.beforeDamage(entity, 100, 'rail_spear', false);
  assert(damage === 100, 'first Bulwark source changed damage');
  assert(entity.prismMemory === 'rail_spear', 'Bulwark did not remember first source');
  assert(orders.some((entry) => entry.order === 'prism'), 'Bulwark first-source cue disappeared');

  damage = system.beforeDamage(entity, 100, 'rail_spear', false);
  assert(Math.abs(damage - 28) < 1e-9, 'Bulwark repeated-source resistance changed');

  damage = system.beforeDamage(entity, 100, 'cleaver', false);
  assert(Math.abs(damage - 134) < 1e-9, 'Bulwark alternating-source vulnerability changed');
  assert(entity.prismMemory === 'cleaver', 'Bulwark did not rotate prism memory');
  assert(entity.exposedUntil === now + 0.45, 'Bulwark exposure timing changed');
}

// Harvester suppresses derived work, builds adaptation, then rewards a direct hit.
{
  orders.length = 0;
  const entity = elite('harvester', 2);
  entity.adaptStage = 0;
  let damage = system.beforeDamage(entity, 100, null, true);
  assert(Math.abs(damage - 38) < 1e-9, 'Harvester derived suppression changed');
  assert(entity.adaptStage === 1, 'Harvester adaptation did not increment');
  assert(orders.some((entry) => entry.order === 'null' && entry.count === 1),
    'Harvester adaptation cue changed');

  damage = system.beforeDamage(entity, 100, 'rail_spear', false);
  assert(Math.abs(damage - 124) < 1e-9, 'Harvester direct-payoff multiplier changed');
  assert(numeric(entity.adaptStage) === 0, 'Harvester direct hit did not consume adaptation');
}

// Broodmaker counts authored damage events; conductivity lowers the threshold exactly as before.
{
  replicated.length = 0;
  conductivity = 3;
  const entity = elite('broodmaker', 3);
  entity.affixPulse = 4;
  const damage = system.beforeDamage(entity, 100, 'frost_ring', false);
  assert(damage === 100, 'Broodmaker reaction changed incoming damage');
  assert(replicated.length === 1 && replicated[0] === entity.id,
    'Broodmaker threshold no longer spawns one replicant');
  assert(entity.affixPulse === 0, 'Broodmaker pulse did not reset after spawn');
  conductivity = 0;
}

// Shepherd reads previous resolved damage, not the hit that crosses its transform threshold.
{
  orders.length = 0;
  replicated.length = 0;
  const entity = elite('shepherd', 4);
  entity.hp = 700;

  // Six derived samples dominate the last five-second signature without exceeding the rate branch.
  for (let i = 0; i < 6; i++) system.noteResolvedDamage('toxin_dot', 30, true);
  let damage = system.beforeDamage(entity, 30, 'rail_spear', false);
  assert(damage === 30, 'Shepherd transform unexpectedly modified direct damage');
  assert(entity.shepherdMode === 'null', 'Shepherd no longer selects null from derived-heavy history');
  assert(orders.some((entry) => entry.order === 'metamorph' && entry.count === 6),
    'Shepherd metamorph cue/sample count changed');

  damage = system.beforeDamage(entity, 100, null, true);
  assert(Math.abs(damage - 48) < 1e-9, 'null Shepherd derived resistance changed');
}

// A fresh system makes the high-average/low-rate branch deterministic and spawns three replicants.
{
  let localNow = 20;
  const localReplicants: number[] = [];
  const localOrders: { order: EliteOrderId; count?: number }[] = [];
  const localPort: EliteDamageResponsePort = {
    time: () => localNow,
    conductivity: () => 0,
    corePower: () => corePower,
    spawnReplicant: (entity) => localReplicants.push(entity.id),
    emitOrder: (_entity, order, count) => localOrders.push({ order, count })
  };
  const local = new EliteDamageResponseSystem(localPort);
  const entity = elite('shepherd', 5);
  entity.hp = 700;
  local.noteResolvedDamage('rail_spear', 140, false);
  local.noteResolvedDamage('cleaver', 120, false);
  local.beforeDamage(entity, 30, 'rail_spear' satisfies SkillId, false);
  assert(entity.shepherdMode === 'fractured', 'Shepherd high-average branch changed');
  assert(localReplicants.length === 3, 'fractured Shepherd no longer creates three replicants');
  assert(localOrders.some((entry) => entry.order === 'metamorph' && entry.count === 2),
    'fractured Shepherd metamorph evidence changed');

  // Samples older than 12 s retire from the owned rolling history.
  localNow = 40;
  local.noteResolvedDamage('rail_spear', 1, false);
  const diagnostics = local.diagnostics();
  assert(diagnostics.length === 1 && diagnostics[0].amount === 1,
    'elite damage signature retention window changed');
}

console.log('elite-damage-response-regression OK', {
  orders,
  replicated,
  samples: system.diagnostics().length
});
