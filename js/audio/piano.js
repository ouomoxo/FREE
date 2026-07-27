/**
 * MAESTRO — the piano's one node.
 *
 * The string model is polyphonic in a single AudioWorklet rather than a node
 * per note: a movement is a few thousand notes, and a few thousand worklets,
 * each idling until its moment, costs more than the synthesis. It also means
 * the soundboard is built once, under all of them, which is what a soundboard
 * is.
 *
 * Everything here is per AudioContext, because an offline render has its own.
 *
 * @module audio/piano
 */

import { soundboard } from './soundboard.js';

/** @type {WeakMap<BaseAudioContext, boolean>} */
const loaded = new WeakMap();
/** @type {WeakMap<object, {node: AudioWorkletNode, out: AudioNode}>} */
const buses = new WeakMap();

let pingId = 0;

/**
 * Load the processor. Called from the engine's setup, before anything plays;
 * if it fails — no AudioWorklet, a blocked module — the voice falls back to the
 * additive piano and the record still plays.
 *
 * @param {BaseAudioContext} ctx
 * @returns {Promise<boolean>}
 */
export async function loadPiano(ctx) {
  if (loaded.get(ctx)) return true;
  if (!ctx.audioWorklet) return false;
  try {
    await ctx.audioWorklet.addModule(new URL('./piano-worklet.js', import.meta.url));
    loaded.set(ctx, true);
    return true;
  } catch (err) {
    console.warn('[piano] worklet unavailable, falling back', err);
    loaded.set(ctx, false);
    return false;
  }
}

/**
 * The instrument, wired into the engine: strings, soundboard, and the same
 * dry/reverb split every other voice uses.
 *
 * @param {import('./engine.js').AudioEngine} engine
 * @returns {AudioWorkletNode|null} null if the worklet is not available
 */
export function pianoBus(engine) {
  const ctx = engine.ctx;
  if (!ctx || !loaded.get(ctx)) return null;
  const existing = buses.get(engine);
  if (existing) return existing.node;

  const node = new AudioWorkletNode(ctx, 'piano-processor', {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });
  const out = soundboard(ctx, node);

  const send = ctx.createGain();
  send.gain.value = 0.34;
  out.connect(engine.dry);
  out.connect(send);
  send.connect(engine.reverbSend);

  buses.set(engine, { node, out });
  return node;
}

/**
 * Wait until every note posted so far has reached the audio thread.
 *
 * An offline render posts a whole movement and then starts rendering in the
 * same turn, and messages that have not yet crossed to the audio thread are
 * simply not there when the render begins — which is silence, with nothing to
 * show for it. A port keeps its order, so one round trip proves the rest
 * arrived.
 *
 * @param {import('./engine.js').AudioEngine} engine
 * @returns {Promise<void>}
 */
export function pianoFlush(engine) {
  const bus = buses.get(engine);
  if (!bus) return Promise.resolve();
  const id = ++pingId;
  return new Promise((resolve) => {
    const timer = setTimeout(done, 2000);           // never hang a render on this
    function done() {
      clearTimeout(timer);
      bus.node.port.removeEventListener('message', onMessage);
      resolve();
    }
    function onMessage(e) { if (e.data && e.data.type === 'pong' && e.data.id === id) done(); }
    bus.node.port.addEventListener('message', onMessage);
    bus.node.port.start();
    bus.node.port.postMessage({ type: 'ping', id });
  });
}

/** Silence everything, immediately: pending notes and ringing ones. */
export function pianoPanic(engine) {
  const bus = buses.get(engine);
  if (bus) bus.node.port.postMessage({ type: 'panic' });
}
