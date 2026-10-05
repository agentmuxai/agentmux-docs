#!/usr/bin/env node
// Navigation paint check for the built site (run after `npm run build`).
//
// A first visit to a page loads its HTML over the network, and Chromium can
// paint the new page as soon as the header is parsed: one frame with an empty
// content area, seen as a flash on every first visit (revisits come from cache
// and don't show it). astro.config.mjs holds the first paint until the content
// is parsed (`rel=expect` on #sl-content-end); this check makes sure it stays so.
//
// Serves dist/ with a network-like delay on HTML only, opens page A, clicks a
// link to page B, records every painted frame (CDP screencast), and fails if
// any frame after the click has a blank content area.
// Usage: node scripts/check-navigation-paint.mjs [htmlDelayMs=150] [port]
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const delay = Number(process.argv[2] || 150);
const port = Number(process.argv[3] || 4350);
const base = `http://127.0.0.1:${port}`;
const from = '/internals/ipc-catalog/';
const to = '/internals/reducer-stack/';
if (!existsSync(`dist${from}index.html`) || !existsSync(`dist${to}index.html`)) {
  console.error(`build first (or update the page pair: ${from} -> ${to})`);
  process.exit(2);
}

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
const root = resolve('dist');
const server = createServer(async (req, res) => {
  try {
    let file = resolve(root, '.' + decodeURIComponent(new URL(req.url, base).pathname));
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
    if (extname(file) === '.html') await sleep(delay);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }).end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise((ok) => server.listen(port, '127.0.0.1', ok));

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
await page.goto(base + from, { waitUntil: 'load' });
await page.waitForTimeout(800);

const cdp = await context.newCDPSession(page);
const frames = [];
cdp.on('Page.screencastFrame', async (f) => {
  frames.push({ t: f.metadata.timestamp, data: f.data });
  await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
await page.waitForTimeout(300);
const t0 = Date.now() / 1000;
await page.click(`a[href="${to}"]`);
await page.waitForURL(base + to);
await page.waitForLoadState('load');
await page.waitForTimeout(1000);
await cdp.send('Page.stopScreencast');

// Analyse frames in a blank page: luminance spread of the content area.
const analyser = await context.newPage();
const results = [];
for (const f of frames) {
  const stats = await analyser.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const region = (x, y, w, h) => {
      const d = g.getImageData(x, y, w, h).data;
      let sum = 0, sq = 0, n = 0;
      for (let i = 0; i < d.length; i += 4 * 7) { const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; sum += l; sq += l * l; n++; }
      const mean = sum / n;
      return { mean: Math.round(mean), sd: Math.round(Math.sqrt(Math.max(0, sq / n - mean * mean))) };
    };
    return {
      header: region(0, 0, img.width, Math.round(img.height * 0.08)),
      content: region(Math.round(img.width * 0.3), Math.round(img.height * 0.15), Math.round(img.width * 0.5), Math.round(img.height * 0.6)),
    };
  }, f.data);
  results.push({ t: Math.round((f.t - t0) * 1000), ...stats });
}
await browser.close();
server.close();

const blank = results.filter((r) => r.t >= 0 && r.content.sd < 3);
console.log(`${from} -> ${to}, HTML delay ${delay} ms: ${results.length} frames, ${blank.length} with a blank content area`);
if (blank.length) {
  for (const r of results) console.log(`  t=${r.t}ms content mean/sd=${r.content.mean}/${r.content.sd}${r.content.sd < 3 ? '   <-- blank' : ''}`);
  console.error('Navigation paint check failed: a frame with an empty content area was painted (see astro.config.mjs `rel=expect`).');
  process.exit(1);
}
