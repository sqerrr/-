import { catalystOrder, catalysts, resonance, resonanceOrder, skillOrder, skills } from '../content/definitions.js';
const fail = (m) => {
    throw new Error(m);
};
const expectedSkills = [
    'ember_lance',
    'frost_ring',
    'cleaver',
    'chain_arc',
    'orbit_blades',
    'mortar_bloom',
    'sentry',
    'mass_driver'
];
if (skillOrder.length !== 8)
    fail(`expected 8 discoverable v0.10 Phenomena, got ${skillOrder.length}`);
for (const id of expectedSkills) {
    if (!skillOrder.includes(id))
        fail(`missing discoverable Phenomenon ${id}`);
    const s = skills[id];
    if (!s)
        fail(`missing Skill definition ${id}`);
    if (!s.identity || !s.weakness)
        fail(`${id}: identity/weakness must be explicit`);
    if (!s.axes?.length)
        fail(`${id}: must opt into at least one Core Axis`);
}
if (['rail_spear', 'toxic_mist', 'repulse_halo'].some((id) => skillOrder.includes(id)))
    fail('parked Phenomena leaked into the sandbox roster');
if (catalystOrder.length !== 9)
    fail(`expected 9 level-less Catalyst operators, got ${catalystOrder.length}`);
for (const id of catalystOrder)
    if (!catalysts[id])
        fail(`missing Catalyst ${id}`);
if (resonanceOrder.join('|') !== 'tempo|multiplicity|precision|persistence|conductivity|mobility')
    fail(`unexpected Core Axes: ${resonanceOrder.join(',')}`);
for (const id of resonanceOrder)
    if (!resonance[id])
        fail(`missing Core Axis ${id}`);
console.log('content-regression OK', {
    skills: skillOrder.length,
    catalysts: catalystOrder.length,
    coreAxes: resonanceOrder
});
