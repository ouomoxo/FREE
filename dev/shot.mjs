#!/usr/bin/env node
/**
 * Visual QA harness.
 *
 * Boots a static server over the project, drives Chromium through a list of
 * pages/viewports, and writes full-page screenshots plus any console errors to
 * the output directory. Used throughout development to review the design at
 * real size rather than guessing.
 *
 * Usage:  node dev/shot.mjs [outDir] [--only=name]
 */

import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '/tmp/shots';
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(req.url.split('?')[0]);
    if (path.endsWith('/')) path += 'index.html';
    const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''));
    if (!existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch (err) {
    res.writeHead(500);
    res.end(String(err));
  }
});

const PORT = 8137;
await new Promise((r) => server.listen(PORT, r));

/**
 * Scenarios that need interaction before the screenshot. Each receives the
 * page; the harness screenshots whatever state it leaves behind.
 * @type {Record<string, (page: import('playwright').Page) => Promise<void>>}
 */
const ACTIONS = {
  /** Start the first movement of the featured record and let it get going. */
  async play(page) {
    await page.click('.track >> nth=0');
    await page.waitForTimeout(2600);
  },
  /** Play, then open the full-screen view. */
  async playConcert(page) {
    await page.click('.track >> nth=0');
    await page.waitForTimeout(1200);
    await page.keyboard.press('f');
    await page.waitForTimeout(2600);
  },
  /** Open the command palette with a query typed in. */
  async palette(page) {
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(200);
    await page.keyboard.type('noct');
    await page.waitForTimeout(400);
  },
  /** Type a search query. */
  async search(page) {
    await page.fill('.searchbox input', 'hands');
    await page.waitForTimeout(600);
  },
  /** Save a few things so the library has content. */
  async library(page) {
    await page.evaluate(() => {
      localStorage.setItem('maestro.v1.library.liked', JSON.stringify(['op27-1', 'op27-4', 'nocturnes-2', 'toccatas-3']));
      localStorage.setItem('maestro.v1.library.likedAlbums', JSON.stringify(['op27', 'nocturnes']));
      localStorage.setItem('maestro.v1.library.recent', JSON.stringify(['op27-1', 'sinfonia-2', 'thirty-6']));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1400);
  },
};

/** @type {Array<{name:string, path:string, width:number, height:number, wait?:number, full?:boolean, action?:string}>} */
const SHOTS = [
  { name: 'lab',          path: '/dev/art-lab.html',  width: 1280, height: 1200, full: true },
  { name: 'home-desktop', path: '/',                  width: 1600, height: 1000, wait: 1400 },
  { name: 'home-wide',    path: '/',                  width: 1920, height: 1080, wait: 1400 },
  { name: 'home-laptop',  path: '/',                  width: 1280, height: 800,  wait: 1400 },
  { name: 'home-tablet',  path: '/',                  width: 900,  height: 1000, wait: 1400 },
  { name: 'home-mobile',  path: '/',                  width: 390,  height: 844,  wait: 1400 },
  { name: 'album',        path: '/#/album/op27',      width: 1600, height: 1000, wait: 1400 },
  { name: 'artist',       path: '/#/artist/vantor',   width: 1600, height: 1000, wait: 1400 },
  { name: 'search',       path: '/#/search',          width: 1600, height: 1000, wait: 1400 },
  { name: 'library',      path: '/#/library',         width: 1600, height: 1000, wait: 1400 },
  { name: 'concert',      path: '/#/concert',         width: 1600, height: 1000, wait: 1400 },
  { name: 'playing',      path: '/#/album/op27',      width: 1600, height: 1000, wait: 1400, action: 'play' },
  { name: 'playing-wide', path: '/#/album/sinfonia',  width: 1920, height: 1080, wait: 1400, action: 'play' },
  { name: 'concert-live', path: '/#/album/dotmatrix', width: 1600, height: 1000, wait: 1400, action: 'playConcert' },
  { name: 'palette',      path: '/',                  width: 1600, height: 1000, wait: 1400, action: 'palette' },
  { name: 'search-query', path: '/#/search',          width: 1600, height: 1000, wait: 1400, action: 'search' },
  { name: 'library-full', path: '/#/library',         width: 1600, height: 1000, wait: 1400, action: 'library' },
  { name: 'playing-mobile', path: '/#/album/op27',    width: 390,  height: 844,  wait: 1400, action: 'play' },
  { name: 'queue',        path: '/#/queue',           width: 1600, height: 1000, wait: 1400 },
  { name: 'playlist',     path: '/#/playlist/tonight', width: 1600, height: 1000, wait: 1400 },
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  // Let the AudioContext start without a gesture so scripted scenarios can
  // capture the app while it is actually sounding.
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const report = [];

for (const shot of SHOTS) {
  if (ONLY && !shot.name.includes(ONLY)) continue;
  const ctx = await browser.newContext({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: 2,
    reducedMotion: 'no-preference',
  });
  const page = await ctx.newPage();
  /** @type {string[]} */
  const problems = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));

  try {
    await page.goto(`http://localhost:${PORT}${shot.path}`, { waitUntil: 'networkidle', timeout: 20000 });
    if (shot.wait) await page.waitForTimeout(shot.wait);
    if (shot.action) await ACTIONS[shot.action](page);
    await page.screenshot({ path: join(OUT, `${shot.name}.png`), fullPage: !!shot.full });
  } catch (err) {
    problems.push(`navigation: ${err.message}`);
  }
  report.push({ name: shot.name, problems });
  await ctx.close();
}

await browser.close();
server.close();

await writeFile(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
for (const r of report) {
  console.log(`${r.problems.length ? '✗' : '✓'} ${r.name}${r.problems.length ? ` (${r.problems.length})` : ''}`);
  for (const p of r.problems.slice(0, 12)) console.log(`    ${p}`);
}
