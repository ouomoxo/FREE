/**
 * MAESTRO — Player controller.
 *
 * The bridge between the store (what the user asked for) and the audio
 * subsystem (what is actually sounding). It owns the queue, the score cache,
 * the per-frame playhead broadcast, and the OS media-session integration.
 *
 * @module player
 */

import { store, actions } from './state.js';
import { engine } from './audio/engine.js';
import { transport } from './audio/transport.js';
import { compose } from './audio/composer.js';
import { orchestrate } from './audio/orchestra.js';
import { prewarm } from './audio/instruments.js';
import { getTrack, getAlbum, getArtist, albumTracks } from './data/catalog.js';
import { bus, EVT } from './core/bus.js';
import { Random, clamp } from './core/utils.js';
import { read, write, STORAGE_KEYS as K } from './core/storage.js';

/** Composed scores, keyed by track id. Composition is deterministic, so this
 *  is a pure memo — it never needs invalidating. */
const scoreCache = new Map();

/** @param {import('./data/catalog.js').Track} track */
function scoreFor(track) {
  let score = scoreCache.get(track.id);
  if (!score) {
    score = compose({
      seed: track.seed,
      style: track.style,
      key: track.key,
      mode: track.mode,
      bpm: track.bpm,
      targetBars: track.targetBars,
    });
    // The composer writes the music; the orchestrator decides who plays it,
    // and how many of them are playing at any moment. See audio/orchestra.js.
    score = orchestrate(score, track.seed);
    if (scoreCache.size > 24) {
      // Keep the cache bounded; re-composing is cheap and deterministic.
      const oldest = scoreCache.keys().next().value;
      scoreCache.delete(oldest);
    }
    scoreCache.set(track.id, score);
  }
  return score;
}

class Player {
  /** @type {import('./audio/composer.js').Score|null} */ score = null;
  #raf = 0;
  #unlocking = false;
  /** @type {string[]} */ #naturalOrder = [];

  /* --- Lifecycle -------------------------------------------------------- */

