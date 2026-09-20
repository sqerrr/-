# 36 — OWNER CORRECTION: crowd-first buildcraft, elite ecosystem and Warden — 2026-09-20

## Status

**Current owner-directed design correction and v0.11.4 implementation record.**  
Executable: `prototype/current/`.

This document supersedes the **design conclusions and guardrails** in documents 34/35 where they conflict.  
Documents 34/35 remain useful as defect/research evidence: a bug found there is still a bug unless corrected here, but an analyst preference is not an owner decision.

## 1. Genre test: this is a horde survivors-like, not a duel RPG

The baseline combat question is not “can one target survive X seconds?” It is:

- how the build processes a moving crowd;
- how positioning and chain order change that processing;
- how frequent elites remain readable and dangerous inside the crowd;
- whether random finds create visible power spikes;
- whether the player can still steer toward a build direction;
- whether late elites and the final Warden keep up with player scaling.

Killing many normal enemies in a few seconds is expected. A test must not fail merely because crowd clear is very high.

Isolated-elite labs remain useful for detecting a dead build, broken shield interaction or zero single-target pressure. They are **not** allowed to normalize all viable builds to similar TTK.

## 2. Quantity is real power

Owner correction:

- More projectiles/actors may approximately multiply damage.
- There is no global rule that “doubling Quantity must not double DPS”.
- Balance comes from offer opportunity cost, weapon geometry, targeting, overkill, spread and enemy layout.
- Multi-projectile attacks normally separate spatially instead of occupying exactly one line.
- Naturally single-target attacks may express Quantity as a rapid sequence.
- A specific mutation may still trade per-projectile power for some other advantage, but that must be part of that mutation’s identity, not a hidden global tax.

v0.11.4 implementation:

- Rail no longer receives the generic 0.8 damage tax merely for having >1 ray; normal extra rays spread into neighbouring lanes.
- Mortar extra impacts no longer receive the generic 0.86 multi-impact tax.
- Splinter adds two full-strength manifestations.
- Orbit contact cadence scales approximately with blade count instead of square-root normalization.
- Existing explicitly authored mutation tradeoffs may remain.

The regression suite now checks viability / pathological stalls instead of a 2x archetype-TTK spread cap.

## 3. Avoid hidden RPG bookkeeping where crowd actions can be immediate

The owner specifically rejected making the combat identity revolve around invisible charge banks, wounds/stacks and similar long single-target accounting.

Applied corrections:

- Reservoir → **Напор массы**: a sufficiently successful *single crowd beat* immediately grants extra manifestations to the next Phenomenon. No cross-cycle hidden bank.
- Vault → **Панцирь толпы**: a broad right-hand activation immediately grants barrier based on distinct enemies hit/killed. No stored damage meter.
- Cleaver no longer automatically puts a wound DoT on every target.
- The Guillotine continuation is now **Рассекающий клин**: more direct force/power and visible displacement.
- Its Apotheosis is **Разрыв строя**: immediate local ruptures from several struck bodies, capped for performance; no elite wound stacks.
- Arc Capacitive is now **Обратная дуга**: unused jumps immediately return as rapid sequential pulses instead of entering a global hidden charge bank.
- Mass Terminal is an immediate high-speed/high-impact rail specialization, not a charge consumer.
- Toxic Reactive reacts to already-visible control/burning states rather than requiring Cleaver bleeding.
- Orbit’s former blood branch now scales from nearby crowd density rather than wounded-target bookkeeping.

Old wound/charge fields may still exist for compatibility-only definitions/replays. They are not a design requirement for active Phenomena.

## 4. Sentry is a repeated Chain deployment

Sentry is not a permanent base-building weapon.

Current rule:

- every Sentry beat deploys a fresh short-lived group at the hero’s current position;
- ordinary base lifetime is roughly 3.45 seconds before Duration modifiers;
- several recent waves may coexist, creating a moving trail/front as the player travels;
- Sentry now inherits the same run/global power path as other active Phenomena;
- Quantity can create more real constructs, up to explicit performance/readability caps.

This must be visible in animation: the player should understand “my chain keeps leaving batteries here”, not “I placed a permanent turret five screens ago”.

## 5. Elite progression is an ecosystem, not only a refusal inventory

Refused cards remain important because they give elites recognisable echoes of choices the player rejected, but they are no longer the only progression channel.

### Refusals are knowledge

A refusal is not an exclusive physical item locked to one living elite.

- several elites may know/use the same refusal;
- `heldBy` is only first-carrier/history bookkeeping;
- repertoire capacity grows with run depth in addition to rarity;
- ordinary/upgraded/legendary tiers begin wider than the old fixed 1/3/6 hard ceiling;
- the goal is increasing behavioural vocabulary, not inventory scarcity.

