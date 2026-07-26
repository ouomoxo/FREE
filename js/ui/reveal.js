/**
 * MAESTRO — Entrances.
 *
 * Two things: a scroll observer that lets a block arrive as it comes into view,
 * and a small sequencer for composing an opening.
 *
 * The timing is deliberately slow and even — adagio, not a flourish. Nothing
 * bounces, nothing overshoots, nothing scales. Elements rise a few pixels and
 * resolve. Under `prefers-reduced-motion` everything is simply present.
 *
 * @module ui/reveal
 */

import { prefersReducedMotion } from '../core/utils.js';

/** @type {IntersectionObserver|null} */
let observer = null;

function ensureObserver() {
  if (observer) return observer;
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = /** @type {HTMLElement} */ (entry.target);
      el.dataset.revealed = 'true';
      observer.unobserve(el);
    }
  }, {
    // Fire a little before the block reaches the fold, so the movement is
    // already resolving by the time the reader gets to it.
    rootMargin: '0px 0px -8% 0px',
    threshold: 0.04,
  });
  return observer;
}

/**
 * Mark an element (and, optionally, stagger its children) to arrive on scroll.
 *
 * @param {Element|Element[]|NodeListOf<Element>} target
 * @param {{stagger?: number, index?: number}} [o]
 */
export function reveal(target, o = {}) {
  const list = target instanceof Element ? [target] : Array.from(target);
  if (prefersReducedMotion()) {
    for (const el of list) el.dataset.revealed = 'true';
    return;
  }
  const obs = ensureObserver();
  list.forEach((el, i) => {
    const step = o.stagger ?? 0;
    const index = (o.index ?? 0) + i;
    if (step) el.style.setProperty('--reveal-delay', `${Math.min(index * step, 640)}ms`);
    el.dataset.reveal = el.dataset.reveal || 'up';
    el.dataset.revealed = 'false';
    obs.observe(el);
  });
}

/**
 * Mark every direct child of a container, staggered.
 * @param {Element|null} container
 * @param {{stagger?: number, selector?: string}} [o]
 */
export function revealChildren(container, o = {}) {
  if (!container) return;
  const kids = o.selector
    ? container.querySelectorAll(o.selector)
    : container.children;
  reveal(kids, { stagger: o.stagger ?? 45 });
}

/**
 * A tiny cue sheet: run steps at given offsets from a single start time.
 *
 * @param {Array<[number, () => void]>} steps `[delayMs, action]`
 * @returns {() => void} cancel
 */
export function sequence(steps) {
  if (prefersReducedMotion()) {
    for (const [, fn] of steps) { try { fn(); } catch (err) { console.error(err); } }
    return () => {};
  }
  const timers = steps.map(([delay, fn]) => window.setTimeout(() => {
    try { fn(); } catch (err) { console.error('[reveal] cue failed', err); }
  }, delay));
  return () => timers.forEach(clearTimeout);
}
