/**
 * MAESTRO — The conductor.
 *
 * Drives the parametric hand rig through real conducting patterns, locked to
 * the playing score's metre and tempo. The right hand beats time — the ictus of
 * each beat lands exactly on the beat, with the rebound between — while the
 * left hand shapes dynamics, rising through a crescendo and pressing down when
 * the music recedes. Gesture size follows the section's intensity and the
 * measured signal level, so the conductor is genuinely reacting to what you are
 * hearing rather than looping an animation.
 *
 * @module ui/conductor
 */

import { PixelSurface } from '../pixel/surface.js';
import { drawHand, batonHand, shapingHand } from '../pixel/hand.js';
import { engine } from '../audio/engine.js';
import { transport } from '../audio/transport.js';
import { sectionAt } from '../audio/composer.js';
import { bus, EVT } from '../core/bus.js';
import { clamp, lerp, damp, easeOutCubic, easeInOutCubic, prefersReducedMotion, TAU } from '../core/utils.js';

/**
 * Ictus positions in normalised stage space (0..1, y down) for each metre.
 * These are the standard patterns: the downbeat always falls to the bottom
 * centre; 4/4 crosses left then right; 3/4 goes down, out, up.
 */
const PATTERNS = {
  1: [[0.50, 0.80]],
  2: [[0.50, 0.80], [0.50, 0.26]],
  3: [[0.50, 0.80], [0.78, 0.56], [0.52, 0.24]],
  4: [[0.50, 0.80], [0.24, 0.62], [0.80, 0.60], [0.54, 0.24]],
  6: [[0.50, 0.80], [0.40, 0.70], [0.30, 0.58], [0.66, 0.62], [0.74, 0.48], [0.58, 0.26]],
};

/** How high the rebound arcs between two ictus points, as a fraction of stage. */
const REBOUND = 0.16;

export class Conductor {
  /** @type {PixelSurface|null} */ #surface = null;
  /** @type {HTMLCanvasElement|null} */ #canvas = null;
  /** @type {ResizeObserver|null} */ #observer = null;
  #fitFrame = 0;
  #fitBox = { w: 0, h: 0 };
  #raf = 0;
  #last = 0;
  #running = false;

  /* Smoothed animation state. */
  #wrist = { x: 0.5, y: 0.6 };
  #vel = { x: 0, y: 0 };
  #batonAngle = -0.7;
  #amp = 0.5;
  #level = 0;
  #leftY = 0.42;
  #leftCurl = 0.3;
  #idlePhase = 0;
  #flash = 0;
  /** @type {Array<{x:number,y:number,age:number}>} */ #trail = [];

