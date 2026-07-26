/**
 * MAESTRO — The sounding score, drawn.
 *
 * Five readings of the same music, all of them made of the same two marks the
 * rest of the project is made of.
 *
 * `aria` is the one the concert hall opens on: every voice in the score drawn
 * as one continuous hairline, level while a note is held and sweeping when it
 * moves, scrolling under a fixed playhead. It is not a visualisation of the
 * audio — the composer materialises the whole score before a note sounds, so
 * this is the music itself, written out as a line while you listen to it.
 *
 * `matrix`, `score`, `wave` and `field` are the dot readings: logarithmic
 * spectrum columns, a piano roll, the waveform, and a lattice.
 *
 * @module ui/visualizer
 */

import { engine } from '../audio/engine.js';
import { transport } from '../audio/transport.js';
import { findEventIndex } from '../audio/composer.js';
import { clamp, damp, prefersReducedMotion } from '../core/utils.js';

const MODES = ['aria', 'matrix', 'score', 'wave', 'field'];

/** Instrument -> tone, for the piano roll. Melody parts read brightest. */
const PART_TONE = {
  harpsichord: 'accent', flute: 'accent', celeste: 'accent',
  glockenspiel: 'accent', choir: 'bright', harp: 'bright',
  strings: 'ink', pizzicato: 'bright',
  contrabass: 'dim', timpani: 'dim', cymbal: 'dim',
};

/** Instruments with no pitch, and so no place on a line of pitch. */
const UNPITCHED = new Set(['timpani', 'cymbal']);

/**
 * Which part of a score is the tune.
 *
 * Not the highest — a string pad sits on top of everything and never moves,
 * and a drawing that follows it is a straight line. The tune is the part that
 * *travels*: the one whose consecutive notes are furthest apart, summed over
 * the whole piece. That is very close to what a listener means by the melody,
 * and it needs no table of instrument names to be right.
 *
 * Computed once and hung on the score, since a score never changes.
 */
function melodyPart(score) {
  if (score.__melody) return score.__melody;
  /** @type {Map<string, {last: number, travel: number, n: number}>} */
  const parts = new Map();
  for (const e of score.events) {
    if (UNPITCHED.has(e.i)) continue;
    const p = parts.get(e.i) ?? { last: e.m, travel: 0, n: 0 };
    p.travel += Math.abs(e.m - p.last);
    p.last = e.m;
    p.n++;
    parts.set(e.i, p);
  }
  let best = null;
  let score_ = -1;
  for (const [name, p] of parts) {
    // Travel per note, weighted by how much of the piece the part is present
    // for — so a busy flourish in one bar does not outrank the actual tune.
    const v = (p.travel / Math.max(1, p.n)) * Math.sqrt(p.n);
    if (v > score_) { score_ = v; best = name; }
  }
  score.__melody = best;
  return best;
}

export class Visualizer {
  /** @type {HTMLCanvasElement|null} */ #canvas = null;
  /** @type {CanvasRenderingContext2D|null} */ #ctx = null;
  #raf = 0;
  #running = false;
  #last = 0;

  /** @type {Float32Array} */ #levels = new Float32Array(0);
  /** @type {Float32Array} */ #peaks = new Float32Array(0);
  /** Chased, so the threads swell into loudness rather than snapping. */
  #figureWeight = 0;
  /** The register the drawing is currently opened out to. */
  #gainLo = 0.35;
  #gainHi = 0.65;
  /** @type {ResizeObserver|null} */ #observer = null;
  #resizeFrame = 0;
  #dpr = 1;

