# 39 — Physical lifecycle / hitbox audit for Catalyst 2.x — 2026-09-22

## Status

**Implemented in executable:** `prototype/current/`  
**Version:** `v0.13`  
**Supersedes the v0.12 implementation mechanics in document 37.**  
Document 37 remains the design authority for the five Catalyst ideas; this document is the runtime/geometry authority.

## Why this audit existed

The owner reported that Catalyst interactions could happen at the wrong time, use data that a Phenomenon had not physically produced yet, or fail to correspond to a real hitbox/contact.

That report was correct.

The v0.12 implementation had useful choreography vocabulary, but its runtime model was still mostly:

`cast A -> finish trace immediately -> wait for B chain beat -> reposition/cast B from saved trace`

That model cannot be correct for a projectile, delayed strike, turret, moving blade or persistent field whose physically meaningful result happens later.

## Confirmed defects in v0.12

### 1. Scheduled coordinates were treated as completed physics

`scheduleStrike()` inserted future Mortar coordinates into choreography trace and promoted the last scheduled point to `terminal`.

Result: Source/Reverse could use a bombardment point before the shell had actually impacted.

### 2. Catalyst was coupled to the next Chain beat

`activateSlot(B)` called the old `executeChoreography()` using `lastContext.trace`.

Result: Catalyst timing was controlled by the global chain clock rather than by A reaching a point, colliding, firing or impacting.

### 3. Render geometry and physical truth were conflated

`CombatShape` was both a presentation cue and an input to choreography trace.

For moving Mass Driver / Shard Fan, the displayed aim ray could therefore masquerade as an already travelled physical route.

### 4. Real projectile movement was absent from Catalyst data

Projectiles already used swept-circle collision for gameplay, but Catalyst only knew their spawn-time carrier reference.

Their later path, cover collision, enemy collision and real endpoint were not Catalyst events.

### 5. Orbit had visible blades but gameplay used an invisible annulus

The renderer showed discrete orbiting blades.

Gameplay periodically checked:

`abs(distanceToCenter - orbitRadius) < constant`

An enemy could therefore be hit while standing between visible blades.

### 6. Hit tests were fragmented

Circle, sector, ray, field, boss and projectile tests used several independent formulas.

Some field checks used only target center distance while other systems included actor radius.

There was no single authoritative combat geometry module.

### 7. Separate areas were merged into imaginary bounding geometry

Sentry batteries, multiple Tether anchors and other multi-area traces were flattened into one approximate center/radius for Collapse.

That circle could contain space no Phenomenon actually occupied.

### 8. Multi-projectile paths could be cross-connected

Events from different Shards could be appended to one path in arrival order.

That could create a fake line from one projectile to another.

### 9. Reactive Catalyst cascades could lose their real origin

A B created remotely by Catalyst could arm B->C while code still assumed the player's position was the activation origin.

Reverse in a cascade could therefore point toward the hero instead of B's real birth point.

### 10. The old regression suite encoded the bug

The exhaustive test explicitly called:

`activateSlot(A); activateSlot(B);`

and expected choreography immediately.

It proved catalogue compatibility, but it also guaranteed the next-beat architecture could never be caught as wrong.

## v0.13 source of truth

The causal chain is now:

`Chain activation -> activationId -> live physical actors -> PhysicalEvent -> CatalystBinding -> reactive B activation`

A Chain beat can arm a Catalyst edge. It is not itself proof of contact or completion.

### Activation lineage

Every relevant hero activation receives an `activationId`.

That id follows:

- projectiles;
- delayed strikes;
- constructs;
- persistent fields;
- continuous Orbit contacts;
- Catalyst-created B activations and further B->C cascades.

Each binding stores its own immutable physical origin.

### Physical events

The runtime uses these internal event kinds:

- `path` — an actually traversed segment;
- `contact` — a real hitbox/carrier contact;
- `impact` — a delayed strike that has actually resolved;
- `area` — an area hitbox that physically exists now;
- `terminal` — the meaningful physical endpoint of the Phenomenon.

Scheduled/telegraphed coordinates are **not** physical events.

### Async completion

Moving projectiles and delayed strikes register as pending physical actors.

A terminal is emitted only when the Phenomenon contract actually declares `terminal` and its meaningful endpoint exists.

A semantic terminal such as a Returner turnaround is distinct from later actor disposal.

## Catalyst timing in v0.13

### Source

