# START HERE — Black Archive / roguelike

**Current date/state:** 2026-09-22 — **v0.13 physical lifecycle / hitbox architecture for Catalyst 2.x**, retaining the v0.12.1 elite visual-language pass.

**Executable:** `prototype/current/`

## Read first

1. `39_PHYSICAL_LIFECYCLE_HITBOX_AUDIT_2026-09-22.md` — **current runtime authority for hitboxes, physical lifecycle, Catalyst timing and collision truth.**
2. `37_CATALYST_2_0_CHOREOGRAPHY_2026-09-22.md` — **current Catalyst design law and physical-interaction goals.**
3. `38_ELITE_VISUAL_LANGUAGE_2026-09-22.md` — elite visual language, combat HUD and readability contract.
4. `36_OWNER_CORRECTION_CROWD_BUILD_ELITE_2026-09-20.md` — crowd-first combat, Quantity, elite ecosystem and Warden rules.
5. `33_ANIMATION_PRESENTATION_LEGACY_AUDIT_2026-09-20.md` — simulation → presentation contract and legacy boundary.
6. `32_UX_READABILITY_ELITE_RESEARCH_2026-09-20.md`.
7. `31_P0_WORLD_UI_TERRAIN_IMPLEMENTATION_2026-09-20.md`.
8. `30_CHAT_HANDOFF_2026-09-19_PLAYTEST_FEEDBACK.md`.

Documents 34/35 and older Catalyst reports are research/defect evidence only where documents 39/37 supersede them.

## Current source-of-truth order

1. Latest explicit owner instruction in chat.
2. Document 39 for physical lifecycle, hitboxes, collision timing and Catalyst runtime truth.
3. Document 37 for Catalyst / Chain choreography design.
4. Document 38 for elite visual language / combat HUD readability.
5. Document 36 for crowd combat, Quantity, elites and Warden.
6. Document 33 for presentation/legacy contracts.
7. Documents 32 → 31 → 30 for still-current UX/playtest goals.
8. Executable code + passing regression/simulation tests for factual implementation behaviour.
9. Older documents/reports as history and research evidence only.

## Current implementation headlines

- Catalyst 2.x is **event-driven**: Chain activation arms an edge; real `path/contact/impact/area/terminal` events decide when and where B fires.
- Every relevant activation has lineage through projectiles, delayed impacts, constructs, fields, Orbit contacts and Catalyst-created cascades.
- New shared `src/core/geometry.ts` owns circle/ray/sector overlap, swept collision and path sampling.
- Telegraph/render geometry is separate from physical truth; a planned point is never automatically a terminal.
- Mortar truth is `terminal + carrier + area`; it does **not** advertise a fake path without a simulated shell actor.
- Orbit gameplay uses the same discrete blade positions as presentation; the old invisible annulus hit test is gone.
- Collapse consumes exact physical areas instead of a bounding circle over disconnected zones.
- Multi-projectile routes are kept per physical carrier; separate Shards cannot invent a segment between one another.
- The old next-beat `executeChoreography()` engine has been removed.
- Current exhaustive lifecycle matrix exercises **280 compatible ordered A→Catalyst→B pairs** without manually activating B.
- Active Discovery remains **11 Phenomena** and **5 Catalysts**: Source / Carrier / Trail / Reverse / Collapse.
- Old Catalyst 1.x proc/stat definitions remain compatibility-only for old saves/replays.
- v0.12.1 elite shape/readability language remains intact.

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

`npm test` includes dedicated physical-lifecycle timing/hitbox regressions plus exhaustive execution of every currently advertised Catalyst 2.x pair.
