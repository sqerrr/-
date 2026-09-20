# Black Archive web prototype — v0.11.4

`prototype/current/` is the current executable browser build.

Read root `00_START_HERE.md` first. Current owner correction: `36_OWNER_CORRECTION_CROWD_BUILD_ELITE_2026-09-20.md`.

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

## Build/combat rules currently under test

- XP → Doctrines; structural content comes from its own world/elite channels.
- Up to four active Phenomena with Catalysts between them.
- Quantity is allowed to be real throughput: extra rays/impacts/actors are not globally damage-normalised.
- Position distributes that throughput: parallel lanes, nearby impacts, returning actors and repeated short-lived constructs should read differently.
- Reservoir/Vault use immediate crowd results instead of hidden charge banks.
- Sentry deploys again each Chain beat and old batteries expire quickly.
- Active Cleaver/Arc branches no longer rely on wound stacks / hidden global charge.
- Jackpot combinations are allowed; technical tests protect viability and broken contracts, not equal TTK.

## Elites and shared items

Elites compose:

`chassis + rarity + affix + authored action + learned refusals + captured/inherited items + optional Echo`

- nearby elites can deliberately contest a ground relic;
- refused cards are knowledge, not an exclusive one-owner inventory;
- later elites can inherit a sample of items captured earlier by the enemy side;
- all 20 items have an explicit enemy-side effect;
- durability growth from items is allowed;
- immediate lethal tells remain the top visual layer.

The final Warden is the enemy-side payoff: legendary, three phases, inherited refusal repertoire, and all distinct item effects captured by elites during the run.

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

Seven older definitions remain compatibility-only.

## Presentation contract

Simulation remains authoritative for count and geometry. Renderer does not invent a second combat model.

## Tests

```powershell
npm test
npm run test:builds
```

The suite includes isolated build viability, crowd/elite/Warden build matrix, progression and all-start probes. Manual play remains mandatory for readability and game feel.
