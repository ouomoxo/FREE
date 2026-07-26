/**
 * MAESTRO — Halftone screen.
 *
 * Turns a photograph into a field of round dots: the image is sampled on a
 * rotated lattice, and at every lattice point a circle is drawn whose radius
 * follows the local brightness. This is the printer's halftone, not a pixel
 * grid — highlights become fat dots that almost touch, shadows thin to nothing,
 * and the black falls away completely.
 *
 * Monochrome by design. One ink, one paper, and the tonal range carried
 * entirely by dot size.
 *
 * The screen can be re-rendered every frame, so the dots can breathe with the
 * music without the source image ever being touched again.
 *
 * @module pixel/halftone
 */

import { clamp, TAU } from '../core/utils.js';

/**
 * @typedef {object} HalftoneOptions
 * @property {number} [cell=6]        Lattice spacing in device pixels.
 * @property {number} [angle=0.3927]  Screen angle in radians (22.5° by default).
 * @property {number} [gamma=1]       Applied to brightness before sizing dots.
 * @property {number} [contrast=1]    Multiplies brightness around the midpoint.
 * @property {number} [brightness=0]  Added to brightness, -1..1.
 * @property {number} [maxDot=0.78]   Largest dot radius, as a fraction of cell.
 * @property {number} [minDot=0.055]  Below this the dot is dropped entirely.
 * @property {number} [floor=0.06]    Brightness below this is treated as black.
 * @property {string} [ink='#ece7dc']
 * @property {string|null} [paper=null] Background fill; null leaves it clear.
 * @property {boolean} [autoLevels=true] Stretch the tonal range to fit.
 * @property {'circle'|'square'|'diamond'} [shape='circle']
 */

export class Halftone {
  /** @type {HTMLCanvasElement|null} */ #canvas = null;
  /** @type {CanvasRenderingContext2D|null} */ #ctx = null;
  /** @type {HTMLImageElement|null} */ #image = null;

  /** Luminance of the source, resampled to the output size. */
  /** @type {Float32Array|null} */ #lum = null;
  #lumW = 0;
  #lumH = 0;