### Ground items are contested enemy progression

An elite that sees a nearby relic can deliberately route toward it instead of collecting it only by accidental overlap.

Captured items:

- are stored on that elite;
- are added to `eliteLegacyItems`, the run’s physical enemy-side item history;
- can be inherited in a sample by later elites;
- are independent from the refusal pool.

All 20 current items now have explicit elite-side effects rather than collapsing into five generic category buffs. Examples include durability, mitigation, movement, faster chassis actions, stronger Echoes, crit, siphon, longer item-seeking range and additional learned refusal knowledge.

Durability bonuses are explicitly allowed. The previous rule forbidding item-driven elite HP because an old TTK target had already been calibrated is rejected.

### Autonomous elite evolution is independent of player choices

Elites are **not limited to cards the player refused or objects they happened to pick up**.

After the opening teaching window, ordinary elite spawns also roll several autonomous evolution modules from the complete 20-item enemy-effect catalogue:

- before 120 s: none — early fights teach chassis/affix first;
- after 120 s: the number grows with run depth;
- uplifted and legendary elites receive additional growth budget;
- the current per-elite autonomous budget is capped for readability/performance, not because the player removed something from a pool.

These modules are stored separately as `evolutionItems` and contribute to the run-wide `eliteEvolutionHistory`.

Therefore current elite identity has three independent progression sources:

1. **learned refusals / Elite Echoes** — recognisable consequences of player choices;
2. **contested ground items** — positional competition during the run;
3. **autonomous evolution** — full-pool enemy growth that does not depend on what the player left behind.

The three channels may overlap mechanically, but must remain separately attributable in telemetry/UI so later balancing can change one without silently changing the others.

## 6. Elite power curve

Desired qualitative curve:

- **early:** an elite is dangerous from its chassis/affix alone; it should not require a large inventory to matter;
- **mid:** elites begin combining chassis + affix + refusals + inherited/captured items;
- **late:** ordinary elites should not become irrelevant just because player Core/Doctrine scaling accelerates;
- **legendary:** can accumulate a broad rule set and remain a major event, but readability still has priority over raw simultaneous VFX.

This is not permission to make every late elite a giant HP sponge. Power can come through movement, cadence, attack grammar, protection, item competition, Echo combinations and local squad pressure.

## 7. Warden / final boss

The final Warden is the apex of the enemy ecosystem.

v0.11.4 direction:

- starts at legendary tier;
- base durability is deliberately above a comparable late legendary elite;
- inherits a late-size refusal repertoire;
- preserves the complete physical relic history elites captured during the run, including repeated finds;
- applies each distinct captured mechanical rule once so duplicate streaks do not become exponential multipliers;
- inherits the distinct autonomous evolution rules accumulated by the enemy ecosystem;
- its baseline durability grows modestly with the combined mass of captured-item and autonomous-evolution history;
- uses three phases (100–66%, 66–33%, <33%);
- later phases accelerate its own patterns;
- final phase adds local support pressure;
- between authored Warden patterns it may use collected Elite Echoes through the rival/Echo system, never by calling the hero skill dispatcher.

The boss should feel like “the run’s enemy side came together here”, not like another fixed-stat elite.

## 8. Valid findings retained from audit 34

The following were real implementation defects and are not rejected merely because some conclusions in 34 were too restrictive:

- Precision Doctrine had no real combat effect — **fixed**.
- Sentry failed to inherit full global/run power — **fixed**.
- Siphon healed from attempted/overkill damage — **fixed**.
- relic timer could bank overdue spawns while the field was full — **fixed**.
- Mortar Spotter root advertised marked-elite attraction but did nothing — **fixed**.
- Gravity Anchor Bind root had almost no mechanical distinction — **fixed**.
- delayed-effect Catalyst attribution remains worth auditing; do not hide this behind balance changes.
- Returner lifetime / full outbound-return contract remains worth targeted testing if live play shows truncated returns.
- a Catalyst event that visually fires but produces no useful effect remains a valid UX defect.

## 9. Validation philosophy from now on

Do validate:

- every active build can actually clear crowds;
- each archetype has at least some elite/boss pressure;
- Quantity visibly and mechanically creates more real work;
- late elites inherit more enemy history than early elites;
- different item histories produce different elite behaviour;
- the Warden is stronger than a same-time ordinary/legendary elite and reflects collected history;
- no build mechanic silently does nothing;
- no renderer-only fake effect substitutes for gameplay.

Do **not** reject a build because:

- it kills 30–80 trash mobs quickly;
- one successful build kills an isolated elite 2–3x faster than another viable build;
- Quantity creates nearly linear damage in a favourable geometry;
- a jackpot combination produces a visible power spike.

The balance problem is “does this choice trivialise the whole run too reliably and too cheaply?”, not “did damage rise too much in a synthetic duel?”

