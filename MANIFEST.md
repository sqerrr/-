# Manifest — 2026-09-22 — v0.13 current

## Current authority

- `00_START_HERE.md` / `README.md` — entry point.
- `39_PHYSICAL_LIFECYCLE_HITBOX_AUDIT_2026-09-22.md` — **runtime physical-lifecycle / hitbox / Catalyst-timing authority.**
- `37_CATALYST_2_0_CHOREOGRAPHY_2026-09-22.md` — **Catalyst / Chain choreography design authority.**
- `38_ELITE_VISUAL_LANGUAGE_2026-09-22.md` — elite visual-language / combat-HUD readability authority.
- `36_OWNER_CORRECTION_CROWD_BUILD_ELITE_2026-09-20.md` — crowd/build/elite/Warden rules.
- `33_ANIMATION_PRESENTATION_LEGACY_AUDIT_2026-09-20.md` — presentation contract + legacy audit.
- `32_UX_READABILITY_ELITE_RESEARCH_2026-09-20.md`.
- `31_P0_WORLD_UI_TERRAIN_IMPLEMENTATION_2026-09-20.md`.
- `30_CHAT_HANDOFF_2026-09-19_PLAYTEST_FEEDBACK.md`.

Older Catalyst analyses remain research evidence only where documents 39/37 supersede their runtime or proc/stat assumptions.

## Executable

`prototype/current/` is **v0.13 physical lifecycle / hitbox architecture**, retaining v0.12.1 elite readability.

Key facts:

- deterministic TypeScript core + WebGL2 presentation;
- activation lineage for projectiles, impacts, constructs, fields, Orbit contacts and Catalyst cascades;
- shared authoritative combat geometry in `src/core/geometry.ts`;
- Catalyst reactions consume real `path/contact/impact/area/terminal` events, not the next Chain beat;
- render telegraphs and physical traces are separate contracts;
- exact area shapes are preserved for Collapse; disconnected areas are never merged into imaginary bounding geometry;
- Orbit uses discrete blade hitboxes matching presentation;
- Mortar emits terminal + impact carriers + impact areas, not a fabricated path;
- Reverse requires a real path + terminal; Mortar Reverse is intentionally incompatible until a real shell route exists;
- actor-owned Catalyst lineage replaces arbitrary timeout lifetime; right-hand payloads have no independent Chain-clock cast;
- regression covers **240 mutation × physical-signal cases** in addition to all compatible ordered pairs;
- 11 active Phenomena / 7 compatibility-only Phenomena;
- 5 active Catalyst 2.x operators: Source, Carrier, Trail, Reverse, Collapse;
- old Catalyst 1.x definitions are compatibility-only, not Discovery content;
- exhaustive runtime matrix currently validates **266** compatible ordered pairs;
- dedicated physical lifecycle regression locks contact/impact timing and negative “must not fire yet” cases;
- chassis-specific elite visual language and red-only immediate-danger semantics from v0.12.1 remain intact;
- crowd-first Quantity / elite ecosystem / Warden rules remain intact.

## Commands

```powershell
cd prototype/current
.\run.ps1
npm test
npm run test:builds
```
