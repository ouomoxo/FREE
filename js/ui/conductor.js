/**
 * MAESTRO — The conductor.
 *
 * The reference photographs, screened into dots and made to breathe with the
 * music. The image itself is never redrawn — it is sampled once into a
 * luminance field, and every frame re-lays the dot screen over it with a
 * different dot gain.
 *
 * What the music controls:
 *   · the ictus of each beat swells the dots, hardest on the downbeat, then
 *     decays across the beat — so the picture pulses in the piece's real metre;
 *   · the measured signal level and the section's planned intensity set the
 *     resting dot size, so quiet passages thin out and tuttis bloom;
 *   · a slow ripple travels across the screen, one cycle per bar.
 *
 * @module ui/conductor
 */

import { createHalftone, REFERENCE } from '../pixel/halftone.js';
import { engine } from '../audio/engine.js';
import { transport } from '../audio/transport.js';
import { sectionAt } from '../audio/composer.js';
import { bus, EVT } from '../core/bus.js';
import { clamp, damp, prefersReducedMotion, TAU } from '../core/utils.js';

/**
 * Framing for each photograph: how far to zoom in, and how to shift it, so the
 * hands fill the frame instead of floating in a field of black.
 */
export const FRAMING = {
  [REFERENCE.a]: { cover: true, zoom: 1.5, offsetX: -0.05, offsetY: -0.09 },
  [REFERENCE.b]: { cover: true, zoom: 1.16, offsetY: -0.02 },
};

export class Conductor {
  /** @type {import('../pixel/halftone.js').Halftone|null} */ #ht = null;
  /** @type {HTMLCanvasElement|null} */ #canvas = null;
  /** @type {ResizeObserver|null} */ #observer = null;
  /** @type {(() => void)|null} */ #offBeat = null;
  #fitFrame = 0;
  #fitBox = { w: 0, h: 0 };
  #raf = 0;
  #last = 0;
  #running = false;
  #ready = false;

  /* Smoothed animation state. */
  #level = 0;
  #gain = 0.72;
  #pulse = 0;
  #phase = 0;
  #reveal = 0;

