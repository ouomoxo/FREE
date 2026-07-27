#!/usr/bin/env node
/**
 * Listen to one note, and measure it.
 *
 * The failure of every previous attempt at this piano was to ship a whole
 * movement and then ask whether it sounded like a piano. The question was
 * always about a single note, and a single note can be measured:
 *
 *   · where the partials actually land, and therefore the inharmonicity;
 *   · the notch the hammer's strike point cuts in the spectrum;
 *   · whether the decay is one exponential (a synthesiser) or two (a piano);
 *   · whether striking harder makes the note brighter or merely louder.
 *
 * Nothing here is a guess about how it sounds. It is what it is doing.
 *
 * Usage:
 *   node dev/note.mjs                        # a survey across the keyboard
 *   node dev/note.mjs --midi 60 --vel 0.8    # one note, in detail
 *   node dev/note.mjs --out /tmp/notes       # and write the WAVs
 */

import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
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
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SR = 44100;

/* ---------------------------------------------------------------- arguments */

const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const has = (name) => argv.includes(`--${name}`);

/* ------------------------------------------------------------------ serving */

function serve() {
  const MIME = { '.js': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8' };
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

/* ----------------------------------------------------------------- analysis */

/** In-place iterative radix-2 FFT. */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

/**
 * Magnitude spectrum of a Hann-windowed slice.
 * @param {Float32Array} x @param {number} from @param {number} size
 */
function spectrum(x, from, size) {
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    const s = x[from + i] ?? 0;
    re[i] = s * 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
  }
  fft(re, im);
  const mag = new Float64Array(size / 2);
  for (let i = 0; i < size / 2; i++) mag[i] = Math.hypot(re[i], im[i]);
  return mag;
}

/**
 * The strongest bin near an expected frequency, refined by a parabola through
 * its neighbours — bin resolution alone is far too coarse to see a stretch of
 * a few cents.
 */
function peakNear(mag, sr, size, expected, spanHz) {
  const perBin = sr / size;
  const lo = Math.max(1, Math.floor((expected - spanHz) / perBin));
  const hi = Math.min(mag.length - 2, Math.ceil((expected + spanHz) / perBin));
  let best = lo;
  for (let i = lo; i <= hi; i++) if (mag[i] > mag[best]) best = i;
  const a = mag[best - 1], b = mag[best], c = mag[best + 1];
  const denom = a - 2 * b + c;
  const shift = denom !== 0 ? 0.5 * (a - c) / denom : 0;
  return { freq: (best + shift) * perBin, mag: b };
}

/** RMS envelope in dB, one point per `hop` samples. */
function envelope(x, hop) {
  const out = [];
  for (let i = 0; i + hop <= x.length; i += hop) {
    let s = 0;
    for (let j = 0; j < hop; j++) s += x[i + j] * x[i + j];
    out.push(20 * Math.log10(Math.sqrt(s / hop) + 1e-12));
  }
  return out;
}

/** Least-squares slope, dB per second, over a stretch of the envelope. */
function slope(env, from, to, hopSeconds) {
  let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = from; i < to && i < env.length; i++) {
    if (env[i] < -110) break;
    const x = i * hopSeconds;
    n++; sx += x; sy += env[i]; sxx += x * x; sxy += x * env[i];
  }
  if (n < 3) return null;
  return (n * sxy - sx * sy) / (n * sxx - sx * sx);
}

function encodeWav(x, sr) {
  const n = x.length;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, x[i]));
    b.writeInt16LE(Math.round(v < 0 ? v * 0x8000 : v * 0x7fff), 44 + i * 2);
  }
  return b;
}

/**
 * Everything worth knowing about one rendered note.
 * @param {Float32Array} x @param {number} midi
 */
