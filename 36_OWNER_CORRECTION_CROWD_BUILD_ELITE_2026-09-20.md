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
- are added to `eliteLegacyItems`, the run’s enemy-side item history;
- can be inherited in a sample by later elites;
- are independent from the refusal pool.

All 20 current items now have explicit elite-side effects rather than collapsing into five generic category buffs. Examples include durability, mitigation, movement, faster chassis actions, stronger Echoes, crit, siphon, longer item-seeking range and additional learned refusal knowledge.

Durability bonuses are explicitly allowed. The previous rule forbidding item-driven elite HP because an old TTK target had already been calibrated is rejected.

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
- inherits **all distinct item effects that elites captured during the run**;
- its baseline durability also grows modestly with the amount of enemy item history;
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

## 10. Current simulations

Two complementary suites are used:

1. isolated elite lab — a *viability/stall* detector, no longer an equality test;
2. `crowd_ecosystem_matrix` — four deliberately different build families against an 84-enemy crowd + elite and against a late Warden carrying enemy-history items/refusals.

Natural `progression_probe` and all-11-start opening safety remain part of CI. Exact v0.11.4 matrix numbers are recorded after the final green CI run rather than frozen here before the code settles.

## 11. Next design work

After this correction stabilises:

1. manually play the new Quantity/Sentry/Cleaver/Arc behaviour;
2. inspect whether item-seeking elites create interesting contest decisions rather than stupid detours;
3. tune late elite inheritance/cadence from full-run telemetry, not isolated TTK alone;
4. tune Warden HP/pattern cadence using actual late player builds;
5. continue Phenomena 2.0, with crowd grammar as a hard design test;
6. revisit remaining active branches whose identity still depends on hidden counters or generic status bookkeeping.

