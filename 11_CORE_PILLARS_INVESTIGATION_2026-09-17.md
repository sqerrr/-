# CORE PILLARS INVESTIGATION — 2026-09-17

**Status:** design reset / investigation.  
**Executable:** `prototype/current/` remains the v0.9B executable **unchanged**.  
**Purpose:** record the owner playtest that invalidated the current progression/elite/catalyst model, identify root causes in the implementation, and define the next design investigation before more balance tuning.

---

## 0. Executive conclusion

v0.9B fixed several presentation/world problems, but in doing so it **collapsed the build game too far toward vertical single-Phenomenon scaling** and made adaptive Elites feel like optional/rare events instead of the central combat rhythm.

This is not a request to blindly roll back to v0.8/v0.9A. The useful work in v0.9B stays useful:

- finite map and minimap foundation;
- POI/world objectives as a spatial layer;
- boss foundation;
- canonical combat geometry / presentation bridge;
- HP bars, damage numbers, threat HUD, offscreen markers;
- stronger enemy role readability;
- the rendering workstream boundary.

But the following systems are now **reopened at the design level**:

1. Elite cadence and Elite reward economy;
2. adaptation logic and Elite identity grammar;
3. normal level-up / horizontal-vs-vertical progression;
4. Resonance / general stats;
5. Phenomenon mutation philosophy and power budget;
6. Catalyst semantics and Chain topology.

Do **not** spend time tuning enemy HP/DPS around the current player progression. The current progression contains dominant strategies that would make such tuning misleading.

---

## 1. Owner playtest observations — authoritative

The following observations are the current product signal and override assumptions from the previous brief.

### 1.1 Vertical game became poorer

- Elites now feel like rare events instead of the core of the run.
- The run has less vertical drama despite having more world structure.
- POI guardians do not replace the feeling of a frequent, unavoidable Elite rhythm because POIs are player-routed and therefore optional in timing.

### 1.2 Single-Phenomenon tunnelling dominates

- New Phenomena arrive too rarely.
- Because normal level-up only upgrades active Phenomena, a run can funnel almost every level into one weapon.
- Current enemy tuning allows that one weapon to become an extreme carry.
- As a result, the Chain is not required to win and therefore fails as a core pillar.

### 1.3 Randomness/control swung too far in the opposite direction

- Earlier versions had too much noisy/random stat growth.
- v0.9B overcorrected: when only one active Phenomenon exists, all three level-up cards are effectively upgrades of the same object.
- This removes the need to improvise and almost guarantees a vertical plan.
- General growth was moved out of ordinary levels, but no equally interesting second axis replaced it.

### 1.4 Mutations are a power lottery

- Some base Phenomena feel weak before mutation.
- Some mutations then cause a discontinuous jump into an obviously dominant state.
- Orbit Blades are the clearest observed example: early reach is painful, while the outward/explosive mutation can abruptly turn the weapon into a screen-scale killer.
- Poison, Mortar and Chain Arc also have variants that can become disproportionately powerful.
- A weapon may legitimately have a slow early curve, but a mutation should not be the patch that turns a nonfunctional base kit into a completely different power tier.

### 1.5 Coverage/expansion is a near-universal S-tier choice

- Increasing the effective area/range of attacks is useful on too many Phenomena under the present crowd model.
- This is especially problematic when the game also intends to increase enemy count: target coverage scales with density and can increase effective throughput much faster than a simple damage increment.
- A choice that is correct for almost every Phenomenon is not build identity; it is a tax.

### 1.6 The two intended pillars still do not carry the run

The project was supposed to be built around:

1. **frequent adaptive Elites that make the player respond and exercise control**, and
2. **Catalysts / Chain operators that create interesting, visible combinatorial synergies**.

Current v0.9B does neither strongly enough. This is the central failure to solve before adding more content or fine balance.

---

## 2. Root-cause investigation in the current executable

This section is based on direct inspection of `prototype/current/src/`.

### 2.1 Elite cadence was structurally reduced

