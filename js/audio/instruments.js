/**
 * MAESTRO — Instrument voices.
 *
 * Each voice is a factory that schedules a short-lived sub-graph at an absolute
 * AudioContext time and tears itself down when it finishes. Plucked timbres use
 * a Karplus–Strong string model rendered offline into a cached AudioBuffer:
 * Web Audio clamps feedback delay loops to one render quantum, which would cap
 * the pitch around F4, so the string is integrated in JavaScript instead. The
 * buffers are memoised per pitch, so the cost is paid once per note name.
 *
 * @module audio/instruments
 */

import { mtof } from './theory.js';
import { clamp } from '../core/utils.js';
import { pianoBus } from './piano.js';
import { grand } from './grand.js';

/** @type {Map<string, AudioBuffer>} */
const pluckCache = new Map();
/** @type {AudioBuffer|null} */
let noiseBuffer = null;

/**
 * Shared white-noise buffer (2 s, mono).
 * @param {AudioContext} ctx
 */
function getNoise(ctx) {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  noiseBuffer = buf;
  return buf;
}

/**
 * Output chain for a voice: gain -> pan -> (dry, reverb send).
 *
 * @param {import('./engine.js').AudioEngine} engine
 * @param {{pan?: number, send?: number, gain?: number}} o
 * @returns {{input: GainNode, dispose: () => void}}
 */
function outputChain(engine, o = {}) {
  const ctx = engine.ctx;
  const input = ctx.createGain();
  input.gain.value = o.gain ?? 1;

  /** @type {AudioNode} */
  let node = input;
  if (typeof ctx.createStereoPanner === 'function') {
    const panner = ctx.createStereoPanner();
    panner.pan.value = clamp(o.pan ?? 0, -1, 1);
    input.connect(panner);
    node = panner;
  }

  const sendGain = ctx.createGain();
  sendGain.gain.value = o.send ?? 0.35;
  node.connect(engine.dry);
  node.connect(sendGain);
  sendGain.connect(engine.reverbSend);

  return {
    input,
    dispose() {
      try { input.disconnect(); sendGain.disconnect(); node.disconnect(); }
      catch { /* already gone */ }
    },
  };
}

/**
 * Render a Karplus–Strong string into an AudioBuffer.
 *
 * @param {AudioContext} ctx
 * @param {number} midi
 * @param {{decay?: number, damping?: number, seconds?: number, pick?: number, tone?: number}} o
 * @returns {AudioBuffer}
 */
function renderPluck(ctx, midi, o = {}) {
  const decay = o.decay ?? 0.996;
  const damping = o.damping ?? 0.5;
  const seconds = o.seconds ?? 3.0;
  const pick = o.pick ?? 0.22;
  const rate = ctx.sampleRate;
  const key = `${midi}|${decay}|${damping}|${seconds}|${pick}`;
  const cached = pluckCache.get(key);
  if (cached && cached.sampleRate === rate) return cached;

  const freq = mtof(midi);
  const N = Math.max(2, Math.round(rate / freq));
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(1, len, rate);
  const out = buf.getChannelData(0);

  // Excitation: filtered noise, comb-notched by pick position.
  const line = new Float32Array(N);
  let prev = 0;
  for (let i = 0; i < N; i++) {
    const n = Math.random() * 2 - 1;
    prev = prev + (n - prev) * 0.55;              // soften the burst
    line[i] = prev;
  }
  const pickOffset = Math.max(1, Math.round(N * pick));
  for (let i = N - 1; i >= pickOffset; i--) line[i] -= line[i - pickOffset] * 0.6;

  // Normalise the excitation so every pitch starts at the same loudness.
  let peak = 1e-6;
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(line[i]));
  for (let i = 0; i < N; i++) line[i] /= peak;

  let idx = 0;
  let last = 0;
  // Slight inharmonicity keeps it from sounding sterile.
  const dc = 0.5 - damping * 0.15;
  for (let i = 0; i < len; i++) {
    const cur = line[idx];
    const filtered = cur * dc + last * (1 - dc);
    last = filtered;
    line[idx] = filtered * decay;
    out[i] = cur;
    idx = (idx + 1) % N;
  }

  // Fade the tail so looped buffers never click.
  const fade = Math.min(len, Math.floor(rate * 0.06));
  for (let i = 0; i < fade; i++) out[len - 1 - i] *= i / fade;

  pluckCache.set(key, buf);
  return buf;
}

