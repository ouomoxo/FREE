/**
 * MAESTRO — Procedural cover artwork.
 *
 * Sleeves for the abstract records. Anything whose subject is the conductor
 * himself uses the reference photograph instead, screened into dots by
 * {@link module:pixel/photo} — these motifs are for everything else.
 *
 * Every record, programme and ensemble in the catalogue gets a unique sleeve,
 * generated from its seed at a 64x64 backing resolution and quantised to a
 * five-tone palette. No image assets ship with the app.
 *
 * Each motif is a small scene, lit from the upper left like the reference
 * photographs, with a vignette that lets the subject fall into the void.
 *
 * @module pixel/art
 */

import { PALETTES } from './dither.js';
import { Halftone } from './halftone.js';
import { Random, TAU, clamp } from '../core/utils.js';

const SIZE = 64;

/** Greyscale helper — buffers are quantised afterwards. */
const g = (v) => {
  const n = Math.round(clamp(v, 0, 1) * 255);
  return `rgb(${n},${n},${n})`;
};

/* ============================================================================
   Motifs
   ========================================================================== */

/**
 * @typedef {(ctx: CanvasRenderingContext2D, w: number, h: number, rnd: ReturnType<typeof Random>) => void} Motif
 */

/** @type {Record<string, Motif>} */
export const MOTIFS = {
  /** The auditorium, seen from the podium. */
  hall(ctx, w, h, rnd) {
    backdrop(ctx, w, h, 0.04);
    const horizon = h * 0.42;
    for (let row = 0; row < 9; row++) {
      const t = row / 8;
      const y = horizon + Math.pow(t, 1.7) * h * 0.6;
      const inset = (1 - t) * w * 0.12;
      const v = 0.5 - t * 0.34;
      ctx.fillStyle = g(v);
      ctx.fillRect(inset, y, w - inset * 2, Math.max(1, 2 + t * 2));
      const seats = 6 + row * 2;
      ctx.fillStyle = g(v * 0.5);
      for (let s = 0; s <= seats; s++) {
        const x = inset + ((w - inset * 2) * s) / seats;
        ctx.fillRect(x, y, 1, Math.max(1, 2 + t * 2));
      }
    }
    // Proscenium light.
    const glow = ctx.createRadialGradient(w / 2, horizon * 0.5, 1, w / 2, horizon * 0.5, w * 0.5);
    glow.addColorStop(0, g(0.85));
    glow.addColorStop(0.45, g(0.2));
    glow.addColorStop(1, g(0.02));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, horizon + 2);
    vignette(ctx, w, h, 0.36);
  },

  /** Constructivist nesting — the quartet's sleeve language. */
  geometry(ctx, w, h, rnd) {
    backdrop(ctx, w, h, 0.08);
    const cx = w / 2;
    const cy = h / 2;
    const n = 5 + rnd.int(3);
    for (let i = n; i > 0; i--) {
      const t = i / n;
      const size = t * w * 0.78;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rnd.float(-0.16, 0.16) + (i % 2 ? 0.02 : -0.02));
      const v = 0.3 + (1 - t) * 0.7;
      if (i % 2 === 0) {
        ctx.fillStyle = g(v * 0.22);
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.strokeStyle = g(v);
        ctx.lineWidth = 1.8;
        ctx.strokeRect(-size / 2, -size / 2, size, size);
      } else {
        ctx.strokeStyle = g(v * 0.9);
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.fillStyle = g(1);
    ctx.fillRect(cx - 2, cy - 2, 4, 4);
    vignette(ctx, w, h, 0.28);
  },

  /** Five lines and a few notes. */
  staff(ctx, w, h, rnd) {
    backdrop(ctx, w, h, 0.06);
    const top = h * 0.3;
    const gapY = h * 0.09;
    ctx.fillStyle = g(0.46);
    for (let i = 0; i < 5; i++) ctx.fillRect(w * 0.06, top + i * gapY, w * 0.88, 1);
    const count = 6 + rnd.int(5);
    for (let i = 0; i < count; i++) {
      const x = w * 0.14 + (i / count) * w * 0.74 + rnd.float(-1, 1);
      const line = rnd.int(-1, 9);
      const y = top + (line * gapY) / 2;
      ctx.fillStyle = g(0.95);
      ctx.beginPath();
      ctx.ellipse(x, y, 2.6, 2, -0.3, 0, TAU);
      ctx.fill();
      if (rnd.chance(0.75)) {
        ctx.fillStyle = g(0.8);
        ctx.fillRect(x + 2, y - 11, 1, 11);
      }
    }
    vignette(ctx, w, h, 0.3);
  },

  /** Moon over a flat horizon. */
  moon(ctx, w, h, rnd) {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, g(0.3));
    sky.addColorStop(0.55, g(0.1));
    sky.addColorStop(1, g(0.02));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const mx = w * (0.3 + rnd.float(0.4));
    const my = h * 0.3;
    const r = w * 0.17;
    const mg = ctx.createRadialGradient(mx - r * 0.3, my - r * 0.3, 1, mx, my, r);
    mg.addColorStop(0, g(1));
    mg.addColorStop(0.7, g(0.82));
    mg.addColorStop(1, g(0.5));
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, TAU);
    ctx.fill();
    // Craters, as darker dots.
    for (let i = 0; i < 5; i++) {
      const a = rnd.float(TAU);
      const d = rnd.float(r * 0.7);
      ctx.fillStyle = g(0.56);
      ctx.beginPath();
      ctx.arc(mx + Math.cos(a) * d, my + Math.sin(a) * d, rnd.float(1, 3), 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = g(0.03);
    ctx.fillRect(0, h * 0.78, w, h * 0.22);
    ctx.fillStyle = g(0.16);
    ctx.fillRect(0, h * 0.78, w, 1);
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = g(rnd.float(0.4, 0.95));
      ctx.fillRect(rnd.int(w), rnd.int(h * 0.6), 1, 1);
    }
    vignette(ctx, w, h, 0.24);
  },

  /** A bar meter — eight bits, eight bars. */
  bars(ctx, w, h, rnd) {
    backdrop(ctx, w, h, 0.07);
    const n = 8;
    const pad = w * 0.1;
    const bw = (w - pad * 2) / n;
    for (let i = 0; i < n; i++) {
      const amp = 0.2 + Math.abs(Math.sin(i * 1.7 + rnd.float(TAU))) * 0.72;
      const bh = amp * h * 0.66;
      const x = pad + i * bw;
      for (let k = 0; k < Math.round(bh / 4); k++) {
        const t = k / Math.max(1, bh / 4);
        ctx.fillStyle = g(0.32 + t * 0.66);
        ctx.fillRect(x + 1, h * 0.82 - (k + 1) * 4, bw - 3, 3);
      }
    }
    ctx.fillStyle = g(0.3);
    ctx.fillRect(pad, h * 0.83, w - pad * 2, 1);
    vignette(ctx, w, h, 0.28);
  },

  /** A rose window. */
  rose(ctx, w, h, rnd) {
    backdrop(ctx, w, h, 0.05);
    const cx = w / 2;
    const cy = h / 2;
    const petals = 8 + rnd.int(2) * 4;
    const R = w * 0.4;
    for (let ring = 3; ring >= 1; ring--) {
      const rr = (R * ring) / 3;
      for (let i = 0; i < petals; i++) {
        const a = (i / petals) * TAU + ring * 0.18;
        const x = cx + Math.cos(a) * rr * 0.62;
        const y = cy + Math.sin(a) * rr * 0.62;
        ctx.strokeStyle = g(0.3 + (3 - ring) * 0.22);
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.ellipse(x, y, rr * 0.34, rr * 0.2, a, 0, TAU);
        ctx.stroke();
      }
      ctx.strokeStyle = g(0.24 + (3 - ring) * 0.2);
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, TAU);
      ctx.stroke();
    }
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.12);
    core.addColorStop(0, g(1));
    core.addColorStop(1, g(0.1));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.12, 0, TAU);
    ctx.fill();
    vignette(ctx, w, h, 0.33);
  },

  /** A lit arch at the end of a dark nave. */
  arch(ctx, w, h, rnd) {
    backdrop(ctx, w, h, 0.03);
    const layers = 5;
    for (let i = layers; i >= 0; i--) {
      const t = i / layers;
      const aw = w * (0.16 + t * 0.34);
      const ah = h * (0.42 + t * 0.4);
      const x = w / 2 - aw / 2;
      const y = h * 0.9 - ah;
      const v = 0.9 - t * 0.78;
      ctx.fillStyle = g(v);
      ctx.beginPath();
      ctx.moveTo(x, h * 0.9);
      ctx.lineTo(x, y + aw / 2);
      ctx.arc(w / 2, y + aw / 2, aw / 2, Math.PI, 0);
      ctx.lineTo(x + aw, h * 0.9);
      ctx.closePath();
      ctx.fill();
    }
    // Floor reflection.
    const refl = ctx.createLinearGradient(0, h * 0.9, 0, h);
    refl.addColorStop(0, g(0.34));
    refl.addColorStop(1, g(0.02));
    ctx.fillStyle = refl;
    ctx.fillRect(w * 0.3, h * 0.9, w * 0.4, h * 0.1);
    vignette(ctx, w, h, 0.37);
  },

  /** A standing wave. */
  wave(ctx, w, h, rnd) {
    backdrop(ctx, w, h, 0.05);
    const lines = 7;
    for (let l = 0; l < lines; l++) {
      const t = l / (lines - 1);
      const yc = h * (0.18 + t * 0.64);
      const amp = h * 0.1 * (1 - Math.abs(t - 0.5) * 1.2);
      const freq = 1.4 + l * 0.42;
      const phase = rnd.float(TAU);
      ctx.strokeStyle = g(0.24 + (1 - Math.abs(t - 0.5) * 2) * 0.72);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let x = 2; x <= w - 2; x++) {
        const y = yc + Math.sin((x / w) * TAU * freq + phase) * amp;
        if (x === 2) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    vignette(ctx, w, h, 0.29);
  },

  /** Curtains of light. */
  aurora(ctx, w, h, rnd) {
    backdrop(ctx, w, h, 0.04);
    for (let b = 0; b < 5; b++) {
      const phase = rnd.float(TAU);
      const width = w * rnd.float(0.08, 0.2);
      const x0 = rnd.float(w * 0.1, w * 0.8);
      const grad = ctx.createLinearGradient(0, h * 0.15, 0, h * 0.85);
      grad.addColorStop(0, g(0.9));
      grad.addColorStop(0.4, g(0.5));
      grad.addColorStop(1, g(0.03));
      ctx.fillStyle = grad;
      ctx.beginPath();
      for (let y = h * 0.12; y <= h * 0.86; y += 2) {
        const bend = Math.sin((y / h) * 4 + phase) * w * 0.09;
        ctx.lineTo(x0 + bend, y);
      }
      for (let y = h * 0.86; y >= h * 0.12; y -= 2) {
        const bend = Math.sin((y / h) * 4 + phase) * w * 0.09;
        ctx.lineTo(x0 + bend + width, y);
      }
      ctx.closePath();
      ctx.globalAlpha = 0.62;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = g(rnd.float(0.5, 1));
      ctx.fillRect(rnd.int(w), rnd.int(h * 0.4), 1, 1);
    }
    vignette(ctx, w, h, 0.28);
  },

  /** A receding lattice — the harpsichord's jack rail. */
  lattice(ctx, w, h, rnd) {
    backdrop(ctx, w, h, 0.05);
    const vp = [w * rnd.float(0.4, 0.6), h * 0.45];
    for (let i = 0; i <= 12; i++) {
      const x = (i / 12) * w;
      ctx.strokeStyle = g(0.14 + (1 - Math.abs(i / 12 - 0.5) * 2) * 0.6);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(vp[0], vp[1]);
      ctx.stroke();
    }
    for (let r = 1; r <= 8; r++) {
      const t = Math.pow(r / 8, 2.1);
      const y = vp[1] + t * (h - vp[1]);
      ctx.strokeStyle = g(0.2 + (1 - t) * 0.7);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    const glow = ctx.createRadialGradient(vp[0], vp[1], 0, vp[0], vp[1], w * 0.3);
    glow.addColorStop(0, g(1));
    glow.addColorStop(0.35, g(0.5));
    glow.addColorStop(1, g(0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    vignette(ctx, w, h, 0.4);
  },

  /** A spiral of dots — thirty variations on one point. */
  spiral(ctx, w, h, rnd) {
    backdrop(ctx, w, h, 0.06);
    const cx = w / 2;
    const cy = h / 2;
    const n = 120;
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const r = Math.sqrt(t) * w * 0.42;
      const a = i * golden + rnd.float(-0.02, 0.02);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      const size = 1 + (1 - t) * 2;
      ctx.fillStyle = g(0.25 + (1 - t) * 0.75);
      ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), Math.ceil(size), Math.ceil(size));
    }
    vignette(ctx, w, h, 0.3);
  },

  /** Sun over banded ground. */
  sunrise(ctx, w, h, rnd) {
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.7);
    sky.addColorStop(0, g(0.06));
    sky.addColorStop(1, g(0.5));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h * 0.6;
    const r = w * 0.28;
    const sun = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
    sun.addColorStop(0, g(1));
    sun.addColorStop(0.6, g(0.9));
    sun.addColorStop(1, g(0.62));
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();

    // Scanline bands cutting the sun — the "low resolution" idea, literally.
    ctx.fillStyle = g(0.04);
    for (let i = 0; i < 9; i++) {
      const y = cy - r + (i * (r * 2)) / 9;
      ctx.fillRect(0, y, w, Math.max(1, i * 0.36));
    }
    ctx.fillStyle = g(0.02);
    ctx.fillRect(0, h * 0.72, w, h * 0.28);
    ctx.fillStyle = g(0.3);
    ctx.fillRect(0, h * 0.72, w, 1);
    vignette(ctx, w, h, 0.23);
  },

  /** Traces on a board. */
  circuit(ctx, w, h, rnd) {
    backdrop(ctx, w, h, 0.05);
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 14; i++) {
      let x = rnd.int(4, w - 4);
      let y = rnd.int(4, h - 4);
      ctx.strokeStyle = g(rnd.float(0.3, 0.95));
      ctx.beginPath();
      ctx.moveTo(x, y);
      const steps = rnd.int(2, 6);
      for (let s = 0; s < steps; s++) {
        const horizontal = s % 2 === 0;
        const d = rnd.int(4, 18) * (rnd.chance(0.5) ? 1 : -1);
        if (horizontal) x = clamp(x + d, 2, w - 2); else y = clamp(y + d, 2, h - 2);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = g(1);
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    for (let i = 0; i < 5; i++) {
      const x = rnd.int(6, w - 14);
      const y = rnd.int(6, h - 10);
      ctx.fillStyle = g(0.2);
      ctx.fillRect(x, y, 10, 6);
      ctx.strokeStyle = g(0.7);
      ctx.strokeRect(x + 0.5, y + 0.5, 9, 5);
    }
    vignette(ctx, w, h, 0.28);
  },

  /** A single figure under a spotlight — used for ensemble portraits. */
  portrait(ctx, w, h, rnd) {
    backdrop(ctx, w, h, 0.03);
    const cx = w * 0.5;
    const glow = ctx.createRadialGradient(cx, h * 0.34, 2, cx, h * 0.34, w * 0.46);
    glow.addColorStop(0, g(0.44));
    glow.addColorStop(1, g(0.02));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = g(0.9);
    ctx.beginPath();
    ctx.arc(cx, h * 0.34, w * 0.11, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.22, h * 0.92);
    ctx.quadraticCurveTo(cx, h * 0.42, cx + w * 0.22, h * 0.92);
    ctx.closePath();
    ctx.fillStyle = g(0.62);
    ctx.fill();
    vignette(ctx, w, h, 0.39);
  },
};