Current director (`simulation.ts`):

- first free-roaming Elite: ~55 s;
- until 240 s, base interval: 82 s;
- after 240 s, base interval: 68 s;
- simultaneous non-boss cap: 1 early, 2 later;
- POI guardians exist on a separate route-dependent track.

This creates guaranteed long stretches where the core adaptive system simply is not present. Earlier project intent was roughly **25–40 Elite encounters in a ~24 minute run**. v0.9B no longer reliably feels anywhere near that rhythm, especially when POIs are not immediately routed.

**Conclusion:** POI Elites should be additive to the core Elite pressure, not substitutes for it. Elite cadence should be managed as encounter pacing, not as a rare timer reward.

### 2.2 Normal level-up mathematically invites one-weapon builds

`generateLevelOffers()` currently takes only active Phenomena and creates all 3 cards from them. With one active Phenomenon, all 3 cards target that same Phenomenon. With two, the pool still strongly repeats them.

The old `isDiscoveryLevel()` helper remains in the file but is no longer used as the main acquisition path. Horizontal expansion is therefore mostly tied to world POIs.

This creates a structural dominant strategy:

`keep a small active set -> concentrate every XP level -> reach mutation/breakpoints earlier -> kill faster -> reduce need for Chain complexity`.

This is not primarily a numerical balance bug. It is a reward-lane topology bug.

### 2.3 Level 5 mutation timing amplifies the tunnel

Every selected skill upgrade increments the Phenomenon level. At level 5, a mutation offer is generated. Because a one-Phenomenon run can direct nearly every ordinary level into the same weapon, it reaches this transformative event very early and predictably.

That means the system rewards **refusing horizontal development**, the opposite of the Chain fantasy.

### 2.4 Mutation budgets are not comparable

The mutation list mixes fundamentally different effect budgets:

- simple target priority;
- status interaction;
- geometry change;
- persistent field creation;
- extra activations;
- very large area bursts;
- economy effects.

There is no shared constraint such as “one new verb plus one specialization” or a comparable opportunity cost.

Concrete example: `orbit_outbound` turns a close persistent orbit into a large activation-time circle using a much larger base radius and a strong damage multiplier. It both fixes the base reach problem and adds a new burst role. That is too much identity/power concentrated in a single lottery result.

### 2.5 Coverage is mechanically privileged

`skillRadius()` uses coverage to grow physical radius, and level geometry also multiplies the radius. Radius growth changes **how many targets can be hit**, not merely the visual size.

For circle/sector effects, area grows with the square of radius; for lines, wider hit geometry catches more lanes; for short-range melee it also makes safe positioning easier. As population density rises, these gains compound with target availability.

The implementation does use `sqrt(1 + coverage)` for the local stat, which is already an attempt to tame area growth, but the design remains broad enough that “more coverage” has value on too many archetypes. Global `Scale` then adds another broadly applicable geometry multiplier.

**Conclusion:** geometry growth cannot remain a generic, universally desirable axis. It should become skill-specific form changes, conditional doctrine, or capped/narrow growth.

### 2.6 Catalysts still behave too much like downstream modifiers

The v0.9A operator pool was an improvement, but current execution still commonly resolves as:

`left output -> store scalar/context -> right activates -> extra damage/state/proc`.

Several legacy Catalyst definitions explicitly trade away baseline power for a benefit (`accelerator`, `hunter`, `diffuser`, `reservoir`, etc.). Even where those legacy stones are outside the current discovery pool, the design language still assumes the stone may need a permanent damage penalty to justify its effect.

That fights the desired fantasy. The **slot/topology/trigger condition is already an opportunity cost**. A Catalyst should usually make the machine do a new thing, not make the player wonder whether inserting it silently made the right-hand weapon worse.

### 2.7 Current adaptation is not sufficiently “adaptive” to the encounter

`chooseAdaptation()` uses aggregate run metrics:

- fraction of total damage that was directional;
- fraction of total damage that was close-range;
- fraction of total damage that was field-based;
- average movement;
- then a random gate and fallback random choice.

The Elite makes this choice once after dropping to roughly 60% HP.

Problems:

- the sample includes the whole run, not primarily what this Elite has just observed;
- randomness weakens the causal connection;
- only one threshold means the adaptation is a short mid-fight event, not an ongoing conversation;
- the player has little reason to believe “it adapted because I did X”.

The mechanic is technically adaptive but not **perceptually adaptive**.

---

## 3. External design research — lessons, not templates to copy

### 3.1 Left 4 Dead: pace the frequency of major threats

Valve's AI Director work explicitly separates **pacing** from raw difficulty: it creates peaks and valleys by changing the frequency/population of threats based on player intensity rather than simply scaling damage. This is directly useful for our Elite problem: Elites can remain frequent and central without creating nonstop exhaustion if a director intentionally creates recovery windows.

Source: Valve, *The AI Systems of Left 4 Dead*  
https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf

**Project lesson:** build an **Elite pressure director** with a target rhythm and recovery windows. Do not solve pacing by making Elites rare.

### 3.2 Risk of Rain 2: Elites are integrated into the spawn economy

Risk of Rain 2's Directors use credits; when an Elite tier is affordable, a spawned monster can become Elite and consume more of the budget. Elites therefore live inside the overall population economy rather than on a completely separate rare-event clock.

Source: Risk of Rain 2 Wiki, *Directors*  
https://riskofrain2.wiki.gg/wiki/Directors

**Project lesson:** ordinary population, Elite pressure and encounter cost should be coordinated. A strong Elite can replace some swarm budget; a weaker Elite can appear with a denser pack. This also makes “more monsters later” compatible with frequent Elites.

### 3.3 Dead Cells: an Elite must announce itself and have a special rule

Dead Cells marks Elites persistently with a name and aura, gives them special abilities, and ties them to better/guaranteed rewards in several contexts.

Source: Official Dead Cells Wiki, *Enemies — Elite enemies*  
https://deadcells.wiki.gg/wiki/Enemies

**Project lesson:** Elite identity should be obvious before reading a log. Chassis, protocol and adaptation need persistent visual/behavioral tells, and the reward must justify paying attention.

### 3.4 Diablo IV 2.5: reduce affix overlap and improve clarity

Blizzard's recent Elite update explicitly describes new affixes, minions inheriting parts of affixes, reduced design overlap, and visual clarity improvements.

Source: Blizzard, *The 2.5.0 PTR: What You Need to Know*  
https://news.blizzard.com/en-us/article/24242857/the-2-5-0-ptr-what-you-need-to-know

**Project lesson:** adding more affixes is not enough. Each affix needs a distinct tactical question. If two affixes mostly mean “harder/faster/more HP,” one should be removed or redesigned.

### 3.5 Noita: the power is in operator grammar

Noita's modifiers attach to subsequent spells; multiple modifiers can compose, multicast grabs several following spells, and triggers execute a payload at the point of impact. The interest comes from **where and when execution moves**, not from a generic percentage boost.

Source: Noita Wiki, *Guide: Wand Mechanics*  
https://noita.wiki.gg/wiki/Guide%3A_Wand_Mechanics

**Project lesson:** Catalysts need a small, stable event grammar: route, trigger, copy, transform, accumulate, feed back. That creates combinatorics without writing a unique handcrafted pair interaction for every combination.

### 3.6 Path of Exile 2: avoid “the same five best supports”

Grinding Gear Games explicitly said the Support Gem system had a problem: they wanted to avoid builds using the same five most powerful supports on every skill while still encouraging ability combos, and later overhauled the system.

Source: GGG, *Content Update 0.3.0 — Support Gem System Overhaul*  
https://www.pathofexile.com/forum/view-thread/3826682

**Project lesson:** a universal “best Catalyst” or universal “best geometry stat” destroys the purpose of modular buildcraft. Compatibility and context must matter more than raw throughput.