function analyse(x, midi) {
  const f0 = 440 * Math.pow(2, (midi - 69) / 12);
  let peak = 0, onset = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]);
    if (a > peak) peak = a;
    if (!onset && a > 0.005) onset = i;
  }

  const size = 32768;
  const from = Math.min(Math.max(0, x.length - size - 1), onset + Math.round(SR * 0.05));
  const mag = spectrum(x, from, size);

  // Where the partials landed, and what stiffness that implies.
  //
  // The search has to walk up the series rather than look in fixed places: by
  // the top octave the eighth partial is a whole semitone sharp of where a
  // harmonic series would put it, and a window narrow enough to be safe at the
  // bottom would miss it entirely. So each partial is predicted from the
  // stiffness the ones below it implied, and only then looked for.
  const partials = [];
  const maxK = Math.min(20, Math.floor(SR * 0.45 / f0));
  let B = 0;
  for (let k = 1; k <= maxK; k++) {
    const expect = k * f0 * Math.sqrt(1 + B * k * k);
    if (expect > SR * 0.47) break;
    const p = peakNear(mag, SR, size, expect, f0 * 0.34);
    const ratio = p.freq / (k * f0);
    partials.push({ k, freq: p.freq, ratio, db: 20 * Math.log10(p.mag + 1e-12) });
    if (k >= 2) B = Math.max(0, (ratio * ratio - 1) / (k * k));
  }
  // (f_k/(k·f₀))² = 1 + B·k² — a straight line in k², through the origin at 1.
  // Weight by k², since the higher the partial the more of the stretch it sees.
  let num = 0, den = 0;
  const floorDb = Math.max(...partials.map((p) => p.db)) - 60;
  for (const p of partials) {
    if (p.k < 2 || p.db < floorDb) continue;
    const t = p.k * p.k;
    num += t * (p.ratio * p.ratio - 1); den += t * t;
  }
  B = den ? num / den : 0;

  const hop = Math.round(SR * 0.01);
  const env = envelope(x.subarray(onset), hop);
  const top = env.length ? Math.max(...env.slice(0, 12)) : -120;
  const fast = slope(env, 3, 3 + Math.round(0.35 / 0.01), 0.01);
  const tailFrom = Math.round(1.2 / 0.01);
  const slow = slope(env, tailFrom, tailFrom + Math.round(2.5 / 0.01), 0.01);

  // Brightness: the spectral centroid of the first 60 ms, which is what
  // separates a hard blow from a loud one.
  const attack = spectrum(x, onset, 4096);
  let sw = 0, sm = 0;
  for (let i = 1; i < attack.length; i++) { sw += attack[i] * (i * SR / 4096); sm += attack[i]; }

  // How the sound sits on its fundamental. A piano is not a fundamental with
  // decoration: through the middle of the keyboard the second to sixth
  // partials are as loud as it or louder, and a voice that buries them under
  // the first is the thing everyone recognises as "synthesised".
  const first = partials[0];
  const upper = partials.filter((p) => p.k >= 2 && p.k <= 6);
  const tilt = first && upper.length
    ? upper.reduce((s, p) => s + p.db, 0) / upper.length - first.db : NaN;

  return {
    peak, f0, B, partials, top, tilt,
    fastDb: fast, slowDb: slow,
    centroid: sm ? sw / sm : 0,
  };
}

/* --------------------------------------------------------------------- main */

