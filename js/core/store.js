/**
 * MAESTRO — Reactive store.
 *
 * A single immutable-ish state tree with shallow-merge patches, selector
 * subscriptions, and batched notification. Deliberately ~100 lines: the app
 * needs predictable state and cheap fine-grained subscriptions, nothing more.
 *
 * @module core/store
 */

/**
 * @template S
 */
export class Store {
  /** @type {S} */ #state;
  /** @type {Set<{sel:(s:S)=>any, fn:(v:any,p:any)=>void, last:any, eq:(a:any,b:any)=>boolean}>} */
  #subs = new Set();
  #queued = false;
  #depth = 0;
  /** @type {Array<(action: string, patch: any, state: S) => void>} */
  #middleware = [];

  /** @param {S} initial */
  constructor(initial) {
    this.#state = initial;
  }

  /** @returns {S} */
  get state() { return this.#state; }

  /**
   * Shallow-merge a patch (or the result of an updater) into the tree.
   * @param {Partial<S>|((s:S)=>Partial<S>)} patch
   * @param {string} [action] label, for devtools/logging
   */
  set(patch, action = 'set') {
    const delta = typeof patch === 'function' ? patch(this.#state) : patch;
    if (!delta) return;

    let changed = false;
    for (const key in delta) {
      if (!Object.is(this.#state[key], delta[key])) { changed = true; break; }
    }
    if (!changed) return;

    this.#state = { ...this.#state, ...delta };
    for (const mw of this.#middleware) mw(action, delta, this.#state);
    this.#schedule();
  }

  /**
   * Update one key with an updater function.
   * @template {keyof S} K
   * @param {K} key @param {(v: S[K], s: S) => S[K]} updater @param {string} [action]
   */
  update(key, updater, action) {
    this.set({ [key]: updater(this.#state[key], this.#state) }, action ?? `update:${String(key)}`);
  }

  /**
   * Run several mutations, notifying subscribers once at the end.
   * @param {() => void} fn
   */
  batch(fn) {
    this.#depth++;
    try { fn(); } finally {
      this.#depth--;
      if (this.#depth === 0) this.#flush();
    }
  }

  /**
   * Subscribe to a slice. Fires immediately unless `immediate: false`.
   *
   * @template T
   * @param {(s: S) => T} selector
   * @param {(value: T, previous: T) => void} listener
   * @param {{immediate?: boolean, equals?: (a:T,b:T)=>boolean}} [opts]
   * @returns {() => void} unsubscribe
   */
  subscribe(selector, listener, opts = {}) {
    const entry = {
      sel: selector,
      fn: listener,
      last: selector(this.#state),
      eq: opts.equals ?? Object.is,
    };
    this.#subs.add(entry);
    if (opts.immediate !== false) listener(entry.last, entry.last);
    return () => this.#subs.delete(entry);
  }

  /**
   * Subscribe to the whole tree.
   * @param {(s: S) => void} listener
   */
  watch(listener) {
    return this.subscribe((s) => s, listener, { equals: () => false });
  }

  /** @param {(action:string, patch:any, state:S)=>void} fn */
  use(fn) { this.#middleware.push(fn); return this; }

  #schedule() {
    if (this.#depth > 0 || this.#queued) return;
    this.#queued = true;
    queueMicrotask(() => { this.#queued = false; this.#flush(); });
  }

  #flush() {
    const snapshot = this.#state;
    for (const entry of this.#subs) {
      const next = entry.sel(snapshot);
      if (entry.eq(next, entry.last)) continue;
      const prev = entry.last;
      entry.last = next;
      try { entry.fn(next, prev); }
      catch (err) { console.error('[store] subscriber threw', err); }
    }
  }
}

/**
 * Shallow array equality — useful as a selector comparator.
 * @param {any[]} a @param {any[]} b
 */
export function shallowArrayEquals(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
}

/**
 * Shallow object equality.
 * @param {Record<string,any>} a @param {Record<string,any>} b
 */
export function shallowEquals(a, b) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!Object.is(a[k], b[k])) return false;
  return true;
}
