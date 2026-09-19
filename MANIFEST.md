# Manifest — 2026-09-19 — v0.11 + latest playtest handoff

## Highest-priority current documents

- `00_START_HERE.md` / `README.md` — current entry point.
- `30_CHAT_HANDOFF_2026-09-19_PLAYTEST_FEEDBACK.md` — **latest manual playtest findings and next-chat priorities**.
- `29_V011_IMPLEMENTATION_HANDOFF_2026-09-19.md` — current executable state, invariants and validation.
- `28_SECOND_WEAPON_BUILDCRAFT_INVESTIGATION_2026-09-19.md` — deeper weapon/buildcraft/elite/readability investigation that directly motivated v0.11.
- `27_WEAPON_ELITE_PROGRESSION_RESEARCH_2026-09-19.md` — first research pass.
- `26_CHAT_HANDOFF_2026-09-19_COMPLETE.md` — completed pre-v0.11 handoff.

## Executable

`prototype/current/` is **v0.11-core-redesign**.

It includes:

- deterministic TypeScript gameplay core;
- WebGL2 renderer + `PresentationBridge`;
- bounded map/minimap/boss infrastructure;
- 11 active Phenomenon chassis + legacy definitions excluded from Discovery;
- separated Doctrines / Phenomenon / Catalyst / Item / Mutation progression channels;
- proximity build support through Size/Guard/Mobility/Force;
- authored Elite Echo duel patterns instead of player-cast copies;
- Guard/Commit/Broken shield elite;
- 99 active mutation definitions / 33 Apotheoses;
- physical Returner and Grave Roller actors, Gravity Anchor control;
- status/interaction/formation/shield readability signals;
- unique active Phenomenon choice art and complete glyph catalogues;
- category-framed choice UI and priority rare-event alerts;
- isolated build viability benchmark for melee/ranged/control;
- full technical regression suite.

## Commands

```powershell
cd prototype/current
.\run.ps1
npm test
npm run test:builds
```

## Historical documents

Documents 00–26, `docs/`, `reports/` and `legacy/` preserve project history. Where they conflict, latest owner instructions and document 30 win; document 29 remains the factual v0.11 implementation handoff. In particular, the old target of exactly 18 active Phenomena, mixed level-up window, two-level mutation ceiling and literal/near-literal rival cast assumptions are not current constraints.
