import { catalysts, skills } from '../content/definitions.js';
const cellFor = {
    player: 0, footnote: 1, bookmark: 2, binder: 3, palimpsest: 4, inkblot: 5, marginwalker: 6, marshal: 7, hunter: 8, redactor: 9, indexer: 10, bulwark: 11, architect: 12, harvester: 13, shepherd: 14, xp: 15, core: 16, heal: 17, bullet: 18, white: 19, sentry: 20, broodmaker: 21, archivist: 22, warden: 11
};
const rgba = (hex, a = 1) => { const h = hex.replace('#', ''); return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255, a]; };
export class WebGLRenderer {
    canvas;
    gl;
    atlas;
    floorTex;
    groundProgram;
    spriteProgram;
    shapeProgram;
    lineProgram;
    spriteVao;
    spriteInstance;
    shapeVao;
    shapeInstance;
    lineVao;
    lineBuffer;
    fx = [];
    combatFx = [];
    mutatedSkills = new Set();
    lastPlayerX = 0;
    lastPlayerZ = 0;
    lastPlayerAnimTime = 0;
    playerMoveBlend = 0;
    cssW = 1;
    cssH = 1;
    dpr = 1;
    isoX = 34;
    isoY = 17;
    centerX = .5;
    centerY = .52;
    zoom = 1.16;
    spriteData = new Float32Array(0);
    shapeData = new Float32Array(0);
    lineData = new Float32Array(0);
    constructor(canvas) {
        this.canvas = canvas;
        const gl = canvas.getContext('webgl2', { alpha: false, antialias: true, premultipliedAlpha: false, powerPreference: 'high-performance' });
        if (!gl)
            throw new Error('WebGL2 недоступен в этом браузере.');
        this.gl = gl;
        this.groundProgram = this.program(GROUND_VS, GROUND_FS);
        this.spriteProgram = this.program(SPRITE_VS, SPRITE_FS);
        this.shapeProgram = this.program(SHAPE_VS, SHAPE_FS);
        this.lineProgram = this.program(LINE_VS, LINE_FS);
        [this.spriteVao, this.spriteInstance] = this.makeSpriteVao();
        [this.shapeVao, this.shapeInstance] = this.makeShapeVao();
        [this.lineVao, this.lineBuffer] = this.makeLineVao();
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.DEPTH_TEST);
    }
    async load() { const [atlas, floor] = await Promise.all([this.loadTexture('/assets/atlas.png'), this.loadTexture('/assets/archive_floor.jpg', true)]); this.atlas = atlas; this.floorTex = floor; }
    reset() { this.fx = []; this.combatFx = []; this.lastPlayerX = 0; this.lastPlayerZ = 0; this.lastPlayerAnimTime = 0; this.playerMoveBlend = 0; }
    get rendererName() { const gl = this.gl; const ext = gl.getExtension('WEBGL_debug_renderer_info'); return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)); }
    get zoomLevel() { return this.zoom; }
    adjustZoom(delta) { this.zoom = Math.max(.82, Math.min(1.48, this.zoom + delta)); }
    consume(cues, s) {
        const mutated = (id) => s ? !!s.skills.find(x => x.id === id)?.mutation : this.mutatedSkills.has(id);
        for (const e of cues) {
            const time = e.time;
            if (e.type === 'combatShape') {
                const ttl = e.source.startsWith('telegraph_') ? .92 : e.intent === 'field' ? .30 : e.intent === 'control' ? .30 : .20;
                this.combatFx.push({ start: time, ttl, source: e.source, intent: e.intent, shape: e.shape });
                continue;
            }
            if (e.type === 'skillCast') {
                const evo = mutated(e.skill), st = s?.skills.find(x => x.id === e.skill), multi = s?.resonance.multiplicity ?? 0, scale = 1;
                const geom = st ? (st.level >= 6 ? 1.28 : st.level >= 3 ? 1.12 : 1) : 1;
                if (e.skill === 'ember_lance') {
                    const n = Math.max(1, Math.round(st?.count ?? 1) + (st && st.level >= 7 ? 1 : 0) + Math.min(3, multi)), range = (skills.ember_lance.baseRange * (1 + (st?.range ?? 0)) * (st && st.level >= 6 ? 1.16 : st && st.level >= 3 ? 1.07 : 1));
                    for (let i = 0; i < n; i++) {
                        const a = (i - (n - 1) / 2) * .085, c = Math.cos(a), q = Math.sin(a), ax = e.aimX * c - e.aimZ * q, az = e.aimX * q + e.aimZ * c;
                        this.fx.push({ kind: 'bolt', start: time + i * .018, ttl: .24, x1: e.x, z1: e.z, x2: e.x + ax * range, z2: e.z + az * range, r: .22 + (st?.coverage ?? 0) * .08, color: rgba(evo ? '#ffd06f' : '#ff8a34', .95) });
                        this.fx.push({ kind: 'beam', start: time + i * .018, ttl: .15, x1: e.x, z1: e.z, x2: e.x + ax * range, z2: e.z + az * range, width: evo ? 4 : 2, color: rgba('#ff9a45', .20) });
                    }
                }
                if (e.skill === 'rail_spear') {
                    this.fx.push({ kind: 'beam', start: time, ttl: evo ? .38 : .26, x1: e.x, z1: e.z, x2: e.x + e.aimX * (evo ? 21 : 17), z2: e.z + e.aimZ * (evo ? 21 : 17), width: evo ? 17 : 11, color: rgba(evo ? '#ff77d5' : '#ff4fba', evo ? .78 : .62) });
                    if (evo)
                        this.fx.push({ kind: 'ring', start: time, ttl: .34, x: e.x, z: e.z, r: 1.25, color: rgba('#ffc6ef', .80) });
                }
                if (e.skill === 'frost_ring') {
                    const r = skills.frost_ring.baseRadius * Math.sqrt(1 + (st?.coverage ?? 0)) * geom * scale, waves = 1 + Math.min(2, multi);
                    for (let i = 0; i < waves; i++) {
                        const rr = r * (1 + i * .17);
                        this.fx.push({ kind: 'ring', start: time + i * .10, ttl: .62 + i * .06, x: e.x, z: e.z, r: rr, color: rgba(i ? '#c8f5ff' : '#78d7ff', i ? .65 : .96) });
                    }
                    this.fx.push({ kind: 'pulse', start: time + .04, ttl: .42, x: e.x, z: e.z, r: r * .72, color: rgba('#d7f7ff', .30) });
                }
                if (e.skill === 'cleaver') {
                    const r = skills.cleaver.baseRadius * Math.sqrt(1 + (st?.coverage ?? 0)) * geom * scale, sweeps = 1 + Math.min(2, multi);
                    for (let i = 0; i < sweeps; i++)
                        this.fx.push({ kind: 'slash', start: time + i * .075, ttl: .32, x: e.x, z: e.z, aimX: e.aimX, aimZ: e.aimZ, r: r * (1 + i * .05), color: rgba(i ? '#ffd3ab' : '#f4f0e8', i ? .50 : .96) });
                }
                if (e.skill === 'orbit_blades') {
                    const r = skills.orbit_blades.baseRadius * Math.sqrt(1 + (st?.coverage ?? 0)) * geom * scale;
                    this.fx.push({ kind: 'ring', start: time, ttl: .34, x: e.x, z: e.z, r, color: rgba(evo ? '#88fff1' : '#60e6bd', .70) });
                }
                if (e.skill === 'mortar_bloom') {
                    const range = skills.mortar_bloom.baseRange * (1 + (st?.range ?? 0)), d = Math.min(range * .72, 12.5), tx = e.x + e.aimX * d, tz = e.z + e.aimZ * d, r = skills.mortar_bloom.baseRadius * Math.sqrt(1 + (st?.coverage ?? 0)) * geom * scale, n = Math.max(1, Math.round(st?.count ?? 1) + Math.min(3, multi));
                    for (let i = 0; i < n; i++) {
                        const a = i ? i * 2.399 : 0, rr = i ? Math.min(1.4, r * .38) : 0;
                        this.fx.push({ kind: 'ring', start: time + i * .045, ttl: .82, x: tx + Math.cos(a) * rr, z: tz + Math.sin(a) * rr, r, color: rgba('#ffb16a', i ? .62 : .92) });
                    }
                    this.fx.push({ kind: 'beam', start: time, ttl: .48, x1: e.x, z1: e.z, x2: tx, z2: tz, width: 2, color: rgba('#ffcb91', .36) });
                }
                if (e.skill === 'sentry') {
                    this.fx.push({ kind: 'pulse', start: time, ttl: .42, x: e.x, z: e.z, r: 1.4 + Math.min(1.2, multi * .24), color: rgba('#5be7c5', .72) });
                }
                if (e.skill === 'toxic_mist') {
                    const r = skills.toxic_mist.baseRadius * Math.sqrt(1 + (st?.coverage ?? 0)) * geom * scale;
                    this.fx.push({ kind: 'ring', start: time, ttl: .72, x: e.x, z: e.z, r, color: rgba('#78df6e', .62) });
                    if (multi)
                        this.fx.push({ kind: 'ring', start: time + .10, ttl: .82, x: e.x - e.aimX * .8, z: e.z - e.aimZ * .8, r: r * .82, color: rgba('#b2ff77', .34) });
                }
                if (e.skill === 'repulse_halo') {
                    this.fx.push({ kind: 'ring', start: time, ttl: evo ? .62 : .44, x: e.x, z: e.z, r: evo ? 3.8 : 3.0, color: rgba(evo ? '#b9f5ff' : '#78dfff', .88) });
                    this.fx.push({ kind: 'pulse', start: time + .03, ttl: evo ? .48 : .32, x: e.x, z: e.z, r: evo ? 2.5 : 1.8, color: rgba('#7fd6ff', .28) });
                }
                if (e.skill === 'mass_driver') {
                    this.fx.push({ kind: 'beam', start: time, ttl: evo ? .58 : .42, x1: e.x, z1: e.z, x2: e.x + e.aimX * (evo ? 24 : 19), z2: e.z + e.aimZ * (evo ? 24 : 19), width: evo ? 24 : 15, color: rgba(evo ? '#ffd26f' : '#b76cff', evo ? .68 : .48) });
                    this.fx.push({ kind: 'pulse', start: time, ttl: evo ? .48 : .34, x: e.x, z: e.z, r: evo ? 1.7 : 1.1, color: rgba(evo ? '#ffe1a4' : '#d9b4ff', .84) });
                }
            }
            else if (e.type === 'catalyst') {
                const color = rgba(catalysts[e.catalyst].color, .92);
                this.fx.push({ kind: 'beam', start: time, ttl: .28, x1: e.sourceX, z1: e.sourceZ, x2: e.targetX, z2: e.targetZ, width: 4, color });
                this.fx.push({ kind: 'ring', start: time + .02, ttl: .42, x: e.targetX, z: e.targetZ, r: 1.35, color: [color[0], color[1], color[2], .82] });
            }
            else if (e.type === 'damage') {
                if (e.source === 'ember_lance')
                    this.fx.push({ kind: 'beam', start: time, ttl: .13, x1: e.sourceX, z1: e.sourceZ, x2: e.x, z2: e.z, width: 5, color: rgba('#ff9844', .95) });
                else if (e.source === 'rail_spear')
                    this.fx.push({ kind: 'beam', start: time, ttl: .20, x1: e.sourceX, z1: e.sourceZ, x2: e.x, z2: e.z, width: 8, color: rgba('#ff55ba', .98) });
                else if (e.source === 'mass_driver')
                    this.fx.push({ kind: 'beam', start: time, ttl: .22, x1: e.sourceX, z1: e.sourceZ, x2: e.x, z2: e.z, width: 12, color: rgba('#c177ff', .95) });
                else if (e.source === 'sentry')
                    this.fx.push({ kind: 'beam', start: time, ttl: .10, x1: e.sourceX, z1: e.sourceZ, x2: e.x, z2: e.z, width: 3, color: rgba('#5be7c5', .88) });
                else if (e.source === 'mortar_bloom')
                    this.fx.push({ kind: 'pulse', start: time, ttl: .30, x: e.x, z: e.z, r: 1.2, color: rgba('#ff9c55', .78) });
                else if (e.source === 'chain_arc')
                    this.fx.push({ kind: 'beam', start: time, ttl: .11, x1: e.sourceX, z1: e.sourceZ, x2: e.x, z2: e.z, width: 3, color: rgba('#68cfff', .88) });
                if (e.crit)
                    this.fx.push({ kind: 'pulse', start: time, ttl: .25, x: e.x, z: e.z, r: .75, color: rgba('#fff2a8', .9) });
            }
            else if (e.type === 'reaction') {
                if (e.reaction === 'thermal_shock') {
                    this.fx.push({ kind: 'ring', start: time, ttl: .42, x: e.x, z: e.z, r: 2.1, color: rgba('#a9e9ff', .92) });
                    this.fx.push({ kind: 'pulse', start: time, ttl: .32, x: e.x, z: e.z, r: 1.45, color: rgba('#ff9b4a', .68) });
                }
                else if (e.reaction === 'detonation')
                    this.fx.push({ kind: 'pulse', start: time, ttl: .38, x: e.x, z: e.z, r: 1.8, color: rgba('#ff8650', .82) });
                else if (e.reaction === 'conduit')
                    this.fx.push({ kind: 'ring', start: time, ttl: .34, x: e.x, z: e.z, r: 1.5, color: rgba('#76edd6', .76) });
                else if (e.reaction === 'echo')
                    this.fx.push({ kind: 'ring', start: time, ttl: .46, x: e.x, z: e.z, r: 2.0, color: rgba('#96ddff', .72) });
                else if (e.reaction === 'aegis')
                    this.fx.push({ kind: 'ring', start: time, ttl: .50, x: e.x, z: e.z, r: 1.65, color: rgba('#74cfff', .92) });
            }
            else if (e.type === 'eliteSpawn') {
                const c = e.chassis === 'marshal' ? rgba('#ffbd62', .82) : e.chassis === 'hunter' ? rgba('#ff557d', .82) : e.chassis === 'bulwark' ? rgba('#72c8ff', .82) : e.chassis === 'architect' ? rgba('#78edff', .82) : e.chassis === 'harvester' ? rgba('#ff8c4d', .82) : e.chassis === 'shepherd' ? rgba('#92ee73', .82) : e.chassis === 'broodmaker' ? rgba('#d75bc2', .82) : rgba('#a5bfff', .82);
                this.fx.push({ kind: 'ring', start: time, ttl: 1.15, x: e.x, z: e.z, r: 3.6, color: c });
                this.fx.push({ kind: 'pulse', start: time + .08, ttl: .90, x: e.x, z: e.z, r: 2.2, color: [c[0], c[1], c[2], .38] });
            }
            else if (e.type === 'eliteAdapted')
                this.fx.push({ kind: 'ring', start: time, ttl: 1.0, x: e.x, z: e.z, r: 3.2, color: e.adaptation === 'screening' ? rgba('#5bbcff', .9) : e.adaptation === 'repulsor' ? rgba('#ff7d52', .9) : e.adaptation === 'intercept' ? rgba('#ff4f91', .9) : rgba('#7fe46f', .9) });
            else if (e.type === 'death' && e.elite) {
                this.fx.push({ kind: 'ring', start: time, ttl: .85, x: e.x, z: e.z, r: 4.1, color: rgba('#ffb15a', .9) });
                this.fx.push({ kind: 'pulse', start: time, ttl: .55, x: e.x, z: e.z, r: 2.2, color: rgba('#fff0c4', .48) });
            }
            else if (e.type === 'playerHit')
                this.fx.push({ kind: 'pulse', start: time, ttl: .18, x: e.x, z: e.z, r: 1.1, color: rgba('#ff5566', .55) });
            else if (e.type === 'eliteOrder') {
                const order = e.order;
                const c = order === 'surge' ? rgba('#ffc45b', .78) : order === 'pack' ? rgba('#ff4f7f', .82) : order === 'screen' ? rgba('#70c9ff', .78) : order === 'wall' ? rgba('#78e7ff', .78) : order === 'harvest' ? rgba('#ff8c4d', .78) : order === 'regroup' ? rgba('#8fe874', .78) : order === 'brood' ? rgba('#d55ac7', .80) : rgba('#9eafff', .80);
                const r = order === 'surge' ? 7.8 : order === 'regroup' ? 6.8 : order === 'screen' ? 6.4 : 4.2;
                this.fx.push({ kind: 'ring', start: time, ttl: .88, x: e.x, z: e.z, r, color: c });
                this.fx.push({ kind: 'ring', start: time + .12, ttl: .70, x: e.x, z: e.z, r: r * .62, color: [c[0], c[1], c[2], c[3] * .62] });
            }
        }
    }
    screenAim(clientX, clientY) { const r = this.canvas.getBoundingClientRect(); const sx = clientX - r.left - r.width * this.centerX, sy = clientY - r.top - r.height * this.centerY; const a = sx / Math.max(1, this.isoX), b = sy / Math.max(1, this.isoY); const x = (a + b) / 2, z = (b - a) / 2, m = Math.hypot(x, z) || 1; return { x: x / m, z: z / m }; }
    worldToScreen(x, z, s) { const dx = x - s.player.x, dz = z - s.player.z; return { x: this.cssW * this.centerX + (dx - dz) * this.isoX, y: this.cssH * this.centerY + (dx + dz) * this.isoY }; }
    combatColor(source, intent, alpha = 1) { const c = source === 'ember_lance' || source === 'mortar_bloom' ? rgba('#ff9a4d', alpha) : source === 'rail_spear' ? rgba('#ff65c8', alpha) : source === 'mass_driver' ? rgba('#c483ff', alpha) : source === 'frost_ring' || source === 'repulse_halo' ? rgba('#72dcff', alpha) : source === 'toxic_mist' ? rgba('#86e46b', alpha) : source === 'cleaver' ? rgba('#fff0d6', alpha) : source === 'orbit_blades' ? rgba('#77f5d8', alpha) : intent === 'control' ? rgba('#8fdcff', alpha) : rgba('#f2e5d6', alpha); return c; }
    draw(s, aim, presentation) {
        this.mutatedSkills = new Set(s.skills.filter(x => !!x.mutation).map(x => x.id));
        this.resize();
        const gl = this.gl;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(.025, .035, .046, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.drawGround(s);
        this.drawWorldShapes(s, aim, presentation);
        this.drawLines(s, aim);
        this.drawSprites(s, presentation);
        this.fx = this.fx.filter(f => s.time - f.start < f.ttl + .05);
        this.combatFx = this.combatFx.filter(f => s.time - f.start < f.ttl + .05);
    }
    resize() { const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1)), w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr)), h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr)); if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
    } this.dpr = dpr; this.cssW = this.canvas.clientWidth; this.cssH = this.canvas.clientHeight; this.isoX = Math.max(30, Math.min(43, this.cssW / 44)) * this.zoom; this.isoY = this.isoX * .50; }
    commonUniforms(p, s) { const gl = this.gl; gl.uniform2f(gl.getUniformLocation(p, 'u_resolution'), this.cssW, this.cssH); gl.uniform2f(gl.getUniformLocation(p, 'u_camera'), s.player.x, s.player.z); gl.uniform2f(gl.getUniformLocation(p, 'u_iso'), this.isoX, this.isoY); gl.uniform2f(gl.getUniformLocation(p, 'u_center'), this.centerX, this.centerY); }
    drawGround(s) { const gl = this.gl, p = this.groundProgram; gl.useProgram(p); this.commonUniforms(p, s); gl.uniform1f(gl.getUniformLocation(p, 'u_time'), s.time); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.floorTex); gl.uniform1i(gl.getUniformLocation(p, 'u_floor'), 1); gl.bindVertexArray(null); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    drawWorldShapes(s, aim, presentation) {
        const shapes = [];
        for (const f of s.fields) {
            const c = f.kind === 'ink' ? rgba('#5a245f', .42) : f.kind === 'fire' ? rgba('#ff7a32', .30) : f.kind === 'frost' ? rgba('#57cfff', .25) : f.kind === 'toxic' ? rgba('#66c95c', .34) : f.kind === 'index' ? rgba('#5a90d8', .23) : f.kind === 'architect' ? rgba('#aa5de8', .30) : f.kind === 'veil' ? rgba('#665a8f', .38) : rgba('#62aaff', .24);
            shapes.push({ x: f.x, z: f.z, r: f.radius, mode: 0, color: c });
            shapes.push({ x: f.x, z: f.z, r: f.radius, mode: 1, color: [c[0], c[1], c[2], Math.min(.42, c[3] + .10)] });
        }
        for (const f of this.combatFx) {
            const t = (s.time - f.start) / f.ttl;
            if (t < 0 || t > 1 || f.shape.kind !== 'circle')
                continue;
            const c = this.combatColor(f.source, f.intent, (1 - t) * .72), q = f.shape;
            shapes.push({ x: q.x, z: q.z, r: q.radius, mode: 0, color: [c[0], c[1], c[2], c[3] * .14] });
            shapes.push({ x: q.x, z: q.z, r: q.radius, mode: 1, color: c });
        }
        for (const h of presentation.hits) {
            const t = (s.time - h.start) / h.ttl;
            if (t < 0 || t > 1)
                continue;
            const a = (1 - t) * (.62 + .20 * Math.min(1, h.intensity)), c = h.crit ? rgba('#fff3a8', a) : rgba('#fff8ee', a);
            shapes.push({ x: h.x, z: h.z, r: h.radius, mode: 1, color: c });
        }
        // target direction marker, not a movement target
        shapes.push({ x: s.player.x + aim.x * 5.5, z: s.player.z + aim.z * 5.5, r: .34, mode: 1, color: rgba('#8fffdc', .80) });
        for (const p of s.world.pois) {
            if (p.state === 'cleared')
                continue;
            const c = p.kind === 'phenomenon' ? rgba('#ff9b4a', .72) : p.kind === 'catalyst' ? rgba('#c27aff', .72) : p.kind === 'resonance' ? rgba('#67d9ff', .72) : rgba('#63f0a5', .80), pulse = 1 + .08 * Math.sin(s.time * 3 + p.id);
            shapes.push({ x: p.x, z: p.z, r: 2.0 * pulse, mode: 1, color: c });
            shapes.push({ x: p.x, z: p.z, r: .62, mode: 0, color: [c[0], c[1], c[2], .22] });
            if (s.world.bossSpawned) {
                shapes.push({ x: p.x, z: p.z, r: 2.55 + .18 * Math.sin(s.time * 5 + p.id), mode: 1, color: rgba('#ff545f', .58) });
            }
        }
        // Healing is deliberately loud: rare sustain should be readable through swarm/VFX clutter.
        for (const p of s.pickups) {
            if (p.kind !== 'heal')
                continue;
            const pulse = 1 + .12 * Math.sin(s.time * 5.2 + p.id);
            shapes.push({ x: p.x, z: p.z, r: 1.15 * pulse, mode: 1, color: rgba('#6dff9d', .92) });
            shapes.push({ x: p.x, z: p.z, r: .42, mode: 0, color: rgba('#c8ffdb', .34) });
        }
        for (const e of s.entities) {
            if (e.status.marked)
                shapes.push({ x: e.x, z: e.z, r: e.radius + .30, mode: 1, color: rgba('#ff9b44', .55) });
            if (e.status.chilled)
                shapes.push({ x: e.x, z: e.z, r: e.radius + .18, mode: 1, color: rgba('#7adfff', .40) });
            // Chassis influence must be visible even before the player reads any UI.
            if (e.elite && e.chassis === 'marshal')
                shapes.push({ x: e.x, z: e.z, r: 7.0, mode: 1, color: rgba('#ffb448', .24) });
            if (e.elite && e.chassis === 'hunter')
                shapes.push({ x: e.x, z: e.z, r: 1.75, mode: 1, color: rgba('#ff466f', .38) });
            if (e.elite && e.chassis === 'bulwark') {
                shapes.push({ x: e.x, z: e.z, r: e.radius + .48, mode: 1, color: rgba('#62bfff', .72) });
                shapes.push({ x: e.x, z: e.z, r: e.radius + 1.05, mode: 1, color: rgba('#b8e8ff', .26) });
            }
            if (e.elite && e.chassis === 'architect')
                shapes.push({ x: e.x, z: e.z, r: e.radius + .55, mode: 1, color: rgba('#9d84d8', .62) });
            if (e.elite && e.chassis === 'harvester') {
                shapes.push({ x: e.x, z: e.z, r: e.radius + .45, mode: 1, color: rgba('#75dfd2', .58) });
                for (let q = 0; q < Math.min(5, e.adaptationStage); q++)
                    shapes.push({ x: e.x, z: e.z, r: e.radius + .82 + q * .24, mode: 1, color: rgba('#7affee', .28) });
            }
            if (e.elite && e.chassis === 'shepherd') {
                const rr = e.bossPattern ? e.radius + 1.1 : e.radius + .42;
                shapes.push({ x: e.x, z: e.z, r: rr + .12 * Math.sin(s.time * 5), mode: 1, color: rgba('#58e5c2', e.bossPattern ? .64 : .34) });
            }
            if (e.elite && e.chassis === 'broodmaker') {
                shapes.push({ x: e.x, z: e.z, r: e.radius + .52, mode: 1, color: rgba('#e05a9c', .62) });
                for (let q = 0; q < 3; q++) {
                    const a = s.time * 1.2 + q * Math.PI * 2 / 3;
                    shapes.push({ x: e.x + Math.cos(a) * 1.25, z: e.z + Math.sin(a) * 1.25, r: .14, mode: 0, color: rgba('#ff92c8', .72) });
                }
            }
            if (e.elite && e.chassis === 'archivist')
                shapes.push({ x: e.x, z: e.z, r: 6.0, mode: 1, color: rgba('#7aa8ff', .20) });
            if (e.boss) {
                shapes.push({ x: e.x, z: e.z, r: 2.3 + .16 * Math.sin(s.time * 4.2), mode: 1, color: rgba('#ff525e', .92) });
                shapes.push({ x: e.x, z: e.z, r: 8.5, mode: 1, color: rgba('#ff525e', .15) });
            }
            if (e.elite && (e.affix === 'shielded' || e.adaptation === 'screening')) {
                const sx = e.x + Math.cos(e.shieldAngle) * 1.1, sz = e.z + Math.sin(e.shieldAngle) * 1.1;
                shapes.push({ x: sx, z: sz, r: 1.05, mode: 1, color: rgba('#8bdcff', .78) });
            }
            if (e.elite && e.affix === 'vanguard') {
                shapes.push({ x: e.x, z: e.z, r: 7.5, mode: 1, color: rgba('#ff9c4a', .34) });
                shapes.push({ x: e.x, z: e.z, r: e.radius + .52, mode: 1, color: rgba('#ffc06b', .78) });
            }
            if (e.elite && e.affix === 'temporal') {
                shapes.push({ x: e.x, z: e.z, r: e.radius + .48 + .12 * Math.sin(s.time * 5.2), mode: 1, color: rgba('#8b7cff', .78) });
                shapes.push({ x: e.x, z: e.z, r: e.radius + 1.03 - .08 * Math.sin(s.time * 5.2), mode: 1, color: rgba('#c0a8ff', .46) });
            }
            if (e.elite && e.affix === 'brood') {
                shapes.push({ x: e.x, z: e.z, r: e.radius + .70, mode: 1, color: rgba('#e45f9e', .72) });
                for (let i = 0; i < 3; i++) {
                    const a = s.time * .85 + i * Math.PI * 2 / 3;
                    shapes.push({ x: e.x + Math.cos(a) * 1.35, z: e.z + Math.sin(a) * 1.35, r: .18, mode: 0, color: rgba('#ff86ba', .82) });
                }
            }
            if (e.elite && e.affix === 'crowned') {
                shapes.push({ x: e.x, z: e.z, r: e.radius + .82, mode: 1, color: rgba('#ffd45d', .78) });
                shapes.push({ x: e.x, z: e.z, r: 7.0, mode: 1, color: rgba('#ffd45d', .12) });
            }
            if (e.elite && e.adaptation !== 'none') {
                const ac = e.adaptation === 'screening' ? rgba('#5bbcff', .88) : e.adaptation === 'repulsor' ? rgba('#ff7d52', .88) : e.adaptation === 'intercept' ? rgba('#ff4f91', .88) : rgba('#7fe46f', .88);
                shapes.push({ x: e.x, z: e.z, r: e.radius + .68, mode: 1, color: ac });
                if (e.adaptation === 'repulsor')
                    shapes.push({ x: e.x, z: e.z, r: 4.25 + .10 * Math.sin(s.time * 4.5), mode: 1, color: rgba('#ff7d52', .28) });
                if (e.adaptation === 'anchored')
                    shapes.push({ x: e.x, z: e.z, r: 2.15 + .12 * Math.sin(s.time * 3.3), mode: 1, color: rgba('#7fe46f', .30) });
            }
        }
        for (const f of this.fx) {
            const t = (s.time - f.start) / f.ttl;
            if (t < 0 || t > 1 || f.kind === 'beam' || f.kind === 'slash')
                continue;
            if (f.kind === 'bolt') {
                const q = 1 - Math.pow(1 - t, 2), x = f.x1 + (f.x2 - f.x1) * q, z = f.z1 + (f.z2 - f.z1) * q;
                shapes.push({ x, z, r: f.r * (1 + .25 * Math.sin(t * Math.PI)), mode: 0, color: [f.color[0], f.color[1], f.color[2], f.color[3] * (1 - t * .45)] });
            }
            else if (f.kind === 'ring')
                shapes.push({ x: f.x, z: f.z, r: f.r * (.25 + .75 * t), mode: 1, color: [f.color[0], f.color[1], f.color[2], f.color[3] * (1 - t)] });
            else
                shapes.push({ x: f.x, z: f.z, r: f.r * (.4 + .6 * t), mode: 1, color: [f.color[0], f.color[1], f.color[2], f.color[3] * (1 - t)] });
        }
        if (!shapes.length)
            return;
        const stride = 8;
        this.ensureShape(shapes.length * stride);
        let o = 0;
        for (const q of shapes) {
            this.shapeData[o++] = q.x;
            this.shapeData[o++] = q.z;
            this.shapeData[o++] = q.r;
            this.shapeData[o++] = q.mode;
            this.shapeData[o++] = q.color[0];
            this.shapeData[o++] = q.color[1];
            this.shapeData[o++] = q.color[2];
            this.shapeData[o++] = q.color[3];
        }
        const gl = this.gl, p = this.shapeProgram;
        gl.useProgram(p);
        this.commonUniforms(p, s);
        gl.bindVertexArray(this.shapeVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.shapeInstance);
        gl.bufferData(gl.ARRAY_BUFFER, this.shapeData.subarray(0, shapes.length * stride), gl.DYNAMIC_DRAW);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, shapes.length);
        gl.bindVertexArray(null);
    }
    drawLines(s, aim) {
        const verts = [];
        const line = (x1, y1, x2, y2, w, c) => this.pushLine(verts, x1, y1, x2, y2, w, c);
        const rect = (x, y, w, h, c) => this.pushRect(verts, x, y, w, h, c);
        const tri = (a, b, c, color) => this.pushTri(verts, a, b, c, color);
        const p0 = this.worldToScreen(s.player.x, s.player.z, s), p1 = this.worldToScreen(s.player.x + aim.x * 6, s.player.z + aim.z * 6, s);
        line(p0.x, p0.y - 25, p1.x, p1.y, 1.5, rgba('#86f5d2', .40));
        const corners = [[s.world.minX, s.world.minZ], [s.world.maxX, s.world.minZ], [s.world.maxX, s.world.maxZ], [s.world.minX, s.world.maxZ]];
        for (let i = 0; i < 4; i++) {
            const a = this.worldToScreen(corners[i][0], corners[i][1], s), b = this.worldToScreen(corners[(i + 1) % 4][0], corners[(i + 1) % 4][1], s);
            line(a.x, a.y, b.x, b.y, 3, rgba('#b9d3d7', .34));
        }
        for (const q of s.pickups) {
            if (q.kind !== 'heal')
                continue;
            const p = this.worldToScreen(q.x, q.z, s), pulse = .68 + .32 * (.5 + .5 * Math.sin(s.time * 6 + q.id));
            line(p.x, p.y - 18, p.x, p.y - 126, 2.6, rgba('#7bffae', .58 * pulse));
            line(p.x - 10, p.y - 64, p.x + 10, p.y - 64, 3.6, rgba('#baffcf', .78));
            line(p.x, p.y - 74, p.x, p.y - 54, 3.6, rgba('#baffcf', .78));
        }
        for (const f of this.combatFx) {
            const t = (s.time - f.start) / f.ttl;
            if (t < 0 || t > 1 || f.shape.kind === 'circle')
                continue;
            const baseColor = this.combatColor(f.source, f.intent, (1 - t) * .72), fill = [baseColor[0], baseColor[1], baseColor[2], baseColor[3] * .13];
            if (f.shape.kind === 'ray') {
                const q = f.shape, m = Math.hypot(q.aimX, q.aimZ) || 1, ax = q.aimX / m, az = q.aimZ / m, px = -az * q.halfWidth, pz = ax * q.halfWidth, ex = q.x + ax * q.range, ez = q.z + az * q.range;
                const a = this.worldToScreen(q.x + px, q.z + pz, s), b = this.worldToScreen(q.x - px, q.z - pz, s), c = this.worldToScreen(ex + px, ez + pz, s), d = this.worldToScreen(ex - px, ez - pz, s);
                tri(a, b, c, fill);
                tri(c, b, d, fill);
                line(a.x, a.y, c.x, c.y, 2.2, baseColor);
                line(b.x, b.y, d.x, d.y, 2.2, baseColor);
                line(c.x, c.y, d.x, d.y, 1.8, baseColor);
            }
            else if (f.shape.kind === 'sector') {
                const q = f.shape, base = Math.atan2(q.aimZ, q.aimX), steps = Math.max(12, Math.ceil(q.halfAngle * 11)), center = this.worldToScreen(q.x, q.z, s);
                let first = null, prev = null;
                for (let i = 0; i <= steps; i++) {
                    const u = i / steps, ang = base - q.halfAngle + 2 * q.halfAngle * u, p = this.worldToScreen(q.x + Math.cos(ang) * q.radius, q.z + Math.sin(ang) * q.radius, s);
                    if (!first)
                        first = p;
                    if (prev) {
                        tri(center, prev, p, fill);
                        line(prev.x, prev.y, p.x, p.y, 2.2, baseColor);
                    }
                    prev = p;
                }
                if (q.halfAngle < Math.PI - .01 && first && prev) {
                    line(center.x, center.y, first.x, first.y, 1.7, baseColor);
                    line(center.x, center.y, prev.x, prev.y, 1.7, baseColor);
                }
            }
        }
        const byId = new Map(s.entities.map(e => [e.id, e]));
        for (const e of s.entities) {
            if (e.kind === 'binder' && e.linkedTo) {
                const t = byId.get(e.linkedTo);
                if (t) {
                    const a = this.worldToScreen(e.x, e.z, s), b = this.worldToScreen(t.x, t.z, s);
                    line(a.x, a.y - 26, b.x, b.y - 20, 2, rgba('#e8c56f', .50));
                }
            }
            if (e.kind === 'bookmark' && e.telegraph > 0) {
                const a = this.worldToScreen(e.x, e.z, s), b = this.worldToScreen(e.x + e.facingX * 8, e.z + e.facingZ * 8, s);
                line(a.x, a.y, b.x, b.y, 4, rgba('#ff5365', .35 + .45 * (1 - e.telegraph)));
            }
            if (e.elite && e.affix === 'vanguard') {
                const a = this.worldToScreen(e.x, e.z, s);
                for (const o of s.entities) {
                    if (o.elite || !o.buffed || Math.hypot(o.x - e.x, o.z - e.z) > 7.8)
                        continue;
                    const b = this.worldToScreen(o.x, o.z, s);
                    line(a.x, a.y - 28, b.x, b.y - 20, 1.6, rgba('#ffad57', .34));
                }
            }
            if (e.elite && e.affix === 'temporal') {
                const a = this.worldToScreen(e.x, e.z, s), ang = s.time * 1.65, r = 25;
                line(a.x - Math.cos(ang) * r, a.y - 42 - Math.sin(ang) * r * .45, a.x + Math.cos(ang) * r, a.y - 42 + Math.sin(ang) * r * .45, 2.2, rgba('#b8a4ff', .62));
                line(a.x - Math.cos(ang + Math.PI / 2) * r, a.y - 42 - Math.sin(ang + Math.PI / 2) * r * .45, a.x + Math.cos(ang + Math.PI / 2) * r, a.y - 42 + Math.sin(ang + Math.PI / 2) * r * .45, 2.2, rgba('#7c6dff', .48));
            }
            if (e.elite && e.adaptation === 'intercept') {
                const a = this.worldToScreen(e.x, e.z, s), b = this.worldToScreen(e.x + e.facingX * 5.8, e.z + e.facingZ * 5.8, s);
                line(a.x, a.y - 20, b.x, b.y - 20, 3.4, rgba('#ff4f91', .44));
            }
            if (e.elite && e.adaptation === 'anchored') {
                let best = s.fields.filter(f => !['ink', 'index', 'architect'].includes(f.kind)).sort((a, b) => Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z))[0];
                if (best && Math.hypot(best.x - e.x, best.z - e.z) < 8.5) {
                    const a = this.worldToScreen(e.x, e.z, s), b = this.worldToScreen(best.x, best.z, s);
                    line(a.x, a.y - 20, b.x, b.y, 2.4, rgba('#7fe46f', .42));
                }
            }
            if (e.elite && (e.affix === 'shielded' || e.adaptation === 'screening')) {
                const a = this.worldToScreen(e.x, e.z, s), ang = e.shieldAngle, rr = 2.15, pA = this.worldToScreen(e.x + Math.cos(ang - .78) * rr, e.z + Math.sin(ang - .78) * rr, s), pB = this.worldToScreen(e.x + Math.cos(ang + .78) * rr, e.z + Math.sin(ang + .78) * rr, s), front = this.worldToScreen(e.x + Math.cos(ang) * rr, e.z + Math.sin(ang) * rr, s);
                line(pA.x, pA.y, front.x, front.y, 5, rgba('#7dd9ff', .78));
                line(front.x, front.y, pB.x, pB.y, 5, rgba('#7dd9ff', .78));
                line(a.x, a.y - 8, front.x, front.y, 2, rgba('#7dd9ff', .38));
            }
            if (e.elite) {
                const p = this.worldToScreen(e.x, e.z, s), bw = 94, bh = 6;
                rect(p.x - bw / 2, p.y - 92, bw, bh, rgba('#070a0d', .75));
                rect(p.x - bw / 2 + 1, p.y - 91, (bw - 2) * Math.max(0, e.hp / e.maxHp), bh - 2, e.adaptation === 'screening' ? rgba('#56b7ff', .95) : e.adaptation === 'repulsor' ? rgba('#ff7d52', .95) : e.adaptation === 'intercept' ? rgba('#ff4f91', .95) : rgba('#7fe46f', .95));
                if (e.chassis === 'hunter')
                    line(p.x, p.y - 35, p0.x, p0.y - 24, 1.5, rgba('#ff466f', .22));
            }
        }
        for (const f of this.fx) {
            const t = (s.time - f.start) / f.ttl;
            if (t < 0 || t > 1)
                continue;
            if (f.kind === 'beam') {
                const a = this.worldToScreen(f.x1, f.z1, s), b = this.worldToScreen(f.x2, f.z2, s), alpha = f.color[3] * (1 - t);
                const isArc = f.color[2] > .80 && f.color[0] < .55;
                if (isArc) {
                    let px = a.x, py = a.y - 24;
                    const seg = 6;
                    for (let i = 1; i <= seg; i++) {
                        const q = i / seg;
                        const nx = a.x + (b.x - a.x) * q + (i < seg ? Math.sin((i * 12.7 + f.start * 91)) * 7 : 0);
                        const ny = a.y - 24 + (b.y - a.y) * q + (i < seg ? Math.cos((i * 8.1 + f.start * 73)) * 5 : 0);
                        line(px, py, nx, ny, Math.max(1.5, f.width * (1 - t * .4)), [f.color[0], f.color[1], f.color[2], alpha]);
                        px = nx;
                        py = ny;
                    }
                }
                else {
                    line(a.x, a.y - 24, b.x, b.y - 24, f.width * (1 - t * .45), [f.color[0], f.color[1], f.color[2], alpha]);
                    if (f.width > 7)
                        line(a.x, a.y - 24, b.x, b.y - 24, Math.max(2, f.width * .28), [1, .86, 1, alpha * .95]);
                }
            }
            else if (f.kind === 'bolt') {
                const q = 1 - Math.pow(1 - t, 2), q0 = Math.max(0, q - .12), a = this.worldToScreen(f.x1 + (f.x2 - f.x1) * q0, f.z1 + (f.z2 - f.z1) * q0, s), b = this.worldToScreen(f.x1 + (f.x2 - f.x1) * q, f.z1 + (f.z2 - f.z1) * q, s);
                line(a.x, a.y - 22, b.x, b.y - 22, 4, [f.color[0], f.color[1], f.color[2], f.color[3] * (1 - t * .5)]);
            }
            else if (f.kind === 'slash') {
                const base = Math.atan2(f.aimZ, f.aimX), steps = 9, progress = Math.min(1, t * 1.45);
                let prev = null;
                for (let i = 0; i <= steps; i++) {
                    const q = i / steps, ang = base - 1.05 + 2.10 * q * progress;
                    const wx = f.x + Math.cos(ang) * f.r, wz = f.z + Math.sin(ang) * f.r, p = this.worldToScreen(wx, wz, s);
                    if (prev)
                        line(prev.x, prev.y - 18, p.x, p.y - 18, 7 * (1 - t), [f.color[0], f.color[1], f.color[2], f.color[3] * (1 - t)]);
                    prev = p;
                }
            }
        }
        if (!verts.length)
            return;
        this.lineData = new Float32Array(verts);
        const gl = this.gl, p = this.lineProgram;
        gl.useProgram(p);
        gl.uniform2f(gl.getUniformLocation(p, 'u_resolution'), this.cssW, this.cssH);
        gl.bindVertexArray(this.lineVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.lineData, gl.DYNAMIC_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, verts.length / 6);
        gl.bindVertexArray(null);
    }
    drawSprites(s, presentation) {
        const list = [];
        const add = (x, z, w, h, cell, tint = [1, 1, 1, 1], flip = 0) => { const p = this.worldToScreen(x, z, s); list.push({ x, z, w, h, cell, tint, flip, sort: p.y }); };
        const entityVisual = (e, pulse = 1) => {
            const cell = e.elite ? cellFor[e.chassis ?? 'marshal'] : cellFor[e.kind];
            const largeElite = e.chassis === 'bulwark' || e.chassis === 'architect' || e.chassis === 'harvester' || e.chassis === 'broodmaker' || e.boss;
            const w = (e.boss ? 222 : e.elite ? (largeElite ? 154 : 142) : e.kind === 'binder' || e.kind === 'redactor' || e.kind === 'indexer' ? 86 : e.kind === 'bookmark' ? 72 : e.kind === 'marginwalker' ? 78 : 70) * pulse;
            const h = (e.boss ? 238 : e.elite ? (largeElite ? 166 : 154) : e.kind === 'binder' || e.kind === 'redactor' || e.kind === 'indexer' ? 94 : 86) * pulse;
            let tint = [1, 1, 1, 1];
            if (e.elite && e.affix === 'crowned')
                tint = [1.16, 1.08, .72, 1];
            else if (e.elite && e.affix === 'temporal')
                tint = [.95, .90, 1.18, 1];
            else if (e.elite && e.affix === 'vanguard')
                tint = [1.12, .95, .78, 1];
            else if (e.elite && e.affix === 'brood')
                tint = [1.12, .82, .92, 1];
            if (e.buffed)
                tint = [1.15, .96, .76, 1];
            if (e.revived)
                tint = [.86, 1.12, 1.12, 1];
            return { cell, w, h, tint, flip: e.facingX - e.facingZ < 0 ? 1 : 0 };
        };
        for (const p of s.pickups) {
            const size = p.kind === 'heal' ? 42 : p.kind === 'core' ? 30 : 20;
            add(p.x, p.z, size, size, cellFor[p.kind], [1, 1, 1, .98]);
        }
        for (const p of s.projectiles)
            add(p.x, p.z, 18, 18, cellFor.bullet, [1, 1, 1, .95]);
        for (const c of s.constructs)
            add(c.x, c.z, 58, 68, cellFor.sentry, [1, 1, 1, .95]);
        const hitById = new Map(presentation.hits.map(h => [h.entity, h]));
        for (const e of s.entities) {
            const bob = Math.sin(s.time * (e.elite ? 2.2 : 3.4) + e.id * .71), pulse = 1 + (e.elite ? .035 : .018) * bob, v = entityVisual(e, pulse), hit = hitById.get(e.id);
            let x = e.x, z = e.z, w = v.w, h = v.h, tint = v.tint;
            if (hit) {
                const t = Math.max(0, Math.min(1, (s.time - hit.start) / hit.ttl)), snap = 1 - t, kick = (e.elite ? .10 : .18) * hit.intensity * snap;
                x += hit.dirX * kick;
                z += hit.dirZ * kick;
                w *= 1 + .055 * hit.intensity * snap;
                h *= 1 - .035 * hit.intensity * snap;
                const flash = (hit.crit ? .72 : .48) * snap;
                tint = [Math.min(1.65, tint[0] + flash), Math.min(1.65, tint[1] + flash), Math.min(1.65, tint[2] + flash), tint[3]];
            }
            add(x, z, w, h, v.cell, tint, v.flip);
        }
        for (const d of presentation.deaths) {
            const t = Math.max(0, Math.min(1, (s.time - d.start) / d.ttl)), ease = 1 - Math.pow(1 - t, 2), v = entityVisual(d.actor, 1), travel = d.actor.elite ? .42 : .72, x = d.x + d.dirX * travel * ease, z = d.z + d.dirZ * travel * ease, alpha = Math.pow(1 - t, .65), w = v.w * (1 + .18 * ease), h = v.h * Math.max(.20, 1 - .76 * ease), warm = d.actor.elite ? .86 : .66;
            add(x, z, w, h, v.cell, [1.12, warm, warm, alpha], v.flip);
        }
        const orbit = s.skills.find(x => x.id === 'orbit_blades');
        if (orbit) {
            let n = 3 + Math.max(0, Math.round(orbit.count) - 1) + s.resonance.multiplicity;
            if (orbit.level >= 4)
                n++;
            if (orbit.level >= 7)
                n++;
            if (orbit.mutation === 'orbit_many')
                n += 3;
            if (orbit.mutation === 'orbit_saw')
                n = Math.max(2, 2 + Math.max(0, Math.round(orbit.count) - 1) + s.resonance.multiplicity);
            n = Math.min(12, n);
            const geom = orbit.level >= 6 ? 1.28 : orbit.level >= 3 ? 1.12 : 1, rad = skills.orbit_blades.baseRadius * Math.sqrt(1 + orbit.coverage) * geom;
            for (let i = 0; i < n; i++) {
                const a = s.time * 3.4 + i * Math.PI * 2 / n;
                add(s.player.x + Math.cos(a) * rad, s.player.z + Math.sin(a) * rad, 13, 28, cellFor.white, [.45, 1, .82, .92], 0);
            }
        }
        // Keep the v0.9 locomotion fix: auto-attacks do not restart the dirty 4-frame cast strip.
        // Weapon VFX and canonical combat geometry carry the attack readability instead.
        const playerPulse = 1 + .008 * Math.sin(s.time * 4.0), moved = Math.hypot(s.player.x - this.lastPlayerX, s.player.z - this.lastPlayerZ) > .002, flip = (s.player.aimX - s.player.aimZ) < 0 ? 1 : 0;
        const animDt = Math.max(0, Math.min(.05, s.time - this.lastPlayerAnimTime));
        this.playerMoveBlend = Math.max(0, Math.min(1, this.playerMoveBlend + (moved ? animDt * 8.0 : -animDt * 10.0)));
        if (this.playerMoveBlend > .02) {
            if (this.playerMoveBlend < .98)
                add(s.player.x, s.player.z, 96 * playerPulse, 120 * playerPulse, cellFor.player, [1, 1, 1, 1 - this.playerMoveBlend], flip);
            const w = .5 - .5 * Math.cos(s.time * Math.PI * 4.4);
            add(s.player.x, s.player.z, 96 * playerPulse, 120 * playerPulse, 23, [1, 1, 1, this.playerMoveBlend * (1 - w)], flip);
            add(s.player.x, s.player.z, 96 * playerPulse, 120 * playerPulse, 24, [1, 1, 1, this.playerMoveBlend * w], flip);
        }
        else
            add(s.player.x, s.player.z, 96 * playerPulse, 120 * playerPulse, cellFor.player, [1, 1, 1, 1], flip);
        this.lastPlayerX = s.player.x;
        this.lastPlayerZ = s.player.z;
        this.lastPlayerAnimTime = s.time;
        list.sort((a, b) => a.sort - b.sort);
        const stride = 13;
        this.ensureSprite(list.length * stride);
        let o = 0;
        for (const q of list) {
            const cx = q.cell % 8, cy = Math.floor(q.cell / 8), u0 = cx * .125, v0 = cy * .25, u1 = u0 + .125, v1 = v0 + .25;
            this.spriteData[o++] = q.x;
            this.spriteData[o++] = q.z;
            this.spriteData[o++] = q.w;
            this.spriteData[o++] = q.h;
            this.spriteData[o++] = u0;
            this.spriteData[o++] = v0;
            this.spriteData[o++] = u1;
            this.spriteData[o++] = v1;
            this.spriteData[o++] = q.tint[0];
            this.spriteData[o++] = q.tint[1];
            this.spriteData[o++] = q.tint[2];
            this.spriteData[o++] = q.tint[3];
            this.spriteData[o++] = q.flip;
        }
        const gl = this.gl, p = this.spriteProgram;
        gl.useProgram(p);
        this.commonUniforms(p, s);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.atlas);
        gl.uniform1i(gl.getUniformLocation(p, 'u_tex'), 0);
        gl.bindVertexArray(this.spriteVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteInstance);
        gl.bufferData(gl.ARRAY_BUFFER, this.spriteData.subarray(0, list.length * stride), gl.DYNAMIC_DRAW);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, list.length);
        gl.bindVertexArray(null);
    }
    ensureSprite(n) { if (this.spriteData.length < n)
        this.spriteData = new Float32Array(Math.max(n, Math.ceil(n * 1.4))); }
    ensureShape(n) { if (this.shapeData.length < n)
        this.shapeData = new Float32Array(Math.max(n, Math.ceil(n * 1.4))); }
    pushLine(v, x1, y1, x2, y2, w, c) { const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = -dy / l * w * .5, ny = dx / l * w * .5; const pts = [[x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x2 + nx, y2 + ny], [x2 + nx, y2 + ny], [x1 - nx, y1 - ny], [x2 - nx, y2 - ny]]; for (const p of pts)
        v.push(p[0], p[1], ...c); }
    pushRect(v, x, y, w, h, c) { const pts = [[x, y], [x + w, y], [x, y + h], [x, y + h], [x + w, y], [x + w, y + h]]; for (const p of pts)
        v.push(p[0], p[1], ...c); }
    pushTri(v, a, b, d, c) { for (const p of [a, b, d])
        v.push(p.x, p.y, ...c); }
    makeSpriteVao() { const gl = this.gl, vao = gl.createVertexArray(), quad = gl.createBuffer(), inst = gl.createBuffer(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-.5, -1, 0, 0, .5, -1, 1, 0, -.5, 0, 0, 1, -.5, 0, 0, 1, .5, -1, 1, 0, .5, 0, 1, 1]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8); gl.bindBuffer(gl.ARRAY_BUFFER, inst); const stride = 13 * 4; this.instAttrib(2, 2, stride, 0); this.instAttrib(3, 2, stride, 8); this.instAttrib(4, 4, stride, 16); this.instAttrib(5, 4, stride, 32); this.instAttrib(6, 1, stride, 48); gl.bindVertexArray(null); return [vao, inst]; }
    makeShapeVao() { const gl = this.gl, vao = gl.createVertexArray(), quad = gl.createBuffer(), inst = gl.createBuffer(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0); gl.bindBuffer(gl.ARRAY_BUFFER, inst); const stride = 8 * 4; this.instAttrib(1, 2, stride, 0); this.instAttrib(2, 1, stride, 8); this.instAttrib(3, 1, stride, 12); this.instAttrib(4, 4, stride, 16); gl.bindVertexArray(null); return [vao, inst]; }
    makeLineVao() { const gl = this.gl, vao = gl.createVertexArray(), buf = gl.createBuffer(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 24, 8); gl.bindVertexArray(null); return [vao, buf]; }
    instAttrib(loc, size, stride, offset) { const gl = this.gl; gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset); gl.vertexAttribDivisor(loc, 1); }
    program(vs, fs) { const gl = this.gl, compile = (type, src) => { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(sh) || 'shader compile'); return sh; }; const p = gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(p) || 'program link'); return p; }
    async loadTexture(url, repeat = false) { const img = new Image(); img.src = url; await img.decode(); const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.generateMipmap(gl.TEXTURE_2D); return t; }
}
const GROUND_VS = `#version 300 es
precision highp float;void main(){float x=gl_VertexID==1?3.0:-1.0;float y=gl_VertexID==2?3.0:-1.0;gl_Position=vec4(x,y,0.0,1.0);}`;
const GROUND_FS = `#version 300 es
precision highp float;uniform vec2 u_resolution,u_camera,u_iso,u_center;uniform float u_time;uniform sampler2D u_floor;out vec4 outColor;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}
void main(){vec2 scr=vec2(gl_FragCoord.x,u_resolution.y-gl_FragCoord.y);vec2 c=u_resolution*u_center;float aa=(scr.x-c.x)/u_iso.x,bb=(scr.y-c.y)/u_iso.y;vec2 w=u_camera+vec2((aa+bb)*.5,(bb-aa)*.5);
  vec2 tuv=(w+vec2(120.0,-73.0))/31.0;vec3 tex=texture(u_floor,tuv).rgb;vec3 tex2=texture(u_floor,tuv*.53+vec2(.31,.17)).rgb;vec3 stone=mix(tex,tex2,.16);
  float sector=hash(floor(w/13.0));float stain=smoothstep(.77,.96,noise(w*.12+vec2(7.3,-11.2)));stone=mix(stone,vec3(.055,.024,.065),stain*.26);
  float moss=smoothstep(.80,.97,noise(w*.10+vec2(-15.0,9.0)));stone=mix(stone,vec3(.025,.070,.052),moss*.18);
  vec2 guv=fract(w/13.0)-.5;float rune=step(.955,sector)*(1.0-smoothstep(.022,.060,abs(length(guv)-.18)));stone+=rune*vec3(.02,.12,.11);
  vec2 uv=scr/u_resolution;float vig=1.0-smoothstep(.36,.98,length((uv-.5)*vec2(1.0,u_resolution.y/u_resolution.x)));stone*=.70+.30*vig;outColor=vec4(stone,1.0);} `;
