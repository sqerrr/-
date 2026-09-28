/**
 * Frame-cost probe: plays a long clean run the way src/platform/main.ts drives it (one
 * sim.step + one snapshot + PresentationBridge.consume per tick, plus the snapshots main.ts
 * takes per Catalyst event) and prints, per window of game time, milliseconds spent per game
 * second and what the world holds. Research tool; not part of npm test.
 *
 *   node dist/tools/perf_frame_probe.js --start sentry --seed 12345 --run 480 --dash 1 --window 30
 *
 * --dash 1 dashes whenever the dash is ready; --dash 0 never dashes.
 */
import { Simulation } from '../core/simulation.js';
import type { Command, Snapshot } from '../core/types.js';
import { PresentationBridge } from '../presentation/bridge.js';
import { HZ, argNumber, argValue, pickOfferBy, routeSteer } from './balance_kit.js';

declare const performance: { now(): number };

const start = argValue('start', 'sentry') as Snapshot['chain']['slots'][number] & string;
const seed = argNumber('seed', 12345);
const runDuration = argNumber('run', 480);
const dashAlways = argNumber('dash', 1) === 1;
const windowSec = argNumber('window', 30);

const sim = new Simulation({ seed, hz: HZ, runDuration, mode: 'clean', startingSkill: start });
const bridge = new PresentationBridge();
bridge.reset(sim.snapshot());
const rand = () => 0.5;
let cmd: Command = { moveX: 0, moveZ: 0, aimX: 1, aimZ: 0 };
let stepMs = 0, snapMs = 0, bridgeMs = 0, catalystSnapMs = 0;
let events = 0, catalystEvents = 0, dashes = 0;
const eventTypes: Record<string, number> = {};
let windowStart = 0;
const rows: Record<string, unknown>[] = [];

for (let i = 0; i < runDuration * HZ; i++) {
  const t0 = performance.now();
  sim.step(cmd);
  const t1 = performance.now();
  const snap = sim.snapshot();
  const t2 = performance.now();
  bridge.consume(sim.events, sim.time, snap);
  const t3 = performance.now();
  for (const ev of sim.events) {
    events++;
    eventTypes[ev.type] = (eventTypes[ev.type] ?? 0) + 1;
    if (ev.type === 'CatalystTriggered' || ev.type === 'CatalystChoreography') {
      catalystEvents++;
      const c0 = performance.now();
      sim.snapshot();
      catalystSnapMs += performance.now() - c0;
    }
  }
  stepMs += t1 - t0;
  snapMs += t2 - t1;
  bridgeMs += t3 - t2;
  if (i % 6 === 0) {
    cmd = routeSteer(snap, i);
    if (dashAlways && snap.player.dashReady) {
      cmd = { ...cmd, dash: true };
      dashes++;
    }
  } else cmd = { ...cmd, dash: false };
  let guard = 0;
  while (sim.hasChoice && guard++ < 16) {
    const s = sim.snapshot();
    if (s.mutationOffer) sim.chooseMutation(0);
    else if (s.rewardOffers) sim.chooseReward(pickOfferBy('driver', s, rand));
    else break;
  }
  // Keep the hero alive: this probe measures cost over a full run, not survival.
  if (sim.php < 60) sim.php = 180;
  const t = sim.tick / HZ;
  if (t - windowStart >= windowSec) {
    const secs = t - windowStart;
    rows.push({
      t: Math.round(t),
      level: snap.player.level,
      stepMsPerSec: +(stepMs / secs).toFixed(1),
      snapMsPerSec: +(snapMs / secs).toFixed(1),
      bridgeMsPerSec: +(bridgeMs / secs).toFixed(1),
      catalystSnapMsPerSec: +(catalystSnapMs / secs).toFixed(1),
      eventsPerSec: Math.round(events / secs),
      catalystEventsPerSec: +(catalystEvents / secs).toFixed(1),
      dashes,
      entities: snap.entities.length,
      projectiles: snap.projectiles.length,
      fields: snap.fields.length,
      constructs: snap.constructs.length,
      obstacles: snap.world.obstacles.length,
      pickups: snap.pickups.length,
      top: Object.entries(eventTypes).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k}:${Math.round(v / secs)}`).join(' ')
    });
    stepMs = snapMs = bridgeMs = catalystSnapMs = 0;
    events = catalystEvents = dashes = 0;
    for (const k of Object.keys(eventTypes)) delete eventTypes[k];
    windowStart = t;
  }
  if (sim.finished) break;
}
console.table(rows);
