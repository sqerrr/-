# Black Archive web prototype — v0.11.3

`prototype/current/` is the current executable browser build.

For project-wide context read root `00_START_HERE.md` first. The current technical audit is `33_ANIMATION_PRESENTATION_LEGACY_AUDIT_2026-09-20.md`.

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

Useful URL examples:

- `?mode=clean&start=rail_spear&seed=12345`
- `?mode=clean&start=orbit_blades&seed=12345`
- `?mode=showcase&seed=12345`
- `?smoke=1` — technical launch check only.

## Controls

- WASD / arrows — movement;
- mouse — facing for directional Phenomena;
- Shift or right mouse — dash;
- Tab — full Character/Build sheet; combat pauses, and Chain reordering lives inside this screen;
- wheel — zoom;
- Space / P — pause;
- R — restart same seed/mode/start;
- F8 — technical debug panel.

## Current progression

- XP → Doctrines;
- world Phenomenon structures → new Phenomena;
- Catalyst structures/caches → Catalysts;
- serious Elites → Mutation Cores;
- world/elite contested drops → Items;
- Mutations → three-tier branches ending in Apotheosis.

The active Chain contains up to four Phenomena with Catalysts between them. Reserve is deliberately small.

## Active Phenomena

Discovery currently uses exactly these 11:

- Ледяной фронт (`frost_ring`);
- Рельсовое копьё (`rail_spear`);
- Секач (`cleaver`);
- Цепная дуга (`chain_arc`);
- Орбитальные лезвия (`orbit_blades`);
- Бомбардир (`mortar_bloom`);
- Турель (`sentry`);
- Токсичный туман (`toxic_mist`);
- Гравитационный каток (`mass_driver`);
- Возвратные осколки (`shard_fan`);
- Гравиякорь (`tether_drag`).

Seven older definitions remain compatibility-only for old seeds/replays. They must not be used as examples of current gameplay or current regression fixtures.

## Presentation contract

Simulation is authoritative for gameplay geometry and multiplicity.

- `CombatShape` carries exact instantaneous ray/sector/circle geometry.
- Snapshot projectiles/fields/constructs carry exact persistent/moving bodies and ownership.
- Snapshot Orbit carries the real active blade count/radius.
- `SkillActivated` is only an origin/body animation cue; renderer must not independently calculate attack count/range/radius.

This is protected by `animation_contract_regression`.

## Elites

Normal elite identity is compositional:

`chassis + rarity + affix + authored chassis action + optional Elite Echo + statuses`

The current primary chassis are Hunter, Architect, Broodmaker, Prism/Bulwark, Null Weaver/Harvester and Metamorph/Shepherd. Their own recurring actions are separate from refused-card Elite Echoes.

Immediate hostile danger uses the red telegraph language. Affix/chassis decoration deliberately uses other colours/shapes until the state becomes lethal.

## Tests

```powershell
npm test
npm run test:builds
```

`npm test` validates compilation, determinism, Chain/progression/content contracts, presentation, projectiles, elites, mutations, world/UI and animation state transfer. It is not a substitute for manual visual/game-feel QA.

GitHub `Prototype CI` additionally runs full-run progression and every-start opening probes on pull requests.
