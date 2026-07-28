#!/usr/bin/env python3
"""A piano to write for.

Salamander Grand Piano — a real instrument, recorded one note every three
semitones (Alexander Holm, CC-BY 3.0) — resampled to pitch, pedalled, and
balanced. Everything a score in this repository needs in order to be heard.

The samples are not in the repository. Fetch them once:

    mkdir -p /tmp/salamander && cd /tmp/salamander
    for n in A0 C1 Ds1 Fs1 A1 C2 Ds2 Fs2 A2 C3 Ds3 Fs3 A3 C4 Ds4 Fs4 A4 \\
             C5 Ds5 Fs5 A5 C6 Ds6 Fs6 A6 C7 Ds7 Fs7 A7 C8; do
      curl -sO "https://tonejs.github.io/audio/salamander/$n.mp3"
      ffmpeg -y -loglevel error -i "$n.mp3" -ar 44100 -ac 2 "$n.wav"
    done

A score hands over three things: notes, pedal changes, and a tempo. Nothing
here decides anything musical — it only plays what it is given.
"""
import glob
import os
import wave

import numpy as np
from scipy.signal import lfilter

SR = 44100

STEP = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}

#: What a dynamic marking is worth. A piano's range is wider than this; these
#: are the levels one player uses in one room, not the instrument's limits.
DYN = {
    'ppp': 0.08, 'pp': 0.14, 'p': 0.22, 'mp': 0.31,
    'mf': 0.42, 'f': 0.56, 'ff': 0.72, 'fff': 0.88,
}


def pitch(name):
    """'F#4' → 66. Middle C is C4."""
    step = STEP[name[0].upper()]
    i = 1
    while i < len(name) and name[i] in '#b':
        step += 1 if name[i] == '#' else -1
        i += 1
    return step + (int(name[i:]) + 1) * 12


def load(directory=None):
    """Load the sample set, keyed by MIDI number."""
    directory = directory or os.environ.get('SALAMANDER', '/tmp/salamander')
    out = {}
    for path in sorted(glob.glob(os.path.join(directory, '*.wav'))):
        stem = os.path.basename(path)[:-4]
        i = 0
        while i < len(stem) and not stem[i].isdigit():
            i += 1
        key = stem[:i].replace('s', '#')
        with wave.open(path) as w:
            x = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2')
        out[pitch(key + stem[i:])] = x.astype(np.float32).reshape(-1, 2) / 32768.0
    if not out:
        raise SystemExit(f'no samples in {directory} — see the note at the top of this file')
    return out


def resolve(notes, pedal=None, tempo=None):
    """Turn a score into what is actually going to sound.

    Beats become seconds through the tempo map, and each note's length becomes
    the length it *rings* — its own value, or until the pedal comes up,
    whichever is later. After this there is no metre and no pedal left in the
    data, only notes with times and durations, which is all a player needs and
    all a browser should have to be told.

    @returns list of (seconds, seconds_long, midi, velocity)
    """
    pedal = sorted(pedal or [])
    if tempo is None:
        tempo = 60 / 52
    spb = tempo if callable(tempo) else (lambda _b, _v=tempo: _v)

    last = max(n[0] + n[1] for n in notes) + 2
    grid = np.arange(0, last + 0.05, 0.05)
    secs = np.concatenate([[0], np.cumsum(np.array([spb(b) for b in grid[:-1]]) * 0.05)])
    when = lambda beat: float(np.interp(beat, grid, secs))  # noqa: E731

    pedal_s = [when(b) for b in pedal] + [1e9]

    def pedal_end(t):
        # Syncopated pedalling: the foot comes up *on* the new harmony and goes
        # straight back down after it has sounded, so the old harmony is cut and
        # the new one is caught. A note struck at the change is never damped by
        # it — it is still under the finger. Liszt thought the discovery of this
        # was the most important thing that ever happened to piano playing.
        for p in pedal_s:
            if p > t + 0.075:
                return p
        return 1e9

    out = []
    for beat, length, note, vel in sorted(notes):
        onset = when(beat)
        ring = (60.0 if note >= 90                 # no dampers up here
                else max(when(beat + length), pedal_end(onset)) - onset + 0.3)
        out.append((onset, ring, int(note), float(vel)))
    return out, when(last)


def render(notes, out_path, pedal=None, tempo=None, samples=None,
           lead=0.8, tail=6.0, normalise=-1.0):
    """Play a score.

    notes   iterable of (beat, beats_long, midi, velocity)
    pedal   beats at which the pedal comes up and goes straight back down
    tempo   callable beat -> seconds per beat, or a number
    """
    samples = samples if samples is not None else load()
    keys = np.array(sorted(samples))
    events, last = resolve(notes, pedal, tempo)

    total = last + lead + tail
    buf = np.zeros((int(total * SR) + SR, 2), dtype=np.float32)

    for onset, ring, note, vel in events:
        k = int(keys[np.argmin(np.abs(keys - note))])
        src = samples[k]
        ratio = 2.0 ** ((note - k) / 12.0)

        n_out = int(min(ring, len(src) / ratio / SR) * SR)
        start = int((onset + lead) * SR)
        n_out = min(n_out, len(buf) - start)
        if n_out < 64:
            continue

        idx = np.arange(n_out) * ratio
        i0 = idx.astype(np.int64)
        frac = (idx - i0).astype(np.float32)[:, None]
        i1 = np.minimum(i0 + 1, len(src) - 1)
        seg = src[i0] * (1 - frac) + src[i1] * frac

        # A quiet note is not a loud one turned down — the felt is softer and
        # the tone is darker. One velocity layer cannot know that on its own.
        if vel < 0.6:
            a = float(np.exp(-2 * np.pi * (900 + 6000 * vel) / SR))
            seg = lfilter([1 - a], [1, -a], seg, axis=0).astype(np.float32) * 1.4

        # The damper. It is a strip of felt with mass, and it takes time to
        # stop a string — a long time in the bass, where the string is heavy
        # and the felt is wide. Cutting every note off in the same tenth of a
        # second is the sound of a sampler, not of a piano.
        #
        # And above the top F# there are no dampers at all. Those strings ring
        # whatever the pedal does, which is why the top of the instrument
        # sounds like it is in a different, larger room.
        env = np.ones(n_out, dtype=np.float32)
        rel = min(int((0.08 + 0.55 * max(0.0, (64 - note) / 43)) * SR), n_out)
        env[n_out - rel:] = np.linspace(1, 0, rel, dtype=np.float32) ** 1.6
        att = min(int(0.002 * SR), n_out)
        env[:att] = np.linspace(0, 1, att, dtype=np.float32)

        buf[start:start + n_out] += seg * (env * vel)[:, None]

    peak = float(np.max(np.abs(buf)))
    buf *= (10 ** (normalise / 20)) / max(peak, 1e-6)

    with wave.open(out_path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(buf, -1, 1) * 32767).astype('<i2').tobytes())

    return {'notes': len(notes), 'seconds': total, 'peak_dbfs': 20 * np.log10(peak)}
