/**
 * MAESTRO — Application state.
 *
 * One store, one shape. Anything that survives a reload is mirrored into
 * localStorage through the actions below; anything per-frame (the playhead,
 * the spectrum) travels on the event bus instead, so the store never churns at
 * 60 Hz.
 *
 * @module state
 */

import { Store } from './core/store.js';
import { read, write, STORAGE_KEYS as K } from './core/storage.js';
import { bus, EVT } from './core/bus.js';
import { clamp } from './core/utils.js';

/**
 * @typedef {'off'|'all'|'one'} RepeatMode
 */

/**
 * @typedef {object} AppState
 * @property {string} routeName
 * @property {Record<string,string>} routeParams
 * @property {string|null} trackId
 * @property {boolean} playing
 * @property {number} duration
 * @property {string[]} queue           Track ids in play order.
 * @property {number} queueIndex
 * @property {{type:string,id:string,title:string}|null} origin
 * @property {boolean} shuffle
 * @property {RepeatMode} repeat
 * @property {number} volume
 * @property {boolean} muted
 * @property {boolean} audioReady
 * @property {boolean} loadingTrack
 * @property {string[]} liked
 * @property {string[]} likedAlbums
 * @property {string[]} recent
 * @property {Record<string,number>} playCounts
 * @property {string} query
 * @property {string[]} searchHistory
 * @property {boolean} asideOpen
 * @property {boolean} sidebarOpen
 * @property {boolean} concert
 * @property {boolean} commandOpen
 * @property {boolean} helpOpen
 * @property {boolean} queueOpen
 * @property {'comfortable'|'compact'} density
 * @property {string} visualizer
 * @property {{id:number,message:string,tone:string}|null} toast
 */

/** @type {AppState} */
const initial = {
  routeName: 'home',
  routeParams: {},

  trackId: null,
  playing: false,
  duration: 0,
  queue: [],
  queueIndex: 0,
  origin: null,

  shuffle: read(K.SHUFFLE, false),
  repeat: read(K.REPEAT, 'off'),
  volume: read(K.VOLUME, 0.78),
  muted: read(K.MUTED, false),

  audioReady: false,
  loadingTrack: false,

  liked: read(K.LIKED, []),
  likedAlbums: read(K.LIKED_ALBUMS, []),
  recent: read(K.RECENT, []),
  playCounts: read(K.PLAY_COUNTS, {}),

  query: '',
  searchHistory: read(K.SEARCH_HISTORY, []),

  asideOpen: read(K.ASIDE_OPEN, true),
  sidebarOpen: read(K.SIDEBAR_OPEN, true),
  concert: false,
  commandOpen: false,
  helpOpen: false,
  queueOpen: false,
  density: read(K.DENSITY, 'comfortable'),
  visualizer: read(K.VISUALIZER, 'aria'),
  toast: null,
};

/** @type {Store<AppState>} */
export const store = new Store(initial);

/* ============================================================================
   Selectors
   ========================================================================== */

export const sel = {
  /** @param {AppState} s */
  currentTrackId: (s) => s.trackId,
  /** @param {AppState} s */
  playing: (s) => s.playing,
  /** @param {AppState} s */
  isLiked: (id) => (s) => s.liked.includes(id),
  /** @param {AppState} s */
  queue: (s) => s.queue,
  /** @param {AppState} s */
  upNext: (s) => s.queue.slice(s.queueIndex + 1),
};

/* ============================================================================
   Actions — the only places that write to the store.
   ========================================================================== */

let toastId = 0;
let toastTimer = 0;

