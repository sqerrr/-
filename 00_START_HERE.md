# START HERE — Black Archive / roguelike

**Current date/state:** 2026-09-19 — **v0.11 implemented; latest manual playtest reopened UX, acquisition and Phenomena design.**

**Executable:** `prototype/current/`

## Read first

1. `30_CHAT_HANDOFF_2026-09-19_PLAYTEST_FEEDBACK.md` — **latest owner playtest, current problems and next priorities.**
2. `29_V011_IMPLEMENTATION_HANDOFF_2026-09-19.md` — factual implementation state of v0.11.
3. `28_SECOND_WEAPON_BUILDCRAFT_INVESTIGATION_2026-09-19.md` — deeper weapon/buildcraft/elite/readability investigation.
4. `27_WEAPON_ELITE_PROGRESSION_RESEARCH_2026-09-19.md` — first research pass.
5. `26_CHAT_HANDOFF_2026-09-19_COMPLETE.md` — completed pre-v0.11 handoff.
6. Older files for historical rationale only.

## Current source-of-truth order

1. Latest explicit owner instructions in chat.
2. `30_CHAT_HANDOFF_2026-09-19_PLAYTEST_FEEDBACK.md` for current design/UX priorities after manual playtest.
3. `29_V011_IMPLEMENTATION_HANDOFF_2026-09-19.md` for the current executable implementation state.
4. Research documents 27/28 as rationale/proposals.
5. Older accepted decisions/specs only where later documents have not superseded them.
6. Code as evidence of current behaviour.

## Headline v0.11 changes

- Active Discovery roster reduced to **11 behaviourally distinct Phenomena**; old geometric duplicates are legacy-only.
- XP level-up now develops **Doctrines**; Phenomena/Catalysts/Items/Mutation Cores use separate progression channels.
- Proximity builds gain a real ecosystem through Size / Guard / Mobility / Force.
- Shield elite is Guard -> Commit -> Broken with Stability and punish windows.
- Declined Phenomena become authored **Elite Echoes** with tell -> active -> recovery. Elites never run the hero cast dispatcher.
- Mutation tree is 3 roots x 3 continuations x 3 Apotheoses per active Phenomenon: **99 definitions / 33 Tier III transformations**.
- UI uses unique Phenomenon art, entity glyphs, branch/tier mutation badges, category-specific frames, short promises and optional details.
- Combat renderer exposes important statuses/interactions and uses different moving signatures per Phenomenon family.
- Rare events have priority so ordinary Echo warnings cannot erase them immediately.
- Isolated elite lab currently measures 5.9–7.6 s median TTK across ranged/melee/control on the same normal elite and 7.1–8.4 s on Shielded.

## Run

```powershell
cd prototype/current
.\run.ps1
```

or:

```powershell
npm run build
npm run serve
```

Technical validation:

```powershell
npm test
npm run test:builds
```

`npm test` is a technical regression suite, not a substitute for manual visual/game-feel QA.
