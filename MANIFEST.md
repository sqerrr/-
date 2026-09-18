# Manifest — 2026-09-17 — v0.10 CORE REBUILD PLAYABLE SANDBOX

## Highest-priority current documents

- `00_START_HERE.md` / `README.md` — current status and source-of-truth order.
- `13_V010_CORE_REBUILD_SPEC.md` — **authoritative current design** and invariants.
- `14_V010_IMPLEMENTATION_NOTES_2026-09-17.md` — actual implemented scope, validation and known legacy debt.
- `prototype/current/PLAYTEST_CHECKLIST.md` — qualitative test plan for the new core.

## Historical / supporting design

- `11_CORE_PILLARS_INVESTIGATION_2026-09-17.md` — investigation that motivated the redesign; historical/provisional where v0.10 differs.
- `12_V09C_DESIGN_TARGET.md` — superseded v0.9C target.
- `01_PROJECT_HANDOFF.md` — full project history.
- `02_DECISIONS_AND_OPEN_QUESTIONS.md` — historical decisions/open questions; newest owner decisions and v0.10 documents override conflicts.
- `04_PLAYTEST_FINDINGS_2026-09-17.md` — accumulated findings.
- `05_CORE_REDIRECT_RESEARCH.md` — earlier Power & Assembly research.
- `08_RENDERING_MERGE_2026-09-17.md` — presentation/rendering boundary.
- `09_WORLD_THREAT_READABILITY_RESEARCH.md` — useful preserved world/readability research.
- `10_CHAIN_TOPOLOGY_EXPERIMENT.md` — universal-cell research; not active topology.

## Executable

`prototype/current/` is now **v0.10-core-rebuild**.

It includes:

- deterministic TypeScript gameplay Core;
- WebGL2 renderer + `PresentationBridge`;
- bounded map/minimap/boss infrastructure from v0.9B;
- run-wide Core Rank / Core Axes;
- fixed full-cycle Chain cadence;
- level-less Catalyst operators;
- non-aging Archive + reclaimable Mutation Core experiment;
- six free-Elite anomaly prototypes;
- higher normal density and frequent free-Elite heartbeat;
- v0.10 technical regression tests.

## Commands

```powershell
cd prototype/current
.\run.ps1
npm test
```

`npm test` is technical regression only. The build is intentionally **not balance-calibrated**.
