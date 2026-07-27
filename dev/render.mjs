#!/usr/bin/env node
/**
 * Render the repertoire to audio files.
 *
 * The music has no files — it is composed and synthesised the moment you press
 * play, which is the point of the project and also the reason there is nothing
 * to send anybody. This renders it anyway.
 *
 * A headless Chromium loads the real modules, composes the real score,
 * orchestrates it, and plays the whole thing into an OfflineAudioContext — the
 * same voices, the same reverb, the same everything, just faster than real
 * time and into a buffer instead of a speaker. The buffer comes back as a WAV
 * and ffmpeg makes an MP3 of it.
 *
 * Usage:
 *   node dev/render.mjs                 # a few movements
 *   node dev/render.mjs out/ id1 id2    # named ones, to a directory
 */

import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const run = promisify(execFile);
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
const FFMPEG = process.env.FFMPEG_PATH || [
  '/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2',
  '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux',
  '/usr/bin/ffmpeg',
].find((p) => existsSync(p));

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const OUT = args[0] && !args[0].startsWith('--') ? args[0] : '/tmp/maestro-audio';
const WANTED = args.slice(1);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
};

/**
 * Whether the ffmpeg we found can actually make an MP3. Some builds shipped
 * alongside a browser are video-only and will not even open a WAV; the takes
 * are worth having anyway, so the MP3 is a convenience and not a requirement.
 * @type {() => Promise<boolean>}
 */
let lame = async () => {
  let ok = false;
  if (FFMPEG) {
    try {
      const { stdout } = await run(FFMPEG, ['-hide_banner', '-encoders']);
      ok = stdout.includes('libmp3lame');
    } catch { ok = false; }
  }
  if (!ok) console.log('  (no MP3 encoder here — leaving the WAVs)');
  lame = async () => ok;
  return ok;
};

function serve() {
  const server = createServer(async (req, res) => {
    let path = normalize(decodeURIComponent(req.url.split('?')[0]));
    if (path.endsWith('/')) path += 'index.html';
    const file = join(ROOT, path);
    if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404).end('no'); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, port: server.address().port })));
}

/**
 * Runs in the page. Composes one movement and plays it into an offline
 * context, then hands back a WAV as base64.
 */
const RENDER_IN_PAGE = async (trackId) => {
  const { TRACKS } = await import('/js/data/catalog.js');
  const { compose } = await import('/js/audio/composer.js');
  const { orchestrate } = await import('/js/audio/orchestra.js');
  const { VOICES } = await import('/js/audio/instruments.js');
  const { engine } = await import('/js/audio/engine.js');
  const { pianoFlush } = await import('/js/audio/piano.js');

  const track = TRACKS.find((t) => t.id === trackId);
  if (!track) throw new Error(`no track ${trackId}`);

  let score = compose({
    seed: track.seed, style: track.style, key: track.key,
    mode: track.mode, bpm: track.bpm, targetBars: track.targetBars,
  });
  score = orchestrate(score, track.seed);

  const SR = 44100;
  const LEAD = 0.4;
  // Enough tail for the hall to empty after the last note.
  const seconds = score.duration + LEAD + 4;
  const offline = new OfflineAudioContext(2, Math.ceil(seconds * SR), SR);

  // The engine builds its graph from window.AudioContext. Hand it the offline
  // one and it wires up exactly as it would for a speaker.
  const RealCtx = window.AudioContext;
  window.AudioContext = function () { return offline; };
  window.webkitAudioContext = window.AudioContext;
  await engine.init();
  window.AudioContext = RealCtx;

  engine.setVolume(1);
  // A voice that throws used to be discarded in silence, which is how a
  // movement came out at digital zero with nothing at all to show for it.
  // A take can survive one bad note; it cannot survive not being told.
  const failures = new Map();
  let missing = 0;
  for (const ev of score.events) {
    const voice = VOICES[ev.i];
    if (!voice) { missing++; continue; }
    try {
      voice(engine, { midi: ev.m, time: ev.t + LEAD, dur: ev.d, vel: ev.v, pan: ev.p });
    } catch (err) {
      const key = `${ev.i}: ${err && err.message ? err.message : err}`;
      const seen = failures.get(key);
      if (seen) seen.count++;
      else failures.set(key, { count: 1, midi: ev.m, dur: ev.d, vel: ev.v });
    }
  }

  // The piano is a worklet, and its notes are messages. Messages that have not
  // crossed to the audio thread when rendering starts are not late — they are
  // gone. One round trip proves they arrived.
  await pianoFlush(engine);

  const buffer = await offline.startRendering();

  // Peak-normalise to -1 dBFS. The synthesis is deliberately quiet so that a
  // tutti has headroom; a file wants that headroom used.
  const L = buffer.getChannelData(0);
  const R = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : L;
  let peak = 0;
  for (let i = 0; i < L.length; i++) {
    const a = Math.abs(L[i]); if (a > peak) peak = a;
    const b = Math.abs(R[i]); if (b > peak) peak = b;
  }
  const gain = peak > 1e-5 ? 0.891 / peak : 1;

  const n = L.length;
  const bytes = new DataView(new ArrayBuffer(44 + n * 4));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) bytes.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); bytes.setUint32(4, 36 + n * 4, true); str(8, 'WAVE');
  str(12, 'fmt '); bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true);
  bytes.setUint16(22, 2, true); bytes.setUint32(24, SR, true);
  bytes.setUint32(28, SR * 4, true); bytes.setUint16(32, 4, true); bytes.setUint16(34, 16, true);
  str(36, 'data'); bytes.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) {
    const l = Math.max(-1, Math.min(1, L[i] * gain));
    const r = Math.max(-1, Math.min(1, R[i] * gain));
    bytes.setInt16(44 + i * 4, l < 0 ? l * 0x8000 : l * 0x7fff, true);
    bytes.setInt16(46 + i * 4, r < 0 ? r * 0x8000 : r * 0x7fff, true);
  }

  // Base64 in chunks; one pass over a 30 MB string blows the stack.
  const view = new Uint8Array(bytes.buffer);
  let b64 = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < view.length; i += CHUNK) {
    b64 += String.fromCharCode.apply(null, view.subarray(i, i + CHUNK));
  }
  return {
    wav: btoa(b64),
    title: track.title,
    duration: score.duration,
    parts: score.instruments.length,
    notes: score.events.length,
    peak,
    missing,
    failures: [...failures].map(([reason, o]) => ({ reason, ...o })),
  };
};

