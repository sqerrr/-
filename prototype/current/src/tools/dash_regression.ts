import { Simulation } from '../core/simulation.js';

/**
 * D17 grants the hero a dash with a brief window of invulnerability, and the design note
 * attaches three refusals to it: no passing through obstacles, no refund for kills, and no
 * endless chain of invulnerability. Obstacles do not exist yet, so the other two are what
 * this file pins down, together with the property the whole guarantee rests on: the window
 * is strictly shorter than the dash, so every dash ends with the hero exposed.
 */
function assert(ok: unknown, what: string): asserts ok {
  if (!ok) throw new Error('dash regression: ' + what);
}

function fresh() {
  const sim = new Simulation({ seed: 4242, hz: 60, mode: 'clean' });
  return { sim, s: sim as any };
}

const travelled = (dash: boolean) => {
  const { sim, s } = fresh();
  const x0 = s.px;
  for (let i = 0; i < 12; i++)
    sim.step({ moveX: 1, moveZ: 0, aimX: 1, aimZ: 0, dash: dash && i === 0 });
  return s.px - x0;
};
const walk = travelled(false),
  lunge = travelled(true);
assert(
  lunge > walk * 3,
  'a dash should cover far more ground than walking: ' + lunge + ' vs ' + walk
);

const { sim, s } = fresh();
sim.step({ moveX: 1, moveZ: 0, aimX: 1, aimZ: 0, dash: true });
assert(s.metrics.dashes === 1, 'the dash should be counted once');
assert(s.time < s.dashIFramesUntil, 'the window should be open right after the dash starts');

s.barrier = 0;
const hpAtStart = s.php;
s.hitPlayer(50);
assert(s.php === hpAtStart, 'a blow inside the window should not land');
assert(s.metrics.dashIFrameSaves === 1, 'the window should be recorded as having saved');
s.hitPlayer(50);
assert(s.metrics.dashIFrameSaves === 1, 'one window counts once however many blows it turns aside');

sim.step({ moveX: 1, moveZ: 0, aimX: 1, aimZ: 0, dash: true });
assert(s.metrics.dashes === 1, 'a dash cannot be restarted while it is still running');

while (s.time < s.dashIFramesUntil) sim.step({ moveX: 1, moveZ: 0, aimX: 1, aimZ: 0 });
assert(s.time < s.dashUntil, 'the window must close before the dash itself ends');
s.barrier = 0;
const hpBeforeTail = s.php;
s.hitPlayer(30);
assert(s.php < hpBeforeTail, 'the tail of a dash must be vulnerable');

while (s.time < s.dashUntil) sim.step({ moveX: 1, moveZ: 0, aimX: 1, aimZ: 0 });
const readyAt = s.dashReadyAt;
assert(readyAt > s.time, 'a cooldown should follow the dash');
for (const e of s.ents) s.damage(e, 99999, 'test', false);
assert(s.dashReadyAt === readyAt, 'kills must not refund the dash');
sim.step({ moveX: 1, moveZ: 0, aimX: 1, aimZ: 0, dash: true });
assert(s.metrics.dashes === 1, 'a dash request during the cooldown should be refused');

const exposed = Simulation.DASH_COOLDOWN + (Simulation.DASH_DURATION - Simulation.DASH_IFRAMES);
assert(
  exposed > Simulation.DASH_IFRAMES,
  'between two windows the hero must spend longer exposed than protected'
);

while (s.time < s.dashReadyAt) sim.step({ moveX: 1, moveZ: 0, aimX: 1, aimZ: 0 });
sim.step({ moveX: 1, moveZ: 0, aimX: 1, aimZ: 0, dash: true });
assert(s.metrics.dashes === 2, 'the dash should return once the cooldown has run out');


// D52: the same dash counters must be attributable to the active elite encounter.
const tracked = new Simulation({ seed: 4243, hz: 60, benchmark: true }) as any;
tracked.spawnElite();
const trackedElite = tracked.ents.find((e: any) => e.kind === 'elite');
assert(trackedElite, 'failed to create elite for per-fight dash telemetry');
const encounter = tracked.eliteEncounters().find((r: any) => r.id === trackedElite.id);
assert(encounter, 'elite encounter ledger did not register spawned elite');
encounter.engagedAt = tracked.time;
encounter.lastExchangeAt = tracked.time;
tracked.step({ moveX: 1, moveZ: 0, aimX: 1, aimZ: 0, dash: true });
tracked.hitPlayer(40, trackedElite, 'elite_test');
assert(encounter.dashes === 1, 'active elite encounter did not count the dash');
assert(encounter.dashIFrameSaves === 1, 'active elite encounter did not count the iframe save');

console.log('dash-regression OK', {
  walk: +walk.toFixed(2),
  dash: +lunge.toFixed(2),
  window: Simulation.DASH_IFRAMES,
  exposedBetweenWindows: +exposed.toFixed(2),
  saves: s.metrics.dashIFrameSaves
});
