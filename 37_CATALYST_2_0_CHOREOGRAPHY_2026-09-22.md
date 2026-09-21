# 37 — CATALYST 2.0: PHYSICAL PHENOMENON CHOREOGRAPHY — 2026-09-22

## Status

**Current owner-directed Catalyst design and v0.12 implementation record.**  
Executable: `prototype/current/`.

This document supersedes older Catalyst design where it conflicts.  
Document 36 remains authoritative for crowd-first combat, Quantity, elite ecosystem and Warden rules.

## 1. The rule

> **A Catalyst does not reward A for performing well. A Catalyst makes B physically use the form, position, movement or result of A.**

Mutation and Catalyst are deliberately different systems:

- **Mutation** changes what one Phenomenon is.
- **Catalyst** changes how two adjacent Phenomena are staged together.

A Catalyst slot is therefore too valuable to spend on “after A gets kills, B gains damage”.

## 2. Rejection rules

A live Catalyst is rejected if its main idea is primarily:

- +damage / +crit / +radius / -cooldown;
- kills / hit counters;
- wounds, stacks or invisible charges;
- “during the last N seconds”;
- a proc that leaves the actual geometry of both Phenomena unchanged.

Numbers may balance a physical mechanic, but may not be the mechanic.

### GIF test

Show ~3 seconds of combat without UI or text.

If a viewer cannot tell that A and B are physically interacting differently from two independent casts, the Catalyst is not finished.

### Verb test

A Catalyst should be explainable with a physical verb:

- **возникает из**;
- **едет / висит на**;
- **повторяет путь**;
- **идёт назад**;
- **сходится к центру**.

## 3. Current live Catalyst roster

Catalyst 2.0 intentionally starts with only five operators. Old Catalysts remain compatibility-only for old saves/replays and are not offered by Discovery.

### Источник

**Rule:** B originates where A physically finished useful work.

Examples:

- Rail → Toxic: mist opens on the final pierced/affected point rather than under the hero.
- Tether → Mortar: bombardment begins from the anchor/result point.
- Mortar → Orbit: Orbit temporarily exists around the bombardment result instead of the hero.

Implementation detail: “terminal” prefers actual scheduled impact/result points and actual hit positions before abstract maximum geometry.

### Носитель

**Rule:** live physical objects of A become origins for B.

Valid carriers currently include:

- Orbit blades;
- Returner shards;
- Mass Driver moving bodies;
- Sentry constructs.

Up to three live carriers are used in one choreography beat for readability/performance.

Examples:

- Orbit → Frost: separate Frost casts originate from visible moving blades.
- Shards → Arc: the Arc is launched from existing moving shards.
- Sentry → Rail: deployed turrets become firing origins.

### След

**Rule:** B is staged repeatedly along the path drawn by A.

Examples:

- Rail → Sentry: a line of batteries is built along the Rail path.
- Mass Driver → Toxic: persistent zones appear along the rolling route.
- Shards → Mortar: impacts follow the outbound/return path grammar.

Most Phenomena use three samples. Sentry uses adaptive sampling so neighbouring batteries stay close enough to form real infrastructure.

### Обратный ход

**Rule:** B starts at the far end of A's path and plays back toward A's origin.

Examples:

- Rail → Mass Driver: the heavy body appears at the far endpoint and travels back.
- Shards → Rail: the line begins from the remote end and is aimed back through the route.
- Mortar path → directional B: B inherits the reversed travel direction.

This is not “repeat B after A”; the B world origin and facing are reversed.

### Схлопывание

**Rule:** B uses the area grammar of A. Outer points converge toward a common center.

Directional B:

- several copies originate on A's perimeter and aim inward.

Radial/non-directional B:

- B resolves from the common center;
- A-affected enemies are physically nudged inward so the convergence is visible in world state.

The operator uses the full recorded area, not only the first local circle. This matters for multi-impact Mortar and multi-turret Sentry fields.

## 4. Partial compatibility is intentional

There is no requirement that every Catalyst fit every ordered pair.

The current physical capability model uses four signals emitted by A:

- `terminal` — a meaningful completion/result point;
- `path` — a spatial route;
- `carrier` — persistent/moving physical actors;
- `area` — a meaningful spatial boundary/field.

B separately declares which choreography operators it can accept.

Current compatibility over 110 ordered distinct live Phenomenon pairs:

| Catalyst | Compatible pairs | Ratio |
| --- | ---: | ---: |
| Источник | 70 | 63.6% |
| Носитель | 40 | 36.4% |
| След | 54 | 49.1% |
| Обратный ход | 49 | 44.5% |
| Схлопывание | 70 | 63.6% |

These numbers are descriptive, not quotas. A pair should be removed if it is visually weak even if that lowers coverage.

## 5. All 11 live Phenomena: physical audit

Every live Phenomenon now emits simulation-authored physical information. Renderer does not invent it afterward.

