// Browser frame profiler (dev tool, not part of npm test).
//
// Starts the local server and a headless Chrome, opens the game with the autoplay/perf harness
// (`?autoplay=1&warp=N`), then reports the in-game per-frame cost breakdown
// (window.__roguePerf) and a sampled CPU profile grouped by function.
//
//   node scripts/perf_browser.mjs --warp 300 --start sentry --measure 10 --profile 8
//   node scripts/perf_browser.mjs --headed          (visible window, real GPU)
//
// Requires `npm run build` first. Uses only Node built-ins (Node >= 22 for WebSocket).
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
};
const flag = (name) => process.argv.includes('--' + name);
const warp = Number(arg('warp', '300'));
const start = arg('start', 'sentry');
const seed = arg('seed', '12345');
const measureSec = Number(arg('measure', '10'));
const profileSec = Number(arg('profile', '8'));
const port = Number(arg('port', '8093'));
const debugPort = Number(arg('debug-port', '9333'));
const headed = flag('headed');
const extra = arg('query', '');

const root = fileURLToPath(new URL('../', import.meta.url));
const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean);
const chromePath = chromeCandidates.find((p) => existsSync(p));
if (!chromePath) throw new Error('Chrome/Edge not found; set CHROME_PATH');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
const profileDir = mkdtempSync(join(tmpdir(), 'rogue-perf-'));
const chrome = spawn(chromePath, [
  ...(headed ? [] : ['--headless=new']),
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`,
  `--window-size=${arg('size', '1600,900')}`,
  ...(arg('scale', '') ? [`--force-device-scale-factor=${arg('scale', '1')}`] : []),
  '--ignore-gpu-blocklist',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank'
], { stdio: 'ignore' });

function cleanup() {
  try { chrome.kill(); } catch {}
  try { server.kill(); } catch {}
}
process.on('exit', cleanup);

async function waitJson(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch {}
    await sleep(250);
  }
  throw new Error('timeout: ' + url);
}

await waitJson(`http://127.0.0.1:${port}/`).catch(() => {});
await waitJson(`http://127.0.0.1:${debugPort}/json/version`);
const url = `http://127.0.0.1:${port}/?autoplay=1&warp=${warp}&start=${start}&seed=${seed}${extra ? '&' + extra : ''}`;
const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
let nextId = 1;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(typeof m.data === 'string' ? m.data : m.data.toString());
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value;
};

await send('Runtime.enable');
let frames = 0;
for (let i = 0; i < 240 && frames < 60; i++) {
  await sleep(500);
  frames = (await evaluate('window.__roguePerf ? window.__roguePerf.frames : 0')) ?? 0;
}
if (frames < 60) {
  console.error('game did not start rendering; last frames =', frames);
  process.exit(1);
}
const gpu = await evaluate(`(() => { const c = document.createElement('canvas').getContext('webgl2'); const e = c && c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; })()`);

await sleep(1500);
await evaluate('window.__roguePerf.reset()');
await sleep(measureSec * 1000);
const book = await evaluate(`(() => { const p = window.__roguePerf; const ms = [...p.frameMs].sort((a,b)=>a-b); return { frames: p.frames, sums: p.sums, p50: ms[Math.floor(ms.length*.5)], p95: ms[Math.floor(ms.length*.95)], max: ms[ms.length-1] }; })()`);

await send('Profiler.enable');
await send('Profiler.setSamplingInterval', { interval: 200 });
await send('Profiler.start');
await sleep(profileSec * 1000);
const { result } = await send('Profiler.stop');
const profile = result.profile;
const intervalMs = profile.timeDeltas.reduce((a, b) => a + b, 0) / 1000 / Math.max(1, profile.samples.length);
const selfByKey = new Map();
let totalSamples = 0;
for (const node of profile.nodes) {
  const cf = node.callFrame;
  const file = cf.url ? cf.url.replace(/^.*\/(dist|public)\//, '$1/') : '';
  const key = `${cf.functionName || '(anonymous)'}  ${file}${file ? ':' + (cf.lineNumber + 1) : ''}`;
  selfByKey.set(key, (selfByKey.get(key) ?? 0) + (node.hitCount ?? 0));
  totalSamples += node.hitCount ?? 0;
}
const top = [...selfByKey.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);

const n = Math.max(1, book.frames);
console.log(`GPU: ${gpu}\nURL: ${url}`);
console.log(`frames in ${measureSec}s: ${book.frames}  frame p50 ${book.p50?.toFixed(1)} ms  p95 ${book.p95?.toFixed(1)} ms  max ${book.max?.toFixed(1)} ms`);
console.log('per-frame CPU (ms):');
for (const [k, v] of Object.entries(book.sums).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(22)} ${(v / n).toFixed(2)}`);
console.log(`\nCPU profile ${profileSec}s, self time top (${totalSamples} samples, ~${intervalMs.toFixed(2)} ms each):`);
for (const [k, v] of top) console.log(`  ${((v / Math.max(1, totalSamples)) * 100).toFixed(1).padStart(5)}%  ${k}`);
ws.close();
cleanup();
process.exit(0);
