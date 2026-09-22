# Black Archive web prototype — v0.13 Physical Lifecycle + Elite Readability

`prototype/current/` is the current executable browser build.

Read root `00_START_HERE.md` first. Runtime hitbox/Catalyst authority: `39_PHYSICAL_LIFECYCLE_HITBOX_AUDIT_2026-09-22.md`. Catalyst design authority: `37_CATALYST_2_0_CHOREOGRAPHY_2026-09-22.md`. Elite visual-language authority: `38_ELITE_VISUAL_LANGUAGE_2026-09-22.md`.

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

## Physical lifecycle / hitboxes

Catalyst 2.x no longer executes from “whatever the previous chain tick remembered.”

The runtime contract is:

`Chain activation → activationId → live physical actor/hitbox → path/contact/impact/area/terminal → Catalyst reaction → B`

Consequences:

- **Source** waits for a real terminal.
- **Carrier** fires on an actual projectile/blade/turret/impact contact, not actor creation.
- **Trail** grows behind an actually travelled route and cannot place B ahead of a moving A.
- **Reverse** requires a real traversed path plus terminal; if A has no path (currently Mortar), the edge is incompatible rather than fabricated.
- **Collapse** uses exact circle/sector hitboxes instead of one bounding circle over disconnected areas.

`src/core/geometry.ts` is the shared source of truth for circle/ray/sector overlap, swept moving-circle collision and polyline sampling.

Mortar has no simulated shell path in the current core, so it truthfully emits **terminal + impact carrier + impact area**, not `path`. The discussed Mortar → Carrier → Frost interaction therefore fires Frost on the actual impact tick.

Orbit gameplay now uses the same discrete blade positions that presentation shows. Standing on the orbit radius between blades is not a hit.

The legacy next-beat `executeChoreography()` path was removed.

Compatible B nodes are event-owned across cycle boundaries. Persistent producers keep Catalyst lineage for the lifetime of their real physical actors, not a fixed timeout.

The physical lifecycle suite also exhausts **240 mutation × advertised-signal cases** so a mutation cannot silently break a base Phenomenon's Catalyst contract.

## Catalyst 2.x

Current Discovery contains five physical operators:

- **Источник** — B originates when/where A physically finishes;
- **Носитель** — B is emitted on real contact/fire/impact of A;
- **След** — B is staged progressively along A's travelled path;
- **Обратный ход** — B begins at A's actual terminal and faces back;
- **Схлопывание** — B consumes A's exact physical area and converges inward.

Compatibility is intentionally partial. The exhaustive lifecycle regression currently exercises **266 compatible ordered pairs**, and it never manually invokes the right-hand Phenomenon to manufacture success.

Old Catalyst 1.x definitions remain executable only for old save/replay compatibility and are not offered by Discovery.

## Sentry

Sentry remains spatial infrastructure:

- each beat builds a short forward battery instead of spawning a turret beside the hero;
- recent waves can coexist;
- a turret becomes a Carrier only when it actually fires/hits;
- Trail can build connectable infrastructure;
- Gravity Grid creates real control links between nearby turrets.

## Elite visual language

The v0.12.1 shape-first readability contract remains:

- chassis = persistent physical motif + matching minimap/off-screen shape;
- affix = compact badge;
- rarity/evolution = scale + frame treatment;
- current danger = body pose + authored geometry + final red warning layer;
- red = immediate hostile danger.

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

Each advertised Catalyst signal must be consumable by a real live lifecycle; a regression rejects aspirational catalogue capabilities.

## Tests

```powershell
npm test
npm run test:builds
```

`physical_lifecycle_regression` locks exact timing and negative cases. `catalyst_choreography_regression` physically executes the complete advertised pair matrix. Manual play remains mandatory for the GIF-test and game feel.