const SPRITE_VS = `#version 300 es
precision highp float;layout(location=0)in vec2 a_corner;layout(location=1)in vec2 a_uv;layout(location=2)in vec2 i_world;layout(location=3)in vec2 i_size;layout(location=4)in vec4 i_uvrect;layout(location=5)in vec4 i_tint;layout(location=6)in float i_flip;uniform vec2 u_resolution,u_camera,u_iso,u_center;out vec2 v_uv;out vec4 v_tint;void main(){vec2 d=i_world-u_camera;vec2 anchor=u_resolution*u_center+vec2((d.x-d.y)*u_iso.x,(d.x+d.y)*u_iso.y);vec2 p=anchor+a_corner*i_size;vec2 clip=vec2(p.x/u_resolution.x*2.0-1.0,1.0-p.y/u_resolution.y*2.0);gl_Position=vec4(clip,0,1);float ux=i_flip>.5?1.0-a_uv.x:a_uv.x;v_uv=mix(i_uvrect.xy,i_uvrect.zw,vec2(ux,a_uv.y));v_tint=i_tint;}`;
const SPRITE_FS = `#version 300 es
precision highp float;uniform sampler2D u_tex;in vec2 v_uv;in vec4 v_tint;out vec4 outColor;void main(){vec4 t=texture(u_tex,v_uv);if(t.a<.03)discard;outColor=vec4(t.rgb*v_tint.rgb,t.a*v_tint.a);}`;
const SHAPE_VS = `#version 300 es
precision highp float;layout(location=0)in vec2 a_corner;layout(location=1)in vec2 i_world;layout(location=2)in float i_radius;layout(location=3)in float i_mode;layout(location=4)in vec4 i_color;uniform vec2 u_resolution,u_camera,u_iso,u_center;out vec2 v_local;out vec4 v_color;out float v_mode;void main(){vec2 d=i_world-u_camera;vec2 anchor=u_resolution*u_center+vec2((d.x-d.y)*u_iso.x,(d.x+d.y)*u_iso.y);vec2 p=anchor+a_corner*vec2(i_radius*u_iso.x,i_radius*u_iso.y);gl_Position=vec4(p.x/u_resolution.x*2.0-1.0,1.0-p.y/u_resolution.y*2.0,0,1);v_local=a_corner;v_color=i_color;v_mode=i_mode;}`;
const SHAPE_FS = `#version 300 es
precision highp float;in vec2 v_local;in vec4 v_color;in float v_mode;out vec4 outColor;void main(){float d=length(v_local);float a;if(v_mode>.5){a=(1.0-smoothstep(.91,1.0,d))*smoothstep(.70,.82,d);}else{a=(1.0-smoothstep(.80,1.0,d))*.72;}if(a<.01)discard;outColor=vec4(v_color.rgb,v_color.a*a);}`;
const LINE_VS = `#version 300 es
precision highp float;layout(location=0)in vec2 a_pos;layout(location=1)in vec4 a_color;uniform vec2 u_resolution;out vec4 v_color;void main(){gl_Position=vec4(a_pos.x/u_resolution.x*2.0-1.0,1.0-a_pos.y/u_resolution.y*2.0,0,1);v_color=a_color;}`;
const LINE_FS = `#version 300 es
precision highp float;in vec4 v_color;out vec4 outColor;void main(){outColor=v_color;}`;
