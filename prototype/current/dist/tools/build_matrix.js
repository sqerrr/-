import { Simulation } from '../core/simulation.js';
const builds = [
    {
        id: 'close_guard',
        name: 'Close Guard / Barrier',
        strategy: 'close',
        loadout: {
            slots: ['repulse_halo', 'cleaver', 'frost_ring', 'orbit_blades', 'toxic_mist', 'ember_lance'],
            catalysts: ['aegis_relay', 'detonator', 'backflow', 'conduit', 'overflow'],
            level: 7,
            armor: 38,
            maxHp: 300,
            skillControl: 0.34,
            skillStatus: 0.34,
            mutations: {
                repulse_halo: 'repulse_aegis',
                cleaver: 'cleaver_roundhouse',
                frost_ring: 'frost_skin',
                orbit_blades: 'orbit_guard',
                toxic_mist: 'toxic_reactive',
                ember_lance: 'ember_backdraft'
            }
        }
    },
    {
        id: 'thermal_state',
        name: 'State Engine / Thermal',
        strategy: 'balanced',
        loadout: {
            slots: ['ember_lance', 'frost_ring', 'chain_arc', 'rail_spear', 'cleaver', 'repulse_halo'],
            catalysts: ['detonator', 'conduit', 'relay', 'backflow', 'aegis_relay'],
            level: 7,
            skillStatus: 0.38,
            skillControl: 0.26,
            mutations: {
                ember_lance: 'ember_brand',
                frost_ring: 'frost_brittle',
                chain_arc: 'arc_ground',
                rail_spear: 'rail_spot',
                cleaver: 'cleaver_deep',
                repulse_halo: 'repulse_relay'
            }
        }
    },
    {
        id: 'artillery',
        name: 'Artillery / Elite Focus',
        strategy: 'ranged',
        loadout: {
            slots: ['mortar_bloom', 'sentry', 'rail_spear', 'mass_driver', 'ember_lance', 'chain_arc'],
            catalysts: ['echo_shard', 'relay', 'hunter', 'overflow', 'capacitor'],
            level: 7,
            skillRange: 0.38,
            skillElite: 0.32,
            armor: 22,
            mutations: {
                mortar_bloom: 'mortar_cluster',
                sentry: 'sentry_rail',
                rail_spear: 'rail_gun',
                mass_driver: 'mass_terminal',
                ember_lance: 'ember_impaler',
                chain_arc: 'arc_ground'
            }
        }
    },
    {
        id: 'field_control',
        name: 'Fields / Control',
        strategy: 'field',
        loadout: {
            slots: ['toxic_mist', 'frost_ring', 'mortar_bloom', 'repulse_halo', 'sentry', 'chain_arc'],
            catalysts: ['reservoir', 'detonator', 'conduit', 'aegis_relay', 'echo_shard'],
            level: 7,
            skillCoverage: 0.38,
            skillDuration: 0.4,
            skillControl: 0.34,
            skillStatus: 0.38,
            mutations: {
                toxic_mist: 'toxic_contagion',
                frost_ring: 'frost_front',
                mortar_bloom: 'mortar_crater',
                repulse_halo: 'repulse_gravity',
                sentry: 'sentry_crawler',
                chain_arc: 'arc_cage'
            }
        }
    },
    {
        id: 'volley',
        name: 'Volley / Multi-hit',
        strategy: 'ranged',
        loadout: {
            slots: ['ember_lance', 'rail_spear', 'mortar_bloom', 'sentry', 'chain_arc', 'mass_driver'],
            catalysts: ['splitter', 'accelerator', 'relay', 'echo_shard', 'hunter'],
            level: 7,
            skillRange: 0.3,
            armor: 22,
            mutations: {
                ember_lance: 'ember_volley',
                rail_spear: 'rail_fan',
                mortar_bloom: 'mortar_cluster',
                sentry: 'sentry_gatling',
                chain_arc: 'arc_forked',
                mass_driver: 'mass_snowball'
            }
        }
    },
    {
        id: 'mixed_baseline',
        name: 'Mixed Baseline',
        strategy: 'balanced',
        loadout: {
            slots: ['ember_lance', 'frost_ring', 'cleaver', 'chain_arc', 'rail_spear', 'mortar_bloom'],
            catalysts: ['amplifier', 'anchor', 'hunter', 'diffuser', 'executioner'],
            level: 7,
            mutations: {
                ember_lance: 'ember_furnace',
                frost_ring: 'frost_rim',
                cleaver: 'cleaver_hook',
                chain_arc: 'arc_forked',
                rail_spear: 'rail_harpoon',
                mortar_bloom: 'mortar_airburst'
            }
        }
    }
];
function targetOf(s) {
    return [...s.entities].sort((a, b) => Number(b.elite) - Number(a.elite) ||
        Math.hypot(a.x - s.player.x, a.z - s.player.z) -
            Math.hypot(b.x - s.player.x, b.z - s.player.z))[0];
}
function control(s, strategy, t) {
    const e = targetOf(s);
    let ax = Math.cos(t * 0.37), az = Math.sin(t * 0.37), mx = 0, mz = 0;
    if (e) {
        const dx = e.x - s.player.x, dz = e.z - s.player.z, d = Math.hypot(dx, dz) || 1;
        ax = dx / d;
        az = dz / d;
        const side = Math.sin(t * 0.83) > 0 ? 1 : -1;
        const sx = -az * side, sz = ax * side;
        const desired = strategy === 'close' ? 2.25 : strategy === 'field' ? 4.6 : strategy === 'ranged' ? 9.0 : 5.8;
        let radial = 0;
        if (d > desired + 1.1)
            radial = 1;
        else if (d < desired - 0.9)
            radial = -1;
        const strafe = strategy === 'close' ? 0.28 : strategy === 'ranged' ? 0.62 : 0.45;
        mx = ax * radial + sx * strafe;
        mz = az * radial + sz * strafe;
    }
    // Simple common dodge term: avoid only very near visible bolts; this is not build-specific intelligence.
    for (const p of s.projectiles) {
        const dx = s.player.x - p.x, dz = s.player.z - p.z, d = Math.hypot(dx, dz);
        if (d < 2.1 && d > 0.001) {
            mx += (dx / d) * 0.8;
            mz += (dz / d) * 0.8;
        }
    }
    const m = Math.hypot(mx, mz);
    if (m > 1) {
        mx /= m;
        mz /= m;
    }
    return { moveX: mx, moveZ: mz, aimX: ax, aimZ: az };
}
function run(build, seed, duration = 240) {
    const sim = new Simulation({ seed, hz: 30, runDuration: duration, benchmark: true });
    sim.configureBenchmarkLoadout(build.loadout);
    const maxTicks = duration * 30;
    for (let i = 0; i < maxTicks; i++) {
        const s = sim.snapshot();
        sim.step(control(s, build.strategy, s.time));
        if (sim.snapshot().player.hp <= 0 || sim.snapshot().finished)
            break;
    }
    const s = sim.snapshot(), tel = sim.telemetry();
    return {
        build: build.id,
        seed,
        survival: s.time,
        finished: s.finished,
        hp: s.player.hp,
        kills: s.metrics.killed,
        eliteKills: s.metrics.eliteKilled,
        damage: s.metrics.damage,
        eliteDamage: s.metrics.eliteDamage,
        damageTaken: s.metrics.damageTaken,
        healing: s.metrics.healingReceived,
        barrier: s.metrics.barrierGenerated,
        reactions: s.metrics.reactions,
        avgEnemies: tel.avgEnemies,
        maxEnemies: s.metrics.maxEnemies,
        shots: s.metrics.enemyShotsSpawned,
        shotHits: s.metrics.enemyShotsHit,
        damageBySource: tel.damageBySource,
        killsBySource: tel.killsBySource
    };
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const median = (a) => {
    const b = [...a].sort((x, y) => x - y);
    return b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2;
};
const seeds = [101, 202, 303, 404, 505];
const all = [];
for (const b of builds)
    for (const seed of seeds)
        all.push(run(b, seed));
const summary = builds.map((b) => {
    const rs = all.filter((x) => x.build === b.id);
    const merged = {};
    for (const r of rs)
        for (const [k, v] of Object.entries(r.damageBySource))
            merged[k] = (merged[k] ?? 0) + v;
    const total = Object.values(merged).reduce((a, v) => a + v, 0) || 1;
    const contrib = Object.entries(merged)
        .map(([k, v]) => [k, v / total])
        .sort((a, b) => b[1] - a[1]);
    const activeContrib = b.loadout.slots.map((id) => [id, (merged[id] ?? 0) / total]);
    return {
        id: b.id,
        name: b.name,
        survivalMedian: +median(rs.map((r) => r.survival)).toFixed(1),
        finishRate: +(rs.filter((r) => r.finished).length / rs.length).toFixed(2),
        killsMean: +mean(rs.map((r) => r.kills)).toFixed(1),
        eliteKillsMean: +mean(rs.map((r) => r.eliteKills)).toFixed(1),
        damageMean: +mean(rs.map((r) => r.damage)).toFixed(0),
        eliteDamageMean: +mean(rs.map((r) => r.eliteDamage)).toFixed(0),
        damageTakenMean: +mean(rs.map((r) => r.damageTaken)).toFixed(0),
        healingMean: +mean(rs.map((r) => r.healing)).toFixed(0),
        barrierMean: +mean(rs.map((r) => r.barrier)).toFixed(0),
        reactionsMean: +mean(rs.map((r) => r.reactions)).toFixed(1),
        avgEnemies: +mean(rs.map((r) => r.avgEnemies)).toFixed(1),
        maxEnemies: +mean(rs.map((r) => r.maxEnemies)).toFixed(0),
        enemyShots: +mean(rs.map((r) => r.shots)).toFixed(0),
        shotHitRate: +(rs.reduce((n, r) => n + r.shotHits, 0) /
            Math.max(1, rs.reduce((n, r) => n + r.shots, 0))).toFixed(3),
        topSources: contrib.slice(0, 5).map(([k, v]) => `${k}:${Math.round(v * 100)}%`),
        activeSkillShares: Object.fromEntries(activeContrib.map(([k, v]) => [k, +v.toFixed(3)]))
    };
});
const dmg = summary.map((x) => x.damageMean), kill = summary.map((x) => x.killsMean);
const ratio = Math.max(...dmg) / Math.max(1, Math.min(...dmg)), killRatio = Math.max(...kill) / Math.max(1, Math.min(...kill));
const diagnostics = [];
if (ratio < 1.15)
    diagnostics.push({
        severity: 'WARN',
        text: `Build damage spread is only ${ratio.toFixed(2)}x: archetypes are too similar.`
    });
if (ratio > 3.2)
    diagnostics.push({
        severity: 'WARN',
        text: `Build damage spread is ${ratio.toFixed(2)}x: at least one archetype is probably non-viable or overtuned.`
    });
if (killRatio > 3.0)
    diagnostics.push({ severity: 'WARN', text: `Kill spread ${killRatio.toFixed(2)}x is too wide.` });
for (const x of summary) {
    for (const [skill, share] of Object.entries(x.activeSkillShares))
        if (share < 0.015)
            diagnostics.push({
                severity: 'WARN',
                text: `${x.name}: ${skill} contributes only ${(share * 100).toFixed(1)}% direct damage; verify support value or redesign.`
            });
    if (x.survivalMedian < 120)
        diagnostics.push({
            severity: 'WARN',
            text: `${x.name} dies too early (${x.survivalMedian}s median).`
        });
    if (x.topSources[0]?.endsWith(':100%'))
        diagnostics.push({ severity: 'WARN', text: `${x.name} is effectively a one-skill build.` });
}
const out = {
    duration: 240,
    hz: 30,
    seeds,
    summary,
    spread: { damageRatio: +ratio.toFixed(2), killRatio: +killRatio.toFixed(2) },
    diagnostics
};
console.log(JSON.stringify(out, null, 2));
if (process.argv.includes('--assert')) {
    if (summary.some((x) => x.survivalMedian < 80))
        throw new Error('at least one curated build is functionally dead');
    if (ratio < 1.08)
        throw new Error('build identities collapsed: damage spread too narrow');
    if (ratio > 4.5)
        throw new Error('build viability spread too wide');
}