  #opts = {
    /** Backing-buffer size in pixel-art pixels. */
    width: 120,
    height: 160,
    /** Draw the baton's trail. */
    trail: true,
    /** Draw the shaping (left) hand. */
    leftHand: true,
    palette: 'bone',
    dotGap: 0,
    /** Hand size as a fraction of the buffer width. */
    handScale: 0.088,
    /**
     * Where the beat pattern and the shaping hand live inside the buffer.
     *
     * The baton reaches roughly 0.4 of the buffer width beyond the wrist, up
     * and to the right, and the sleeve trails a little under 0.3 back to the
     * left. These bounds are chosen so that the whole rig stays inside the
     * frame at every point of every beat pattern, at full dynamic.
     */
    frame: { x0: 0.16, x1: 0.54, y0: 0.38, y1: 0.88, leftX: 0.36 },
    /** Fixed integer scale; 0 means "fit to the containing box". */
    scale: 0,
    /** Fractions of the host box to occupy when auto-fitting. */
    fitW: 1,
    fitH: 1,
    maxWidth: Infinity,
    maxHeight: Infinity,
    /** Element to measure; defaults to the canvas's parent. */
    fitTo: null,
  };

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Partial<typeof Conductor.prototype.__opts>} [opts]
   */
  mount(canvas, opts = {}) {
    this.#opts = { ...this.#opts, ...opts };
    this.#canvas = canvas;
    this.#surface = new PixelSurface(canvas, {
      width: this.#opts.width,
      height: this.#opts.height,
      scale: this.#opts.scale || 3,
    });
    this.#trail.length = 0;

    // When no fixed scale is given, track the containing box. Views mount while
    // the shell is still behind the boot curtain, so a one-shot measurement
    // would read zero and leave the rig at its default scale for ever.
    if (!this.#opts.scale) {
      const host = this.#opts.fitTo ?? canvas.parentElement;
      if (host) {
        // Deferring to the next frame breaks the observe -> resize -> observe
        // cycle: resizing the canvas changes its own layout box, which would
        // otherwise re-enter the observer synchronously.
        this.#observer = new ResizeObserver(() => {
          cancelAnimationFrame(this.#fitFrame);
          this.#fitFrame = requestAnimationFrame(() => this.#autoFit(host));
        });
        this.#observer.observe(host);
        this.#autoFit(host);
      }
    }

    this.start();
    return this;
  }

  unmount() {
    this.stop();
    cancelAnimationFrame(this.#fitFrame);
    this.#observer?.disconnect();
    this.#observer = null;
    this.#fitBox = { w: 0, h: 0 };
    this.#surface = null;
    this.#canvas = null;
  }

  /** @param {Element} host */
  #autoFit(host) {
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    // Ignore sub-pixel jitter, which is the other way these loops start.
    if (Math.abs(r.width - this.#fitBox.w) < 1 && Math.abs(r.height - this.#fitBox.h) < 1) return;
    this.#fitBox = { w: r.width, h: r.height };
    this.fit(
      Math.min(r.width * (this.#opts.fitW ?? 1), this.#opts.maxWidth ?? Infinity),
      Math.min(r.height * (this.#opts.fitH ?? 1), this.#opts.maxHeight ?? Infinity),
    );
  }

  /** Fit the pixel grid to a CSS box, choosing the largest integer scale. */
  fit(cssW, cssH) {
    if (!this.#surface) return;
    if (this.#opts.scale) return;
    this.#surface.fit(cssW, cssH);
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
    try { this.#update(dt); this.#draw(); }
    catch (err) { console.error('[conductor] frame failed', err); this.stop(); }
    this.#raf = requestAnimationFrame(this.#frame);
  };

  /**
   * Advance the rig.
   * @param {number} dt seconds
   */
  #update(dt) {
    const score = transport.score;
    const playing = transport.playing;
    const reduced = prefersReducedMotion();

    // --- Dynamics -------------------------------------------------------
    const rms = playing ? engine.level() : 0;
    this.#level = damp(this.#level, rms, 0.08, dt);

    let intensity = 0.5;
    if (score) {
      const s = sectionAt(score, transport.position);
      if (s) intensity = s.intensity;
    }
    const targetAmp = playing
      ? clamp(0.42 + intensity * 0.42 + this.#level * 0.35, 0.3, 1.12)
      : 0.34;
    this.#amp = damp(this.#amp, targetAmp, 0.28, dt);

    // --- Where in the bar are we? ---------------------------------------
    /** @type {[number, number]} */
    let target = [0.5, 0.58];
    let tangent = [0, -1];

    if (score && playing && !reduced) {
      const meterTop = score.meter[0];
      const pattern = PATTERNS[meterTop] ?? PATTERNS[4];
      const beatFloat = transport.position / score.secPerBeat;
      const beatIndex = Math.floor(beatFloat);
      const phase = beatFloat - beatIndex;

      const from = pattern[((beatIndex % pattern.length) + pattern.length) % pattern.length];
      const to = pattern[((beatIndex + 1) % pattern.length + pattern.length) % pattern.length];

      // Time warp: rebound quickly out of the ictus, then accelerate into the
      // next one. This is what makes the beat legible to a player.
      const warped = phase < 0.45
        ? easeOutCubic(phase / 0.45) * 0.62
        : 0.62 + easeInOutCubic((phase - 0.45) / 0.55) * 0.38;

      // Quadratic arc with a lifted control point — the rebound.
      const lift = REBOUND * (0.6 + this.#amp * 0.7);
      const cx = (from[0] + to[0]) / 2;
      const cy = Math.min(from[1], to[1]) - lift;
      target = quad(from, [cx, cy], to, warped);
      const ahead = quad(from, [cx, cy], to, Math.min(1, warped + 0.05));
      tangent = [ahead[0] - target[0], ahead[1] - target[1]];

      // Downbeat accent.
      if (phase < 0.08 && beatIndex % meterTop === 0) this.#flash = 1;
    } else {
      // Idle: a slow figure-of-eight, as if marking time.
      this.#idlePhase += dt * (playing ? 0.5 : 0.24);
      const p = this.#idlePhase;
      target = [0.5 + Math.sin(p) * 0.1, 0.55 + Math.sin(p * 2) * 0.07];
      tangent = [Math.cos(p) * 0.1, Math.cos(p * 2) * 0.14];
    }

    // Scale the pattern about the stage centre by the current dynamic.
    target = [
      lerp(0.5, target[0], this.#amp),
      lerp(0.55, target[1], this.#amp),
    ];

    // --- Follow ----------------------------------------------------------
    const halfLife = reduced ? 0.2 : 0.028;
    const px = this.#wrist.x;
    const py = this.#wrist.y;
    this.#wrist.x = damp(this.#wrist.x, target[0], halfLife, dt);
    this.#wrist.y = damp(this.#wrist.y, target[1], halfLife, dt);
    this.#vel.x = (this.#wrist.x - px) / Math.max(dt, 0.0001);
    this.#vel.y = (this.#wrist.y - py) / Math.max(dt, 0.0001);

    // The baton leads the wrist, pointing roughly along the direction of travel
    // but never further than a comfortable wrist angle from neutral.
    const speed = Math.hypot(tangent[0], tangent[1]);
    let aim = speed > 0.0005 ? Math.atan2(tangent[1], tangent[0]) : this.#batonAngle;
    aim -= Math.PI / 2;                      // baton points ahead of the stroke
    // Held inside a plausible wrist range — and, not incidentally, inside the
    // frame. A real baton never swings past the vertical on a downbeat.
    aim = clamp(normalize(aim), -1.5, -0.05);
    this.#batonAngle = mixAngleDamped(this.#batonAngle, aim, 0.05, dt);

    // --- Left hand: shapes the dynamic -----------------------------------
    const wantY = playing
      ? 0.44 - (intensity - 0.5) * 0.2 - this.#level * 0.12
      : 0.48;
    this.#leftY = damp(this.#leftY, wantY, 0.34, dt);
    this.#leftCurl = damp(this.#leftCurl, playing ? clamp(0.42 - this.#level * 0.45, 0.02, 0.5) : 0.34, 0.5, dt);

    this.#flash = Math.max(0, this.#flash - dt * 3.4);

    // --- Trail ------------------------------------------------------------
    if (this.#opts.trail && !reduced) {
      const w = this.#opts.width;
      const hgt = this.#opts.height;
      const f = this.#opts.frame;
      this.#trail.push({
        x: (f.x0 + this.#wrist.x * (f.x1 - f.x0)) * w,
        y: (f.y0 + this.#wrist.y * (f.y1 - f.y0)) * hgt,
        age: 0,
      });
      for (const p of this.#trail) p.age += dt;
      while (this.#trail.length && this.#trail[0].age > 0.42) this.#trail.shift();
      if (this.#trail.length > 90) this.#trail.splice(0, this.#trail.length - 90);
    }
  }

  #draw() {
    const surf = this.#surface;
    if (!surf) return;
    const { width: w, height: hgt } = this.#opts;
    const ctx = surf.ctx;
    ctx.clearRect(0, 0, w, hgt);

    // The beat pattern is defined in a unit square, but the baton sweeps a long
    // way past the wrist. Map the pattern into a sub-rectangle so the tip stays
    // inside the frame at every point in the bar, and so the two hands sit on a
    // diagonal — the shaping hand high and left, the baton low and right — the
    // way they do in the photographs.
    const f = this.#opts.frame;
    const unit = w * this.#opts.handScale;
    const wx = (f.x0 + this.#wrist.x * (f.x1 - f.x0)) * w;
    const wy = (f.y0 + this.#wrist.y * (f.y1 - f.y0)) * hgt;

    // --- Baton trail: dots that fade back into the void -------------------
    if (this.#opts.trail && this.#trail.length > 2) {
      const batonLen = unit * 4.6;
      for (let i = 0; i < this.#trail.length; i += 2) {
        const p = this.#trail[i];
        const life = 1 - p.age / 0.42;
        if (life <= 0) continue;
        const tipX = p.x + Math.cos(this.#batonAngle) * batonLen;
        const tipY = p.y + Math.sin(this.#batonAngle) * batonLen;
        const v = Math.round(life * life * 200);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(Math.round(tipX), Math.round(tipY), 1, 1);
      }
    }

    // --- Left hand, behind ------------------------------------------------
    if (this.#opts.leftHand) {
      drawHand(ctx, shapingHand({
        x: w * this.#opts.frame.leftX,
        y: (0.02 + this.#leftY * 0.34) * hgt,
        scale: unit * 0.9,
        forearmAngle: 2.98,
        palmAngle: 0.2,
        curl: [this.#leftCurl, this.#leftCurl * 0.9, this.#leftCurl, this.#leftCurl * 1.2],
        exposure: 0.74 + this.#level * 0.2,
        cuff: 0.9,
      }));
    }

    // --- Right hand with the baton ---------------------------------------
    const wristTilt = clamp(this.#vel.y * 0.28, -0.42, 0.42);
    drawHand(ctx, batonHand({
      x: wx,
      y: wy,
      scale: unit,
      forearmAngle: 2.46 + wristTilt * 0.3,
      palmAngle: -0.4 + wristTilt,
      baton: this.#batonAngle,
      batonLength: 4.6,
      exposure: 1 + this.#flash * 0.25,
      curl: [0.5, 0.6, 0.7, 0.78],
    }));

    surf.present({
      palette: this.#opts.palette,
      strength: 0.78,
      gamma: 1.12,
      dotGap: this.#opts.dotGap,
    });
  }
}

/* ============================================================================
   Maths helpers
   ========================================================================== */

/** Quadratic Bezier. */
function quad(p0, p1, p2, t) {
  const u = 1 - t;
  return [
    u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
    u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
  ];
}

function normalize(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

function mixAngleDamped(current, target, halfLife, dt) {
  let d = normalize(target - current);
  return current + d * (1 - Math.pow(2, -dt / halfLife));
}

/** A conductor instance per mount point. */
export const asideConductor = new Conductor();
export const concertConductor = new Conductor();
export const marqueeConductor = new Conductor();
