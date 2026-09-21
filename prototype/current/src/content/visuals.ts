import type { CatalystId, ItemId, MutationId, SkillId } from '../core/types.js';
import { skills } from './definitions.js';

export interface SkillChoiceArt { normal: string; mutated: string }
const jpg = (id: string): SkillChoiceArt => ({ normal: `/assets/${id}_normal.jpg`, mutated: `/assets/${id}_mutated.jpg` });

/**
 * Choice-screen identity is deliberately content data rather than UI glue.
 * v0.11 relies on recognition at a glance: every active chassis owns unique art.
 * Legacy chassis may share a visual family because they cannot appear in Discovery.
 */
export const skillChoiceArt: Record<SkillId, SkillChoiceArt> = {
  ember_lance: jpg('ember_lance'),
  frost_ring: jpg('frost_ring'),
  rail_spear: jpg('rail_spear'),
  cleaver: jpg('cleaver'),
  chain_arc: jpg('chain_arc'),
  orbit_blades: jpg('orbit_blades'),
  mortar_bloom: jpg('mortar_bloom'),
  sentry: jpg('sentry'),
  toxic_mist: jpg('toxic_mist'),
  mass_driver: jpg('mass_driver'),
  shard_fan: { normal: '/assets/returner_normal.svg', mutated: '/assets/returner_mutated.svg' },
  tether_drag: { normal: '/assets/gravity_anchor_normal.svg', mutated: '/assets/gravity_anchor_mutated.svg' },
  repulse_halo: jpg('repulse_halo'),
  breach_line: jpg('rail_spear'),
  contact_saw: jpg('cleaver'),
  backhand: jpg('cleaver'),
  spreading_front: jpg('repulse_halo'),
  pin_burst: jpg('mortar_bloom')
};

export const catalystGlyph: Record<CatalystId, string> = {
  // Catalyst 2.0: the glyphs describe spatial verbs rather than rarity/stat families.
  source:'◎', carrier:'⛓', trail:'∿', reverse:'↫', collapse:'⇢',
  // Catalyst 1.x compatibility glyphs.
  capacitor:'×', anchor:'⌾', reservoir:'▣', echo_shard:'◈', relay:'⚡', conduit:'⇄', overflow:'↩',
  aegis_relay:'⬡', backflow:'↶', recoil:'↤', focus:'◆', surge:'↟', glut:'⬢', stagger:'⌁',
  splinter:'⋔', brand:'⌖', rime:'❄', harvest:'✚', vault:'▤', handoff:'⇥'
};

export const itemGlyph: Record<ItemId, string> = {
  plating:'▰', vitality:'♥', aegis_core:'⬡', ablation:'◫', keen_edge:'✦', hollow_point:'✣',
  siphon:'↺', bane:'†', light_step:'➤', quickened:'≫', short_cord:'⌇', afterimage:'◇',
  lodestone:'⌾', keen_eye:'◉', scavenger:'♻', beacon:'✧', spoils:'★', unravel:'⌘', tribute:'◆', reprisal:'⚔'
};

export const itemCategoryColor = {
  guard:'#7fbfff', edge:'#ff9b78', pace:'#78e7d0', finding:'#d0b2ff', elite:'#ffd36b'
} as const;

export function mutationGlyph(tag: string, id: string) {
  const q=(tag+' '+id).toLowerCase();
  if (/щит|guard|aegis|защит/.test(q)) return '⬡';
  // Do not search for bare "лед": it also matches Russian "след" (trail).
  if (/ледян|замор|frost|brittle|whiteout|glacier|spire/.test(q)) return '❄';
  if (/сеть|chain|circuit|relay|grid|lattice|контур/.test(q)) return '⟁';
  if (/взрыв|burst|rupture|deton|collapse|singular|shatter/.test(q)) return '✹';
  if (/маршрут|return|carousel|phoenix|trail|road|след/.test(q)) return '↺';
  if (/элит|mark|hunter|execution|spot|приоритет/.test(q)) return '⌖';
  if (/поле|field|mist|crater|storm|туман|облак/.test(q)) return '◉';
  if (/движ|манёвр|recoil|walker|charge|рывок|ход/.test(q)) return '➤';
  if (/масса|force|avalanche|gravity|грав/.test(q)) return '●';
  if (/кров|wound|sanguine|harvest|рана/.test(q)) return '◆';
  if (/дуг|arc|shock|электр|гроз/.test(q)) return 'ϟ';
  if (/луч|laser|rail|копь|пронз/.test(q)) return '↯';
  if (/турел|construct|bastion|battery/.test(q)) return '▣';
  return '✦';
}

export interface MutationBadge {
  /** Stable branch identity within one Phenomenon: 0/1/2. */
  branch: 0 | 1 | 2;
  /** I = specialization, II = engine, III = Apotheosis. */
  tier: 1 | 2 | 3;
  /** Semantic glyph; branch/tier are rendered separately so siblings never look identical. */
  glyph: string;
  tone: string;
  /** Test/debug identity used to prevent visually ambiguous sibling cards. */
  key: string;
}
const mutationBranchTone = ['#78d7ff','#ffb15e','#d194ff'] as const;

/**
 * A mutation card is a composition, not a second wall of text:
 * skill art = family, branch shape/colour = persistent build path, tier = depth,
 * glyph = the behavioural promise. This lets a player recognise a recurring branch at a glance.
 */
export function mutationBadge(skill: SkillId, id: MutationId): MutationBadge {
  const defs = skills[skill].mutations;
  const byId = new Map(defs.map((d) => [d.id, d]));
  const def = byId.get(id);
  if (!def) return {branch:0,tier:1,glyph:'?',tone:mutationBranchTone[0],key:`${skill}:missing:${id}`};
  let root = def;
  let tier: 1|2|3 = def.apotheosis ? 3 : def.parent ? 2 : 1;
  const seen = new Set<MutationId>();
  while (root.parent && !seen.has(root.id)) {
    seen.add(root.id);
    const parent = byId.get(root.parent);
    if (!parent) break;
    root = parent;
  }
  const roots = defs.filter((d) => !d.parent);
  const index = roots.findIndex((d) => d.id === root.id);
  const branch = (Math.max(0, Math.min(2, index)) as 0|1|2);
  return {
    branch,
    tier,
    glyph: mutationGlyph(def.tag, def.id),
    tone: mutationBranchTone[branch],
    key: `${skill}:b${branch}:t${tier}:${def.id}`
  };
}
