# The piano

A handover. Everything a fresh session needs to build the piano properly, and
an honest account of what is wrong with the one that is there now.

---

## The decision

The site's premise is that **nothing is a media file** — every note is composed
and synthesised at the moment you press play. That premise is the artwork, and
it rules out sampling.

It also means the piano has to be *calculated*, not stacked. The path chosen is
**a digital waveguide model in an AudioWorklet**. Not additive synthesis, which
is what is in the repo today and which has a ceiling well below "piano".

---

## What is wrong with the current voice

`js/audio/instruments.js → piano()` sums sine `OscillatorNode`s, one per
partial per string. It is 1970s additive synthesis. Three specific, measured
faults, on top of the approach itself:

1. **The upper partials are crushed.** The amplitude law is
   `0.7/k^1.28 × bright^(k·0.38)`. At velocity 0.4 the tenth partial lands at
   `0.4^3.8 ≈ 0.02` of an already small number. What is left is fundamental,
   which is why it reads as dull and bass-heavy. A piano needs strong 2nd–6th
   partials or it is not a piano.
2. **There is no body.** Roughly half of what anyone recognises as "piano" is
   the soundboard — dozens of coupled resonances. There is none here. The hall
   reverb is a room, not an instrument.
3. **The hammer is inaudible.** The attack noise is at `vel × 0.06`. Without
   the knock there is no key being struck, only a tone appearing.

Fixing all three inside additive synthesis still would not get there. Hence the
worklet.

---

## The model to build

`js/audio/piano-worklet.js`, registered as `piano-processor`, one
`AudioWorkletNode` per sounding note (or one polyphonic node with a voice
allocator — start with one node per note, it is simpler and the GC cost is
acceptable at this polyphony).

### Per note

```
3 strings (2 below the tenor, 1 in the bass), each:

  delay line          length = SR / f0, fractional part via a first-order
                      allpass interpolator. This is the string.

  loop filter         one-pole lowpass, y[n] = (1-a)x[n] + a·y[n-1].
                      `a` rises with pitch. This is why the top of the
                      spectrum dies first — for free, no per-partial envelope.

  dispersion          cascade of 2–4 first-order allpass sections in the loop.
                      Their coefficient sets how far the partials stretch, i.e.
                      the inharmonicity B — for free, no √(1+Bn²) anywhere.

  loss                overall loop gain < 1, from the desired ring time.

bridge coupling       sum the three strings through a shared one-pole "bridge"
                      filter and feed a small fraction back into each. This is
                      where the double decay and the shimmer come from — again
                      structurally, not scripted.
```

### Excitation

A raised-cosine pulse whose **width shortens as velocity rises** — that is the
felt compressing and stiffening — lowpassed, then injected at the strike point.
Injecting at a position rather than at the end gives the comb that hollows out
the 8th partial and its multiples. The notch is then a consequence of where the
hammer hits, which is what it is in a real piano.

### Damper

On note-off, ramp the loop gain down over 80–200 ms, longer in the bass. A key
held past the natural ring time simply lets the string die on its own.

### Shared output

- **Soundboard**: a bank of 8–12 resonant biquads on the summed piano bus, or a
  short generated body impulse response. This is the single biggest step from
  "string model" to "instrument".
- **Sympathetic resonance**: when the pedal is down, feed a little of the bus
  into the delay lines of undamped strings.
- **Mechanical noise**: key bed thump on release, damper contact. Small, and it
  sells the realism out of proportion to its level.

### Why not native nodes

Web Audio's `DelayNode` cannot do a sample-accurate feedback loop — feedback is
quantised to the 128-sample render quantum, so delays shorter than that are
unrepresentable. That is exactly why `makePlucked` in `instruments.js` renders
each pitch offline into an `AudioBuffer` instead. A worklet processes sample by
sample and has no such limit.

---

## Order of work, and how to verify each step

Do **not** compose anything until a single note sounds right. The failure mode
of this whole effort so far has been shipping a piece and asking whether it
sounds like a piano, when the question was always about one note.

1. **One string, no coupling.** Delay + loop filter + noise burst. Render one
   note to a WAV with `dev/render.mjs`. It should already sound like a plucked
   string. Listen.
2. **Add dispersion.** The same note should now sound stiff and slightly
   bell-like in the treble. Measure the partial frequencies with an FFT and
   check they stretch.
3. **Add the hammer** (raised cosine, velocity-dependent width, strike point).
   Compare a soft and a hard strike: the hard one must be *brighter*, not just
   louder.
4. **Add the three strings and the bridge.** The envelope should now show the
   double decay — a fast fall then a long tail. This is checkable numerically:
   take the RMS envelope and fit two exponentials.
5. **Add the soundboard.** This is where it stops sounding like a model.
6. Only then wire it into `VOICES` and re-render `moonlight-1`.

---

## Open bugs to fix on the way

- **`still` renders silent.** `moonlight-2` comes out at −180 dBFS — literal
  digital zero — even though its composed events are sane (MIDI 37–95, velocity
  0.35–0.97). The composer is not at fault; something in the voice throws for
  every note and `dev/render.mjs` swallows it in a bare `catch {}`. **First
  step: count and report those exceptions instead of discarding them.** The
  leading suspect is `osc.stop(stop + 0.05)` in `piano()`, where a long note on
  a short-ringing high pitch can compute a stop time earlier than its start.
- `dev/render.mjs` now refuses to ship a take whose peak is under −50 dBFS.
  Keep that. It caught this bug when nothing else did.

---

## Two styles are already waiting for it

`notturno` and `still` in `js/audio/composer.js` are written for one player and
carry `solo: true`, which makes `orchestrate()` return them untouched. They are
the Moonlight and the Sakamoto shapes respectively — a triplet figure held for
the whole movement, and four wide tones with more rest than note. Both are
currently played on the additive piano and both are waiting on this work.

The record is `ONE FIGURE, HELD` (`moonlight-1`..`4`).