async function main() {
  const { server, port } = await serve();
  const base = `http://127.0.0.1:${port}`;
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({
    executablePath: existsSync(CHROME) ? CHROME : undefined,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  /**
   * A page per take.
   *
   * `engine` is a module singleton, and `init()` is a no-op once the graph
   * exists — so a second track rendered in the same page schedules its notes
   * into the *first* track's OfflineAudioContext, which has already finished.
   * The take comes out at digital zero with no error anywhere, because nothing
   * went wrong: the notes were played, into a room nobody was listening to.
   * A fresh page is a fresh module registry, and so a fresh engine.
   */
  const fresh = async () => {
    const p = await browser.newPage();
    p.on('console', (m) => { if (m.type() === 'error') console.error('  page:', m.text()); });
    p.on('pageerror', (e) => console.error('  page:', e.message));
    await p.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
    return p;
  };

  const page = await fresh();
  const ids = WANTED.length ? WANTED : await page.evaluate(async () => {
    const { TRACKS } = await import('/js/data/catalog.js');
    // One from each of three different ensembles, so the sample is not all
    // one style: the longest movement in each of the first three records.
    const byAlbum = new Map();
    for (const t of TRACKS) {
      const best = byAlbum.get(t.album);
      if (!best || t.duration > best.duration) byAlbum.set(t.album, t);
    }
    return [...byAlbum.values()].slice(0, 3).map((t) => t.id);
  });

  await page.close();

  for (const id of ids) {
    process.stdout.write(`· ${id} `);
    const take = await fresh();
    const out = await take.evaluate(RENDER_IN_PAGE, id);
    await take.close();
    for (const f of out.failures) {
      console.log(`\n  ! ${f.count} note${f.count > 1 ? 's' : ''} threw — ${f.reason}`
        + `\n    first: midi ${f.midi}, ${f.dur.toFixed(2)}s, vel ${f.vel.toFixed(2)}`);
    }
    if (out.missing) console.log(`\n  ! ${out.missing} notes had no voice at all`);
    const wav = join(OUT, `${id}.wav`);
    const mp3 = join(OUT, `${id}.mp3`);
    await writeFile(wav, Buffer.from(out.wav, 'base64'));

    // A take that came out silent is a failed take, not a quiet one. Nothing
    // leaves here without having made a sound — and this is checked before the
    // MP3, so that a missing encoder can never hide a silent render.
    const dbfs = 20 * Math.log10(Math.max(1e-9, out.peak));
    if (dbfs < -50) {
      throw new Error(`${id} rendered silent (peak ${dbfs.toFixed(1)} dBFS) — refusing to ship it`);
    }

    if (await lame()) {
      await run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-i', wav,
        '-c:a', 'libmp3lame', '-b:a', '256k',
        '-metadata', `title=${out.title}`, '-metadata', 'artist=MAESTRO',
        '-metadata', 'album=Synthesised at the moment you ask for it', mp3]);
    }
    console.log(`— ${out.title} · ${out.duration.toFixed(0)}s · ${out.parts} parts · `
      + `${out.notes} notes · peak ${dbfs.toFixed(1)} dBFS`);
  }

  await browser.close();
  server.close();
  console.log(`\n✓ ${OUT}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