/**
 * @typedef {object} NoteOpts
 * @property {number} midi
 * @property {number} time   Absolute AudioContext time.
 * @property {number} dur    Seconds.
 * @property {number} [vel]  0..1
 * @property {number} [pan]  -1..1
 * @property {number} [send] Reverb send 0..1
 * @property {number} [detune] Cents.
 */

/**
 * Every voice shares this signature.
 * @typedef {(engine: import('./engine.js').AudioEngine, note: NoteOpts) => void} Voice
 */

/* ============================================================================
   Bowed strings — the backbone of the catalogue.
   ========================================================================== */

/** @type {Voice} */
export function strings(engine, n) {
  const ctx = engine.ctx;
  const t = n.time;
  const vel = n.vel ?? 0.7;
  const dur = Math.max(0.14, n.dur);
  const freq = mtof(n.midi);

  const chain = outputChain(engine, { pan: n.pan ?? 0, send: n.send ?? 0.5, gain: 0 });
  const g = chain.input.gain;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.9;
  const cutoff = clamp(freq * 6 + 320, 400, 7200);
  filter.frequency.setValueAtTime(cutoff * 0.45, t);
  filter.frequency.linearRampToValueAtTime(cutoff, t + Math.min(0.42, dur * 0.6));
  filter.connect(chain.input);

  // Three detuned saws + a sine reinforcement of the fundamental.
  const detunes = [-7, 5, 0];
  /** @type {OscillatorNode[]} */
  const oscs = [];
  for (let i = 0; i < detunes.length; i++) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    o.detune.value = detunes[i] + (n.detune ?? 0);
    const og = ctx.createGain();
    og.gain.value = i === 2 ? 0.5 : 0.34;
    o.connect(og); og.connect(filter);
    oscs.push(o);
  }
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = freq;
  const subG = ctx.createGain();
  subG.gain.value = 0.28;
  sub.connect(subG); subG.connect(chain.input);
  oscs.push(sub);

  // Vibrato that eases in, as a player would.
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 4.9 + (n.midi % 3) * 0.2;
  const lfoGain = ctx.createGain();
  lfoGain.gain.setValueAtTime(0, t);
  lfoGain.gain.linearRampToValueAtTime(5.5, t + Math.min(0.7, dur * 0.8));
  lfo.connect(lfoGain);
  for (const o of oscs) lfoGain.connect(o.detune);

  // Bow noise: a whisper of filtered noise under the attack.
  const bow = ctx.createBufferSource();
  bow.buffer = getNoise(ctx);
  bow.loop = true;
  const bowFilter = ctx.createBiquadFilter();
  bowFilter.type = 'bandpass';
  bowFilter.frequency.value = clamp(freq * 3, 600, 5000);
  bowFilter.Q.value = 1.2;
  const bowGain = ctx.createGain();
  bowGain.gain.setValueAtTime(0, t);
  bowGain.gain.linearRampToValueAtTime(vel * 0.05, t + 0.04);
  bowGain.gain.exponentialRampToValueAtTime(0.0005, t + Math.min(0.5, dur));
  bow.connect(bowFilter); bowFilter.connect(bowGain); bowGain.connect(chain.input);

  const attack = clamp(dur * 0.28, 0.06, 0.22);
  const release = clamp(dur * 0.5, 0.18, 0.85);
  const peak = vel * 0.32;
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(peak, t + attack);
  g.linearRampToValueAtTime(peak * 0.82, t + Math.max(attack, dur * 0.75));
  g.setTargetAtTime(0, t + dur, release * 0.35);

  const stop = t + dur + release + 0.1;
  for (const o of oscs) { o.start(t); o.stop(stop); }
  lfo.start(t); lfo.stop(stop);
  bow.start(t); bow.stop(stop);
  oscs[0].onended = () => { chain.dispose(); filter.disconnect(); };
}

/* ============================================================================
   Plucked family — harpsichord, harp, pizzicato.
   ========================================================================== */

/**
 * @param {{decay:number, damping:number, seconds:number, pick:number, bright:number, gain:number}} preset
 * @returns {Voice}
 */
