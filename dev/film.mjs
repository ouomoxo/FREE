#!/usr/bin/env node
/**
 * Film the piece.
 *
 * Boots the same static server the screenshot harness uses and drives one
 * continuous take: the prelude from the first movement to the door, the way
 * in, and a few bars of the hall playing.
 *
 * The page is filmed on a **virtual clock**. `performance.now`, `Date.now`,
 * `requestAnimationFrame` and the timer functions are all replaced before any
 * of the application loads, and the harness advances them by exactly one frame
 * at a time. Nothing is dropped, nothing stutters, and a screenshot that takes
 * a tenth of a second to capture still represents one thirtieth of a second of
 * the piece. Frames go straight into ffmpeg over a pipe as lossless PNG, so
 * the near-black — which is most of this design — is never handed to a
 * low-bitrate intermediate codec.
 *
 * Usage:  node dev/film.mjs [outFile.mp4]
 */

import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function loadPlaywright() {
  for (const id of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(id); } catch { /* try the next */ }
  }
  console.error('Playwright not found.');
  process.exit(2);
}
const { chromium } = loadPlaywright();

const CHROME = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const FFMPEG = process.env.FFMPEG_PATH
  || '/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = process.argv[2] || '/tmp/maestro.mp4';

const W = 1600;
const H = 900;
const FPS = 30;
const DT = 1000 / FPS;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serve() {
  const server = createServer(async (req, res) => {
    let path = normalize(decodeURIComponent(req.url.split('?')[0]));
    if (path.endsWith('/')) path += 'index.html';
    const file = join(ROOT, path);
    if (!file.startsWith(ROOT) || !existsSync(file)) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/** Installed before anything else on the page. See the note at the top. */
const VIRTUAL_CLOCK = () => {
  let now = 0;
  let seq = 1;
  const frames = new Map();
  const timers = new Map();

  performance.now = () => now;
  Date.now = () => 1700000000000 + now;

  window.requestAnimationFrame = (cb) => { const id = seq++; frames.set(id, cb); return id; };
  window.cancelAnimationFrame = (id) => { frames.delete(id); };

  window.setTimeout = (cb, ms = 0, ...args) => {
    const id = seq++;
    timers.set(id, { cb, args, at: now + Math.max(0, ms) });
    return id;
  };
  window.setInterval = (cb, ms = 0, ...args) => {
    const id = seq++;
    const every = Math.max(1, ms);
    timers.set(id, { cb, args, at: now + every, every });
    return id;
  };
  window.clearTimeout = (id) => { timers.delete(id); };
  window.clearInterval = (id) => { timers.delete(id); };

  window.__film = {
    /** Advance the clock by `dt` and run everything that comes due. */
    tick(dt) {
      now += dt;
      // Timers first — they are what schedules the next frame's work.
      for (let guard = 0; guard < 64; guard++) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= now);
        if (!due.length) break;
        for (const [id, t] of due) {
          if (t.every) t.at = now + t.every; else timers.delete(id);
          try { t.cb(...t.args); } catch { /* the take goes on */ }
        }
      }
      const pending = [...frames.values()];
      frames.clear();
      for (const cb of pending) { try { cb(now); } catch { /* the take goes on */ } }
    },
    scrollTo(px) {
      const flow = document.querySelector('.prelude__flow');
      if (flow) flow.scrollTop = px;
    },
    movementTop(i) {
      const el = document.querySelectorAll('.movement')[i];
      return el ? el.offsetTop : 0;
    },
    scrollTop() {
      const flow = document.querySelector('.prelude__flow');
      return flow ? flow.scrollTop : 0;
    },
    movementCount() {
      return document.querySelectorAll('.movement').length;
    },
  };
};

async function main() {
  const { server, port } = await serve();
  const base = `http://127.0.0.1:${port}`;
  await mkdir(dirname(OUT), { recursive: true });

  const ff = spawn(FFMPEG, [
    '-y',
    '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17',
    // The whole design is dark. Give the encoder room in the shadows and stop
    // it from smoothing a field of single-pixel dots into mush.
    '-x264-params', 'aq-mode=3:aq-strength=1.1:psy-rd=1.0,0.15:deblock=-2,-2',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    OUT,
  ], { stdio: ['pipe', 'ignore', 'inherit'] });

  const browser = await chromium.launch({
    executablePath: existsSync(CHROME) ? CHROME : undefined,
    args: ['--autoplay-policy=no-user-gesture-required', '--hide-scrollbars'],
  });
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
  });
  await context.addInitScript(VIRTUAL_CLOCK);
  const page = await context.newPage();

  let frames = 0;
  const write = (buf) => new Promise((resolve) => {
    if (ff.stdin.write(buf)) resolve(); else ff.stdin.once('drain', resolve);
  });

  /** One frame: advance the clock, optionally move the scroll, expose it. */
  async function shoot(scrollPx) {
    await page.evaluate(([dt, px]) => {
      if (px !== null) window.__film.scrollTo(px);
      window.__film.tick(dt);
    }, [DT, scrollPx ?? null]);
    await write(await page.screenshot({ type: 'png', animations: 'allow' }));
    frames++;
    if (frames % 150 === 0) process.stdout.write(`  ${(frames / FPS).toFixed(0)}s\n`);
  }

  const hold = async (seconds) => {
    for (let i = 0; i < Math.round(seconds * FPS); i++) await shoot(null);
  };

  /** Travel to a movement on a long ease, one filmed frame at a time. */
  async function glide(index, seconds) {
    const from = await page.evaluate(() => window.__film.scrollTop());
    const to = await page.evaluate((i) => window.__film.movementTop(i), index);
    const n = Math.round(seconds * FPS);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      await shoot(from + (to - from) * e);
    }
  }

  console.log('· rolling');
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  // The plates decode on real time, not ours. Let them land before the clock
  // starts, so the first movement assembles into a picture rather than a haze.
  await new Promise((r) => setTimeout(r, 2500));

  await hold(5);
  const count = await page.evaluate(() => window.__film.movementCount());
  for (let i = 1; i < count; i++) {
    await glide(i, 1.5);
    await hold(3);
  }

  // The way in.
  await page.click('.prelude__enter', { noWaitAfter: true });
  await hold(4.5);

  // The hall.
  await page.mouse.wheel(0, 850);
  await hold(2.5);
  await page.mouse.wheel(0, 850);
  await hold(2.5);
  await page.click('.track >> nth=0', { noWaitAfter: true });
  await hold(3);
  await page.keyboard.press('f');
  await hold(8);

  console.log('· cut');
  await browser.close();
  server.close();

  ff.stdin.end();
  await new Promise((resolve, reject) => {
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
  });
  console.log(`✓ ${OUT}  ·  ${frames} frames  ·  ${(frames / FPS).toFixed(1)}s`);
}

main().catch((err) => { console.error(err); process.exit(1); });
