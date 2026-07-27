/**
 * MAESTRO — the soundboard.
 *
 * A string on its own is almost inaudible; it is far too thin to move any air.
 * What you hear when someone plays a piano is a large sheet of spruce being
 * shaken by the bridge, and the sheet has opinions. Below about 1 kHz it has
 * separate, countable modes — a few dozen of them — and each one colours
 * whatever is asked of it. Above that they crowd together into a broad,
 * slightly bright plateau.
 *
 * So: a bank of resonators in parallel with the direct signal. This is the
 * single largest step from "a string model" to "an instrument", and it costs
 * a dozen biquads for the whole keyboard, not per note, because there is one
 * soundboard and every string is on it.
 *
 * The modes below are not measured from any particular instrument — that would
 * be sampling by other means. They are a plausible spruce plate: a low family
 * around the main bass resonance, a tenor cluster, and a thinning tail. Their
 * spacing is deliberately irregular, because a regular one sounds like a
 * comb filter, which is what it would be.
 *
 * @module audio/soundboard
 */

/**
 * frequency (Hz), Q, relative level.
 *
 * The low modes are broad and strong — that is the body of the instrument. The
 * high ones are narrow and faint, and mostly there to keep the top from
 * sounding like it was recorded in a different room from the bottom.
 */
const MODES = [
  [58, 4.0, 1.00], [83, 5.5, 0.78], [116, 6.0, 0.92], [147, 7.0, 0.62],
  [196, 7.5, 0.70], [263, 8.0, 0.52], [341, 9.0, 0.44], [438, 9.5, 0.36],
  [571, 10.0, 0.30], [742, 11.0, 0.24], [968, 11.0, 0.18], [1310, 12.0, 0.14],
  [1780, 12.0, 0.10], [2540, 12.0, 0.07],
];

/**
 * Put a soundboard under a signal.
 *
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} input   the bridge — i.e. the strings, summed
 * @param {{body?: number, direct?: number}} [o]
 * @returns {AudioNode} what to connect onward
 */
export function soundboard(ctx, input, o = {}) {
  const out = ctx.createGain();
  out.gain.value = 1;

  // The strings reach the ear both ways: straight off the bridge, and through
  // the plate. Neither alone is the instrument.
  const direct = ctx.createGain();
  direct.gain.value = o.direct ?? 0.62;
  input.connect(direct);
  direct.connect(out);

  const body = ctx.createGain();
  body.gain.value = (o.body ?? 1.15) / Math.sqrt(MODES.length);
  body.connect(out);

  for (const [freq, q, level] of MODES) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = level;
    input.connect(bp);
    bp.connect(g);
    g.connect(body);
  }

  // Nothing below the lowest string is anything but the model's own drift, and
  // a piano has no output at 20 Hz whatever the physics of a delay line says.
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 26;
  hp.Q.value = 0.7;
  out.connect(hp);

  return hp;
}
