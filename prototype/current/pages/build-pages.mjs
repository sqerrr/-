import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const publicDir = join(projectRoot, 'public');
const distDir = join(projectRoot, 'dist');
const pagesDir = join(projectRoot, 'pages-dist');
const launcherSource = join(projectRoot, 'pages', 'pages-launcher.js');

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path));
    else out.push(path);
  }
  return out;
}

await rm(pagesDir, { recursive: true, force: true });
await mkdir(pagesDir, { recursive: true });
await cp(publicDir, pagesDir, { recursive: true });
await cp(distDir, join(pagesDir, 'dist'), { recursive: true });
await cp(launcherSource, join(pagesDir, 'pages-launcher.js'));

const indexPath = join(pagesDir, 'index.html');
let html = await readFile(indexPath, 'utf8');
const localEntrypoint = /<script\s+type=["']module["']\s+src=["']\/dist\/platform\/main\.js[^"']*["']><\/script>/i;
if (!localEntrypoint.test(html)) {
  throw new Error('GitHub Pages build: local browser entrypoint was not found in public/index.html');
}
html = html.replace(localEntrypoint, '<script type="module" src="./pages-launcher.js"></script>');
await writeFile(indexPath, html);

// The local server mounts public/ at domain root, so runtime assets are intentionally
// root-relative there. A project GitHub Pages site lives under /<repo>/ instead.
// Patch only the deployed copy; source/local behaviour remains unchanged.
let patchedFiles = 0;
let patchedRefs = 0;
for (const file of await walk(join(pagesDir, 'dist'))) {
  if (extname(file) !== '.js') continue;
  const before = await readFile(file, 'utf8');
  let after = before;
  for (const [from, to] of [
    ["'/assets/", "'./assets/"],
    ['"/assets/', '"./assets/'],
    ['\`/assets/', '\`./assets/']
  ]) {
    const count = after.split(from).length - 1;
    if (count > 0) {
      patchedRefs += count;
      after = after.split(from).join(to);
    }
  }
  if (after !== before) {
    patchedFiles += 1;
    await writeFile(file, after);
  }
}

await writeFile(join(pagesDir, '.nojekyll'), '');
console.log(`GitHub Pages bundle ready: ${pagesDir}`);
console.log(`Pages-only asset rewrites: ${patchedRefs} references in ${patchedFiles} JS files`);
