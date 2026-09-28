// GitHub Pages-only browser entrypoint.
// It deliberately uses import.meta.url so the game works from a project path such as /-/.
const entry = new URL('./dist/platform/main.js', import.meta.url);

try {
  await import(entry.href);
} catch (error) {
  console.error('GitHub Pages launcher failed:', error);
  const panel = document.createElement('div');
  panel.setAttribute('role', 'alert');
  panel.style.cssText = [
    'position:fixed',
    'inset:20px',
    'z-index:99999',
    'padding:18px 20px',
    'background:#1a1010',
    'border:1px solid #8b3a3a',
    'color:#f3dddd',
    'font:14px/1.45 system-ui,sans-serif',
    'white-space:pre-wrap',
    'overflow:auto'
  ].join(';');
  panel.textContent = 'Не удалось запустить GitHub Pages-сборку.\n\n' +
    (error instanceof Error ? (error.stack || error.message) : String(error));
  document.body.append(panel);
}
