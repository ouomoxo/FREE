/**
 * MAESTRO — Harmonic curves.
 *
 * A Lissajous figure is what you get when two tones are plotted against each
 * other. When their frequencies stand in a simple ratio the curve closes and
 * holds still; when the ratio is complicated, or slightly out, the figure
 * precesses and never repeats. It is the shape of an interval.
 *
 * So the curves here are not decoration — they are the intervals the catalogue
 * is built from. 2:1 is the octave, 3:2 the fifth, 4:3 the fourth, 5:4 the
 * major third. The figure drifts between them, and a hairline traces it.
 *
 * @module art/curves
 */

import { clamp, TAU, damp } from '../core/utils.js';

/**
 * The consonances, in the order a listener meets them.
 * @type {Array<{ratio: [number, number], name: string, cents: number}>}
 */
export const INTERVALS = [
  { ratio: [1, 1], name: 'UNISON', cents: 0 },
  { ratio: [2, 1], name: 'OCTAVE', cents: 1200 },
  { ratio: [3, 2], name: 'PERFECT FIFTH', cents: 702 },
  { ratio: [4, 3], name: 'PERFECT FOURTH', cents: 498 },
  { ratio: [5, 4], name: 'MAJOR THIRD', cents: 386 },
  { ratio: [6, 5], name: 'MINOR THIRD', cents: 316 },
  { ratio: [8, 5], name: 'MINOR SIXTH', cents: 814 },
  { ratio: [5, 3], name: 'MAJOR SIXTH', cents: 884 },
];

export class HarmonicCurves {
  /**
   * @param {{lines?: number, seed?: number}} [o]
   */
  constructor(o = {}) {
    this.lines = o.lines ?? 3;
    /** Current frequency pair, smoothly chased towards the target interval. */
    this.a = 3;
    this.b = 2;
    this.targetA = 3;
    this.targetB = 2;
    this.phase = 0;
    this.t = 0;
    /** 0..1 — how much of each curve is drawn. */
    this.draw01 = 0;
    this.index = 2;
  }

  /** @param {number} i index into {@link INTERVALS} */
  setInterval(i) {
    const spec = INTERVALS[((i % INTERVALS.length) + INTERVALS.length) % INTERVALS.length];
    this.index = i;
    [this.targetA, this.targetB] = spec.ratio;
    return spec;
  }

  get interval() {
    return INTERVALS[((this.index % INTERVALS.length) + INTERVALS.length) % INTERVALS.length];
  }

  /**
   * @param {number} dt seconds
   * @param {{reveal?: number, detune?: number}} [o]
   *   `detune` slightly offsets the ratio so the figure precesses instead of
   *   standing still — a held chord that is very slightly alive.
   */
  update(dt, o = {}) {
    this.t += dt;
    // Chase the target ratio slowly; the morph between two intervals is most
    // of the beauty.
    this.a = damp(this.a, this.targetA, 0.55, dt);
    this.b = damp(this.b, this.targetB, 0.55, dt);
    this.phase += dt * (0.06 + (o.detune ?? 0.004) * 6);
    this.draw01 = damp(this.draw01, clamp(o.reveal ?? 1, 0, 1), 0.35, dt);
  }

  /**
   * Trace the figures.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} W @param {number} H device pixels
   * @param {object} o
   * @param {number} o.cx  Centre, 0..1
   * @param {number} o.cy
   * @param {number} o.radius     Fraction of the smaller dimension.
   * @param {string[]} [o.inks]
   * @param {number} [o.opacity=1]
   * @param {number} [o.dpr=1]
   */
  draw(ctx, W, H, o) {
    const opacity = clamp(o.opacity ?? 1, 0, 1);
    if (opacity <= 0.002) return;
    const inks = o.inks ?? [
      'rgba(217,185,120,0.42)',
      'rgba(236,231,220,0.16)',
      'rgba(236,231,220,0.08)',
    ];
    const dpr = o.dpr ?? 1;
    const cx = o.cx * W;
    const cy = o.cy * H;
    const R = Math.min(W, H) * o.radius;

    const drawn = this.draw01;
    if (drawn <= 0.004) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let l = 0; l < this.lines; l++) {
      // Each successive line is a slightly wider, slightly slower echo.
      const spread = l * 0.055;
      const ax = this.a + spread * 0.5;
      const by = this.b - spread * 0.35;
      const rx = R * (1 - l * 0.09);
      const ry = R * (0.74 - l * 0.07);
      const ph = this.phase + l * 0.42;

      ctx.strokeStyle = inks[l] ?? inks[inks.length - 1];
      ctx.lineWidth = (l === 0 ? 1.05 : 0.75) * dpr;
      ctx.globalAlpha = opacity;
      ctx.beginPath();

      // One full period of the slower component; enough samples that the
      // curvature never shows a facet.
      const STEPS = 900;
      const end = Math.floor(STEPS * drawn);
      for (let s = 0; s <= end; s++) {
        const u = (s / STEPS) * TAU;
        const x = cx + Math.sin(ax * u + ph) * rx;
        const y = cy + Math.sin(by * u) * ry;
        if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
