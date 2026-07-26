/**
 * MAESTRO — Shared utilities.
 * Deterministic randomness, formatting, maths, and small functional helpers.
 * @module core/utils
 */

/* ============================================================================
   Deterministic randomness
   Every generated artwork and every generated score is seeded from a stable
   string, so the catalogue looks and sounds identical on every visit and on
   every machine.
   ========================================================================== */

/**
 * xmur3 string hash — produces a well-mixed 32-bit seed.
 * @param {string} str
 * @returns {number}
 */
export function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/**
 * Small, fast, high-quality PRNG (mulberry32).
 * @param {number|string} seed
 * @returns {() => number} float in [0,1)
 */
export function rng(seed) {
  let a = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Wrap a PRNG with convenience methods.
 * @param {number|string} seed
 */
export function Random(seed) {
  const r = rng(seed);
  return {
    next: r,
    /** @param {number} a @param {number} [b] */
    float: (a = 1, b) => (b === undefined ? r() * a : a + r() * (b - a)),
    /** @param {number} a @param {number} [b] inclusive-exclusive int */
    int: (a, b) => (b === undefined ? Math.floor(r() * a) : a + Math.floor(r() * (b - a))),
    /** @template T @param {T[]} arr @returns {T} */
    pick: (arr) => arr[Math.floor(r() * arr.length)],
    /** @param {number} p */
    chance: (p) => r() < p,
    /** @template T @param {T[]} arr @returns {T[]} shuffled copy */
    shuffle: (arr) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    /**
     * Weighted pick. @template T
     * @param {Array<[T, number]>} pairs
     * @returns {T}
     */
    weighted: (pairs) => {
      const total = pairs.reduce((s, p) => s + p[1], 0);
      let t = r() * total;
      for (const [v, w] of pairs) { t -= w; if (t <= 0) return v; }
      return pairs[pairs.length - 1][0];
    },
  };
}

/* ============================================================================
   Maths
   ========================================================================== */

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const remap = (v, a1, b1, a2, b2) => lerp(a2, b2, clamp(invLerp(a1, b1, v), 0, 1));
export const smoothstep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const smootherstep = (t) => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
export const TAU = Math.PI * 2;

/**
 * Frame-rate-independent exponential smoothing.
 * @param {number} current @param {number} target
 * @param {number} halfLife seconds to close half the gap
 * @param {number} dt seconds
 */
export function damp(current, target, halfLife, dt) {
  if (halfLife <= 0) return target;
  return target + (current - target) * Math.pow(2, -dt / halfLife);
}

/* ============================================================================
   Formatting
   ========================================================================== */

/**
 * Seconds -> `m:ss` (or `h:mm:ss`).
 * @param {number} sec
 */
export function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Seconds -> `12 MIN 30 SEC` style, for summaries.
 * @param {number} sec
 */
export function formatDuration(sec) {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} MIN`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h} HR ${rem} MIN` : `${h} HR`;
}

/** @param {number} n */
export function formatCount(n) {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/** @param {number} n */
export const pad2 = (n) => String(n).padStart(2, '0');

/* ============================================================================
   Functional / async
   ========================================================================== */

/**
 * @template {(...args:any[]) => any} F
 * @param {F} fn @param {number} ms
 * @returns {F & {cancel(): void}}
 */
export function debounce(fn, ms) {
  let t;
  const wrapped = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  wrapped.cancel = () => clearTimeout(t);
  return /** @type {any} */ (wrapped);
}

/**
 * Trailing-edge rAF throttle — collapses bursts into one paint.
 * @template {(...args:any[]) => any} F
 * @param {F} fn
 */
export function rafThrottle(fn) {
  let frame = 0;
  let lastArgs;
  const wrapped = (...args) => {
    lastArgs = args;
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; fn(...lastArgs); });
  };
  wrapped.cancel = () => { cancelAnimationFrame(frame); frame = 0; };
  return /** @type {any} */ (wrapped);
}

/** @param {number} ms */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Wait for the next animation frame. */
export const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

/* ============================================================================
   Collections & text
   ========================================================================== */

/**
 * @template T, K
 * @param {T[]} items @param {(item: T) => K} key
 * @returns {Map<K, T[]>}
 */
export function groupBy(items, key) {
  const map = new Map();
  for (const item of items) {
    const k = key(item);
    const bucket = map.get(k);
    if (bucket) bucket.push(item); else map.set(k, [item]);
  }
  return map;
}

/** @template T @param {T[]} a @param {number} n */
export const take = (a, n) => a.slice(0, n);

/** @template T @param {T[]} a */
export const uniq = (a) => Array.from(new Set(a));

/**
 * Fold accents and lowercase, for search.
 * @param {string} s
 */
export function normalizeText(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Subsequence fuzzy match with a relevance score.
 * Returns `null` when the needle does not match at all.
 *
 * @param {string} needle @param {string} haystack
 * @returns {{score:number, ranges:Array<[number,number]>}|null}
 */
export function fuzzyMatch(needle, haystack) {
  const n = normalizeText(needle);
  const h = normalizeText(haystack);
  if (!n) return { score: 0, ranges: [] };
  if (!h) return null;

  const exact = h.indexOf(n);
  if (exact >= 0) {
    // Whole-substring hits rank far above scattered subsequence hits.
    const boundary = exact === 0 || /[\s\-–—.,:/(]/.test(h[exact - 1]);
    return {
      score: 1000 - exact + (boundary ? 500 : 0) + (h.length === n.length ? 300 : 0),
      ranges: [[exact, exact + n.length]],
    };
  }

  let hi = 0;
  let score = 0;
  let streak = 0;
  /** @type {Array<[number,number]>} */
  const ranges = [];
  for (let ni = 0; ni < n.length; ni++) {
    const ch = n[ni];
    let found = -1;
    while (hi < h.length) {
      if (h[hi] === ch) { found = hi; break; }
      hi++;
    }
    if (found < 0) return null;
    const isBoundary = found === 0 || /[\s\-–—.,:/(]/.test(h[found - 1]);
    streak = ranges.length && ranges[ranges.length - 1][1] === found ? streak + 1 : 0;
    score += 10 + streak * 6 + (isBoundary ? 12 : 0) - Math.min(found, 20) * 0.1;
    if (ranges.length && ranges[ranges.length - 1][1] === found) {
      ranges[ranges.length - 1][1] = found + 1;
    } else {
      ranges.push([found, found + 1]);
    }
    hi = found + 1;
  }
  return { score, ranges };
}

/**
 * Escape for insertion into HTML text nodes.
 * @param {string} s
 */
export const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Stable id generator, scoped per prefix. */
const idCounters = new Map();
export function uid(prefix = 'id') {
  const n = (idCounters.get(prefix) ?? 0) + 1;
  idCounters.set(prefix, n);
  return `${prefix}-${n}`;
}

/* ============================================================================
   Environment
   ========================================================================== */

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const isCoarsePointer = () => window.matchMedia('(pointer: coarse)').matches;

/** True when the event should be treated as a "modifier click". */
export const isModified = (e) => e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