async function main() {
  const { server, port } = await serve();
  const browser = await chromium.launch({
    executablePath: existsSync(CHROME) ? CHROME : undefined,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.error('  page:', m.text()); });
  page.on('pageerror', (e) => console.error('  page:', e.message));
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });

  const body = has('body');
  const outDir = flag('out', null);
  if (outDir) await mkdir(outDir, { recursive: true });

  /** @type {{midi:number, vel:number, dur:number, seconds:number}[]} */
  let notes;
  if (has('midi')) {
    notes = [{
      midi: Number(flag('midi', 60)), vel: Number(flag('vel', 0.8)),
      dur: Number(flag('dur', 6)), seconds: Number(flag('seconds', 8)),
    }];
  } else {
    // Across the keyboard, and one pitch struck twice at different weights.
    notes = [
      { midi: 33, vel: 0.8, dur: 6, seconds: 9 },
      { midi: 45, vel: 0.8, dur: 6, seconds: 9 },
      { midi: 61, vel: 0.8, dur: 5, seconds: 7 },
      { midi: 61, vel: 0.25, dur: 5, seconds: 7 },
      { midi: 73, vel: 0.8, dur: 4, seconds: 6 },
      { midi: 88, vel: 0.8, dur: 3, seconds: 4 },
    ];
  }

  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  for (const n of notes) {
    const pcm = await page.evaluate(async (o) => {
      const ctx = new OfflineAudioContext(1, Math.ceil(o.seconds * o.sr), o.sr);
      await ctx.audioWorklet.addModule('/js/audio/piano-worklet.js');
      const node = new AudioWorkletNode(ctx, 'piano-processor', {
        numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
      });
      let tail = node;
      if (o.body) {
        const { soundboard } = await import('/js/audio/soundboard.js');
        tail = soundboard(ctx, node);
      }
      tail.connect(ctx.destination);
      node.port.postMessage({ type: 'note', midi: o.midi, vel: o.vel, dur: o.dur, pan: 0, time: 0.02 });
      // A message that has not crossed to the audio thread when rendering
      // begins is not late, it is gone — and the render comes out silent with
      // nothing to show for it. A port keeps its order, so a reply proves the
      // note arrived.
      await new Promise((resolve) => {
        node.port.addEventListener('message', function ack(e) {
          if (e.data && e.data.type === 'pong') { node.port.removeEventListener('message', ack); resolve(); }
        });
        node.port.start();
        node.port.postMessage({ type: 'ping', id: 1 });
      });
      const buf = await ctx.startRendering();
      return Array.from(buf.getChannelData(0));
    }, { ...n, sr: SR, body });

    const x = Float32Array.from(pcm);
    const a = analyse(x, n.midi);
    const name = `${NAMES[n.midi % 12]}${Math.floor(n.midi / 12) - 1}`;
    const label = `${name.padEnd(4)} midi ${String(n.midi).padStart(2)} vel ${n.vel.toFixed(2)}`;

    if (a.peak < 1e-4) {
      console.log(`${label}  SILENT (peak ${(20 * Math.log10(a.peak + 1e-12)).toFixed(1)} dBFS)`);
      continue;
    }

    const stretch = a.partials.filter((p) => p.k === 4 || p.k === 8 || p.k === 12)
      .map((p) => `${p.k}:${((p.ratio - 1) * 1200).toFixed(1)}¢`).join(' ');
    const notch = a.partials.find((p) => p.k === 8);
    const around = a.partials.filter((p) => p.k === 7 || p.k === 9);
    const notchDb = notch && around.length === 2
      ? notch.db - (around[0].db + around[1].db) / 2 : NaN;

    console.log(
      `${label}  peak ${(20 * Math.log10(a.peak)).toFixed(1)} dBFS  `
      + `B ${a.B.toExponential(1)}  stretch ${stretch}  `
      + `8th ${Number.isNaN(notchDb) ? '—' : `${notchDb.toFixed(1)} dB`}  `
      + `2-6th ${Number.isNaN(a.tilt) ? '—' : `${a.tilt > 0 ? '+' : ''}${a.tilt.toFixed(1)} dB`}  `
      + `decay ${a.fastDb === null ? '—' : `${a.fastDb.toFixed(1)}`}`
      + ` → ${a.slowDb === null ? '—' : `${a.slowDb.toFixed(1)}`} dB/s  `
      + `centroid ${(a.centroid / 1000).toFixed(2)} kHz`,
    );

    if (outDir) {
      const file = join(outDir, `${name}-${n.midi}-v${Math.round(n.vel * 100)}.wav`);
      await writeFile(file, encodeWav(x, SR));
    }
  }

  if (outDir) console.log(`\n✓ ${outDir}`);
  await browser.close();
  server.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