  /** @type {Required<HalftoneOptions>} */
  opts = {
    cell: 6,
    angle: 0.3927,
    gamma: 1,
    contrast: 1,
    brightness: 0,
    // A radius of half a cell means the largest dots exactly touch their
    // neighbours and never merge, which keeps the image reading as dots rather
    // than as flat white shapes.
    maxDot: 0.5,
    minDot: 0.06,
    floor: 0.05,
    ink: '#ece7dc',
    paper: null,
    autoLevels: true,
    shape: 'circle',
  };

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HalftoneOptions} [opts]
   */
  constructor(canvas, opts = {}) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext('2d', { alpha: true });
    Object.assign(this.opts, opts);
  }

  get canvas() { return this.#canvas; }
  get ready() { return this.#lum !== null; }

  /**
   * Load a source image.
   * @param {string|HTMLImageElement} source
   * @returns {Promise<Halftone>}
   */
  async load(source) {
    // A canvas is already decoded and drawable — that is how generated artwork
    // gets screened through exactly the same pipeline as a photograph.
    if (typeof source !== 'string' && !(source instanceof HTMLImageElement)) {
      this.#image = source;
      return this;
    }
    const img = typeof source === 'string' ? new Image() : source;
    if (typeof source === 'string') {
      img.decoding = 'async';
      img.src = source;
    }
    if (!img.complete || !img.naturalWidth) {
      await new Promise((resolve, reject) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', () => reject(new Error(`halftone: cannot load ${img.src}`)), { once: true });
      });
    }
    this.#image = img;
    return this;
  }

  /** Intrinsic size of the loaded source, image or canvas. */
  get sourceSize() {
    const s = this.#image;
    if (!s) return { width: 0, height: 0 };
    return {
      width: s.naturalWidth ?? s.width ?? 0,
      height: s.naturalHeight ?? s.height ?? 0,
    };
  }

  /**
   * Size the output and resample the source's luminance to match.
   *
   * Sampling once into a Float32Array — rather than calling `getImageData` per
   * dot — is what makes a per-frame re-render affordable.
   *
   * @param {number} width  Output width in device pixels.
   * @param {number} height Output height in device pixels.
   * @param {{cover?: boolean, zoom?: number, offsetX?: number, offsetY?: number}} [o]
   *   `cover` crops to fill rather than fitting; `zoom` scales the source about
   *   its centre; `offsetX`/`offsetY` shift it, in fractions of the frame.
   */
  measure(width, height, o = {}) {
    const canvas = this.#canvas;
    const img = this.#image;
    if (!canvas || !img) return this;

    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));

    // Sample at roughly one texel per lattice cell; more is wasted work.
    const cell = Math.max(2, this.opts.cell);
    const sw = Math.max(2, Math.ceil(canvas.width / cell) + 2);
    const sh = Math.max(2, Math.ceil(canvas.height / cell) + 2);

    const buf = document.createElement('canvas');
    buf.width = sw;
    buf.height = sh;
    const bctx = buf.getContext('2d', { willReadFrequently: true });
    bctx.imageSmoothingEnabled = true;
    bctx.imageSmoothingQuality = 'high';

    // Fit or cover the source into the sample buffer.
    const iw = img.naturalWidth ?? img.width;
    const ih = img.naturalHeight ?? img.height;
    const ir = iw / ih;
    const br = sw / sh;
    let dw;
    let dh;
    if (o.cover ? ir > br : ir < br) { dw = sh * ir; dh = sh; }
    else { dw = sw; dh = sw / ir; }

    const zoom = o.zoom ?? 1;
    dw *= zoom;
    dh *= zoom;
    const dx = (sw - dw) / 2 + (o.offsetX ?? 0) * sw;
    const dy = (sh - dh) / 2 + (o.offsetY ?? 0) * sh;
    bctx.drawImage(img, dx, dy, dw, dh);

    const data = bctx.getImageData(0, 0, sw, sh).data;
    const lum = new Float32Array(sw * sh);
    let lo = 1;
    let hi = 0;
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      // Rec. 601 luma, matching how the reference photographs read.
      const v = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
      lum[p] = v;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }

    // Stretch the tonal range. These photographs are almost entirely black, so
    // without this the hands would be the only thing above the dot threshold
    // and the modelling in the shadows would be lost.
    if (this.opts.autoLevels && hi - lo > 0.02) {
      const span = hi - lo;
      for (let p = 0; p < lum.length; p++) lum[p] = (lum[p] - lo) / span;
    }

    this.#lum = lum;
    this.#lumW = sw;
    this.#lumH = sh;
    return this;
  }

  /**
   * Sample the resampled luminance with bilinear interpolation.
   * @param {number} x @param {number} y in output device pixels
   */
  #sample(x, y) {
    const lum = this.#lum;
    if (!lum) return 0;
    const cell = Math.max(2, this.opts.cell);
    const fx = clamp(x / cell + 1, 0, this.#lumW - 1.001);
    const fy = clamp(y / cell + 1, 0, this.#lumH - 1.001);
    const ix = fx | 0;
    const iy = fy | 0;
    const tx = fx - ix;
    const ty = fy - iy;
    const w = this.#lumW;
    const a = lum[iy * w + ix];
    const b = lum[iy * w + ix + 1];
    const c = lum[(iy + 1) * w + ix];
    const d = lum[(iy + 1) * w + ix + 1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }

  /**
   * Draw the screen.
   *
   * @param {object} [o]
   * @param {number} [o.gain=1]    Multiplies every dot radius — the hook the
   *                               music uses to make the image breathe.
   * @param {number} [o.jitter=0]  Random displacement, in fractions of a cell.
   * @param {number} [o.wave=0]    Amplitude of a travelling ripple, 0..1.
   * @param {number} [o.phase=0]   Ripple phase in radians.
   * @param {number} [o.reveal=1]  0..1. The image assembles itself along a
   *                               diagonal: each dot grows from nothing as the
   *                               sweep reaches it, so the picture arrives
   *                               rather than appears.
   * @param {number} [o.revealAngle=0.6] Direction of the sweep, 0 = left-to-
   *                               right, 1 = top-to-bottom.
   */
  render(o = {}) {
    const ctx = this.#ctx;
    const canvas = this.#canvas;
    if (!ctx || !canvas || !this.#lum) return;

    const W = canvas.width;
    const H = canvas.height;
    const {
      cell, angle, gamma, contrast, brightness,
      maxDot, minDot, floor, ink, paper, shape,
    } = this.opts;

    if (paper) { ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H); }
    else ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = ink;

    const gain = o.gain ?? 1;
    const jitter = o.jitter ?? 0;
    const wave = o.wave ?? 0;
    const phase = o.phase ?? 0;
    const reveal = o.reveal ?? 1;
    // How much of the sweep is "in flight" at once. A wide band makes the
    // assembly feel like a slow exposure rather than a wipe.
    const BAND = 0.62;
    const revealing = reveal < 1;
    const rax = 1 - (o.revealAngle ?? 0.6);
    const ray = o.revealAngle ?? 0.6;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const maxR = cell * maxDot;
    const minR = cell * minDot;

    // The rotated lattice has to be walked in its own space, over a range large
    // enough that its footprint still covers the whole output rectangle.
    const reach = Math.ceil((Math.abs(W * cos) + Math.abs(H * sin)) / cell) + 2;
    const reachY = Math.ceil((Math.abs(W * sin) + Math.abs(H * cos)) / cell) + 2;

    ctx.beginPath();
    for (let j = -reachY; j <= reachY; j++) {
      for (let i = -reach; i <= reach; i++) {
        // Lattice point, rotated into output space.
        const lx = i * cell;
        const ly = j * cell;
        let x = lx * cos - ly * sin;
        let y = lx * sin + ly * cos;
        if (x < -cell || x > W + cell || y < -cell || y > H + cell) continue;

        if (jitter) {
          // Deterministic per-point offset — a hash, not Math.random, so the
          // screen does not crawl between frames.
          const hash = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
          const h1 = hash - Math.floor(hash);
          const h2 = (hash * 1.61803) % 1;
          x += (h1 - 0.5) * cell * jitter;
          y += (h2 - 0.5) * cell * jitter;
        }

        let v = this.#sample(x, y);
        if (v <= floor) continue;

        v = (v - floor) / (1 - floor);
        v = clamp((v - 0.5) * contrast + 0.5 + brightness, 0, 1);
        if (gamma !== 1) v = Math.pow(v, gamma);

        let r = maxR * v * gain;
        if (wave) {
          const d = (x + y) / cell;
          r *= 1 + wave * Math.sin(d * 0.35 + phase);
        }
        if (revealing) {
          // Position along the sweep, 0..1, plus a small deterministic offset
          // so the leading edge breaks up instead of arriving as a straight rule.
          const seed = Math.sin(i * 91.7 + j * 47.3) * 43758.5453;
          const grain = (seed - Math.floor(seed)) * 0.14;
          const along = (x / W) * rax + (y / H) * ray + grain;
          const local = clamp((reveal * (1 + BAND) - along) / BAND, 0, 1);
          // easeOutCubic — the dot decelerates into its final size.
          r *= 1 - Math.pow(1 - local, 3);
        }
        if (r < minR) continue;
        r = Math.min(r, cell * 0.98);

        switch (shape) {
          case 'square':
            ctx.rect(x - r, y - r, r * 2, r * 2);
            break;
          case 'diamond':
            ctx.moveTo(x, y - r);
            ctx.lineTo(x + r, y);
            ctx.lineTo(x, y + r);
            ctx.lineTo(x - r, y);
            ctx.closePath();
            break;
          default:
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, TAU);
        }
      }
    }
    ctx.fill();
  }

  /**
   * Convenience: size to a CSS box at the device pixel ratio, then draw.
   * @param {number} cssW @param {number} cssH
   * @param {{cover?: boolean, dpr?: number, zoom?: number, offsetX?: number, offsetY?: number}} [o]
   */
  fitAndRender(cssW, cssH, o = {}) {
    const dpr = o.dpr ?? Math.min(2, window.devicePixelRatio || 1);
    this.measure(cssW * dpr, cssH * dpr, o);
    if (this.#canvas) {
      this.#canvas.style.width = `${cssW}px`;
      this.#canvas.style.height = `${cssH}px`;
    }
    this.render();
    return this;
  }
}

