# START HERE — Black Archive / roguelike

**Current date/state:** 2026-09-20 — **v0.11.3 animation/presentation contract + legacy/documentation audit implemented; Phenomena 2.0 remains next.**

**Executable:** `prototype/current/`

## Read first

1. `33_ANIMATION_PRESENTATION_LEGACY_AUDIT_2026-09-20.md` — **current animation/data-contract, legacy and documentation audit.**
2. `32_UX_READABILITY_ELITE_RESEARCH_2026-09-20.md` — current UX/combat readability + elite-activity implementation.
3. `31_P0_WORLD_UI_TERRAIN_IMPLEMENTATION_2026-09-20.md` — completed world/UI/terrain P0 slice.
4. `30_CHAT_HANDOFF_2026-09-19_PLAYTEST_FEEDBACK.md` — owner playtest goals that opened the current work.
5. `29_V011_IMPLEMENTATION_HANDOFF_2026-09-19.md` — historical v0.11 implementation baseline.
6. Documents 27/28 for research rationale; older files for history unless explicitly re-adopted.

## Current source-of-truth order

1. Latest explicit owner instruction in chat.
2. Latest numbered implementation/audit handoff for the subject it changes — currently document 33.
3. Documents 32 → 31 → 30 for still-current UX/playtest goals not superseded later.
4. Executable code + passing regression tests for factual implementation behaviour.
5. Document 29 as the v0.11 baseline.
6. Older numbered docs, `docs/`, `reports/` and `legacy/` as historical rationale.

A newer document wins only where it changes the same subject; it does not silently erase unrelated accepted goals from older docs.

## Current implementation headlines

- Active Discovery roster: **11 Phenomena**. Seven older definitions are explicitly compatibility-only and excluded from live Discovery/current test fixtures.
- XP develops **Doctrines**; Phenomena, Catalysts, Items and Mutation Cores use separate acquisition channels.
- Mutation tree: **99 active definitions / 33 Apotheoses**.
- Frequent elites combine independent chassis + rarity + affix + status + authored action + Elite Echo state.
- Hostile telegraphs use one high-priority red danger language; routine squad-routing lines are not rendered.
- Presentation no longer re-computes gameplay geometry/count. Simulation-authored `CombatShape`, projectiles, fields, constructs and Orbit state are the visual authority.
- Quantity/Multiplicity now visibly and mechanically agree for the active count-capable families audited in v0.11.3.
- Persistent effect ownership/evolution survives Snapshot: hostile fields, Sentry branches and evolved projectiles no longer flatten into generic visuals.
- Archive/library floor identity remains the dominant background layer.

## Run

```powershell
cd prototype/current
.\run.ps1
```

or:

```powershell
npm run build
npm run serve
```

Technical validation:

```powershell
npm test
npm run test:builds
```

`npm test` is a technical regression suite. It does not replace manual visual/game-feel QA.
