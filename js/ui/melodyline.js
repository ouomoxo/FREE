/**
 * MAESTRO — The line.
 *
 * A few hairlines drifting across the dark, drawn as one continuous stroke each.
 * When nothing is playing they move like a held breath: three slow sine curves
 * at incommensurate periods, so the figure never quite repeats. When a score is
 * loaded the top line stops improvising and traces the actual melody — the pitch
 * contour of the piece, scrolling past under the playhead.
 *
 * It is the only curved, continuous thing in the interface, and it is
 * deliberately almost invisible: a gesture at the edge of the page rather than
 * a graphic on it.
 *
 * @module ui/melodyline
 */

import { transport } from '../audio/transport.js';
import { findEventIndex } from '../audio/composer.js';
import { engine } from '../audio/engine.js';
import { clamp, damp, prefersReducedMotion, TAU } from '../core/utils.js';

/** Instruments whose line is worth tracing — the melody, not the accompaniment. */
const MELODIC = new Set(['harpsichord', 'flute', 'celeste', 'choir', 'strings', 'glockenspiel', 'harp']);

export class MelodyLine {
  /** @type {HTMLCanvasElement|null} */ #canvas = null;
  /** @type {CanvasRenderingContext2D|null} */ #ctx = null;
  /** @type {ResizeObserver|null} */ #observer = null;
  #raf = 0;
  #resizeFrame = 0;
  #running = false;
  #last = 0;
  #t = 0;
  #dpr = 1;
  #level = 0;
  #reveal = 0;

  #opts = {
    /** Number of drifting lines. */
    lines: 3,
    /** Stroke colours, front to back. */
    inks: ['rgba(217,185,120,0.22)', 'rgba(236,231,220,0.09)', 'rgba(236,231,220,0.05)'],
    /** Seconds of music shown across the full width, when tracing a score. */
    window: 14,
    /** How long the opening draw takes, in seconds. */
    revealSeconds: 2.6,
  };

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Partial<typeof MelodyLine.prototype.__opts>} [opts]
   */
  mount(canvas, opts = {}) {
    this.#opts = { ...this.#opts, ...opts };
    this.#canvas = canvas;
    this.#ctx = canvas.getContext('2d', { alpha: true });
    this.#reveal = prefersReducedMotion() ? 1 : 0;
    this.resize();
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

  resize() {
    const canvas = this.#canvas;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.#dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * this.#dpr);
    canvas.height = Math.round(r.height * this.#dpr);
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
    if (this.#canvas && this.#canvas.offsetParent === null) {
      this.#raf = requestAnimationFrame(this.#frame);
      return;
    }
    this.#t += dt;
    this.#reveal = Math.min(1, this.#reveal + dt / this.#opts.revealSeconds);
    this.#level = damp(this.#level, transport.playing ? engine.level() : 0, 0.12, dt);
    try { this.#draw(); }
    catch (err) { console.error('[melodyline] frame failed', err); this.stop(); }
    this.#raf = requestAnimationFrame(this.#frame);
  };

  #draw() {
    const ctx = this.#ctx;
    const canvas = this.#canvas;
    if (!ctx || !canvas || !canvas.width) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const score = transport.score;
    const drawnTo = W * (1 - Math.pow(1 - this.#reveal, 3));

    for (let i = 0; i < this.#opts.lines; i++) {
      ctx.strokeStyle = this.#opts.inks[i] ?? this.#opts.inks[this.#opts.inks.length - 1];
      ctx.lineWidth = (i === 0 ? 1.15 : 0.85) * this.#dpr;
      ctx.beginPath();

      if (i === 0 && score && transport.playing) this.#tracePitch(ctx, W, H, drawnTo, score);
      else this.#traceDrift(ctx, W, H, drawnTo, i);

      ctx.stroke();
    }
  }

  /** The idle figure: layered sines at periods that never coincide. */
  #traceDrift(ctx, W, H, drawnTo, index) {
    const mid = H * (0.5 + (index - 1) * 0.11);
    const amp = H * (0.16 - index * 0.03) * (1 + this.#level * 0.5);
    const speed = 0.055 + index * 0.017;
    const step = Math.max(2, W / 260);

    for (let x = 0; x <= drawnTo; x += step) {
      const u = x / W;
      const y = mid
        + Math.sin(u * TAU * 1.1 + this.#t * speed * TAU) * amp
        + Math.sin(u * TAU * 2.7 - this.#t * speed * TAU * 0.6) * amp * 0.34
        + Math.sin(u * TAU * 0.4 + this.#t * speed * TAU * 0.25) * amp * 0.5;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  }

  /**
   * The melody's pitch contour, scrolling under a fixed playhead. Rests hold
   * the previous height, so the line stays continuous the way a phrase does.
   */
  #tracePitch(ctx, W, H, drawnTo, score) {
    const win = this.#opts.window;
    const now = transport.position;
    const t0 = now - win * 0.72;
    const t1 = t0 + win;

    const LO = 48;
    const HI = 88;
    const yFor = (midi) => H * 0.86 - ((clamp(midi, LO, HI) - LO) / (HI - LO)) * H * 0.72;

    const step = Math.max(2, W / 240);
    const cursor = Math.max(0, findEventIndex(score.events, t0) - 32);
    let last = null;
    let started = false;

    for (let x = 0; x <= drawnTo; x += step) {
      const t = t0 + (x / W) * win;
      // Highest melodic note sounding at t — the line a listener follows.
      let midi = null;
      for (let k = cursor; k < score.events.length; k++) {
        const e = score.events[k];
        if (e.t > t) break;
        if (e.t + e.d < t || !MELODIC.has(e.i)) continue;
        if (midi === null || e.m > midi) midi = e.m;
      }
      if (midi !== null) last = midi;
      if (last === null) continue;      // nothing has sounded yet
      const y = yFor(last);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
  }
}

export const marqueeLine = new MelodyLine();
