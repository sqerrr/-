import { existsSync, readFileSync } from 'node:fs';
import { activeSkillOrder, catalysts, skills } from '../content/definitions.js';
import { items } from '../content/items.js';
import { catalystGlyph, itemGlyph, mutationBadge, skillChoiceArt } from '../content/visuals.js';

function assert(c: unknown, m: string): asserts c { if (!c) throw new Error('readability regression: ' + m); }
const assetPath=(url:string)=>'public'+url;

// Recognition must not depend on rereading names. Every active chassis owns unique normal/mutated art.
const normal=new Set<string>(), mutated=new Set<string>();
for(const id of activeSkillOrder){
  const art=skillChoiceArt[id];
  assert(!!art?.normal&&!!art?.mutated,`${id}: missing choice art`);
  assert(existsSync(assetPath(art.normal)),`${id}: missing normal asset ${art.normal}`);
  assert(existsSync(assetPath(art.mutated)),`${id}: missing mutated asset ${art.mutated}`);
  assert(!normal.has(art.normal),`${id}: active chassis reuses normal art ${art.normal}`);
  assert(!mutated.has(art.mutated),`${id}: active chassis reuses mutated art ${art.mutated}`);
  normal.add(art.normal); mutated.add(art.mutated);

  const defs=skills[id].mutations;
  const roots=defs.filter(m=>!m.parent);
  assert(roots.length===3,`${id}: expected 3 mutation branches`);
  for(let tier=1;tier<=3;tier++){
    const row=defs.filter(m=>tier===1?!m.parent:tier===2?!!m.parent&&!m.apotheosis:!!m.apotheosis);
    assert(row.length===3,`${id}: tier ${tier} expected 3 choices, got ${row.length}`);
    const branches=new Set<number>();
    for(const m of row){
      const b=mutationBadge(id,m.id);
      assert(b.tier===tier,`${id}/${m.id}: visual tier ${b.tier} != ${tier}`);
      assert(b.glyph.length>0,`${id}/${m.id}: empty mutation glyph`);
      branches.add(b.branch);
    }
    assert(branches.size===3,`${id}: tier ${tier} does not expose three distinct branch badges`);
  }
}

for(const id of Object.keys(catalysts) as (keyof typeof catalysts)[])
  assert((catalystGlyph[id]??'').trim().length>0,`${id}: catalyst has no glyph`);
for(const id of Object.keys(items) as (keyof typeof items)[])
  assert((itemGlyph[id]??'').trim().length>0,`${id}: item has no glyph`);

// Category is communicated by the frame/window, not only by prose.
const html=readFileSync('public/index.html','utf8');
for(const cat of ['doctrine','phenomenon','catalyst','item','resonance','mutation']){
  assert(html.includes(`.choicebox.cat-${cat}`),`choice window has no ${cat} category frame`);
  assert(html.includes(`.card.cat-${cat}`),`choice card has no ${cat} category identity`);
}
assert(html.includes('#eliteAlert.rare'),'rare events lack a dedicated visual treatment');
assert(html.includes('.mutation-branch.branch-0')&&html.includes('.mutation-branch.branch-1')&&html.includes('.mutation-branch.branch-2'),'mutation branches lack distinct shapes');

// Renderer must expose the combat states the player is expected to react to.
const renderer=readFileSync('src/renderer/webgl2.ts','utf8');
for(const token of ['status.marked','status.chilled','status.frozen','status.wounded','status.toxined','status.exposed','shieldState === \'commit\'','shieldState === \'broken\'','behavior === \'returner\'','behavior === \'roller\''])
  assert(renderer.includes(token),`renderer does not visibly handle ${token}`);
assert(!renderer.includes("e.orderActive && e.squadTask"),'routine squad routing returned as combat-line clutter');
assert(renderer.includes('drawDangerOverlay')&&renderer.includes("eliteAction"),'elite authored actions are missing from the top danger layer');
assert(renderer.includes("telegraph_boss")&&renderer.includes("shield_commit"),'hostile tells do not share the danger visual language');

for(const signature of [
  "src.includes('frost')", "src.includes('rail')", "src.includes('cleaver')", "src.includes('orbit')",
  "src.includes('arc')", "src.includes('mortar')", "src.includes('toxic')", "src.includes('mass')",
  "src.includes('return')", "src.includes('tether')"
]) assert(renderer.includes(signature),`combat family lacks a moving visual signature: ${signature}`);

const platform=readFileSync('src/platform/main.ts','utf8');
assert(platform.includes("echoTell=e.echoPhase==='tell'"),'Elite Echo tell is missing from the live threat panel');
assert(platform.includes("e.type === 'BossPattern' || e.type === 'EliteEchoPhase'"),'routine attack tells are not explicitly kept out of sentence-sized combat alerts');
assert(platform.includes("e.type === 'RareEvent'"),'rare gameplay events have no player-facing alert');
assert(platform.includes('rareAlertUntil')&&platform.includes('if (!rare && now < rareAlertUntil) return'),'rare alerts can be overwritten by routine telegraphs');

console.log('readability-regression OK',{
  activePhenomena:activeSkillOrder.length,
  uniqueNormalArt:normal.size,
  uniqueMutatedArt:mutated.size,
  catalysts:Object.keys(catalysts).length,
  items:Object.keys(items).length,
  mutationEntities:activeSkillOrder.reduce((n,id)=>n+skills[id].mutations.length,0)
});
