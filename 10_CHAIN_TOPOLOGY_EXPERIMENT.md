# CHAIN TOPOLOGY EXPERIMENT — universal physical cells with typed semantics

**Status:** researched candidate, **NOT implemented in v0.9B**.

## Problem

Current layout is visually rigid:

`P — C — P — C — P — C — P`

It is clear, but Catalyst physically lives in a different slot type. Owner wants to test whether slots themselves can be interchangeable: put either Phenomenon or Catalyst in a cell and reorder freely.

A naive fully-universal solution creates ambiguity:

- what does a leading Catalyst modify?
- does `C P P` affect one or two Phenomena?
- what does `P C C P` mean?
- do Catalysts consume Chain time?
- can player accidentally make a dead/invalid machine?
- how can UI explain effect before combat?

Therefore proposal separates **physical freedom** from **semantic freedom**.

## Candidate A — recommended first experiment

### Physical layout

7 ordered cells. Any cell can contain a Phenomenon, Catalyst, or be empty.

Limits for first experiment:

- max 4 Phenomena;
- max 3 Catalysts;
- max 2 consecutive Catalysts between Phenomena;
- Reserve remains separate.

### Execution grammar

1. Only a **Phenomenon consumes a Chain beat**.
2. A Catalyst is a **zero-time operator**.
3. A run of Catalysts between two Phenomena binds to that transition.
4. Operators compose **left-to-right**.
5. Adjacent Phenomena have no operator relation; both still execute on their beats.
6. Catalyst before the first Phenomenon or after the last Phenomenon is invalid/inert and must be visually rejected or auto-returned to Reserve.

Examples:

- `P P` → two independent consecutive Phenomena.
- `P C P` → Catalyst transforms/transfers context from left P into right P.
- `P C1 C2 P` → `C1` then `C2` compose on the same transition.
- `P _ C _ P` → empty cells are ignored physically; parse still reads ordered non-empty tokens.
- `C P` / `P C` → invalid edge state; UI must explain why.

## Why Catalysts should not consume time

If Catalyst takes a beat, adding synergy can lower action frequency and feel like a tax. Zero-time operator preserves the fantasy that the player is wiring components together, not replacing attacks with menu nodes.

This also keeps early two-Phenomenon + one-Catalyst spike immediate:

`P P` → two actions  
`P C P` → same two actions, but now causal transformation exists.

## Binding visualization

Planning UI must parse the chain and draw a **brace/arrow** over each transition:

`[Ember] ── Echo ──▶ [Frost]`

For `P C C P`:

`[Ember] ── Relay → Detonator ──▶ [Mortar]`

Hovering any Catalyst highlights exactly:

- source Phenomenon;
- operator position/order;
- destination Phenomenon;
- concrete current effect, using actual pair semantics.

Invalid Catalysts are grey/red and explain the missing source/target; never silently do nothing.

## Runtime visualization

When transition fires:

1. source attack has its own VFX;
2. brief operator pulse travels along the parsed edge;
3. target effect/changed execution responds;
4. if two operators compose, pulses are sequential or use two distinct glyphs — not a blended rainbow.

The same parse object should feed both Core and UI; no renderer-side interpretation of topology.

## Core data model candidate

Conceptually:

```ts
type ChainToken =
  | { kind: 'phenomenon'; id: SkillId }
  | { kind: 'catalyst'; id: CatalystId }
  | null;

type ParsedTransition = {
  fromCell: number;
  fromSkill: SkillId;
  catalysts: { cell:number; id:CatalystId }[];
  toCell: number;
  toSkill: SkillId;
};
```

Parser walks ordered non-empty tokens and produces Phenomenon execution order + transitions. Deterministic parser belongs in Core and is unit-tested independently of renderer/drag-drop.

## UI drag rules

Recommended UX:

- drag any token to any of 7 cells;
- drop swaps cells rather than destroying contents;
- after every tentative drag, show live parsed preview;
- invalid placement is allowed only as temporary planning state **or** immediately rejected consistently; do not allow closing Planning with silent invalid operators;
- one-click `Auto-wire` is optional later, not in first experiment.

## Candidate B — fully free graph

Allow any Catalyst to target arbitrary source/target Phenomena independent of physical order.

Rejected for first experiment because:

- order stops being self-explanatory;
- drag topology becomes graph editing;
- wire crossing creates UI clutter;
- player can optimize graph while ignoring the chain fantasy;
- much harder to read at combat speed.

Could be a future Legendary Law, not baseline.

## Candidate C — Catalyst as universal support socket inside a Phenomenon

Easy to understand, but loses the core identity that **relationships between adjacent Phenomena** are first-class. It trends toward ordinary weapon + support gems and is therefore not preferred.

## Relation to Noita / PoE lessons

Noita demonstrates that strict order plus local operator semantics can create enormous combinatorial depth. It also demonstrates the danger of making the parser too implicit. Black Archive should expose the parse visually.

PoE2 support-gem redesign is a warning that supports can converge on the same globally-best set if their identity is mostly numeric. Catalysts should therefore remain structural verbs with pair/context semantics, not generic `More Damage` gems.

## Acceptance questions for this experiment

A universal-slot prototype is successful only if a new player can, without external explanation:

1. move a Catalyst and correctly predict which pair changes;
2. explain why `P C P` differs from `P P C`;
3. understand `P C C P` in one glance;
4. never wonder whether Catalyst used a combat beat;
5. see the same source/operator/target relation in Planning and in combat;
6. make a meaningful topology choice with only 3–4 Phenomena.

If these fail, return to typed edge slots rather than adding more tutorial text.
