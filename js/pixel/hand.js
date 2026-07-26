/**
 * MAESTRO — Parametric conductor's hand.
 *
 * A small skeletal rig drawn from tapered, gradient-shaded capsules: forearm,
 * shirt cuff, palm, four fingers of three phalanges each, an opposed thumb, and
 * optionally a baton. It is drawn into a low-resolution buffer and quantised by
 * {@link module:pixel/surface}, so the output is genuine pixel art that can be
 * re-posed every frame.
 *
 * The proportions and the lighting — one hard source from the upper left,
 * everything else falling to black, a bright shirt cuff cutting the wrist — are
 * taken from the two reference photographs the project is built around.
 *
 * @module pixel/hand
 */

import { TAU, clamp, lerp } from '../core/utils.js';

/**
 * @typedef {object} HandPose
 * @property {number} x            Wrist position.
 * @property {number} y
 * @property {number} scale        1 ≈ a 34px-long hand.
 * @property {number} forearmAngle Radians; direction the arm arrives from.
 * @property {number} palmAngle    Radians; direction the fingers point.
 * @property {number[]} curl       Four values, 0 (straight) .. 1 (fist).
 * @property {number[]} [spread]   Four values in radians, fanning the fingers.
 * @property {number} thumbCurl    0..1
 * @property {number} thumbSpread  Radians.
 * @property {number} [baton]      Baton angle in radians; omit for no baton.
 * @property {number} [batonLength]
 * @property {number} [cuff]       Cuff length in local units (0 hides it).
 * @property {number} [light]      Light direction, radians. Default upper-left.
 * @property {number} [exposure]   0..1 overall brightness.
 * @property {boolean} [mirror]    Mirror the hand (left vs right).
 */

const FINGER_LENGTHS = [0.92, 1.0, 0.94, 0.74];  // index, middle, ring, little
const PHALANX = [0.42, 0.33, 0.25];
const FINGER_WIDTH = [0.165, 0.17, 0.16, 0.135];

/**
 * Draw a tapered capsule with a cylindrical gradient.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2
 * @param {number} r1 @param {number} r2
 * @param {number} light Light direction in radians.
 * @param {number} exposure
 */
function capsule(ctx, x1, y1, x2, y2, r1, r2, light, exposure) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 0.0001;
  const nx = -dy / len;
  const ny = dx / len;

  // Gradient runs across the capsule, from the lit rim to the shadow rim.
  const lx = Math.cos(light);
  const ly = Math.sin(light);
  const facing = nx * lx + ny * ly;
  const rmax = Math.max(r1, r2);
  const gx = (x1 + x2) / 2;
  const gy = (y1 + y2) / 2;
  const g = ctx.createLinearGradient(
    gx + nx * rmax * Math.sign(facing || 1),
    gy + ny * rmax * Math.sign(facing || 1),
    gx - nx * rmax * Math.sign(facing || 1),
    gy - ny * rmax * Math.sign(facing || 1),
  );
  const hi = clamp(0.68 + Math.abs(facing) * 0.38, 0, 1) * exposure;
  const mid = hi * 0.52;
  const lo = hi * 0.1;
  g.addColorStop(0, shade(hi));
  g.addColorStop(0.34, shade(hi * 0.86));
  g.addColorStop(0.7, shade(mid));
  g.addColorStop(1, shade(lo));

  ctx.fillStyle = g;
  ctx.beginPath();
  const a = Math.atan2(dy, dx);
  ctx.arc(x1, y1, r1, a + Math.PI / 2, a - Math.PI / 2);
  ctx.arc(x2, y2, r2, a - Math.PI / 2, a + Math.PI / 2);
  ctx.closePath();
  ctx.fill();
}

/** Grey value 0..1 -> CSS colour (the buffer is quantised later). */
function shade(v) {
  const n = Math.round(clamp(v, 0, 1) * 255);
  return `rgb(${n},${n},${n})`;
}

/**
 * Draw the hand.
 * @param {CanvasRenderingContext2D} ctx
 * @param {HandPose} pose
 * @returns {{tip: [number, number], batonTip: [number, number]|null}}
 */
