/**
 * MAESTRO — Persistence.
 *
 * Namespaced, versioned, and defensive: a private-mode browser or a corrupt
 * value must never break the app, so every access degrades to an in-memory map.
 *
 * @module core/storage
 */

const NAMESPACE = 'maestro';
const VERSION = 1;

/** @type {Map<string, any>} */
const memory = new Map();

let available = (() => {
  try {
    const probe = `${NAMESPACE}:probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch { return false; }
})();

const keyFor = (key) => `${NAMESPACE}.v${VERSION}.${key}`;

/**
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @returns {T}
 */
export function read(key, fallback) {
  try {
    if (!available) return memory.has(key) ? memory.get(key) : fallback;
    const raw = localStorage.getItem(keyFor(key));
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[storage] failed to read "${key}"`, err);
    return fallback;
  }
}

/**
 * @param {string} key @param {any} value
 */
export function write(key, value) {
  try {
    if (!available) { memory.set(key, value); return; }
    localStorage.setItem(keyFor(key), JSON.stringify(value));
  } catch (err) {
    // Quota exceeded or blocked mid-session — fall back permanently.
    available = false;
    memory.set(key, value);
    console.warn(`[storage] falling back to memory for "${key}"`, err);
  }
}

/** @param {string} key */
export function remove(key) {
  try { if (available) localStorage.removeItem(keyFor(key)); } catch { /* ignore */ }
  memory.delete(key);
}

/** Drop every key in this namespace/version. */
export function clearAll() {
  try {
    if (!available) { memory.clear(); return; }
    const prefix = `${NAMESPACE}.v${VERSION}.`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) localStorage.removeItem(k);
    }
  } catch { /* ignore */ }
  memory.clear();
}

/**
 * A typed, defaulted, self-persisting cell.
 * @template T
 * @param {string} key @param {T} initial
 */
export function cell(key, initial) {
  let value = read(key, initial);
  return {
    get: () => value,
    /** @param {T | ((v:T)=>T)} next */
    set(next) {
      value = typeof next === 'function' ? /** @type {any} */ (next)(value) : next;
      write(key, value);
      return value;
    },
    reset() { value = initial; remove(key); return value; },
  };
}

export const STORAGE_KEYS = Object.freeze({
  VOLUME: 'player.volume',
  MUTED: 'player.muted',
  SHUFFLE: 'player.shuffle',
  REPEAT: 'player.repeat',
  LAST_TRACK: 'player.lastTrack',
  LIKED: 'library.liked',
  LIKED_ALBUMS: 'library.likedAlbums',
  RECENT: 'library.recent',
  PLAY_COUNTS: 'library.playCounts',
  PLAYLISTS: 'library.playlists',
  SEARCH_HISTORY: 'search.history',
  ASIDE_OPEN: 'ui.asideOpen',
  SIDEBAR_OPEN: 'ui.sidebarOpen',
  DENSITY: 'ui.density',
  VISUALIZER: 'ui.visualizer',
  ONBOARDED: 'ui.onboarded',
});