function makePlucked(preset) {
  return function plucked(engine, n) {
    const ctx = engine.ctx;
    const t = n.time;
    const vel = n.vel ?? 0.7;
    const buffer = renderPluck(ctx, n.midi, preset);

    const chain = outputChain(engine, { pan: n.pan ?? 0, send: n.send ?? 0.32, gain: 0 });
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = clamp(mtof(n.midi) * preset.bright, 800, 11000);
    filter.Q.value = 0.6;

    const body = ctx.createBiquadFilter();
    body.type = 'peaking';
    body.frequency.value = 320;
    body.Q.value = 1.1;
    body.gain.value = 4;

    src.connect(filter); filter.connect(body); body.connect(chain.input);

    const g = chain.input.gain;
    const level = vel * preset.gain;
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(level, t + 0.004);
    // Damped when the note is released, as a harpsichord jack would.
    const release = Math.min(0.6, Math.max(0.12, n.dur * 0.5));
    g.setTargetAtTime(0, t + n.dur * 0.95, release * 0.3);

    const stop = t + Math.min(buffer.duration, n.dur + release + 0.4);
    src.start(t);
    src.stop(stop);
    src.onended = () => { chain.dispose(); filter.disconnect(); body.disconnect(); };
  };
}

export const harpsichord = makePlucked({ decay: 0.9955, damping: 0.28, seconds: 2.2, pick: 0.14, bright: 9, gain: 0.34 });
export const harp = makePlucked({ decay: 0.9982, damping: 0.62, seconds: 3.6, pick: 0.3, bright: 6, gain: 0.36 });
export const pizzicato = makePlucked({ decay: 0.988, damping: 0.7, seconds: 1.1, pick: 0.4, bright: 4.5, gain: 0.42 });

/* ============================================================================
   Struck / bell family — celeste and glockenspiel, via FM.
   ========================================================================== */

/**
 * @param {{ratio:number, index:number, decay:number, gain:number, partial:number}} preset
 * @returns {Voice}
 */
function makeBell(preset) {
  return function bell(engine, n) {
    const ctx = engine.ctx;
    const t = n.time;
    const vel = n.vel ?? 0.7;
    const freq = mtof(n.midi);

    const chain = outputChain(engine, { pan: n.pan ?? 0, send: n.send ?? 0.5, gain: 0 });

    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = freq;

    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.value = freq * preset.ratio;

    const modGain = ctx.createGain();
    const idx = freq * preset.index * vel;
    modGain.gain.setValueAtTime(idx, t);
    modGain.gain.exponentialRampToValueAtTime(Math.max(1, idx * 0.02), t + preset.decay * 0.6);
    mod.connect(modGain);
    modGain.connect(carrier.frequency);

    // A high inharmonic partial gives the strike its glint.
    const shimmer = ctx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.value = freq * preset.partial;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.setValueAtTime(vel * 0.09, t);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0004, t + preset.decay * 0.35);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(chain.input);

    carrier.connect(chain.input);

    const g = chain.input.gain;
    const decay = Math.max(preset.decay, n.dur);
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(vel * preset.gain, t + 0.006);
    g.exponentialRampToValueAtTime(0.0006, t + decay);

    const stop = t + decay + 0.08;
    carrier.start(t); carrier.stop(stop);
    mod.start(t); mod.stop(stop);
    shimmer.start(t); shimmer.stop(stop);
    carrier.onended = () => { chain.dispose(); modGain.disconnect(); shimmerGain.disconnect(); };
  };
}

export const celeste = makeBell({ ratio: 3.5, index: 1.4, decay: 2.2, gain: 0.3, partial: 5.02 });
export const glockenspiel = makeBell({ ratio: 5.4, index: 2.1, decay: 1.5, gain: 0.24, partial: 8.1 });

/* ============================================================================
   Winds
   ========================================================================== */

