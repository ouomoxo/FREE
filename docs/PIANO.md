# The piano

The instrument is a digital waveguide in an AudioWorklet. This is what it is,
how each part was checked, and what is still not right.

---

## The decision, which stands

The site's premise is that **nothing is a media file** — every note is composed
and synthesised at the moment you press play. That premise is the artwork, and
it rules out sampling.

It also means the piano has to be *calculated*, not stacked. Additive synthesis
— a sine per partial per string, which is what was here before — has a ceiling
well below "piano", and everything that makes a struck string recognisable has
to be drawn onto it by hand. In a waveguide those things are consequences of the
geometry instead:

| what you hear | where it comes from |
| --- | --- |
| stretched, inharmonic partials | a cascade of allpass sections in the loop |
| the top of the spectrum dying first | one one-pole filter in the loop |
| the hollowed-out 8th partial | where the hammer lands, as a comb |
| a hard blow being *brighter*, not just louder | the hammer pulse narrowing with velocity |
| the double decay, and the shimmer | three strings sharing a bridge |
| the body | a bank of resonators under all of them |

Not one of those is an envelope someone typed in.

---

## Where it lives

- `js/audio/piano-worklet.js` — the model. Runs on the audio thread.
- `js/audio/soundboard.js` — the plate: fourteen resonators plus a direct path.
- `js/audio/piano.js` — one node for the whole instrument, per context.
- `js/audio/instruments.js` → `piano()` — posts a note to it, and falls back to
  the old additive voice (`pianoAdditive`) if a browser has no AudioWorklet.
- `dev/note.mjs` — renders single notes and measures them.

One polyphonic node serves the whole performance rather than a node per note: a
movement is a few thousand notes, and a few thousand worklets idling until their
moment cost more than the synthesis. It also means there is one soundboard under
all the strings, which is what a soundboard is.

---

## The model

### Per note

```
2–3 strings (3 above the tenor break, 2 below, and 2 in the deep bass
for the two polarisations of a single wound string), each:

  delay line        the string. Length is whatever is left of SR/f0 after
                    the filters have taken their share of the delay.

  fractional delay  a first-order allpass, solved at ω₁ rather than
                    approximated, so the fundamental is actually in tune.

  dispersion        2–4 first-order allpass sections. Their coefficient is
                    bisected until the target partial lands exactly where
                    n·f₀·√(1+Bn²) says it should. B comes from the pitch.

  loop filter       one-pole lowpass. Its coefficient is bisected from two
                    decay times — the fundamental's and a high partial's —
                    so the whole spectral envelope over time is one multiply.

  loop gain         from the desired ring time, T60 = -3/(f₀·log₁₀|g|).

bridge              the strings' *common* motion, filtered, subtracted from
                    each of them.
```

Every coefficient above is solved numerically at construction, cached per pitch,
and never touched again. The per-sample cost is a handful of multiplies.

### The bridge, and why the ordering matters

The bridge yields to whatever the strings do together, and that yielding is
where their energy goes; whatever they do *against* each other leaves it still
and costs them nothing. A hammer strikes a unison in phase, so at first they all
push the same way and the note falls quickly — then, being slightly out of tune
with one another, they drift out of step, the bridge stops moving, and what is
left rings on. That is the double decay. It is not two envelopes added together.

The loss is taken **after** the loop filter, in series, not in parallel with it.
A loss subtracted beside the loop arrives carrying the allpasses' phase lag, and
at some frequencies a subtraction becomes an addition and the note grows without
limit — which it did, to +293 dBFS, before this was fixed. Taken in series it is
a contraction along one direction and the identity everywhere else, and that
cannot happen.

### The hammer

A raised cosine, narrowing as velocity rises — felt under load compresses,
stiffens and leaves the string sooner — then a one-pole whose corner is the
felt's hardness, in absolute Hz.

**Its width is a fraction of the string, not a number of milliseconds.** What
travels away from a hammer is the shape of the piece of string it displaced, and
a hammer covers a few per cent of one. Specified in milliseconds instead, the
pulse is wider than a whole period in the treble and everything above the
fundamental vanishes: measured, partials 2–6 sat 35 dB under the fundamental,
which is precisely the dull, bass-heavy sound this whole effort was trying to
get away from. As a fraction of the string they sit 5–12 dB under it, which is
a piano.

Then a comb, from the strike point at one eighth: any partial with a node there
is barely excited, so the 8th and its multiples are hollowed out. Not quite to
nothing — a real hammer is not a point.

### The damper

