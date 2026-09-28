/**
 * Shared helpers for the balance simulation scripts (balance_*.ts).
 *
 * These scripts are measurement tools, not regressions: they are NOT wired into `npm test`,
 * they never assert, and they print JSON so two builds (before/after a tuning pass) can be
 * diffed. Nothing here may be imported by gameplay code.
 */
declare const process: { argv: string[] };

import { activeSkillOrder } from '../content/definitions.js';
import type { RewardOffer, SkillId, Snapshot } from '../core/types.js';

export const HZ = 60 as const;

export function argValue(name: string, fallback: string) {
  const index = process.argv.indexOf('--' + name);
  if (index < 0 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

export function argFlag(name: string) {
  return process.argv.includes('--' + name);
}

export function argNumber(name: string, fallback: number) {
  const value = Number(argValue(name, String(fallback)));
  return Number.isFinite(value) ? value : fallback;
}

export function argSeeds(fallbackCount: number) {
  const explicit = argValue('seed-list', '');
  if (explicit) return explicit.split(',').map((s) => Number(s.trim())).filter(Number.isFinite);
  const count = argNumber('seeds', fallbackCount);
  const base = argNumber('seed-base', 12345);
  return Array.from({ length: count }, (_, i) => base + i * 7919);
}

export function argStarts(): SkillId[] {
  const raw = argValue('starts', 'all');
  if (raw === 'all') return [...activeSkillOrder];
  return raw.split(',').map((s) => s.trim()) as SkillId[];
}

export function percentile(values: number[], p: number) {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[index];
}

export const median = (values: number[]) => percentile(values, 0.5);

export function round(value: number, digits = 2) {
  if (!Number.isFinite(value)) return value;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export function mean(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN;
}

/** Deterministic tiny RNG for driver decisions, kept apart from the simulation's own streams. */
export function driverRng(seed: number) {
  let state = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * How the automated player picks a card.
 *
 * - `driver`  the repository's existing crude policy (fill nodes, else first card);
 * - `random`  uniform - the floor of player skill, closest to "a new player";
 * - `greedy`  fills nodes, then prefers raw damage (might > precision > quantity > rest) -
 *             the ceiling that exposes "annihilation" builds;
 * - `defensive` fills nodes, then prefers guard/mobility/size - checks the other end.
 */
export type OfferPolicy = 'driver' | 'random' | 'greedy' | 'defensive';

const greedyDoctrines = ['might', 'precision', 'quantity', 'duration', 'size', 'force', 'mobility', 'guard'];
const defensiveDoctrines = ['guard', 'mobility', 'size', 'duration', 'force', 'might', 'quantity', 'precision'];

function doctrineRank(offer: RewardOffer, order: string[]) {
  const index = offer.doctrine ? order.indexOf(offer.doctrine) : -1;
  return index < 0 ? order.length : index;
}

export function pickOfferBy(policy: OfferPolicy, s: Snapshot, rand: () => number): number {
  const offers = s.rewardOffers;
  if (!offers || !offers.length) return 0;
  if (policy === 'random') return Math.floor(rand() * offers.length);
  const fill = offers.findIndex((o) => o.kind === 'skill_add' || o.kind === 'catalyst_add');
  if (fill >= 0) return fill;
  if (policy === 'driver') {
    const grow = offers.findIndex((o) => o.kind === 'resonance');
    return grow >= 0 ? grow : 0;
  }
  const order = policy === 'greedy' ? greedyDoctrines : defensiveDoctrines;
  let best = 0;
  let bestRank = Number.POSITIVE_INFINITY;
  offers.forEach((offer, index) => {
    // Items and elite cards are strictly taken before doctrines by both biased policies.
    const rank =
      offer.kind === 'item_grant' || offer.kind === 'elite' ? -1 : doctrineRank(offer, order);
    if (rank < bestRank) {
      bestRank = rank;
      best = index;
    }
  });
  return best;
}

/**
 * Route-aware movement (same intent as progression_probe): visit POIs to collect the build,
 * detour for relics, sidestep telegraphed elite actions and dash through them.
 */
export function routeSteer(s: Snapshot, tick: number) {
  const ownedPhenomena =
    s.chain.slots.filter(Boolean).length + s.chain.skillReserve.filter(Boolean).length;
  const ownedCatalysts =
    s.chain.catalysts.filter(Boolean).length + s.chain.catalystReserve.filter(Boolean).length;
  const open = s.world.pois.filter((p) => p.state !== 'cleared');
  const wanted = ownedPhenomena < 2 ? 'phenomenon' : ownedCatalysts < 1 ? 'catalyst' : null;
  let candidates = wanted ? open.filter((p) => p.kind === wanted) : open;
  if (!candidates.length) candidates = open;
  const dist = (x: number, z: number) => Math.hypot(x - s.player.x, z - s.player.z);
  const target = [...candidates].sort((a, b) => dist(a.x, a.z) - dist(b.x, b.z))[0];
  const nearRelic = [...s.relics].sort((a, b) => dist(a.x, a.z) - dist(b.x, b.z))[0];
  let moveX = 0;
  let moveZ = 0;
  if (nearRelic && ownedPhenomena >= 2 && dist(nearRelic.x, nearRelic.z) < 7) {
    const dx = nearRelic.x - s.player.x, dz = nearRelic.z - s.player.z, m = Math.hypot(dx, dz) || 1;
    moveX = dx / m;
    moveZ = dz / m;
  } else if (target) {
    const dx = target.x - s.player.x, dz = target.z - s.player.z, m = Math.hypot(dx, dz) || 1;
    moveX = dx / m;
    moveZ = dz / m;
  } else {
    const a = tick / (HZ * 4.3), sx = Math.cos(a) * 0.65, sy = Math.sin(a * 0.73) * 0.58;
    moveX = (sx + sy) * 0.7071;
    moveZ = (-sx + sy) * 0.7071;
  }
  const threats = [...s.entities].sort(
    (a, b) => Number(b.elite) - Number(a.elite) || dist(a.x, a.z) - dist(b.x, b.z)
  );
  const e = threats[0];
  let aimX = 1, aimZ = 0, danger = false;
  if (e) {
    const dx = e.x - s.player.x, dz = e.z - s.player.z, m = Math.hypot(dx, dz) || 1;
    aimX = dx / m;
    aimZ = dz / m;
    danger =
      !!e.elite &&
      (!!e.eliteAction || e.echoPhase === 'tell' || e.echoPhase === 'active' || e.telegraph > 0);
    if (danger) {
      const directional = ['hunter', 'bulwark', 'harvester'].includes(e.chassis ?? '');
      if (directional) {
        const fx = e.facingX || aimX, fz = e.facingZ || aimZ;
        moveX = -fz;
        moveZ = fx;
      } else {
        moveX = -dx / m;
        moveZ = -dz / m;
      }
    }
  }
  return { moveX, moveZ, aimX, aimZ, dash: danger && s.player.dashReady };
}

/** Kinds of choice windows, as seen by the player. */
export function windowKind(s: Snapshot): string {
  if (s.mutationOffer) return 'mutation';
  const offers = s.rewardOffers ?? [];
  if (!offers.length) return 'none';
  const kinds = new Set(offers.map((o) => o.kind));
  if (kinds.has('elite') || kinds.has('item_grant')) return 'elite_cache';
  if (kinds.has('skill_add') || kinds.has('skill_swap')) return 'phenomenon';
  if (kinds.has('catalyst_add')) return 'catalyst';
  if (kinds.has('mutation_target')) return 'mutation_target';
  if ([...kinds].every((k) => k === 'doctrine')) return 'level';
  if (kinds.has('resonance') || kinds.has('global')) return 'resonance';
  return [...kinds].join('+');
}

export function freeSkillPlaces(s: Snapshot) {
  return s.chain.slots.filter((x) => !x).length + s.chain.skillReserve.filter((x) => !x).length;
}

export function freeCatalystPlaces(s: Snapshot) {
  return (
    s.chain.catalysts.filter((x) => !x).length + s.chain.catalystReserve.filter((x) => !x).length
  );
}

export function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}
