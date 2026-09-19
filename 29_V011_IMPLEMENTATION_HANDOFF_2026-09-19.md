# 29 — v0.11 CORE REDESIGN implementation handoff — 2026-09-19

## Status

This document is the current implementation handoff after the owner's second weapon/buildcraft investigation and the explicit instruction to implement the redesign thoroughly rather than minimize work.

**Executable:** `prototype/current/`

**Version:** `0.11.0`

**Authority order:** latest owner chat instructions > this handoff > documents 27/28 as research > older decisions/specs. Documents 21–26 remain useful history but are superseded where v0.11 intentionally reopens them.

## Owner requirements that define this slice

1. Combat readability is gameplay, not polish. If a mechanic/state/interaction matters, it must be visible.
2. Phenomena must differ by behaviour and build contract, not only circle/line/sector geometry and damage numbers.
3. Elite refusals must preserve the fantasy of a declined Phenomenon without literally using the player's mass-clear cast.
4. Progression categories must be separated. A level-up must not ask the player to compare unrelated currencies of power in one mixed trio.
5. The player must be able to steer a build under roguelike RNG rather than merely accept random unrelated pieces.
6. Melee/proximity builds need systemic compensation (reach/size, guard, mobility, force/stagger), not only a damage multiplier.
7. Mutation III / Apotheosis must be a visible behaviour transformation. `+damage/+radius` alone is invalid.
8. Choice UI must support recognition: icons/glyphs, category frames, short promises, optional detail text. Rare events must win the player's attention.
9. Refactoring/concept change is explicitly allowed where needed; preserving old work is not a goal by itself.

## v0.11 active Phenomenon roster

Discovery uses **11 active chassis**. Seven older definitions remain in source as legacy compatibility but do not pollute normal Discovery.

Active:

- `frost_ring` — Frostfront / freeze-brittle-shatter control.
- `rail_spear` — single heavy precision rail / Mark payoff.
- `cleaver` — proximity sweep with Momentum/Wound/Force interactions.
- `chain_arc` — conductive network / relay behaviour.
- `orbit_blades` — persistent orbit / guard / physical outbound blades.
- `mortar_bloom` — Bombardier actor / delayed route and field play.
- `sentry` — construct network rather than a disguised homing projectile.
- `toxic_mist` — persistent/propagating toxin system.
- `mass_driver` — Grave Roller: slow physical heavy body interacting with cover.
- `shard_fan` — Returner: physical outbound/returning actor.
- `tether_drag` — Gravity Anchor: pulls toward an anchor/field rather than suicidally toward the hero.

The old roster quota of 18 is no longer protected by design. Behavioural uniqueness has priority over catalogue count.

## Progression split

The old mixed level-up is removed as the default progression contract.

### XP level -> Doctrines

Level-up asks one comparable question: which global build specialization to develop?

Implemented Doctrines:

- Might
- Size
- Quantity
- Duration
- Mobility
- Guard
- Force
- Precision

These form the build declaration layer. They are deliberately separate from Chain Resonance/Operators.

### Phenomenon -> discovery/source

Phenomena come through their own discovery channel/POI and retain the refusal/elite-Echo relationship.

### Catalyst -> catalyst source/cache

Catalysts remain complete operators rather than scalar upgrade levels.

### Item -> world/elite/shared relic economy

Items remain a separate shared-source power layer.

### Mutation -> Mutation Core

Serious elites are the structural source. Mutation Core does not compete with a normal XP card.

## Melee / proximity redesign

A proximity build now has an ecosystem rather than only a short range:

- **Size** increases melee reach/orbit/area scale where compatible.
- **Guard** turns successful close pressure into Barrier and reduces some proximity risk.
- **Mobility** supports entering/exiting dangerous ranges and dash cadence.
- **Force** contributes stagger, cover interaction and shield Stability break.
- Cleaver uses Momentum/Wound/Force behaviour; it is no longer only a short sector with high damage.

The goal is not to guarantee melee supremacy; it is to stop the rules themselves from making ranged precision the only rational answer to elites.

## Shield elite redesign

The old always-facing shield was removed as the main interaction. Shielded elites now expose a state machine:

- `guard` — tracks and protects a sector.
- `commit` — direction is fixed for a real flank/positioning window.
- `broken` — Stability has failed; the elite exposes a clear punish/recovery window.

Melee/Force can damage Stability. State and Stability are present in snapshot/presentation. Guard/Commit/Broken have different field/HUD treatment. `ЩИТ СЛОМАН` is a RareEvent.

## Elite Echo architecture

A refused Phenomenon **never executes the player's `dispatchSkill()` from an elite**.

Instead:

`Refused Phenomenon -> authored Elite Echo -> tell -> active -> recovery`

Each of the 11 active chassis has a dedicated Echo telegraph. Examples:

- Rail: locked tracer/line before the shot; cover/position matter.
- Frost: forecast frost-front positions, not instant player ring copy.
- Cleaver: committed close sector with recovery.
- Chain: multiple forecast nodes.
- Orbit: physical radial projectiles with a gap.
- Bombardier: sequenced forecast impacts.
- Sentry: authored firing lanes/construct-like pressure.
- Toxic: visible contaminated trail/fields.
- Grave Roller: physical slow projectile.
- Returner: physical outbound/returning lanes.
- Gravity Anchor: forecast control point/tether rather than instant unavoidable pull.

This preserves the emotional link to the declined card without giving a single-target enemy a hero weapon designed for mass clear.

## Mutations: 3 x 3 x active Phenomena

Every active Phenomenon has:

- 3 Mutation I roots — specialization.
- 3 Mutation II branch-preserving engines.
- 3 Mutation III Apotheoses — one continuation for each branch.

Totals:

- **11 active Phenomena**
- **99 active mutation definitions**
- **33 Apotheoses**

Runtime regression rejects an advertised Apotheosis with no simulation branch. Tier III is required to create distinct behaviour/VFX, not only scalar continuation data.

Representative Apotheoses implemented:

- Frost: moving glacier/tornado/front, spirefall, white storm.
- Rail: delayed sky strike / execution / lattice.
- Cleaver: harvest follow-up, Wound rupture, rift hook.
- Arc: hunting storm, living circuit via constructs, closed loop.
- Orbit: Aegis crown, sanguine orbit, physical phoenix outbound/return.
- Bombardier: gravity field, carpet pass, marked elite passes.
- Sentry: walker/bastion behaviour, synchronized hunter battery, gravity grid.
- Toxic: plague road, septic detonation, autonomous pestilent host.
- Grave Roller: avalanche growth, terminal collapse, recoil manoeuvre.
- Returner: execution return, carousel orbit, phoenix trail interaction.
- Gravity Anchor: singularity, multi-anchor dragnet, gravity prison.

## Readability / animation contract

### Choice recognition

The player should not need to reread paragraphs every time.

- All **11 active Phenomena have unique normal and mutated choice art**.
- Returner and Gravity Anchor have dedicated SVG art instead of reusing Needle/Arc art.
- All **20 Catalysts** have glyphs.
- All **20 Items** have glyphs.
- All **8 Doctrines** have glyph/color identities.
- Mutation cards compose:
  - Phenomenon art = family;
  - persistent branch shape/color = build path;
  - central semantic glyph = behavioural promise;
  - small I/II/III depth marker = mutation level.
- The visual branch remains stable from Mutation I through II and Apotheosis III.

### Choice category framing

Choice windows/cards have different category framing for:

- Doctrine
- Phenomenon
- Catalyst
- Item
- Resonance
- Mutation

Mutation III gets an explicit `АПОФЕОЗ` treatment rather than looking like an ordinary upgrade.

Long descriptions are behind `Подробнее`; the card surface uses one short promise.

### Combat-state readability

Renderer explicitly displays:

- Mark
- Chill
- Frozen
- Wound
- Toxin
- Exposed
- Shield Guard/Commit/Broken + Stability
- formation/task direction for press/flank/intercept/hold
- physical Returner state
- physical Grave Roller state
- contested relic state

### Distinct combat motion signatures

Colour is not the only discriminator. v0.11 adds family-specific moving signatures on top of canonical hit geometry:

- Frost — rotating crystalline spokes.
- Rail — white-hot centre line + impact scar/cross.
- Cleaver — moving sweep/slash blades.
- Chain Arc — jitter/ticks along electrical path.
- Orbit — tangent blade marks moving around perimeter.
- Bombardier — reticle + descending tracer.
- Toxic — uneven drifting cloud/bubbles.
- Grave Roller / Mass — transverse heavy-motion ribs plus physical body.
- Returner — readable outbound/return flight path plus physical actor.
- Gravity Anchor — animated inward-force spokes.
- Sentry — persistent construct sprites/network behaviour rather than generic cast-only geometry.

Elite Echo telegraphs use the same family language through their authored source ids.

### Rare-event priority

Rare events use a stronger banner and are now **priority locked** for their short display window. A frequent ordinary Elite Echo alert cannot immediately overwrite:

- Mutation Core pickup
- Apotheosis
- Shield Break
- Shatter and other authored rare transformations

This directly fixes the failure mode where a rare event technically existed but disappeared under routine warnings.

## Build viability laboratory

`npm run test:builds` runs an isolated 4000 HP Hunter elite at a mid-run state, with identical environment and natural preferred spacing for three archetypes. Five seeds each, with and without Shielded affix.

Current medians:

### Normal elite

- melee: **7.4 s**
- ranged: **5.9 s**
- control: **7.6 s**

### Shielded elite

- melee: **8.4 s**
- ranged: **7.1 s**
- control: **8.0 s**

This is a guardrail, not final balance. The important result is that proximity/control can now kill the same elite on the same order of magnitude instead of ranged precision being several times better by construction. The test deliberately fails if the open-elite TTK spread exceeds 2x.

## Why ranged changed without a blanket nerf

The earlier ranged lab had a structural double-dip:

- Hunter Battery multiplied an already-heavy Sentry/Rail mode and consumed/generated Mark inside the same loop.
- Rail Gun could be multiplied by Quantity even though its identity is one monstrous shot.

v0.11 keeps Rail Gun as one heavy weapon. Quantity belongs to branches that explicitly promise multiple actors/shots. Hunter Battery is a synchronized lock-on/battery behaviour instead of a hidden multiplier pile.

## Technical regression suite

`npm test` currently passes.

Important v0.11-specific checks:

- active roster = 11, legacy definitions excluded from Discovery;
- active mutations = 99;
- Apotheoses = 33;
- every advertised Apotheosis has a runtime branch;
- every active Phenomenon has an authored Elite Echo tell;
- Echo does not leak through `SkillActivated` / player dispatcher;
- melee/Force can create Shield Broken state;
- Shield state/Stability survive into renderer snapshot;
- all active Phenomenon choice art is unique and assets exist;
- all Catalysts/Items have glyphs;
- each mutation tier exposes all three persistent branch identities;
- all progression categories have distinct window/card framing;
- important status/mechanics are handled by renderer;
- rare alerts have priority over routine Echo alerts;
- isolated melee/ranged/control elite lab remains within sanity bounds.

Current 60-second headless hash: **`f67493cb`**.

## Manual QA still required

Technical tests prove contracts and deterministic simulation, not aesthetics. A human playtest should specifically answer:

1. Can each active Phenomenon be identified during a dense fight without reading the log?
2. Are Elite Echo `tell -> active -> recovery` phases understandable before taking damage?
3. Does Shield Commit/Break feel like a real opening rather than a hidden state machine?
4. Does a Size/Guard/Mobility/Force proximity build feel intentionally supported from early run onward?
5. Are Apotheosis III transformations visually and mechanically exciting enough to justify serious elite rewards?
6. Does Bombardier now feel like an actor/path system, or is artillery still too indirect/annoying and should be removed entirely?
7. Are Returner / Grave Roller / Gravity Anchor genuinely distinct in moment-to-moment play?
8. Does the separated progression create a legible build plan, or do Discovery/Catalyst frequencies still prevent steering?
9. Are rare banners informative without becoming spam?
10. Do formation links/tasks survive actual VFX clutter and affect player decisions?

## Next work should respond to playtest, not restore old quota

Do **not** automatically re-add the seven legacy Phenomena to reach 18. Do not convert Apotheosis back into scalar upgrades. Do not route elite refusals through player casts. Do not merge all progression back into one level-up window.

If a chassis fails the next playtest, replace/reconceptualize it rather than protecting sunk cost.