On note-off the loop gain ramps down over ~55 ms to a value that leaves a short
tail, longer in the bass because that is what that ramp does at a lower
frequency, not because anyone asked for it. A note held past its natural ring
simply dies on its own.

---

## What it measures

`node dev/note.mjs` renders single notes and reports what they are doing. This
is the whole point of the tool: the failure mode of every previous attempt was
shipping a movement and asking whether it sounded like a piano, when the
question was always about one note.

Currently, through the soundboard:

```
A1   midi 33 vel 0.80  B 4.9e-5  8th -21 dB  2-6th  -7.5 dB  decay  -18 → -8 dB/s
A2   midi 45 vel 0.80  B 6.9e-5  8th -22 dB  2-6th  -7.9 dB  decay  -32 → -7 dB/s
C#4  midi 61 vel 0.80  B 1.5e-4  8th -19 dB  2-6th -12.1 dB  decay  -62 → -9 dB/s
C#4  midi 61 vel 0.25  B 1.6e-4  8th -26 dB  2-6th -12.2 dB  decay  -59 → -10 dB/s
C#5  midi 73 vel 0.80  B 4.8e-4  8th -14 dB  2-6th  -8.4 dB  decay -107 → -16 dB/s
E6   midi 88 vel 0.80  B 3.7e-3  8th  +2 dB  2-6th  -1.0 dB  decay -120 →  — dB/s
```

Reading that:

- **B** is measured from where the partials actually landed, by walking up the
  series — by the top octave the 8th partial is 132 cents sharp, and any fixed
  search window wide enough to find it would catch its neighbours. The measured
  values track the stiffness law they were designed from, across five octaves.
- **decay** is two least-squares slopes, over the first third of a second and
  over seconds 1.2–3.7. Two clearly different numbers is the double decay.
- **2–6th** is the upper partials against the fundamental — the single number
  that says whether this is a piano or a sine with a hammer on it.
- **8th** is the strike notch, against partials 7 and 9. E6 has none: by the top
  octave the partials are stretched so far that the comb no longer lines up with
  them. That happens on a piano too.
- The velocity pair at C#4 is the one that matters most: struck at 0.25 instead
  of 0.8 it is not merely 24 dB quieter, its attack centroid falls from 2.6 kHz
  to 1.8 kHz. Softer *and* darker, from the felt, not from a filter envelope.

---

## Fixed on the way

- **`still` rendered silent** — and it was never the composer or the voice. The
  score is 490 sane events; the take came out at digital zero because `engine`
  is a module singleton and `init()` is a no-op once the graph exists, so every
  track after the first in a run was scheduling its notes into the *previous*
  track's finished OfflineAudioContext. Nothing threw. `dev/render.mjs` now
  renders each take in a fresh page.
- **`dev/render.mjs` swallowed every voice exception in a bare `catch {}`.** It
  now counts them, groups them by message, and prints them. (It turned out there
  were none, which is exactly the thing the silence was hiding.)
- **Notes posted to a worklet immediately before `startRendering()` are not
  late — they are gone.** The renderer now waits for one round trip through the
  port, which proves everything posted before it arrived.
- The peak check runs *before* the MP3 step, so a missing encoder can no longer
  hide a silent take, and a build of ffmpeg that cannot make an MP3 now leaves
  the WAVs instead of failing the run.

---

## What is still not right

- **No sustain pedal.** The `notturno` and `still` styles write long overlapping
  durations to stand in for one, which works, but a real pedal — dampers off
  every string at once — would also give sympathetic resonance, and that is the
  next real step. The plumbing is there: the strings are already inside one
  processor, so a little of the bus fed into every undamped delay line is a
  short piece of work.
- **No mechanical noise worth the name.** There is a key-bed thump on release
  and nothing else. Damper contact, the knock of the key: all small, all sell
  the realism out of proportion to their level.
- **The top octave is thin.** Above about E6 the delay line is thirty samples,
  the dispersion allpasses want more delay than that to give the stiffness the
  law asks for, and the model runs out of room. It is not wrong; it is short of
  material.
- **Stopping the transport does not silence the piano.** Nor does it silence any
  other voice — everything is scheduled ahead — but the piano at least has a
  `panic` that would do it, sitting unused in `piano.js`.
- **The bridge filter is a guess.** One pole at a fixed coefficient. A real
  bridge has a frequency-dependent admittance, and that is what decides how fast
  the first decay is for each partial.
- **The soundboard's modes are invented.** A plausible spruce plate, not a
  measured one — measuring one would be sampling by other means.