/**
 * The two reference photographs the project is built around.
 *
 * Resolved against this module's own URL so the paths hold whether the page
 * lives at the site root or under `/dev/`.
 */
const ref = (name) => new URL(`../../assets/reference/${name}`, import.meta.url).href;

export const REFERENCE = Object.freeze({
  /** Both hands: the shaping hand above, the baton hand below. */
  a: ref('conductor-a.jpg'),
  /** Portrait: the baton hand raised, the shaping hand beneath. */
  b: ref('conductor-b.jpg'),
});

/** @type {Map<string, HTMLImageElement>} */
const imageCache = new Map();

/**
 * Load (and cache) one of the reference photographs.
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(src) {
  let img = imageCache.get(src);
  if (img) {
    return img.complete && img.naturalWidth
      ? Promise.resolve(img)
      : new Promise((res, rej) => {
          img.addEventListener('load', () => res(img), { once: true });
          img.addEventListener('error', rej, { once: true });
        });
  }
  img = new Image();
  img.decoding = 'async';
  img.src = src;
  imageCache.set(src, img);
  return new Promise((res, rej) => {
    if (img.complete && img.naturalWidth) { res(img); return; }
    img.addEventListener('load', () => res(img), { once: true });
    img.addEventListener('error', () => rej(new Error(`cannot load ${src}`)), { once: true });
  });
}

/**
 * Create a halftone bound to a canvas and a reference photograph.
 * @param {HTMLCanvasElement} canvas
 * @param {string} src
 * @param {HalftoneOptions} [opts]
 * @returns {Promise<Halftone>}
 */
export async function createHalftone(canvas, src, opts) {
  const img = await loadImage(src);
  const ht = new Halftone(canvas, opts);
  await ht.load(img);
  return ht;
}
