/**
 * MAESTRO — Hash router.
 *
 * Hash-based so the site runs from any static host or the file system with no
 * server rewrites. Supports `:params`, query strings, scroll restoration, and
 * a `before` guard.
 *
 * @module core/router
 */

/**
 * @typedef {object} RouteMatch
 * @property {string} path       Raw path, e.g. `/album/op-27`
 * @property {string} pattern    Matched pattern, e.g. `/album/:id`
 * @property {Record<string,string>} params
 * @property {URLSearchParams} query
 * @property {string} name
 */

export class Router {
  /** @type {Array<{name:string, pattern:string, regex:RegExp, keys:string[], handler:(m:RouteMatch)=>void}>} */
  #routes = [];
  /** @type {((m: RouteMatch) => void)|null} */ #fallback = null;
  /** @type {RouteMatch|null} */ #current = null;
  /** @type {Map<string, number>} */ #scroll = new Map();
  /** @type {Array<(next: RouteMatch, prev: RouteMatch|null) => boolean|void>} */ #guards = [];
  /** @type {string[]} */ #history = [];
  #started = false;

  /**
   * @param {string} name
   * @param {string} pattern e.g. `/album/:id`
   * @param {(m: RouteMatch) => void} handler
   */
  route(name, pattern, handler) {
    const keys = [];
    const regex = new RegExp(
      '^' +
        pattern
          .replace(/\/$/, '')
          .replace(/[.+*?^$()[\]{}|\\]/g, '\\$&')
          .replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) +
        '/?$',
    );
    this.#routes.push({ name, pattern, regex, keys, handler });
    return this;
  }

  /** @param {(m: RouteMatch) => void} handler */
  fallback(handler) { this.#fallback = handler; return this; }

  /** @param {(next: RouteMatch, prev: RouteMatch|null) => boolean|void} guard */
  guard(fn) { this.#guards.push(fn); return this; }

  /** @returns {RouteMatch|null} */
  get current() { return this.#current; }

  /** @returns {string|null} previous path */
  get previous() { return this.#history[this.#history.length - 2] ?? null; }

  start() {
    if (this.#started) return this;
    this.#started = true;
    window.addEventListener('hashchange', () => this.#resolve());
    this.#resolve();
    return this;
  }

  /**
   * @param {string} path e.g. `/album/op-27?from=home`
   * @param {{replace?: boolean}} [opts]
   */
  go(path, opts = {}) {
    const target = `#${path.startsWith('/') ? path : `/${path}`}`;
    if (location.hash === target) { this.#resolve(); return; }
    if (opts.replace) history.replaceState(null, '', target);
    else location.hash = target;
  }

  back() {
    if (this.#history.length > 1) history.back();
    else this.go('/');
  }

  /** Remember the scroll offset for the current route. */
  rememberScroll(offset) {
    if (this.#current) this.#scroll.set(this.#current.path, offset);
  }

  /** @param {string} path */
  savedScroll(path) { return this.#scroll.get(path) ?? 0; }

  #resolve() {
    const raw = location.hash.slice(1) || '/';
    const [pathname, search = ''] = raw.split('?');
    const path = pathname.replace(/\/+$/, '') || '/';

    for (const r of this.#routes) {
      const m = path.match(r.regex);
      if (!m) continue;
      /** @type {Record<string,string>} */
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      const match = { path: raw, pattern: r.pattern, params, query: new URLSearchParams(search), name: r.name };
      for (const g of this.#guards) if (g(match, this.#current) === false) return;
      this.#commit(match, r.handler);
      return;
    }

    const match = { path: raw, pattern: '*', params: {}, query: new URLSearchParams(search), name: 'not-found' };
    for (const g of this.#guards) if (g(match, this.#current) === false) return;
    this.#commit(match, this.#fallback ?? (() => {}));
  }

  /**
   * @param {RouteMatch} match
   * @param {(m: RouteMatch) => void} handler
   */
  #commit(match, handler) {
    this.#current = match;
    this.#history.push(match.path);
    if (this.#history.length > 50) this.#history.shift();
    try { handler(match); }
    catch (err) { console.error(`[router] handler for ${match.pattern} threw`, err); }
  }
}