export const actions = {
  /** @param {string} message @param {{tone?: string, ms?: number}} [o] */
  toast(message, o = {}) {
    const id = ++toastId;
    store.set({ toast: { id, message, tone: o.tone ?? 'neutral' } }, 'toast');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      if (store.state.toast?.id === id) store.set({ toast: null }, 'toast:clear');
    }, o.ms ?? 2600);
    bus.emit(EVT.TOAST, { message, tone: o.tone });
  },

  /** @param {string} trackId */
  toggleLike(trackId) {
    const liked = store.state.liked;
    const next = liked.includes(trackId)
      ? liked.filter((t) => t !== trackId)
      : [trackId, ...liked];
    store.set({ liked: next }, 'like');
    write(K.LIKED, next);
    actions.toast(liked.includes(trackId) ? 'REMOVED FROM LIBRARY' : 'SAVED TO LIBRARY');
  },

  /** @param {string} albumId */
  toggleAlbumLike(albumId) {
    const list = store.state.likedAlbums;
    const next = list.includes(albumId) ? list.filter((a) => a !== albumId) : [albumId, ...list];
    store.set({ likedAlbums: next }, 'like:album');
    write(K.LIKED_ALBUMS, next);
    actions.toast(list.includes(albumId) ? 'REMOVED FROM LIBRARY' : 'ADDED TO LIBRARY');
  },

  /** @param {string} trackId */
  notePlay(trackId) {
    const recent = [trackId, ...store.state.recent.filter((t) => t !== trackId)].slice(0, 40);
    const counts = { ...store.state.playCounts, [trackId]: (store.state.playCounts[trackId] ?? 0) + 1 };
    store.set({ recent, playCounts: counts }, 'play:note');
    write(K.RECENT, recent);
    write(K.PLAY_COUNTS, counts);
  },

  /** @param {number} v */
  setVolume(v) {
    const volume = clamp(v, 0, 1);
    store.set({ volume, muted: volume === 0 ? store.state.muted : false }, 'volume');
    write(K.VOLUME, volume);
  },

  toggleMute() {
    const muted = !store.state.muted;
    store.set({ muted }, 'mute');
    write(K.MUTED, muted);
  },

  toggleShuffle() {
    const shuffle = !store.state.shuffle;
    store.set({ shuffle }, 'shuffle');
    write(K.SHUFFLE, shuffle);
    actions.toast(shuffle ? 'SHUFFLE ON' : 'SHUFFLE OFF');
  },

  cycleRepeat() {
    /** @type {RepeatMode[]} */
    const order = ['off', 'all', 'one'];
    const repeat = order[(order.indexOf(store.state.repeat) + 1) % order.length];
    store.set({ repeat }, 'repeat');
    write(K.REPEAT, repeat);
    actions.toast(`REPEAT ${repeat.toUpperCase()}`);
  },

  toggleAside() {
    const asideOpen = !store.state.asideOpen;
    store.set({ asideOpen }, 'ui:aside');
    write(K.ASIDE_OPEN, asideOpen);
  },

  toggleSidebar() {
    const sidebarOpen = !store.state.sidebarOpen;
    store.set({ sidebarOpen }, 'ui:sidebar');
    write(K.SIDEBAR_OPEN, sidebarOpen);
  },

  /** @param {boolean} [on] */
  setConcert(on) {
    const concert = on ?? !store.state.concert;
    store.set({ concert }, 'ui:concert');
  },

  /** @param {boolean} [on] */
  setQueueOpen(on) {
    store.set({ queueOpen: on ?? !store.state.queueOpen }, 'ui:queue');
  },

  /** @param {boolean} [on] */
  setCommandOpen(on) {
    store.set({ commandOpen: on ?? !store.state.commandOpen }, 'ui:command');
  },

  /** @param {boolean} [on] */
  setHelpOpen(on) {
    store.set({ helpOpen: on ?? !store.state.helpOpen, commandOpen: false }, 'ui:help');
  },

  /** @param {string} visualizer */
  setVisualizer(visualizer) {
    store.set({ visualizer }, 'ui:visualizer');
    write(K.VISUALIZER, visualizer);
  },

  /** @param {string} query */
  setQuery(query) {
    store.set({ query }, 'search');
  },

  /** @param {string} query */
  rememberSearch(query) {
    const q = query.trim();
    if (!q) return;
    const next = [q, ...store.state.searchHistory.filter((s) => s !== q)].slice(0, 8);
    store.set({ searchHistory: next }, 'search:history');
    write(K.SEARCH_HISTORY, next);
  },

  clearSearchHistory() {
    store.set({ searchHistory: [] }, 'search:history:clear');
    write(K.SEARCH_HISTORY, []);
  },
};

/* ============================================================================
   Devtools hook — a tiny action log, enabled with ?debug
   ========================================================================== */

if (typeof location !== 'undefined' && location.search.includes('debug')) {
  store.use((action, patch) => console.debug('[state]', action, patch));
  window.__MAESTRO__ = { store, actions, bus };
}
