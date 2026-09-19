# 32 — UX / combat readability / elite activity research — 2026-09-20

## Status

Research + implementation record after owner playtest of v0.11.1.

**Executable:** `prototype/current/`  
**Target version:** `0.11.2`

Phenomena 2.0 remains the next dedicated design iteration. This slice addresses the information hierarchy around the existing game first.

## Owner feedback that triggered this slice

- The older archive/library floor had stronger world identity than the generic procedural stone treatment.
- Ground items need recognisable icons.
- Squad/order lines create visual noise.
- Elite telegraphs need to be unmistakable; hostile danger should use a consistent red language.
- Elites should act more often and show more authored mechanics/patterns.
- Difficulty/power growth through the run needs another audit.
- HUD/interface should answer what is happening, why it matters, and what the player can do next without requiring logs/docs.
- Remaining legacy/jargon should be removed.

## External research

### Hades / Supergiant

Supergiant explicitly treated combat readability as a systemic task rather than cosmetic polish:

- cleaned and directional on-hit VFX;
- reduced obstruction from damage shroud;
- made traps easier to spot;
- aggregated repeated damage into a single number to reduce clutter;
- showed only relevant Boons in the live sidebar;
- later reduced overly strong Zeus VFX and added more iconography.

Sources:
- https://www.supergiantgames.com/blog/hades-the-nighty-night-update-patch-notes/
- https://www.supergiantgames.com/blog/hades-long-winter-update-patch-notes/

### Riot / VALORANT

Riot's shader/readability write-up makes the useful distinction that characters and gameplay-relevant features retain readability even when environment detail is reduced. Environment is allowed to recede; important silhouettes and gameplay edges are protected.

Source:
- https://www.riotgames.com/en/news/valorant-shaders-and-gameplay-clarity

### ARPG readability

A useful framing is **telegraphing before** + **expectation after**. Repeated visual language lets players chunk patterns instead of re-decoding every attack. A danger colour should mean the same kind of consequence every time.

Source:
- https://www.gamedeveloper.com/game-platforms/designing-for-difficulty-readability-in-arpgs

## Audit: current attention hierarchy

Before this slice several channels competed for the same visual priority:

1. lethal elite attacks;
2. player Phenomena;
3. routine squad routing lines;
4. elite order rings;
5. item/reward markers;
6. statuses;
7. world decoration.

The core failure was not simply “too many effects”. Routine AI information looked almost as important as lethal information.

Target hierarchy:

1. **lethal hostile telegraph / boss tell**;
2. **player + nearest important elite**;
3. **active hostile attack**;
4. **reward / interactable**;
5. **player attack geometry**;
6. **statuses and secondary combat feedback**;
7. **routine AI / decoration / terrain**.

## Implemented readability changes

### Archive floor identity restored

The previous v0.11.1 procedural shader repainted most of `archive_floor.jpg` into generic slate/ash/moss. That solved repetition but damaged the world identity.

Now:

- the Archive texture is the dominant surface again;
- procedural FBM/ridged noise only varies age, wear, cracks, seams and sparse markings;
- procedural treatment is deliberately subtle instead of becoming a new art direction.

### Hostile telegraph language

- authored hostile tells are consistently red;
- Elite Echo tell/active colours no longer reuse the player's Phenomenon family colour;
- hostile fill opacity and outline thickness are stronger than player VFX;
- shield commit and temporal shift use the same hostile-red language;
- authored chassis actions live in the final danger presentation layer;
- routine squad-routing lines were removed completely.

### Alert-channel reduction

Frequent chassis actions no longer open a full-width alert banner. They are communicated by:

- red local geometry = **where**;
- nearest-elite threat panel = **what**;
- world animation/body language = **who**.

Large banners remain for structural/rare events, boss events and first-order encounter communication.

### Ground item identity

All relics now receive persistent screen-space pictogram badges using their unique item glyph, with category colour as a secondary channel. Contested relics add a red corner/warning treatment.

The held-item strip also uses the same pictograms rather than three-letter abbreviations. Full names/effects remain in the Tab build sheet and near-item tooltip.

### HUD / run-state information

The live objective now reports:

- run phase: РАЗГОН / НАРАСТАНИЕ / ДАВЛЕНИЕ / ФИНАЛ;
- cleared world nodes;
- nearest unresolved build source + distance;
- countdown to finale.

The nearest-elite panel has two modes:

- calm: chassis rule + affix rule;
- danger: large red imminent-action state and a direct dodge instruction.

The Tab sheet now exposes derived growth, not only raw counters:

- base damage multiplier;
- elite damage multiplier;
- crit from items;
- size multiplier;
- duration multiplier;
- compatible extra actors/projectiles;
- tempo and conductivity.

## Elite activity redesign

### Previously

The existing chassis system had several good passive ideas, but only Hunter strongly behaved like an active pattern enemy. Architect acted periodically but teleported with weak forecasting. Broodmaker/Bulwark/Harvester/Shepherd could spend too much of the fight expressing rules passively.

Also, ordinary `spawnElite()` hard-coded `affix: 'none'`, which meant a large amount of implemented elite variation never appeared in the normal elite director.

### Now

Every main chassis has a recurring authored action independent of refused-card Echoes:

- **Hunter** — predictive intercept lane -> committed dash -> exposed recovery;
- **Architect** — forecast relocation point -> relocate -> deploy denial veil;
- **Broodmaker** — forecast brood pulse -> damage if ignored -> create a replicant;
- **Bulwark / Prism** — committed frontal bash while retaining source-alternation rule;
- **Harvester / Null Weaver** — committed harvesting sweep; landing it heals the elite;
- **Shepherd / Metamorph** — command pulse + local mob rally while retaining damage-signature adaptation.

Cooldowns scale modestly with run depth and elite rarity. Higher tiers therefore become more mechanically active, not only more durable.

### Affixes restored as a run-depth layer

Early common elites frequently have no affix so the player can learn the chassis. Later/uplifted/legendary elites increasingly combine a chassis with one affix.

Enabled late-run behavioural pool includes:

- regenerating;
- volatile (now telegraphed after death instead of instant);
- shielded;
- vanguard;
- temporal;
- brood;
- crowned.

The scalar-only/unused `swift` and `dense` are deliberately not used by the new normal-affix roll.

Chassis action state is now separate from generic enemy/temporal-affix state so the two systems cannot hijack one another.

## Run scaling audit

The current 8-minute prototype maps its clock to a 24-minute design curve.

At 25 / 50 / 75 / 100% of the run:

| Run time | World HP | Enemy damage | Spawn pressure |
|---|---:|---:|---:|
| 2:00 | ×1.52 | ×1.13 | ×1.41 |
| 4:00 | ×2.42 | ×1.31 | ×1.99 |
| 6:00 | ×3.71 | ×1.53 | ×2.74 |
| 8:00 | ×5.37 | ×1.81 | ×3.64 |

Player level contributes +7.5% base power per level. The rest of player growth comes from:

- Might/global power;
- Doctrines;
- items;
- Phenomenon count/coverage;
- Catalysts;
- Mutations/Apotheosis.

This means the world curve is intentionally nonlinear while the player's curve is composition-driven. That can produce good power spikes, but **the formulas alone do not prove current balance**. The build sheet now exposes derived multipliers so manual playtest can tell whether a perceived spike/stall corresponds to actual growth.

## Regression coverage added

`ux_readability_regression` checks:

- world HP/damage/spawn pressure remain monotonic through the run;
- end-run scale remains near the intended calibrated values;
- all six normal chassis can enter an authored active action;
- late uplifted elite affixes are no longer always `none`;
- squad-routing lines do not return to renderer;
- archive texture remains dominant in the ground shader;
- shield telegraph remains in hostile-red language;
- ground relic pictograms remain present;
- threat panel retains danger state;
- build sheet retains derived power information;
- all six chassis tell source IDs remain implemented.

## Manual QA questions for the next playtest

1. During dense combat, is **red** now reliably read as “enemy danger I must react to”?
2. Can you tell where the elite will hit before damage occurs?
3. Can you identify a dropped item before walking onto it?
4. Are item glyphs sufficient, or do they now clearly justify a dedicated painted icon set?
5. Does removing squad-order lines make the fight materially calmer?
6. Does the nearest-elite panel help, or is it still too text-heavy during combat?
7. Does each chassis now do something memorable within the first ~5 seconds of contact?
8. Do uplifted/legendary elites feel like behavioural escalation rather than HP inflation?
9. At 2/4/6/8 minutes, does player power visibly keep pace with world pressure?
10. Does restored Archive flooring recover the “single library universe” identity?
11. Does the live HUD answer “where should I go next?” without opening Tab?
12. Does Tab answer “why am I stronger now?” without reading design documentation?

## Next

After manual validation of this information hierarchy, the next major design pass remains **Phenomena 2.0**. The roster should then be judged inside a cleaner combat language rather than redesigned while basic attention channels are still fighting one another.
