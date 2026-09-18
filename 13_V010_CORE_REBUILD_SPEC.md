# v0.10 CORE REBUILD — authoritative sandbox spec

**Date:** 2026-09-17  
**Status:** playable design sandbox, **not** a balance/content release.  
**Executable:** `prototype/current/`

This document overrides older progression / Catalyst / free-Elite assumptions where they conflict. The purpose of v0.10 is to test whether the project can finally produce the intended **combinatorial “casino” run-building**, frequent memorable Elites, and viable mid-run pivots without hiding sunk cost behind another name.

---

## 1. Hard invariants of this branch

These are the assumptions the sandbox is explicitly testing. Do not casually reintroduce the old behavior during balance work.

1. **Phenomena have no meaningful personal levels.** A late Phenomenon must enter at the current run baseline instead of being several levels behind.
2. **Catalysts have no levels and no generic potency stat.** A Catalyst is a complete rule/operator when found.
3. **Vertical power belongs primarily to the run/build.** Core Rank supplies the baseline; broad Core Axes specialize the machine.
4. **The full Chain cycle has a fixed duration.** Adding a Phenomenon must not reduce the natural activation frequency of Phenomena already owned.
5. **The Archive does not age.** A module that sat inactive for ten minutes must still be mechanically viable when reintroduced.
6. **Mutation capacity belongs to the run.** Moving a mutated Phenomenon out of the active Chain returns its Mutation Core in this sandbox instead of permanently burning the investment.
7. **Map exploration is not “go find another Elite.”** POIs are primarily build/RNG control and structural rewards; free Elites are their own combat heartbeat.
8. **An Elite anomaly must visibly alter a rule of the encounter.** “More HP / more speed / an aura that barely changes anything” is not sufficient identity.
9. **Adaptation reacts to what the build actually does, not to item levels.** Useful observables are event rate, source concentration, Catalyst-derived share, coverage, distance, persistence and movement.
10. **A jackpot build is allowed to be a jackpot.** The director may vary encounter structure, but it should not secretly normalize player power through blanket resistances or arbitrary HP inflation.

---

## 2. Vertical progression: Core Rank + Core Axes

### Core Rank

Ordinary XP increases a run-wide **Core Rank**. Core Rank supplies the generic baseline power curve for all Phenomena, including Phenomena discovered late and those currently in the Archive.

This is deliberately different from transferring “weapon level” or “slot level.” The accumulated numeric baseline belongs to the run itself.

### Current experimental Core Axes

The first implementation exposes six broad axes:

| Axis | Intended role |
|---|---|
| **Tempo** | Shortens the duration of the full Chain cycle. |
| **Multiplicity** | Improves native count/instance mechanics on compatible Phenomena. |
| **Precision** | Improves crit / precision mechanics on compatible Phenomena. |
| **Persistence** | Improves native persistent effects on compatible Phenomena. |
| **Conductivity** | Improves Catalyst-facing budgets/thresholds where supported. |
| **Mobility** | Improves player movement and movement-facing systems. |

These exact six axes are **not sacred content**. They are a test of the higher-level rule: vertical investment should describe the *kind of machine the run has become*, not how long a specific weapon happened to be equipped.

Important consequence: replacing a Phenomenon can still be strategically unattractive because the new Phenomenon may fit the chosen global axes poorly. That is desired build identity, not artificial late-drop obsolescence.

---

## 3. Chain cadence

The old active-span cadence made additional Phenomena dilute the activation rate of earlier Phenomena. v0.10 reverses that relationship.

The run has one full-cycle duration. Each active Phenomenon receives one natural activation per cycle; adding more active Phenomena places more actions *inside* the same cycle.

Example at a nominal 1.20 s cycle:

| Active Phenomena | Spacing of actions inside the cycle | Natural cadence of each Phenomenon |
|---:|---:|---:|
| 1 | 1.20 s | once / 1.20 s |
| 2 | 0.60 s | once / 1.20 s |
| 3 | 0.40 s | once / 1.20 s |
| 4 | 0.30 s | once / 1.20 s |