### 3.7 Hades: synergy can be a gated reward for already owning two components

Duo Boons only become eligible when prerequisite Boons from two gods are present, and then create a distinct combined effect.

Source: Hades Wiki, *Duo Boons*  
https://hades.fandom.com/wiki/Duo_Boons

**Project lesson:** some of our most dramatic combination effects do not need to be ordinary level-up stats. They can be unlocked by **having two compatible Phenomena/behaviors**, then surfaced through Elite/POI/Catalyst rewards.

### 3.8 Magic design: modular synergy is stronger than linear recipes

Mark Rosewater's design writing distinguishes linear synergy from modular synergy and notes that synergy can keep individual components simple while making combinations deep. Modular pieces work with many neighbors rather than requiring a single prescribed partner.

Sources:  
https://magic.wizards.com/en/news/making-magic/come-together-2003-10-06-0  
https://magic.wizards.com/en/news/making-magic/living-synergy-2013-02-25

**Project lesson:** Phenomena should expose a small shared vocabulary of outputs, while Catalysts transform that vocabulary. Avoid hundreds of pair-specific recipes and avoid one-size-fits-all percentage stones.

### 3.9 Dominant-strategy warning

General game-balance literature is consistent on the core problem: if one option is correct across most circumstances, it removes meaningful choice rather than adding power progression.

Source: Game Developer, *Understanding Balance in Video Games*  
https://www.gamedeveloper.com/design/understanding-balance-in-video-games

**Project lesson:** “coverage on almost everything” and “one weapon to level 5 as fast as possible” are not simply overtuned choices; they are evidence that the choice structure is broken.

---

## 4. Revised product pillars

The next prototype must be judged against these pillars before content count or final numbers.

### Pillar A — Elite pressure is the heartbeat

An Elite is not a rare reward chest with legs. It is the repeated combat question that breaks the swarm rhythm.

Target direction (not final balance):

- restore approximately **25–40 meaningful Elite encounters in a 24-minute run**;
- after the opening, avoid long stretches with no Elite pressure;
- use a director with intensity/recovery rather than one fixed 68–82 s gap;
- POI guardians are **extra authored encounters**, not the main Elite supply;
- stronger Elites may spend swarm budget so frequency does not equal permanent screen overload.

### Pillar B — adaptation is a visible conversation

Adaptation loop should be:

`OBSERVE -> DECLARE -> CHANGE THE QUESTION -> EXPOSE A COUNTER -> PLAYER RESPONDS`.

The player should be able to say:

> “It saw that I was doing X, so it started doing Y; I can answer by doing Z.”

An adaptation that cannot be explained that way is not ready.

### Pillar C — no single Phenomenon should be the whole game

A Phenomenon may be a carry, but a one-Phenomenon build must pay a real opportunity cost:

- worse answers to some Elite adaptations;
- less access to Catalyst operators;
- less tactical flexibility;
- slower or narrower power ceiling.

Do **not** enforce this with arbitrary “-50% if only one weapon” rules. Make multiple behaviors mechanically valuable.

### Pillar D — Catalysts are verbs, not tax modifiers

Default rule:

- inserting a Catalyst should **not automatically weaken** the target Phenomenon;
- its cost is slot/topology/trigger opportunity;
- if a Catalyst has a downside, it should be an explicit high-agency transformation, not a hidden balancing tax;
- every Catalyst must change where/when/why an effect happens, or what event is routed through the Chain.

### Pillar E — mutations are identity branches, not jackpot multipliers

A mutation should visibly specialize a viable base Phenomenon. It should not repair a broken base weapon and then multiply its throughput at the same time.

### Pillar F — progression must preserve uncertainty without becoming noise

The previous system had too much random stat soup. v0.9B has too little uncertainty and too much deterministic tunnelling.

The target is **controlled uncertainty**: the player can steer the run, but cannot force the exact same one-weapon curve every time.

---

## 5. Elite redesign proposal for the next investigation

