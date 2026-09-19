import { Simulation } from '../core/simulation.js';
const hz = 60;
const buildDefs = [
    {
        name: 'melee', preferredRange: 2.35,
        doctrines: { might: 2, size: 4, quantity: 1, duration: 1, mobility: 3, guard: 4, force: 4, precision: 1 },
        loadout: {
            slots: ['cleaver', 'orbit_blades', 'frost_ring', 'tether_drag'], catalysts: [], level: 7,
            globalPower: 0.35, tempo: 0.2, armor: 28, maxHp: 100000, moveSpeed: 5.2,
            skillPower: 0.28, skillCoverage: 0.24, skillRange: 0.2, skillDuration: 0.22, skillControl: 0.2, skillStatus: 0.24, skillElite: 0.12,
            mutations: { cleaver: 'cleaver_roundhouse', orbit_blades: 'orbit_many', frost_ring: 'frost_snap', tether_drag: 'tether_hook' },
            mutationUpgrades: { cleaver: 'cleaver_rhythm', orbit_blades: 'orbit_guard', frost_ring: 'frost_skin', tether_drag: 'tether_anchor' },
            mutationApotheoses: { cleaver: 'cleaver_harvest_dance', orbit_blades: 'orbit_aegis_crown', frost_ring: 'frost_glacier_heart', tether_drag: 'gravity_singularity' }
        }
    },
    {
        name: 'ranged', preferredRange: 9.2,
        doctrines: { might: 3, size: 0, quantity: 4, duration: 2, mobility: 1, guard: 0, force: 0, precision: 4 },
        loadout: {
            slots: ['rail_spear', 'shard_fan', 'sentry', 'chain_arc'], catalysts: [], level: 7,
            globalPower: 0.35, tempo: 0.2, armor: 28, maxHp: 100000, moveSpeed: 5.2,
            skillPower: 0.28, skillCoverage: 0.24, skillRange: 0.2, skillDuration: 0.22, skillControl: 0.2, skillStatus: 0.24, skillElite: 0.12,
            mutations: { rail_spear: 'rail_gun', shard_fan: 'fan_tight', sentry: 'sentry_rail', chain_arc: 'arc_capacitive' },
            mutationUpgrades: { rail_spear: 'rail_spot', shard_fan: 'fan_needle', sentry: 'sentry_salvager', chain_arc: 'arc_relay' },
            mutationApotheoses: { rail_spear: 'rail_sky_lance', shard_fan: 'returner_execution', sentry: 'sentry_hunter_battery', chain_arc: 'arc_living_circuit' }
        }
    },
    {
        name: 'control', preferredRange: 6.2,
        doctrines: { might: 2, size: 3, quantity: 2, duration: 4, mobility: 2, guard: 1, force: 3, precision: 0 },
        loadout: {
            slots: ['frost_ring', 'toxic_mist', 'chain_arc', 'mass_driver'], catalysts: [], level: 7,
            globalPower: 0.35, tempo: 0.2, armor: 28, maxHp: 100000, moveSpeed: 5.2,
            skillPower: 0.28, skillCoverage: 0.24, skillRange: 0.2, skillDuration: 0.22, skillControl: 0.2, skillStatus: 0.24, skillElite: 0.12,
            mutations: { frost_ring: 'frost_rim', toxic_mist: 'toxic_distilled', chain_arc: 'arc_ground', mass_driver: 'mass_rail' },
            mutationUpgrades: { frost_ring: 'frost_brittle', toxic_mist: 'toxic_still', chain_arc: 'arc_groundloop', mass_driver: 'mass_terminal' },
            mutationApotheoses: { frost_ring: 'frost_spirefall', toxic_mist: 'toxic_pestilent_host', chain_arc: 'arc_closed_loop', mass_driver: 'mass_singularity' }
        }
    }
];
function setup(build, seed, affix) {
    const sim = new Simulation({ seed, hz, runDuration: 480, benchmark: true, mode: 'clean' });
    sim.configureBenchmarkLoadout(build.loadout);
    Object.assign(sim.doctrines, build.doctrines);
    // Mid-run combat state, but with all unrelated directors silenced.
    sim.tick = 180 * hz;
    sim.spawnCredits = -1e9;
    sim.eliteAcc = -1e9;
    sim.firstElite = true;
    sim.bossSpawned = true;
    sim.relicAcc = -1e9;
    sim.pois = [];
    sim.obstacles = [];
    sim.obstacleGrid = new Map();
    sim.ents = [];
    sim.px = 0;
    sim.pz = 0;
    sim.aimX = 1;
    sim.aimZ = 0;
    sim.spawnElite();
    const elite = sim.ents.find((e) => e.kind === 'elite');
    elite.chassis = 'hunter';
    elite.affix = affix;
    elite.rarity = 'common';
    elite.x = 7.5;
    elite.z = 0;
    elite.speed = 1.42;
    elite.contactDps = 31;
    elite.maxHp = elite.hp = 4000;
    elite.repertoire = [];
    elite.cooldown = 0.4;
    elite.affixPulse = affix === 'shielded' ? 0.3 : 99;
    elite.shieldAngle = Math.PI;
    elite.shieldState = affix === 'shielded' ? 'guard' : undefined;
    elite.shieldStability = 100;
    // Clear random spawn bookkeeping/events from constructing the isolated subject.
    sim.refusalStore = [];
    sim.eliteEchoes.clear();
    sim.events.length = 0;
    return { sim, elite };
}
function drive(sim, elite, build, frame) {
    const dx = elite.x - sim.px, dz = elite.z - sim.pz, d = Math.hypot(dx, dz) || 1;
    const nx = dx / d, nz = dz / d;
    const tangentX = -nz, tangentZ = nx;
    const err = d - build.preferredRange;
    let radial = Math.max(-0.92, Math.min(0.92, err * 0.8));
    // Always keep some lateral motion so directional mechanics are tested rather than face-tanked.
    const orbit = ((Math.floor(frame / (hz * 4)) % 2) === 0 ? 1 : -1) * 0.62;
    let moveX = nx * radial + tangentX * orbit, moveZ = nz * radial + tangentZ * orbit;
    const mm = Math.hypot(moveX, moveZ) || 1;
    moveX /= mm;
    moveZ /= mm;
    const danger = build.name === 'melee' ? 1.35 : build.name === 'control' ? 2.5 : 3.3;
    const dash = d < danger && frame % 22 === 0;
    sim.step({ moveX, moveZ, aimX: nx, aimZ: nz, dash });
}
function run(build, seed, affix) {
    const { sim, elite } = setup(build, seed, affix);
    const hp0 = sim.php;
    let shieldBreaks = 0;
    const start = sim.time;
    const maxFrames = 45 * hz;
    for (let i = 0; i < maxFrames && elite.hp > 0; i++) {
        drive(sim, elite, build, i);
        for (const ev of sim.events)
            if (ev.type === 'RareEvent' && ev.title === 'ЩИТ СЛОМАН')
                shieldBreaks++;
    }
    const tele = sim.telemetry();
    return {
        build: build.name, affix, seed, killed: elite.hp <= 0, seconds: sim.time - start,
        damageTaken: hp0 - sim.php, barrierGenerated: sim.metrics.barrierGenerated, shieldBreaks,
        damageBySource: tele.damageBySource
    };
}
const seeds = [1101, 2202, 3303, 4404, 5505];
const affixes = ['none', 'shielded'];
const rows = [];
for (const affix of affixes)
    for (const build of buildDefs)
        for (const seed of seeds)
            rows.push(run(build, seed, affix));