  init() {
    engine.setVolume(store.state.volume);
    engine.setMuted(store.state.muted);

    store.subscribe((s) => s.volume, (v) => engine.setVolume(v), { immediate: false });
    store.subscribe((s) => s.muted, (m) => engine.setMuted(m), { immediate: false });

    bus.on(EVT.TRACK_ENDED, () => this.#onEnded());

    // Restore the last session's track without autoplaying it.
    const last = read(K.LAST_TRACK, null);
    if (last && getTrack(last.trackId)) {
      this.#prepare(getTrack(last.trackId), { queue: last.queue?.filter(getTrack) ?? [last.trackId], index: last.index ?? 0, origin: last.origin ?? null, autoplay: false });
    }

    this.#loop();
    this.#bindMediaSession();
  }

  /**
   * Ensure the AudioContext exists and is running. Browsers require this to
   * happen inside a user gesture, so every play path funnels through here.
   * @returns {Promise<boolean>}
   */
  async unlock() {
    if (engine.ready && engine.state === 'running') return true;
    if (this.#unlocking) return false;
    this.#unlocking = true;
    try {
      const ok = await engine.init();
      store.set({ audioReady: ok }, 'audio:ready');
      if (ok) {
        bus.emit(EVT.AUDIO_READY, {}, { sticky: true });
        // Render the plucked-string tables in the background so the first
        // harpsichord entry does not stutter.
        requestIdleCallback?.(() => prewarm(engine.ctx, 45, 86)) ?? setTimeout(() => prewarm(engine.ctx, 45, 86), 400);
      } else {
        bus.emit(EVT.AUDIO_BLOCKED, {});
      }
      return ok;
    } finally {
      this.#unlocking = false;
    }
  }

  /* --- Queue ------------------------------------------------------------ */

  /**
   * Start a track, optionally replacing the queue.
   *
   * @param {string} trackId
   * @param {object} [o]
   * @param {string[]} [o.queue]  Full track-id list this play belongs to.
   * @param {{type:string,id:string,title:string}} [o.origin]
   * @param {boolean} [o.autoplay=true]
   */
  async play(trackId, o = {}) {
    const track = getTrack(trackId);
    if (!track) return;

    const queue = o.queue?.length ? o.queue.slice() : [trackId];
    this.#naturalOrder = queue.slice();
    const ordered = store.state.shuffle ? this.#shuffled(queue, trackId) : queue;
    const index = Math.max(0, ordered.indexOf(trackId));

    this.#prepare(track, { queue: ordered, index, origin: o.origin ?? null, autoplay: o.autoplay !== false });
  }

  /**
   * Play a whole context (album, playlist, artist) from its first track.
   * @param {{type:string,id:string,title:string,trackIds:string[]}} context
   * @param {string} [startAt]
   */
  playContext(context, startAt) {
    if (!context.trackIds.length) return;
    const first = startAt ?? (store.state.shuffle
      ? context.trackIds[Random(`${context.id}:${Date.now()}`).int(context.trackIds.length)]
      : context.trackIds[0]);
    this.play(first, { queue: context.trackIds, origin: { type: context.type, id: context.id, title: context.title } });
  }

  /**
   * @param {import('./data/catalog.js').Track} track
   * @param {{queue:string[], index:number, origin:any, autoplay:boolean}} o
   */
  async #prepare(track, o) {
    store.set({
      trackId: track.id,
      queue: o.queue,
      queueIndex: o.index,
      origin: o.origin,
      duration: track.duration,
      loadingTrack: true,
    }, 'player:prepare');

    // Composition is synchronous but can take a few ms for long pieces; yield
    // once so the UI paints the new track before the work starts.
    await Promise.resolve();
    const score = scoreFor(track);
    this.score = score;
    store.set({ duration: score.duration, loadingTrack: false }, 'player:loaded');

    write(K.LAST_TRACK, { trackId: track.id, queue: o.queue, index: o.index, origin: o.origin });

    if (!o.autoplay) {
      transport.load(score);
      bus.emit(EVT.PLAYBACK_TICK, { position: 0, duration: score.duration, progress: 0 });
      this.#updateMediaSession(track);
      return;
    }

    const ok = await this.unlock();
    transport.load(score);
    if (!ok) {
      store.set({ playing: false }, 'player:blocked');
      actions.toast('TAP ANYWHERE TO ENABLE AUDIO', { tone: 'warn', ms: 4000 });
      return;
    }
    transport.play(0);
    store.set({ playing: true }, 'player:play');
    actions.notePlay(track.id);
    bus.emit(EVT.TRACK_STARTED, { track, score });
    this.#updateMediaSession(track);
  }

  /** @param {string[]} queue @param {string} keepFirst */
  #shuffled(queue, keepFirst) {
    const rnd = Random(`${keepFirst}:${queue.length}:${store.state.shuffle}`);
    const rest = rnd.shuffle(queue.filter((t) => t !== keepFirst));
    return [keepFirst, ...rest];
  }

  /* --- Transport controls ----------------------------------------------- */

  async toggle() {
    if (!store.state.trackId) {
      // Nothing loaded: start the house programme.
      const first = albumTracks('op27')[0];
      if (first) this.play(first.id, { queue: albumTracks('op27').map((t) => t.id), origin: { type: 'album', id: 'op27', title: "THE CONDUCTOR'S HANDS" } });
      return;
    }
    if (transport.playing) {
      transport.pause();
      store.set({ playing: false }, 'player:pause');
      this.#setMediaState('paused');
      return;
    }
    const ok = await this.unlock();
    if (!ok) { actions.toast('AUDIO BLOCKED BY THE BROWSER', { tone: 'warn' }); return; }
    if (!transport.score && this.score) transport.load(this.score);
    transport.play();
    store.set({ playing: true }, 'player:play');
    this.#setMediaState('playing');
  }

  pause() {
    if (!transport.playing) return;
    transport.pause();
    store.set({ playing: false }, 'player:pause');
    this.#setMediaState('paused');
  }

  /** @param {number} seconds */
  seek(seconds) {
    transport.seek(seconds);
    bus.emit(EVT.PLAYBACK_TICK, {
      position: transport.position,
      duration: transport.duration,
      progress: transport.duration ? transport.position / transport.duration : 0,
    });
  }

  /** @param {number} delta */
  nudge(delta) { this.seek(clamp(transport.position + delta, 0, transport.duration)); }