### 5.1 Three-layer grammar, with strict responsibilities

Keep the conceptual stack, but make each layer do only one job:

**Chassis = how it moves / occupies space**  
Examples: Hunter closes angles, Bulwark fronts the pack, Shepherd organizes normals, Architect shapes terrain.

**Protocol (former affix) = persistent rule visible from spawn**  
One sentence, one icon/aura, one repeated behavior. No pure “+speed/+damage/+defense” protocols.

**Adaptation = reaction to the player's local behavior during this encounter**  
Not random identity. It must be causally derived from a recent telemetry window.

### 5.2 Encounter-local observation instead of whole-run statistics

Each Elite should maintain a short rolling observation window, e.g. 5–8 seconds, with channels such as:

- repeated same-source activation;
- close-contact damage;
- persistent-field occupancy;
- directional/line dominance;
- crowd-control frequency;
- stationary vs constantly moving player;
- burst vs sustained damage;
- target-count/coverage pattern.

The adaptation is chosen from the strongest **recent** signal, with hysteresis so it does not flicker.

### 5.3 Candidate adaptation families

These are design examples, not locked content.

**Pattern Lock**  
Observed: same Phenomenon repeatedly dominates the last window.  
Response: after several consecutive hits from the same source, Elite builds a visible patterned guard against the *next repeat*.  
Counter: another Phenomenon / a Catalyst-triggered alternate source breaks the pattern and exposes the Elite briefly.  
Purpose: makes a one-weapon tunnel less universally correct without hard-immunizing the weapon.

**Purger**  
Observed: persistent fields dominate.  
Response: marks the strongest field, consumes/relocates it after a telegraph.  
Counter: the purge action exposes the Elite or causes the purged field to detonate if another Phenomenon tags it.  
Purpose: asks the player to move or sequence fields differently.

**Repulsor**  
Observed: close-contact/orbit damage dominates.  
Response: telegraphed expanding repulsion event.  
Counter: after pulse, close-defense collapses briefly; ranged/remote payload can also punish wind-up.  
Purpose: changes position, not “-80% melee”.

**Intercept**  
Observed: continuous kiting / linear movement.  
Response: predicts the current vector and commits to a visible line/dash.  
Counter: lateral change creates a punish window.  
Purpose: tests movement without adding projectile soup.

**Breakout**  
Observed: repeated hard control.  
Response: builds a visible break meter; on threshold, breaks the next control and performs a committed action.  
Counter: the committed action has a long recovery or becomes vulnerable to burst/status.  
Purpose: prevents permanent lock while still rewarding control timing.

### 5.4 Adaptation notification

Do not rely on scrolling event text.

On adaptation:

1. brief encounter slowdown or strong audiovisual sting;
2. Elite model/aura changes;
3. one persistent icon next to HP bar;
4. short two-part message: **“ADAPTED TO: FIELDS” / “PUNISH AFTER PURGE”**;
5. minimap/offscreen marker inherits the adaptation icon;
6. the next use of the adaptation exaggerates the telegraph once, then normal cadence resumes.

---

## 6. Catalyst / Chain redesign investigation

### 6.1 Shared event vocabulary (“ports”)

Instead of special-casing every pair, every Phenomenon exposes a small set of semantic outputs:

- `CAST` — activation happened;
- `IMPACT(point, targets, amount)`;
- `HIT(target, amount)`;
- `KILL(target, overkill)`;
- `STATE(type, target, potency)`;
- `CONTROL(target, magnitude)`;
- `FIELD(point, radius, duration, type)`;
- `CONSTRUCT(entity)`;
- `CHARGE(value)`.

A Catalyst consumes one kind of packet and emits/transforms another packet.

This is the heart of the intended combinatorics.

### 6.2 Catalyst families

**Carrier / Projection**  
Moves the right Phenomenon's execution to the left Phenomenon's impact point(s).

Example: Mortar -> Carrier -> Frost means Frost fronts appear at Mortar impacts instead of only around the player.

