import { catalysts, skills } from '../content/definitions.js';
import type { CombatShape, Snapshot, SnapshotEntity } from '../core/types.js';
import type { PresentationCue, PresentationFrame } from '../presentation/types.js';

type Vec2 = { x: number; z: number };
type Fx =
  | {
      kind: 'ring';
      start: number;
      ttl: number;
      x: number;
      z: number;
      r: number;
      color: [number, number, number, number];
    }
  | {
      kind: 'beam';
      start: number;
      ttl: number;
      x1: number;
      z1: number;
      x2: number;
      z2: number;
      width: number;
      color: [number, number, number, number];
    }
  | {
      kind: 'pulse';
      start: number;
      ttl: number;
      x: number;
      z: number;
      r: number;
      color: [number, number, number, number];
    }
  | {
      kind: 'slash';
      start: number;
      ttl: number;
      x: number;
      z: number;
      aimX: number;
      aimZ: number;
      r: number;
      color: [number, number, number, number];
    }
  | {
      kind: 'bolt';
      start: number;
      ttl: number;
      x1: number;
      z1: number;
      x2: number;
      z2: number;
      r: number;
      color: [number, number, number, number];
    };

type SpriteInstance = {
  x: number;
  z: number;
  w: number;
  h: number;
  tex: number;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  tint: [number, number, number, number];
  flip: number;
  sort: number;
};
type UvRect = { u0: number; v0: number; u1: number; v1: number };
type ShapeInstance = {
  x: number;
  z: number;
  r: number;
  mode: number;
  color: [number, number, number, number];
};
type CombatShapeFx = {
  start: number;
  ttl: number;
  source: string;
  intent: 'damage' | 'control' | 'field';
  shape: CombatShape;
};

const cellFor: Record<string, number> = {
  player: 0,
  footnote: 1,
  bookmark: 2,
  binder: 3,
  palimpsest: 4,
  inkblot: 5,
  marginwalker: 6,
  marshal: 7,
  hunter: 8,
  redactor: 9,
  indexer: 10,
  bulwark: 11,
  architect: 12,
  harvester: 13,
  shepherd: 14,
  xp: 15,
  core: 16,
  heal: 17,
  bullet: 18,
  white: 19,
  sentry: 20,
  broodmaker: 21,
  archivist: 22,
  warden: 11
};
// Actors (hero and elites) leave the shared 32-cell atlas behind: at 96-238 screen
// pixels they outgrow a single atlas cell, and dedicated art already ships unused.
// See 23_DISPUTED_QUESTIONS_LOG.md, S1 and S3.
const TEX_ATLAS = 0;
const TEX_ACTORS = 1;
const ACTOR_SOURCES: { key: string; url: string }[] = [
  { key: 'player_idle', url: '/assets/player.png' },
  { key: 'player_run_0', url: '/assets/player_run_0.png' },
  { key: 'player_run_1', url: '/assets/player_run_1.png' },
  { key: 'player_run_2', url: '/assets/player_run_2.png' },
  { key: 'player_run_3', url: '/assets/player_run_3.png' },
  { key: 'elite_hunter', url: '/assets/v07_hunter.png' },
  { key: 'elite_architect', url: '/assets/v07_architect.png' },
  { key: 'elite_broodmaker', url: '/assets/v07_broodmaker.png' },
  { key: 'elite_bulwark', url: '/assets/v07_bulwark.png' },
  { key: 'elite_harvester', url: '/assets/v07_harvester.png' },
  { key: 'elite_shepherd', url: '/assets/v07_shepherd.png' },
  { key: 'elite_marshal', url: '/assets/v07_marshal.png' },
  { key: 'elite_archivist', url: '/assets/v07_archivist.png' },
  { key: 'elite_warden', url: '/assets/enemy_elite.png' }
];
const PLAYER_RUN_FRAMES = 4;
/** One colour per relic category, so what is lying there reads before the label does. */
const relicTint: Record<string, string> = {
  guard: '#7fe4ff',
  edge: '#ff7a6b',
  pace: '#9dff7a',
  finding: '#ffd75e',
  elite: '#d98cff'
};
const rgba = (hex: string, a = 1): [number, number, number, number] => {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
    a
  ];
};

