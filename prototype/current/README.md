# Black Archive web prototype v0.10 — CORE REBUILD SANDBOX

This is the first runnable branch of the progression / Chain / Elite redesign. It is a **qualitative systems sandbox**, not a balance release.

Read root `13_V010_CORE_REBUILD_SPEC.md` for the authoritative design and `14_V010_IMPLEMENTATION_NOTES_2026-09-17.md` for implementation status.

## Run

Windows:

```powershell
.\run.ps1
```

Or:

```powershell
npm run build
npm run serve
```

URL examples:

- `?mode=clean&start=ember_lance&seed=12345`
- `?mode=showcase&seed=12345`
- `?smoke=1` — technical launch check only.

## Controls

- WASD / arrows — movement;
- mouse — facing for directional Phenomena;
- Tab — Planning (combat pauses completely);
- wheel — zoom;
- Space / P — pause;
- R — restart same seed/mode/start;
- F8 — technical debug panel.

## What changed in v0.10

### No personal Phenomenon levels

Core Rank is the shared baseline progression of the run. A late Phenomenon starts at the current baseline instead of entering several personal levels behind.

Normal XP offers **Core Axis** growth rather than repeated upgrades to one active weapon. Current experimental axes:

- Tempo;
- Multiplicity;
- Precision;
- Persistence;
- Conductivity;
- Mobility.

### No Catalyst levels / potency

Catalysts are ready-made operators. Current slice includes routing, mass-to-count conversion, storage/memory, fusion, feedback, topology and defence conversion in addition to a simple trigger/relay baseline.

### Fixed full-cycle Chain cadence

Each active Phenomenon naturally fires once per full Chain cycle. Adding another Phenomenon inserts more actions into the same cycle and does **not** reduce the natural cadence of older Phenomena.

### Archive does not age

Inactive Phenomena/Catalysts are not missing personal XP. Planning can replace/reorder modules without a hidden level penalty.

### Mutation Cores

Mutation capacity is earned by the run. Mutations are intended as qualitative evolution + power. In this sandbox, swapping a mutated Phenomenon between active Chain and Archive returns its Mutation Core.

### Elite anomalies

Free Elites no longer use the old generic chassis+affix+late-adaptation loop. The current six prototypes are:

- **Хищник** — predictive intercept movement;
- **Завеса** — fog/veil that interferes with distant auto-targeting;
- **Репликатор** — hit-event-driven copies whose deaths damage the parent;
- **Призма** — source imprint rewards changing Phenomenon source;
- **Нуль-ткач** — captures Catalyst-derived events into charges that direct Phenomenon hits discharge;
- **Метаморф** — changes form at an HP threshold based on recent damage signature.

These are prototypes of different *rule spaces*. They are not the final Elite roster.

### Map / population

- POIs no longer spawn guardian Elites just to deliver a reward;
- free Elites return to a frequent heartbeat;
- normal population is materially denser than v0.9B;
- contact damage was reduced to avoid making density alone the entire difficulty increase.

## Current topology

The shell is still typed:

`Phenomenon → Catalyst → Phenomenon → Catalyst → Phenomenon ...`

with up to four active Phenomena and three active Catalyst edges. Universal physical cells remain a separate future experiment; do not mix that question into this core test yet.

## Tests

```powershell
npm test
```

This validates compile/determinism/choice/Planning/content/presentation plus v0.10 cadence/progression invariants. It does **not** certify balance or fun.

A recent long headless pressure run reached roughly 118 simultaneous enemies and died around 5:19 with automated movement. Treat that only as proof that the new density/director is materially active.
