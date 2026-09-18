# v0.10 CORE REBUILD — implementation notes

**Date:** 2026-09-17  
**Branch folder:** `prototype/current/`  
**Purpose:** record what is actually implemented versus what remains a design direction.

## Implemented

### Progression

- Reward kinds no longer use normal Phenomenon-upgrade or Catalyst-upgrade lanes.
- Ordinary XP raises Core Rank and offers global Core Axis choices.
- Core Rank contributes a generic baseline power scalar shared by all Phenomena.
- Current axes: Tempo, Multiplicity, Precision, Persistence, Conductivity, Mobility.
- Discovery milestones can add new Phenomena without making them numerically level-1 relative to the current run.
- Mutation Cores are granted at progression milestones and returned when a mutated Phenomenon is moved between active Chain and Archive.

### Chain

- Full-cycle duration is fixed; beat spacing is `cycle duration / active span`.
- Existing Phenomena therefore retain their natural once-per-cycle cadence when additional Phenomena are added.
- Technical regression compares one-Phenomenon and four-Phenomenon activation counts.

### Catalysts

`CatalystRuntime` is currently only `{ id }`: no level, no potency.

Implemented operator-like behavior includes:

- Anchor / Router: right-hand targeting uses the left event centroid;
- Capacitor / Converter: left mass → right instance count;
- Reservoir: accumulates mass across cycles → later burst;
- Relay: kill gate → extra reduced right activation;
- Conduit: state/property fusion into right-hand targets;
- Echo Shard: spatial secondary imprint;
- Backflow: right success feeds the previous Phenomenon on its next pass;
- Overflow: guarded `A → B → A` topology bounce;
- Aegis Relay: control/mass event → barrier.

### Archive / Planning

- Active ↔ Archive Phenomenon swap has no old COLD tax.
- Catalysts can likewise move between active edges and Catalyst Archive.
- Archive modules do not receive/passively require personal XP.

### Elite anomalies

The free-Elite pool is currently six experimental anomalies, implemented on top of legacy internal chassis IDs:

- `hunter` → Хищник: predictive intercept dash;
- `architect` → Завеса: veil fields can break distant auto-target lock;
- `broodmaker` → Репликатор: hit-event-driven copies; killing copies damages parent;
- `bulwark` → Призма: source imprint rewards switching source;
- `harvester` → Нуль-ткач: captures Catalyst-derived events into visible charges, direct hits discharge them;
- `shepherd` → Метаморф: chooses a form at HP threshold using recent damage signature.

Free-Elite generic affix generation is disabled in this slice.

### Map / density

- Entering a POI no longer spawns a guardian Elite; POI resolves into its structural reward.
- Normal population and spawn credit are raised substantially to test mass combat.
- Normal contact damage is reduced relative to the old density model.
- Free-Elite cadence is much more frequent than v0.9B.

### UI / presentation

- Planner no longer presents personal Phenomenon levels or Catalyst potency.
- HUD uses Core Rank terminology.
- Planner shows Phenomenon identity/weakness and Core Axes.
- Elite names/presentation map to the six anomaly prototypes.
- Veil has its own field presentation; Prism / Null Weaver / Metamorph / Replicator receive distinct cues using the existing renderer boundary.

## Deliberately not solved yet

- Final damage / HP / XP pacing.
- Final selection of Core Axes.
- Final eight-Phenomenon roster or final numeric identities.
- Full Catalyst library, trigger-part composition, Catalyst rarity and duplicate economy.
- Final mutation catalogue and mutation acquisition cadence.
- Rich POI build-control actions such as reforge/transmutation/preview.
- Final Elite roster, affix/suffix grammar, reward rarity, or boss adaptation.
- Normal-enemy formation design and stronger role readability.
- Universal physical Chain cells; typed 4-Phenomenon + 3-edge topology remains for this experiment.

## Legacy compatibility still present

Some v0.9B members/helpers remain compiled or parked because deleting them was not necessary to prove the new model. Examples include old adaptation helpers, guardian helpers, old skill runtime fields, legacy mutations and some old charge fields. Treat them as cleanup debt, not active design.

## Validation

Run from `prototype/current/`:

```powershell
npm test
```

`npm test` checks TypeScript build plus deterministic/choice/Chain/Planning/content/presentation and v0.10 core-rebuild regressions. It is **not** balance acceptance.

A longer headless run should be used only as a crash/pressure check. Recent seed `12345` with automated movement died around 319 s with about 118 maximum simultaneous enemies and 18 Elites spawned. This confirms that the new density/director is materially different, not that those numbers are correct.
