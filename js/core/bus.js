/**
 * MAESTRO — Application event bus.
 *
 * Used for transient, non-state events (a track ended, a toast should show, the
 * analyser produced a frame). Anything that is *state* lives in the store
 * instead; the bus is strictly for notifications.
 *
 * @module core/bus
 */

export class EventBus {
  /** @type {Map<string, Set<Function>>} */ #handlers = new Map();
  /** @type {Map<string, any>} */ #sticky = new Map();

  /**
   * @param {string} type
   * @param {(payload: any) => void} handler
   * @param {{once?: boolean, sticky?: boolean}} [opts]
   * @returns {() => void} unsubscribe
   */
  on(type, handler, opts = {}) {
    let set = this.#handlers.get(type);
    if (!set) { set = new Set(); this.#handlers.set(type, set); }

    const fn = opts.once
      ? (payload) => { this.off(type, fn); handler(payload); }
      : handler;
    set.add(fn);

    if (opts.sticky && this.#sticky.has(type)) {
      queueMicrotask(() => handler(this.#sticky.get(type)));
    }
    return () => this.off(type, fn);
  }

  /** @param {string} type @param {(payload:any)=>void} handler */
  once(type, handler) { return this.on(type, handler, { once: true }); }

  /** @param {string} type @param {Function} handler */
  off(type, handler) { this.#handlers.get(type)?.delete(handler); }

  /**
   * @param {string} type
   * @param {any} [payload]
   * @param {{sticky?: boolean}} [opts] retain for late subscribers
   */
  emit(type, payload, opts = {}) {
    if (opts.sticky) this.#sticky.set(type, payload);
    const set = this.#handlers.get(type);
    if (!set || set.size === 0) return;
    for (const fn of Array.from(set)) {
      try { fn(payload); }
      catch (err) { console.error(`[bus] handler for "${type}" threw`, err); }
    }
  }

  /** Remove every handler (used on teardown). */
  clear() { this.#handlers.clear(); this.#sticky.clear(); }

  /** @param {string} type */
  count(type) { return this.#handlers.get(type)?.size ?? 0; }
}

/** Canonical event names — keeps string literals out of feature code. */
export const EVT = Object.freeze({
  TRACK_ENDED:    'track:ended',
  TRACK_STARTED:  'track:started',
  PLAYBACK_TICK:  'playback:tick',
  QUEUE_CHANGED:  'queue:changed',
  AUDIO_READY:    'audio:ready',
  AUDIO_BLOCKED:  'audio:blocked',
  ANALYSER_FRAME: 'analyser:frame',
  BEAT:           'conductor:beat',
  BAR:            'conductor:bar',
  TOAST:          'ui:toast',
  ROUTE_RENDERED: 'ui:route-rendered',
  COMMAND:        'ui:command',
  SEARCH_QUERY:   'search:query',
});

export const bus = new EventBus();
