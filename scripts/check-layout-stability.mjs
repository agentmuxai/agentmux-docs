#!/usr/bin/env node
// Layout-stability check for the built site (run after `npm run build`).
//
// Serves dist/ itself, loads pages in Chromium with real (non-overlay)
// scrollbars, a cold cache and a throttled connection, and samples every
// animation frame from the first paint on. It fails if, during load:
//   - the page's usable width changes (a scrollbar appearing or disappearing
//     shifts the layout sideways), or
//   - the header or the sidebar, once in the DOM, is ever invisible
//     (opacity 0 or visibility hidden: a "hide until JS runs" mask).
//
// Both regressions shipped before and were found by eye. This makes them a
// test. Usage: node scripts/check-layout-stability.mjs [port]
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const port = Number(process.argv[2] || 4329);
const base = `http://127.0.0.1:${port}`;
const pages = ['/', '/user-guide/', '/internals/agent-pane-virtualization/']
  .filter((p) => existsSync(`dist${p}index.html`));
const viewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 500 },
];

if (!existsSync('dist/index.html')) {
  console.error('dist/ is missing: run `npm run build` first');
  process.exit(2);
}

// A small static server for dist/, in this process. (`astro preview` re-spawns
// itself as a detached child that its parent can't reliably stop.)
const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain',
};
const root = resolve('dist');
const server = createServer(async (req, res) => {
  try {
    let file = resolve(root, '.' + decodeURIComponent(new URL(req.url, base).pathname));
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(port, '127.0.0.1', ok));

// Runs in the page before any of its own scripts.
function sampler() {
  const log = (window.__layout = []);
  const t0 = performance.now();
  const vis = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && Number(cs.opacity) > 0;
  };
  const sample = () => {
    if (!document.body) return;
    log.push({
      at: performance.now(),
      t: Math.round(performance.now() - t0),
      width: document.documentElement.clientWidth,
      header: vis(document.querySelector('header.header')),
      sidebar: vis(document.getElementById('starlight__sidebar')),
    });
  };
  const frame = () => { sample(); if (performance.now() - t0 < 6000) requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
  document.addEventListener('DOMContentLoaded', sample);
  window.addEventListener('load', sample);
}

const failures = [];
let browser;
try {
  browser = await chromium.launch({
    ignoreDefaultArgs: ['--hide-scrollbars'],
    args: ['--disable-features=OverlayScrollbar,OverlayScrollbars'],
  });
  for (const viewport of viewports) {
    for (const path of pages) {
      const context = await browser.newContext({ viewport });   // cold cache
      await context.addInitScript(sampler);
      const page = await context.newPage();
      // A real connection streams the HTML, so the browser paints partial pages;
      // served locally at full speed, the page is complete before its first
      // paint and a scrollbar shift never shows. Throttle like "Fast 3G".
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8,
      });
      await page.goto(base + path, { waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(1500);
      // Only frames from the first paint on: earlier ones are laid out before the
      // render-blocking stylesheets have loaded and are never shown.
      const log = await page.evaluate(() => {
        const fp = performance.getEntriesByType('paint').find((e) => e.name === 'first-paint');
        return window.__layout.filter((s) => !fp || s.at >= fp.startTime);
      });
      await context.close();

      const where = `${path} at ${viewport.width}x${viewport.height}`;
      const before = failures.length;
      const widths = [...new Set(log.map((s) => s.width))];
      if (widths.length > 1) {
        failures.push(`${where}: page width changed during load (${widths.join(' -> ')} px): a scrollbar shift`);
      }
      // Which parts this page has, from its built HTML (the splash homepage has
      // no sidebar). A part the HTML has but the page never matched means the
      // selector no longer fits (e.g. after a Starlight upgrade): fail rather
      // than pass without checking anything.
      const html = await readFile(`dist${path}index.html`, 'utf8');
      const expected = { header: html.includes('class="header'), sidebar: html.includes('id="starlight__sidebar"') };
      if (!expected.header) failures.push(`${where}: no header in the built page (layout changed?)`);
      for (const part of ['header', 'sidebar']) {
        if (!expected[part]) continue;
        if (!log.some((s) => s[part] !== null)) {
          failures.push(`${where}: the ${part} was not found (selector changed?)`);
          continue;
        }
        const hidden = log.find((s) => s[part] === false);
        if (hidden) failures.push(`${where}: the ${part} was invisible at ${hidden.t} ms`);
      }
      console.log(`${failures.length > before ? 'FAIL' : 'ok  '} ${where}: ${log.length} frames, width ${widths.join('/')} px`);
    }
  }
} finally {
  if (browser) await browser.close();
  server.close();
}

if (failures.length) {
  console.error(`\nLayout stability check failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`\nLayout stable: ${pages.length} pages x ${viewports.length} window sizes.`);
