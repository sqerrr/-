import { itemOrder } from '../content/items.js';
import { PlayerGrowthSystem } from '../core/playerGrowthSystem.js';
import type { DoctrineRuntime, ResonanceRuntime } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('player-growth-regression: ' + message);
}
function close(actual: number, expected: number, message: string) {
  assert(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, got ${actual}`);
}

const resonance: ResonanceRuntime = {
  tempo: 0,
  multiplicity: 0,
  precision: 0,
  persistence: 0,
  conductivity: 0,
  mobility: 0
};
const doctrines: DoctrineRuntime = {
  might: 0,
  size: 0,
  quantity: 0,
  duration: 0,
  mobility: 0,
  guard: 0,
  force: 0,
  precision: 0
};
const state = {
  armor: 10,
  maxHp: 100,
  hp: 50,
  moveSpeed: 5,
  tempo: 0.1,
  pickupRadius: 8,
  fortune: 0.2,
  globalPower: 1,
  healed: 0,
  barrier: 0
};

const growth = new PlayerGrowthSystem({
  armor: () => state.armor,
  setArmor: (value) => { state.armor = value; },
  maxHp: () => state.maxHp,
  setMaxHp: (value) => { state.maxHp = value; },
  playerHp: () => state.hp,
  setPlayerHp: (value) => { state.hp = value; },
  moveSpeed: () => state.moveSpeed,
  setMoveSpeed: (value) => { state.moveSpeed = value; },
  tempo: () => state.tempo,
  setTempo: (value) => { state.tempo = value; },
  pickupRadius: () => state.pickupRadius,
  setPickupRadius: (value) => { state.pickupRadius = value; },
  fortune: () => state.fortune,
  setFortune: (value) => { state.fortune = value; },
  globalPower: () => state.globalPower,
  setGlobalPower: (value) => { state.globalPower = value; },
  resonance: () => resonance,
  doctrines: () => doctrines,
  healPlayer: (amount) => {
    const before = state.hp;
    state.hp = Math.min(state.maxHp, state.hp + amount);
    state.healed += state.hp - before;
  },
  grantBarrier: (amount) => { state.barrier += amount; }
});

// Every catalogue item routes through this owner and remains stackable.
for (const id of itemOrder) growth.applyItem(id);
assert(growth.heldItems.length === itemOrder.length, 'item haul lost or deduplicated a relic');
assert(new Set(growth.heldItems).size === itemOrder.length, 'catalogue pass did not record every item');
close(state.armor, 32, 'plating armor');
close(state.maxHp, 130, 'vitality max hp');
close(state.hp, 80, 'vitality immediate heal');
close(state.healed, 30, 'vitality heal accounting');
close(growth.itemDamageTakenMul, 0.9, 'ablation multiplier');
close(growth.itemDamageMul, 1.14, 'keen edge multiplier');
close(growth.itemCrit, 0.08, 'hollow point crit');
close(growth.itemSiphon, 0.02, 'siphon');
close(growth.itemEliteDamageMul, 1.2 * 1.16, 'elite damage relic stacking');
close(state.moveSpeed, 5 * 1.09, 'light step movement');
close(state.tempo, 0.22, 'quickened tempo');
close(growth.dashCooldownMul, 0.82, 'short cord dash cooldown');
close(growth.dashIFrameMul, 1.4, 'afterimage iframe');
close(state.pickupRadius, 8 * 1.35, 'lodestone pickup radius');
close(state.fortune, 0.45, 'keen eye fortune');
close(growth.itemXpMul, 1.15, 'scavenger xp');
close(growth.itemRelicRateMul, 0.82, 'beacon relic cadence');
close(growth.itemCoreBonus, 1, 'spoils core bonus');
close(growth.itemRefusalDamageMul, 0.75, 'unravel refusal protection');
close(growth.itemBarrierOnEliteKill, 48, 'elite-kill barrier relic stacking');

// Shared run upgrades are applied by the same growth boundary.
const speedBeforeAxis = state.moveSpeed;
growth.applyCoreAxis('mobility', 2);
assert(resonance.mobility === 2, 'mobility resonance level not applied');
close(state.moveSpeed, speedBeforeAxis * 1.09, 'mobility resonance movement');

const speedBeforeDoctrine = state.moveSpeed;
growth.applyDoctrine('mobility', 2);
assert(doctrines.mobility === 2, 'mobility doctrine level not applied');
close(state.moveSpeed, speedBeforeDoctrine * Math.pow(1.055, 2), 'mobility doctrine movement');
close(growth.dashCooldownMul, 0.82 * Math.pow(0.96, 2), 'mobility doctrine dash cooldown');

const armorBeforeGuard = state.armor;
growth.applyDoctrine('guard', 2);
assert(doctrines.guard === 2, 'guard doctrine level not applied');
close(state.armor, armorBeforeGuard + 8, 'guard doctrine armor');
close(state.barrier, 10, 'guard doctrine barrier');

// Generic HP deliberately does not use healPlayer: legacy behavior does not increment healing metrics.
const healedBeforeGlobalHp = state.healed;
const hpBeforeGlobalHp = state.hp;
growth.applyGlobal('hp', 18);
close(state.maxHp, 148, 'global max hp');
close(state.hp, hpBeforeGlobalHp + 18, 'global hp refill');
close(state.healed, healedBeforeGlobalHp, 'global hp unexpectedly counted as healing');

const powerBefore = state.globalPower;
growth.applyGlobal('globalPower', 0.3);
close(state.globalPower, powerBefore + 0.3, 'global power');

console.log('player-growth-regression OK', {
  items: growth.heldItems.length,
  mobility: resonance.mobility,
  doctrines: { mobility: doctrines.mobility, guard: doctrines.guard }
});
