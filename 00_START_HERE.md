# START HERE — roguelike / Black Archive handoff

**Date:** 2026-09-18  
**Design state:** **CORE DECISIONS TAKEN; IMPLEMENTATION NOT YET AUTHORIZED**  
**Executable reference:** `prototype/current/` remains the unchanged v0.10 experimental build.

## Active concept state (2026-09-18)

Start with `21_SLICE_DECISIONS_2026-09-18.md`. It records the owner's decisions and **overrides proposals in documents 15, 16 and 20 wherever they disagree.**

Headline decisions: architecture is rebuilt before content; the catalogue target is 18 phenomena and 20 catalysts with no per-run subset; refused cards go to elites in general rather than to a single named rival, with the carried set scaled by elite rarity; items are a shared power source for both sides, 20+ per run across five categories; every player upgrade must be designed together with a matching enemy upgrade; every catalogue entry must do something useful against crowds, not only against elites; mutations form a three-branch tree per phenomenon; once the build is full a level offers an item, an operator or carrier-wide growth; the player gets a dash with a short invulnerability window; the arena gains obstacle islands with destructible cover; runs stay at roughly eight minutes and are evaluated by manual play plus per-fight telemetry.

Then read `17_DECISIONS_AND_PROGRESS_2026-09-18.md` for the open-decision registry and the code audit, and `20_CONTENT_GAME_DESIGN_STUDY_2026-09-18.md` for the proposed catalogue. Non-attacking phenomena and luck are deferred. The v0.10 model below is an executable baseline, not a constraint on the new concept.

**Audit warning:** several v0.10 subsystems are dead code and are not described in document 18 — enemies never fire projectiles, elite affixes never roll, elite adaptations never trigger, and POI guardians never spawn. Do not attribute their absence to design.

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

1. `21_SLICE_DECISIONS_2026-09-18.md`: **owner decisions. Highest authority among the design documents.**
2. `17_DECISIONS_AND_PROGRESS_2026-09-18.md`: accepted, deferred and open decisions; work status; code audit findings.
3. `22_CATALOG_D29_AUDIT_2026-09-18.md`: audit of the catalogue against the owner's rules and rework of the twelve entries that failed. A proposal; only the parts accepted as D39-D48 are binding.
4. `20_CONTENT_GAME_DESIGN_STUDY_2026-09-18.md`: proposed catalogue of 18 phenomena and 20 catalysts, combination grammar, risks and engine cost. A proposal, not a decision. Sections 7.1, 7.2 and build Ж are obsolete under D33.
5. `16_NEXT_SLICE_DRAFT_2026-09-18.md`: draft requirements, boundaries and future acceptance probes.
6. `15_RIVAL_DRAFT_CONCEPT_DISCUSSION_2026-09-18.md`: detailed discussion and explicit status of proposals.
7. `18_V010_SYSTEM_SNAPSHOT_2026-09-18.md`: the owner's factual snapshot, copied without content changes. Known to omit the dead subsystems listed above.
8. `13_V010_CORE_REBUILD_SPEC.md` and `14_V010_IMPLEMENTATION_NOTES_2026-09-17.md`: historical v0.10 experiment and implementation details.
9. `prototype/current/PLAYTEST_CHECKLIST.md`: old prototype checklist, not acceptance of the new concept.
10. Documents 01-12, `docs/`, `reports/` and `legacy/` as historical evidence where needed.

## Current source-of-truth order

1. Latest explicit owner instructions in chat; accepted decisions are recorded in document 21, with history in documents 15-17.
2. Owner-provided factual snapshot: `18_V010_SYSTEM_SNAPSHOT_2026-09-18.md`.
3. Project specifications, with proposals and approvals kept distinct.
4. Implementation as evidence of existing behavior, not authority over the requested future design.

No new gameplay implementation has been approved. Preparing this package and publishing it does not grant that approval.

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

This is **not a balanced release**. No new gameplay, build, test or playtest was performed during the concept discussion and relocation. For the next slice, joint damage/progression/threat tuning is part of acceptance: elites dying before their mechanics can be seen would prevent a fair concept evaluation. Historical validation files and checksums describe the original package, not the updated documentation or a new release.

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
