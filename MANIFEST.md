# Manifest — 2026-09-20 — v0.11.4 current

## Current authority

- `00_START_HERE.md` / `README.md` — entry point.
- `36_OWNER_CORRECTION_CROWD_BUILD_ELITE_2026-09-20.md` — **current owner-directed crowd/build/elite/Warden correction.**
- `33_ANIMATION_PRESENTATION_LEGACY_AUDIT_2026-09-20.md` — presentation contract + legacy audit.
- `32_UX_READABILITY_ELITE_RESEARCH_2026-09-20.md` — UX/readability and elite activity.
- `31_P0_WORLD_UI_TERRAIN_IMPLEMENTATION_2026-09-20.md`.
- `30_CHAT_HANDOFF_2026-09-19_PLAYTEST_FEEDBACK.md`.

Documents 34/35 are retained as research and defect evidence. Their balancing/design guardrails are superseded by document 36 where they conflict.

## Executable

`prototype/current/` is **v0.11.4-crowd-elite**.

Key facts:

- deterministic TypeScript core + WebGL2 presentation;
- 11 active Phenomena / 7 compatibility-only definitions;
- 99 active mutation records / 33 Apotheoses;
- separate Doctrine / Phenomenon / Catalyst / Item / Mutation acquisition;
- Quantity may scale real output; no global per-projectile normalization;
- Sentry repeats as short-lived Chain deployments and inherits run power;
- active Cleaver/Arc branches avoid wound-stack/hidden-charge bookkeeping;
- elites contest relics and keep/inherit enemy-side item history;
- after 120 s elites also gain autonomous modules from the full 20-item pool, independent of player refusals;
- refusals can be learned concurrently by multiple elites and repertoire grows with run depth;
- 20 explicit elite-side item effects;
- Warden inherits enemy ecosystem history and uses three escalating phases;
- animation/presentation remains simulation-authoritative;
- isolated viability lab + crowd ecosystem build matrix + natural progression/opening probes.

## Commands

```powershell
cd prototype/current
.\run.ps1
npm test
npm run test:builds
```
