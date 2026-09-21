# Black Archive web prototype — v0.12 Catalyst 2.0

`prototype/current/` is the current executable browser build.

Read root `00_START_HERE.md` first. Catalyst authority: `37_CATALYST_2_0_CHOREOGRAPHY_2026-09-22.md`.

## Run

```powershell
.\run.ps1
```

or:

```powershell
npm run build
npm run serve
```

Examples:

- `?mode=clean&start=rail_spear&seed=12345`
- `?mode=clean&start=orbit_blades&seed=12345`
- `?mode=showcase&seed=12345`
- `?smoke=1`

## Controls

- WASD / arrows — movement;
- mouse — facing;
- Shift or right mouse — dash;
- Tab — Character/Build sheet + Chain planning;
- wheel — zoom;
- Space / P — pause;
- R — restart;
- F8 — technical debug.

## Catalyst 2.0

Current Discovery contains five physical operators:

- **Источник** — B originates where A physically finishes;
- **Носитель** — B is emitted from live A actors;
- **След** — B is staged along A's path;
- **Обратный ход** — B begins at A's far endpoint and plays back;
- **Схлопывание** — B uses A's area/perimeter and converges toward its center.

Compatibility is partial by design. The Chain and planner show when the current A → B pair is incompatible.

The gameplay criterion is visual: without reading text, the player should see B physically using A's geometry. A generic proc or multiplier is not sufficient.

Old Catalyst 1.x definitions remain executable only for old save/replay compatibility and are not offered by Discovery.

## Sentry

Sentry is spatial infrastructure:

- each beat builds a short forward battery instead of spawning a turret beside the hero;
- recent waves can coexist;
- turrets are physical Catalyst carriers;
- Trail places enough batteries on long routes to keep network nodes connectable;
- Gravity Grid creates real control links between nearby turrets.

## Active Phenomena

Discovery uses 11 active Phenomena:

- Ледяной фронт;
- Рельсовое копьё;
- Секач;
- Цепная дуга;
- Орбитальные лезвия;
- Бомбардир;
- Турель;
- Токсичный туман;
- Могильный вал;
- Возвратные осколки;
- Гравиякорь.

Every one emits physical Catalyst signals in simulation; a regression rejects advertised capabilities that are not actually produced.

## Existing combat rules retained

- XP → Doctrines; structural content uses separate world/elite channels.
- Quantity is allowed to create real throughput.
- Jackpot combinations are allowed; tests catch broken contracts rather than equalizing all build TTK.
- Elite ecosystem / Warden behaviour follows document 36.

## Presentation contract

Simulation owns physical origins, paths, objects and areas. Renderer visualizes that truth and adds distinct choreography cues; it does not invent a second Catalyst model.

## Tests

```powershell
npm test
npm run test:builds
```

The Catalyst regression checks every live Phenomenon signal and physically exercises every currently advertised compatible pair. Manual play remains mandatory for the GIF-test and game feel.
