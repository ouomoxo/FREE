/**
 * MAESTRO — Dot-matrix spectrum.
 *
 * Reads the analyser node and renders it as a literal dot matrix: logarithmic
 * frequency columns, quantised into cells, with peak-hold markers that fall at
 * a fixed rate. Every cell is an integer-aligned square, so the display is a
 * grid of dots rather than a smooth curve — the same visual grammar as the
 * artwork and the typeface.
 *
 * @module ui/visualizer
 */

import { engine } from '../audio/engine.js';
import { transport } from '../audio/transport.js';
import { findEventIndex } from '../audio/composer.js';
import { clamp, damp, prefersReducedMotion } from '../core/utils.js';

const MODES = ['matrix', 'score', 'wave', 'field'];

/** Instrument -> tone, for the piano roll. Melody parts read brightest. */
const PART_TONE = {
  harpsichord: 'accent', flute: 'accent', celeste: 'accent',
  glockenspiel: 'accent', choir: 'bright', harp: 'bright',
  strings: 'ink', pizzicato: 'bright',
  contrabass: 'dim', timpani: 'dim', cymbal: 'dim',
};

export class Visualizer {
  /** @type {HTMLCanvasElement|null} */ #canvas = null;
  /** @type {CanvasRenderingContext2D|null} */ #ctx = null;
  #raf = 0;
  #running = false;
  #last = 0;

  /** @type {Float32Array} */ #levels = new Float32Array(0);
  /** @type {Float32Array} */ #peaks = new Float32Array(0);
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
    if (this.#ctx) this.#ctx.imageSmoothingEnabled = false;
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
      default: this.#drawMatrix(ctx, W, H);
    }
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

    // Faint lattice, so the empty register still reads as a grid.
    ctx.fillStyle = 'rgba(236,231,220,0.035)';
    for (let r = 0; r < rows; r++) {
      const y = Math.round(H - (r + 1) * cellH);
      for (let x = 0; x < W; x += cellW * 3) ctx.fillRect(x, y, 1, 1);
    }

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

      // Notes are drawn as runs of discrete cells, never a smooth bar.
      for (let cx = x; cx < x + w; cx += cellW) {
        if (cx + cellW < 0 || cx > W) continue;
        ctx.fillRect(cx, y, cellW - 1, Math.max(1, Math.floor(cellH) - 1));
      }
      ctx.globalAlpha = 1;
    }

    // The playhead.
    ctx.fillStyle = accent;
    const px = Math.round(playhead * W);
    for (let y = 0; y < H; y += 4) ctx.fillRect(px, y, 1, 2);
  }

  #drawMatrix(ctx, W, H) {
    const { columns, rows, gap, ink, inkBright, accent } = this.#opts;
    const cw = W / columns;
    const ch = H / rows;
    const dw = Math.max(1, Math.floor(cw - gap * this.#dpr));
    const dh = Math.max(1, Math.floor(ch - gap * this.#dpr));

    for (let c = 0; c < columns; c++) {
      const level = this.#levels[c];
      const lit = Math.round(level * rows);
      const peakRow = Math.round(this.#peaks[c] * rows);
      const x = Math.floor(c * cw);

      for (let r = 0; r < rows; r++) {
        const y = Math.floor(H - (r + 1) * ch);
        if (r < lit) {
          // The top two cells of each bar take the accent colour.
          ctx.fillStyle = r >= lit - 2 ? accent : (r > rows * 0.55 ? inkBright : ink);
          ctx.fillRect(x, y, dw, dh);
        } else if (r === peakRow - 1 && peakRow > lit) {
          ctx.fillStyle = accent;
          ctx.fillRect(x, y, dw, Math.max(1, Math.floor(dh * 0.34)));
        } else {
          // The unlit lattice — faint, but present, so the grid reads.
          ctx.fillStyle = 'rgba(236,231,220,0.045)';
          ctx.fillRect(x, y, dw, Math.max(1, Math.floor(dh * 0.22)));
        }
      }
    }
  }

  #drawWave(ctx, W, H) {
    const data = engine.sampleWaveform();
    const cell = Math.max(2, Math.round(W / 220));
    ctx.fillStyle = this.#opts.inkBright;
    if (!data) {
      ctx.fillStyle = 'rgba(236,231,220,0.12)';
      for (let x = 0; x < W; x += cell * 2) ctx.fillRect(x, Math.floor(H / 2), cell, cell);
      return;
    }
    const step = Math.max(1, Math.floor(data.length / (W / cell)));
    for (let i = 0, x = 0; i < data.length; i += step, x += cell) {
      const v = (data[i] - 128) / 128;
      const y = Math.round((H / 2) * (1 - v * 0.86) / cell) * cell;
      ctx.fillStyle = Math.abs(v) > 0.5 ? this.#opts.accent : this.#opts.inkBright;
      ctx.fillRect(x, clamp(y, 0, H - cell), cell, cell);
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
        const size = Math.max(1, Math.floor(Math.min(cw, ch) * (0.3 + (1 - t) * 0.5)));
        const x = Math.floor(c * cw + (cw - size) / 2);
        const y = Math.floor(H - (r + 1) * ch + (ch - size) / 2);
        ctx.fillStyle = t > 0.7 ? this.#opts.accent : this.#opts.ink;
        ctx.fillRect(x, y, size, size);
      }
    }
  }
}

export const VISUALIZER_MODES = MODES;
export const concertVisualizer = new Visualizer();
export const barVisualizer = new Visualizer();
