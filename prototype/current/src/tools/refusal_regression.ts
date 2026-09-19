declare const process: { argv: string[]; exit(code?: number): never };
import { Simulation } from '../core/simulation.js';
import type { Snapshot } from '../core/types.js';

const assert = (ok: boolean, msg: string) => {
  if (!ok) {
    console.error('refusal-regression FAIL: ' + msg);
    process.exit(1);
  }
};

const hz = 60;
const sim = new Simulation({ seed: 12345, hz });

// D10: an elite may never field more of the hero's history than its tier allows.
const CAPACITY: Record<string, number> = { common: 1, uplifted: 3, legendary: 6 };

let resolved = 0;
let refusedEvents = 0;
let maxRefusalsAfterResolve = 0;
let elitesSeen = 0;
let armedElites = 0;
let rivalCasts = 0;
const castSkills = new Set<string>();
const tiers: Record<string, number> = { common: 0, uplifted: 0, legendary: 0 };
const knownElites = new Set<number>();

for (let i = 0; i < 3600; i++) {
  const snap: Snapshot = sim.snapshot();
  const a = i / (hz * 4.3),
    sx = Math.cos(a) * 0.65,
    sy = Math.sin(a * 0.73) * 0.58;
  const moveX = (sx + sy) * 0.7071,
    moveZ = (-sx + sy) * 0.7071;
  const targets = [...snap.entities].sort(
    (p, q) =>
      Number(q.elite) - Number(p.elite) ||
      Math.hypot(p.x - snap.player.x, p.z - snap.player.z) -
        Math.hypot(q.x - snap.player.x, q.z - snap.player.z)
  );
  const t = targets[0];
  let ax = Math.cos(a),
    az = Math.sin(a);
  if (t) {
    const dx = t.x - snap.player.x,
      dz = t.z - snap.player.z,
      m = Math.hypot(dx, dz) || 1;
    ax = dx / m;
    az = dz / m;
  }
  sim.step({ moveX, moveZ, aimX: ax, aimZ: az });

  let guard = 0;
  while (sim.hasChoice && guard++ < 10) {
    const s = sim.snapshot();
    if (s.mutationOffer) {
      // Picking a mutation is not a draft: nothing is conceded to the elites.
      const before = sim.snapshot().refusals.length;
      sim.chooseMutation(0);
      assert(
        sim.snapshot().refusals.length === before,
        'a mutation choice must not concede a card'
      );
    } else if (s.rewardOffers) {
      const before = sim.snapshot().refusals.length;
      const offered = s.rewardOffers.length;
      if (sim.chooseReward(0)) {
        const after = sim.snapshot().refusals.length;
        // D7: exactly one of the cards the hero passed over reaches the elites, never more.
        const gained = after - before;
        assert(gained <= 1, 'a single draft conceded ' + gained + ' cards');
        if (offered > 1 && s.rewardOffers[0].kind !== 'mutation_target') {
          assert(gained === 1, 'a resolved draft conceded nothing');
          resolved++;
        }
        maxRefusalsAfterResolve = Math.max(maxRefusalsAfterResolve, after);
      }
    }
  }
  // step() clears the event list, so read it after the draft is resolved to catch both
  // the combat events of this tick and anything the choice pushed.
  for (const ev of sim.events) {
    if (ev.type === 'RewardRefused') refusedEvents++;
    if (ev.type === 'RivalCast') {
      rivalCasts++;
      castSkills.add(ev.skill);
      const live = sim.snapshot();
      const caster = live.entities.find((e) => e.id === ev.entity);
      assert(!!caster && caster.elite, 'a non-elite fielded a refusal');
      const card = live.refusals.find((c) => c.serial === ev.serial);
      assert(!!card, 'a rival cast referenced a serial that is not in the store');
      assert(card!.skill === ev.skill, 'a rival cast used a skill the card does not carry');
      assert(card!.heldBy === ev.entity, 'an elite fielded a card claimed by someone else');
    }
  }

  for (const e of sim.snapshot().entities) {
    if (!e.elite || e.boss || knownElites.has(e.id)) continue;
    knownElites.add(e.id);
    elitesSeen++;
    tiers[e.eliteRarity] = (tiers[e.eliteRarity] ?? 0) + 1;
    if (e.refusalIcons.length) armedElites++;
    assert(
      e.refusalIcons.length <= CAPACITY[e.eliteRarity],
      'a ' + e.eliteRarity + ' elite fields ' + e.refusalIcons.length + ' cards'
    );
  }

  const now = sim.snapshot();
  if (now.player.hp <= 0 || now.finished) break;
}