  #opts = {
    columns: 56,
    rows: 18,
    gap: 1,
    mode: 'matrix',
    /** Colours, dark -> light; the top of each bar takes the accent. */
    ink: '#8d8a84',
    inkBright: '#ece7dc',
    accent: '#d9b978',
    idleFloor: 0.02,
  };

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Partial<typeof Visualizer.prototype.__opts>} [opts]
   */
  mount(canvas, opts = {}) {
    this.#opts = { ...this.#opts, ...opts };
    this.#canvas = canvas;
    this.#ctx = canvas.getContext('2d', { alpha: true });
    this.#levels = new Float32Array(this.#opts.columns);
    this.#peaks = new Float32Array(this.#opts.columns);
    this.resize();
    // The canvas often has no box yet at mount time (hidden parent, pending
    // layout); observing it means the backing store is always correct.
    // Observe the containing block, not the canvas: resizing a canvas changes
    // its own layout box, which would feed straight back into the observer.
    this.#observer = new ResizeObserver(() => {
      cancelAnimationFrame(this.#resizeFrame);
      this.#resizeFrame = requestAnimationFrame(() => this.resize());
    });
    this.#observer.observe(canvas.parentElement ?? canvas);
    this.start();
    return this;
  }

  unmount() {
    this.stop();
    cancelAnimationFrame(this.#resizeFrame);
    this.#observer?.disconnect();
    this.#observer = null;
    this.#canvas = null;
    this.#ctx = null;
  }

  /** @param {string} mode */
  setMode(mode) {
    if (MODES.includes(mode)) this.#opts.mode = mode;
  }

  get mode() { return this.#opts.mode; }

  resize() {
    const canvas = this.#canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.#dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * this.#dpr);
    canvas.height = Math.round(rect.height * this.#dpr);
  }

  start() {
    if (this.#running) return;
    this.#running = true;
    this.#last = performance.now();
    this.#raf = requestAnimationFrame(this.#frame);
  }

  stop() { this.#running = false; cancelAnimationFrame(this.#raf); }

  #frame = (now) => {
    if (!this.#running) return;
    const dt = Math.min(0.05, (now - this.#last) / 1000);
    this.#last = now;
    // Nothing to draw when the surface is off-screen (a collapsed panel, a
    // hidden overlay). rAF keeps firing; the work does not need to.
    if (this.#canvas && this.#canvas.offsetParent === null && this.#canvas.style.position !== 'fixed') {
      this.#raf = requestAnimationFrame(this.#frame);
      return;
    }
    try { this.#sample(dt); this.#draw(); }
    catch (err) { console.error('[visualizer] frame failed', err); this.stop(); }
    this.#raf = requestAnimationFrame(this.#frame);
  };

  /** Fold the FFT into logarithmic columns. */
  #sample(dt) {
    const cols = this.#opts.columns;
    const data = engine.sampleSpectrum();
    if (!data) {
      for (let i = 0; i < cols; i++) {
        this.#levels[i] = damp(this.#levels[i], this.#opts.idleFloor, 0.4, dt);
        this.#peaks[i] = Math.max(this.#levels[i], this.#peaks[i] - dt * 0.5);
      }
      return;
    }

    const bins = data.length;
    // Map columns logarithmically across 40 Hz .. 12 kHz.
    const nyquist = engine.sampleRate / 2;
    const fMin = 42;
    const fMax = Math.min(12000, nyquist);
    const reduced = prefersReducedMotion();

    for (let c = 0; c < cols; c++) {
      const t0 = c / cols;
      const t1 = (c + 1) / cols;
      const f0 = fMin * Math.pow(fMax / fMin, t0);
      const f1 = fMin * Math.pow(fMax / fMin, t1);
      const b0 = clamp(Math.floor((f0 / nyquist) * bins), 0, bins - 1);
      const b1 = clamp(Math.ceil((f1 / nyquist) * bins), b0 + 1, bins);

      let peak = 0;
      let sum = 0;
      for (let b = b0; b < b1; b++) {
        const v = data[b] / 255;
        sum += v;
        if (v > peak) peak = v;
      }
      const avg = sum / (b1 - b0);
      // Blend average and peak, then tilt the top end up so the treble is
      // visible at all against a string-heavy spectrum.
      const tilt = 1 + t0 * 0.85;
      const value = clamp((avg * 0.55 + peak * 0.45) * tilt, 0, 1);

      this.#levels[c] = damp(this.#levels[c], value, reduced ? 0.2 : 0.045, dt);
      this.#peaks[c] = value > this.#peaks[c]
        ? value
        : Math.max(value, this.#peaks[c] - dt * 0.55);
    }
  }

  #draw() {
    const ctx = this.#ctx;
    const canvas = this.#canvas;
    if (!ctx || !canvas || !canvas.width) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    switch (this.#opts.mode) {
      case 'wave': this.#drawWave(ctx, W, H); break;
      case 'field': this.#drawField(ctx, W, H); break;
      case 'score': this.#drawScore(ctx, W, H); break;
      case 'aria': this.#drawAria(ctx, W, H); break;
      default: this.#drawMatrix(ctx, W, H);
    }
  }

  /* ------------------------------------------------------------------ *
   * The aria: the score as lines.
   * ------------------------------------------------------------------ */

  /**
   * The contour of the music, as a continuous function of time.
   *
   * Sampled coarsely across the window and then smoothed several times over,
   * so what comes out is not a sequence of notes but the shape they make —
   * a wave. Nothing here is quantised to anything.
   *
   * @returns {Float32Array} 0..1, low to high, one value per sample.
   */
  #ariaContour(score, t0, window, N) {
    const events = score.events;
    const melody = melodyPart(score);
    const LO = 36;
    const HI = 88;
    const raw = new Float32Array(N).fill(-1);

    // The tune where it is singing, and the top of the texture where it is
    // not — because a window in which the melody happens to be resting is
    // still a window with music in it.
    const fallback = new Float32Array(N).fill(-1);
    let i = findEventIndex(events, t0 - 16);
    for (; i < events.length; i++) {
      const e = events[i];
      if (e.t > t0 + window) break;
      if (e.t + e.d < t0) continue;
      if (UNPITCHED.has(e.i)) continue;
      const s0 = Math.max(0, Math.floor(((e.t - t0) / window) * N));
      const s1 = Math.min(N - 1, Math.ceil(((e.t + e.d - t0) / window) * N));
      const v = clamp((e.m - LO) / (HI - LO), 0, 1);
      const into = e.i === melody ? raw : fallback;
      for (let s = s0; s <= s1; s++) if (v > into[s]) into[s] = v;
    }
    for (let s = 0; s < N; s++) if (raw[s] < 0) raw[s] = fallback[s];

    // Silence is not a hole in the line — the line keeps going where it was.
    let last = 0.5;
    for (let s = 0; s < N; s++) {
      if (raw[s] < 0) raw[s] = last; else last = raw[s];
    }
    for (let s = N - 1; s >= 0; s--) {
      if (raw[s] < 0) raw[s] = last; else last = raw[s];
    }

    // Three passes of a box, which is what turns a staircase into silk.
    let src = raw;
    let dst = new Float32Array(N);
    const R = Math.max(2, Math.round(N * 0.012));
    for (let pass = 0; pass < 3; pass++) {
      let sum = 0;
      for (let k = -R; k <= R; k++) sum += src[clamp(k, 0, N - 1)];
      for (let s = 0; s < N; s++) {
        dst[s] = sum / (R * 2 + 1);
        sum += src[clamp(s + R + 1, 0, N - 1)] - src[clamp(s - R, 0, N - 1)];
      }
      const t = src; src = dst; dst = t;
    }

    // Then opened out to fill the frame.
    //
    // A tune that stays inside a fifth would otherwise be a flat line on a
    // scale wide enough for a piccolo, which is the truth and is also nothing
    // to look at. The window is read against its own range instead of against
    // the piano — and the range is chased rather than set, so the drawing
    // breathes open and closed as the music's tessitura moves instead of
    // jumping whenever one high note enters or leaves.
    let lo = 1;
    let hi = 0;
    for (let s = 0; s < N; s++) {
      if (src[s] < lo) lo = src[s];
      if (src[s] > hi) hi = src[s];
    }
    if (hi - lo < 0.06) { const c = (hi + lo) / 2; lo = c - 0.03; hi = c + 0.03; }
    this.#gainLo = damp(this.#gainLo, lo, 0.7, 1 / 60);
    this.#gainHi = damp(this.#gainHi, hi, 0.7, 1 / 60);
    const span = Math.max(0.05, this.#gainHi - this.#gainLo);
    for (let s = 0; s < N; s++) src[s] = clamp((src[s] - this.#gainLo) / span, -0.15, 1.15);

    return src;
  }

  /** One thread, drawn through the contour with a curve and never a corner. */
  #ariaThread(ctx, contour, W, H, o) {
    const N = contour.length;
    const mid = H * 0.5;
    const reach = H * 0.31 * o.amp;
    const lag = o.lag ?? 0;
    const sway = o.sway ?? 0;

    /** @type {number[]} */
    const xs = [];
    /** @type {number[]} */
    const ys = [];
    for (let s = 0; s < N; s++) {
      const k = clamp(s - lag, 0, N - 1);
      const u = s / (N - 1);
      xs.push(u * W);
      // A slow independent drift, so two threads carrying the same contour are
      // never the same line twice.
      ys.push(mid - (contour[k] - 0.5) * 2 * reach
        + Math.sin(u * 4.3 + o.phase) * H * 0.012 * sway
        + Math.sin(u * 9.1 - o.phase * 1.6) * H * 0.006 * sway);
    }

    ctx.beginPath();
    ctx.moveTo(xs[0], ys[0]);
    // Midpoint quadratics: every joint is a tangent, so the thread has no
    // corners anywhere along its length.
    for (let s = 1; s < N - 1; s++) {
      ctx.quadraticCurveTo(xs[s], ys[s], (xs[s] + xs[s + 1]) / 2, (ys[s] + ys[s + 1]) / 2);
    }
    ctx.lineTo(xs[N - 1], ys[N - 1]);
    ctx.stroke();
  }

  #drawAria(ctx, W, H) {
    const score = transport.score;
    if (!score) { this.#drawAriaIdle(ctx, W, H); return; }

    const dpr = this.#dpr;
    const now = transport.position;
    // Two bars, and never more than about eight seconds: a window long enough
    // to hold a phrase and short enough that the phrase is still visible in it.
    const window = clamp(score.secPerBeat * score.meter[0] * 2, 4.5, 8);
    const t0 = now - window * 0.5;
    const N = 240;
    const contour = this.#ariaContour(score, t0, window, N);

    // How loud it is, softly — the threads swell and are never still.
    let level = 0;
    for (let c = 0; c < this.#levels.length; c++) level += this.#levels[c];
    level = clamp(level / Math.max(1, this.#levels.length) * 2.4, 0, 1);
    this.#figureWeight = damp(this.#figureWeight, level, 0.22, 1 / 60);
    const amp = 0.62 + this.#figureWeight * 0.5;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Three threads of one music: the line, and two slower memories of it.
    // Nothing else is drawn. There is no grid, no bar, no scale, no playhead —
    // the emptiness around them is the greater part of the picture.
    const THREADS = [
      { lag: 0, amp: 1, sway: 0.35, width: 1.15, alpha: 0.8, ink: '236,231,220' },
      { lag: N * 0.045, amp: 0.94, sway: 0.7, width: 0.85, alpha: 0.3, ink: '236,231,220' },
      { lag: N * 0.1, amp: 0.87, sway: 1.1, width: 0.7, alpha: 0.15, ink: '217,185,120' },
    ];

    for (let k = THREADS.length - 1; k >= 0; k--) {
      const th = THREADS[k];
      ctx.lineWidth = th.width * dpr;
      ctx.strokeStyle = `rgba(${th.ink},${th.alpha.toFixed(3)})`;
      this.#ariaThread(ctx, contour, W, H, {
        lag: th.lag,
        amp: amp * th.amp,
        sway: th.sway,
        phase: now * 0.14 + k * 2.4,
      });
    }

    // One warm point, riding the thread at the centre of the frame. It is the
    // only thing on the screen that marks a moment, and it is four pixels wide.
    const c = clamp(Math.round(N * 0.5), 0, N - 1);
    const y = H * 0.5 - (contour[c] - 0.5) * 2 * (H * 0.31 * amp);
    ctx.fillStyle = 'rgba(217,185,120,0.85)';
    ctx.beginPath();
    ctx.arc(W * 0.5, y, 2 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * With nothing playing there is no score to draw, so the frame keeps one
   * line — a slow, unresolving drift, waiting.
   */
  #drawAriaIdle(ctx, W, H) {
    const dpr = this.#dpr;
    const t = performance.now() / 1000;
    ctx.strokeStyle = 'rgba(236,231,220,0.13)';
    ctx.lineWidth = dpr;
    ctx.lineJoin = 'round';
    for (let line = 0; line < 3; line++) {
      const ph = line * 2.1;
      const amp = H * (0.055 - line * 0.012);
      ctx.globalAlpha = 1 - line * 0.3;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 3) {
        const u = x / W;
        const y = H * 0.5
          + Math.sin(u * 5.1 + t * 0.19 + ph) * amp
          + Math.sin(u * 11.7 - t * 0.13 + ph * 1.7) * amp * 0.42;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Piano roll of the score that is actually sounding.
   *
   * Because the composer materialises every note up front, this is not a
   * visualisation *of* the audio — it is the score itself, scrolling past a
   * fixed playhead, quantised onto the same dot lattice as everything else.
   */
  #drawScore(ctx, W, H) {
    const score = transport.score;
    if (!score) { this.#drawMatrix(ctx, W, H); return; }

    const { ink, inkBright, accent } = this.#opts;
    const window = Math.max(4, score.secPerBeat * score.meter[0] * 3);  // three bars
    const playhead = 0.28;
    const now = transport.position;
    const t0 = now - window * playhead;
    const t1 = t0 + window;

    // A finer vertical grid than the spectrum uses: at 22 rows a whole triad
    // collapses into one band. One row per two semitones keeps chords legible.
    const LO = 33;
    const HI = 93;
    const rows = clamp(Math.floor(H / (5 * this.#dpr)), 18, (HI - LO) / 2);
    const cellH = H / rows;
    const cellW = Math.max(2, Math.round(W / 150));

    // Faint lattice, so the empty register still reads as a field of points.
    ctx.fillStyle = 'rgba(236,231,220,0.08)';
    ctx.beginPath();
    for (let r = 0; r < rows; r++) {
      const y = H - (r + 0.5) * cellH;
      for (let x = cellW; x < W; x += cellW * 3) {
        ctx.moveTo(x + 0.7, y);
        ctx.arc(x, y, 0.7, 0, Math.PI * 2);
      }
    }
    ctx.fill();

    // Bar lines.
    const barLen = score.secPerBeat * score.meter[0];
    ctx.fillStyle = 'rgba(236,231,220,0.10)';
    for (let bar = Math.floor(t0 / barLen); bar <= Math.ceil(t1 / barLen); bar++) {
      const x = Math.round(((bar * barLen - t0) / window) * W);
      if (x >= 0 && x < W) ctx.fillRect(x, 0, 1, H);
    }

    const events = score.events;
    let i = findEventIndex(events, t0 - 8);
    for (; i < events.length; i++) {
      const e = events[i];
      if (e.t > t1) break;
      if (e.t + e.d < t0) continue;

      const row = Math.round(((e.m - LO) / (HI - LO)) * (rows - 1));
      if (row < 0 || row >= rows) continue;

      const x = Math.round(((e.t - t0) / window) * W);
      const w = Math.max(cellW, Math.round((e.d / window) * W));
      const y = Math.round(H - (row + 1) * cellH);
      const sounding = now >= e.t && now <= e.t + e.d;

      const tone = PART_TONE[e.i] ?? 'ink';
      ctx.fillStyle = sounding
        ? accent
        : tone === 'accent' ? 'rgba(217,185,120,0.55)'
        : tone === 'bright' ? inkBright
        : tone === 'dim' ? 'rgba(141,138,132,0.5)'
        : ink;
      ctx.globalAlpha = sounding ? 1 : clamp(0.32 + e.v * 0.68, 0.2, 1);

      // Notes are drawn as runs of discrete dots, never a smooth bar.
      const dr = Math.min(cellW, cellH) * 0.36;
      ctx.beginPath();
      for (let cx = x; cx < x + w; cx += cellW) {
        if (cx + cellW < 0 || cx > W) continue;
        ctx.moveTo(cx + dr, y + cellH / 2);
        ctx.arc(cx, y + cellH / 2, dr, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // The playhead, as a dotted rule.
    ctx.fillStyle = accent;
    const px = playhead * W;
    ctx.beginPath();
    for (let y = 2; y < H; y += 6) {
      ctx.moveTo(px + 0.9, y);
      ctx.arc(px, y, 0.9, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  #drawMatrix(ctx, W, H) {
    const { columns, rows, ink, inkBright, accent } = this.#opts;
    const cw = W / columns;
    const ch = H / rows;
    // Round dots on the same lattice as the rest of the application. The dot
    // never quite fills its cell, so the grid stays legible as points.
    const r0 = Math.min(cw, ch) * 0.34;

    const dot = (x, y, radius, fill) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    for (let c = 0; c < columns; c++) {
      const level = this.#levels[c];
      const lit = Math.round(level * rows);
      const peakRow = Math.round(this.#peaks[c] * rows);
      const x = c * cw + cw / 2;

      for (let r = 0; r < rows; r++) {
        const y = H - (r + 0.5) * ch;
        if (r < lit) {
          // The top of each column takes the accent colour.
          dot(x, y, r0, r >= lit - 2 ? accent : (r > rows * 0.55 ? inkBright : ink));
        } else if (r === peakRow - 1 && peakRow > lit) {
          dot(x, y, r0 * 0.62, accent);
        } else {
          // The unlit lattice — faint, but present, so the field reads.
          dot(x, y, r0 * 0.24, 'rgba(236,231,220,0.14)');
        }
      }
    }
  }

  #drawWave(ctx, W, H) {
    const data = engine.sampleWaveform();
    const cell = Math.max(3, Math.round(W / 190));
    const r = cell * 0.34;
    const plot = (x, y, fill) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    if (!data) {
      for (let x = cell; x < W; x += cell * 2) plot(x, H / 2, 'rgba(236,231,220,0.16)');
      return;
    }
    const step = Math.max(1, Math.floor(data.length / (W / cell)));
    for (let i = 0, x = 0; i < data.length; i += step, x += cell) {
      const v = (data[i] - 128) / 128;
      const y = Math.round(((H / 2) * (1 - v * 0.86)) / cell) * cell;
      plot(x, clamp(y, r, H - r), Math.abs(v) > 0.5 ? this.#opts.accent : this.#opts.inkBright);
    }
  }

  #drawField(ctx, W, H) {
    const { columns, rows } = this.#opts;
    const cw = W / columns;
    const ch = H / rows;
    for (let c = 0; c < columns; c++) {
      const level = this.#levels[c];
      for (let r = 0; r < rows; r++) {
        const t = r / rows;
        const on = level > t * 0.9 + 0.04;
        if (!on) continue;
        const radius = Math.min(cw, ch) * (0.15 + (1 - t) * 0.26);
        ctx.fillStyle = t > 0.7 ? this.#opts.accent : this.#opts.ink;
        ctx.beginPath();
        ctx.arc(c * cw + cw / 2, H - (r + 0.5) * ch, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

export const VISUALIZER_MODES = MODES;
export const concertVisualizer = new Visualizer();
export const barVisualizer = new Visualizer();
