/**
 * MAESTRO — the grand piano.
 *
 * A real instrument, recorded one note every three semitones and pitched to
 * everything in between. The Salamander Grand Piano, by Alexander Holm, under
 * CC-BY 3.0 — see `assets/piano/LICENCE`.
 *
 * This is the one place in the project where a sound is a recording rather
 * than a calculation, and it is here because the written scores in
 * `js/data/scores/` are pieces rather than generated repertoire: a piece
 * somebody wrote deserves the instrument it was written for. The rest of the
 * catalogue is still synthesised at the moment you press play.
 *
 * Everything interpretive — the pedal, the tempo, the balance between the
 * hands — has already happened in `dev/export.py`, so what arrives here is a
 * note, a moment, a length and a weight, and this module's whole job is to put
 * a string under it.
 *
 * @module audio/grand
 */

import { clamp } from '../core/utils.js';

/** Every third semitone, A0 to C8, which is what was recorded. */
const KEYS = [
  ['A0', 21], ['C1', 24], ['Ds1', 27], ['Fs1', 30], ['A1', 33], ['C2', 36],
  ['Ds2', 39], ['Fs2', 42], ['A2', 45], ['C3', 48], ['Ds3', 51], ['Fs3', 54],
  ['A3', 57], ['C4', 60], ['Ds4', 63], ['Fs4', 66], ['A4', 69], ['C5', 72],
  ['Ds5', 75], ['Fs5', 78], ['A5', 81], ['C6', 84], ['Ds6', 87], ['Fs6', 90],
  ['A6', 93], ['C7', 96], ['Ds7', 99], ['Fs7', 102], ['A7', 105], ['C8', 108],
];

/** @type {WeakMap<BaseAudioContext, Map<number, AudioBuffer>>} */
const banks = new WeakMap();
/** @type {WeakMap<BaseAudioContext, Promise<boolean>>} */
const loading = new WeakMap();

/**
 * Fetch and decode the instrument. Two megabytes, once, and only when a
 * written piece is actually asked for — the generated repertoire never touches
 * this and should not pay for it.
 *
 * @param {BaseAudioContext} ctx
 * @returns {Promise<boolean>}
 */
export function loadGrand(ctx) {
  const already = loading.get(ctx);
  if (already) return already;

  const base = new URL('../../assets/piano/', import.meta.url);
  const bank = new Map();
  banks.set(ctx, bank);

  const job = Promise.all(KEYS.map(async ([name, midi]) => {
    try {
      const res = await fetch(new URL(`${name}.mp3`, base));
      if (!res.ok) throw new Error(`${res.status}`);
      bank.set(midi, await ctx.decodeAudioData(await res.arrayBuffer()));
    } catch (err) {
      console.warn(`[grand] ${name} did not load`, err);
    }
  })).then(() => bank.size > 0);

  loading.set(ctx, job);
  return job;
}

/** Whether the instrument is ready to be played. */
export function grandReady(ctx) {
  const bank = banks.get(ctx);
  return !!bank && bank.size > 0;
}

/**
 * One note.
 *
 * The nearest recorded string is resampled to pitch — never more than a tone
 * and a half either way, which is inside what a piano's own neighbouring notes
 * differ by anyway. A quiet note is also filtered, because a quiet note on a
 * real piano is not a loud one turned down: the felt is softer, it leaves the
 * string sooner, and the tone is darker. One velocity layer cannot know that
 * on its own and has to be told.
 *
 * @type {import('./instruments.js').Voice}
 */
export function grand(engine, n) {
  const ctx = engine.ctx;
  const bank = banks.get(ctx);
  if (!bank || !bank.size) return;

  const midi = Math.round(n.midi);
  let key = 60;
  let best = Infinity;
  for (const m of bank.keys()) {
    const d = Math.abs(m - midi);
    if (d < best) { best = d; key = m; }
  }
  const buffer = bank.get(key);
  if (!buffer) return;

  const vel = clamp(n.vel ?? 0.6, 0.02, 1);
  const t = n.time;
  const rate = Math.pow(2, (midi - key) / 12);

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;

  /** @type {AudioNode} */
  let node = src;
  if (vel < 0.6) {
    const felt = ctx.createBiquadFilter();
    felt.type = 'lowpass';
    felt.frequency.value = 900 + 6000 * vel;
    felt.Q.value = 0.5;
    src.connect(felt);
    node = felt;
  }

  const gain = ctx.createGain();
  gain.gain.value = vel * (vel < 0.6 ? 1.4 : 1);
  node.connect(gain);

  const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
  if (panner) {
    panner.pan.value = clamp(n.pan ?? 0, -1, 1);
    gain.connect(panner);
  }
  const out = panner ?? gain;

  const send = ctx.createGain();
  send.gain.value = n.send ?? 0.16;              // the room, not a hall
  out.connect(engine.dry);
  out.connect(send);
  send.connect(engine.reverbSend);

  // The damper. A strip of felt with mass, and it takes half a second to stop
  // a bass string and a fraction of that in the treble; above the top F# a
  // piano has no dampers at all and those strings ring whatever the foot does.
  const held = Math.max(0.05, n.dur ?? 0.5);
  const release = midi >= 90 ? 0 : 0.08 + 0.55 * Math.max(0, (64 - midi) / 43);
  const available = buffer.duration / rate;
  const stop = Math.min(held + release, available);

  if (release > 0 && stop < available) {
    gain.gain.setValueAtTime(gain.gain.value, t + Math.max(0, stop - release));
    gain.gain.linearRampToValueAtTime(0.0001, t + stop);
  }

  src.start(t);
  src.stop(t + stop + 0.02);
  src.onended = () => {
    try { src.disconnect(); gain.disconnect(); send.disconnect(); out.disconnect(); }
    catch { /* already gone */ }
  };
}