const s = sim.snapshot();
assert(resolved > 0, 'the run resolved no drafts at all');
assert(s.refusals.length > 0, 'the refusal store stayed empty');
assert(
  s.refusals.length === refusedEvents,
  'store size ' + s.refusals.length + ' disagrees with ' + refusedEvents + ' RewardRefused events'
);

// Serials must be dense and ascending: the store is an ordered history, not a bag.
s.refusals.forEach((c, i) =>
  assert(c.serial === i + 1, 'serial ' + c.serial + ' out of order at index ' + i)
);
// D11: a card may only be held by an elite that is still standing. Anything else means a
// repertoire leaked when its owner died and the card is lost to the store for good.
const aliveElites = new Set(s.entities.filter((e) => e.elite).map((e) => e.id));
assert(
  s.refusals.every((c) => c.heldBy === 0 || aliveElites.has(c.heldBy)),
  'a card is still claimed by an elite that is no longer alive'
);
// Every conceded card must carry enough identity to be fielded later.
assert(
  s.refusals.every(
    (c) =>
      !!c.title && !!c.icon && (!!c.skill || !!c.catalyst || !!c.item || !!c.resonance || !!c.stat)
  ),
  'a conceded card carries no usable payload'
);

// No card may be claimed twice over: a held serial must map to exactly one elite.
const claims = new Map<number, number>();
for (const c of s.refusals) if (c.heldBy) claims.set(c.serial, c.heldBy);
assert(
  claims.size === s.refusals.filter((c) => c.heldBy !== 0).length,
  'a serial was claimed twice'
);

// The whole point of the slice: elites must actually end up carrying refusals and using
// them. A silent store would make the whole draft invisible to the player.
assert(elitesSeen > 0, 'the run produced no elites to arm');
assert(armedElites > 0, 'no elite ever claimed a refused card');
assert(
  rivalCasts === s.metrics.rivalCasts,
  'live run: event count ' + rivalCasts + ' disagrees with metric ' + s.metrics.rivalCasts
);
// Only self-contained attacks may be fielded: fields and turrets still belong to the hero,
// so the guard reads the engine's own list rather than a copy that can drift away from it.
const CASTABLE = new Set<string>(Simulation.RIVAL_CASTABLE as unknown as string[]);
for (const id of castSkills)
  assert(CASTABLE.has(id), 'an elite fielded ' + id + ', which is not rival-safe yet');

const byKind: Record<string, number> = {};
for (const c of s.refusals) byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;

console.log('refusal-regression OK', {
  resolved,
  stored: s.refusals.length,
  byKind,
  elites: elitesSeen,
  armed: armedElites,
  tiers,
  rivalCasts,
  castSkills: [...castSkills]
});

// --- scenario: an elite holding a declined phenomenon fires it at the hero ---
// Stated conditions instead of a hopeful live run: a stocked refusal store, an elite
// standing close enough for the card it holds, and enough time for one cadence.
const scene: any = new Simulation({ seed: 4242, hz });
const armed: string[] = [];
for (const skill of Simulation.RIVAL_CASTABLE) {
  scene.refusalSerial++;
  scene.refusalStore.push({
    serial: scene.refusalSerial,
    kind: "skill",
    title: String(skill),
    icon: String(skill),
    skill,
    heldBy: 0
  });
  armed.push(String(skill));
}
scene.spawnElite();
const rival = scene.ents.find((e: any) => e.kind === "elite");
assert(!!rival, "scenario: no elite was spawned");
assert(rival.repertoire.length > 0, "scenario: the elite claimed nothing from a full store");
// Park it at arm's length so even the shortest-reach card in its hand can land.
rival.x = scene.px + 1.2;
rival.z = scene.pz;
let sceneCasts = 0;
for (let i = 0; i < 900; i++) {
  rival.x = scene.px + 1.2;
  rival.z = scene.pz;
  rival.hp = rival.maxHp;
  scene.php = scene.maxHp;
  scene.step({ moveX: 0, moveZ: 0, aimX: 1, aimZ: 0 });
  for (const ev of scene.events) if (ev.type === "RivalCast") sceneCasts++;
}
assert(sceneCasts > 0, "scenario: an armed elite in reach never fielded a refusal");
assert(
  scene.metrics.rivalCasts === sceneCasts,
  "scenario: event count " + sceneCasts + " disagrees with metric " + scene.metrics.rivalCasts
);
console.log("refusal-scenario OK", { armed: armed.length, held: rival.repertoire.length, casts: sceneCasts });