This means horizontal expansion adds throughput instead of secretly nerfing the existing carry.

Technical regression in this branch explicitly checks that four active Phenomena create roughly four times as many natural activations over a fixed interval as one Phenomenon.

---

## 4. Phenomenon contract

A Phenomenon is **not** “an AoE shape with a DPS coefficient.” Each test Phenomenon should be describable by one immediate strength and one immediate weakness that remain relevant in a mass-combat survivors-like.

The current eight-Phenomenon slice is intentionally small:

| Phenomenon | Identity / strength | Weakness | Supported direction |
|---|---|---|---|
| **Игла** (`ember_lance`) | Fast narrow accurate attack, naturally crit-oriented. | Poor mass coverage without build support. | Precision / Tempo / compatible Multiplicity. |
| **Ледяной фронт** (`frost_ring`) | Large-scale crowd control and setup. | Low direct killing power by itself. | Persistence / Tempo / control-facing Catalyst rules. |
| **Секач** (`cleaver`) | Very high close burst / crowd cutting. | Almost no distant pressure; player must accept proximity. | Tempo / Precision / geometry-supporting interactions. |
| **Цепная дуга** (`chain_arc`) | Efficiently distributes attacks across separated targets. | Loses value against isolated targets. | Multiplicity / Tempo / routing interactions. |
| **Орбитальные лезвия** (`orbit_blades`) | Dense continuous contact around the player. | Weak distant presence. | Persistence / Multiplicity / movement interactions. |
| **Мортирный цветок** (`mortar_bloom`) | Large delayed pack-clearing impact. | Poor immediate answer to close / rapidly relocating pressure. | Multiplicity / Persistence / routing. |
| **Турель** (`sentry`) | Persistent autonomous pressure and target priority. | Less useful when the fight constantly migrates away from its useful space. | Persistence / Precision / routing. |
| **Пронзающий луч** (`mass_driver`) | Low per-target damage but long-line piercing scales with enemy density/alignment. | Mediocre against isolated targets. | Precision / Multiplicity / positional routing. |

This roster is not final content. Its job is to prove that two Phenomena are different because their *rules and useful situations* differ, not merely because one draws a circle and the other a line.

---

## 5. Mutations

Mutations remain Phenomenon-specific because they are the qualitative **evolution** layer, but v0.10 changes their economy and philosophy.

### Philosophy

A normal Mutation should primarily be:

> **new paradigm / new capability + a noticeable power spike**

not:

> “become something different, but lose 30–50% somewhere else so the spreadsheet stays flat.”

Trade-off mutations may exist later, but should be special cases rather than the default balancing method.

### Mutation Cores

The run receives a limited number of Mutation Cores at progression milestones. A Core is allocated to a Phenomenon to choose one of its mutation branches.

In the current sandbox, moving a mutated Phenomenon between active Chain and Archive clears that mutation and returns the Core. This is intentionally generous: the test asks whether late pivoting becomes interesting once prior progression is not irreversibly glued to the old module.

Current curated mutation pool is deliberately only two branches per active Phenomenon. Legacy mutation definitions remain in code but are not the target design.

---

## 6. Catalyst grammar

Catalysts no longer have `level` or `potency`. A Catalyst is a **rule over Chain execution**.

The implementation uses a small number of operator families. A trigger such as “on hit” is one valid primitive, but it is not the whole design space.

### Current implemented operator slice

| Catalyst | Family | Current sandbox behavior |
|---|---|---|
| **Relay** | Gate / trigger | Enough kills on the left can produce one extra reduced activation on the right. This is intentionally the familiar baseline trigger example. |
| **Anchor** | Router | The next natural right-hand Phenomenon is aimed at the centroid produced by the left side. It changes *where* the right effect happens. |
| **Capacitor** | Converter | Mass interaction on the left becomes extra instance count on the right. It converts one property of an event into another parameter rather than forwarding damage. |
| **Reservoir** | Memory / storage | Accumulates hit mass across cycles and releases it as a later burst. |
| **Conduit** | Fusion | Carries a compatible produced state/quality from the left into targets affected by the right. |
| **Echo Shard** | Imprint | Creates a secondary spatial echo; kept as one simple proc-like operator for comparison. |
| **Backflow** | Feedback | Strong result on the right modifies the next pass of the previous Phenomenon. |
| **Overflow** | Topology | Under a mass-success condition, execution can bounce `A → B → A` once, guarded against recursion. |
| **Aegis Relay** | Conversion to defence | Sufficient control/mass interaction becomes player barrier instead of more damage. |

