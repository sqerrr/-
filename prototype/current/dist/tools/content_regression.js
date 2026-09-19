import { catalystOrder, catalysts, resonance, resonanceOrder, skillOrder, skills } from '../content/definitions.js';
import { Simulation } from '../core/simulation.js';
const MUTATION_BRANCHES = Simulation.MUTATION_BRANCHES;
const fail = (m) => {
    throw new Error(m);
};
/**
 * Structural validation of the content catalogue.
 *
 * Deliberately free of exact counts. The roster is meant to grow towards ~18 Phenomena and
 * ~20 Catalyst operators, and a check that hard-codes today's size would have to be edited
 * on every single addition — which trains people to edit the test instead of reading it.
 * What is asserted here are the invariants that must hold at any catalogue size.
 */
/**
 * Phenomena that have definitions but are intentionally absent from the discovery pool.
 * Anything else missing from the roster is an oversight, not a decision, so this list is
 * what makes check 6 meaningful.
 */
// Nothing is parked any more: every defined phenomenon is reachable in a run.
const parkedSkills = [];
/** Floors, not targets: they only catch a catalogue that has been gutted. */
const MIN_SKILLS = 4;
const MIN_CATALYSTS = 4;
/** The six growth directions a run can invest in. Order is part of the canonical hash. */
const expectedAxes = [
    'tempo',
    'multiplicity',
    'precision',
    'persistence',
    'conductivity',
    'mobility'
];
const duplicates = (ids) => [
    ...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))
];
// --- Phenomena ---------------------------------------------------------------------------
if (skillOrder.length < MIN_SKILLS)
    fail(`discovery roster collapsed: ${skillOrder.length} Phenomena, expected at least ${MIN_SKILLS}`);
const skillDupes = duplicates(skillOrder);
if (skillDupes.length)
    fail(`duplicate Phenomena in the roster: ${skillDupes.join(', ')}`);
for (const id of skillOrder) {
    const s = skills[id];
    if (!s)
        fail(`roster lists ${id} but there is no Skill definition`);
    if (!s.identity || !s.weakness)
        fail(`${id}: identity and weakness must both be explicit`);
    if (!s.axes?.length)
        fail(`${id}: must opt into at least one growth direction`);
    for (const axis of s.axes ?? [])
        if (!resonanceOrder.includes(axis))
            fail(`${id}: unknown growth direction ${axis}`);
    const mutationIds = s.mutations.map((m) => m.id);
    const mutationDupes = duplicates(mutationIds);
    if (mutationDupes.length)
        fail(`${id}: duplicate mutation ids ${mutationDupes.join(', ')}`);
    // D28/D36: exactly three roots and exactly one continuation under every root.
    // This prevents the old bug where 4th/5th records leaked into the first-level offer.
    const roots = s.mutations.filter((m) => !m.parent);
    const children = s.mutations.filter((m) => !!m.parent);
    if (roots.length !== MUTATION_BRANCHES)
        fail(`${id}: has ${roots.length} mutation roots, expected exactly ${MUTATION_BRANCHES}`);
    if (s.mutations.length !== MUTATION_BRANCHES * 2)
        fail(`${id}: has ${s.mutations.length} mutation records, expected 6 (3 roots + 3 continuations)`);
    for (const root of roots) {
        const branch = children.filter((m) => m.parent === root.id);
        if (branch.length !== 1)
            fail(`${id}/${root.id}: expected exactly one continuation, got ${branch.length}`);
    }
    for (const child of children)
        if (!roots.some((root) => root.id === child.parent))
            fail(`${id}/${child.id}: continuation points to non-root parent ${child.parent}`);
    for (const m of s.mutations)
        if (!m.name || !m.description)
            fail(`${id}/${m.id}: mutation needs a name and a description`);
}
for (const id of parkedSkills)
    if (skillOrder.includes(id))
        fail(`parked Phenomenon ${id} leaked into the discovery roster`);
// Every definition is either discoverable or deliberately parked. Catches a Phenomenon that
// was authored but never wired into the roster.
for (const id of Object.keys(skills))
    if (!skillOrder.includes(id) && !parkedSkills.includes(id))
        fail(`Skill ${id} is defined but neither discoverable nor listed as parked`);
// --- Catalyst operators ------------------------------------------------------------------
if (catalystOrder.length < MIN_CATALYSTS)
    fail(`operator roster collapsed: ${catalystOrder.length} Catalysts, expected at least ${MIN_CATALYSTS}`);
const catalystDupes = duplicates(catalystOrder);
if (catalystDupes.length)
    fail(`duplicate Catalysts in the roster: ${catalystDupes.join(', ')}`);
for (const id of catalystOrder) {
    const c = catalysts[id];
    if (!c)
        fail(`roster lists Catalyst ${id} but there is no definition`);
    if (!c.name || !c.desc)
        fail(`${id}: Catalyst needs a name and a description`);
}
// No parked operators. Ten inert Catalysts once sat in the definitions with no logic behind
// them and no way to ever be offered; this check is what stops that from coming back.
for (const id of Object.keys(catalysts))
    if (!catalystOrder.includes(id))
        fail(`Catalyst ${id} is defined but can never be offered — remove it or add it to the roster`);
// --- Growth directions -------------------------------------------------------------------
if (resonanceOrder.join('|') !== expectedAxes.join('|'))
    fail(`unexpected growth directions: ${resonanceOrder.join(',')}`);
for (const id of resonanceOrder)
    if (!resonance[id])
        fail(`missing growth direction ${id}`);
console.log('content-regression OK', {
    skills: skillOrder.length,
    parkedSkills: parkedSkills.length,
    catalysts: catalystOrder.length,
    mutations: skillOrder.reduce((n, id) => n + skills[id].mutations.length, 0),
    coreAxes: resonanceOrder
});
