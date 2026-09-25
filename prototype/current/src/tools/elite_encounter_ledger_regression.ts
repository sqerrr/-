import { EliteEncounterLedger } from '../core/eliteEncounterLedger.js';
import { makeEnt } from '../core/state.js';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('elite-encounter-ledger-regression: ' + message);
}

const numeric = (value: number): number => value;
const ledger = new EliteEncounterLedger();

const elite = makeEnt({
  id: 77,
  kind: 'elite',
  x: 0,
  z: 0,
  hp: 1000,
  maxHp: 1000,
  radius: 1,
  speed: 1,
  contactDps: 0
});
elite.chassis = 'hunter';
elite.rarity = 'uplifted';
elite.repertoire = [11, 12];

ledger.start(elite, 5);
const record = ledger.get(elite.id);
assert(record, 'spawned elite was not indexed');
assert(ledger.all().length === 1, 'spawn created duplicate/missing encounter row');
assert(
  record.chassis === 'hunter' &&
  record.rarity === 'uplifted' &&
  record.spawnedAt === 5 &&
  record.repertoire === 2,
  'spawn metadata changed'
);

// Contact time only accrues during an active exchange and keeps the authored 1.6 s grace.
ledger.noteContact(elite.id, 5.5, 1 / 60);
assert(record.contactTime === 0, 'unengaged elite accumulated contact time');
record.engagedAt = 5.2;
record.lastExchangeAt = 5.4;
ledger.noteContact(elite.id, 6.0, 0.25);
assert(record.contactTime === 0.25, 'active exchange contact time changed');
ledger.noteContact(elite.id, 7.1, 0.25);
assert(numeric(record.contactTime) === 0.25, 'contact grace widened past 1.6 s');

// Rival cast attribution is indexed by skill without touching gameplay state.
ledger.noteRivalCast(elite.id, 'rail_spear');
ledger.noteRivalCast(elite.id, 'rail_spear');
ledger.noteRivalCast(elite.id, 'frost_ring');
assert(record.casts === 3, 'rival cast count changed');
assert(record.castSkills.rail_spear === 2 && record.castSkills.frost_ring === 1,
  'per-skill rival cast attribution changed');

// Dash attribution only applies to living, recently exchanging encounters.
record.lastExchangeAt = 8;
ledger.noteDash(9);
assert(record.dashes === 1, 'active encounter did not receive dash attribution');
ledger.noteDash(10.1);
assert(numeric(record.dashes) === 1, 'stale encounter received dash attribution');

// Physical relic captures and terminal state stay on the same row.
ledger.noteItem(elite.id, 'glass_quill');
assert(record.itemsTaken.includes('glass_quill'), 'captured relic attribution changed');
ledger.finish(elite.id, 12, true);
assert(record.endedAt === 12 && record.killed, 'encounter finish state changed');

ledger.noteDash(12.1);
assert(numeric(record.dashes) === 1, 'finished encounter kept receiving dash attribution');

// Non-elite actors never create encounter rows.
const normal = makeEnt({
  id: 78,
  kind: 'footnote',
  x: 0,
  z: 0,
  hp: 100,
  maxHp: 100,
  radius: 0.4,
  speed: 1,
  contactDps: 0
});
ledger.start(normal, 13);
assert(ledger.all().length === 1 && !ledger.get(normal.id),
  'normal enemy leaked into elite encounter ledger');

console.log('elite-encounter-ledger-regression OK', {
  casts: record.casts,
  contactTime: record.contactTime,
  dashes: record.dashes,
  items: record.itemsTaken
});
