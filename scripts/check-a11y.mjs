// Runs axe-core's WCAG 2.0/2.1/2.2 A and AA rules on every built page, in both the dark and the
// light theme, and fails on any serious or critical violation. The rules for visuals it backs are
// in agentmux-landing's specs/SPEC_LANDING_VISUALS_2026_10_12.md §8; the generated API reference
// under /api/ is skipped (its HTML comes from typedoc and rustdoc, not from this site).
//
// Usage: npm run build && node scripts/check-a11y.mjs [--only <path-prefix>]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, relative, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const FAIL_ON = new Set(['serious', 'critical']);
// Known violations that come from Starlight or Expressive Code themselves, on every page. They
// are still printed, but don't fail the check, so that everything else can. Remove an entry
// once it's fixed.
const KNOWN = {
  'label-content-name-mismatch':
    "Starlight's search button: its accessible name is \"Search\", its visible text \"Search Ctrl K\" (upstream).",
  'scrollable-region-focusable':
    "Expressive Code's horizontally scrolling <pre> blocks aren't focusable (Chromium 130+ makes scrollers focusable itself; other browsers don't).",
};
const THEMES = ['dark', 'light'];
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const onlyIdx = process.argv.indexOf('--only');
const only = onlyIdx > 0 ? process.argv[onlyIdx + 1] : null;

const root = resolve('dist');
function pages(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) pages(p, out);
    else if (name === 'index.html') out.push('/' + relative(root, dir).split(sep).join('/') + (dir === root ? '' : '/'));
  }
  return out;
}
// Redirect pages (Astro's `redirects`) only hold a meta refresh: nothing to check, and they
// navigate away mid-run.
const isRedirect = (r) => /<meta http-equiv="refresh"/i.test(readFileSync(join(root, r, 'index.html'), 'utf8'));
const routes = pages(root)
  .map((r) => r.replace(/^\/\//, '/'))
  .filter((r) => !r.startsWith('/api/') && (!only || r.startsWith(only)) && !isRedirect(r))
  .sort();
if (routes.length === 0) {
  console.error('check-a11y: no pages in dist/ (run `npm run build` first)');
  process.exit(2);
}

// A small static server for dist/ on a free port, in this process.
const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain',
};
const server = createServer(async (req, res) => {
  try {
    let file = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
let failures = 0;
const known = new Map(); // rule id -> pages it was seen on (both themes)
try {
  for (const theme of THEMES) {
    // A fresh context per theme: Starlight follows prefers-color-scheme when nothing is stored.
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    for (const route of routes) {
      await page.goto(base + route, { waitUntil: 'load' });
      const actual = await page.evaluate(() => document.documentElement.dataset.theme);
      if (actual !== theme) throw new Error(`${route}: expected the ${theme} theme, the page is ${actual}`);
      await page.addScriptTag({ content: axeSource });
      const violations = await page.evaluate(async (tags) => {
        const r = await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
        return r.violations.map((v) => ({
          id: v.id, impact: v.impact, help: v.help,
          nodes: v.nodes.map((n) => ({ target: n.target.join(' '), why: (n.failureSummary || '').split('\n').slice(1).join(' ').trim() })),
        }));
      }, TAGS);
      const bad = violations.filter((v) => FAIL_ON.has(v.impact) && !KNOWN[v.id]);
      failures += bad.length;
      for (const v of violations.filter((v) => KNOWN[v.id])) known.set(v.id, (known.get(v.id) ?? 0) + 1);
      const shown = violations.filter((v) => !KNOWN[v.id]);
      if (shown.length) {
        console.log(`${bad.length ? 'FAIL' : 'note'} [${theme}] ${route}`);
        for (const v of shown) {
          console.log(`     [${v.impact}] ${v.id}: ${v.help}`);
          for (const n of v.nodes.slice(0, 3)) console.log(`        ${n.target}  ${n.why}`);
        }
      }
    }
    await context.close();
    console.log(`[${theme}] ${routes.length} pages checked`);
  }
} finally {
  await browser.close();
  server.close();
}
for (const [id, n] of known) console.log(`known: ${id} on ${n} page(s): ${KNOWN[id]}`);
if (failures) {
  console.error(`check-a11y: ${failures} serious or critical WCAG violation(s)`);
  process.exit(1);
}
console.log(`check-a11y: ${routes.length} pages × ${THEMES.length} themes, no serious or critical WCAG 2.2 A/AA violations`);
