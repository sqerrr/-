# START HERE — Black Archive / roguelike

**Current date/state:** 2026-09-20 — **v0.11.4 crowd-first buildcraft + elite ecosystem correction in current executable.**

**Executable:** `prototype/current/`

## Read first

1. `36_OWNER_CORRECTION_CROWD_BUILD_ELITE_2026-09-20.md` — **current owner-directed combat/build/elite/boss rules and implementation record.**
2. `33_ANIMATION_PRESENTATION_LEGACY_AUDIT_2026-09-20.md` — simulation → presentation contract and legacy boundary.
3. `32_UX_READABILITY_ELITE_RESEARCH_2026-09-20.md` — UX/readability and elite activity work.
4. `31_P0_WORLD_UI_TERRAIN_IMPLEMENTATION_2026-09-20.md` — world/UI/terrain P0.
5. `30_CHAT_HANDOFF_2026-09-19_PLAYTEST_FEEDBACK.md` — owner playtest problems still applicable where not superseded.

Documents 34/35 and their reports are research/defect evidence, **not design authority** where they conflict with document 36. Older material is historical unless explicitly re-adopted.

## Current source-of-truth order

1. Latest explicit owner instruction in chat.
2. Document 36 for crowd combat, Quantity, active wound/charge policy, elite progression and Warden direction.
3. Document 33 for presentation/legacy contracts.
4. Documents 32 → 31 → 30 for still-current UX/playtest goals.
5. Executable code + passing regression/simulation tests for factual implementation behaviour.
6. Older documents/reports as history and research evidence only.

## Current implementation headlines

- Active Discovery roster remains **11 Phenomena**; seven old definitions are compatibility-only.
- Quantity is a genuine power axis: no blanket “extra projectile must be weaker” rule.
- Hidden multi-cycle Reservoir/Vault charge banks are replaced by immediate crowd interactions.
- Active Cleaver wound stacking and Arc hidden-charge loop are replaced by immediate crowd mechanics.
- Sentry is a **short-lived repeated Chain deployment**, not a permanent emplacement, and now inherits run power.
- Elites deliberately contest ground relics, learn refusals non-exclusively, and inherit samples of enemy-side item history later in the run.
- All 20 current items have explicit enemy-side consequences.
- The final Warden is legendary, inherits the run’s distinct captured elite items/refusals, and has a three-phase escalation.
- Renderer remains downstream of simulation-authored geometry/count/effect state.

## Run

```powershell
cd prototype/current
.\run.ps1
```

Technical validation:

```powershell
npm test
npm run test:builds
```

`npm test` includes crowd/build/elite ecosystem regressions. Synthetic labs are guardrails, not a substitute for manual game-feel QA.
