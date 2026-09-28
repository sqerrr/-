/**
 * Offer/choice audit: plays full clean runs with a random-ish player and counts every
 * reward-system anomaly found during the 2026-09-28 balance review.
 *
 * Detectors (all counters, no assertions):
 *   applyFailed         chooseReward() returned false - the window is already closed, so the
 *                       reward (and any spent elite cores) is lost silently;
 *   unplaceableSkill    a phenomenon card (skill_add / elite with skill) offered while every
 *                       phenomenon place (4 active + reserve) is occupied;
 *   unplaceableCatalyst a catalyst card offered while every catalyst place is occupied;
 *   swapOffered         skill_swap cards offered / taken (the bot takes them without a target);
 *   phenomenonDeleted   a phenomenon disappeared from the build after a swap
 *                       (reserve overflow), with mutation cores before/after;
 *   rerollChannelSwitch reroll turned a phenomenon/catalyst/resonance window into doctrines;
 *   poiRewardLost       non-vital POI cleared in a step that could not open its window;
 *   catalystPowerOffered resonance "conductivity" (Catalyst power) offered / taken;
 *   catalystPowerUnlinked ... of those offers, made while no Catalyst stands on an edge
 *                       (the card does nothing yet; should stay 0);
 *   fortuneOffered      global "fortune" card offered / taken;
 *   doctrineRankAtOffer max doctrine rank seen on offer.
 *
 * Measurement only; not part of `npm test`.
 *
 * Usage (after `npm run build`):
 *   node dist/tools/balance_offer_audit.js [--seeds 20] [--run 480] [--reroll-chance 0.25]
 *        [--starts all|cleaver] [--examples 5]
 */
import { Simulation } from '../core/simulation.js';
import type { Command, SkillId, Snapshot } from '../core/types.js';
import {
  HZ, argNumber, argSeeds, argStarts, driverRng, freeCatalystPlaces, freeSkillPlaces,
  pickOfferBy, printJson, routeSteer, windowKind
} from './balance_kit.js';

const seeds = argSeeds(20);
const starts = argStarts();
const runDuration = argNumber('run', 480);
const rerollChance = argNumber('reroll-chance', 0.25);
const exampleLimit = argNumber('examples', 5);

const counters: Record<string, number> = {
  runs: 0,
  windows: 0,
  applyFailed: 0,
  unplaceableSkill: 0,
  unplaceableCatalyst: 0,
  swapOffered: 0,
  swapTaken: 0,
  phenomenonDeleted: 0,
  rerolls: 0,
  rerollChannelSwitch: 0,
  poiRewardLost: 0,
  catalystPowerOffered: 0,
  catalystPowerTaken: 0,
  catalystPowerUnlinked: 0,
  fortuneOffered: 0,
  fortuneTaken: 0,
  doctrineRankAtOffer: 0
};
const examples: Record<string, unknown[]> = {};

function example(key: string, value: unknown) {
  counters[key] = (counters[key] ?? 0) + 1;
  const list = (examples[key] ??= []);
  if (list.length < exampleLimit) list.push(value);
}

function owned(s: Snapshot) {
  return [...s.chain.slots, ...s.chain.skillReserve].filter((x): x is SkillId => !!x);
}

function auditRun(start: SkillId, seed: number) {
  const sim = new Simulation({ seed, hz: HZ, runDuration, mode: 'clean', startingSkill: start });
  const rand = driverRng(seed);
  let cmd: Command = { moveX: 0, moveZ: 0, aimX: 1, aimZ: 0 };
  let lastSerial = sim.snapshot().choiceSerial;
  counters.runs++;
  for (let i = 0; i < runDuration * 1.15 * HZ; i++) {
    if (i % 6 === 0) cmd = routeSteer(sim.snapshot(), i);
    sim.step(cmd);
    const time = Math.round((sim.tick / HZ) * 10) / 10;

    const poiClears = sim.events.filter((e) => e.type === 'PoiCleared' && e.kind !== 'vital').length;
    if (poiClears) {
      const serial = sim.snapshot().choiceSerial;
      const opened = serial !== lastSerial ? 1 : 0;
      if (poiClears > opened) example('poiRewardLost', { seed, start, time, poiClears, opened });
    }

    let guard = 0;
    while (sim.hasChoice && guard++ < 16) {
      const s = sim.snapshot();
      const offers = s.rewardOffers;
      if (s.choiceSerial !== lastSerial) {
        lastSerial = s.choiceSerial;
        counters.windows++;
        for (const offer of offers ?? []) {
          if (offer.skill && (offer.kind === 'skill_add' || offer.kind === 'elite') && freeSkillPlaces(s) === 0)
            example('unplaceableSkill', { seed, start, time, window: windowKind(s), offer: offer.kind, skill: offer.skill });
          if (offer.catalyst && (offer.kind === 'catalyst_add' || offer.kind === 'elite') && freeCatalystPlaces(s) === 0)
            example('unplaceableCatalyst', { seed, start, time, window: windowKind(s), catalyst: offer.catalyst });
          if (offer.kind === 'skill_swap') counters.swapOffered++;
          if (offer.resonance === 'conductivity') {
            counters.catalystPowerOffered++;
            if (!s.chain.catalysts.some((x) => !!x)) counters.catalystPowerUnlinked++;
          }
          if (offer.kind === 'global' && offer.stat === 'fortune') counters.fortuneOffered++;
          if (offer.doctrine)
            counters.doctrineRankAtOffer = Math.max(counters.doctrineRankAtOffer, s.doctrines[offer.doctrine] + 1);
        }
      }
      if (s.mutationOffer) {
        sim.chooseMutation(Math.floor(rand() * s.mutationOffer.choices.length));
        continue;
      }
      if (!offers) break;

      const kind = windowKind(s);
      if (s.rerolls > 0 && kind !== 'level' && rand() < rerollChance && sim.rerollRewards()) {
        counters.rerolls++;
        const after = windowKind(sim.snapshot());
        if (after !== kind) example('rerollChannelSwitch', { seed, start, time, before: kind, after });
        continue;
      }

      const index = pickOfferBy('random', s, rand);
      const offer = offers[index];
      const before = owned(s);
      const coresBefore = s.mutationCores;
      const ok = sim.chooseReward(index);
      const after = sim.snapshot();
      if (!ok)
        example('applyFailed', {
          seed, start, time, window: kind, offer: offer.kind, skill: offer.skill, catalyst: offer.catalyst,
          freeSkill: freeSkillPlaces(s), freeCatalyst: freeCatalystPlaces(s), windowStillOpen: !!after.rewardOffers
        });
      if (offer.kind === 'skill_swap') counters.swapTaken++;
      if (offer.resonance === 'conductivity') counters.catalystPowerTaken++;
      if (offer.kind === 'global' && offer.stat === 'fortune') counters.fortuneTaken++;
      const lost = before.filter((id) => !owned(after).includes(id));
      if (lost.length)
        example('phenomenonDeleted', {
          seed, start, time, via: offer.kind, lost, coresBefore, coresAfter: after.mutationCores
        });
    }
    if (i % HZ === 0) {
      const s = sim.snapshot();
      if (s.player.hp <= 0 || s.finished) break;
    }
  }
}

for (const start of starts) for (const seed of seeds) auditRun(start, seed);

printJson({ config: { seeds: seeds.length, starts, runDuration, rerollChance }, counters, examples });