export function drawHand(ctx, pose) {
  const s = pose.scale;
  const light = pose.light ?? -2.36;              // upper-left
  const exposure = pose.exposure ?? 1;
  const mirror = pose.mirror ? -1 : 1;
  const palmA = pose.palmAngle;

  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.scale(mirror, 1);
  const A = (angle) => angle;                     // angles are pre-mirrored by the caller

  const wrist = [0, 0];
  const palmLen = 1.05 * s;
  const palmW = 0.86 * s;

  // --- Forearm and cuff --------------------------------------------------
  const fa = pose.forearmAngle;
  const cuffLen = pose.cuff ?? 0.9;
  if (cuffLen > 0) {
    const armEnd = [Math.cos(fa) * 3.2 * s, Math.sin(fa) * 3.2 * s];
    // Dark sleeve, receding into the background.
    capsule(ctx, wrist[0] + Math.cos(fa) * 0.5 * s, wrist[1] + Math.sin(fa) * 0.5 * s,
      armEnd[0], armEnd[1], 0.52 * s, 0.62 * s, light, exposure * 0.22);

    // The bright shirt cuff — the strongest highlight in both photographs.
    const c0 = [Math.cos(fa) * 0.34 * s, Math.sin(fa) * 0.34 * s];
    const c1 = [Math.cos(fa) * (0.34 + cuffLen) * s, Math.sin(fa) * (0.34 + cuffLen) * s];
    capsule(ctx, c0[0], c0[1], c1[0], c1[1], 0.5 * s, 0.56 * s, light, exposure * 1.25);
    // A hard edge where the cuff meets the sleeve.
    ctx.strokeStyle = shade(0.05);
    ctx.lineWidth = Math.max(0.6, s * 0.07);
    ctx.beginPath();
    ctx.moveTo(c1[0] - Math.sin(fa) * 0.56 * s, c1[1] + Math.cos(fa) * 0.56 * s);
    ctx.lineTo(c1[0] + Math.sin(fa) * 0.56 * s, c1[1] - Math.cos(fa) * 0.56 * s);
    ctx.stroke();
  }

  // --- Palm ---------------------------------------------------------------
  const knuckleX = Math.cos(A(palmA)) * palmLen;
  const knuckleY = Math.sin(A(palmA)) * palmLen;
  capsule(ctx, 0, 0, knuckleX, knuckleY, palmW * 0.44, palmW * 0.5, light, exposure);

  // Slight swell over the knuckles.
  capsule(ctx,
    knuckleX - Math.sin(palmA) * palmW * 0.3, knuckleY + Math.cos(palmA) * palmW * 0.3,
    knuckleX + Math.sin(palmA) * palmW * 0.3, knuckleY - Math.cos(palmA) * palmW * 0.3,
    palmW * 0.3, palmW * 0.26, light, exposure * 1.04);

  // --- Fingers ------------------------------------------------------------
  const spread = pose.spread ?? [-0.24, -0.06, 0.12, 0.3];
  /** @type {[number,number]} */
  let indexTip = [knuckleX, knuckleY];

  for (let f = 3; f >= 0; f--) {                  // little finger first (behind)
    const across = (f - 1.5) * palmW * 0.29;
    let px = knuckleX - Math.sin(palmA) * across;
    let py = knuckleY + Math.cos(palmA) * across;
    let angle = palmA + spread[f];
    const curl = clamp(pose.curl[f] ?? 0, 0, 1);
    const len = FINGER_LENGTHS[f] * s;
    let width = FINGER_WIDTH[f] * s * 2;
    const depth = f === 3 ? 0.82 : f === 0 ? 0.96 : 1;

    for (let ph = 0; ph < 3; ph++) {
      angle += curl * (ph === 0 ? 0.62 : ph === 1 ? 0.82 : 0.7);
      const l = PHALANX[ph] * len;
      const nx2 = px + Math.cos(angle) * l;
      const ny2 = py + Math.sin(angle) * l;
      const w2 = width * (ph === 2 ? 0.78 : 0.9);
      capsule(ctx, px, py, nx2, ny2, width / 2, w2 / 2, light, exposure * depth);
      px = nx2; py = ny2; width = w2;
    }
    if (f === 0) indexTip = [px, py];
  }

  // --- Thumb --------------------------------------------------------------
  {
    const base = [Math.cos(palmA) * palmLen * 0.34 - Math.sin(palmA) * -palmW * 0.42,
                  Math.sin(palmA) * palmLen * 0.34 + Math.cos(palmA) * -palmW * 0.42];
    let angle = palmA - 0.95 + pose.thumbSpread;
    let px = base[0];
    let py = base[1];
    let width = 0.21 * s * 2;
    for (let ph = 0; ph < 2; ph++) {
      angle += pose.thumbCurl * (ph === 0 ? 0.5 : 0.72);
      const l = (ph === 0 ? 0.44 : 0.36) * s;
      const nx2 = px + Math.cos(angle) * l;
      const ny2 = py + Math.sin(angle) * l;
      capsule(ctx, px, py, nx2, ny2, width / 2, (width * 0.84) / 2, light, exposure * 1.06);
      px = nx2; py = ny2; width *= 0.84;
    }

    // --- Baton, gripped between thumb and index -------------------------
    if (pose.baton !== undefined) {
      const gripX = (px + indexTip[0]) / 2;
      const gripY = (py + indexTip[1]) / 2;
      const ba = pose.baton;
      const blen = (pose.batonLength ?? 5.4) * s;

      // Cork grip.
      capsule(ctx, gripX - Math.cos(ba) * 0.34 * s, gripY - Math.sin(ba) * 0.34 * s,
        gripX + Math.cos(ba) * 0.2 * s, gripY + Math.sin(ba) * 0.2 * s,
        0.2 * s, 0.13 * s, light, exposure * 0.9);

      // The shaft: a tapered highlight, brightest near the hand.
      const tipX = gripX + Math.cos(ba) * blen;
      const tipY = gripY + Math.sin(ba) * blen;
      const grad = ctx.createLinearGradient(gripX, gripY, tipX, tipY);
      grad.addColorStop(0, shade(1 * exposure));
      grad.addColorStop(0.55, shade(0.9 * exposure));
      grad.addColorStop(1, shade(0.66 * exposure));
      ctx.strokeStyle = grad;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(0.9, 0.115 * s);
      ctx.beginPath();
      ctx.moveTo(gripX + Math.cos(ba) * 0.18 * s, gripY + Math.sin(ba) * 0.18 * s);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      ctx.restore();
      return {
        tip: [pose.x + indexTip[0] * mirror, pose.y + indexTip[1]],
        batonTip: [pose.x + tipX * mirror, pose.y + tipY],
      };
    }
  }

  ctx.restore();
  return { tip: [pose.x + indexTip[0] * mirror, pose.y + indexTip[1]], batonTip: null };
}