  next(userInitiated = true) {
    const { queue, queueIndex, repeat } = store.state;
    if (!queue.length) return;
    if (repeat === 'one' && !userInitiated) { this.seek(0); return; }
    let index = queueIndex + 1;
    if (index >= queue.length) {
      if (repeat === 'all' || !userInitiated) index = 0;
      else { this.pause(); this.seek(0); return; }
      if (repeat === 'off' && userInitiated) index = 0;
    }
    this.#jumpTo(index);
  }

  previous() {
    // Standard behaviour: restart the track unless we are near its start.
    if (transport.position > 3) { this.seek(0); return; }
    const { queue, queueIndex } = store.state;
    if (!queue.length) return;
    const index = queueIndex - 1 < 0 ? queue.length - 1 : queueIndex - 1;
    this.#jumpTo(index);
  }

  /** @param {number} index */
  #jumpTo(index) {
    const { queue, origin } = store.state;
    const id = queue[index];
    const track = getTrack(id);
    if (!track) return;
    this.#prepare(track, { queue, index, origin, autoplay: true });
  }

  /** @param {number} index Index within the current queue. */
  jumpToIndex(index) {
    if (index < 0 || index >= store.state.queue.length) return;
    this.#jumpTo(index);
  }

  /** Append a track to the end of the queue. @param {string} trackId */
  enqueue(trackId) {
    if (!getTrack(trackId)) return;
    const queue = [...store.state.queue, trackId];
    store.set({ queue }, 'queue:add');
    bus.emit(EVT.QUEUE_CHANGED, { queue });
    actions.toast('ADDED TO QUEUE');
  }

  /** Insert a track directly after the current one. @param {string} trackId */
  playNext(trackId) {
    if (!getTrack(trackId)) return;
    const { queue, queueIndex } = store.state;
    const next = queue.slice();
    next.splice(queueIndex + 1, 0, trackId);
    store.set({ queue: next }, 'queue:next');
    bus.emit(EVT.QUEUE_CHANGED, { queue: next });
    actions.toast('PLAYING NEXT');
  }

  /** @param {number} index */
  removeFromQueue(index) {
    const { queue, queueIndex } = store.state;
    if (index <= queueIndex || index >= queue.length) return;
    const next = queue.slice();
    next.splice(index, 1);
    store.set({ queue: next }, 'queue:remove');
    bus.emit(EVT.QUEUE_CHANGED, { queue: next });
  }

  #onEnded() {
    const { repeat } = store.state;
    if (repeat === 'one') {
      transport.seek(0);
      transport.play(0);
      return;
    }
    const { queue, queueIndex } = store.state;
    if (queueIndex + 1 < queue.length) { this.#jumpTo(queueIndex + 1); return; }
    if (repeat === 'all' && queue.length) { this.#jumpTo(0); return; }
    store.set({ playing: false }, 'player:end');
    this.#setMediaState('paused');
  }

  /* --- Per-frame broadcast ---------------------------------------------- */

  #loop = () => {
    const position = transport.position;
    const duration = transport.duration || store.state.duration;
    bus.emit(EVT.PLAYBACK_TICK, {
      position,
      duration,
      progress: duration ? clamp(position / duration, 0, 1) : 0,
      playing: transport.playing,
    });
    this.#raf = requestAnimationFrame(this.#loop);
  };

  /* --- OS media session -------------------------------------------------- */

  #bindMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    try {
      ms.setActionHandler('play', () => this.toggle());
      ms.setActionHandler('pause', () => this.pause());
      ms.setActionHandler('previoustrack', () => this.previous());
      ms.setActionHandler('nexttrack', () => this.next());
      ms.setActionHandler('seekbackward', () => this.nudge(-10));
      ms.setActionHandler('seekforward', () => this.nudge(10));
      ms.setActionHandler('seekto', (d) => { if (d.seekTime != null) this.seek(d.seekTime); });
    } catch { /* older browsers reject unknown actions */ }
  }

  /** @param {import('./data/catalog.js').Track} track */
  #updateMediaSession(track) {
    if (!('mediaSession' in navigator)) return;
    const album = getAlbum(track.albumId);
    const artist = getArtist(track.artistId);
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: artist?.name ?? 'MAESTRO',
        album: album?.title ?? '',
      });
      navigator.mediaSession.playbackState = 'playing';
    } catch { /* ignore */ }
  }

  #setMediaState(state) {
    if ('mediaSession' in navigator) {
      try { navigator.mediaSession.playbackState = state; } catch { /* ignore */ }
    }
  }
}

export const player = new Player();
