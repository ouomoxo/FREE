/**
 * MAESTRO — Photographic sleeves.
 *
 * Screens a reference photograph into dots at a fixed size and hands back a
 * PNG data URL, cached by every parameter that affects the output. Used for
 * sleeves, portraits and thumbnails, where a static image is cheaper than a
 * live canvas and can be dropped straight into an `<img>`.
 *
 * @module pixel/photo
 */

import { Halftone, loadImage, REFERENCE } from './halftone.js';
import { FRAMING } from '../ui/conductor.js';

/** @type {Map<string, string>} */
const cache = new Map();
/** @type {Map<string, Promise<string>>} */
const inflight = new Map();

/**
 * @typedef {object} PhotoOptions
 * @property {string} src      A value from {@link REFERENCE}.
 * @property {number} size     Output edge, in device pixels.
 * @property {number} [height] Output height; defaults to `size` (square).
 * @property {number} [cell=5] Dot lattice spacing.
 * @property {number} [angle]
 * @property {number} [zoom]   Overrides the photograph's default framing.
 * @property {number} [offsetX]
 * @property {number} [offsetY]
 * @property {number} [gain=1]
 * @property {string} [ink]
 */

/** @param {PhotoOptions} o */
const keyOf = (o) => [
  o.src, o.size, o.height ?? o.size, o.cell ?? 5, o.angle ?? '',
  o.zoom ?? '', o.offsetX ?? '', o.offsetY ?? '', o.gain ?? 1, o.ink ?? '',
].join('|');

/**
 * Render (or fetch from cache) a screened photograph.
 * @param {PhotoOptions} o
 * @returns {Promise<string>} PNG data URL
 */
export function photoDataURL(o) {
  const key = keyOf(o);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(key);
  if (pending) return pending;

  const job = (async () => {
    const img = await loadImage(o.src);
    const canvas = document.createElement('canvas');
    const ht = new Halftone(canvas, {
      cell: o.cell ?? 5,
      ...(o.angle !== undefined ? { angle: o.angle } : {}),
      ...(o.ink ? { ink: o.ink } : {}),
    });
    await ht.load(img);
    const base = FRAMING[o.src] ?? { cover: true };
    ht.measure(o.size, o.height ?? o.size, {
      cover: true,
      zoom: o.zoom ?? base.zoom,
      offsetX: o.offsetX ?? base.offsetX,
      offsetY: o.offsetY ?? base.offsetY,
    });
    ht.render({ gain: o.gain ?? 1 });
    const url = canvas.toDataURL('image/png');
    cache.set(key, url);
    inflight.delete(key);
    return url;
  })();

  inflight.set(key, job);
  return job;
}

/**
 * An `<img>` that fills in as soon as the screen has been rendered.
 *
 * The element is returned synchronously so callers can compose DOM without
 * awaiting; until the photograph is screened it is simply an empty black box,
 * which is exactly what the design wants anyway.
 *
 * @param {PhotoOptions & {alt?: string, class?: string, cssSize?: number}} o
 * @returns {HTMLImageElement}
 */
export function photoImage(o) {
  const img = document.createElement('img');
  img.alt = o.alt ?? '';
  img.decoding = 'async';
  if (o.class) img.className = o.class;
  if (o.cssSize) { img.width = o.cssSize; img.height = o.cssSize; }
  img.style.background = 'var(--c-void)';
  photoDataURL(o)
    .then((url) => { img.src = url; })
    .catch((err) => console.warn('[photo] could not screen', o.src, err));
  return img;
}

export { REFERENCE };
