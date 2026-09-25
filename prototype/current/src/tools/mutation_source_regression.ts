import { Simulation } from '../core/simulation.js';

const assert = (ok: unknown, message: string) => {
  if (!ok) throw new Error(message);
};

const sim = new Simulation({ seed: 240919, hz: 60, benchmark: true }) as any;
sim.spawnElite();
const elite = sim.ents.find((e: any) => e.kind === 'elite');
assert(elite, 'failed to spawn elite');
elite.rarity = 'uplifted';
const record = sim.eliteEncounters().find((r: any) => r.id === elite.id);
assert(record, 'uplifted elite encounter missing');
record.rarity = 'uplifted';
elite.hp = 0;
sim.cleanup();
const drop = sim.pickups.find((p: any) => p.kind === 'mutation');
assert(drop, 'uplifted elite did not drop a Mutation Core');
assert(sim.mutationCores === 0, 'Mutation Core should not be granted before pickup');
sim.px = drop.x;
sim.pz = drop.z;
sim.updatePickups();
assert(sim.mutationCores === 1, 'Mutation Core pickup did not reach run inventory');

const common = new Simulation({ seed: 240920, hz: 60, benchmark: true }) as any;
common.spawnElite();
const commonElite = common.ents.find((e: any) => e.kind === 'elite');
assert(commonElite, 'failed to spawn common test elite');
commonElite.rarity = 'common';
const commonRecord = common.eliteEncounters().find((r: any) => r.id === commonElite.id);
assert(commonRecord, 'common elite encounter missing');
commonRecord.rarity = 'common';
commonElite.hp = 0;
common.cleanup();
assert(!common.pickups.some((p: any) => p.kind === 'mutation'), 'common elite dropped a Mutation Core');
console.log('mutation-source-regression OK', { upliftedDrop: true, commonDrop: false });
