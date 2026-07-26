/**
 * MAESTRO — Audio engine.
 *
 * Owns the AudioContext and the master signal chain:
 *
 *   voices ──┬─► dry ─────────────────────────────┐
 *            ├─► reverbSend ─► convolver ─► wet ──┤
 *            └─► roomSend  ─► shortIR   ─► wet ───┤
 *                                                  ▼
 *              master ─► compressor ─► analyser ─► destination
 *
 * The reverb impulse response is generated in-process (noise with an
 * exponential decay envelope and a slowly closing low-pass), so the app ships
 * with no binary audio assets at all.
 *
 * @module audio/engine
 */

import { clamp } from '../core/utils.js';

export class AudioEngine {
  /** @type {AudioContext|null} */ ctx = null;
  /** @type {GainNode|null} */ master = null;
  /** @type {GainNode|null} */ dry = null;
  /** @type {GainNode|null} */ wet = null;
  /** @type {GainNode|null} */ reverbSend = null;
  /** @type {AnalyserNode|null} */ analyser = null;
  /** @type {DynamicsCompressorNode|null} */ compressor = null;
  /** @type {BiquadFilterNode|null} */ tone = null;

  /** @type {Uint8Array|null} */ freqData = null;
  /** @type {Uint8Array|null} */ timeData = null;

  #ready = false;
  #volume = 0.8;
  #muted = false;

  get ready() { return this.#ready; }
  get currentTime() { return this.ctx?.currentTime ?? 0; }
  get sampleRate() { return this.ctx?.sampleRate ?? 44100; }
  get state() { return this.ctx?.state ?? 'closed'; }

  /**
   * Create the graph. Must be called from a user gesture on most browsers;
   * calling it again is a no-op beyond resuming a suspended context.
   * @returns {Promise<boolean>} whether the context is running
   */
  async init() {
    if (this.#ready) return this.resume();

    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;

    const ctx = new Ctor({ latencyHint: 'interactive' });
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.#muted ? 0 : this.#volume;

    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 22;
    this.compressor.ratio.value = 3.2;
    this.compressor.attack.value = 0.006;
    this.compressor.release.value = 0.22;

    // A gentle shelf keeps the synthesised strings from getting glassy.
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'highshelf';
    this.tone.frequency.value = 5200;
    this.tone.gain.value = -3.5;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.72;
    this.analyser.minDecibels = -92;
    this.analyser.maxDecibels = -12;
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeData = new Uint8Array(this.analyser.fftSize);

    this.dry = ctx.createGain();
    this.dry.gain.value = 0.82;

    this.wet = ctx.createGain();
    this.wet.gain.value = 0.42;

    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 1;

    const convolver = ctx.createConvolver();
    convolver.buffer = this.#buildImpulse({ seconds: 3.1, decay: 2.6, preDelay: 0.022 });
    this.convolver = convolver;

    // Pre-reverb damping — a real hall eats the top end.
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 4200;
    damp.Q.value = 0.4;

    this.reverbSend.connect(damp);
    damp.connect(convolver);
    convolver.connect(this.wet);

    this.dry.connect(this.master);
    this.wet.connect(this.master);
    this.master.connect(this.tone);
    this.tone.connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    this.#ready = true;
    return this.resume();
  }

  /** @returns {Promise<boolean>} */
  async resume() {
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch { return false; }
    }
    return this.ctx.state === 'running';
  }

  async suspend() {
    if (this.ctx && this.ctx.state === 'running') {
      try { await this.ctx.suspend(); } catch { /* ignore */ }
    }
  }

  /**
   * Where instrument voices connect.
   * @returns {{dry: GainNode, send: GainNode}|null}
   */
  get bus() {
    if (!this.#ready) return null;
    return { dry: this.dry, send: this.reverbSend };
  }

  /** @param {number} v 0..1 */
  setVolume(v) {
    this.#volume = clamp(v, 0, 1);
    if (this.master && this.ctx) {
      const target = this.#muted ? 0 : this.#gainCurve(this.#volume);
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
    }
  }

  /** @param {boolean} m */
  setMuted(m) {
    this.#muted = m;
    this.setVolume(this.#volume);
  }

  get volume() { return this.#volume; }
  get muted() { return this.#muted; }

  /** Perceptual volume curve — linear faders sound wrong. */
  #gainCurve(v) { return Math.pow(v, 1.8); }

  /** @param {number} amount 0..1 */
  setReverb(amount) {
    if (!this.wet || !this.ctx) return;
    this.wet.gain.setTargetAtTime(clamp(amount, 0, 1) * 0.75, this.ctx.currentTime, 0.05);
  }

  /**
   * Copy the current spectrum into the shared buffer.
   * @returns {Uint8Array|null}
   */
  sampleSpectrum() {
    if (!this.analyser || !this.freqData) return null;
    this.analyser.getByteFrequencyData(this.freqData);
    return this.freqData;
  }

  /** @returns {Uint8Array|null} */
  sampleWaveform() {
    if (!this.analyser || !this.timeData) return null;
    this.analyser.getByteTimeDomainData(this.timeData);
    return this.timeData;
  }

  /**
   * Broadband RMS of the current frame, 0..1 — drives the conductor's
   * dynamics so the gesture actually follows the music.
   */
  level() {
    const t = this.sampleWaveform();
    if (!t) return 0;
    let sum = 0;
    for (let i = 0; i < t.length; i += 4) {
      const v = (t[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / (t.length / 4)) * 2.6);
  }

  /**
   * Generate a stereo impulse response: decorrelated noise shaped by an
   * exponential decay, with a short pre-delay of silence.
   *
   * @param {{seconds:number, decay:number, preDelay:number}} o
   * @returns {AudioBuffer}
   */
  #buildImpulse(o) {
    const ctx = /** @type {AudioContext} */ (this.ctx);
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * o.seconds);
    const pre = Math.floor(rate * o.preDelay);
    const buffer = ctx.createBuffer(2, length, rate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      // A one-pole low-pass over the noise makes the tail feel like air
      // rather than static.
      let lp = 0;
      for (let i = 0; i < length; i++) {
        if (i < pre) { data[i] = 0; continue; }
        const t = (i - pre) / (length - pre);
        const env = Math.pow(1 - t, o.decay);
        const noise = Math.random() * 2 - 1;
        lp += (noise - lp) * (0.32 - 0.22 * t);
        // Early reflections: a few discrete taps in the first 80 ms.
        let early = 0;
        if (i - pre < rate * 0.08) {
          const n = i - pre;
          if (n % 977 === 0) early = 0.55;
          else if (n % 1471 === 0) early = -0.38;
          else if (n % 2113 === 0) early = 0.26;
        }
        data[i] = (lp * 0.9 + early) * env;
      }
    }
    return buffer;
  }

  /** Release everything (used only on teardown). */
  async dispose() {
    try { await this.ctx?.close(); } catch { /* ignore */ }
    this.ctx = null;
    this.#ready = false;
  }
}

export const engine = new AudioEngine();