const median = (xs) => { const a = [...xs].sort((x, y) => x - y), h = a.length >> 1; return a.length % 2 ? a[h] : (a[h - 1] + a[h]) / 2; };
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const r = (n) => Math.round(n * 10) / 10;
console.log('=== v0.11 isolated elite lab ===');
console.log('same 4000 HP hunter, mid-run clock, no trash/refusals/POIs; natural build spacing');
for (const affix of affixes) {
    console.log(`\n[${affix}]`);
    for (const build of buildDefs) {
        const q = rows.filter(x => x.affix === affix && x.build === build.name), killed = q.filter(x => x.killed);
        const merged = {};
        for (const x of q)
            for (const [k, v] of Object.entries(x.damageBySource))
                merged[k] = (merged[k] ?? 0) + v;
        const top = Object.entries(merged).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k}:${r(v / q.length)}`).join(', ');
        console.log(`${build.name.padEnd(8)} killed=${killed.length}/${q.length} ttk med=${killed.length ? r(median(killed.map(x => x.seconds))) : '-'}s dmgTaken avg=${r(avg(q.map(x => x.damageTaken)))} barrier=${r(avg(q.map(x => x.barrierGenerated)))} breaks=${q.reduce((s, x) => s + x.shieldBreaks, 0)} top=[${top}]`);
    }
}
if (process.argv.includes('--assert')) {
    const open = rows.filter(x => x.affix === 'none' && x.killed);
    const med = (name) => median(open.filter(x => x.build === name).map(x => x.seconds));
    if (!['melee', 'ranged', 'control'].every(n => open.filter(x => x.build === n).length === seeds.length)) {
        console.error('one archetype cannot kill the isolated elite');
        process.exit(1);
    }
    // This is intentionally generous: it catches a return to “ranged is several times better” without forcing exact tuning.
    const times = ['melee', 'ranged', 'control'].map(med), ratio = Math.max(...times) / Math.max(0.01, Math.min(...times));
    if (ratio > 2.0) {
        console.error(`archetype elite TTK spread too wide: ${ratio.toFixed(2)}x`);
        process.exit(1);
    }
}
