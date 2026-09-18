# START HERE — roguelike / Black Archive handoff

**Date:** 2026-09-18  
**Design state:** **CORE DECISIONS TAKEN; IMPLEMENTATION NOT YET AUTHORIZED**  
**Executable reference:** `prototype/current/` remains the unchanged v0.10 experimental build.

## Current entry point

Read `21_SLICE_DECISIONS_2026-09-18.md` first. It records the owner's decisions and overrides proposals in documents 15, 16 and 20 wherever they disagree. Then read `00_START_HERE.md` and `17_DECISIONS_AND_PROGRESS_2026-09-18.md`.

Headline decisions: architecture is rebuilt before content; the catalogue target is 18 phenomena and 20 catalysts with no per-run subset; refused cards go to elites in general rather than to a single named rival, with the carried set scaled by elite rarity; items are a shared power source for both sides, 20+ per run across five categories; every player upgrade must be designed together with a matching enemy upgrade; every catalogue entry must do something useful against crowds, not only against elites; mutations form a three-branch tree per phenomenon, delivered in two passes; once the build is full a level offers an item, an operator or carrier-wide growth; the player gets a dash with a short invulnerability window; the arena gains obstacle islands with destructible cover; runs stay at roughly eight minutes and are evaluated by manual play plus per-fight telemetry. Non-attacking phenomena, luck and player actions against elites are deferred. New gameplay implementation has not been approved.

**Audit warning:** several v0.10 subsystems are dead code and are not described in document 18 — enemies never fire projectiles, elite affixes never roll, elite adaptations never trigger, and POI guardians never spawn.

## Historical v0.10 rationale

Manual playtests of v0.9A/v0.9B showed that the problem was deeper than tuning enemy HP or restoring a few rewards:

- personal Phenomenon progression made one-weapon tunnelling and late-drop obsolescence natural;
- Catalyst levels/potency turned potentially interesting links back into scalar upgrades;
- Reserve content aged into irrelevance;
- adding Phenomena could reduce the cadence of already-owned Phenomena;
- free Elites were too close to ordinary mobs with mostly invisible modifiers;
- map exploration risked becoming another route to the same Elite/reward loop;
- the game lacked the desired “casino” feeling where a new find can suddenly justify a viable rebuild.

v0.10 is a focused attempt to test a different foundation rather than another rebalance of v0.9B.

## Read in this order

1. `21_SLICE_DECISIONS_2026-09-18.md`: owner decisions. Highest authority among the design documents.
2. `17_DECISIONS_AND_PROGRESS_2026-09-18.md`: decisions, open questions, code audit and next work.
3. `20_CONTENT_GAME_DESIGN_STUDY_2026-09-18.md`: proposed catalogue of 18 phenomena and 20 catalysts. A proposal, not a decision.
4. `16_NEXT_SLICE_DRAFT_2026-09-18.md`: draft requirements and acceptance criteria.
5. `15_RIVAL_DRAFT_CONCEPT_DISCUSSION_2026-09-18.md`: detailed reasoning and owner statements.
6. `18_V010_SYSTEM_SNAPSHOT_2026-09-18.md`: unchanged copy of the owner's factual snapshot; omits the dead subsystems listed above.
7. `13_V010_CORE_REBUILD_SPEC.md` and `14_V010_IMPLEMENTATION_NOTES_2026-09-17.md`: historical executable baseline.
8. Remaining handoff, rendering, research and playtest documents as history, not automatic instructions.

## Current source-of-truth order

1. Latest explicit owner instructions in chat.
2. Owner-provided snapshot: `18_V010_SYSTEM_SNAPSHOT_2026-09-18.md` (facts, not future requirements).
3. Project specifications, separating approved decisions from candidates.
4. Implementation as evidence of existing behavior.

## Core v0.10 model

- Phenomena have no meaningful personal levels.
- Catalysts have no levels/potency; they are complete Chain operators.
- Core Rank supplies run-wide baseline power.
- Six experimental Core Axes specialize the build globally.
- Full Chain cycle duration is fixed; adding Phenomena adds throughput instead of slowing old Phenomena.
- Archive modules do not age while inactive.
- Mutation is a limited run-level capacity allocated to Phenomena and reclaimable on Archive swap in this sandbox.
- POIs provide structural/build rewards without spawning an extra guardian Elite.
- Free Elites are six experimental anomalies designed from different rule spaces rather than old chassis+affix arithmetic.

## What is preserved from v0.9B

- bounded map foundation and minimap;
- WebGL2 renderer and `PresentationBridge` separation;
- canonical hit geometry and readable combat feedback;
- boss infrastructure;
- Planning mode and typed Chain topology as a temporary shell;
- reduced normal projectile-soup direction.

## What is intentionally reopened

- all progression/balance numbers;
- exact Core Axes;
- Phenomenon roster and identities;
- Catalyst library / trigger grammar / duplicate economy;
- Mutation catalogue;
- free-Elite design and adaptation;
- normal density/roles/formations;
- POI actions and exploration incentives;
- Elite reward economy.

## Important warning

This is **not a balanced release**. No new gameplay, build, test or playtest was performed during this concept discussion and relocation. Joint damage/progression/threat tuning belongs to acceptance of the next slice, not an unspecified later balance pass. Historical checksum and validation files are preserved as original-package records.

## Run

```powershell
cd prototype/current
.\run.ps1
```

Or:

```powershell
npm run build
npm run serve
```

Technical regression:

```powershell
npm test
```