**Trigger**  
A qualifying left event invokes a limited/contextual right activation.

Example: kills or control thresholds can trigger the next Phenomenon without making its normal cast weaker.

**Transducer**  
Converts a semantic output into a resource/input understood by the right side.

Examples: displacement -> charge; overkill -> radius seed; status stacks -> impact count.

**Duplicator / Fork**  
Copies an event packet into multiple locations/targets under a cap.

**Memory / Reservoir**  
Stores events over several beats and releases them later as a burst or pattern.

**Feedback**  
A successful right-side outcome modifies the next left-side activation.

### 6.3 Why this is better than “+damage”

The same stone can create different visible results because Phenomena expose different events:

- a line weapon offers impact points and marks;
- a field offers persistence and occupancy;
- an orbit offers repeated contacts;
- a mortar offers remote impact positions;
- a control Phenomenon offers displacement magnitude.

The stone is generic, but the combination is not.

### 6.4 No automatic weakening rule

Default Catalysts should preserve the base attack and add/transform event flow under caps. Balance via:

- trigger frequency;
- event budget;
- stored-resource cap;
- cooldown in Chain cycles;
- topology/slot opportunity;
- compatibility conditions;
- only then, if truly necessary, an **explicit** downside that creates a different playstyle.

Do not use blanket hidden multipliers such as “right side is always 18% weaker” as the primary balancing method.

### 6.5 UI requirement

Planning UI must simulate the sentence before the player commits:

`[MORTAR] -- CARRIER --> [FROST]`  
**Preview:** “Frost Front also erupts at Mortar impact points (max 2 per cycle).”

In combat, the causal path must be visible through the same colors/icons.

---

## 7. Progression redesign candidates

Do not implement all of these at once. The next design pass should choose one coherent model.

### Candidate A — mixed level-up deck with anti-tunnel weighting

Ordinary level-up draws from three categories:

1. one active Phenomenon growth;
2. one technique / conditional stat / utility growth;
3. one wildcard that may be another Phenomenon growth, Discovery progress, or narrow Chain support.

Rules:

- after repeatedly choosing the same Phenomenon, its offer weight temporarily falls;
- early run has a soft/guaranteed path to Phenomenon #2 and #3;
- the player can still specialize, but doing so consumes rerolls/resources rather than being the default free path.

### Candidate B — Phenomenon levels + run-wide “Techniques”, not universal stats

Replace broad Resonance axes such as Scale with narrower run doctrines, for example:

- **Close Quarters:** close/contact events gain a benefit after displacement;
- **Execution:** overkill/low-HP interactions create resources;
- **Territory:** persistent fields/constructs interact with POIs/space;
- **Alternation:** changing Phenomenon source between beats creates charge;
- **Control Loop:** displacement/chill/wound can feed Chain events.

These apply across the build but only if the build has the relevant behavior. They are not “+12% radius to everything”.

### Candidate C — horizontal acquisition through frequent Elites

Make the Elite loop itself feed the Chain:

- frequent Elite kills grant a choice between **new Phenomenon / new Catalyst / mutation reroute / structural slot action** depending on run state;
- normal XP mainly improves what is already owned;
- crucially, early Elite cadence must be high enough that new Phenomena do not become rare world-only prizes.

This aligns both core pillars: fighting Elites is how the player gains new combinatorial pieces.

### Recommended direction to prototype first

A hybrid of **A + C**:

- XP provides controlled vertical growth with some uncertainty;
- frequent Elite encounters are the main horizontal/structural channel;
- POIs bias or target the type of structural reward rather than being the only way to obtain it;
- broad universal Resonance is temporarily removed or reduced to rare late-run doctrines until the Chain works.

---

## 8. Mutation redesign rules

For the next prototype, reduce each test Phenomenon to **3 mutations**, not 5. Each mutation must pass all rules below.

### Rule 1 — base weapon must already work

Mutation cannot be required to fix basic reach, hit reliability, or target access.

