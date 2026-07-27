/**
 * MAESTRO — the soundboard.
 *
 * A string on its own is almost inaudible; it is far too thin to move any air.
 * What you hear when someone plays a piano is a large sheet of spruce being
 * shaken by the bridge, and the sheet has hundreds of modes. The knock at the
 * front of every note — the part that says *piano* before any pitch has been
 * established — is not the string at all. It is the plate being hit.
 *
 * So the plate is a measured-length impulse response, generated here as a few
 * hundred damped sinusoids: low modes, sparse and long; high modes, dense and
 * short. Convolving the strings with it is the same operation as exciting the
 * strings with it, because linear systems commute — which is the whole trick
 * of commuted synthesis, and the reason one convolver can serve every note on
 * the instrument.
 *
 * A first version of this file used fourteen bandpass filters. Fourteen
 * resonances is not a soundboard; it is an equaliser, and it left the strings
 * sounding like strings.
 *
 * The modes are invented, not measured. Measuring a particular instrument
 * would be sampling by other means, and the point of this project is that
 * nothing here is a recording.
 *
 * @module audio/soundboard
 */

/** Deterministic noise. The instrument should be the same one every time. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Generate the plate's impulse response.
 *
 * @param {BaseAudioContext} ctx
 * @param {{seconds?: number, modes?: number, seed?: number}} [o]
 * @returns {AudioBuffer}
 */
export function soundboardImpulse(ctx, o = {}) {
  const sr = ctx.sampleRate;
  const seconds = o.seconds ?? 0.3;
  const count = o.modes ?? 340;
  const len = Math.floor(sr * seconds);
  const buffer = ctx.createBuffer(2, len, sr);
  const rand = rng(o.seed ?? 0x9e3779b9);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);

    for (let i = 0; i < count; i++) {
      // A thin plate has a *constant* modal density — as many modes between
      // 200 and 300 Hz as between 3000 and 3100 — which is the opposite of a
      // string, and the reason a soundboard colours without adding pitch.
      const f = 50 + 5950 * (i + rand()) / count;
      if (f > sr * 0.45) continue;

      // Every mode is about as sharp as every other: Q in the twenties and
      // thirties, so the ring time falls as 1/f and the whole response is over
      // in a tenth of a second. This is the single number that was wrong the
      // first time — at 0.4 s the plate is a small reverb, and it smeared the
      // attack of every note into a swell.
      const q = 18 + 25 * rand();
      const tau = q / (Math.PI * f);
      // Constant density with 1/f ring times tilts the spectrum down by 3 dB
      // an octave on its own. This puts it back: a soundboard is roughly flat
      // where the music is, and rolls off at both ends because it is a plate
      // of a particular size and not a loudspeaker.
      const amp = Math.pow(f / 150, 0.45) * (0.5 + rand());

      const w = 2 * Math.PI * f / sr;
      const decay = Math.exp(-1 / (tau * sr));
      // Each mode is a resonator rung once, run as a rotating phasor rather
      // than a per-sample Math.sin — three hundred modes over half a second is
      // seven million samples and this is done at start-up.
      const cw = Math.cos(w) * decay;
      const sw = Math.sin(w) * decay;
      const phase = rand() * Math.PI * 2;
      let re = Math.cos(phase) * amp;
      let im = Math.sin(phase) * amp;
      const stop = Math.min(len, Math.ceil(tau * 7 * sr));
      for (let n = 0; n < stop; n++) {
        data[n] += im;
        const nr = re * cw - im * sw;
        im = re * sw + im * cw;
        re = nr;
      }
    }

    // The strike itself: the split-second before any mode has had time to
    // establish, when the bridge is simply moving.
    const click = Math.floor(sr * 0.004);
    for (let n = 0; n < click; n++) {
      data[n] += (rand() * 2 - 1) * 12 * Math.pow(1 - n / click, 2.2);
    }

    // Normalise on energy, not peak: the peak is one sample of the strike and
    // says nothing about how loud the plate is.
    let sum = 0;
    for (let n = 0; n < len; n++) sum += data[n] * data[n];
    const norm = 1 / Math.sqrt(Math.max(1e-12, sum));
    for (let n = 0; n < len; n++) data[n] *= norm;
  }

  return buffer;
}

/**
 * Put a soundboard under a signal.
 *
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} input   the bridge — i.e. the strings, summed
 * @param {{body?: number, direct?: number, seconds?: number}} [o]
 * @returns {AudioNode} what to connect onward
 */
export function soundboard(ctx, input, o = {}) {
  const out = ctx.createGain();
  out.gain.value = 1;

  // The strings reach the ear both ways: straight off the bridge, and through
  // the plate. Neither alone is the instrument — all plate and it is a drum,
  // all bridge and it is a zither.
  const direct = ctx.createGain();
  direct.gain.value = o.direct ?? 0.5;
  input.connect(direct);
  direct.connect(out);

  const convolver = ctx.createConvolver();
  convolver.normalize = false;
  convolver.buffer = soundboardImpulse(ctx, { seconds: o.seconds ?? 0.3 });

  const body = ctx.createGain();
  body.gain.value = o.body ?? 3.2;
  input.connect(convolver);
  convolver.connect(body);
  body.connect(out);

  // Nothing below the lowest string is anything but the model's own drift, and
  // a piano has no output at 20 Hz whatever the physics of a delay line says.
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 28;
  hp.Q.value = 0.7;
  out.connect(hp);

  return hp;
}