/** @type {Voice} */
export function flute(engine, n) {
  const ctx = engine.ctx;
  const t = n.time;
  const vel = n.vel ?? 0.6;
  const dur = Math.max(0.16, n.dur);
  const freq = mtof(n.midi);

  const chain = outputChain(engine, { pan: n.pan ?? 0, send: n.send ?? 0.55, gain: 0 });

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;

  const second = ctx.createOscillator();
  second.type = 'triangle';
  second.frequency.value = freq * 2;
  const secondG = ctx.createGain();
  secondG.gain.value = 0.12;
  second.connect(secondG); secondG.connect(chain.input);

  const breath = ctx.createBufferSource();
  breath.buffer = getNoise(ctx);
  breath.loop = true;
  const breathF = ctx.createBiquadFilter();
  breathF.type = 'bandpass';
  breathF.frequency.value = clamp(freq * 2.2, 500, 6000);
  breathF.Q.value = 0.8;
  const breathG = ctx.createGain();
  breathG.gain.setValueAtTime(vel * 0.14, t);
  breathG.gain.exponentialRampToValueAtTime(vel * 0.02 + 0.0001, t + 0.18);
  breath.connect(breathF); breathF.connect(breathG); breathG.connect(chain.input);

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.4;
  const lfoG = ctx.createGain();
  lfoG.gain.setValueAtTime(0, t);
  lfoG.gain.linearRampToValueAtTime(7, t + Math.min(0.8, dur));
  lfo.connect(lfoG); lfoG.connect(osc.detune);

  osc.connect(chain.input);

  const g = chain.input.gain;
  const attack = clamp(dur * 0.2, 0.04, 0.14);
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(vel * 0.3, t + attack);
  g.setTargetAtTime(0, t + dur, 0.12);

  const stop = t + dur + 0.5;
  osc.start(t); osc.stop(stop);
  second.start(t); second.stop(stop);
  breath.start(t); breath.stop(stop);
  lfo.start(t); lfo.stop(stop);
  osc.onended = () => { chain.dispose(); secondG.disconnect(); breathG.disconnect(); };
}

/** @type {Voice} */
export function choir(engine, n) {
  const ctx = engine.ctx;
  const t = n.time;
  const vel = n.vel ?? 0.5;
  const dur = Math.max(0.5, n.dur);
  const freq = mtof(n.midi);

  const chain = outputChain(engine, { pan: n.pan ?? 0, send: n.send ?? 0.72, gain: 0 });

  // Three formants approximating an "ah" vowel.
  const formants = [[720, 1.0], [1240, 0.5], [2540, 0.22]];
  /** @type {OscillatorNode[]} */
  const oscs = [];
  const source = ctx.createGain();
  source.gain.value = 1;

  for (const d of [-9, 0, 8]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    o.detune.value = d;
    const og = ctx.createGain();
    og.gain.value = 0.3;
    o.connect(og); og.connect(source);
    oscs.push(o);
  }

  for (const [f, amp] of formants) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = 6;
    const gg = ctx.createGain();
    gg.gain.value = amp;
    source.connect(bp); bp.connect(gg); gg.connect(chain.input);
  }

  const g = chain.input.gain;
  const attack = clamp(dur * 0.35, 0.25, 1.2);
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(vel * 0.42, t + attack);
  g.setTargetAtTime(0, t + dur, 0.4);

  const stop = t + dur + 2.0;
  for (const o of oscs) { o.start(t); o.stop(stop); }
  oscs[0].onended = () => { chain.dispose(); source.disconnect(); };
}

/* ============================================================================
   Low strings and percussion
   ========================================================================== */

/** @type {Voice} */
export function contrabass(engine, n) {
  const ctx = engine.ctx;
  const t = n.time;
  const vel = n.vel ?? 0.7;
  const dur = Math.max(0.2, n.dur);
  const freq = mtof(n.midi);

  const chain = outputChain(engine, { pan: n.pan ?? 0, send: n.send ?? 0.28, gain: 0 });

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(clamp(freq * 4, 180, 1400), t);
  filter.Q.value = 1.4;
  filter.connect(chain.input);

  const saw = ctx.createOscillator();
  saw.type = 'sawtooth';
  saw.frequency.value = freq;
  const sawG = ctx.createGain();
  sawG.gain.value = 0.32;
  saw.connect(sawG); sawG.connect(filter);

  const sine = ctx.createOscillator();
  sine.type = 'sine';
  sine.frequency.value = freq;
  const sineG = ctx.createGain();
  sineG.gain.value = 0.62;
  sine.connect(sineG); sineG.connect(filter);

  const g = chain.input.gain;
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(vel * 0.4, t + clamp(dur * 0.12, 0.02, 0.1));
  g.setTargetAtTime(0, t + dur * 0.9, 0.14);

  const stop = t + dur + 0.6;
  saw.start(t); saw.stop(stop);
  sine.start(t); sine.stop(stop);
  saw.onended = () => { chain.dispose(); filter.disconnect(); };
}