  #opts = {
    /** Which reference photograph. */
    src: REFERENCE.b,
    /** Dot lattice spacing, in device pixels. Smaller = finer screen. */
    cell: 6,
    /** Screen angle. 22.5° is the classic monochrome plate angle. */
    angle: 0.3927,
    ink: '#ece7dc',
    /** Resting dot gain when nothing is playing. */
    idleGain: 0.74,
    /** How much the beat swells the dots. */
    beat: 0.26,
    /** Amplitude of the travelling ripple. */
    wave: 0.1,
    /** Seconds for the image to assemble on mount. 0 shows it immediately. */
    revealSeconds: 1.6,
    /** Fractions of the host box to occupy when auto-fitting. */
    fitW: 1,
    fitH: 1,
    maxWidth: Infinity,
    maxHeight: Infinity,
    /** Element to measure; defaults to the canvas's parent. */
    fitTo: null,
    /**
     * Overrides the photograph's default framing. Each surface has a different
     * aspect ratio, so the crop that centres the hands differs.
     * @type {{zoom?:number, offsetX?:number, offsetY?:number}|null}
     */
    framing: null,
    /** Fixed device-pixel size; skips auto-fitting when both are set. */
    width: 0,
    height: 0,
  };

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Partial<typeof Conductor.prototype.__opts>} [opts]
   */
  mount(canvas, opts = {}) {
    this.#opts = { ...this.#opts, ...opts };
    this.#canvas = canvas;
    this.#ready = false;
    this.#gain = this.#opts.idleGain;
    this.#fitBox = { w: 0, h: 0 };
    this.#reveal = prefersReducedMotion() || !this.#opts.revealSeconds ? 1 : 0;

    createHalftone(canvas, this.#opts.src, {
      cell: this.#opts.cell,
      angle: this.#opts.angle,
      ink: this.#opts.ink,
    }).then((ht) => {
      if (this.#canvas !== canvas) return;      // unmounted while loading
      this.#ht = ht;
      this.#ready = true;
      if (this.#opts.width && this.#opts.height) {
        ht.measure(this.#opts.width, this.#opts.height, this.#framing());
      } else {
        const host = this.#opts.fitTo ?? canvas.parentElement;
        if (host) this.#autoFit(host);
      }
    }).catch((err) => console.error('[conductor] could not screen the photograph', err));

    if (!this.#opts.width || !this.#opts.height) {
      const host = this.#opts.fitTo ?? canvas.parentElement;
      if (host) {
        // Deferring to the next frame breaks the observe -> resize -> observe
        // cycle: resizing the canvas changes its own layout box.
        this.#observer = new ResizeObserver(() => {
          cancelAnimationFrame(this.#fitFrame);
          this.#fitFrame = requestAnimationFrame(() => this.#autoFit(host));
        });
        this.#observer.observe(host);
      }
    }

    this.#offBeat?.();
    this.#offBeat = bus.on(EVT.BEAT, ({ beatInBar }) => {
      // The downbeat gets the whole gesture; the other beats a fraction of it.
      this.#pulse = beatInBar === 0 ? 1 : 0.5;
    });

    this.start();
    return this;
  }

  unmount() {
    this.stop();
    cancelAnimationFrame(this.#fitFrame);
    this.#observer?.disconnect();
    this.#observer = null;
    this.#offBeat?.();
    this.#offBeat = null;
    this.#ht = null;
    this.#canvas = null;
    this.#ready = false;
  }

  /** @param {Element} host */
  #autoFit(host) {
    const ht = this.#ht;
    const canvas = this.#canvas;
    if (!ht || !canvas) return;
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    // Ignore sub-pixel jitter, which is the other way these loops start.
    if (Math.abs(r.width - this.#fitBox.w) < 1 && Math.abs(r.height - this.#fitBox.h) < 1) return;
    this.#fitBox = { w: r.width, h: r.height };

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = Math.min(r.width * this.#opts.fitW, this.#opts.maxWidth);
    const cssH = Math.min(r.height * this.#opts.fitH, this.#opts.maxHeight);
    canvas.style.width = `${Math.round(cssW)}px`;
    canvas.style.height = `${Math.round(cssH)}px`;
    ht.measure(cssW * dpr, cssH * dpr, this.#framing());
  }

  /** Resolved crop for this mount. */
  #framing() {
    return { cover: true, ...(FRAMING[this.#opts.src] ?? {}), ...(this.#opts.framing ?? {}) };
  }

  start() {
    if (this.#running) return;
    this.#running = true;
    this.#last = performance.now();
    this.#raf = requestAnimationFrame(this.#frame);
  }

  stop() {
    this.#running = false;
    cancelAnimationFrame(this.#raf);
  }

  /* ------------------------------------------------------------------ */

  #frame = (now) => {
    if (!this.#running) return;
    const dt = Math.min(0.05, (now - this.#last) / 1000);
    this.#last = now;

    // Nothing to draw when the surface is off-screen (a collapsed panel, a
    // hidden overlay). rAF keeps firing; the work does not need to.
    if (!this.#ready || (this.#canvas && this.#canvas.offsetParent === null)) {
      this.#raf = requestAnimationFrame(this.#frame);
      return;
    }

    try { this.#update(dt); this.#draw(); }
    catch (err) { console.error('[conductor] frame failed', err); this.stop(); }
    this.#raf = requestAnimationFrame(this.#frame);
  };

  /** @param {number} dt seconds */
  #update(dt) {
    const score = transport.score;
    const playing = transport.playing;
    const reduced = prefersReducedMotion();

    const rms = playing ? engine.level() : 0;
    this.#level = damp(this.#level, rms, 0.09, dt);

    let intensity = 0.5;
    if (score) {
      const s = sectionAt(score, transport.position);
      if (s) intensity = s.intensity;
    }

    // Resting dot size: quiet sections thin the screen out, tuttis fill it in.
    // The beat pulse rides on top of that.
    const rest = playing
      ? clamp(0.62 + intensity * 0.2 + this.#level * 0.28, 0.5, 1.04)
      : this.#opts.idleGain;

    // Decay the ictus across one beat, so the swell reads as a gesture rather
    // than a flicker.
    const beatLen = score ? Math.max(0.14, score.secPerBeat * 0.8) : 0.4;
    this.#pulse = Math.max(0, this.#pulse - dt / beatLen);
    const target = rest + (reduced ? 0 : this.#pulse * this.#opts.beat);
    this.#gain = damp(this.#gain, target, 0.035, dt);

    if (this.#reveal < 1) {
      this.#reveal = Math.min(1, this.#reveal + dt / this.#opts.revealSeconds);
    }

    // The ripple advances one full cycle per bar.
    if (score && playing && !reduced) {
      this.#phase = (transport.position / (score.secPerBeat * score.meter[0])) * TAU;
    } else if (!reduced) {
      this.#phase += dt * 0.4;
    }
  }

  #draw() {
    const ht = this.#ht;
    if (!ht) return;
    const reduced = prefersReducedMotion();
    ht.render({
      gain: this.#gain,
      wave: reduced ? 0 : this.#opts.wave * (0.4 + this.#level),
      phase: this.#phase,
      reveal: this.#reveal,
    });
  }
}

/** One instance per mount point. */
export const asideConductor = new Conductor();
export const concertConductor = new Conductor();
export const marqueeConductor = new Conductor();
export const bootConductor = new Conductor();
