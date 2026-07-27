/**
 * MAESTRO — the piano, as a string.
 *
 * Every other voice in this project is a shape drawn in sound. This one is an
 * attempt at a machine: a digital waveguide, which is what you get if you take
 * the wave equation for a stiff, lossy string and solve it the cheap way — a
 * delay line for the travelling wave, a filter for everything the string loses
 * on the way round, and an allpass for the fact that a real string is stiff and
 * so its high partials travel faster than its low ones.
 *
 * The point of doing it this way is that almost nothing has to be *drawn*:
 *
 *   · the stretched, inharmonic partials come from the dispersion allpass;
 *   · the top of the spectrum dying first comes from the loop filter;
 *   · the hollowed-out eighth partial comes from where the hammer lands;
 *   · the double decay and the shimmer come from three strings sharing a bridge;
 *   · a hard blow being *brighter* and not merely louder comes from the hammer
 *     pulse getting shorter as the felt compresses.
 *
 * None of those is a curve someone typed in. They are consequences, which is
 * the difference between a model and an impression.
 *
 * This runs in an AudioWorklet because a Web Audio `DelayNode` cannot close a
 * feedback loop shorter than one render quantum — 128 samples, about 344 Hz —
 * and a piano needs loops of twenty samples. In here the loop is closed one
 * sample at a time.
 *
 * One polyphonic node serves the whole instrument. Notes arrive over the port
 * with absolute context times and are started on the exact sample, using the
 * `currentFrame` clock the worklet scope provides.
 *
 * @module audio/piano-worklet
 */

/** Voices sounding at once before the quietest gets stolen. */
const MAX_VOICES = 32;

/** Below this, a released note has stopped being a sound and is collected. */
const TAIL_EPS = 3e-5;

function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

/* ============================================================================
   Design-time arithmetic.

   All of this runs once per pitch, never per sample. It answers one question:
   given a delay line, a loop filter and a cascade of allpasses, where do the
   partials actually land, and what coefficients put them where a piano's are?
   ========================================================================== */

/**
 * Phase delay, in samples, of the one-pole lowpass (1-a)/(1 - a·z⁻¹).
 * @param {number} a @param {number} w rad/sample
 */
function lowpassDelay(a, w) {
  if (w < 1e-9) return a / (1 - a);
  return Math.atan2(a * Math.sin(w), 1 - a * Math.cos(w)) / w;
}

/** Magnitude of the same filter. */
function lowpassMag(a, w) {
  return (1 - a) / Math.sqrt(1 - 2 * a * Math.cos(w) + a * a);
}

/**
 * Phase delay, in samples, of the first-order allpass (c + z⁻¹)/(1 + c·z⁻¹).
 *
 * For c < 0 this falls as frequency rises: high partials come round the loop
 * sooner, so they resonate sharp. That is dispersion, and it is the whole of
 * the piano's inharmonicity.
 *
 * @param {number} c @param {number} w rad/sample
 */
function allpassDelay(c, w) {
  if (w < 1e-9) return (1 - c) / (1 + c);
  const phase = Math.atan2(-Math.sin(w), c + Math.cos(w))
    - Math.atan2(-c * Math.sin(w), 1 + c * Math.cos(w));
  return -phase / w;
}

/**
 * Inharmonicity coefficient B, from the pitch.
 *
 * The nth partial of a stiff string sits at n·f₀·√(1+Bn²). B is at its smallest
 * in the low tenor, where the strings are long, and climbs steeply into the
 * treble, where they are short and comparatively thick — which is why the top
 * two octaves of a piano sound like small bells and why tuners stretch the
 * octaves to follow them. The bass is wound precisely to hold B down; a bass
 * string as stiff as a treble one would be unusable.
 *
 * @param {number} midi
 */
function inharmonicity(midi) {
  return clamp(5e-5 * (1 + Math.pow(10, (midi - 52) / 20)), 3e-5, 0.02);
}

/**
 * How long the note would ring if nobody lifted the key: seconds to -60 dB for
 * the fundamental.
 * @param {number} midi
 */
function ringTime(midi) {
  return clamp(22 * Math.pow(2, (40 - midi) / 13), 0.9, 32);
}

/**
 * Solve ω·D(ω) = 2πk for the kth partial, where D is the total loop delay.
 *
 * A resonance is a frequency whose round trip comes out to a whole number of
 * cycles. Because D falls with frequency, ω·D(ω) still rises monotonically, so
 * a bisection finds each partial exactly.
 *
 * @param {(w:number)=>number} D total loop delay in samples
 * @param {number} k partial number
 * @param {number} w1 rad/sample of the fundamental
 */