## 10. Current simulations — green CI snapshot

The full GitHub Prototype CI is green on the current branch after the changes above. Validation now combines several views instead of forcing one TTK target.

### Isolated elite viability lab

The old cross-archetype equality guard was removed. Current median TTK against the same isolated 4000 HP mid-run Hunter is approximately:

| Build | normal | shielded |
| --- | ---: | ---: |
| melee | 7.4 s | 7.8 s |
| ranged / Quantity | 2.9 s | 4.1 s |
| control | 7.1 s | 7.8 s |

The ranged jackpot being much faster is **not itself a failure**. This lab now catches dead/stalling archetypes rather than enforcing equal power.

### Crowd + elite matrix

Four intentionally different late builds were tested against **84 trash + one 14.5k uplifted elite**.

| Build | clear time | elite |
| --- | ---: | --- |
| Quantity battery | 6.42 s | killed |
| area / route | 4.43 s | killed |
| melee harvest | 16.62 s | killed |
| rolling network | 7.05 s | killed |

The difference is intentionally preserved for playtesting. In particular melee harvest is currently much slower at clearing this synthetic formation; this is a balance/design signal, not a reason to normalize every build immediately.

### Late Warden matrix

With a representative late enemy history, the Warden started at about **158k HP** in the matrix. In 24 seconds:

| Build | Warden HP removed | reached |
| --- | ---: | --- |
| Quantity battery | 51.5% | phase 2 |
| area / route | 28.3% | phase 1 |
| melee harvest | 13.8% | phase 1 |
| rolling network | 51.7% | phase 2 |

None killed it in the 24 s window.

A separate 240 HP / 30 Armor danger probe with automatic dash-on-readable-danger produced:

- Quantity battery: 36.3 raw pressure, survived;
- area / route: 252.9 pressure, died at 19.35 s;
- melee harvest: 74 raw pressure across 27 hit events, but current defensive layers absorbed all HP loss;
- rolling network: 213.2 pressure, survived with 27 HP.

This shows that Warden danger currently varies strongly with build/defence. Do not infer “no threat” from zero final HP loss when Barrier/Guard absorbed real hit events.

### Seeded random-build fuzz

`random_build_fuzz` generates 14 deterministic but random structurally valid builds:

- four different active Phenomena;
- three random Catalysts;
- full root → continuation → Apotheosis mutation paths;
- different Doctrine distributions.

It runs them through a dense crowd + uplifted elite scenario. It does **not** fail merely because a combination is mediocre; it fails for invalid/non-functional combat output and reports weak combinations separately.

Current run: **weak list = empty**. No sampled build had dead/zero combat behaviour.

### Natural run progression

Three deterministic route-aware 8-minute probes now show meaningful enemy-side growth rather than a static late game:

- seed 12345 died at ~200.5 s after 9/10 elites; by death the enemy had captured 3 ground items and accumulated 8 autonomous evolution events;
- seed 24680 finished alive at ~453.4 s with 27/27 elites killed, 8 captured items and 56 autonomous evolution events;
- seed 97531 finished alive at ~477.2 s with 27/27 elites killed, 10 captured items and 63 autonomous evolution events.

In seed 97531 at 470 s, a living elite could carry up to 10 captured/inherited items, 18 recorded autonomous evolution entries in its visible capability history and a 12-card refusal repertoire. This is intentionally a stress/readability case to inspect manually, not a target count that every elite must reach.

### Opening safety

Every one of the 11 active starting Phenomena survives the first 100 s in the automated opening route and reaches four Phenomena + two Catalysts.

Some starts still fail to kill an elite by 100 s (currently Frostfront, Chain Arc, Toxic Mist and Mass Driver in this probe). Cleaver survives at only 4 HP despite killing 2/4 spawned elites. These are **manual-play/balance signals**, not automatic reasons to add generic damage: the owner previously flagged Cleaver as potentially too strong once its build comes online.

The first natural elite is therefore deliberately a readable teaching encounter: common, no affix, no refusals/evolution inheritance, with reduced clean-mode HP. Until 85 s an uncleared first elite also blocks a second simultaneous elite. This protects weak openings without removing frequent elites once the player can actually clear them.

## 11. Next design work

After this correction stabilises:

1. manually play the new Quantity/Sentry/Cleaver/Arc behaviour;
2. inspect whether item-seeking elites create interesting contest decisions rather than stupid detours;
3. tune late elite inheritance/cadence from full-run telemetry, not isolated TTK alone;
4. tune Warden HP/pattern cadence using actual late player builds;
5. continue Phenomena 2.0, with crowd grammar as a hard design test;
6. revisit remaining active branches whose identity still depends on hidden counters or generic status bookkeeping.