export const MOTIF_NAMES = Object.keys(MOTIFS);

/* ============================================================================
   Scene helpers
   ========================================================================== */

/**
 * Fill the sleeve with a very dark ground.
 *
 * Kept deliberately below the first palette step so that quantisation crushes
 * it to solid black instead of dithering it into a field of noise — the dots
 * should belong to the subject, not to the emptiness around it.
 */
function backdrop(ctx, w, h, base = 0.06) {
  const bg = ctx.createLinearGradient(0, 0, w * 0.6, h);
  bg.addColorStop(0, g(base * 0.5 + 0.012));
  bg.addColorStop(1, g(base * 0.12));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
}

function vignette(ctx, w, h, strength = 0.6) {
  const v = ctx.createRadialGradient(w * 0.45, h * 0.4, w * 0.1, w * 0.5, h * 0.5, w * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

/* ============================================================================
   Public API
   ========================================================================== */

/** @type {Map<string, string>} */
const dataUrlCache = new Map();

/**
 * Ink colour for a sleeve: the brightest tone of its palette. The screen is
 * monochrome — a palette here chooses one ink, not a ramp.
 * @param {string} name
 */
function inkFor(name) {
  const pal = PALETTES[name] ?? PALETTES.bone;
  const [r, gr, b] = pal[pal.length - 1];
  return `rgb(${r},${gr},${b})`;
}

/**
 * Render a sleeve to a fresh canvas.
 *
 * The motif is drawn as a small greyscale scene and then put through the same
 * halftone screen as the photographs, so every image in the application — a
 * generated sleeve, a portrait, the conductor — is made of the same round dots.
 *
 * @param {object} o
 * @param {string} o.seed
 * @param {string} [o.motif]
 * @param {string} [o.palette]
 * @param {number} [o.scale=4]  Output is 64 * scale px square.
 * @param {number} [o.cell]     Dot pitch; derived from the size if omitted.
 * @returns {HTMLCanvasElement}
 */
export function renderCover(o) {
  const scale = o.scale ?? 4;
  const size = SIZE * scale;
  const rnd = Random(o.seed);

  // 1. Draw the scene, large enough that the screen has real detail to sample.
  const source = document.createElement('canvas');
  source.width = SIZE * 4;
  source.height = SIZE * 4;
  const sctx = source.getContext('2d');
  sctx.scale(4, 4);
  const motif = MOTIFS[o.motif] ?? MOTIFS[MOTIF_NAMES[rnd.int(MOTIF_NAMES.length)]];
  motif(sctx, SIZE, SIZE, rnd);

  // 2. Screen it. The pitch scales with the output so a 96px thumbnail is not a
  //    solid mass and a 384px sleeve is not a fine grey mist.
  const canvas = document.createElement('canvas');
  const ht = new Halftone(canvas, {
    cell: o.cell ?? Math.max(2.6, size / 46),
    angle: 0.3927,
    ink: inkFor(o.palette),
    maxDot: 0.5,
    contrast: 1.3,
    gamma: 0.86,
    floor: 0.03,
  });
  ht.load(source);
  ht.measure(size, size, { cover: true });
  ht.render();
  return canvas;
}

/**
 * Cached data URL for a sleeve — used where an `<img>` is cheaper than a canvas
 * (long virtualised lists, CSS backgrounds).
 *
 * @param {{seed:string, motif?:string, palette?:string, scale?:number}} o
 * @returns {string}
 */
export function coverDataURL(o) {
  const key = `${o.seed}|${o.motif}|${o.palette}|${o.scale ?? 4}`;
  let url = dataUrlCache.get(key);
  if (!url) {
    url = renderCover(o).toDataURL('image/png');
    if (dataUrlCache.size > 400) dataUrlCache.clear();
    dataUrlCache.set(key, url);
  }
  return url;
}

/**
 * An `<img>` element carrying a generated sleeve.
 * @param {{seed:string, motif?:string, palette?:string, scale?:number, alt?:string, class?:string}} o
 */
export function coverImage(o) {
  const img = document.createElement('img');
  img.src = coverDataURL(o);
  img.alt = o.alt ?? '';
  img.decoding = 'async';
  img.loading = 'lazy';
  if (o.class) img.className = o.class;
  return img;
}