export class WebGLRenderer {
  readonly gl: WebGL2RenderingContext;
  private atlas!: WebGLTexture;
  private actorTex!: WebGLTexture;
  private actorFrames = new Map<string, UvRect>();
  private floorTex!: WebGLTexture;
  private groundProgram: WebGLProgram;
  private spriteProgram: WebGLProgram;
  private shapeProgram: WebGLProgram;
  private lineProgram: WebGLProgram;
  private spriteVao: WebGLVertexArrayObject;
  private spriteInstance: WebGLBuffer;
  private shapeVao: WebGLVertexArrayObject;
  private shapeInstance: WebGLBuffer;
  private lineVao: WebGLVertexArrayObject;
  private lineBuffer: WebGLBuffer;
  private fx: Fx[] = [];
  private combatFx: CombatShapeFx[] = [];
  private mutatedSkills = new Set<string>();
  private lastPlayerX = 0;
  private lastPlayerZ = 0;
  private lastPlayerAnimTime = 0;
  private playerMoveBlend = 0;
  // Short ring of recent hero positions. Only read while dashing, to draw the streak
  // that tells the player the dash actually fired and where it came from.
  private heroTrail: { x: number; z: number; t: number }[] = [];
  private cssW = 1;
  private cssH = 1;
  private dpr = 1;
  private isoX = 34;
  private isoY = 17;
  private centerX = 0.5;
  private centerY = 0.52;
  private zoom = 1.16;
  private spriteData = new Float32Array(0);
  private shapeData = new Float32Array(0);
  private lineData = new Float32Array(0);
  constructor(public canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
      premultipliedAlpha: false,
      powerPreference: 'high-performance'
    });
    if (!gl) throw new Error('WebGL2 недоступен в этом браузере.');
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
  async load() {
    const [atlas, floor] = await Promise.all([
      this.loadTexture('/assets/atlas.png'),
      this.loadTexture('/assets/archive_floor.jpg', true),
      this.loadActorSheet()
    ]);
    this.atlas = atlas;
    this.floorTex = floor;
  }
  // Packs the dedicated actor art into one sheet so hero and elites still travel in
  // the same Y-sorted batch as everything else; see 23_DISPUTED_QUESTIONS_LOG.md, S2.
  private async loadActorSheet() {
    const loaded = await Promise.all(
      ACTOR_SOURCES.map(async (src) => {
        const img = new Image();
        img.src = src.url;
        await img.decode();
        return { key: src.key, img };
      })
    );
    const pad = 8,
      maxWidth = 2048;
    let penX = pad,
      penY = pad,
      shelfHeight = 0,
      usedWidth = 0;
    const placed: { key: string; img: HTMLImageElement; x: number; y: number }[] = [];
    for (const item of loaded.slice().sort((a, b) => b.img.height - a.img.height)) {
      if (penX + item.img.width + pad > maxWidth && penX > pad) {
        penX = pad;
        penY += shelfHeight + pad;
        shelfHeight = 0;
      }
      placed.push({ key: item.key, img: item.img, x: penX, y: penY });
      penX += item.img.width + pad;
      shelfHeight = Math.max(shelfHeight, item.img.height);
      usedWidth = Math.max(usedWidth, penX);
    }
    const sheetW = Math.max(1, usedWidth + pad),
      sheetH = Math.max(1, penY + shelfHeight + pad);
    const sheet = document.createElement('canvas');
    sheet.width = sheetW;
    sheet.height = sheetH;
    const ctx = sheet.getContext('2d');
    if (!ctx) throw new Error('2D контекст недоступен для сборки листа актёров.');
    for (const p of placed) {
      ctx.drawImage(p.img, p.x, p.y);
      this.actorFrames.set(p.key, {
        u0: p.x / sheetW,
        v0: p.y / sheetH,
        u1: (p.x + p.img.width) / sheetW,
        v1: (p.y + p.img.height) / sheetH
      });
    }
    const gl = this.gl,
      t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    // No mipmaps here on purpose: the padding that keeps neighbours apart at full
    // resolution stops working at the smaller mip levels and actors bleed together.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sheet);
    this.actorTex = t;
  }
  reset() {
    this.fx = [];
    this.combatFx = [];
    this.lastPlayerX = 0;
    this.lastPlayerZ = 0;
    this.lastPlayerAnimTime = 0;
    this.playerMoveBlend = 0;
  }
  get rendererName() {
    const gl = this.gl;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
  }
  get zoomLevel() {
    return this.zoom;
  }
  adjustZoom(delta: number) {
    this.zoom = Math.max(0.82, Math.min(1.48, this.zoom + delta));
  }

  consume(cues: readonly PresentationCue[], s?: Snapshot) {
    const mutated = (id: string) =>
      s ? !!s.skills.find((x) => x.id === id)?.mutation : this.mutatedSkills.has(id);
    for (const e of cues) {
      const time = e.time;
      if (e.type === 'combatShape') {
        const hostileTell = /^(echo_|elite_)|telegraph_boss|telegraph_temporal/.test(e.source);
        const longTell = hostileTell || /telegraph|tell|marker|beacon|lattice/.test(e.source);
        const ttl = hostileTell
          ? (e.source.includes('predator') ? 0.62 : 0.96)
          : longTell
            ? 0.78
            : e.intent === 'field'
              ? 0.34
              : e.intent === 'control'
                ? 0.3
                : 0.2;
        this.combatFx.push({
          start: time,
          ttl,
          source: e.source,
          intent: e.intent,
          shape: e.shape
        });
        continue;
      }
      if (e.type === 'eliteEcho') {
        const color =
          e.phase === 'tell'
            ? rgba('#ff3f4f', 0.98)
            : e.phase === 'active'
              ? rgba('#ff172f', 1)
              : rgba('#d58b72', 0.42);
        if (e.phase === 'tell') {
          this.fx.push({ kind: 'ring', start: time, ttl: 0.82, x: e.x, z: e.z, r: 2.65, color });
          this.fx.push({ kind: 'beam', start: time, ttl: 0.8, x1: e.x, z1: e.z, x2: e.x + e.aimX * 7.5, z2: e.z + e.aimZ * 7.5, width: 4.2, color: [1, 0.12, 0.18, 0.72] });
        } else if (e.phase === 'active') {
          this.fx.push({ kind: 'pulse', start: time, ttl: 0.28, x: e.x, z: e.z, r: 2.35, color });
        } else {
          this.fx.push({ kind: 'ring', start: time, ttl: 0.34, x: e.x, z: e.z, r: 1.5, color });
        }
        continue;
      }
      if (e.type === 'rareEvent') {
        if (e.x !== undefined && e.z !== undefined) {
          this.fx.push({ kind: 'ring', start: time, ttl: 0.9, x: e.x, z: e.z, r: 4.4, color: rgba('#ffe07d', 0.98) });
          this.fx.push({ kind: 'pulse', start: time + 0.03, ttl: 0.52, x: e.x, z: e.z, r: 2.2, color: rgba('#fff3b8', 0.5) });
        }
        continue;
      }
      if (e.type === 'skillCast') {
        const evo = mutated(e.skill),
          st = s?.skills.find((x) => x.id === e.skill),
          multi = s?.resonance.multiplicity ?? 0,
          scale = 1;
        const geom = st ? (st.level >= 6 ? 1.28 : st.level >= 3 ? 1.12 : 1) : 1;
        if (e.skill === 'ember_lance') {
          const n = Math.max(
              1,
              Math.round(st?.count ?? 1) + (st && st.level >= 7 ? 1 : 0) + Math.min(3, multi)
            ),
            range =
              skills.ember_lance.baseRange *
              (1 + (st?.range ?? 0)) *
              (st && st.level >= 6 ? 1.16 : st && st.level >= 3 ? 1.07 : 1);
          for (let i = 0; i < n; i++) {
            const a = (i - (n - 1) / 2) * 0.085,
              c = Math.cos(a),
              q = Math.sin(a),
              ax = e.aimX * c - e.aimZ * q,
              az = e.aimX * q + e.aimZ * c;
            this.fx.push({
              kind: 'bolt',
              start: time + i * 0.018,
              ttl: 0.24,
              x1: e.x,
              z1: e.z,
              x2: e.x + ax * range,
              z2: e.z + az * range,
              r: 0.22 + (st?.coverage ?? 0) * 0.08,
              color: rgba(evo ? '#ffd06f' : '#ff8a34', 0.95)
            });
            this.fx.push({
              kind: 'beam',
              start: time + i * 0.018,
              ttl: 0.15,
              x1: e.x,
              z1: e.z,
              x2: e.x + ax * range,
              z2: e.z + az * range,
              width: evo ? 4 : 2,
              color: rgba('#ff9a45', 0.2)
            });
          }
        }
        if (e.skill === 'rail_spear') {
          this.fx.push({
            kind: 'beam',
            start: time,
            ttl: evo ? 0.38 : 0.26,
            x1: e.x,
            z1: e.z,
            x2: e.x + e.aimX * (evo ? 21 : 17),
            z2: e.z + e.aimZ * (evo ? 21 : 17),
            width: evo ? 17 : 11,
            color: rgba(evo ? '#ff77d5' : '#ff4fba', evo ? 0.78 : 0.62)
          });
          if (evo)
            this.fx.push({
              kind: 'ring',
              start: time,
              ttl: 0.34,
              x: e.x,
              z: e.z,
              r: 1.25,
              color: rgba('#ffc6ef', 0.8)
            });
        }
        if (e.skill === 'frost_ring') {
          const r =
              skills.frost_ring.baseRadius * Math.sqrt(1 + (st?.coverage ?? 0)) * geom * scale,
            waves = 1 + Math.min(2, multi);
          for (let i = 0; i < waves; i++) {
            const rr = r * (1 + i * 0.17);
            this.fx.push({
              kind: 'ring',
              start: time + i * 0.1,
              ttl: 0.62 + i * 0.06,
              x: e.x,
              z: e.z,
              r: rr,
              color: rgba(i ? '#c8f5ff' : '#78d7ff', i ? 0.65 : 0.96)
            });
          }
          this.fx.push({
            kind: 'pulse',
            start: time + 0.04,
            ttl: 0.42,
            x: e.x,
            z: e.z,
            r: r * 0.72,
            color: rgba('#d7f7ff', 0.3)
          });
        }
        if (e.skill === 'cleaver') {
          const r = skills.cleaver.baseRadius * Math.sqrt(1 + (st?.coverage ?? 0)) * geom * scale,
            sweeps = 1 + Math.min(2, multi);
          for (let i = 0; i < sweeps; i++)
            this.fx.push({
              kind: 'slash',
              start: time + i * 0.075,
              ttl: 0.32,
              x: e.x,
              z: e.z,
              aimX: e.aimX,
              aimZ: e.aimZ,
              r: r * (1 + i * 0.05),
              color: rgba(i ? '#ffd3ab' : '#f4f0e8', i ? 0.5 : 0.96)
            });
        }
        if (e.skill === 'orbit_blades') {
          const r =
            skills.orbit_blades.baseRadius * Math.sqrt(1 + (st?.coverage ?? 0)) * geom * scale;
          this.fx.push({
            kind: 'ring',
            start: time,
            ttl: 0.34,
            x: e.x,
            z: e.z,
            r,
            color: rgba(evo ? '#88fff1' : '#60e6bd', 0.7)
          });
        }
        if (e.skill === 'mortar_bloom') {
          const range = skills.mortar_bloom.baseRange * (1 + (st?.range ?? 0)),
            d = Math.min(range * 0.72, 12.5),
            tx = e.x + e.aimX * d,
            tz = e.z + e.aimZ * d,
            r = skills.mortar_bloom.baseRadius * Math.sqrt(1 + (st?.coverage ?? 0)) * geom * scale,
            n = Math.max(1, Math.round(st?.count ?? 1) + Math.min(3, multi));
          for (let i = 0; i < n; i++) {
            const a = i ? i * 2.399 : 0,
              rr = i ? Math.min(1.4, r * 0.38) : 0;
            this.fx.push({
              kind: 'ring',
              start: time + i * 0.045,
              ttl: 0.82,
              x: tx + Math.cos(a) * rr,
              z: tz + Math.sin(a) * rr,
              r,
              color: rgba('#ffb16a', i ? 0.62 : 0.92)
            });
          }
          this.fx.push({
            kind: 'beam',
            start: time,
            ttl: 0.48,
            x1: e.x,
            z1: e.z,
            x2: tx,
            z2: tz,
            width: 2,
            color: rgba('#ffcb91', 0.36)
          });
        }
        if (e.skill === 'sentry') {
          this.fx.push({
            kind: 'pulse',
            start: time,
            ttl: 0.42,
            x: e.x,
            z: e.z,
            r: 1.4 + Math.min(1.2, multi * 0.24),
            color: rgba('#5be7c5', 0.72)
          });
        }
        if (e.skill === 'toxic_mist') {
          const r =
            skills.toxic_mist.baseRadius * Math.sqrt(1 + (st?.coverage ?? 0)) * geom * scale;
          this.fx.push({
            kind: 'ring',
            start: time,
            ttl: 0.72,
            x: e.x,
            z: e.z,
            r,
            color: rgba('#78df6e', 0.62)
          });
          if (multi)
            this.fx.push({
              kind: 'ring',
              start: time + 0.1,
              ttl: 0.82,
              x: e.x - e.aimX * 0.8,
              z: e.z - e.aimZ * 0.8,
              r: r * 0.82,
              color: rgba('#b2ff77', 0.34)
            });
        }
        if (e.skill === 'chain_arc') {
          this.fx.push({ kind: 'pulse', start: time, ttl: 0.26, x: e.x, z: e.z, r: 1.25, color: rgba('#6edcff', 0.72) });
          this.fx.push({ kind: 'ring', start: time, ttl: 0.44, x: e.x, z: e.z, r: 2.0, color: rgba('#b8f2ff', 0.72) });
        }
        if (e.skill === 'shard_fan') {
          this.fx.push({ kind: 'ring', start: time, ttl: 0.36, x: e.x, z: e.z, r: 1.35, color: rgba('#ffcf82', 0.82) });
          this.fx.push({ kind: 'beam', start: time, ttl: 0.25, x1: e.x, z1: e.z, x2: e.x + e.aimX * 5.0, z2: e.z + e.aimZ * 5.0, width: 3, color: rgba('#ffd9a6', 0.36) });
        }
        if (e.skill === 'tether_drag') {
          const tx = e.x + e.aimX * 7.0, tz = e.z + e.aimZ * 7.0;
          this.fx.push({ kind: 'beam', start: time, ttl: 0.34, x1: e.x, z1: e.z, x2: tx, z2: tz, width: 2, color: rgba('#c597ff', 0.55) });
          this.fx.push({ kind: 'ring', start: time, ttl: 0.54, x: tx, z: tz, r: 1.8, color: rgba('#b079ff', 0.85) });
        }
        if (e.skill === 'repulse_halo') {
          this.fx.push({
            kind: 'ring',
            start: time,
            ttl: evo ? 0.62 : 0.44,
            x: e.x,
            z: e.z,
            r: evo ? 3.8 : 3.0,
            color: rgba(evo ? '#b9f5ff' : '#78dfff', 0.88)
          });
          this.fx.push({
            kind: 'pulse',
            start: time + 0.03,
            ttl: evo ? 0.48 : 0.32,
            x: e.x,
            z: e.z,
            r: evo ? 2.5 : 1.8,
            color: rgba('#7fd6ff', 0.28)
          });
        }
        if (e.skill === 'mass_driver') {
          // Grave Roller is a physical body. The cast animation only shows the shove/launch;
          // the moving projectile below owns the rest of the route, so we never fake a hitscan beam.
          this.fx.push({
            kind: 'beam',
            start: time,
            ttl: evo ? 0.3 : 0.22,
            x1: e.x - e.aimX * 0.45,
            z1: e.z - e.aimZ * 0.45,
            x2: e.x + e.aimX * 2.6,
            z2: e.z + e.aimZ * 2.6,
            width: evo ? 11 : 7,
            color: rgba(evo ? '#ffd26f' : '#b76cff', evo ? 0.68 : 0.48)
          });
          this.fx.push({
            kind: 'pulse',
            start: time,
            ttl: evo ? 0.5 : 0.36,
            x: e.x,
            z: e.z,
            r: evo ? 2.0 : 1.25,
            color: rgba(evo ? '#ffe1a4' : '#d9b4ff', 0.84)
          });
          this.fx.push({
            kind: 'ring',
            start: time + 0.04,
            ttl: 0.46,
            x: e.x - e.aimX * 0.55,
            z: e.z - e.aimZ * 0.55,
            r: evo ? 1.55 : 1.05,
            color: rgba('#f0c9ff', 0.58)
          });
        }
      } else if (e.type === 'catalyst') {
        const color = rgba(catalysts[e.catalyst].color, 0.92);
        this.fx.push({
          kind: 'beam',
          start: time,
          ttl: 0.28,
          x1: e.sourceX,
          z1: e.sourceZ,
          x2: e.targetX,
          z2: e.targetZ,
          width: 4,
          color
        });
        this.fx.push({
          kind: 'ring',
          start: time + 0.02,
          ttl: 0.42,
          x: e.targetX,
          z: e.targetZ,
          r: 1.35,
          color: [color[0], color[1], color[2], 0.82]
        });
      } else if (e.type === 'damage') {
        if (e.source === 'ember_lance')
          this.fx.push({
            kind: 'beam',
            start: time,
            ttl: 0.13,
            x1: e.sourceX,
            z1: e.sourceZ,
            x2: e.x,
            z2: e.z,
            width: 5,
            color: rgba('#ff9844', 0.95)
          });
        else if (e.source === 'rail_spear')
          this.fx.push({
            kind: 'beam',
            start: time,
            ttl: 0.2,
            x1: e.sourceX,
            z1: e.sourceZ,
            x2: e.x,
            z2: e.z,
            width: 8,
            color: rgba('#ff55ba', 0.98)
          });
        else if (e.source === 'mass_driver') {
          // Impact belongs to the rolling body, not a line from the hero to the victim.
          this.fx.push({
            kind: 'pulse',
            start: time,
            ttl: 0.28,
            x: e.x,
            z: e.z,
            r: 1.15,
            color: rgba('#c177ff', 0.84)
          });
          this.fx.push({
            kind: 'ring',
            start: time,
            ttl: 0.34,
            x: e.x,
            z: e.z,
            r: 1.55,
            color: rgba('#efd2ff', 0.62)
          });
        }
        else if (e.source === 'sentry')
          this.fx.push({
            kind: 'beam',
            start: time,
            ttl: 0.1,
            x1: e.sourceX,
            z1: e.sourceZ,
            x2: e.x,
            z2: e.z,
            width: 3,
            color: rgba('#5be7c5', 0.88)
          });
        else if (e.source === 'mortar_bloom')
          this.fx.push({
            kind: 'pulse',
            start: time,
            ttl: 0.3,
            x: e.x,
            z: e.z,
            r: 1.2,
            color: rgba('#ff9c55', 0.78)
          });
        else if (e.source === 'chain_arc')
          this.fx.push({
            kind: 'beam',
            start: time,
            ttl: 0.11,
            x1: e.sourceX,
            z1: e.sourceZ,
            x2: e.x,
            z2: e.z,
            width: 3,
            color: rgba('#68cfff', 0.88)
          });
        if (e.crit)
          this.fx.push({
            kind: 'pulse',
            start: time,
            ttl: 0.25,
            x: e.x,
            z: e.z,
            r: 0.75,
            color: rgba('#fff2a8', 0.9)
          });
      } else if (e.type === 'reaction') {
        if (e.reaction === 'thermal_shock') {
          this.fx.push({
            kind: 'ring',
            start: time,
            ttl: 0.42,
            x: e.x,
            z: e.z,
            r: 2.1,
            color: rgba('#a9e9ff', 0.92)
          });
          this.fx.push({
            kind: 'pulse',
            start: time,
            ttl: 0.32,
            x: e.x,
            z: e.z,
            r: 1.45,
            color: rgba('#ff9b4a', 0.68)
          });
        } else if (e.reaction === 'detonation')
          this.fx.push({
            kind: 'pulse',
            start: time,
            ttl: 0.38,
            x: e.x,
            z: e.z,
            r: 1.8,
            color: rgba('#ff8650', 0.82)
          });
        else if (e.reaction === 'conduit')
          this.fx.push({
            kind: 'ring',
            start: time,
            ttl: 0.34,
            x: e.x,
            z: e.z,
            r: 1.5,
            color: rgba('#76edd6', 0.76)
          });
        else if (e.reaction === 'echo')
          this.fx.push({
            kind: 'ring',
            start: time,
            ttl: 0.46,
            x: e.x,
            z: e.z,
            r: 2.0,
            color: rgba('#96ddff', 0.72)
          });
        else if (e.reaction === 'aegis')
          this.fx.push({
            kind: 'ring',
            start: time,
            ttl: 0.5,
            x: e.x,
            z: e.z,
            r: 1.65,
            color: rgba('#74cfff', 0.92)
          });
      } else if (e.type === 'eliteSpawn') {
        const c =
          e.chassis === 'marshal'
            ? rgba('#ffbd62', 0.82)
            : e.chassis === 'hunter'
              ? rgba('#ff557d', 0.82)
              : e.chassis === 'bulwark'
                ? rgba('#72c8ff', 0.82)
                : e.chassis === 'architect'
                  ? rgba('#78edff', 0.82)
                  : e.chassis === 'harvester'
                    ? rgba('#ff8c4d', 0.82)
                    : e.chassis === 'shepherd'
                      ? rgba('#92ee73', 0.82)
                      : e.chassis === 'broodmaker'
                        ? rgba('#d75bc2', 0.82)
                        : rgba('#a5bfff', 0.82);
        this.fx.push({ kind: 'ring', start: time, ttl: 1.15, x: e.x, z: e.z, r: 3.6, color: c });
        this.fx.push({
          kind: 'pulse',
          start: time + 0.08,
          ttl: 0.9,
          x: e.x,
          z: e.z,
          r: 2.2,
          color: [c[0], c[1], c[2], 0.38]
        });
      } else if (e.type === 'death' && e.elite) {
        this.fx.push({
          kind: 'ring',
          start: time,
          ttl: 0.85,
          x: e.x,
          z: e.z,
          r: 4.1,
          color: rgba('#ffb15a', 0.9)
        });
        this.fx.push({
          kind: 'pulse',
          start: time,
          ttl: 0.55,
          x: e.x,
          z: e.z,
          r: 2.2,
          color: rgba('#fff0c4', 0.48)
        });
      } else if (e.type === 'playerHit')
        this.fx.push({
          kind: 'pulse',
          start: time,
          ttl: 0.18,
          x: e.x,
          z: e.z,
          r: 1.1,
          color: rgba('#ff5566', 0.55)
        });
      else if (e.type === 'eliteOrder') {
        // Formation bookkeeping is useful to AI but was competing with lethal combat tells.
        // Only authored elite actions get a short local cue; squad-routing itself stays invisible.
        const critical = ['predator', 'veil', 'replicate', 'prism', 'null', 'metamorph'];
        if (critical.includes(e.order)) {
          const c = rgba('#ff4a57', 0.74);
          this.fx.push({ kind: 'ring', start: time, ttl: 0.42, x: e.x, z: e.z, r: 2.7, color: c });
        }
      }
    }
  }

  screenAim(clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect();
    const sx = clientX - r.left - r.width * this.centerX,
      sy = clientY - r.top - r.height * this.centerY;
    const a = sx / Math.max(1, this.isoX),
      b = sy / Math.max(1, this.isoY);
    const x = (a + b) / 2,
      z = (b - a) / 2,
      m = Math.hypot(x, z) || 1;
    return { x: x / m, z: z / m };
  }
  worldToScreen(x: number, z: number, s: Snapshot) {
    const dx = x - s.player.x,
      dz = z - s.player.z;
    return {
      x: this.cssW * this.centerX + (dx - dz) * this.isoX,
      y: this.cssH * this.centerY + (dx + dz) * this.isoY
    };
  }

  private combatColor(
    source: string,
    intent: 'damage' | 'control' | 'field',
    alpha = 1
  ): [number, number, number, number] {
    const q = source.toLowerCase();
    // Hostile telegraphs own red regardless of the Phenomenon they imitate. Source-family colour
    // remains useful for the player's attacks, but danger must be recognised before it is named.
    if (/^(echo_|elite_)|telegraph_boss|telegraph_temporal/.test(q))
      return rgba(q.includes('active') ? '#ff1f35' : '#ff4a4f', alpha);
    if (q.includes('rail')) return rgba('#ff65c8', alpha);
    if (q.includes('frost') || q.includes('glacier') || q.includes('whiteout') || q.includes('spire'))
      return rgba('#72dcff', alpha);
    if (q.includes('cleaver') || q.includes('harvest') || q.includes('rupture') || q.includes('wound'))
      return rgba('#fff0d6', alpha);
    if (q.includes('orbit') || q.includes('aegis')) return rgba('#77f5d8', alpha);
    if (q.includes('arc') || q.includes('circuit')) return rgba('#68cfff', alpha);
    if (q.includes('sentry') || q.includes('battery') || q.includes('grid')) return rgba('#5be7c5', alpha);
    if (q.includes('toxic') || q.includes('septic') || q.includes('plague') || q.includes('pestilent'))
      return rgba('#86e46b', alpha);
    if (q.includes('mortar') || q.includes('bombard')) return rgba('#ff9a4d', alpha);
    if (q.includes('mass') || q.includes('roller') || q.includes('avalanche') || q.includes('comet'))
      return rgba('#c483ff', alpha);
    if (q.includes('return') || q.includes('shard') || q.includes('carousel') || q.includes('phoenix'))
      return rgba('#ffbd68', alpha);
    if (q.includes('tether') || q.includes('gravity') || q.includes('singular')) return rgba('#b079ff', alpha);
    if (q.includes('ember')) return rgba('#ff9a4d', alpha);
    if (q.includes('repulse')) return rgba('#72dcff', alpha);
    return intent === 'control'
      ? rgba('#8fdcff', alpha)
      : intent === 'field'
        ? rgba('#8ee6a8', alpha)
        : rgba('#f2e5d6', alpha);
  }

  draw(s: Snapshot, aim: Vec2, presentation: PresentationFrame) {
    this.mutatedSkills = new Set(s.skills.filter((x) => !!x.mutation).map((x) => x.id));
    this.resize();
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.025, 0.035, 0.046, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.drawGround(s);
    this.drawWorldShapes(s, aim, presentation);
    this.drawLines(s, aim);
    this.drawSprites(s, presentation);
    // Lethal elite preparation is the final world pass. It cannot disappear under the hero's
    // own VFX, projectiles or sprites just because the scene is busy.
    this.drawDangerOverlay(s);
    this.fx = this.fx.filter((f) => s.time - f.start < f.ttl + 0.05);
    this.combatFx = this.combatFx.filter((f) => s.time - f.start < f.ttl + 0.05);
  }
  private resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1)),
      w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr)),
      h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.dpr = dpr;
    this.cssW = this.canvas.clientWidth;
    this.cssH = this.canvas.clientHeight;
    this.isoX = Math.max(30, Math.min(43, this.cssW / 44)) * this.zoom;
    this.isoY = this.isoX * 0.5;
  }
  private commonUniforms(p: WebGLProgram, s: Snapshot) {
    const gl = this.gl;
    gl.uniform2f(gl.getUniformLocation(p, 'u_resolution'), this.cssW, this.cssH);
    gl.uniform2f(gl.getUniformLocation(p, 'u_camera'), s.player.x, s.player.z);
    gl.uniform2f(gl.getUniformLocation(p, 'u_iso'), this.isoX, this.isoY);
    gl.uniform2f(gl.getUniformLocation(p, 'u_center'), this.centerX, this.centerY);
  }
  private drawGround(s: Snapshot) {
    const gl = this.gl,
      p = this.groundProgram;
    gl.useProgram(p);
    this.commonUniforms(p, s);
    gl.uniform1f(gl.getUniformLocation(p, 'u_time'), s.time);
    const terrainSeed = s.world.obstacles.reduce(
      (acc, o) => acc + o.id * 0.137 + o.x * 0.019 + o.z * 0.031,
      17.0
    );
    gl.uniform1f(gl.getUniformLocation(p, 'u_seed'), terrainSeed);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.floorTex);
    gl.uniform1i(gl.getUniformLocation(p, 'u_floor'), 1);
    gl.bindVertexArray(null);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private drawWorldShapes(s: Snapshot, aim: Vec2, presentation: PresentationFrame) {
    const shapes: ShapeInstance[] = [];
    // Collision cover is still approximated by circles in the simulation for cheap robust
    // sliding. Its *presentation* is deliberately not circular: drawLines() turns the same
    // bodies into seeded broken stone/ruin silhouettes.
    for (const p of s.projectiles) {
      const base = skills[p.source]?.color ?? (p.faction === 'hero' ? '#e8f1ff' : '#ff665c');
      const color = rgba(base, p.faction === 'hero' ? 0.96 : 0.9);
      if (p.behavior === 'roller') {
        const pulse = 1 + 0.08 * Math.sin(s.time * 7 + p.id);
        shapes.push({ x: p.x, z: p.z, r: Math.max(0.7, p.radius * 1.1) * pulse, mode: 0, color: rgba(p.source === 'frost_ring' ? '#bcefff' : '#6d567f', 0.86) });
        shapes.push({ x: p.x, z: p.z, r: Math.max(1.0, p.radius * 1.55) * pulse, mode: 1, color });
        shapes.push({ x: p.x, z: p.z, r: Math.max(1.35, p.radius * 1.95) * pulse, mode: 1, color: [color[0], color[1], color[2], 0.32] });
      } else if (p.behavior === 'returner') {
        const phase = p.phase ?? 0,
          rr = Math.max(0.22, p.radius * (phase === 1 ? 2.6 : 1.7));
        shapes.push({ x: p.x, z: p.z, r: rr, mode: 1, color });
        shapes.push({ x: p.x, z: p.z, r: Math.max(0.12, p.radius * 0.75), mode: 0, color: rgba('#fff0bf', 0.9) });
      } else {
        shapes.push({ x: p.x, z: p.z, r: Math.max(0.16, p.radius * 1.35), mode: 0, color });
        shapes.push({ x: p.x, z: p.z, r: Math.max(0.28, p.radius * 2.15), mode: 1, color: [color[0], color[1], color[2], p.guarded ? 0.24 : 0.48] });
      }
      if (p.faction === 'rival')
        shapes.push({ x: p.x, z: p.z, r: Math.max(0.4, p.radius * 2.8), mode: 1, color: rgba('#ff5d63', 0.42) });
    }
    for (const f of s.fields) {
      const c =
        f.kind === 'ink'
          ? rgba('#5a245f', 0.42)
          : f.kind === 'fire'
            ? rgba('#ff7a32', 0.3)
            : f.kind === 'frost'
              ? rgba('#57cfff', 0.25)
              : f.kind === 'toxic'
                ? rgba('#66c95c', 0.34)
                : f.kind === 'index'
                  ? rgba('#5a90d8', 0.23)
                  : f.kind === 'architect'
                    ? rgba('#aa5de8', 0.3)
                    : f.kind === 'veil'
                      ? rgba('#665a8f', 0.38)
                      : rgba('#62aaff', 0.24);
      shapes.push({ x: f.x, z: f.z, r: f.radius, mode: 0, color: c });
      shapes.push({
        x: f.x,
        z: f.z,
        r: f.radius,
        mode: 1,
        color: [c[0], c[1], c[2], Math.min(0.42, c[3] + 0.1)]
      });
    }
    for (const f of this.combatFx) {
      const t = (s.time - f.start) / f.ttl;
      if (t < 0 || t > 1 || f.shape.kind !== 'circle') continue;
      const c = this.combatColor(f.source, f.intent, (1 - t) * 0.72),
        q = f.shape;
      shapes.push({ x: q.x, z: q.z, r: q.radius, mode: 0, color: [c[0], c[1], c[2], c[3] * 0.14] });
      shapes.push({ x: q.x, z: q.z, r: q.radius, mode: 1, color: c });
    }
    for (const h of presentation.hits) {
      const t = (s.time - h.start) / h.ttl;
      if (t < 0 || t > 1) continue;
      const a = (1 - t) * (0.62 + 0.2 * Math.min(1, h.intensity)),
        c = h.crit ? rgba('#fff3a8', a) : rgba('#fff8ee', a);
      shapes.push({ x: h.x, z: h.z, r: h.radius, mode: 1, color: c });
    }
    // target direction marker, not a movement target
    shapes.push({
      x: s.player.x + aim.x * 5.5,
      z: s.player.z + aim.z * 5.5,
      r: 0.34,
      mode: 1,
      color: rgba('#8fffdc', 0.8)
    });
    // Interactive sources use authored silhouettes in drawLines(); no gameplay source is
    // represented by a generic glowing circle any more.
    for (const e of s.entities) {
      if (e.status.marked)
        shapes.push({ x: e.x, z: e.z, r: e.radius + 0.3, mode: 1, color: rgba('#ff9b44', 0.55) });
      if (e.status.chilled)
        shapes.push({ x: e.x, z: e.z, r: e.radius + 0.18, mode: 1, color: rgba('#7adfff', 0.4) });
      if (e.status.frozen) {
        shapes.push({ x: e.x, z: e.z, r: e.radius + 0.34, mode: 1, color: rgba('#d9f8ff', 0.94) });
        shapes.push({ x: e.x, z: e.z, r: e.radius + 0.65 + 0.06 * Math.sin(s.time * 8), mode: 1, color: rgba('#68dfff', 0.52) });
      }
      if (e.status.wounded)
        shapes.push({ x: e.x, z: e.z, r: e.radius + 0.42 + 0.05 * Math.sin(s.time * 9), mode: 1, color: rgba('#ff5e67', 0.6) });
      if (e.status.toxined)
        shapes.push({ x: e.x, z: e.z, r: e.radius + 0.56, mode: 1, color: rgba('#7be86c', 0.52) });
      if (e.status.exposed)
        shapes.push({ x: e.x, z: e.z, r: e.radius + 0.76, mode: 1, color: rgba('#ffe16f', 0.78) });
      // Chassis influence must be visible even before the player reads any UI.
      if (e.elite && e.chassis === 'marshal')
        shapes.push({ x: e.x, z: e.z, r: 7.0, mode: 1, color: rgba('#ffb448', 0.24) });
      if (e.elite && e.chassis === 'hunter')
        shapes.push({ x: e.x, z: e.z, r: 1.75, mode: 1, color: rgba('#ff466f', 0.38) });
      if (e.elite && e.chassis === 'bulwark') {
        shapes.push({ x: e.x, z: e.z, r: e.radius + 0.48, mode: 1, color: rgba('#62bfff', 0.72) });
        shapes.push({ x: e.x, z: e.z, r: e.radius + 1.05, mode: 1, color: rgba('#b8e8ff', 0.26) });
      }
      if (e.elite && e.chassis === 'architect')
        shapes.push({ x: e.x, z: e.z, r: e.radius + 0.55, mode: 1, color: rgba('#9d84d8', 0.62) });
      if (e.elite && e.chassis === 'harvester') {
        shapes.push({ x: e.x, z: e.z, r: e.radius + 0.45, mode: 1, color: rgba('#75dfd2', 0.58) });
        for (let q = 0; q < Math.min(5, e.adaptationStage); q++)
          shapes.push({
            x: e.x,
            z: e.z,
            r: e.radius + 0.82 + q * 0.24,
            mode: 1,
            color: rgba('#7affee', 0.28)
          });
      }
      if (e.elite && e.chassis === 'shepherd') {
        const rr = e.bossPattern ? e.radius + 1.1 : e.radius + 0.42;
        shapes.push({
          x: e.x,
          z: e.z,
          r: rr + 0.12 * Math.sin(s.time * 5),
          mode: 1,
          color: rgba('#58e5c2', e.bossPattern ? 0.64 : 0.34)
        });
      }
      if (e.elite && e.chassis === 'broodmaker') {
        shapes.push({ x: e.x, z: e.z, r: e.radius + 0.52, mode: 1, color: rgba('#e05a9c', 0.62) });
        for (let q = 0; q < 3; q++) {
          const a = s.time * 1.2 + (q * Math.PI * 2) / 3;
          shapes.push({
            x: e.x + Math.cos(a) * 1.25,
            z: e.z + Math.sin(a) * 1.25,
            r: 0.14,
            mode: 0,
            color: rgba('#ff92c8', 0.72)
          });
        }
      }
      if (e.elite && e.chassis === 'archivist')
        shapes.push({ x: e.x, z: e.z, r: 6.0, mode: 1, color: rgba('#7aa8ff', 0.2) });
      if (e.boss) {
        shapes.push({
          x: e.x,
          z: e.z,
          r: 2.3 + 0.16 * Math.sin(s.time * 4.2),
          mode: 1,
          color: rgba('#ff525e', 0.92)
        });
        shapes.push({ x: e.x, z: e.z, r: 8.5, mode: 1, color: rgba('#ff525e', 0.15) });
      }
      if (e.elite && e.affix === 'shielded') {
        const sx = e.x + Math.cos(e.shieldAngle) * 1.1,
          sz = e.z + Math.sin(e.shieldAngle) * 1.1,
          sc = e.shieldState === 'broken' ? '#ff6464' : e.shieldState === 'commit' ? '#ffc261' : '#8bdcff',
          sa = e.shieldState === 'broken' ? 0.34 : 0.84;
        shapes.push({ x: sx, z: sz, r: 1.05 + (e.shieldState === 'commit' ? 0.18 : 0), mode: 1, color: rgba(sc, sa) });
        if (e.shieldState === 'broken')
          shapes.push({ x: e.x, z: e.z, r: e.radius + 1.15 + 0.1 * Math.sin(s.time * 12), mode: 1, color: rgba('#ff6464', 0.48) });
      }
      if (e.elite && e.affix === 'vanguard') {
        shapes.push({ x: e.x, z: e.z, r: 7.5, mode: 1, color: rgba('#ff9c4a', 0.34) });
        shapes.push({ x: e.x, z: e.z, r: e.radius + 0.52, mode: 1, color: rgba('#ffc06b', 0.78) });
      }
      if (e.elite && e.affix === 'temporal') {
        shapes.push({
          x: e.x,
          z: e.z,
          r: e.radius + 0.48 + 0.12 * Math.sin(s.time * 5.2),
          mode: 1,
          color: rgba('#8b7cff', 0.78)
        });
        shapes.push({
          x: e.x,
          z: e.z,
          r: e.radius + 1.03 - 0.08 * Math.sin(s.time * 5.2),
          mode: 1,
          color: rgba('#c0a8ff', 0.46)
        });
      }
      if (e.elite && e.affix === 'brood') {
        shapes.push({ x: e.x, z: e.z, r: e.radius + 0.7, mode: 1, color: rgba('#e45f9e', 0.72) });
        for (let i = 0; i < 3; i++) {
          const a = s.time * 0.85 + (i * Math.PI * 2) / 3;
          shapes.push({
            x: e.x + Math.cos(a) * 1.35,
            z: e.z + Math.sin(a) * 1.35,
            r: 0.18,
            mode: 0,
            color: rgba('#ff86ba', 0.82)
          });
        }
      }
      if (e.elite && e.affix === 'crowned') {
        shapes.push({ x: e.x, z: e.z, r: e.radius + 0.82, mode: 1, color: rgba('#ffd45d', 0.78) });
        shapes.push({ x: e.x, z: e.z, r: 7.0, mode: 1, color: rgba('#ffd45d', 0.12) });
      }
    }
    for (const f of this.fx) {
      const t = (s.time - f.start) / f.ttl;
      if (t < 0 || t > 1 || f.kind === 'beam' || f.kind === 'slash') continue;
      if (f.kind === 'bolt') {
        const q = 1 - Math.pow(1 - t, 2),
          x = f.x1 + (f.x2 - f.x1) * q,
          z = f.z1 + (f.z2 - f.z1) * q;
        shapes.push({
          x,
          z,
          r: f.r * (1 + 0.25 * Math.sin(t * Math.PI)),
          mode: 0,
          color: [f.color[0], f.color[1], f.color[2], f.color[3] * (1 - t * 0.45)]
        });
      } else if (f.kind === 'ring')
        shapes.push({
          x: f.x,
          z: f.z,
          r: f.r * (0.25 + 0.75 * t),
          mode: 1,
          color: [f.color[0], f.color[1], f.color[2], f.color[3] * (1 - t)]
        });
      else
        shapes.push({
          x: f.x,
          z: f.z,
          r: f.r * (0.4 + 0.6 * t),
          mode: 1,
          color: [f.color[0], f.color[1], f.color[2], f.color[3] * (1 - t)]
        });
    }
    if (!shapes.length) return;
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
    const gl = this.gl,
      p = this.shapeProgram;
    gl.useProgram(p);
    this.commonUniforms(p, s);
    gl.bindVertexArray(this.shapeVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.shapeInstance);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      this.shapeData.subarray(0, shapes.length * stride),
      gl.DYNAMIC_DRAW
    );
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, shapes.length);
    gl.bindVertexArray(null);
  }

  private drawDangerOverlay(s: Snapshot) {
    const verts: number[] = [],
      line = (x1:number,y1:number,x2:number,y2:number,w:number,c:[number,number,number,number]) => this.pushLine(verts,x1,y1,x2,y2,w,c);
    for (const e of s.entities) {
      if (!e.elite || !e.echoPhase || e.echoPhase === 'none' || e.echoPhase === 'recovery') continue;
      const p=this.worldToScreen(e.x,e.z,s), tell=e.echoPhase==='tell', c=tell?rgba('#ff3549',0.99):rgba('#ff172f',0.99), r=e.boss?50:38;
      // Four hard corners survive colour-blindness and visual clutter much better than another ring.
      const k=12;
      line(p.x-r,p.y-r*0.56,p.x-r+k,p.y-r*0.56,4,c); line(p.x-r,p.y-r*0.56,p.x-r,p.y-r*0.56+k,4,c);
      line(p.x+r,p.y-r*0.56,p.x+r-k,p.y-r*0.56,4,c); line(p.x+r,p.y-r*0.56,p.x+r,p.y-r*0.56+k,4,c);
      line(p.x-r,p.y+r*0.38,p.x-r+k,p.y+r*0.38,4,c); line(p.x-r,p.y+r*0.38,p.x-r,p.y+r*0.38-k,4,c);
      line(p.x+r,p.y+r*0.38,p.x+r-k,p.y+r*0.38,4,c); line(p.x+r,p.y+r*0.38,p.x+r,p.y+r*0.38-k,4,c);
      if (tell) {
        const m=Math.hypot(e.facingX,e.facingZ)||1, end=this.worldToScreen(e.x+e.facingX/m*7.5,e.z+e.facingZ/m*7.5,s);
        line(p.x,p.y-8,end.x,end.y,3.4,[c[0],c[1],c[2],0.9]);
        // Arrow head says where to leave before the attack becomes active.
        const dx=end.x-p.x,dy=end.y-(p.y-8),ll=Math.hypot(dx,dy)||1,nx=-dy/ll,ny=dx/ll;
        line(end.x,end.y,end.x-dx/ll*13+nx*7,end.y-dy/ll*13+ny*7,3.4,c);
        line(end.x,end.y,end.x-dx/ll*13-nx*7,end.y-dy/ll*13-ny*7,3.4,c);
      } else {
        line(p.x-r*0.6,p.y-r*0.18,p.x+r*0.6,p.y+r*0.08,4.5,c);
        line(p.x+r*0.6,p.y-r*0.18,p.x-r*0.6,p.y+r*0.08,4.5,c);
      }
    }
    if(!verts.length) return;
    const gl=this.gl,p=this.lineProgram;
    gl.useProgram(p);gl.uniform2f(gl.getUniformLocation(p,'u_resolution'),this.cssW,this.cssH);
    gl.bindVertexArray(this.lineVao);gl.bindBuffer(gl.ARRAY_BUFFER,this.lineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES,0,verts.length/6);gl.bindVertexArray(null);
  }

  private drawLines(s: Snapshot, aim: Vec2) {
    const verts: number[] = [];
    const line = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      w: number,
      c: [number, number, number, number]
    ) => this.pushLine(verts, x1, y1, x2, y2, w, c);
    const rect = (
      x: number,
      y: number,
      w: number,
      h: number,
      c: [number, number, number, number]
    ) => this.pushRect(verts, x, y, w, h, c);
    const tri = (
      a: { x: number; y: number },
      b: { x: number; y: number },
      c: { x: number; y: number },
      color: [number, number, number, number]
    ) => this.pushTri(verts, a, b, c, color);
    const p0 = this.worldToScreen(s.player.x, s.player.z, s),
      p1 = this.worldToScreen(s.player.x + aim.x * 6, s.player.z + aim.z * 6, s);
    line(p0.x, p0.y - 25, p1.x, p1.y, 1.5, rgba('#86f5d2', 0.4));
    const corners = [
      [s.world.minX, s.world.minZ],
      [s.world.maxX, s.world.minZ],
      [s.world.maxX, s.world.maxZ],
      [s.world.minX, s.world.maxZ]
    ] as const;
    for (let i = 0; i < 4; i++) {
      const a = this.worldToScreen(corners[i][0], corners[i][1], s),
        b = this.worldToScreen(corners[(i + 1) % 4][0], corners[(i + 1) % 4][1], s);
      line(a.x, a.y, b.x, b.y, 3, rgba('#b9d3d7', 0.34));
    }

    // Procedural cover presentation. Physics keeps a circular conservative hull, but the player
    // sees fractured stone islands with deterministic silhouettes, scars and rubble instead of
    // a pile of obvious collision circles.
    const hash01 = (n: number) => {
      const q = Math.sin(n * 91.733 + 17.17) * 43758.5453;
      return q - Math.floor(q);
    };
    for (const o of s.world.obstacles) {
      const hp = o.destructible ? Math.max(0, o.hp / Math.max(1, o.maxHp)) : 1,
        count = 8 + (o.id % 4), center = this.worldToScreen(o.x, o.z, s), pts: { x: number; y: number }[] = [];
      for (let i = 0; i < count; i++) { const a=(i/count)*Math.PI*2+hash01(o.id*3.1)*0.45,jag=0.68+hash01(o.id*47+i*13)*0.46,squash=0.82+hash01(o.id*19+4)*0.3; pts.push(this.worldToScreen(o.x+Math.cos(a)*o.radius*jag,o.z+Math.sin(a)*o.radius*jag*squash,s)); }
      const body=rgba(o.destructible?'#27222a':'#171c25',0.96),edge=rgba(o.destructible?'#d49b6a':'#7e8ca5',o.destructible?0.28+hp*0.55:0.72);
      for(let i=0;i<pts.length;i++)tri(center,pts[i],pts[(i+1)%pts.length],body);
      for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];line(a.x,a.y,b.x,b.y,1.2+(i%3===0?0.7:0),edge);}
      for(let k=0;k<3;k++){const a=pts[(k*3+o.id)%pts.length],b=pts[(k*5+o.id+2)%pts.length];line(center.x+(a.x-center.x)*0.12,center.y+(a.y-center.y)*0.12,center.x+(b.x-center.x)*0.62,center.y+(b.y-center.y)*0.62,1,rgba('#0a0c12',0.58));}
    }
    const poiColor=(kind:string)=>kind==='phenomenon'?rgba('#ffb06a',0.95):kind==='catalyst'?rgba('#d0a0ff',0.95):kind==='resonance'?rgba('#76e1ff',0.95):rgba('#75f0a9',0.95);
    for(const q of s.world.pois){if(q.state==='cleared')continue;const p=this.worldToScreen(q.x,q.z,s),c=poiColor(q.kind),y=p.y-12,pulse=0.5+0.5*Math.sin(s.time*3.2+q.id);line(p.x,p.y-6,p.x,p.y-86,2,[c[0],c[1],c[2],0.26+pulse*0.24]);if(q.kind==='phenomenon'){tri({x:p.x,y:y-4},{x:p.x-27,y:y-18},{x:p.x-22,y:y+14},[c[0],c[1],c[2],0.2]);tri({x:p.x,y:y-4},{x:p.x+27,y:y-18},{x:p.x+22,y:y+14},[c[0],c[1],c[2],0.2]);line(p.x,y-6,p.x,y+17,2.4,c);line(p.x,y-5,p.x-27,y-18,2.2,c);line(p.x,y-5,p.x+27,y-18,2.2,c);}else if(q.kind==='catalyst'){line(p.x-33,y,p.x-22,y-11,2.3,c);line(p.x-22,y-11,p.x-11,y,2.3,c);line(p.x-11,y,p.x-22,y+11,2.3,c);line(p.x+11,y,p.x+22,y-11,2.3,c);line(p.x+22,y-11,p.x+33,y,2.3,c);line(p.x-11,y,p.x+11,y,4,c);}else if(q.kind==='resonance'){for(let i=0;i<6;i++){const a=i*Math.PI/3,b=a+Math.PI/3;line(p.x+Math.cos(a)*18,y+Math.sin(a)*11,p.x+Math.cos(b)*18,y+Math.sin(b)*11,2.2,c);}line(p.x-18,y,p.x+18,y,1.6,c);line(p.x,y-15,p.x,y+15,1.6,c);}else{rect(p.x-6,y-23,12,46,[c[0],c[1],c[2],0.68]);rect(p.x-23,y-6,46,12,[c[0],c[1],c[2],0.68]);}}
    for(const r of s.relics){const p=this.worldToScreen(r.x,r.z,s),c=rgba(relicTint[r.category]??'#ffffff',0.95),y=p.y-22,d=10;tri({x:p.x,y:y-d-5},{x:p.x+d+5,y:y},{x:p.x-d-5,y:y},[c[0],c[1],c[2],0.32]);rect(p.x-d-5,y,d*2+10,17,[c[0],c[1],c[2],0.18]);line(p.x,y-d-5,p.x+d+5,y,2.3,c);line(p.x+d+5,y,p.x+d+5,y+17,2.3,c);line(p.x+d+5,y+17,p.x-d-5,y+17,2.3,c);if(r.contested){const rr=25,w=rgba('#ff4b4b',0.9);line(p.x-rr,y-12,p.x-rr+9,y-12,2.5,w);line(p.x+rr,y-12,p.x+rr-9,y-12,2.5,w);}}
    for (const q of s.pickups) {
      if (q.kind !== 'heal') continue;
      const p = this.worldToScreen(q.x, q.z, s),
        pulse = 0.68 + 0.32 * (0.5 + 0.5 * Math.sin(s.time * 6 + q.id));
      line(p.x, p.y - 18, p.x, p.y - 126, 2.6, rgba('#7bffae', 0.58 * pulse));
      line(p.x - 10, p.y - 64, p.x + 10, p.y - 64, 3.6, rgba('#baffcf', 0.78));
      line(p.x, p.y - 74, p.x, p.y - 54, 3.6, rgba('#baffcf', 0.78));
    }
    for (const f of this.combatFx) {
      const t = (s.time - f.start) / f.ttl;
      if (t < 0 || t > 1 || f.shape.kind === 'circle') continue;
      const baseColor = this.combatColor(f.source, f.intent, (1 - t) * 0.72),
        fill: [number, number, number, number] = [
          baseColor[0],
          baseColor[1],
          baseColor[2],
          baseColor[3] * 0.13
        ];
      if (f.shape.kind === 'ray') {
        const q = f.shape,
          m = Math.hypot(q.aimX, q.aimZ) || 1,
          ax = q.aimX / m,
          az = q.aimZ / m,
          px = -az * q.halfWidth,
          pz = ax * q.halfWidth,
          ex = q.x + ax * q.range,
          ez = q.z + az * q.range;
        const a = this.worldToScreen(q.x + px, q.z + pz, s),
          b = this.worldToScreen(q.x - px, q.z - pz, s),
          c = this.worldToScreen(ex + px, ez + pz, s),
          d = this.worldToScreen(ex - px, ez - pz, s);
        tri(a, b, c, fill);
        tri(c, b, d, fill);
        line(a.x, a.y, c.x, c.y, 2.2, baseColor);
        line(b.x, b.y, d.x, d.y, 2.2, baseColor);
        line(c.x, c.y, d.x, d.y, 1.8, baseColor);
      } else if (f.shape.kind === 'sector') {
        const q = f.shape,
          base = Math.atan2(q.aimZ, q.aimX),
          steps = Math.max(12, Math.ceil(q.halfAngle * 11)),
          center = this.worldToScreen(q.x, q.z, s);
        let first: { x: number; y: number } | null = null,
          prev: { x: number; y: number } | null = null;
        for (let i = 0; i <= steps; i++) {
          const u = i / steps,
            ang = base - q.halfAngle + 2 * q.halfAngle * u,
            p = this.worldToScreen(
              q.x + Math.cos(ang) * q.radius,
              q.z + Math.sin(ang) * q.radius,
              s
            );
          if (!first) first = p;
          if (prev) {
            tri(center, prev, p, fill);
            line(prev.x, prev.y, p.x, p.y, 2.2, baseColor);
          }
          prev = p;
        }
        if (q.halfAngle < Math.PI - 0.01 && first && prev) {
          line(center.x, center.y, first.x, first.y, 1.7, baseColor);
          line(center.x, center.y, prev.x, prev.y, 1.7, baseColor);
        }
      }
    }
    // v0.11 readability signatures. Geometry tells *where* an effect is; this pass tells
    // *what* it is without requiring text or colour recognition. Each active chassis owns a
    // moving signature and Elite Echo uses the same visual language through its source id.
    for (const f of this.combatFx) {
      const t = (s.time - f.start) / f.ttl;
      if (t < 0 || t > 1) continue;
      const src=f.source.toLowerCase(), a=(1-t)*0.82, pulse=0.5+0.5*Math.sin(s.time*13+f.start*17), c=this.combatColor(f.source,f.intent,a);
      if (f.shape.kind === 'circle') {
        const q=f.shape, center=this.worldToScreen(q.x,q.z,s), point=(r:number,ang:number)=>this.worldToScreen(q.x+Math.cos(ang)*r,q.z+Math.sin(ang)*r,s);
        if (src.includes('frost') || src.includes('glacier') || src.includes('whiteout') || src.includes('spire')) {
          // Rotating crystalline spokes: frost is readable even when its blue hue is obscured.
          for(let i=0;i<6;i++){const ang=s.time*0.8+i*Math.PI/3,p1=point(q.radius*0.28,ang),p2=point(q.radius*(0.82+0.08*pulse),ang);line(p1.x,p1.y,p2.x,p2.y,1.8,c);}
        } else if (src.includes('orbit') || src.includes('aegis')) {
          // Four tangent blade marks circle the perimeter.
          for(let i=0;i<4;i++){const ang=-s.time*2.4+i*Math.PI/2,p=point(q.radius,ang),p2=point(q.radius,ang+0.16);line(p.x,p.y,p2.x,p2.y,4.2,c);}
        } else if (src.includes('mortar') || src.includes('bombard')) {
          // Target reticle + falling tracer; bombardment should never look like a passive aura.
          const rr=Math.max(10,q.radius*this.isoX*0.56);line(center.x-rr,center.y,center.x+rr,center.y,1.4,c);line(center.x,center.y-rr*0.55,center.x,center.y+rr*0.55,1.4,c);line(center.x,center.y-80*(1-t)-18,center.x,center.y-8,2.6,c);
        } else if (src.includes('toxic') || src.includes('plague') || src.includes('septic') || src.includes('pestilent')) {
          // Uneven drifting bubbles distinguish a living cloud from a generic damage circle.
          for(let i=0;i<5;i++){const ang=i*2.17+s.time*(i%2?0.28:-0.22),r=q.radius*(0.3+0.11*i),p=point(r,ang),rr=3+2*Math.sin(s.time*3+i);line(p.x-rr,p.y,p.x+rr,p.y,Math.max(1,2-t),c);}
        } else if (src.includes('tether') || src.includes('gravity') || src.includes('singular')) {
          // Inward spokes animate the direction of force instead of showing only a purple ring.
          for(let i=0;i<6;i++){const ang=i*Math.PI/3+s.time*0.18,po=point(q.radius*(0.82-0.08*pulse),ang),pi=point(q.radius*0.34,ang);line(po.x,po.y,pi.x,pi.y,2.3,c);}
        } else if (src.includes('cleaver') || src.includes('harvest') || src.includes('rupture')) {
          // A quick rotating cut-mark for circular harvest/rupture follow-ups.
          for(let i=0;i<3;i++){const ang=-s.time*4+i*Math.PI*2/3,p1=point(q.radius*0.35,ang),p2=point(q.radius*0.9,ang+0.34);line(p1.x,p1.y,p2.x,p2.y,3,c);}
        }
      } else if (f.shape.kind === 'ray') {
        const q=f.shape,m=Math.hypot(q.aimX,q.aimZ)||1,ax=q.aimX/m,az=q.aimZ/m,end=this.worldToScreen(q.x+ax*q.range,q.z+az*q.range,s),start=this.worldToScreen(q.x,q.z,s);
        if (src.includes('rail')) {
          // Rail has a white-hot centre and a target scar at the impact end.
          line(start.x,start.y,end.x,end.y,1.1+2.1*pulse,rgba('#fff4ff',a));
          line(end.x-7,end.y,end.x+7,end.y,2,c);line(end.x,end.y-5,end.x,end.y+5,2,c);
        } else if (src.includes('arc') || src.includes('circuit')) {
          // Short lateral ticks travel along the electrical path on top of the jittered beam.
          for(let i=1;i<5;i++){const u=(i/5+s.time*0.7)%1,x=start.x+(end.x-start.x)*u,y=start.y+(end.y-start.y)*u;line(x-3,y-3,x+3,y+3,2,c);}
        } else if (src.includes('return') || src.includes('shard') || src.includes('carousel') || src.includes('phoenix')) {
          // Dashed flight path makes the outbound/return trajectory legible.
          for(let i=0;i<5;i++){const u=(i+0.25)/5,v=(i+0.65)/5;line(start.x+(end.x-start.x)*u,start.y+(end.y-start.y)*u,start.x+(end.x-start.x)*v,start.y+(end.y-start.y)*v,1.7,c);}
        } else if (src.includes('mass') || src.includes('roller') || src.includes('avalanche')) {
          // Heavy motion gets transverse impact ribs rather than another laser line.
          for(let i=1;i<5;i++){const u=i/5,x=start.x+(end.x-start.x)*u,y=start.y+(end.y-start.y)*u,dx=end.x-start.x,dy=end.y-start.y,ll=Math.hypot(dx,dy)||1,nx=-dy/ll,ny=dx/ll;line(x-nx*5,y-ny*5,x+nx*5,y+ny*5,2.4,c);}
        }
      } else if (f.shape.kind === 'sector') {
        const q=f.shape, center=this.worldToScreen(q.x,q.z,s), base=Math.atan2(q.aimZ,q.aimX);
        if (src.includes('cleaver') || src.includes('harvest') || src.includes('wound')) {
          // Two moving slash blades inside the sector communicate sweep direction/commitment.
          for(let k=0;k<2;k++){const u=Math.min(1,t*1.35+k*0.24),ang=base-q.halfAngle+2*q.halfAngle*u,p=this.worldToScreen(q.x+Math.cos(ang)*q.radius,q.z+Math.sin(ang)*q.radius,s);line(center.x,center.y,p.x,p.y,3.4-k,c);}
        }
      }
    }

    const byId = new Map(s.entities.map((e) => [e.id, e]));
    for (const e of s.entities) {
      if (e.kind === 'binder' && e.linkedTo) {
        const t = byId.get(e.linkedTo);
        if (t) {
          const a = this.worldToScreen(e.x, e.z, s),
            b = this.worldToScreen(t.x, t.z, s);
          line(a.x, a.y - 26, b.x, b.y - 20, 2, rgba('#e8c56f', 0.5));
        }
      }
      if (e.kind === 'bookmark' && e.telegraph > 0) {
        const a = this.worldToScreen(e.x, e.z, s),
          b = this.worldToScreen(e.x + e.facingX * 8, e.z + e.facingZ * 8, s);
        line(a.x, a.y, b.x, b.y, 4, rgba('#ff5365', 0.35 + 0.45 * (1 - e.telegraph)));
      }
      if (e.elite && e.affix === 'vanguard') {
        const a = this.worldToScreen(e.x, e.z, s);
        for (const o of s.entities) {
          if (o.elite || !o.buffed || Math.hypot(o.x - e.x, o.z - e.z) > 7.8) continue;
          const b = this.worldToScreen(o.x, o.z, s);
          line(a.x, a.y - 28, b.x, b.y - 20, 1.6, rgba('#ffad57', 0.34));
        }
      }
      if (e.elite && e.affix === 'temporal') {
        const a = this.worldToScreen(e.x, e.z, s),
          ang = s.time * 1.65,
          r = 25;
        line(
          a.x - Math.cos(ang) * r,
          a.y - 42 - Math.sin(ang) * r * 0.45,
          a.x + Math.cos(ang) * r,
          a.y - 42 + Math.sin(ang) * r * 0.45,
          2.2,
          rgba('#b8a4ff', 0.62)
        );
        line(
          a.x - Math.cos(ang + Math.PI / 2) * r,
          a.y - 42 - Math.sin(ang + Math.PI / 2) * r * 0.45,
          a.x + Math.cos(ang + Math.PI / 2) * r,
          a.y - 42 + Math.sin(ang + Math.PI / 2) * r * 0.45,
          2.2,
          rgba('#7c6dff', 0.48)
        );
      }
      if (e.elite && e.affix === 'shielded') {
        const a = this.worldToScreen(e.x, e.z, s),
          ang = e.shieldAngle,
          rr = 2.15,
          pA = this.worldToScreen(
            e.x + Math.cos(ang - 0.78) * rr,
            e.z + Math.sin(ang - 0.78) * rr,
            s
          ),
          pB = this.worldToScreen(
            e.x + Math.cos(ang + 0.78) * rr,
            e.z + Math.sin(ang + 0.78) * rr,
            s
          ),
          front = this.worldToScreen(e.x + Math.cos(ang) * rr, e.z + Math.sin(ang) * rr, s);
        const shieldColor = e.shieldState === 'broken' ? '#ff6268' : e.shieldState === 'commit' ? '#ffc05c' : '#7dd9ff',
          alpha = e.shieldState === 'broken' ? 0.28 : 0.84;
        line(pA.x, pA.y, front.x, front.y, e.shieldState === 'commit' ? 7 : 5, rgba(shieldColor, alpha));
        line(front.x, front.y, pB.x, pB.y, e.shieldState === 'commit' ? 7 : 5, rgba(shieldColor, alpha));
        line(a.x, a.y - 8, front.x, front.y, 2, rgba(shieldColor, alpha * 0.48));
      }
      if (e.elite) {
        const p = this.worldToScreen(e.x, e.z, s),
          bw = 94,
          bh = 6;
        rect(p.x - bw / 2, p.y - 92, bw, bh, rgba('#070a0d', 0.75));
        rect(
          p.x - bw / 2 + 1,
          p.y - 91,
          (bw - 2) * Math.max(0, e.hp / e.maxHp),
          bh - 2,
          rgba('#7fe46f', 0.95)
        );
        if (e.affix === 'shielded') {
          rect(p.x - bw / 2, p.y - 84, bw, 4, rgba('#070a0d', 0.72));
          const sc = e.shieldState === 'broken' ? '#ff6464' : e.shieldState === 'commit' ? '#ffc261' : '#73d9ff';
          rect(p.x - bw / 2 + 1, p.y - 83, (bw - 2) * Math.max(0, Math.min(1, e.shieldStability / 100)), 2, rgba(sc, 0.94));
        }
        if (e.chassis === 'hunter')
          line(p.x, p.y - 35, p0.x, p0.y - 24, 1.5, rgba('#ff466f', 0.22));
      }
    }
    for (const f of this.fx) {
      const t = (s.time - f.start) / f.ttl;
      if (t < 0 || t > 1) continue;
      if (f.kind === 'beam') {
        const a = this.worldToScreen(f.x1, f.z1, s),
          b = this.worldToScreen(f.x2, f.z2, s),
          alpha = f.color[3] * (1 - t);
        const isArc = f.color[2] > 0.8 && f.color[0] < 0.55;
        if (isArc) {
          let px = a.x,
            py = a.y - 24;
          const seg = 6;
          for (let i = 1; i <= seg; i++) {
            const q = i / seg;
            const nx =
              a.x + (b.x - a.x) * q + (i < seg ? Math.sin(i * 12.7 + f.start * 91) * 7 : 0);
            const ny =
              a.y - 24 + (b.y - a.y) * q + (i < seg ? Math.cos(i * 8.1 + f.start * 73) * 5 : 0);
            line(px, py, nx, ny, Math.max(1.5, f.width * (1 - t * 0.4)), [
              f.color[0],
              f.color[1],
              f.color[2],
              alpha
            ]);
            px = nx;
            py = ny;
          }
        } else {
          line(a.x, a.y - 24, b.x, b.y - 24, f.width * (1 - t * 0.45), [
            f.color[0],
            f.color[1],
            f.color[2],
            alpha
          ]);
          if (f.width > 7)
            line(a.x, a.y - 24, b.x, b.y - 24, Math.max(2, f.width * 0.28), [
              1,
              0.86,
              1,
              alpha * 0.95
            ]);
        }
      } else if (f.kind === 'bolt') {
        const q = 1 - Math.pow(1 - t, 2),
          q0 = Math.max(0, q - 0.12),
          a = this.worldToScreen(f.x1 + (f.x2 - f.x1) * q0, f.z1 + (f.z2 - f.z1) * q0, s),
          b = this.worldToScreen(f.x1 + (f.x2 - f.x1) * q, f.z1 + (f.z2 - f.z1) * q, s);
        line(a.x, a.y - 22, b.x, b.y - 22, 4, [
          f.color[0],
          f.color[1],
          f.color[2],
          f.color[3] * (1 - t * 0.5)
        ]);
      } else if (f.kind === 'slash') {
        const base = Math.atan2(f.aimZ, f.aimX),
          steps = 9,
          progress = Math.min(1, t * 1.45);
        let prev: { x: number; y: number } | null = null;
        for (let i = 0; i <= steps; i++) {
          const q = i / steps,
            ang = base - 1.05 + 2.1 * q * progress;
          const wx = f.x + Math.cos(ang) * f.r,
            wz = f.z + Math.sin(ang) * f.r,
            p = this.worldToScreen(wx, wz, s);
          if (prev)
            line(prev.x, prev.y - 18, p.x, p.y - 18, 7 * (1 - t), [
              f.color[0],
              f.color[1],
              f.color[2],
              f.color[3] * (1 - t)
            ]);
          prev = p;
        }
      }
    }
    if (!verts.length) return;
    this.lineData = new Float32Array(verts);
    const gl = this.gl,
      p = this.lineProgram;
    gl.useProgram(p);
    gl.uniform2f(gl.getUniformLocation(p, 'u_resolution'), this.cssW, this.cssH);
    gl.bindVertexArray(this.lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.lineData, gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, verts.length / 6);
    gl.bindVertexArray(null);
  }

  private drawSprites(s: Snapshot, presentation: PresentationFrame) {
    const list: SpriteInstance[] = [];
    const push = (
      x: number,
      z: number,
      w: number,
      h: number,
      tex: number,
      uv: UvRect,
      tint: [number, number, number, number],
      flip: number
    ) => {
      const p = this.worldToScreen(x, z, s);
      list.push({ x, z, w, h, tex, ...uv, tint, flip, sort: p.y });
    };
    const add = (
      x: number,
      z: number,
      w: number,
      h: number,
      cell: number,
      tint: [number, number, number, number] = [1, 1, 1, 1],
      flip = 0
    ) => {
      const cx = cell % 8,
        cy = Math.floor(cell / 8);
      push(
        x,
        z,
        w,
        h,
        TEX_ATLAS,
        { u0: cx * 0.125, v0: cy * 0.25, u1: cx * 0.125 + 0.125, v1: cy * 0.25 + 0.25 },
        tint,
        flip
      );
    };
    const addActor = (
      x: number,
      z: number,
      w: number,
      h: number,
      key: string,
      tint: [number, number, number, number] = [1, 1, 1, 1],
      flip = 0
    ) => {
      const uv = this.actorFrames.get(key);
      if (uv) push(x, z, w, h, TEX_ACTORS, uv, tint, flip);
    };
    const entityVisual = (e: SnapshotEntity, pulse = 1) => {
      const chassis = e.chassis ?? 'marshal';
      const cell = e.elite ? cellFor[chassis] : cellFor[e.kind];
      const actor = e.elite
        ? this.actorFrames.has('elite_' + chassis)
          ? 'elite_' + chassis
          : 'elite_warden'
        : null;
      const largeElite =
        e.chassis === 'bulwark' ||
        e.chassis === 'architect' ||
        e.chassis === 'harvester' ||
        e.chassis === 'broodmaker' ||
        e.boss;
      const w =
        (e.boss
          ? 318
          : e.elite
            ? largeElite
              ? 231
              : 213
            : e.kind === 'binder' || e.kind === 'redactor' || e.kind === 'indexer'
              ? 86
              : e.kind === 'bookmark'
                ? 72
                : e.kind === 'marginwalker'
                  ? 78
                  : 70) * pulse;
      const h =
        (e.boss
          ? 341
          : e.elite
            ? largeElite
              ? 249
              : 231
            : e.kind === 'binder' || e.kind === 'redactor' || e.kind === 'indexer'
              ? 94
              : 86) * pulse;
      let tint: [number, number, number, number] = [1, 1, 1, 1];
      if (e.elite && e.affix === 'crowned') tint = [1.16, 1.08, 0.72, 1];
      else if (e.elite && e.affix === 'temporal') tint = [0.95, 0.9, 1.18, 1];
      else if (e.elite && e.affix === 'vanguard') tint = [1.12, 0.95, 0.78, 1];
      else if (e.elite && e.affix === 'brood') tint = [1.12, 0.82, 0.92, 1];
      if (e.buffed) tint = [1.15, 0.96, 0.76, 1];
      if (e.revived) tint = [0.86, 1.12, 1.12, 1];
      // Rarity has to read at a glance. D9 gives elites three tiers and D13 hangs the
      // refusal mark on them, yet until now all three tiers drew exactly the same.
      const rarity = e.elite && !e.boss ? (e.eliteRarity ?? 'common') : 'common';
      const rarityScale = rarity === 'legendary' ? 1.3 : rarity === 'uplifted' ? 1.13 : 1;
      if (rarity === 'legendary') tint = [tint[0] * 1.75, tint[1] * 1.45, tint[2] * 0.62, tint[3]];
      else if (rarity === 'uplifted') tint = [tint[0] * 0.7, tint[1] * 1.0, tint[2] * 1.5, tint[3]];
      return {
        cell,
        actor,
        w: w * rarityScale,
        h: h * rarityScale,
        tint,
        flip: e.facingX - e.facingZ < 0 ? 1 : 0
      };
    };
    const addVisual = (
      x: number,
      z: number,
      w: number,
      h: number,
      v: { cell: number; actor: string | null },
      tint: [number, number, number, number],
      flip: number
    ) => {
      if (v.actor) addActor(x, z, w, h, v.actor, tint, flip);
      else add(x, z, w, h, v.cell, tint, flip);
    };
    for (const p of s.pickups) {
      const size = p.kind === 'heal' ? 42 : p.kind === 'mutation' ? 38 : p.kind === 'core' ? 30 : 20;
      const cell = p.kind === 'mutation' ? cellFor.core : cellFor[p.kind];
      add(p.x, p.z, size, size, cell, [1, 1, 1, 0.98]);
    }
    for (const c of s.constructs) add(c.x, c.z, 58, 68, cellFor.sentry, [1, 1, 1, 0.95]);

    const hitById = new Map(presentation.hits.map((h) => [h.entity, h]));
    for (const e of s.entities) {
      const bob = Math.sin(s.time * (e.elite ? 2.2 : 3.4) + e.id * 0.71),
        pulse = 1 + (e.elite ? 0.035 : 0.018) * bob,
        v = entityVisual(e, pulse),
        hit = hitById.get(e.id);
      let x = e.x,
        z = e.z,
        w = v.w,
        h = v.h,
        tint = v.tint;
      // Echo phases change the elite's body language as well as the ground telegraph.
      // Tell compresses/charges, active lunges, recovery visibly slumps: gameplay state is readable on the actor.
      if (e.elite && e.echoPhase && e.echoPhase !== 'none') {
        if (e.echoPhase === 'tell') {
          const charge = 1 + 0.035 * Math.sin(s.time * 18);
          w *= charge; h *= 0.92; tint = [Math.min(1.5,tint[0]*1.12), Math.min(1.5,tint[1]*1.12), Math.min(1.5,tint[2]*1.12), tint[3]];
        } else if (e.echoPhase === 'active') {
          x += e.facingX * 0.16; z += e.facingZ * 0.16; w *= 1.12; h *= 1.06;
          tint = [Math.min(1.65,tint[0]*1.35), Math.min(1.65,tint[1]*1.15), Math.min(1.65,tint[2]*1.1), tint[3]];
        } else {
          w *= 1.04; h *= 0.86; tint = [tint[0]*0.78,tint[1]*0.82,tint[2]*0.9,tint[3]];
        }
      }
      if (hit) {
        const t = Math.max(0, Math.min(1, (s.time - hit.start) / hit.ttl)),
          snap = 1 - t,
          kick = (e.elite ? 0.1 : 0.18) * hit.intensity * snap;
        x += hit.dirX * kick;
        z += hit.dirZ * kick;
        w *= 1 + 0.055 * hit.intensity * snap;
        h *= 1 - 0.035 * hit.intensity * snap;
        const flash = (hit.crit ? 0.72 : 0.48) * snap;
        tint = [
          Math.min(1.65, tint[0] + flash),
          Math.min(1.65, tint[1] + flash),
          Math.min(1.65, tint[2] + flash),
          tint[3]
        ];
      }
      addVisual(x, z, w, h, v, tint, v.flip);
    }

    for (const d of presentation.deaths) {
      const t = Math.max(0, Math.min(1, (s.time - d.start) / d.ttl)),
        ease = 1 - Math.pow(1 - t, 2),
        v = entityVisual(d.actor, 1),
        travel = d.actor.elite ? 0.42 : 0.72,
        x = d.x + d.dirX * travel * ease,
        z = d.z + d.dirZ * travel * ease,
        alpha = Math.pow(1 - t, 0.65),
        w = v.w * (1 + 0.18 * ease),
        h = v.h * Math.max(0.2, 1 - 0.76 * ease),
        warm = d.actor.elite ? 0.86 : 0.66;
      addVisual(x, z, w, h, v, [1.12, warm, warm, alpha], v.flip);
    }

    const orbit = s.skills.find((x) => x.id === 'orbit_blades');
    if (orbit) {
      let n = 3 + Math.max(0, Math.round(orbit.count) - 1) + s.resonance.multiplicity;
      if (orbit.level >= 4) n++;
      if (orbit.level >= 7) n++;
      if (orbit.mutation === 'orbit_many') n += 3;
      if (orbit.mutation === 'orbit_saw')
        n = Math.max(2, 2 + Math.max(0, Math.round(orbit.count) - 1) + s.resonance.multiplicity);
      n = Math.min(12, n);
      const geom = orbit.level >= 6 ? 1.28 : orbit.level >= 3 ? 1.12 : 1,
        rad = skills.orbit_blades.baseRadius * Math.sqrt(1 + orbit.coverage) * geom;
      for (let i = 0; i < n; i++) {
        const a = s.time * 3.4 + (i * Math.PI * 2) / n;
        add(
          s.player.x + Math.cos(a) * rad,
          s.player.z + Math.sin(a) * rad,
          13,
          28,
          cellFor.white,
          [0.45, 1, 0.82, 0.92],
          0
        );
      }
    }
    // The dash is worthless if the player cannot see when the window is open, so the hero
    // is lit while invulnerable and merely brightened for the vulnerable tail of the dash.
    const dashing = s.player.dashing === true,
      invulnerable = s.player.invulnerable === true;
    const heroR = invulnerable ? 1.7 : dashing ? 1.2 : 1,
      heroG = invulnerable ? 2.1 : dashing ? 1.3 : 1,
      heroB = invulnerable ? 2.4 : dashing ? 1.5 : 1;
    this.heroTrail.push({ x: s.player.x, z: s.player.z, t: s.time });
    while (this.heroTrail.length > 0 && s.time - this.heroTrail[0].t > 0.26) this.heroTrail.shift();
    if (dashing) {
      const trailFlip = s.player.aimX - s.player.aimZ < 0 ? 1 : 0;
      for (const g of this.heroTrail) {
        const age = (s.time - g.t) / 0.26;
        if (age <= 0.02) continue;
        addActor(
          g.x,
          g.z,
          96 * (1 - age * 0.25),
          120 * (1 - age * 0.25),
          'player_idle',
          [heroR, heroG, heroB, 0.34 * (1 - age)],
          trailFlip
        );
      }
    }
    // Keep the v0.9 locomotion fix: auto-attacks do not restart the dirty 4-frame cast strip.
    // Weapon VFX and canonical combat geometry carry the attack readability instead.
    const playerPulse = 1 + 0.008 * Math.sin(s.time * 4.0),
      moved = Math.hypot(s.player.x - this.lastPlayerX, s.player.z - this.lastPlayerZ) > 0.002,
      flip = s.player.aimX - s.player.aimZ < 0 ? 1 : 0;
    const animDt = Math.max(0, Math.min(0.05, s.time - this.lastPlayerAnimTime));
    this.playerMoveBlend = Math.max(
      0,
      Math.min(1, this.playerMoveBlend + (moved ? animDt * 8.0 : -animDt * 10.0))
    );
    const heroW = 96 * playerPulse,
      heroH = 120 * playerPulse;
    if (this.playerMoveBlend > 0.02) {
      if (this.playerMoveBlend < 0.98)
        addActor(
          s.player.x,
          s.player.z,
          heroW,
          heroH,
          'player_idle',
          [heroR, heroG, heroB, 1 - this.playerMoveBlend],
          flip
        );
      // Four dedicated frames replace the two atlas cells the hero used to share.
      // Cadence matches the old ping-pong: 4.4 steps a second, two steps per cycle.
      const phase = (s.time * 8.8) % PLAYER_RUN_FRAMES,
        frame = Math.floor(phase),
        next = (frame + 1) % PLAYER_RUN_FRAMES,
        w = phase - frame;
      addActor(
        s.player.x,
        s.player.z,
        heroW,
        heroH,
        'player_run_' + frame,
        [heroR, heroG, heroB, this.playerMoveBlend * (1 - w)],
        flip
      );
      addActor(
        s.player.x,
        s.player.z,
        heroW,
        heroH,
        'player_run_' + next,
        [heroR, heroG, heroB, this.playerMoveBlend * w],
        flip
      );
    } else
      addActor(s.player.x, s.player.z, heroW, heroH, 'player_idle', [heroR, heroG, heroB, 1], flip);
    this.lastPlayerX = s.player.x;
    this.lastPlayerZ = s.player.z;
    this.lastPlayerAnimTime = s.time;

    list.sort((a, b) => a.sort - b.sort);
    const stride = 13;
    this.ensureSprite(list.length * stride);
    let o = 0;
    for (const q of list) {
      this.spriteData[o++] = q.x;
      this.spriteData[o++] = q.z;
      this.spriteData[o++] = q.w;
      this.spriteData[o++] = q.h;
      this.spriteData[o++] = q.u0;
      this.spriteData[o++] = q.v0;
      this.spriteData[o++] = q.u1;
      this.spriteData[o++] = q.v1;
      this.spriteData[o++] = q.tint[0];
      this.spriteData[o++] = q.tint[1];
      this.spriteData[o++] = q.tint[2];
      this.spriteData[o++] = q.tint[3];
      this.spriteData[o++] = q.flip;
    }
    const gl = this.gl,
      p = this.spriteProgram;
    gl.useProgram(p);
    this.commonUniforms(p, s);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(gl.getUniformLocation(p, 'u_tex'), 0);
    gl.bindVertexArray(this.spriteVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteInstance);
    // Sorted order is what keeps overlap correct, so the batch is cut into runs of a
    // single texture rather than regrouped. See 23_DISPUTED_QUESTIONS_LOG.md, S2.
    let runStart = 0;
    while (runStart < list.length) {
      const tex = list[runStart].tex;
      let runEnd = runStart + 1;
      while (runEnd < list.length && list[runEnd].tex === tex) runEnd++;
      gl.bindTexture(gl.TEXTURE_2D, tex === TEX_ACTORS ? this.actorTex : this.atlas);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        this.spriteData.subarray(runStart * stride, runEnd * stride),
        gl.DYNAMIC_DRAW
      );
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, runEnd - runStart);
      runStart = runEnd;
    }
    gl.bindVertexArray(null);
  }

  private ensureSprite(n: number) {
    if (this.spriteData.length < n)
      this.spriteData = new Float32Array(Math.max(n, Math.ceil(n * 1.4)));
  }
  private ensureShape(n: number) {
    if (this.shapeData.length < n)
      this.shapeData = new Float32Array(Math.max(n, Math.ceil(n * 1.4)));
  }
  private pushLine(
    v: number[],
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    w: number,
    c: [number, number, number, number]
  ) {
    const dx = x2 - x1,
      dy = y2 - y1,
      l = Math.hypot(dx, dy) || 1,
      nx = (-dy / l) * w * 0.5,
      ny = (dx / l) * w * 0.5;
    const pts = [
      [x1 + nx, y1 + ny],
      [x1 - nx, y1 - ny],
      [x2 + nx, y2 + ny],
      [x2 + nx, y2 + ny],
      [x1 - nx, y1 - ny],
      [x2 - nx, y2 - ny]
    ];
    for (const p of pts) v.push(p[0], p[1], ...c);
  }
  private pushRect(
    v: number[],
    x: number,
    y: number,
    w: number,
    h: number,
    c: [number, number, number, number]
  ) {
    const pts = [
      [x, y],
      [x + w, y],
      [x, y + h],
      [x, y + h],
      [x + w, y],
      [x + w, y + h]
    ];
    for (const p of pts) v.push(p[0], p[1], ...c);
  }
  private pushTri(
    v: number[],
    a: { x: number; y: number },
    b: { x: number; y: number },
    d: { x: number; y: number },
    c: [number, number, number, number]
  ) {
    for (const p of [a, b, d]) v.push(p.x, p.y, ...c);
  }

  private makeSpriteVao(): [WebGLVertexArrayObject, WebGLBuffer] {
    const gl = this.gl,
      vao = gl.createVertexArray()!,
      quad = gl.createBuffer()!,
      inst = gl.createBuffer()!;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -0.5, -1, 0, 0, 0.5, -1, 1, 0, -0.5, 0, 0, 1, -0.5, 0, 0, 1, 0.5, -1, 1, 0, 0.5, 0, 1, 1
      ]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
    gl.bindBuffer(gl.ARRAY_BUFFER, inst);
    const stride = 13 * 4;
    this.instAttrib(2, 2, stride, 0);
    this.instAttrib(3, 2, stride, 8);
    this.instAttrib(4, 4, stride, 16);
    this.instAttrib(5, 4, stride, 32);
    this.instAttrib(6, 1, stride, 48);
    gl.bindVertexArray(null);
    return [vao, inst];
  }
  private makeShapeVao(): [WebGLVertexArrayObject, WebGLBuffer] {
    const gl = this.gl,
      vao = gl.createVertexArray()!,
      quad = gl.createBuffer()!,
      inst = gl.createBuffer()!;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, inst);
    const stride = 8 * 4;
    this.instAttrib(1, 2, stride, 0);
    this.instAttrib(2, 1, stride, 8);
    this.instAttrib(3, 1, stride, 12);
    this.instAttrib(4, 4, stride, 16);
    gl.bindVertexArray(null);
    return [vao, inst];
  }
  private makeLineVao(): [WebGLVertexArrayObject, WebGLBuffer] {
    const gl = this.gl,
      vao = gl.createVertexArray()!,
      buf = gl.createBuffer()!;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 24, 8);
    gl.bindVertexArray(null);
    return [vao, buf];
  }
  private instAttrib(loc: number, size: number, stride: number, offset: number) {
    const gl = this.gl;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
    gl.vertexAttribDivisor(loc, 1);
  }
  private program(vs: string, fs: string) {
    const gl = this.gl,
      compile = (type: number, src: string) => {
        const sh = gl.createShader(type)!;
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
          throw new Error(gl.getShaderInfoLog(sh) || 'shader compile');
        return sh;
      };
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(p) || 'program link');
    return p;
  }
  private async loadTexture(url: string, repeat = false) {
    const img = new Image();
    img.src = url;
    await img.decode();
    const gl = this.gl,
      t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_S,
      repeat ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE
    );
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_T,
      repeat ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE
    );
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    return t;
  }
}