The acceptance rule for future Catalyst work is stricter than “does DPS go up?” At least half of the active Catalyst pool should be impossible to summarize as **“A makes B attack again.”**

### Event data

Catalyst logic should prefer aggregated mass-combat data: targets affected, kills, crit count, centroid/direction, source identity, natural vs derived, position in the cycle, etc. Avoid turning ordinary enemies into RPG actors carrying large bespoke state machines.

### Rarity / duplicate direction

Do not restore generic `+16% potency` as the default duplicate reward. Future rarity should primarily mean a richer rule, alternate gate/router behavior, reforge opportunity, or a rarer operator variant.

---

## 7. Archive and mid-run replacement

The Archive currently stores alternate Phenomena and Catalysts without passive personal leveling because there is nothing personal to level.

A late module therefore enters at current Core Rank. The decision to switch should be about:

- fit with global axes;
- fit with current Catalyst topology;
- Mutation Core allocation;
- current encounter problems;
- newly discovered synergies.

It should **not** be decided by “this item appeared eight minutes later, so its level is unusably low.”

Planning mode remains the place for substantial replacement/reordering. The sandbox deliberately avoids introducing constant inventory micro-management during combat.

---

## 8. Free-Elite redesign: anomalies, not upgraded normals

The old design started from a normal-like Elite and layered chassis / affix / adaptation. v0.10 temporarily stops using that as the design starting point.

The six free-roaming Elite prototypes below are **anomalies**. Each is intended to alter a different layer of the encounter quickly enough to remain visible even in a high-power run.

| UI identity | Internal legacy chassis ID | New rule |
|---|---|---|
| **Хищник** | `hunter` | Predictive intercept movement with telegraphed high-speed dashes. The body itself moves differently from normals. |
| **Завеса** | `architect` | Creates moving fog/veil zones. Distant auto-targeting can lose targets through the veil while manual/directional geometry still works. Attacks perception/target acquisition rather than adding resistance. |
| **Репликатор** | `broodmaker` | Repeated incoming hit events create adapted copies. Killing a copy feeds damage back to the parent. High event-rate builds create their own alternate kill route instead of receiving a flat penalty. |
| **Призма** | `bulwark` | Records a source imprint. Repeating the same source is strongly damped; changing source breaks the imprint and exposes the Elite. Tests diversity of Chain output rather than a weapon-type immunity. |
| **Нуль-ткач** | `harvester` | Catalyst-derived events are partially captured into visible charges; direct Phenomenon hits consume charges and become more effective. Tests Catalyst-heavy builds through counterplay, not `Catalyst Resistance`. |
| **Метаморф** | `shepherd` | At an HP threshold, immediately chooses a new form from recent damage signature: derived-heavy, very high event-rate, large sparse hits, or default/migratory. Adaptation changes behavior/form rather than applying a hidden resistance table. |

Old generic free-Elite affixes are disabled for this slice. Do not add procedural affix/suffix combinations until several base anomalies are independently memorable in manual play.

### Combat Signature

The implementation already gathers a small recent window of damage events. The long-term signature should remain compact and mass-combat appropriate:

- event rate;
- average / burst size;
- source concentration;
- Catalyst-derived share;
- targets per event / coverage;
- persistent occupancy;
- origin distance;
- player movement.

Different anomalies should read different subsets. Avoid one universal “counter table” that always selects the mathematically best punishment.

### Jackpot rule

