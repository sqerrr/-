# 33 — Animation / presentation contract, legacy and documentation audit — 2026-09-20

## Status

**Current implementation record for v0.11.3.**  
Executable: `prototype/current/`.

This document supersedes older statements about how gameplay state reaches animation/presentation. It does not replace the owner playtest goals in documents 30–32 or the pending Phenomena 2.0 redesign.

## Why this audit exists

Manual playtest raised a concrete question: when gameplay changes the number, geometry or behaviour of an effect, does the renderer show the *same thing*?

The answer before this pass was: **not always**.

The core simulation was usually correct, but presentation still contained old duplicated formulas. In other places the simulation itself computed a state and then discarded it before Snapshot.

The resulting failure mode is especially dangerous in an autobattler: the player can make a build decision whose numerical/gameplay result and visible result disagree.

## Required architecture

The presentation contract is now:

`Simulation → GameEvent / Snapshot → PresentationBridge → WebGL renderer`

Rules:

1. **Simulation is the only authority for gameplay geometry and count.**
2. `CombatShape` owns instantaneous ray/sector/circle geometry.
3. `Snapshot.projectiles`, `fields`, `constructs` and `orbit` own persistent/moving bodies.
4. `SkillActivated` may add a small body/muzzle accent only. It must not reconstruct range, radius, projectile count or mutation geometry.
5. Presentation-critical ownership/evolution state must survive Snapshot.
6. A renderer regression must fail if duplicated gameplay formulas return.

## Bugs found and corrected

### 1. Renderer re-simulated projectile/effect count

The old `skillCast` presentation block recomputed its own count from parts of `SkillRuntime` and global Multiplicity.

That omitted or contradicted:

- Doctrine Quantity;
- Catalyst transient count bonuses;
- Tier-II `countAdd`;
- per-Phenomenon support for Multiplicity;
- mutation-authored fixed patterns;
- simulation caps and randomised impact points.

It also drew false extra waves for Phenomena such as Frost/Toxic that do not support Multiplicity.

**Fix:** full attack geometry is no longer authored in `skillCast`. The cue only gives a small origin/body accent. Exact shapes come from `CombatShape` and exact moving/persistent objects from Snapshot.

### 2. Orbit blade count was calculated but did not affect gameplay

`updateOrbitBlades()` calculated a blade `count` but never used it. Therefore:

- `st.count`;
- Multiplicity;
- `orbit_many`;

could change the intended blade count without changing contact cadence. Renderer separately invented its own blade count, including obsolete level thresholds.

**Fix:** `orbitProfile()` is now the shared simulation profile. It owns real blade count, radius and hit interval. More blades moderately increase real contact cadence with a square-root curve; Snapshot exports the same count/radius and renderer draws exactly those blades.

Doctrine Quantity is included in that count.

### 3. Sentry ignored parts of Quantity/count operators

Sentry count previously used only personal count + a fraction of Multiplicity.

It ignored:

- Doctrine Quantity;
- transient Catalyst count bonuses;
- continuation `countAdd`.

**Fix:** these now feed the actual construct count before the existing per-cast cap. Renderer renders the actual `Snapshot.constructs`, not an estimate.

### 4. Chain Arc ignored Quantity/operator count

Chain Arc already used personal count + Multiplicity + continuation count, but ignored Doctrine Quantity and Catalyst count bonuses.

**Fix:** both now increase actual maximum chain segments.

### 5. Persistent fields lost ownership and mutation identity

`FieldSnapshot` previously kept only position/radius/kind. Rival Toxic Echo therefore became the same green field as the player's Toxic Mist.

It also discarded `behavior:'host'`, so Pestilent Host could not have a distinct presentation.

**Fix:** Snapshot now retains faction, source, mutation and behavior. Rival fields retain their family colour underneath but receive the universal red hostile boundary; host fields receive a separate living-core signature.

### 6. Constructs lost their branch identity

`ConstructSnapshot` discarded mutation / continuation / Apotheosis and faction. Walker, Hunter Battery, Gravity Grid and a normal turret therefore reached renderer as nearly the same object.

**Fix:** Snapshot preserves those fields. Renderer now varies scale/tint by major Sentry branch and marks rival constructs separately.

### 7. Projectile evolution state was flattened

Projectile Snapshot did not preserve mutation/Apotheosis/carousel state.

**Fix:** those fields now survive to presentation. Phoenix returners and carousel actors have distinct moving accents while still using their actual simulated body position.

## Elite combination audit

The elite state pipeline already kept the important dimensions separately:

- chassis;
- affix;
- rarity;
- status;
- authored chassis action;
- Elite Echo phase;
- shield state;
- adaptation state.

The renderer also composes these as independent layers rather than selecting one monolithic “elite skin”. That is the right architecture for combinations.

