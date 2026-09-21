# START HERE — Black Archive / roguelike

**Current date/state:** 2026-09-22 — **v0.12.1 elite visual-language/readability pass on top of Catalyst 2.0.**

**Executable:** `prototype/current/`

## Read first

1. `38_ELITE_VISUAL_LANGUAGE_2026-09-22.md` — **current owner-directed elite visual language, combat HUD and readability contract.**
2. `37_CATALYST_2_0_CHOREOGRAPHY_2026-09-22.md` — **current Catalyst law, physical compatibility, visual contract and Sentry choreography.**
3. `36_OWNER_CORRECTION_CROWD_BUILD_ELITE_2026-09-20.md` — crowd-first combat, Quantity, elite ecosystem and Warden rules.
4. `33_ANIMATION_PRESENTATION_LEGACY_AUDIT_2026-09-20.md` — simulation → presentation contract and legacy boundary.
5. `32_UX_READABILITY_ELITE_RESEARCH_2026-09-20.md` — UX/readability and elite activity.
6. `31_P0_WORLD_UI_TERRAIN_IMPLEMENTATION_2026-09-20.md`.
7. `30_CHAT_HANDOFF_2026-09-19_PLAYTEST_FEEDBACK.md`.

Documents 34/35 and older Catalyst reports are research/defect evidence, not current Catalyst design authority where they conflict with document 37.

## Current source-of-truth order

1. Latest explicit owner instruction in chat.
2. Document 38 for elite visual language / combat HUD readability.
3. Document 37 for Catalysts / Chain choreography.
4. Document 36 for crowd combat, Quantity, elites and Warden.
5. Document 33 for presentation/legacy contracts.
6. Documents 32 → 31 → 30 for still-current UX/playtest goals.
7. Executable code + passing regression/simulation tests for factual implementation behaviour.
8. Older documents/reports as history and research evidence only.

## Current implementation headlines

- Elite chassis now use persistent shape/silhouette motifs; affixes use separate compact badges; rarity uses edge ticks/HP framing; red is reserved for immediate danger.
- Minimap/off-screen markers mirror chassis shapes; combat HUD no longer prints full affix-prefixed names over every elite.
- Center threat focus is sticky and switches to short action-specific imperatives during dangerous tells.
- Active Discovery roster remains **11 Phenomena**.
- Active Catalyst Discovery is reduced to **5 physical choreography operators**: Source / Carrier / Trail / Reverse / Collapse.
- Old proc/stat Catalysts remain compatibility-only for old saves/replays.
- Every live Phenomenon emits physical choreography data: terminal, path, carriers and/or area.
- Catalyst compatibility is intentionally partial; UI shows incompatible edges explicitly.
- Simulation physically relocates/repeats/redirects B; renderer only presents that authored world result.
- Dedicated choreography visuals make Source/Carrier/Trail/Reverse/Collapse distinguishable in combat.
- Sentry now builds spatial batteries; Trail sampling keeps batteries close enough for real Gravity Grid/Living Circuit networks.
- Catalyst-created origins respect arena bounds and solid cover.
- Quantity remains a genuine power axis; Catalyst 2.0 does not reintroduce blanket damage normalization.
- Elite ecosystem / Warden rules from v0.11.4 remain intact.

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

`npm test` includes an all-11 Phenomenon signal audit plus exhaustive physical smoke for every advertised Catalyst 2.0 pair.