const GROUND_VS = `#version 300 es
precision highp float;void main(){float x=gl_VertexID==1?3.0:-1.0;float y=gl_VertexID==2?3.0:-1.0;gl_Position=vec4(x,y,0.0,1.0);}`;
const GROUND_FS = `#version 300 es
precision highp float;uniform vec2 u_resolution,u_camera,u_iso,u_center;uniform float u_time,u_seed;uniform sampler2D u_floor;out vec4 outColor;
float hash21(vec2 p){p+=u_seed*.013;return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.52;mat2 r=mat2(.80,-.60,.60,.80);for(int i=0;i<5;i++){v+=a*noise2(p);p=r*p*2.03+vec2(13.1,7.7);a*=.49;}return v;}
float ridged(vec2 p){float n=fbm(p);return 1.-abs(n*2.-1.);}
float plateEdge(vec2 w){vec2 g=floor(w/6.5),f=fract(w/6.5)-.5;float ang=(hash21(g)-.5)*1.6;mat2 r=mat2(cos(ang),-sin(ang),sin(ang),cos(ang));f=r*f;float d=min(abs(abs(f.x)-.48),abs(abs(f.y)-.48));return 1.-smoothstep(.018,.065,d);}
float fracture(vec2 w){float n=fbm(w*.18+vec2(31.7,-12.));float q=abs(fract((w.x*.23+w.y*.11)+n*2.2)-.5);float branch=abs(fract((w.x*.07-w.y*.31)+noise2(w*.12)*1.7)-.5);return (1.-smoothstep(.012,.045,q))*.65+(1.-smoothstep(.01,.035,branch))*.35;}
void main(){vec2 scr=vec2(gl_FragCoord.x,u_resolution.y-gl_FragCoord.y);vec2 c=u_resolution*u_center;float aa=(scr.x-c.x)/u_iso.x,bb=(scr.y-c.y)/u_iso.y;vec2 w=u_camera+vec2((aa+bb)*.5,(bb-aa)*.5);
  // Keep the archive/library floor as the visual identity. Procedural work now breaks
  // repetition and adds age/wear instead of repainting the whole world into generic rock.
  vec2 tuv=(w+vec2(120.,-73.))/31.;vec3 archive=texture(u_floor,tuv).rgb;vec3 archive2=texture(u_floor,tuv*.51+vec2(.37,.19)).rgb;archive=mix(archive,archive2,.10);
  float continent=fbm(w*.026+vec2(u_seed*.001,0.)),relief=ridged(w*.06+vec2(4.2,-8.7)),wet=fbm(w*.075+vec2(-14.,19.));
  vec3 age=mix(vec3(.082,.069,.077),vec3(.076,.093,.091),smoothstep(.32,.72,continent));age=mix(age,vec3(.055,.082,.066),smoothstep(.72,.94,wet)*.28);
  vec3 stone=mix(archive,age,.16);float crack=clamp(fracture(w),0.,1.),pe=plateEdge(w+fbm(w*.12)*1.6);stone=mix(stone,stone*.62,crack*.24);stone*=1.-pe*.035;
  float wear=1.-smoothstep(.05,.17,abs(fbm(w*.034+vec2(50.,-20.))-.52));stone=mix(stone,stone*vec3(1.08,1.055,1.02),wear*.10);
  float seam=smoothstep(.92,.985,ridged(w*.19+vec2(-8.,4.)))*smoothstep(.66,.93,relief);stone+=seam*vec3(.012,.025,.022);
  vec2 cell=floor(w/12.),cf=fract(w/12.)-.5;float rare=step(.982,hash21(cell)),rune=rare*(1.-smoothstep(.018,.052,min(abs(cf.x),abs(cf.y))))*step(.2,length(cf));stone+=rune*vec3(.016,.055,.048);
  vec2 uv=scr/u_resolution;float vig=1.-smoothstep(.42,1.04,length((uv-.5)*vec2(1.,u_resolution.y/u_resolution.x)));stone*=.78+.22*vig;outColor=vec4(stone,1.0);} `
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