### Rule 2 — mutation changes a verb or specialization

At least one of:

- geometry pattern;
- targeting rule;
- state/field behavior;
- Chain port/output;
- timing/rhythm;
- positional requirement.

Pure “+X% damage” does not qualify.

### Rule 3 — one mutation cannot win on every axis

If it dramatically increases coverage, it should not simultaneously add a large unconditional damage multiplier and new proc economy.

### Rule 4 — every branch must create a different Catalyst surface

Example for Orbit Blades:

- **Saw Ring:** tighter elite/contact specialization; emits repeated `HIT` packets;
- **Outbound:** periodically throws blades outward; emits remote `IMPACT` packets but does not also multiply all damage;
- **Guard/Deflect:** converts intercepted threat/control into `CHARGE` or defensive events.

These are different build interfaces, not three grades of DPS.

### Rule 5 — mutation power is contextual

A mutation can be extremely strong in the right build, but it should require context — a Catalyst, an enemy pattern, a positional commitment, a state, a Chain order — rather than being automatically dominant on selection.

---

## 9. Scope for the next manual design slice

Do **not** expand content. Shrink the sandbox until the pillars work.

Recommended test roster: **4 Phenomena** chosen to expose different event types:

1. Ember Lance — directional impact / state;
2. Frost Front — area control / field;
3. Orbit Blades — persistent close-contact / repeated hit;
4. Mortar Bloom — remote impact / area.

Recommended Catalyst sandbox: **6 operators**, one per family:

- Carrier;
- Trigger;
- Transducer;
- Fork;
- Memory;
- Feedback.

Recommended Elite sandbox:

- 3–4 Chassis;
- 3 persistent Protocols;
- 5 adaptive responses;
- much higher Elite cadence than v0.9B;
- no need for dozens of normal enemy variants during this experiment.

This is not a content cut for the final game. It is an attempt to prove the combinatorial grammar before multiplying it.

---

## 10. Manual acceptance questions for the next slice

No automated DPS ranking is required. During a run, answer these questions:

### Elite pillar

- Do I meet an Elite often enough that I think about the next one while building?
- Can I identify Chassis + Protocol before reading text?
- When it adapts, can I explain what behavior of mine caused the response?
- Does the adaptation change what I do without making my build useless?
- Does countering the adaptation create a punish window I can exploit?

### Chain pillar

- After adding one Catalyst, can I point to a new causal event on screen?
- Does moving the same Catalyst between two different pairs produce meaningfully different play?
- Is the stone useful without a hidden guaranteed penalty?
- Do I ever voluntarily rearrange Chain order because of the next Elite?

### Progression pillar

- Am I tempted to add a second/third Phenomenon for mechanical reasons, not because the UI forces me?
- Can I specialize one Phenomenon without trivially making every other slot irrelevant?
- Does a mutation open a build direction rather than simply spike throughput?
- Is there any stat/choice that I would take on almost every Phenomenon? If yes, redesign it rather than merely nerfing it.

---

## 11. Decisions for handoff

**Accepted / preserve:**

- v0.9B rendering/presentation foundation;
- finite map + minimap + boss/world infrastructure;
- canonical hit geometry;
- damage numbers/HP bars/threat indicators;
- normal projectile reduction direction;
- 3–4 active Phenomena as a useful near-term complexity cap.

**Rejected / reopen:**

- v0.9B XP = only active Phenomenon upgrades;
- Phenomenon acquisition mostly via sparse POIs;
- 55s first Elite + 68–82s regular cadence as the core Elite rhythm;
- whole-run aggregate/random adaptation selection;
- broad Resonance axes as currently conceived, especially universal Scale;
- mutation list/power budgets as current baseline;
- Catalyst balancing through routine unconditional weakening;
- implementation of universal Chain cells before Catalyst semantics are proven.

**Next work item:** design/prototype the **Elite conversation + Catalyst event grammar + controlled progression** as one focused v0.9C gameplay experiment. Do not tune final enemy HP curve first.