/** @type {Voice} */
export function timpani(engine, n) {
  const ctx = engine.ctx;
  const t = n.time;
  const vel = n.vel ?? 0.8;
  const freq = mtof(n.midi);

  const chain = outputChain(engine, { pan: n.pan ?? 0, send: n.send ?? 0.6, gain: 0 });

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq * 1.9, t);
  osc.frequency.exponentialRampToValueAtTime(freq, t + 0.07);
  osc.connect(chain.input);

  const partial = ctx.createOscillator();
  partial.type = 'sine';
  partial.frequency.setValueAtTime(freq * 2.7, t);
  const partialG = ctx.createGain();
  partialG.gain.setValueAtTime(vel * 0.12, t);
  partialG.gain.exponentialRampToValueAtTime(0.0005, t + 0.28);
  partial.connect(partialG); partialG.connect(chain.input);

  const hit = ctx.createBufferSource();
  hit.buffer = getNoise(ctx);
  const hitF = ctx.createBiquadFilter();
  hitF.type = 'bandpass';
  hitF.frequency.value = 220;
  hitF.Q.value = 0.7;
  const hitG = ctx.createGain();
  hitG.gain.setValueAtTime(vel * 0.5, t);
  hitG.gain.exponentialRampToValueAtTime(0.0005, t + 0.14);
  hit.connect(hitF); hitF.connect(hitG); hitG.connect(chain.input);

  const decay = Math.max(0.8, Math.min(2.4, n.dur * 1.4));
  const g = chain.input.gain;
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(vel * 0.6, t + 0.008);
  g.exponentialRampToValueAtTime(0.0006, t + decay);

  const stop = t + decay + 0.1;
  osc.start(t); osc.stop(stop);
  partial.start(t); partial.stop(stop);
  hit.start(t); hit.stop(t + 0.3);
  osc.onended = () => { chain.dispose(); partialG.disconnect(); hitG.disconnect(); };
}

/** @type {Voice} */
export function cymbal(engine, n) {
  const ctx = engine.ctx;
  const t = n.time;
  const vel = n.vel ?? 0.5;
  const chain = outputChain(engine, { pan: n.pan ?? 0, send: n.send ?? 0.8, gain: 0 });

  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 5200;
  const peak = ctx.createBiquadFilter();
  peak.type = 'peaking';
  peak.frequency.value = 9000;
  peak.gain.value = 6;
  src.connect(hp); hp.connect(peak); peak.connect(chain.input);

  const decay = Math.max(1.2, n.dur);
  const g = chain.input.gain;
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(vel * 0.18, t + 0.01);
  g.exponentialRampToValueAtTime(0.0004, t + decay);

  src.start(t); src.stop(t + decay + 0.05);
  src.onended = () => { chain.dispose(); hp.disconnect(); peak.disconnect(); };
}

/** @type {Record<string, Voice>} */

/**
 * Piano — the fallback.
 *
 * The instrument proper is a string model in an AudioWorklet (`piano.js`,
 * `piano-worklet.js`), and this is what plays if a browser will not give us
 * one. It is additive: a stack of sine partials with the four things that most
 * distinguish a struck string written into their amplitudes and envelopes.
 *
 * It is a decent impression and it is not the instrument. The difference is
 * that here every one of those four things is *drawn* — an amplitude law, a
 * pair of envelopes, a detune table — where in the string model each is a
 * consequence of the geometry. Additive synthesis has a ceiling below "piano",
 * which is why the other exists.
 *
 * **Inharmonicity.** A piano string is stiff, so its partials are not integer
 * multiples: the nth partial sits at n·f₀·√(1+Bn²). B is tiny in the treble and
 * large in the bass, which is why a low piano note sounds *spread* and a
 * synthesiser's sawtooth never does. This is the single thing most responsible
 * for the difference between "piano" and "machine".
 *
 * **Partials that die at different rates.** The top of the spectrum goes first.
 * A note is bright for a tenth of a second and dark for the rest of its life,
 * so each partial gets its own decay, shorter the higher it is.
 *
 * **Two strings, slightly apart.** Every note above the bass has two or three
 * strings tuned a hair from each other; the beating between them is the shimmer.
 * Detune them by a couple of cents and a dead tone becomes a live one.
 *
 * **The hammer.** A short filtered noise burst at the attack — felt hitting
 * wire, not a click. Brighter the harder the note is struck, which is also why
 * a loud piano note is not merely a quiet one turned up.
 *
 * The damper is the note's end: a fast fade, not a release tail, unless the
 * note is short enough that the string would still be ringing.
 */