/* ============================================================================
   Poses
   ========================================================================== */

/**
 * The right hand holding the baton, as in both photographs: wrist broken
 * slightly downward, index and middle fingers half-curled around the grip.
 *
 * @param {Partial<HandPose>} o
 * @returns {HandPose}
 */
export function batonHand(o = {}) {
  return {
    x: 0, y: 0, scale: 10,
    forearmAngle: 2.42,
    palmAngle: -0.42,
    curl: [0.55, 0.62, 0.72, 0.8],
    spread: [-0.2, -0.02, 0.16, 0.34],
    thumbCurl: 0.42,
    thumbSpread: 0.26,
    baton: -0.62,
    batonLength: 5.6,
    cuff: 0.95,
    exposure: 1,
    ...o,
  };
}

/**
 * The left hand, palm down, fingers relaxed and slightly spread — the shaping
 * hand, the one that asks for less.
 *
 * @param {Partial<HandPose>} o
 * @returns {HandPose}
 */
export function shapingHand(o = {}) {
  return {
    x: 0, y: 0, scale: 10,
    forearmAngle: 2.9,
    palmAngle: 0.16,
    curl: [0.3, 0.26, 0.3, 0.38],
    spread: [-0.2, -0.05, 0.12, 0.3],
    thumbCurl: 0.34,
    thumbSpread: -0.1,
    cuff: 0.85,
    exposure: 0.92,
    ...o,
  };
}

/**
 * Blend two poses. Used by the conductor to move between beat positions.
 * @param {HandPose} a @param {HandPose} b @param {number} t
 * @returns {HandPose}
 */
export function blendPose(a, b, t) {
  const mix = (k) => lerp(a[k] ?? 0, b[k] ?? 0, t);
  return {
    ...a,
    x: mix('x'), y: mix('y'), scale: mix('scale'),
    forearmAngle: mixAngle(a.forearmAngle, b.forearmAngle, t),
    palmAngle: mixAngle(a.palmAngle, b.palmAngle, t),
    curl: a.curl.map((v, i) => lerp(v, b.curl[i] ?? v, t)),
    spread: (a.spread ?? []).map((v, i) => lerp(v, b.spread?.[i] ?? v, t)),
    thumbCurl: mix('thumbCurl'),
    thumbSpread: mix('thumbSpread'),
    baton: a.baton === undefined ? undefined : mixAngle(a.baton, b.baton ?? a.baton, t),
    batonLength: mix('batonLength') || a.batonLength,
    cuff: mix('cuff'),
    exposure: mix('exposure'),
  };
}

/** Shortest-path angle interpolation. */
export function mixAngle(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}