function partialOmega(D, k, w1) {
  let lo = w1 * k * 0.9;
  let hi = Math.min(Math.PI * 0.999, w1 * k * 1.8);
  if (hi <= lo) return hi;
  const target = 2 * Math.PI * k;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (mid * D(mid) < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** @type {Map<string, object>} */
const designCache = new Map();

/**
 * Work out every coefficient for one string.
 *
 * @param {number} sr
 * @param {number} freq   Hz, this string's own pitch (unisons differ slightly).
 * @param {number} midi   nominal pitch, for the physical laws
 * @param {{B?: number, ring?: number, dispersion?: boolean}} [o]
 */
function designString(sr, freq, midi, o = {}) {
  const key = `${sr}|${freq.toFixed(4)}|${midi}|${o.B ?? 'x'}|${o.ring ?? 'x'}|${o.dispersion === false}`;
  const hit = designCache.get(key);
  if (hit) return hit;

  const w1 = 2 * Math.PI * freq / sr;
  const period = sr / freq;
  const B = o.dispersion === false ? 0 : (o.B ?? inharmonicity(midi));
  const ring = o.ring ?? ringTime(midi);

  /* --- the loop filter ---------------------------------------------------
     Two decay times fix it: the fundamental's, and a high partial's, which
     must be much shorter. The one-pole's magnitude curve is then the whole
     spectral envelope over time, for one multiply a sample.

     Each trip round the loop takes one period, so a partial decays by |g(ω)|
     every 1/f₀ seconds; T60 = -3 / (f₀·log₁₀|g(ω)|).                        */
  const kHigh = Math.max(2, Math.min(12, Math.floor(sr * 0.42 / freq)));
  const ringHigh = ring * Math.pow(kHigh, -0.85);      // the top goes first
  const gFund = Math.pow(10, -3 / (freq * ring));
  const gHigh = Math.pow(10, -3 / (freq * ringHigh));
  const wantRatio = gHigh / gFund;                     // < 1

  let aLo = 1e-4, aHi = 0.97;
  const wHigh = Math.min(Math.PI * 0.99, w1 * kHigh);
  for (let i = 0; i < 60; i++) {
    const a = (aLo + aHi) / 2;
    const r = lowpassMag(a, wHigh) / lowpassMag(a, w1);
    if (r > wantRatio) aLo = a; else aHi = a;          // more a, more damping
  }
  const a = (aLo + aHi) / 2;
  const loopGain = Math.min(0.99995, gFund / lowpassMag(a, w1));

  /* --- the dispersion cascade -------------------------------------------
     Pick the allpass coefficient that lands the target partial where the
     stiffness law says it belongs. Fewer sections in the treble, where the
     whole delay line is only a couple of dozen samples and the allpasses
     would eat it.                                                          */
  const budget = period - lowpassDelay(a, w1) - 2;
  let sections = B <= 0 ? 0 : clamp(Math.floor(budget / 3), 0, 4);
  const kStar = Math.max(2, Math.min(10, Math.floor(sr * 0.4 / freq)));
  const wantStar = kStar * freq * Math.sqrt(1 + B * kStar * kStar);

  /** Total loop delay for a given dispersion coefficient. */
  const delayFor = (c, eta) => (w) => (
    lowpassDelay(a, w) + sections * allpassDelay(c, w) + allpassDelay(eta, w)
  );

  /**
   * Tune the loop to the fundamental: whatever the filters cost in delay, the
   * line and a fractional allpass make up the rest, so partial 1 lands on f₀.
   */
  function tune(c) {
    const fixed = lowpassDelay(a, w1) + sections * allpassDelay(c, w1);
    let rest = period - fixed;
    if (rest < 1.2) rest = 1.2;
    let N = Math.floor(rest - 0.3);
    let frac = rest - N;
    if (N < 1) { N = 1; frac = Math.max(0.1, rest - 1); }
    // Solve the fractional allpass exactly at ω₁ rather than trusting the
    // low-frequency approximation — at the top of the keyboard ω₁ is not low.
    let lo = -0.98, hi = 0.98;
    for (let i = 0; i < 50; i++) {
      const m = (lo + hi) / 2;
      if (allpassDelay(m, w1) > frac) lo = m; else hi = m;
    }
    return { N, eta: (lo + hi) / 2 };
  }

  let c = 0;
  if (sections > 0) {
    let cLo = -0.86, cHi = 0;                          // more negative, more stretch
    for (let i = 0; i < 40; i++) {
      const mid = (cLo + cHi) / 2;
      const { N, eta } = tune(mid);
      const D = (w) => N + delayFor(mid, eta)(w);
      const f = partialOmega(D, kStar, w1) * sr / (2 * Math.PI);
      if (f < wantStar) cHi = mid; else cLo = mid;
    }
    c = (cLo + cHi) / 2;
  }
  const { N, eta } = tune(c);

  const design = { N, eta, c, sections, a, loopGain, freq, B, ring };
  designCache.set(key, design);
  return design;
}

/* ============================================================================
   One string.
   ========================================================================== */

class Str {
  /**
   * @param {number} sr @param {number} freq @param {number} midi
   * @param {object} [o]
   */
  constructor(sr, freq, midi, o) {
    const d = designString(sr, freq, midi, o);
    this.N = d.N;
    this.buf = new Float32Array(d.N);
    this.idx = 0;
    this.a = d.a;
    this.gain = d.loopGain;
    this.eta = d.eta;
    this.c = d.c;
    this.sections = d.sections;

    this.tap = 0;
    this.y = 0;
    this.lpZ = 0;
    this.fx = 0; this.fy = 0;                         // fractional allpass state
    this.dx = new Float32Array(4);                    // dispersion state
    this.dy = new Float32Array(4);
  }

  /**
   * Take the wave arriving at the bridge round the loop once: read the delay
   * line, bend the high partials sharp, take off what the trip costs. Leaves
   * the result in `y`, ready for the bridge to have its say.
   *
   * @param {number} damp extra loop loss while the damper is on the string
   */
  run(damp) {
    const out = this.tap = this.buf[this.idx];

    // Fractional delay: the part of the period that is not a whole sample.
    const eta = this.eta;
    let y = eta * out + this.fx - eta * this.fy;
    this.fx = out; this.fy = y;

    // Stiffness. Each section bends the high partials a little further sharp.
    const c = this.c;
    for (let i = 0; i < this.sections; i++) {
      const x = y;
      y = c * x + this.dx[i] - c * this.dy[i];
      this.dx[i] = x; this.dy[i] = y;
    }

    // Everything the string loses per round trip, and the top losing it first.
    this.lpZ = (1 - this.a) * y + this.a * this.lpZ;
    this.y = this.lpZ * this.gain * damp;
    return this.y;
  }

  /** Close the loop, with the hammer and the bridge added in. */
  write(inject) {
    this.buf[this.idx] = this.y + inject;
    this.idx = this.idx + 1 === this.N ? 0 : this.idx + 1;
  }
}

/* ============================================================================
   One note: three strings, a hammer, a bridge and a damper.
   ========================================================================== */

class Note {
  /**
   * @param {number} sr
   * @param {{midi:number, vel:number, pan:number, startFrame:number, offFrame:number}} n
   */
  constructor(sr, n) {
    this.vel = clamp(n.vel, 0.02, 1);
    this.pan = clamp(n.pan ?? 0, -1, 1);
    this.startFrame = n.startFrame;
    this.offFrame = n.offFrame;
    this.collectFrame = n.offFrame + Math.round(sr * 0.12);
    this.done = false;
    this.released = false;

    const f0 = mtof(n.midi);

    // Unisons. Three strings above the tenor break, two below it — and never
    // quite in tune with each other, which is where the shimmer comes from and,
    // with the bridge, most of the sustain.
    //
    // The deepest notes have a single wound string, but they get two lines all
    // the same: a string vibrates in two planes at once, and the one that does
    // not push on the bridge is barely damped and rings on long after the one
    // that does. Two lines a fifth of a cent apart is that, and it is the same
    // mechanism as the unison, one string down.
    const spread = n.midi < 32 ? 0.18
      : n.midi < 44 ? 0.62
        : 0.55 + (84 - clamp(n.midi, 44, 84)) * 0.012;
    const cents = n.midi < 44 ? [-spread, spread] : [-spread, 0, spread * 0.92];

    this.strings = cents.map((ct) => new Str(sr, f0 * Math.pow(2, ct / 1200), n.midi));
    this.nStrings = this.strings.length;

    /* --- the hammer ------------------------------------------------------
       A raised cosine, and the harder the blow the narrower it is: felt under
       load compresses, stiffens, and leaves the string sooner, so a fortissimo
       note is brighter as well as louder. This is the whole of the difference
       between a piano and a synthesiser with a velocity-to-volume map.

       Its width is a fraction of the *string*, not a number of milliseconds.
       What travels away from the hammer is the shape of the piece of string it
       displaced, and a hammer covers a few per cent of one; measured in
       milliseconds instead, the pulse is wider than a period in the treble and
       everything above the fundamental disappears. That mistake is what a dull,
       bass-heavy synthesised piano is.                                        */
    const period = sr / f0;
    const width = clamp(0.075 - 0.062 * this.vel, 0.013, 0.08);
    this.pulseLen = clamp(Math.round(width * period), 2, Math.max(2, Math.round(period * 0.25)));

    // Where it lands along the string. A hammer at one eighth cannot excite
    // any partial with a node there, so the 8th, 16th, 24th are hollowed out —
    // one of the most recognisable things about the instrument, and here it is
    // a consequence of a position rather than a notch someone dialled in.
    const strike = n.midi <= 72 ? 0.125 : 0.125 - (n.midi - 72) * 0.0022;
    this.combDelay = Math.max(1, Math.round(2 * strike * period));

    this.pulseAmp = this.vel * 0.9 / Math.sqrt(this.pulseLen);
    this.pulsePos = 0;
    this.combBuf = new Float32Array(this.combDelay);
    this.combIdx = 0;
    this.combLeft = this.combDelay + this.pulseLen + 2;
    // The felt itself, as a corner frequency: soft under a light blow, hard and
    // bright under a heavy one. This is the ceiling on the attack, and unlike
    // the pulse width it is an absolute pitch, because felt is felt wherever it
    // is on the keyboard.
    this.feltZ = 0;
    const corner = clamp(600 + 6200 * Math.pow(this.vel, 1.4), 500, 8000);
    this.feltA = Math.exp(-2 * Math.PI * corner / sr);

    // The bridge: what the strings push against, and through which they hear
    // each other.
    //
    // It yields. Whatever the strings are doing *in common* moves it, and that
    // motion is where their energy goes; whatever they are doing against each
    // other leaves it still and costs them nothing. A hammer strikes all three
    // strings of a unison in phase, so at first they are all pushing the same
    // way and the note decays quickly — and then, because they are not quite in
    // tune, they drift out of step, the bridge stops moving, and what is left
    // rings on for a very long time. That is the double decay. It is not two
    // envelopes added together; it is two strings disagreeing.
    this.bridgeZ = 0;
    this.coupling = 0.016;

    this.damp = 1;
    this.dampTarget = clamp(0.86 + (60 - clamp(n.midi, 21, 96)) * 0.0016, 0.84, 0.94);
    this.dampRate = 1 / Math.max(1, 0.055 * sr);

    // Key bed and damper felt: not music, but their absence is audible.
    this.thump = 0;
    this.thumpZ = 0;

    this.dc1 = 0; this.dc2 = 0;
    this.env = 0;
    // Levelling. A hammer that covers a fixed fraction of the string puts more
    // into a short string than a long one, so the keyboard needs a gentle tilt
    // back the other way to come out even.
    this.level = 1.2 * Math.pow(clamp(this.vel, 0.05, 1), 0.85)
      * Math.pow(261.6 / f0, 0.15);
  }

  /**
   * Fill `frames` samples starting at `from` in the quantum.
   * @param {Float32Array} outL @param {Float32Array} outR
   * @param {number} from @param {number} to @param {number} frame
   */
  render(outL, outR, from, to, frame) {
    const strings = this.strings;
    const nS = this.nStrings;
    const gainL = Math.sqrt((1 - this.pan) * 0.5);
    const gainR = Math.sqrt((1 + this.pan) * 0.5);

    for (let i = from; i < to; i++) {
      const f = frame + i;

      if (f >= this.offFrame && !this.released) this.released = true;
      if (this.released && this.damp > this.dampTarget) {
        this.damp = Math.max(this.dampTarget, this.damp - this.dampRate);
        if (this.thump === 0) {
          this.thump = 0.008 * this.vel;               // the key coming home
        }
      }

      // Hammer, combed by where it struck, softened by the felt.
      let exc = 0;
      if (this.pulsePos < this.pulseLen) {
        const p = this.pulsePos;
        exc = this.pulseAmp * 0.5 * (1 - Math.cos(2 * Math.PI * (p + 1) / (this.pulseLen + 1)));
        this.pulsePos++;
      }
      let drive = 0;
      if (this.combLeft > 0) {
        this.combLeft--;
        const cb = this.combBuf;
        const ci = this.combIdx;
        const delayed = cb[ci];
        cb[ci] = exc;
        this.combIdx = ci + 1 === cb.length ? 0 : ci + 1;
        // Not quite a full cancellation: a real hammer is not a point and a
        // real string is not ideal, so the notch is deep, not bottomless.
        exc -= delayed * 0.88;
        this.feltZ += (exc - this.feltZ) * (1 - this.feltA);
        drive = this.feltZ;
      }

      // The strings go round, and then the bridge takes its cut.
      //
      // The cut is taken from what they are doing *in common*, after the loop
      // filter rather than beside it. That ordering is not a detail: a loss
      // subtracted in parallel with the loop's allpasses arrives with their
      // phase lag and at some frequencies adds instead of subtracting, and the
      // note grows without limit. Taken in series it is a contraction along one
      // direction and the identity everywhere else, which cannot do that.
      let sum = 0, common = 0;
      for (let s = 0; s < nS; s++) {
        const st = strings[s];
        common += st.run(this.damp);
        sum += st.tap;                                 // what arrived at the bridge
      }
      const bridge = this.bridgeZ = 0.72 * (common / nS) + 0.28 * this.bridgeZ;
      const load = this.coupling * bridge;
      for (let s = 0; s < nS; s++) strings[s].write(drive - load);

      let y = sum / nS;

      if (this.thump > 1e-6) {
        this.thumpZ += ((Math.random() * 2 - 1) - this.thumpZ) * 0.06;
        y += this.thumpZ * this.thump;
        this.thump *= 0.9992;
      }

      // A waveguide accumulates DC the way a real string does not.
      const dcIn = y;
      y = dcIn - this.dc1 + 0.9995 * this.dc2;
      this.dc1 = dcIn; this.dc2 = y;

      y *= this.level;
      const mag = y < 0 ? -y : y;
      this.env += (mag - this.env) * 0.002;

      outL[i] += y * gainL;
      outR[i] += y * gainR;
    }

    // A note is over when the damper has had time to land and nothing is left
    // above -90 dB. Anything sooner clips the tail off a real decay.
    if (this.released && frame + to > this.collectFrame && this.env < TAIL_EPS) {
      this.done = true;
    }
  }
}

/* ============================================================================
   The instrument.
   ========================================================================== */

class PianoProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    /** @type {Note[]} */
    this.voices = [];
    // A whole movement can be posted in one go — five thousand notes — so the
    // queue is kept in time order and read from the front. Scanning all of it
    // every quantum would cost more than the synthesis.
    /** @type {object[]} */
    this.pending = [];
    this.head = 0;
    this.dirty = false;
    this.lastTime = -Infinity;

    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'note') {
        if (d.time < this.lastTime) this.dirty = true;
        this.lastTime = d.time;
        this.pending.push(d);
      } else if (d.type === 'ping') {
        // Proof of delivery: a port keeps its order, so a reply to this means
        // every note posted before it is on this thread and will be played.
        this.port.postMessage({ type: 'pong', id: d.id });
      } else if (d.type === 'panic') {
        this.voices.length = 0;
        this.pending.length = 0;
        this.head = 0;
        this.lastTime = -Infinity;
      }
    };
  }

  /**
   * Drop one voice. A released note that has nearly died goes first; if every
   * voice is still held, the oldest does. Never the newest — stealing the note
   * that has just been struck is the one audible mistake.
   */
  #steal() {
    let worst = -1;
    for (let v = 0; v < this.voices.length - 1; v++) {
      const note = this.voices[v];
      if (!note.released) continue;
      if (worst < 0 || note.env < this.voices[worst].env) worst = v;
    }
    this.voices.splice(worst < 0 ? 0 : worst, 1);
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    const L = out[0];
    const R = out.length > 1 ? out[1] : out[0];
    const frames = L.length;
    const frame = currentFrame;
    const end = frame + frames;

    // Notes whose moment has come inside this quantum.
    if (this.dirty) {
      this.pending.sort((x, y) => x.time - y.time);
      this.dirty = false;
    }
    while (this.head < this.pending.length) {
      const n = this.pending[this.head];
      const start = Math.round(n.time * sampleRate);
      if (start >= end) break;
      this.head++;
      this.voices.push(new Note(sampleRate, {
        midi: n.midi, vel: n.vel, pan: n.pan,
        startFrame: Math.max(start, frame),
        offFrame: start + Math.max(1, Math.round(n.dur * sampleRate)),
      }));
      if (this.voices.length > MAX_VOICES) this.#steal();
    }
    if (this.head > 256 && this.head === this.pending.length) {
      this.pending.length = 0;
      this.head = 0;
    }

    if (!this.voices.length) return true;

    for (let v = this.voices.length - 1; v >= 0; v--) {
      const note = this.voices[v];
      const from = note.startFrame > frame ? note.startFrame - frame : 0;
      if (from >= frames) continue;
      note.render(L, R, from, frames, frame);
      if (note.done) this.voices.splice(v, 1);
    }
    return true;
  }
}

registerProcessor('piano-processor', PianoProcessor);