| Phenomenon | Physical language available to Catalysts |
| --- | --- |
| Ледяной фронт | area |
| Рельсовое копьё | terminal + path |
| Секач | terminal + short path + sector area |
| Цепная дуга | terminal + chained path |
| Орбитальные лезвия | live carriers + area |
| Бомбардир | terminal + impact path + area |
| Турель | live construct carriers + multi-point area |
| Токсичный туман | persistent area |
| Могильный вал | moving carrier + path + terminal |
| Возвратные осколки | moving carriers + path + terminal |
| Гравиякорь | anchor terminal + path + area |

The regression suite fails if a Phenomenon advertises one of these signals but its actual simulation cast does not produce it.

## 6. Sentry redesign for choreography

The old behaviour — “turret appears near the hero” — is not sufficient for this system.

Current Sentry rules:

- a normal Sentry beat creates a short **forward battery**, using facing and lateral lanes;
- placement is resolved against real cover with `freeOf()`;
- several recent waves may coexist;
- the result is a spatial structure that can be used by later Phenomena and Catalyst operators;
- every turret is a real `carrier`;
- the battery contributes a multi-point `area`.

### Trail Sentry

Trail does not blindly use three points anymore.

For long paths it adds enough deployment points to keep consecutive batteries roughly within network distance. This specifically prevents:

> visually seeing a “field of turrets” while Gravity Grid cannot physically connect any of them.

### Gravity Grid

Gravity Grid is a real world interaction:

- nearby Grid turrets form links;
- links emit actual control `CombatShape` rays;
- enemies near those segments take damage/control and are pulled toward the link;
- Catalyst-produced Sentry layouts therefore feed directly into the mutation rather than only changing presentation.

### Living Circuit

Existing Chain Arc Living Circuit can also use Sentry constructs as physical network nodes.

This is the desired emergent direction: a Catalyst changes placement, and an existing Mutation naturally becomes different because the world geometry changed.

## 7. World interaction rules

Catalyst relocation is not allowed to ignore the map.

New choreography origins:

- are clamped inside arena boundaries;
- are pushed out of solid obstacles through the same `freeOf()` geometry used by actors/constructs;
- Orbit relocation uses the same safety rule;
- actual projectiles/fields/constructs continue to obey their normal world interactions after relocation.

A Catalyst should not create a fake “other dimension” where attacks can spawn inside shelves/cover because a tooltip said so.

## 8. Presentation contract

Simulation emits a dedicated `CatalystChoreography` event containing:

- operator;
- left/right slots;
- left/right Phenomena;
- physical path/points;
- center where applicable.

Renderer has a different visual grammar for each operator:

- **Source:** visible handoff line + destination seal/pulse;
- **Carrier:** seals on actual carriers and visible links between them;
- **Trail:** visible traced path with staged points;
- **Reverse:** animated/readable direction back along the path;
- **Collapse:** perimeter-to-center convergence with strong center seal.

These cues are **not substitutes for gameplay**. B itself is actually cast from the new origins/path/carriers and therefore its ordinary projectiles, fields, constructs and CombatShapes also appear there.

UI additionally shows whether a Catalyst is physically compatible with the current A → B edge. Incompatible placement is explicit rather than silently doing nothing.

## 9. Validation

The dedicated `catalyst_choreography_regression` currently verifies:

- all 11 live Phenomena produce every signal they advertise;
- representative physical examples for all five operators;
- Sentry does not revert to spawning directly on top of the hero;
- relocated Orbit is rendered around its actual simulation center;
- presentation bridge preserves Catalyst choreography;
- renderer contains distinct visual grammar for all five modes;
- compatibility is partial, not universal.

An exhaustive pair smoke additionally executes **every currently advertised compatible ordered pair**. Current count: **283 pairs**.

For each pair it checks that:

- A produces a real physical trace;
- the Catalyst really fires;
- B actually activates;
- Source relocates B;
- Carrier uses a real A carrier;
- Trail creates separated B placements;
- Reverse begins at the far path head and faces backward;
- Collapse converges directional B or centers radial B;
- no world object receives invalid coordinates.

A separate Sentry/Grid check requires a Trail-created turret field to contain real connectable nodes and to generate actual Gravity Grid control links.

## 10. Legacy boundary

The old Catalyst 1.x catalogue remains executable only for old save/replay compatibility.

It is excluded from current Discovery.

Examples of compatibility-only ideas include old kill relays, scalar focus/surge/glut effects, wound/state transfer, generic count bonuses and similar proc/stat rules.

Do not re-add one to current Discovery merely because its old code still exists.

## 11. What this slice is trying to prove

This is a vertical slice, not a declaration that five operators are the final forever roster.

The question for manual playtest is narrow:

> When I swap the Catalyst between the same A and B, do I immediately see a different physical combination and start caring about the geometry/order of the Chain?

If the answer is yes, expand this grammar carefully.

If the answer is no, do not solve it with more Catalysts, more text or more percentages. Fix the physical choreography first.