function pianoAdditive(engine, n) {
  const ctx = engine.ctx;
  const t = n.time;
  const vel = clamp(n.vel ?? 0.7, 0.02, 1);
  const f0 = mtof(n.midi);

  const chain = outputChain(engine, { pan: n.pan ?? 0, send: n.send ?? 0.42, gain: 1 });

  // Stiffness. B is *largest in the treble* — top strings are short and
  // relatively thick, so their partials stretch hardest. Bass strings are
  // wound precisely to keep B down. (Getting this backwards is what makes a
  // synthesised piano sound like an organ in the bass and a bell on top.)
  // This is also why piano tuning is stretched: the octaves are tuned wide to
  // follow the partials rather than the fundamentals.
  const B = clamp(0.00006 * Math.pow(2, (n.midi - 46) / 13), 0.00003, 0.012);

  // How long the note would ring if nobody lifted the key.
  const ring = clamp(15 * Math.pow(2, (48 - n.midi) / 20), 0.7, 26);
  // Struck harder is not just louder — it is brighter, because the felt
  // compresses, stiffens, and leaves the string sooner.
  const bright = 0.4 + vel * 0.6;

  // The bass needs a great many partials before it stops sounding like a sine.
  const PARTIALS = Math.round(clamp(26 - (n.midi - 33) * 0.34, 5, 22));
  const detune = n.midi < 34 ? 0 : 1.8 + (74 - n.midi) * 0.03;
  const strings = detune > 0 ? [-detune, detune] : [0];

  /** @type {OscillatorNode[]} */
  const oscs = [];
  let last = t + 0.4;

  for (let k = 1; k <= PARTIALS; k++) {
    const f = f0 * k * Math.sqrt(1 + B * k * k);
    if (f > 16500) break;

    // The strike point. The hammer meets the string about an eighth of the way
    // along, so any partial with a node there is barely excited — the 8th and
    // its multiples are hollowed out. That notch is one of the most
    // recognisable things about a piano and costs one line.
    const strike = Math.abs(Math.sin(k * Math.PI * 0.125));
    const shape = 0.08 + 0.92 * strike;

    const amp = (0.7 / Math.pow(k, 1.28)) * Math.pow(bright, k * 0.38) * shape * vel;
    if (amp < 0.0006) continue;

    // Double decay — the single most important thing in the whole voice.
    //
    // A string vibrates in two planes. The vertical one drives the bridge hard
    // and dies fast; the horizontal one is barely coupled and rings on for a
    // very long time. What you hear is the *sum* of two exponentials, not one:
    // a quick fall to about a third, then a long tail. One exponential, however
    // carefully tuned, is always a synthesiser.
    const fast = Math.max(0.09, (ring * 0.1) / Math.pow(k, 0.85));
    const slow = Math.max(0.3, ring / Math.pow(k, 0.55));
    const end = t + slow;
    if (end > last) last = end;

    for (const cents of strings) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      // Each string of a unison is tuned a hair off its neighbour, and the
      // offset grows with the partial — which is where the shimmer comes from.
      if (cents) osc.detune.setValueAtTime(cents * (0.6 + k * 0.45), t);
      // A struck string's pitch falls slightly as the blow relaxes.
      osc.frequency.exponentialRampToValueAtTime(f * 0.9988, t + 0.1);

      const a = amp / strings.length;

      const gFast = ctx.createGain();
      gFast.gain.setValueAtTime(0, t);
      gFast.gain.linearRampToValueAtTime(a * 0.68, t + 0.003);
      gFast.gain.exponentialRampToValueAtTime(0.00006, t + fast);

      const gSlow = ctx.createGain();
      gSlow.gain.setValueAtTime(0, t);
      gSlow.gain.linearRampToValueAtTime(a * 0.32, t + 0.006);
      gSlow.gain.exponentialRampToValueAtTime(0.00006, end);

      osc.connect(gFast); gFast.connect(chain.input);
      osc.connect(gSlow); gSlow.connect(chain.input);
      oscs.push(osc);
    }
  }

  // Felt on wire.
  const hammer = ctx.createBufferSource();
  hammer.buffer = getNoise(ctx);
  const hf = ctx.createBiquadFilter();
  hf.type = 'bandpass';
  hf.frequency.setValueAtTime(clamp(f0 * 5.5, 400, 5200), t);
  hf.Q.value = 0.6;
  const hg = ctx.createGain();
  hg.gain.setValueAtTime(0, t);
  hg.gain.linearRampToValueAtTime(vel * 0.06 * bright, t + 0.002);
  hg.gain.exponentialRampToValueAtTime(0.00008, t + 0.06);
  hammer.connect(hf); hf.connect(hg); hg.connect(chain.input);

  // The damper.
  //
  // A key released stops the string; a key held lets it ring on. So a note
  // shorter than its own ring is cut, and a note longer than it is simply
  // allowed to die of its own accord — which is why a pedalled piano and a
  // staccato one are different instruments.
  const held = Math.max(0.08, n.dur ?? 0.5);
  const off = t + held;
  const stop = Math.min(off + 0.2, last + 0.1);
  const cg = chain.input.gain;
  cg.setValueAtTime(1, t);
  if (off < last) {
    cg.setValueAtTime(1, off);
    cg.exponentialRampToValueAtTime(0.0004, off + 0.18);
  }

  for (const o of oscs) { o.start(t); o.stop(stop + 0.05); }
  hammer.start(t); hammer.stop(t + 0.12);
  if (oscs.length) oscs[0].onended = () => { chain.dispose(); hg.disconnect(); };
  else { hammer.onended = () => { chain.dispose(); hg.disconnect(); }; }
}

