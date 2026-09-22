import {
  activeSkillOrder,
  legacySkillOrder,
  catalystOrder,
  legacyCatalystOrder,
  catalysts,
  phenomenonChoreography,
  catalystPairCompatible,
  mutationChildren,
  mutationRoots,
  resonance,
  resonanceOrder,
  skillOrder,
  skills
} from '../content/definitions.js';
import { Simulation } from '../core/simulation.js';
import type { CatalystId, ResonanceId, SkillId } from '../core/types.js';

const MUTATION_BRANCHES = Simulation.MUTATION_BRANCHES;
const fail = (m: string) => { throw new Error(m); };
const duplicates = (ids: readonly string[]) => [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
const expectedAxes: ResonanceId[] = ['tempo','multiplicity','precision','persistence','conductivity','mobility'];

if (activeSkillOrder.length < 8) fail(`active v0.11 roster collapsed: ${activeSkillOrder.length}`);
const dupes = duplicates(activeSkillOrder);
if (dupes.length) fail(`duplicate active Phenomena: ${dupes.join(', ')}`);
for (const id of activeSkillOrder) {
  const s = skills[id];
  if (!s) fail(`active roster lists ${id} without a definition`);
  if (!s.identity || !s.weakness) fail(`${id}: identity/weakness required`);
  const roots = mutationRoots(id);
  if (roots.length !== MUTATION_BRANCHES) fail(`${id}: expected ${MUTATION_BRANCHES} roots, got ${roots.length}`);
  if (s.mutations.length !== MUTATION_BRANCHES * 3) fail(`${id}: active v0.11 Phenomenon must expose 9 mutation records, got ${s.mutations.length}`);
  for (const root of roots) {
    const tier2 = mutationChildren(id, root.id).filter((m) => !m.apotheosis);
    if (tier2.length !== 1) fail(`${id}/${root.id}: expected one Tier II continuation, got ${tier2.length}`);
    const tier3 = mutationChildren(id, tier2[0].id);
    if (tier3.length !== 1 || !tier3[0].apotheosis)
      fail(`${id}/${root.id}: Tier II must lead to exactly one Apotheosis`);
    if (!tier3[0].name || !tier3[0].description) fail(`${id}/${tier3[0].id}: Apotheosis needs name/description`);
  }
}
// Compatibility definitions are explicit, disjoint and must never leak into the active Discovery roster.
if (legacySkillOrder.length !== 7) fail(`unexpected compatibility roster size: ${legacySkillOrder.length}`);
for (const id of legacySkillOrder) {
  if (activeSkillOrder.includes(id)) fail(`${id}: compatibility Phenomenon leaked into active roster`);
  if (!skillOrder.includes(id)) fail(`${id}: compatibility definition missing from canonical order`);
}
for (const id of activeSkillOrder) if (!skillOrder.includes(id)) fail(`${id}: active skill missing from canonical definitions order`);
for (const id of Object.keys(skills) as SkillId[]) {
  const mids = skills[id].mutations.map((m) => m.id);
  const md = duplicates(mids);
  if (md.length) fail(`${id}: duplicate mutation ids ${md.join(', ')}`);
}

const expectedChoreography:CatalystId[]=['source','carrier','trail','reverse','collapse'];
if(catalystOrder.join('|')!==expectedChoreography.join('|'))
  fail(`Catalyst 2.0 active roster drifted: ${catalystOrder.join(', ')}`);
const catalystDupes = duplicates([...catalystOrder,...legacyCatalystOrder]);
if (catalystDupes.length) fail(`duplicate Catalyst ids across live/legacy: ${catalystDupes.join(', ')}`);
if(legacyCatalystOrder.length!==20) fail(`unexpected Catalyst 1.x compatibility roster: ${legacyCatalystOrder.length}`);
for (const id of [...catalystOrder,...legacyCatalystOrder]) {
  const d = catalysts[id];
  if (!d?.name || !d.desc) fail(`${id}: incomplete Catalyst`);
}
for(const id of Object.keys(catalysts) as CatalystId[])
  if(!catalystOrder.includes(id)&&!legacyCatalystOrder.includes(id)) fail(`Catalyst ${id} belongs to neither active nor compatibility roster`);

const banned=/\b(?:damage|stacks?|kills?|hits?|wounds?|chance)\b|last\s+\d|урон|убий|попадан|стак|ранен|шанс/i;
for(const id of catalystOrder)
  if(banned.test(catalysts[id].desc)) fail(`${id}: active choreography fell back to proc/numeric language: ${catalysts[id].desc}`);

for(const id of activeSkillOrder){
  const p=phenomenonChoreography[id];
  if(!p||!p.emits.length||!p.accepts.length) fail(`${id}: missing physical choreography contract`);
}
for(const id of catalystOrder){
  let compatible=0,total=0;
  for(const left of activeSkillOrder)for(const right of activeSkillOrder){
    if(left===right)continue;
    total++;
    if(catalystPairCompatible(id,left,right))compatible++;
  }
  const ratio=compatible/Math.max(1,total);
  if(ratio<0.18||ratio>0.72) fail(`${id}: compatibility ${(ratio*100).toFixed(1)}% is not selective enough`);
}
if (resonanceOrder.join('|') !== expectedAxes.join('|')) fail(`unexpected core axes: ${resonanceOrder.join(',')}`);
for (const id of resonanceOrder) if (!resonance[id]) fail(`missing growth direction ${id}`);

console.log('content-regression OK', {
  activeSkills: activeSkillOrder.length,
  legacyDefinitions: legacySkillOrder.length,
  activeMutations: activeSkillOrder.reduce((n,id)=>n+skills[id].mutations.length,0),
  apotheoses: activeSkillOrder.reduce((n,id)=>n+skills[id].mutations.filter(m=>m.apotheosis).length,0),
  catalysts: catalystOrder.length,
  legacyCatalysts: legacyCatalystOrder.length
});
