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


def render(notes, out_path, pedal=None, tempo=None, samples=None,
           lead=0.8, tail=6.0, normalise=-1.0):
    """Play a score.

    notes   iterable of (beat, beats_long, midi, velocity)
    pedal   sorted beats at which the pedal comes up and goes straight back
            down. Everything sounding is damped at those moments and nothing
            else ever is, which is what a pedalled piano does.
    tempo   callable beat → seconds per beat, or a number
    """
    samples = samples if samples is not None else load()
    keys = np.array(sorted(samples))
    pedal = sorted(pedal or [])

    if tempo is None:
        tempo = 60 / 52
    spb = tempo if callable(tempo) else (lambda _b, _v=tempo: _v)

    # Beats to seconds, by walking the tempo map in small steps so that a
    # gradual slowing is actually gradual and not a series of jumps.
    last = max(n[0] + n[1] for n in notes) + 2
    grid = np.arange(0, last + 0.05, 0.05)
    secs = np.concatenate([[0], np.cumsum(np.array([spb(b) for b in grid[:-1]]) * 0.05)])

    def when(beat):
        return float(np.interp(beat, grid, secs))

    pedal_s = [when(b) for b in pedal] + [1e9]

    def pedal_end(t):
        for p in pedal_s:
            if p > t + 0.06:
                return p
        return 1e9

    total = when(last) + lead + tail
    buf = np.zeros((int(total * SR) + SR, 2), dtype=np.float32)

    for beat, length, note, vel in notes:
        onset = when(beat)
        offset = when(beat + length)

        k = int(keys[np.argmin(np.abs(keys - note))])
        src = samples[k]
        ratio = 2.0 ** ((note - k) / 12.0)

        # It rings until the key is up *or* the pedal comes up, whichever is
        # later. Under the pedal a quaver lasts as long as the harmony does,
        # which is the whole reason the instrument has one.
        ring = max(offset, pedal_end(onset)) - onset + 0.3
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

        env = np.ones(n_out, dtype=np.float32)
        rel = min(int(0.3 * SR), n_out)
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
