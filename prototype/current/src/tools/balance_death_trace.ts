/**
 * Balance death trace: plays clean runs with the route-aware evasive driver and prints what
 * actually killed the hero - the last hits before death and the elite/retinue picture at that
 * moment. Research tool; not part of npm test.
 *
 *   node dist/tools/balance_death_trace.js --starts cleaver,rail_spear --seeds 2 --window 12
 */
import { Simulation } from '../core/simulation.js';
import type { Command, Snapshot } from '../core/types.js';
import { HZ, argNumber, argSeeds, argStarts, pickOfferBy, routeSteer } from './balance_kit.js';

const seeds = argSeeds(2);
const starts = argStarts();
const windowSec = argNumber('window', 12);
const runDuration = argNumber('run', 480);

for (const start of starts) {
  for (const seed of seeds) {
    const sim = new Simulation({ seed, hz: HZ, runDuration, mode: 'clean', startingSkill: start });
    const hits: { t: number; who: string; hp: number; after: number }[] = [];
    let cmd: Command = { moveX: 0, moveZ: 0, aimX: 1, aimZ: 0 };
    let dead = false;
    const rand = () => 0.5;
    for (let i = 0; i < runDuration * 1.1 * HZ && !dead; i++) {
      if (i % 6 === 0) cmd = routeSteer(sim.snapshot(), i);
      sim.step(cmd);
      const t = sim.tick / HZ;
      for (const ev of sim.events) {
        if (ev.type !== 'PlayerHit' || ev.hpDamage <= 0) continue;
        const who = ev.attackerBoss
          ? 'boss'
          : ev.attackerKind === 'elite'
            ? `elite(${ev.attackerChassis}/${ev.attackerAffix}):${ev.source}`
            : `${ev.attackerKind ?? '-'}:${ev.source}`;
        hits.push({ t, who, hp: ev.hpDamage, after: sim.php });
      }
      let guard = 0;
      while (sim.hasChoice && guard++ < 16) {
        const s: Snapshot = sim.snapshot();
        if (s.mutationOffer) sim.chooseMutation(0);
        else if (s.rewardOffers) sim.chooseReward(pickOfferBy('driver', s, rand));
        else break;
      }
      if (sim.php <= 0) dead = true;
      if (sim.snapshot().finished) break;
    }
    const s = sim.snapshot();
    const t = sim.tick / HZ;
    if (!dead) {
      console.log(`${start}#${seed}: survived (level ${s.player.level})`);
      continue;
    }
    const recent = hits.filter((h) => h.t >= t - windowSec);
    const bySource: Record<string, number> = {};
    for (const h of recent) bySource[h.who] = (bySource[h.who] ?? 0) + h.hp;
    const elites = s.entities
      .filter((e) => e.elite)
      .map((e) => `${e.chassis}/${e.affix}/${e.eliteRarity}${e.clone ? '/clone' : ''} d=${Math.hypot(e.x - s.player.x, e.z - s.player.z).toFixed(1)} hp=${Math.round(e.hp)}`);
    const summoned = s.entities.filter((e) => e.summoned).length;
    const near = s.entities.filter((e) => Math.hypot(e.x - s.player.x, e.z - s.player.z) < 4).length;
    console.log(
      `${start}#${seed}: DIED t=${t.toFixed(1)} level=${s.player.level} maxHp=${s.player.maxHp} ` +
        `near<4=${near} summoned=${summoned}\n  elites: ${elites.join(' | ') || '-'}\n  last ${windowSec}s: ` +
        Object.entries(bySource)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `${k}=${Math.round(v)}`)
          .join(', ') +
        `\n  biggest: ${[...recent].sort((a, b) => b.hp - a.hp).slice(0, 4).map((h) => `${h.who}=${Math.round(h.hp)}@${h.t.toFixed(1)}`).join(', ')}`
    );
  }
}
