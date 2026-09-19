# Manifest — 2026-09-20 — v0.11.3 current

## Highest-priority current documents

- `00_START_HERE.md` / `README.md` — current entry point and authority order.
- `33_ANIMATION_PRESENTATION_LEGACY_AUDIT_2026-09-20.md` — **current animation/data-contract, legacy and documentation audit.**
- `32_UX_READABILITY_ELITE_RESEARCH_2026-09-20.md` — UX/readability, active elite patterns and progression probe results.
- `31_P0_WORLD_UI_TERRAIN_IMPLEMENTATION_2026-09-20.md` — completed P0 world/UI/terrain slice.
- `30_CHAT_HANDOFF_2026-09-19_PLAYTEST_FEEDBACK.md` — owner playtest requirements that remain applicable where not superseded.
- `29_V011_IMPLEMENTATION_HANDOFF_2026-09-19.md` — historical v0.11 baseline.

Documents 27/28 remain research rationale. Older numbered documents, `docs/`, `reports/` and `legacy/` are historical unless explicitly re-adopted.

## Executable

`prototype/current/` is **v0.11.3-presentation-contract**.

Current factual highlights:

- deterministic TypeScript gameplay core;
- WebGL2 renderer + `PresentationBridge`;
- bounded map, minimap and final Guardian infrastructure;
- 11 active Phenomena;
- 7 explicit compatibility-only Phenomena definitions excluded from Discovery and current test fixtures;
- separated Doctrine / Phenomenon / Catalyst / Item / Mutation progression;
- 99 active mutation definitions / 33 Apotheoses;
- frequent elites with independent chassis + rarity + affix + authored action + Elite Echo;
- Guard → Commit → Broken shield state;
- simulation-authored geometry/count as presentation authority;
- exact Snapshot ownership/evolution for projectiles, fields, constructs and Orbit;
- Quantity/Multiplicity contract regression;
- UX/readability, opening-safety and progression probes;
- GitHub Prototype CI running compile + full technical regressions.

## Commands

```powershell
cd prototype/current
.\run.ps1
npm test
npm run test:builds
```

## Documentation policy

When documents conflict, use this order:

1. latest explicit owner instruction;
2. latest numbered implementation/audit handoff for the same subject;
3. still-applicable requirements from documents 32/31/30;
4. executable code plus passing tests for factual implementation state;
5. document 29 as historical v0.11 baseline;
6. older material as history/rationale.

A newer document supersedes only overlapping claims, not unrelated accepted decisions.
