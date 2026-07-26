/**
 * MAESTRO — PixelSurface.
 *
 * A two-stage canvas. Everything is drawn with ordinary smooth 2D calls into a
 * deliberately tiny backing buffer (say 72x96). That buffer is then quantised
 * to a palette and blitted, nearest-neighbour, onto the visible canvas at an
 * integer scale. The result is real pixel art produced by real drawing code,
 * which means it can animate per-frame without anyone hand-pushing pixels.
 *
 * @module pixel/surface
 */

import { quantize, threshold, PALETTES } from './dither.js';

export class PixelSurface {
  /** @type {HTMLCanvasElement} */ #out;
  /** @type {CanvasRenderingContext2D} */ #outCtx;
  /** @type {HTMLCanvasElement} */ #buf;
  /** @type {CanvasRenderingContext2D} */ #bufCtx;

  /**
   * @param {HTMLCanvasElement} canvas Visible canvas.
   * @param {object} o
   * @param {number} o.width   Backing-buffer width in pixel-art pixels.
   * @param {number} o.height  Backing-buffer height in pixel-art pixels.
   * @param {number} [o.scale] Integer upscale. Omit to auto-fit the element.
   */
  constructor(canvas, o) {
    this.#out = canvas;
    this.#outCtx = canvas.getContext('2d', { alpha: true });
    this.#buf = document.createElement('canvas');
    this.#bufCtx = this.#buf.getContext('2d', { alpha: true, willReadFrequently: true });
    this.w = o.width;
    this.h = o.height;
    this.scale = o.scale ?? 1;
    this.#buf.width = this.w;
    this.#buf.height = this.h;
    this.applyScale(this.scale);
  }

  /** The low-resolution drawing context. Draw here. */
  get ctx() { return this.#bufCtx; }
  get buffer() { return this.#buf; }
  get canvas() { return this.#out; }

  /**
   * Resize the backing buffer (rare — mostly on layout changes).
   * @param {number} w @param {number} h
   */
  resizeBuffer(w, h) {
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.#buf.width = w;
    this.#buf.height = h;
    this.applyScale(this.scale);
  }

  /**
   * Set the integer upscale factor and size the visible canvas accordingly.
   * @param {number} scale
   */
  applyScale(scale) {
    this.scale = Math.max(1, Math.round(scale));
    this.#out.width = this.w * this.scale;
    this.#out.height = this.h * this.scale;
    this.#outCtx.imageSmoothingEnabled = false;
  }

  /**
   * Choose the largest integer scale that fits the given CSS box.
   * @param {number} cssW @param {number} cssH
   */
  fit(cssW, cssH) {
    const s = Math.max(1, Math.floor(Math.min(cssW / this.w, cssH / this.h)));
    if (s !== this.scale) this.applyScale(s);
    return s;
  }

  /** Clear the backing buffer. */
  clear() { this.#bufCtx.clearRect(0, 0, this.w, this.h); }

  /**
   * Quantise the buffer and blit it to the visible canvas.
   *
   * @param {object} [o]
   * @param {import('./dither.js').RGB[]|string} [o.palette='bone']
   * @param {number} [o.strength=1]  Dither strength.
   * @param {number} [o.gamma=1]
   * @param {object} [o.matrix]
   * @param {boolean} [o.silhouette=false] Hard two-tone instead of a ramp.
   * @param {number} [o.cut=0.5]     Silhouette threshold.
   * @param {number} [o.dotGap=0]    Shrink each output dot to expose the grid.
   * @param {number} [o.alpha=1]     Global alpha of the blit.
   */
  present(o = {}) {
    const img = this.#bufCtx.getImageData(0, 0, this.w, this.h);
    if (o.silhouette) {
      threshold(img, { cut: o.cut ?? 0.5, ink: o.ink, paper: o.paper ?? null });
    } else {
      const pal = typeof o.palette === 'string'
        ? (PALETTES[o.palette] ?? PALETTES.bone)
        : (o.palette ?? PALETTES.bone);
      quantize(img, {
        palette: pal,
        strength: o.strength ?? 1,
        gamma: o.gamma ?? 1,
        matrix: o.matrix,
      });
    }
    this.#bufCtx.putImageData(img, 0, 0);

    const octx = this.#outCtx;
    const s = this.scale;
    octx.clearRect(0, 0, this.#out.width, this.#out.height);
    octx.imageSmoothingEnabled = false;
    octx.globalAlpha = o.alpha ?? 1;

    const gap = o.dotGap ?? 0;
    if (gap > 0 && s > gap) {
      // Dot-matrix presentation: each source pixel becomes a smaller square,
      // leaving the dark lattice visible between dots.
      const d = img.data;
      const size = s - gap;
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < this.w; x++) {
          const i = (y * this.w + x) * 4;
          if (d[i + 3] === 0) continue;
          octx.fillStyle = `rgb(${d[i]},${d[i + 1]},${d[i + 2]})`;
          octx.fillRect(x * s, y * s, size, size);
        }
      }
    } else {
      octx.drawImage(this.#buf, 0, 0, this.#out.width, this.#out.height);
    }
    octx.globalAlpha = 1;
  }

  /** Blit without quantising — for buffers already in palette. */
  presentRaw() {
    const octx = this.#outCtx;
    octx.clearRect(0, 0, this.#out.width, this.#out.height);
    octx.imageSmoothingEnabled = false;
    octx.drawImage(this.#buf, 0, 0, this.#out.width, this.#out.height);
  }

  /** @returns {string} data URL of the *upscaled* result. */
  toDataURL() { return this.#out.toDataURL('image/png'); }
}

/**
 * Convenience: render a one-shot pixel image to a detached canvas.
 *
 * @param {object} o
 * @param {number} o.width @param {number} o.height @param {number} o.scale
 * @param {(ctx: CanvasRenderingContext2D, w: number, h: number) => void} o.draw
 * @param {object} [o.present]
 * @returns {HTMLCanvasElement}
 */
export function renderPixelCanvas(o) {
  const canvas = document.createElement('canvas');
  const surf = new PixelSurface(canvas, { width: o.width, height: o.height, scale: o.scale });
  o.draw(surf.ctx, o.width, o.height);
  surf.present(o.present ?? {});
  return canvas;
}
