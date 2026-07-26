/**
 * MAESTRO — The point field.
 *
 * One population of points, a few thousand strong, that can be given a
 * constellation to form. A constellation is sampled from a photograph: the
 * image is screened, and every cell bright enough to survive becomes a target
 * with a brightness that sets its radius.
 *
 * Give the field a different photograph and the same points travel to the new
 * positions — so one image becomes another without anything ever fading. Give
 * it nothing and they drift, like dust in a dark room.
 *
 * @module art/points
 */

import { clamp, damp, Random, TAU } from '../core/utils.js';

/**
 * @typedef {object} Constellation
 * @property {Float32Array} xs  Normalised 0..1.
 * @property {Float32Array} ys
 * @property {Float32Array} ws  Brightness 0..1 — sets the dot radius.
 * @property {number} count
 */

/**
 * A separable box blur over a single-channel grid. Two of them would be a
 * gaussian; one is enough to stand in for "the ground this cell sits on".
 *
 * @param {Float32Array} src
 * @param {number} w @param {number} h @param {number} r radius in cells
 * @returns {Float32Array}
 */
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += src[row + clamp(x, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / (r * 2 + 1);
      sum += src[row + clamp(x + r + 1, 0, w - 1)] - src[row + clamp(x - r, 0, w - 1)];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[clamp(y, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / (r * 2 + 1);
      sum += tmp[clamp(y + r + 1, 0, h - 1) * w + x] - tmp[clamp(y - r, 0, h - 1) * w + x];
    }
  }
  return out;
}

/**
 * Sample a photograph into a constellation of exactly `count` points.
 *
 * The plate is *placed* in the frame rather than stretched across it: it keeps
 * the photograph's own proportions, takes `fit` of the frame's height, and is
 * centred on `cx, cy`. A wide screen therefore crops nothing — it simply leaves
 * the plate standing in a larger darkness, which is the whole idea.
 *
 * Candidates are taken on a rotated lattice, exactly like the halftone screen,
 * so the constellation reads as a proper dot rendering rather than as noise.
 * The lattice is anchored to the centre of the *frame*, not of the plate, so
 * every movement lands on the same grid and the morphs stay coherent.
 *
 * @param {HTMLImageElement} img
 * @param {object} o
 * @param {number} o.count
 * @param {number} [o.aspect=1]     Frame aspect, width / height.
 * @param {number} [o.pitch=0.0065] Lattice pitch, as a fraction of frame width.
 * @param {number} [o.angle=0.3927]
 * @param {number} [o.floor=0.14]   Weight below this is background.
 * @param {number} [o.fit=0.8]      Plate height, as a fraction of frame height.
 * @param {number} [o.fitW=0.46]    Ceiling on plate width, fraction of frame.
 * @param {number} [o.cx=0.5]       Plate centre in the frame.
 * @param {number} [o.cy=0.5]
 * @param {number} [o.zoom=1]       Crop into the photograph, within the plate.
 * @param {number} [o.offsetX=0]
 * @param {number} [o.offsetY=0]
 * @param {'tone'|'shadow'|'edge'|'relief'} [o.mode='tone'] Where the weight comes from.
 * @param {number} [o.gamma=1]     Below one lifts the half-tones.
 * @param {number} [o.feather=0.09] Border falloff, as a fraction of the plate.
 * @param {string} [o.seed='plate']
 * @returns {Constellation}
 */
export function sampleImage(img, o) {
  const aspect = o.aspect ?? 1;
  const pitch = o.pitch ?? 0.0065;
  const angle = o.angle ?? 0.3927;
  const floor = o.floor ?? 0.14;
  const mode = o.mode ?? 'tone';
  const rnd = Random(o.seed ?? 'plate');

  // The frame, in virtual pixels. Everything below is laid out here and
  // normalised at the very end, so the lattice stays isotropic on any screen.
  const FW = 1000;
  const FH = FW / aspect;

  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const ir = iw / ih;

  // The plate: the photograph's own shape, sized to the frame.
  let BH = (o.fit ?? 0.8) * FH;
  let BW = BH * ir;
  const maxW = (o.fitW ?? 0.46) * FW;
  if (BW > maxW) { BW = maxW; BH = BW / ir; }
  const bx = (o.cx ?? 0.5) * FW - BW / 2;
  const by = (o.cy ?? 0.5) * FH - BH / 2;

  // Resolve the source into a luminance grid covering the plate. The grid has
  // the plate's proportions, so nothing is distorted on the way in.
  const GW = 300;
  const GH = Math.max(2, Math.round(GW * (BH / BW)));
  const buf = document.createElement('canvas');
  buf.width = GW;
  buf.height = GH;
  const bctx = buf.getContext('2d', { willReadFrequently: true });
  bctx.imageSmoothingQuality = 'high';

  const fr = GW / GH;
  let dw;
  let dh;
  if (ir > fr) { dh = GH; dw = GH * ir; } else { dw = GW; dh = GW / ir; }
  const zoom = o.zoom ?? 1;
  dw *= zoom;
  dh *= zoom;
  bctx.drawImage(img, (GW - dw) / 2 + (o.offsetX ?? 0) * GW, (GH - dh) / 2 + (o.offsetY ?? 0) * GH, dw, dh);

  const data = bctx.getImageData(0, 0, GW, GH).data;
  let lo = 1;
  let hi = 0;
  const lum = new Float32Array(GW * GH);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const v = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
    lum[p] = v;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (hi - lo > 0.02) {
    const span = hi - lo;
    for (let p = 0; p < lum.length; p++) lum[p] = (lum[p] - lo) / span;
  }

  /**
   * The weight field the lattice is sampled against.
   *
   * `tone` puts points where the picture is bright — right for a subject lit
   * out of a black ground, which is most of this project. `shadow` is its
   * inverse, for a dark subject on a pale one. `edge` puts them where the
   * picture *changes*. `relief` puts them wherever the picture departs from
   * its own ground, in either direction, which is the only thing that renders
   * a pale animal and a dark one standing on the same wall.
   */
  const field = new Float32Array(GW * GH);
  if (mode === 'edge') {
    // A light blur first, so the gradient follows form rather than grain.
    const blur = boxBlur(lum, GW, GH, 1);
    let maxG = 1e-6;
    for (let y = 1; y < GH - 1; y++) {
      for (let x = 1; x < GW - 1; x++) {
        const gx = blur[y * GW + x + 1] - blur[y * GW + x - 1];
        const gy = blur[(y + 1) * GW + x] - blur[(y - 1) * GW + x];
        const mag = Math.hypot(gx, gy);
        field[y * GW + x] = mag;
        if (mag > maxG) maxG = mag;
      }
    }
    for (let p = 0; p < field.length; p++) {
      // A gentle curve keeps the faint edges rather than crushing them.
      field[p] = Math.pow(clamp(field[p] / maxG, 0, 1), 0.6);
    }
  } else if (mode === 'relief') {
    // The ground of a picture is its commonest tone — taken globally, since a
    // local one would hollow out any subject broader than the blur. Weight is
    // how far a cell departs from that ground, in either direction.
    //
    // The two directions are then normalised separately, against what each
    // actually reaches rather than against the full range. A pale animal a
    // shade lighter than the wall and a black one against the same wall are
    // given equal standing, which is the entire point of the picture.
    const GB = 96;
    const gh = new Int32Array(GB);
    for (let p = 0; p < lum.length; p++) gh[clamp(Math.floor(lum[p] * GB), 0, GB - 1)]++;
    let top = 0;
    for (let b = 1; b < GB; b++) if (gh[b] > gh[top]) top = b;
    const ground = (top + 0.5) / GB;

    const dev = new Float32Array(GW * GH);
    const BINS = 128;
    const up = new Int32Array(BINS);
    const down = new Int32Array(BINS);
    let nUp = 0;
    let nDown = 0;
    for (let p = 0; p < lum.length; p++) {
      const d = lum[p] - ground;
      dev[p] = d;
      const b = clamp(Math.floor(Math.abs(d) * BINS), 0, BINS - 1);
      if (d >= 0) { up[b]++; nUp++; } else { down[b]++; nDown++; }
    }
    // The 97th percentile rather than the maximum, so one specular highlight
    // cannot flatten everything else.
    const scale = (hist, n) => {
      let acc = 0;
      for (let b = 0; b < BINS; b++) {
        acc += hist[b];
        if (acc >= n * 0.97) return Math.max(0.015, (b + 1) / BINS);
      }
      return 1;
    };
    const sUp = scale(up, nUp);
    const sDown = scale(down, nDown);
    for (let p = 0; p < dev.length; p++) {
      const d = dev[p];
      field[p] = clamp(d >= 0 ? d / sUp : -d / sDown, 0, 1);
    }
  } else if (mode === 'shadow') {
    // Tone, inverted: points where the picture is *dark*. A black fish on white
    // paper is a line, and this is the only reading that draws the line rather
    // than the paper around it.
    for (let p = 0; p < lum.length; p++) field[p] = 1 - lum[p];
  } else {
    field.set(lum);
  }

  // A gamma below one lifts the half-tones, so a picture keeps its middle
  // rather than collapsing into highlight and void.
  const gamma = o.gamma ?? 1;
  if (gamma !== 1) {
    for (let p = 0; p < field.length; p++) field[p] = Math.pow(clamp(field[p], 0, 1), gamma);
  }

  // The plate has to end without having an edge. A photograph cropped square
  // announces its own rectangle — and the rectangle is the one thing in the
  // frame that is not the picture. So the weight is feathered away at the
  // border and the plate dissolves into the dark instead of stopping.
  const feather = o.feather ?? 0.09;
  if (feather > 0) {
    const fx = Math.max(1, feather * GW);
    const fy = Math.max(1, feather * GH);
    const ramp = (d, f) => { const t = clamp(d / f, 0, 1); return t * t * (3 - 2 * t); };
    for (let y = 0; y < GH; y++) {
      const wy = Math.min(ramp(y, fy), ramp(GH - 1 - y, fy));
      for (let x = 0; x < GW; x++) {
        field[y * GW + x] *= Math.min(wy, ramp(x, fx), ramp(GW - 1 - x, fx));
      }
    }
  }

  const at = (x, y) => {
    const gx = clamp(Math.round(x * (GW - 1)), 0, GW - 1);
    const gy = clamp(Math.round(y * (GH - 1)), 0, GH - 1);
    return field[gy * GW + gx];
  };

  // Walk the rotated lattice and collect everything above the floor.
  //
  // The lattice is isotropic in virtual pixels and anchored to the centre of
  // the frame — never to the plate — so consecutive movements sit on the same
  // grid and the points slide between pictures instead of re-forming.
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const step = pitch * FW;
  const reach = Math.ceil((FW + FH) / step);
  /** @type {number[]} */
  const cx = [];
  /** @type {number[]} */
  const cy = [];
  /** @type {number[]} */
  const cw = [];

  for (let j = -reach; j <= reach; j++) {
    for (let i = -reach; i <= reach; i++) {
      const lx = i * step;
      const ly = j * step;
      const px = FW / 2 + lx * cos - ly * sin;
      const py = FH / 2 + lx * sin + ly * cos;
      if (px < bx || px > bx + BW || py < by || py > by + BH) continue;
      const v = at((px - bx) / BW, (py - by) / BH);
      if (v <= floor) continue;
      cx.push(px / FW);
      cy.push(py / FH);
      cw.push((v - floor) / (1 - floor));
    }
  }

  const count = o.count;
  const xs = new Float32Array(count);
  const ys = new Float32Array(count);
  const ws = new Float32Array(count);

  if (cx.length === 0) {
    // Degenerate plate: spread the points thinly rather than stacking them.
    for (let k = 0; k < count; k++) {
      xs[k] = rnd.float(); ys[k] = rnd.float(); ws[k] = 0.15;
    }
    return { xs, ys, ws, count };
  }

  // Pick `count` of the candidates. A bright cell is almost always taken and a
  // dim one often enough — so the picture keeps its proportions, and a subject
  // that is only a little lighter than its ground survives as a faint mass
  // instead of being crowded out by whatever is brightest in the frame.
  const order = rnd.shuffle(cx.map((_, i) => i));
  const used = new Uint8Array(cx.length);
  let k = 0;
  for (let pass = 0; pass < 2 && k < count; pass++) {
    for (let n = 0; n < order.length && k < count; n++) {
      const i = order[n];
      if (used[i]) continue;
      if (pass === 0 && rnd.float() > 0.3 + 0.7 * cw[i]) continue;
      used[i] = 1;
      xs[k] = cx[i];
      ys[k] = cy[i];
      ws[k] = cw[i];
      k++;
    }
  }

  // Points the plate cannot use are not stacked on cells that are already lit —
  // they are let go, and hang in the dark around the picture as dust.
  while (k < count) {
    const a = rnd.float(TAU);
    const r = 0.34 + Math.sqrt(rnd.float()) * 0.52;
    xs[k] = clamp(0.5 + Math.cos(a) * r, 0.015, 0.985);
    ys[k] = clamp(0.5 + Math.sin(a) * r * 0.82, 0.015, 0.985);
    ws[k] = rnd.float(0.02, 0.07);
    k++;
  }

  return { xs, ys, ws, count };
}

/**
 * A drifting field of points that can be told to become a picture.
 */
export class PointField {
  /** @param {{count?: number, seed?: string}} [o] */
  constructor(o = {}) {
    const count = o.count ?? 2400;
    const rnd = Random(o.seed ?? 'field');
    this.count = count;
    this.rnd = rnd;

    this.x = new Float32Array(count);
    this.y = new Float32Array(count);
    this.vx = new Float32Array(count);
    this.vy = new Float32Array(count);
    this.tx = new Float32Array(count);
    this.ty = new Float32Array(count);
    this.tw = new Float32Array(count);
    /** Per-point phase, so the drift never marches in step. */
    this.ph = new Float32Array(count);
    /** How strongly each point is held to its target, 0..1. */
    this.hold = 0;
    /** Rank used to order morphs, recomputed when targets change. */
    this.key = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const a = rnd.float(TAU);
      const r = Math.sqrt(rnd.float()) * 0.62;
      this.x[i] = 0.5 + Math.cos(a) * r;
      this.y[i] = 0.5 + Math.sin(a) * r * 0.86;
      this.tx[i] = this.x[i];
      this.ty[i] = this.y[i];
      this.tw[i] = rnd.float(0.05, 0.3);
      this.ph[i] = rnd.float(TAU);
    }
  }

  /**
   * Give the field a constellation to form.
   *
   * Points are matched to targets in a shared ordering — both sorted along the
   * same diagonal — so the flight reads as a single sweep of the whole field
   * rather than as thousands of unrelated journeys.
   *
   * @param {Constellation|null} c  `null` releases them back to drifting.
   */
  setTargets(c) {
    const n = this.count;
    if (!c) {
      for (let i = 0; i < n; i++) {
        const a = this.rnd.float(TAU);
        const r = Math.sqrt(this.rnd.float()) * 0.66;
        this.tx[i] = 0.5 + Math.cos(a) * r;
        this.ty[i] = 0.5 + Math.sin(a) * r * 0.86;
        this.tw[i] = this.rnd.float(0.05, 0.28);
      }
      return;
    }

    const order = Array.from({ length: n }, (_, i) => i)
      .sort((a, b) => (this.x[a] * 0.7 + this.y[a] * 0.3) - (this.x[b] * 0.7 + this.y[b] * 0.3));
    const tOrder = Array.from({ length: c.count }, (_, i) => i)
      .sort((a, b) => (c.xs[a] * 0.7 + c.ys[a] * 0.3) - (c.xs[b] * 0.7 + c.ys[b] * 0.3));

    for (let k = 0; k < n; k++) {
      const p = order[k];
      const t = tOrder[Math.min(k, c.count - 1)];
      this.tx[p] = c.xs[t];
      this.ty[p] = c.ys[t];
      this.tw[p] = c.ws[t];
    }
  }

  /**
   * Turn the whole field about its centre.
   *
   * Given at the instant a new picture is called for, this is what makes the
   * change a gesture rather than a transition: every point leaves on a curve,
   * the way a hand leaves a downbeat, and only then goes where it was sent.
   *
   * @param {number} spin  Tangential impulse, radians-ish per second.
   * @param {number} [breath]  Positive pushes outward, negative draws in.
   */
  impulse(spin, breath = 0) {
    for (let i = 0; i < this.count; i++) {
      const dx = this.x[i] - 0.5;
      const dy = this.y[i] - 0.5;
      this.vx[i] += -dy * spin + dx * breath;
      this.vy[i] += dx * spin + dy * breath;
    }
  }

  /**
   * Advance the field.
   * @param {number} dt seconds
   * @param {number} t  running time, for the drift
   * @param {{hold?: number, turbulence?: number}} [o]
   *   `hold` 0..1 — how strongly the points are pulled onto their targets.
   */
  update(dt, t, o = {}) {
    const hold = clamp(o.hold ?? this.hold, 0, 1);
    const turb = o.turbulence ?? 1;
    const n = this.count;

    // Held points settle; released points wander. The spring is deliberately
    // slack — a picture that snaps together is a transition, and a picture that
    // takes two seconds to arrive is a phrase.
    const pull = 1 + hold * 5.5;
    const drag = 2 + hold * 3.4;

    for (let i = 0; i < n; i++) {
      const ph = this.ph[i];
      // A slow, incommensurate wander — never a loop.
      const wx = Math.sin(t * 0.11 + ph) * 0.5 + Math.sin(t * 0.043 + ph * 1.7) * 0.5;
      const wy = Math.cos(t * 0.093 + ph * 1.3) * 0.5 + Math.sin(t * 0.037 + ph) * 0.5;

      const ax = (this.tx[i] - this.x[i]) * pull + wx * 0.012 * turb * (1 - hold * 0.9);
      const ay = (this.ty[i] - this.y[i]) * pull + wy * 0.012 * turb * (1 - hold * 0.9);

      this.vx[i] = (this.vx[i] + ax * dt) * Math.exp(-drag * dt);
      this.vy[i] = (this.vy[i] + ay * dt) * Math.exp(-drag * dt);
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
    }
    this.hold = hold;
  }

  /**
   * Draw the field.
   *
   * Points are bucketed by opacity and each bucket drawn as a single path —
   * a few thousand arcs a frame is otherwise the whole budget.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} W @param {number} H device pixels
   * @param {object} o
   * @param {string} [o.ink]
   * @param {string} [o.accent]      Colour for the brightest points.
   * @param {number} [o.scale=1]     Multiplies every radius.
   * @param {number} [o.opacity=1]
   * @param {number} [o.minR=0.6]
   * @param {number} [o.maxR=2.1]
   */
  draw(ctx, W, H, o = {}) {
    const ink = o.ink ?? '#ece7dc';
    const accent = o.accent ?? null;
    const scale = o.scale ?? 1;
    const opacity = clamp(o.opacity ?? 1, 0, 1);
    if (opacity <= 0.002) return;
    const minR = (o.minR ?? 0.6) * scale;
    const maxR = (o.maxR ?? 2.1) * scale;

    const BUCKETS = 5;
    /** @type {number[][]} */
    const buckets = Array.from({ length: BUCKETS }, () => []);
    const n = this.count;

    for (let i = 0; i < n; i++) {
      const w = this.tw[i];
      if (w <= 0.001) continue;
      const b = Math.min(BUCKETS - 1, Math.floor(w * BUCKETS));
      buckets[b].push(i);
    }

    for (let b = 0; b < BUCKETS; b++) {
      const list = buckets[b];
      if (!list.length) continue;
      const t = (b + 0.5) / BUCKETS;
      const r = minR + (maxR - minR) * t;
      ctx.globalAlpha = opacity * (0.14 + t * 0.86);
      ctx.fillStyle = ink;
      ctx.beginPath();
      for (const i of list) {
        const px = this.x[i] * W;
        const py = this.y[i] * H;
        ctx.moveTo(px + r, py);
        ctx.arc(px, py, r, 0, TAU);
      }
      ctx.fill();

      // The gold is a glint, not a colour — a scattering through the brightest
      // points, never the whole of them.
      if (accent && b === BUCKETS - 1) {
        ctx.fillStyle = accent;
        ctx.beginPath();
        for (const i of list) {
          if (i % 7) continue;
          const px = this.x[i] * W;
          const py = this.y[i] * H;
          ctx.moveTo(px + r, py);
          ctx.arc(px, py, r, 0, TAU);
        }
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
