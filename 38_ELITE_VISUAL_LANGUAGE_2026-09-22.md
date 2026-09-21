# 38 — Elite visual language / combat UI readability — 2026-09-22

## Status

**Implemented in executable:** `prototype/current/`  
**Version:** `v0.12.1`

This pass implements the owner-directed rule:

> In combat, the player should recognize what an elite is and what it is doing without reading its prefix/affix line.

It builds on documents 32 and 33. Simulation remains authoritative; this is a presentation/UI pass.

## Visual grammar

Four elite dimensions are deliberately separated into different channels.

| Information | Primary channel | Never the primary channel |
|---|---|---|
| Chassis / role | persistent physical silhouette motif | name prefix |
| Affix | one compact shoulder badge with a unique shape | a differently colored generic aura |
| Rarity / evolution tier | scale + blue/gold edge ticks / HP frame | another word above the enemy |
| Current dangerous action | body pose + authored world telegraph + final red overlay | passive color tint |

**Red is reserved for immediate hostile danger.** Persistent identity uses amber, cyan, teal, violet, green, pink, blue or gold depending on the channel.

## Chassis language

- **Marshal** — banner / pennant.
- **Hunter** — paired forward interceptor blades.
- **Bulwark / Prism** — broad directional frontal plate.
- **Architect / Veil** — orthogonal gate / drafting brackets.
- **Harvester / Null Weaver** — paired harvesting hooks.
- **Shepherd / Metamorph** — command staff / trident.
- **Broodmaker / Replicator** — three discrete clone/egg diamonds.
- **Archivist** — open-book page geometry.
- **Warden** — permanent crown/gate silhouette.

The same role distinction is mirrored by shape on the minimap and off-screen indicators.

## Affix language

Affixes no longer depend on reading `"Взрывной"`, `"Темпоральный"`, etc. in live combat.

- volatile — fuse/triangle;
- regenerating — plus;
- shielded — shield plate;
- vanguard — double chevron;
- temporal — hourglass;
- brood — three-node cluster;
- crowned — crown;
- swift — speed streaks;
- dense — solid square.

Shielded retains its world-space directional plate because direction is real gameplay information. Vanguard retains one faint influence boundary because the area around the elite is itself mechanically relevant. Other passive identity rings were removed.

## Current action / body language

Authored chassis actions also change the actor pose:

- Hunter stretches into the committed dash;
- Prism widens and braces;
- Architect rises before relocation;
- Replicator visibly pulses;
- Null Weaver leans into the sweep;
- Metamorph expands before its command pulse.

The final red danger pass remains above sprites and player VFX. It uses hard screen-space corners plus the committed direction; authored `CombatShape` remains the exact world-space geometry.

## Combat HUD

The combat HUD no longer prints the full `rarity + chassis + affix` string over every elite.

Instead:

- chassis marker sits at the left edge of the elite HP bar;
- affix badge sits at the right edge;
- rarity changes the HP-frame treatment;
- refused-card repertoire is a compact icon row instead of stacked text labels;
- boss title remains explicit because it is a structural encounter event.

Detailed names/rules remain available through the focused threat panel / inspection layer.

## Threat focus

The center threat panel is now sticky in calm combat. It does not jump between nearby elites every frame.

Priority:

1. Warden;
2. an elite currently preparing/performing a dangerous action;
3. current focused elite while it remains in the combat neighborhood;
4. nearest elite.

Calm state shows one short chassis rule plus one short affix rule. Danger state switches to an action name and a direct imperative such as:

- `СМЕНИ ТРАЕКТОРИЮ`;
- `ЗАЙДИ ЗА ФРОНТ ЩИТА`;
- `ВЫЙДИ ИЗ КРУГА`;
- `НЕ СТОЙ В ТОЧКЕ СМЕЩЕНИЯ`.

## Objective / navigation HUD

The previous long objective sentence is split into three scan targets:

- run phase + cleared-node count;
- next route / build source;
- finale countdown.

The minimap legend explicitly teaches:

- **shape = elite type**;
- **red = attack now**.

## Regression contract

`ux_readability_regression` now fails if:

- the elite identity pass disappears;
- persistent identity renders after the final red danger pass;
- chassis collapse back to one generic marker;
- minimap/off-screen chassis-specific shapes disappear;
- affixes lose their independent badge channel;
- sticky threat focus disappears;
- action-specific danger hints disappear;
- full affix-prefixed elite names return over every combatant;
- the threat panel stops separating chassis and affix signals;
- the objective returns to one long text sentence.

## Manual acceptance

The next playtest should answer **yes** to these questions before this pass is considered successful:

1. Can the owner point at Hunter / Prism / Architect / Harvester / Shepherd / Replicator in a dense fight without reading a name?
2. Can the owner distinguish volatile / regenerating / shielded / temporal / brood / crowned by the persistent badge?
3. Does red mean “react now” rather than “this enemy happens to be elite”?
4. Can the owner identify which elite is about to act from pose + red geometry?
5. Is the current target panel readable in peripheral vision without becoming a scrolling log?
6. Is the battlefield visibly calmer after removing stacked affix/refusal text and generic identity rings?
