# Manifest — 2026-09-22 — v0.12.1 current

## Current authority

- `00_START_HERE.md` / `README.md` — entry point.
- `38_ELITE_VISUAL_LANGUAGE_2026-09-22.md` — **current elite visual-language / combat-HUD readability authority.**
- `37_CATALYST_2_0_CHOREOGRAPHY_2026-09-22.md` — **current Catalyst / Chain choreography authority.**
- `36_OWNER_CORRECTION_CROWD_BUILD_ELITE_2026-09-20.md` — crowd/build/elite/Warden rules.
- `33_ANIMATION_PRESENTATION_LEGACY_AUDIT_2026-09-20.md` — presentation contract + legacy audit.
- `32_UX_READABILITY_ELITE_RESEARCH_2026-09-20.md`.
- `31_P0_WORLD_UI_TERRAIN_IMPLEMENTATION_2026-09-20.md`.
- `30_CHAT_HANDOFF_2026-09-19_PLAYTEST_FEEDBACK.md`.

Older Catalyst analyses remain research evidence only where document 37 supersedes their proc/stat assumptions.

## Executable

`prototype/current/` is **v0.12.1 elite-readability on top of v0.12 Catalyst choreography**.

Key facts:

- deterministic TypeScript core + WebGL2 presentation;
- chassis-specific world/minimap/off-screen shapes, separate affix badges and rarity frames;
- red reserved for immediate hostile danger; sticky action-focused threat panel; compact combat repertoire icons;
- 11 active Phenomena / 7 compatibility-only Phenomena;
- 5 active Catalyst 2.0 operators: Source, Carrier, Trail, Reverse, Collapse;
- old Catalyst 1.x definitions are compatibility-only, not Discovery content;
- partial physical A→B compatibility, exposed in Chain UI and planner;
- all live Phenomena emit simulation-authored terminal/path/carrier/area signals;
- dedicated `CatalystChoreography` event + renderer grammar for every live operator;
- Sentry deploys spatial forward batteries and Trail can create connectable infrastructure;
- Gravity Grid links are real control geometry between physical turrets;
- choreography origins obey world bounds and solid cover;
- exhaustive compatible-pair physical regression + all-11 signal audit;
- v0.11.4 crowd-first Quantity / elite ecosystem / Warden rules retained.

## Commands

```powershell
cd prototype/current
.\run.ps1
npm test
npm run test:builds
```
