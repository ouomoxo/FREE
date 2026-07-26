/**
 * MAESTRO — Transport.
 *
 * Plays a materialised Score against the AudioContext clock using the standard
 * lookahead pattern: a coarse timer wakes up every 25 ms and schedules every
 * event that falls inside the next 140 ms window, sample-accurately. Because
 * the score is a sorted array with known absolute times, seeking is a binary
 * search and the reported position is exact.
 *
 * @module audio/transport
 */

import { engine } from './engine.js';
import { VOICES } from './instruments.js';
import { findEventIndex } from './composer.js';
import { bus, EVT } from '../core/bus.js';

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.14;

export class Transport {
  /** @type {import('./composer.js').Score|null} */ score = null;
  /** @type {number} */ #cursor = 0;
  /** @type {number} */ #startCtxTime = 0;
  /** @type {number} */ #startOffset = 0;
  /** @type {number} */ #pausedAt = 0;
  /** @type {number|null} */ #timer = null;
  /** @type {boolean} */ #playing = false;
  /** @type {number} */ #lastBeat = -1;
  /** @type {number} */ #rate = 1;

  /** Extra per-instrument gain trims, set by the mixer UI. */
  trims = Object.create(null);

  get playing() { return this.#playing; }
  get duration() { return this.score?.duration ?? 0; }

  /** Current playhead in seconds. */
  get position() {
    if (!this.score) return 0;
    if (!this.#playing) return this.#pausedAt;
    const t = this.#startOffset + (engine.currentTime - this.#startCtxTime) * this.#rate;
    return Math.min(t, this.score.duration);
  }

  /**
   * Load a score. Does not start playback.
   * @param {import('./composer.js').Score} score
   */
  load(score) {
    this.stop();
    this.score = score;
    this.#pausedAt = 0;
    this.#cursor = 0;
    this.#lastBeat = -1;
    if (engine.ready && typeof score.reverb === 'number') engine.setReverb(score.reverb);
  }

  /**
   * Begin (or resume) playback.
   * @param {number} [from] seconds; defaults to the paused position
   */
  play(from) {
    if (!this.score || !engine.ready) return false;
    const offset = from ?? this.#pausedAt;
    this.#startOffset = Math.max(0, Math.min(offset, this.score.duration));
    this.#startCtxTime = engine.currentTime;
    this.#cursor = findEventIndex(this.score.events, this.#startOffset);
    this.#lastBeat = Math.floor(this.#startOffset / this.score.secPerBeat) - 1;
    this.#playing = true;
    this.#tick();
    this.#timer = window.setInterval(() => this.#tick(), LOOKAHEAD_MS);
    return true;
  }

  pause() {
    if (!this.#playing) return;
    this.#pausedAt = this.position;
    this.#playing = false;
    this.#clearTimer();
  }

  stop() {
    this.#playing = false;
    this.#pausedAt = 0;
    this.#cursor = 0;
    this.#clearTimer();
  }

  /**
   * Move the playhead. Safe while playing or paused.
   * @param {number} seconds
   */
  seek(seconds) {
    if (!this.score) return;
    const t = Math.max(0, Math.min(seconds, this.score.duration));
    if (this.#playing) {
      this.#clearTimer();
      this.play(t);
    } else {
      this.#pausedAt = t;
      this.#cursor = findEventIndex(this.score.events, t);
    }
  }

  /** @param {number} r 0.5..2 — playback rate, applied to the clock. */
  setRate(r) {
    const wasPlaying = this.#playing;
    const pos = this.position;
    this.#rate = Math.max(0.5, Math.min(2, r));
    if (wasPlaying) { this.#clearTimer(); this.play(pos); }
  }

  get rate() { return this.#rate; }

  #clearTimer() {
    if (this.#timer !== null) { clearInterval(this.#timer); this.#timer = null; }
  }

  #tick() {
    const score = this.score;
    if (!score || !this.#playing || !engine.ready) return;

    const now = engine.currentTime;
    const horizon = this.#startOffset + (now - this.#startCtxTime + SCHEDULE_AHEAD) * this.#rate;
    const events = score.events;

    while (this.#cursor < events.length && events[this.#cursor].t <= horizon) {
      const ev = events[this.#cursor++];
      const when = this.#startCtxTime + (ev.t - this.#startOffset) / this.#rate;
      if (when < now - 0.05) continue;          // stale after a seek; skip
      const voice = VOICES[ev.i];
      if (!voice) continue;
      const trim = this.trims[ev.i] ?? 1;
      if (trim <= 0) continue;
      try {
        voice(engine, {
          midi: ev.m,
          time: Math.max(when, now + 0.002),
          dur: ev.d / this.#rate,
          vel: ev.v * trim,
          pan: ev.p,
        });
      } catch (err) {
        console.warn('[transport] voice failed', ev.i, err);
      }
    }

    // Beat / bar notifications drive the conductor.
    const pos = this.position;
    const beat = Math.floor(pos / score.secPerBeat);
    if (beat !== this.#lastBeat && beat >= 0) {
      this.#lastBeat = beat;
      const beatInBar = beat % score.meter[0];
      bus.emit(EVT.BEAT, { beat, beatInBar, bar: Math.floor(beat / score.meter[0]), meter: score.meter[0], t: pos });
      if (beatInBar === 0) bus.emit(EVT.BAR, { bar: Math.floor(beat / score.meter[0]), t: pos });
    }

    if (pos >= score.duration - 0.02) {
      this.#playing = false;
      this.#pausedAt = score.duration;
      this.#clearTimer();
      bus.emit(EVT.TRACK_ENDED, { });
    }
  }
}

export const transport = new Transport();
