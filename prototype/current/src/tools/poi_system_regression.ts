import { PoiSystem, type PoiSystemPort } from '../core/poiSystem.js';
import type { GameEvent } from '../core/types.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('poi-system-regression: ' + message);
}

let tick = 60;
let bossSpawned = false;
let px = 0;
let pz = 0;
let maxHp = 100;
let choiceOpen = false;
let unownedSkills = true;
let healed = 0;
let barrier = 0;
let phenomenon = 0;
let catalyst = 0;
let resonance = 0;
const events: GameEvent[] = [];

const port: PoiSystemPort = {
  tick: () => tick,
  bossSpawned: () => bossSpawned,
  playerX: () => px,
  playerZ: () => pz,
  maxHp: () => maxHp,
  hasChoice: () => choiceOpen,
  hasUnownedSkills: () => unownedSkills,
  emit: (event) => events.push(event),
  healPlayer: (amount) => { healed += amount; },
  grantBarrier: (amount) => { barrier += amount; },
  openPhenomenonDiscovery: () => { phenomenon++; },
  openCatalystDiscovery: () => { catalyst++; },
  openResonanceChoice: () => { resonance++; }
};

const system = new PoiSystem(port);
system.initialize();

assert(system.all.length === 8, 'authored POI count changed');
assert(system.all.filter((poi) => poi.kind === 'phenomenon').length === 3,
  'phenomenon source count changed');
assert(system.all.filter((poi) => poi.kind === 'catalyst').length === 2,
  'catalyst source count changed');
assert(system.get(1)?.x === 14 && system.get(1)?.z === -7,
  'opening phenomenon coordinate changed');

// Entering the authored radius emits awaken then clear in the same update and opens discovery.
px = 14;
pz = -7;
system.update();
assert(system.get(1)?.state === 'cleared', 'POI no longer completes immediately after awakening');
assert(events.length >= 2 && events[0].type === 'PoiAwakened' && events[1].type === 'PoiCleared',
  'POI awaken/clear event ordering changed');
assert(phenomenon === 1, 'phenomenon POI no longer opens discovery');

// If no Phenomenon remains, a phenomenon source falls back to Resonance.
unownedSkills = false;
px = 34;
pz = 21;
system.update();
assert(resonance === 1, 'exhausted phenomenon POI no longer falls back to Resonance');

// Catalyst POI routes to Catalyst discovery.
px = -19;
pz = 9;
system.update();
assert(catalyst === 1, 'catalyst POI reward route changed');

// Clearing while another choice is open still changes world state but opens no second modal.
choiceOpen = true;
px = -34;
pz = -23;
system.update();
assert(system.get(3)?.state === 'cleared', 'choice-open POI did not clear its world state');
assert(resonance === 1, 'choice-open POI opened a second reward modal');
choiceOpen = false;

// Vital POI heals by max(45, 42% max HP) and grants 20 barrier.
maxHp = 200;
px = 2;
pz = 29;
system.update();
assert(healed === 84 && barrier === 20, 'vital POI recovery formula changed');

// Boss phase freezes dormant POI discovery.
bossSpawned = true;
px = 35;
pz = -23;
system.update();
assert(system.get(6)?.state === 'dormant', 'POI activated after boss spawn');

// Explicit completion is idempotent (DeathResolution compatibility seam).
bossSpawned = false;
const before = events.length;
assert(system.complete(6), 'explicit POI completion failed');
assert(!system.complete(6), 'cleared POI completed twice');
assert(events.length === before + 1 && events.at(-1)?.type === 'PoiCleared',
  'explicit completion emitted unexpected events');

console.log('poi-system-regression OK', {
  count: system.all.length,
  phenomenon,
  catalyst,
  resonance,
  healed,
  barrier
});