/**
 * Piano.
 *
 * Unlike every other voice here, this one builds no graph. The instrument is
 * already standing — one worklet, one soundboard, for the whole performance —
 * and a note is a message to it: which key, how hard, when, and for how long.
 * Which is all a note ever was.
 *
 * @type {Voice}
 */
export function piano(engine, n) {
  const bus = pianoBus(engine);
  if (!bus) { pianoAdditive(engine, n); return; }
  bus.port.postMessage({
    type: 'note',
    midi: n.midi,
    vel: clamp(n.vel ?? 0.7, 0.02, 1),
    dur: Math.max(0.05, n.dur ?? 0.5),
    pan: clamp(n.pan ?? 0, -1, 1),
    time: n.time,
  });
}

export const VOICES = {
  piano, grand, strings, harpsichord, harp, pizzicato, celeste, glockenspiel,
  flute, choir, contrabass, timpani, cymbal,
};

/** Human-facing instrument labels for the UI. */
export const INSTRUMENT_LABEL = Object.freeze({
  piano: 'PIANO',
  grand: 'GRAND PIANO',
  strings: 'STRINGS',
  harpsichord: 'HARPSICHORD',
  harp: 'HARP',
  pizzicato: 'PIZZICATO',
  celeste: 'CELESTA',
  glockenspiel: 'GLOCKENSPIEL',
  flute: 'FLUTE',
  choir: 'CHORUS',
  contrabass: 'CONTRABASS',
  timpani: 'TIMPANI',
  cymbal: 'CYMBAL',
});

/**
 * Warm the pluck cache for a pitch range so the first bars never stutter.
 * @param {AudioContext} ctx
 * @param {number} lo @param {number} hi
 */
export function prewarm(ctx, lo = 40, hi = 88) {
  for (let m = lo; m <= hi; m += 1) {
    renderPluck(ctx, m, { decay: 0.9955, damping: 0.28, seconds: 2.2, pick: 0.14 });
  }
}