B fires on A's real `terminal`.

Examples:

- Rail: last physically useful pierced point / clipped ray endpoint;
- Mass Driver: actual stop / expiry / singularity completion;
- Shard Fan: real remote turnaround;
- Mortar: final resolved impact;
- Tether: authored anchor, not whichever enemy happened to be last in an iteration.

### Carrier

B fires on real carrier contact, not carrier creation.

Examples:

- Shard / Mass Driver: swept-circle enemy collision;
- Orbit: actual blade hitbox collision;
- Sentry: real turret shot;
- Mortar: actual delayed impact.

Carrier is deduplicated per physical carrier so the same actor cannot generate infinite B casts from one binding.

### Trail

B is placed progressively behind a route as A actually traverses it.

No point ahead of a moving projectile can exist for Trail.

For multi-projectile Phenomena, one real carrier path is kept coherent; events from different projectiles are never connected by a fake segment.

### Reverse

B waits for a real terminal and starts there.

Its backwards direction uses the recorded physical route. **Reverse requires both a real `path` and a real `terminal`.**

If a Phenomenon has no simulated route (currently Mortar), Reverse is incompatible. The runtime never fabricates an origin → terminal segment just to make the operator fit.

### Collapse

Collapse consumes exact recorded area shapes.

Circle and sector overlap use the same geometry functions as gameplay.

Separate Sentry/Tether/Orbit areas are not turned into a single bounding circle.

Multi-area producers are deliberately capped for readability/performance. Orbit as B is relocated only once because the current core owns one continuous Orbit set.

## Authoritative geometry

New module:

`src/core/geometry.ts`

It owns reusable primitives for:

- circle/circle overlap;
- swept moving-circle collision;
- closest point on segment;
- ray/capsule vs actor circle;
- sector vs actor circle;
- polyline length/sampling.

Gameplay systems migrated in this pass include:

- projectile collision;
- fields;
- Rail ray targeting and cover clipping;
- Frost circle;
- Cleaver sector and rupture;
- Tether area;
- Toxic reactive area;
- elite/boss sector and ray checks;
- delayed strike circles;
- Orbit blade contacts.

The actor's physical radius participates in these checks.

## Orbit correction

Orbit gameplay now computes the same discrete blade positions used by presentation:

`angle = time * angularSpeed + bladeIndex * 2π / count`

Each blade owns a small circular hitbox.

There is no annulus damage test.

An enemy on the orbit radius but between blades is not hit until a blade reaches it.

## Mortar correction

Mortar has no simulated ground/flight path actor in the current 2D core.

Therefore v0.13 does **not** claim that it emits `path`.

Its truthful signals are:

- `terminal` — final actual impact;
- `carrier` — each actual impact;
- `area` — each impact circle.

This directly supports the discussed example:

**Mortar -> Carrier -> Frost**

Frost is created on the tick of the physical impact, not when the impact was scheduled.

If a future 3D implementation simulates a real ballistic shell actor, Mortar may advertise `path` again only after that path actually exists in Core.

## Live Phenomenon signal audit

| Phenomenon | v0.13 physical signals |
|---|---|
| Frost Ring | area |
| Rail Spear | terminal + path |
| Cleaver | terminal + area |
| Chain Arc | terminal + path |
| Orbit Blades | carrier + exact blade areas |
| Mortar Bloom | terminal + carrier + impact areas |
| Sentry | firing carriers + discrete construct areas |
| Toxic Mist | area |
| Mass Driver | terminal + path + carrier |
| Shard Fan | terminal + path + carrier |
| Tether Drag | terminal + path + area |

The executable regression fails if a declared signal cannot be consumed by at least one real compatible Catalyst pair.

## Current compatibility matrix

Exhaustive live runtime result after the audit:

| Operator | Compatible ordered A->B pairs | of 110 |
|---|---:|---:|
| Source | 70 | 63.6% |
| Carrier | 46 | 41.8% |
| Trail | 45 | 40.9% |
| Reverse | 35 | 31.8% |
| Collapse | 70 | 63.6% |
| **Total exercised** | **266** | — |

Every advertised pair is run through physical lifecycle simulation. The test never manually activates B.

The random-build fuzz also retains the useful invariant that every adjacent pair of active Phenomena has at least one valid Catalyst option.

## Explicit Orbit limitation

The current Core owns one continuous hero Orbit set.

It can honestly:

- be A for Carrier via real blade contacts;
- be A for Collapse via real blade hitbox areas;
- be B for Source at one remote endpoint;
- be B for Collapse at one real area center.

It cannot honestly create independent simultaneous Orbit sets on several carriers.

Therefore **Carrier -> Orbit is intentionally incompatible** until Core gains multiple independent orbit actors.

This is an explicit capability boundary, not a renderer workaround.

## Regression coverage added

`physical_lifecycle_regression` checks, among other things:

1. target radius participates in circle/ray/sector geometry;
2. swept collision cannot tunnel through a circle;
3. field edge overlap uses actor hitbox, not only center;
4. Mortar Source cannot fire at scheduling time;
5. Mortar Carrier -> Frost fires on the actual impact tick;
6. Mass Driver Trail appears progressively and never ahead of the projectile;
7. Shard Carrier fires on the collision tick;
8. Sentry Carrier does not fire at deployment; it fires on a real turret shot;
9. Orbit does not damage an enemy between blades;
10. Orbit Carrier fires on a real blade collision;
11. Mortar Reverse is rejected because Mortar has no simulated path; Mass Driver Reverse consumes its real travelled route;
12. immediate Frost Collapse still works immediately because its area exists immediately;
13. the ordinary B chain beat does not duplicate the reactive B cast.

`catalyst_choreography_regression` now exercises all **266** advertised pairs through the same lifecycle.

## Additional collision/timing defects found during the audit

The first lifecycle rewrite exposed several second-order collisions that are now part of the contract:

- a compatible right-hand node **never receives an independent Chain-clock cast**, even if A takes several cycles to reach its terminal;
- Catalyst bindings have no arbitrary six-second timeout: Sentry/Orbit lineage lives as long as the real owning physical actors live;
- exact synchronous contact coordinates are captured inside damage resolution **before** Hook/pull/knockback can move the target;
- projectile collision with solid cover is a real Carrier contact, at the swept collision point;
- Gravity Grid uses the same rendered ray/capsule shape for damage/control instead of a second hand-written width formula;
- Rail uses the shared capsule-vs-actor test with the full actor radius;
- expired fields and constructs cease to exist before damage/contact/fire logic, eliminating one-tick ghost interactions;
- Mass Driver recoil cannot leave Catalyst origin at the hero's old position: the path begins at the real spawned moving body;
- disconnected impacts/contacts are never appended into a fake route;
- Mortar Gravity no longer pulls on marker creation. The marker is only a plan; the pull field begins after the actual impact creates it.

### Actor-owned lifetime

Async activation ownership is explicit rather than time-based:

- projectiles and delayed strikes register and close their physical lifetime;
- Sentry constructs hold lineage until destruction/TTL/capacity eviction;
- the continuous Orbit set holds lineage until replaced/removed;
- derived physical actors inherit lineage;
- activation bookkeeping is retired only after its causal event queue drains.

This is required for a slow A: the system must not decide that its Catalyst “expired” merely because an arbitrary number of seconds passed.

### Mutation coverage

The lifecycle regression also executes **240 catalogue-derived mutation × physical-signal cases**.

For every active Phenomenon it tests the base form plus every root/continuation/apotheosis entry against every physical signal that Phenomenon advertises. B is never manually activated to make these cases pass.

## Removed legacy architecture

The old `executeChoreography()` next-beat engine was deleted.

The current `activateSlot()` does not execute Catalyst 2.x from `lastContext.trace`.

Legacy Catalyst 1.x remains separately supported for old save/replay compatibility, but it is not the physical Catalyst 2.x runtime.

## Manual acceptance for the next playtest

A Catalyst implementation is wrong if any of these are observable:

- B appears before A's projectile/impact reaches the relevant point;
- B is placed ahead of A's currently travelled path;
- Carrier B appears merely because a turret/projectile spawned;
- an enemy is hit by Orbit while visibly between blades;
- a field misses an actor whose collision circle overlaps the field edge;
- Rail visually crosses solid cover while gameplay says the cover blocks it;
- Collapse affects empty space that exists only because several separate areas were merged;
- two Shards create a Trail segment directly between one another;
- B appears once from physical Catalyst and again from its ordinary chain beat.

The preferred debugging question is no longer “what did the previous chain tick record?”

It is:

**Which physical actor or hitbox emitted the event that caused this Catalyst reaction, at this exact simulation tick and position?**