Two gaps were found:

- `volatile` had no persistent pre-death identity;
- `regenerating` had no dedicated visible state.

Both now have their own non-red persistent signatures. Red remains reserved for *immediate hostile danger*, including the already-telegraphed Volatile death burst.

Compatibility-only `swift` and `dense` also retain simple distinct rendering so an old replay/save cannot silently lose state, but they are not returned to the normal v0.11.3 affix roll.

The animation contract regression explicitly checks a combined `Broodmaker + Regenerating + Elite Echo tell` snapshot.

## Legacy audit

### Compatibility Phenomena

Seven old Phenomenon definitions still exist:

- `ember_lance`;
- `repulse_halo`;
- `breach_line`;
- `contact_saw`;
- `backhand`;
- `spreading_front`;
- `pin_burst`.

They are now explicitly exported as `legacySkillOrder`.

Policy:

- they may remain for old seeds/replays/code compatibility;
- they must not enter active Discovery;
- they must not be used as fixtures for current gameplay/presentation regressions;
- new design work must not add features to them unless compatibility requires it.

Two current tests still used `ember_lance`; both were moved to active `rail_spear` fixtures.

The legacy runtime branches are deliberately **not deleted in this pass**. Removing compatibility execution is a migration decision, not cleanup to do implicitly.

### Remaining semantic debt

`activationCountBonus` is a transient Catalyst/operator concept. It now correctly reaches projectiles, Sentry and Chain Arc, but some active Phenomena intentionally have no natural “count” interpretation.

Orbit has permanent count semantics, but a one-beat Catalyst count bonus does not yet have an authored temporary-orbit meaning. Frost, Cleaver, Toxic Mist, Mass Driver and Gravity Anchor likewise need behaviour-specific answers rather than generic duplicated casts.

This is now documented debt for Phenomena 2.0. Do **not** solve it by making the renderer fake extra effects.

## Documentation audit

Before this pass documentation had three conflicting “current” entry points:

- root README / 00_START_HERE were on v0.11.2 but had a duplicate source-of-truth item;
- MANIFEST still called document 30 the latest state and executable `v0.11-core-redesign`;
- `prototype/current/README.md` still announced **v0.10**, called documents 13/14 authoritative and used `ember_lance` as the example start.

They are updated in v0.11.3.

### Documentation authority from now on

1. Latest explicit owner instruction in chat.
2. Latest numbered implementation/audit handoff (currently this document, 33) for facts changed by that pass.
3. Documents 32, 31 and 30 for still-current UX/playtest goals not superseded later.
4. Executable code + passing regression tests for factual implementation behaviour.
5. Document 29 as the historical v0.11 baseline.
6. Older numbered docs, `docs/`, `reports/`, `legacy/` as history/rationale unless explicitly re-adopted.

A newer document does not automatically invalidate every older design goal; it only wins where it changes the same subject.

## New regression contract

`animation_contract_regression` protects:

- Orbit gameplay count == Snapshot count;
- Quantity really changes Orbit contact density;
- `orbit_many` adds real/visible blades;
- Sentry Quantity/operator bonuses create real constructs;
- Sentry branch/faction survives Snapshot;
- Chain Arc Quantity/operator bonuses produce real segments;
- hostile field ownership and Host behaviour survive Snapshot;
- projectile Apotheosis/carousel state survives Snapshot;
- a combined chassis+affix+Echo state survives Snapshot;
- renderer does not restore old count/radius formulas inside `skillCast`;
- renderer consumes canonical Orbit state;
- renderer distinguishes hostile fields and all supported affixes.

## Manual QA focus

For the next playtest, specifically check:

1. Raise Quantity / Multiplicity on Rail, Mortar, Shards, Arc, Orbit and Sentry. Does the screen show the same increase you feel mechanically?
2. Take `Много ножей` and `Пильная корона`. Does blade population/readability change immediately and plausibly?
3. Compare normal Sentry, Walker/Hunter Battery/Gravity Grid. Can you visually tell that the persistent object changed?
4. Trigger a rival Toxic Echo. Does its field unmistakably read as hostile despite keeping Toxic identity?
5. Observe an elite with chassis + affix. Can both be read without the affix obscuring the chassis action?
6. During an Echo, is the attack tell still the highest-priority layer over rarity/affix decoration?
7. Check Volatile and Regenerating before they activate. Can their rule be anticipated?
8. If a Catalyst that promises extra count is placed before a Phenomenon without natural count semantics, note whether the choice feels dead. That is a Phenomena 2.0 design question, not a renderer bug.

## Next

After this technical contract is manually validated, the next major design task remains **Phenomena 2.0**. The audit has made one important requirement explicit for that redesign: every new Phenomenon must define how global Quantity and transient count operators map to its behaviour, or explicitly declare that they do not.