Not every Elite receives mandatory damage gates. A very strong build may erase a Predator quickly. Structural survival belongs only to anomalies whose visible mechanic naturally creates it (copies, phase change, capture nodes, etc.).

---

## 9. Normal density and enemy role

v0.10 raises normal density substantially because the previous large map often felt sparse and made mass-combat Phenomenon differences harder to read.

Current population target ramps approximately from high-20s / high-50s early toward substantially larger late populations, with a hard cap around 238. Spawn credit rate was also raised. Normal contact damage was reduced to prevent “more bodies” from automatically meaning a proportional lethal-DPS increase.

These numbers are **not balance targets**. They are there to test whether Phenomenon identities, Catalyst mass events, and Elite anomalies remain readable under a more appropriate survivors-like density.

---

## 10. Elite heartbeat

Free Elites are frequent again. Current compressed 8-minute sandbox uses approximately:

- first free Elite around 22 s;
- ~20 s interval early;
- ~16 s mid-run;
- ~12 s later;
- concurrent cap roughly 2 → 3.

This is not final cadence; it exists to make Elite mechanics testable repeatedly in one run rather than treating Elites as rare side events.

Elite rewards currently favor structural choices: new Catalyst/operator, Core Axis, or an alternative Phenomenon depending on state.

---

## 11. Map / POI role

POIs in this sandbox no longer require spawning a guardian Elite simply to deliver their reward. Free Elites already provide the combat heartbeat.

Current POIs are still only a transitional implementation, but the design role is now clear:

> **combat supplies randomness/material; exploration gives the player leverage over that randomness and the build.**

Future POI work should therefore concentrate on things like Catalyst reforge, Discovery steering, Mutation routing, recovery, previewing future choices, or transmutation — not “another version of the same Elite reward.”

Legacy boss-support consequences tied to unresolved POIs remain as old infrastructure and should be reviewed separately from the new exploration purpose.

---

## 12. Explicitly parked / legacy systems

The codebase still contains compatibility structures from v0.9B. Their existence is not design approval:

- old Elite affix selection;
- old whole-run `chooseAdaptation()` helper;
- guardian spawning helpers;
- some old mutation branches and old per-skill runtime fields;
- legacy charge fields used by historical mechanics;
- typed `4 Phenomena + 3 Catalyst edges` topology.

Do not infer future design from these leftovers. Remove them only when doing so is safe and useful; the purpose of this branch is to test the new core before a broad cleanup.

---

## 13. Acceptance criteria for manual playtest

The redesign is promising only if most of the following are true in real play:

1. A Phenomenon found late is a real option instead of automatic trash.
2. The player can replace/reorder without discovering that ten minutes of invisible personal XP were lost.
3. Adding a Phenomenon never lowers the natural cadence of old Phenomena.
4. Different Phenomena have recognizable situations where they are excellent and situations where they are awkward.
5. A Catalyst changes routing, timing, topology, memory, conversion, defence or fusion often enough that the system does not collapse into extra casts.
6. Moving one Catalyst to another edge can visibly change behavior without merely increasing a DPS number.
7. Mutation feels like evolution and reward, not a compulsory nerf/trade.
8. At least four or five free Elite anomalies can be identified by what happens on screen without reading the name.
9. A Catalyst-heavy Chain encounters a different mechanical problem than a mono-source Chain, but neither receives a blanket immunity counter.
10. The same Phenomena with different Core Axes / Catalysts / Mutation allocation can produce meaningfully different runs.
11. Exploration is attractive even when the player is already killing free Elites efficiently.
12. A jackpot build is allowed to feel absurdly powerful.

---

## 14. Balance status

**Not calibrated.** The technical/headless run is deliberately only a stability and pressure signal. A recent deterministic run with dumb automated movement reached roughly 118 simultaneous enemies and died at about 5:19 of the compressed 8-minute run after encountering 18 Elites.

That is not a target difficulty result. Do not respond by immediately reducing/increasing enemy HP. First perform the manual qualitative tests above and decide whether the new core produces better decisions and visible mechanics.
