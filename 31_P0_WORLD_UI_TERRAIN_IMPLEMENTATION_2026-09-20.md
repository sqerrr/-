# 31 — P0 world/UI/terrain implementation — 2026-09-20

## Status

Factual implementation record for the iteration after `30_CHAT_HANDOFF_2026-09-19_PLAYTEST_FEEDBACK.md`.

**Executable:** `prototype/current/`  
**Version:** `0.11.1`

Phenomena 2.0 / roster redesign is deliberately deferred to the next iteration.

## Implemented

- Interactive world sources no longer use generic circles: Phenomenon, Catalyst, Resonance and Vital POIs have different silhouettes and matching minimap symbols.
- Ground relics use object/reliquary presentation; contested state uses angular warnings rather than another ring.
- Visible circular obstacle blobs were removed. Physics keeps cheap conservative collision hulls, while presentation uses deterministic irregular fractured rock/ruin silhouettes.
- Ground rendering now uses seeded multi-scale procedural FBM/ridged noise, large material regions, cracks, worn channels, mineral seams and sparse details.
- Acquisition was expanded to 3 Phenomenon sources, 2 Catalyst sources, 1 Resonance source and 2 Vital sources.
- Approaching a source tells the player directly what it offers.
- Tab is now a character/build sheet: HP, barrier, armor, speed, dash, pickup radius, fortune, XP, doctrines, derived resonance values, chain/reserve, mutations and held items/stacks.
- Choice category is communicated by icon/shape/header; generic category colors no longer impersonate rarity.
- Player-facing terminology received a broad Russian-language cleanup.
- Elite Echo preparation/active state receives a final renderer danger pass above normal sprites/VFX.

## Validation

A new `p0_world_ui_regression` is appended to `npm test`. The complete local technical suite passed after this slice; the deterministic 60-second hash is `9aa2584b`.

Manual browser visual QA is still required for aesthetics/game feel.

## Next

Phenomena 2.0: question every current chassis, merge/remove/rebuild weak ones, and require genuinely different play contracts rather than geometry variants.
