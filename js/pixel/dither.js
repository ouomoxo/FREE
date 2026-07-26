/**
 * MAESTRO — Ordered dithering and palette quantisation.
 *
 * The artwork pipeline draws smooth vector shapes into a very small buffer and
 * then crushes that buffer down to a handful of tones with an ordered Bayer
 * matrix. That is what turns a soft gradient into honest dot pixel art: the
 * shading becomes a visible lattice of dots rather than a blur.
 *
 * @module pixel/dither
 */

/** 4x4 ordered dither matrix, normalised to 0..1. */
export const BAYER4 = buildBayer(2);
/** 8x8 ordered dither matrix, normalised to 0..1. */
export const BAYER8 = buildBayer(3);

/**
 * Recursively construct a 2^n x 2^n Bayer matrix normalised to [0,1).
 * @param {number} n
 * @returns {{size:number, data:Float32Array}}
 */
function buildBayer(n) {
  let m = [[0]];
  for (let k = 0; k < n; k++) {
    const s = m.length;
    const next = Array.from({ length: s * 2 }, () => new Array(s * 2).fill(0));
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const v = m[y][x] * 4;
        next[y][x] = v;
        next[y][x + s] = v + 2;
        next[y + s][x] = v + 3;
        next[y + s][x + s] = v + 1;
      }
    }
    m = next;
  }
  const size = m.length;
  const data = new Float32Array(size * size);
  const denom = size * size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) data[y * size + x] = m[y][x] / denom;
  }
  return { size, data };
}

/**
 * @typedef {[number, number, number]} RGB
 */

/**
 * Parse `#rgb`, `#rrggbb`, or `rgb()` into an RGB triple.
 * @param {string} css
 * @returns {RGB}
 */
export function parseColor(css) {
  const s = css.trim();
  if (s[0] === '#') {
    const hex = s.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
      ];
    }
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  const m = s.match(/-?[\d.]+/g);
  if (m) return [Number(m[0]) | 0, Number(m[1]) | 0, Number(m[2]) | 0];
  return [0, 0, 0];
}

/**
 * Build an evenly-spaced ramp between two colours.
 * @param {string} from
 * @param {string} to
 * @param {number} steps
 * @returns {RGB[]}
 */
export function ramp(from, to, steps) {
  const a = parseColor(from);
  const b = parseColor(to);
  const out = [];
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1);
    out.push([
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t),
    ]);
  }
  return out;
}

/**
 * Concatenate ramps through a list of stops.
 * @param {string[]} stops
 * @param {number} perSegment
 * @returns {RGB[]}
 */
export function rampThrough(stops, perSegment) {
  const out = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const seg = ramp(stops[i], stops[i + 1], perSegment + 1);
    if (i > 0) seg.shift();
    out.push(...seg);
  }
  return out;
}

/**
 * Quantise image data in place: luminance -> ordered-dithered palette index.
 *
 * Transparent pixels stay transparent, which lets artwork be composited over
 * whatever surface it sits on.
 *
 * @param {ImageData} img
 * @param {object} opts
 * @param {RGB[]} opts.palette      Dark -> light ramp.
 * @param {{size:number,data:Float32Array}} [opts.matrix=BAYER4]
 * @param {number} [opts.strength=1] Dither amount, 0..1.
 * @param {number} [opts.gamma=1]    Applied to luminance before quantising.
 * @param {number} [opts.alphaCut=8] Alpha below this becomes fully transparent.
 */
export function quantize(img, opts) {
  const { palette, matrix = BAYER4, strength = 1, gamma = 1, alphaCut = 8 } = opts;
  const d = img.data;
  const w = img.width;
  const levels = palette.length;
  const ms = matrix.size;
  const md = matrix.data;

  for (let i = 0, px = 0; i < d.length; i += 4, px++) {
    const a = d[i + 3];
    if (a < alphaCut) { d[i + 3] = 0; continue; }

    // Rec. 601 luma — matches how the reference photographs read.
    let lum = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
    if (gamma !== 1) lum = Math.pow(lum, gamma);

    const x = px % w;
    const y = (px / w) | 0;
    const threshold = md[(y % ms) * ms + (x % ms)] - 0.5;
    const v = lum * (levels - 1) + threshold * strength;
    const idx = Math.max(0, Math.min(levels - 1, Math.round(v)));

    const c = palette[idx];
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
    d[i + 3] = 255;
  }
}

/**
 * Hard threshold to two tones — used for silhouettes and the conductor hands,
 * where the reference photographs are almost pure black and pure highlight.
 *
 * @param {ImageData} img
 * @param {object} opts
 * @param {number} [opts.cut=0.5]
 * @param {RGB} [opts.ink=[236,231,220]]
 * @param {RGB|null} [opts.paper=null] `null` keeps the dark side transparent.
 */
export function threshold(img, opts = {}) {
  const cut = opts.cut ?? 0.5;
  const ink = opts.ink ?? [236, 231, 220];
  const paper = opts.paper ?? null;
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) { d[i + 3] = 0; continue; }
    const lum = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
    if (lum >= cut) {
      d[i] = ink[0]; d[i + 1] = ink[1]; d[i + 2] = ink[2]; d[i + 3] = 255;
    } else if (paper) {
      d[i] = paper[0]; d[i + 1] = paper[1]; d[i + 2] = paper[2]; d[i + 3] = 255;
    } else {
      d[i + 3] = 0;
    }
  }
}

/**
 * Named palettes. Every one is a dark->light ramp so `quantize` can index it.
 * @type {Record<string, RGB[]>}
 */
export const PALETTES = {
  /* The house palette: void black to bone white. */
  bone: rampThrough(['#050506', '#1b1b21', '#3a3a44', '#6f6c66', '#a8a29a', '#ece7dc'], 1),
  /* Baton gold — reserved for accents and the currently playing item. */
  gold: rampThrough(['#050506', '#221a0d', '#4a3c22', '#8d7442', '#d9b978', '#f5e6bf'], 1),
  /* Cold marble, for the "Nocturnes" corner of the catalogue. */
  marble: rampThrough(['#04050a', '#131a26', '#2b3648', '#5a6a80', '#97a6b8', '#e2e9f0'], 1),
  /* Aged score paper. */
  sepia: rampThrough(['#070503', '#241a10', '#4d3823', '#8a6742', '#c49b6c', '#f0dcbc'], 1),
  /* Deep red velvet of the auditorium. */
  velvet: rampThrough(['#080405', '#24090e', '#4d1520', '#8a2b3a', '#c85f6a', '#f0b8ba'], 1),
  /* Verdigris on old brass. */
  brass: rampThrough(['#040706', '#0f2019', '#1e4034', '#3d6f57', '#78a78a', '#d6ecdb'], 1),
  /* High-contrast two-tone, for silhouettes. */
  duotone: rampThrough(['#050506', '#ece7dc'], 4),
};
