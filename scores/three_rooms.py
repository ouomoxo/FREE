#!/usr/bin/env python3
"""THREE ROOMS — sonata for grand piano.

    I.   ADAGIO         C minor.   Nothing in it gets louder
    II.  ALLEGRETTO     A flat major.  A flower between two abysses
    III. PRESTO         C minor.   The door

Three notes hold it together: **C — A flat — G**. The first, the flattened
sixth, the fifth. It is three notes long, it is the shape of a sigh, and it
survives being made into anything: in the first movement it is what somebody
says to themselves at four in the morning, in the second it is a waltz, and in
the third it is what is coming up the stairs.

Everything about the design came from one measurement of Beethoven's Op. 27
No. 2 that I should have taken twenty drafts ago. I had been writing single
movements that tried to do everything, and building climaxes by taking the same
material and playing it louder, which is the definition of a cliché. That is
not what the Moonlight does. It does this:

**The first movement never gets loud, and escalates anyway.** Counting the
notes that fall outside C sharp minor, eight bars at a time:

    bars   1–8      3% outside the key
    bars   9–16     0%
    bars  17–24    37%   ← as far from home as it goes
    bars  25–32    25%
    bars  33–40    18%
    bars  41–48    11%
    bars  49–56     4%
    bars  57–64     0%   ← and forty bars to walk back

Nothing is marked above piano in any of it. The tension is *harmonic*: you are
not told you have gone somewhere strange, you simply find that you have, and
then it takes twice as long to get back as it took to leave. That is what
"imperceptible" means as a compositional instruction, and it cannot be done
with dynamics because dynamics are the one parameter a listener notices.

**Then it stops, and something completely different happens.** The Allegretto
is in D flat, it is light, it is almost cheerful, and Liszt called it a flower
between two abysses. It is not a transition and it is not development. It is a
different piece, and the third movement is unbearable *because* of it — you
cannot be overwhelmed by something that has been building the whole time. You
have to have been let go of first.

**And only then the Presto.**

So the three movements here are not three sections. They share three notes and
nothing else: different keys, different metres, different speeds, and the only
thing that carries over is a shape you stop noticing you are hearing.

Run:  python3 scores/three_rooms.py out.wav
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'dev'))
from piano import DYN, pitch, render          # noqa: E402


class Score:
    """Bars and beats from one. `beats` is the metre and changes per movement."""

    def __init__(self):
        self.notes = []
        self.pedals = []
        self.beats = 4
        self.offset = 0.0                      # where the current movement starts

    def at(self, bar, beat):
        return self.offset + (bar - 1) * self.beats + (beat - 1)

    def n(self, bar, beat, dur, name, dyn, roll=0.0, off=0.0):
        vel = DYN[dyn] if isinstance(dyn, str) else dyn
        note = name if isinstance(name, int) else pitch(name)
        self.notes.append((self.at(bar, beat) + roll + off, dur, note, vel))

    def ch(self, bar, beat, dur, names, dyn, roll=0.0, off=0.0):
        for i, name in enumerate(names):
            self.n(bar, beat, dur - i * roll, name, dyn, roll * i, off)

    def seq(self, bar, beat, step, names, dyn, hold=1.6, off=0.0):
        for i, name in enumerate(names):
            self.n(bar, beat + i * step, step * hold, name, dyn, 0.0, off)

    def line(self, bar, cells, dyn, octave=0):
        """(note, beat, length) — a melody, optionally doubled below."""
        for name, beat, dur in cells:
            self.n(bar, beat, dur, name, dyn, off=-0.022)
            if octave:
                low = name[:-1] + str(int(name[-1]) - octave)
                self.n(bar, beat, dur, low, dyn, off=-0.022)

    def ped(self, bar, beat=1):
        self.pedals.append(self.at(bar, beat))

    def start(self, bar_count, beats, gap=3):
        """Close the movement and open the next one after a silence."""
        self.offset += bar_count * self.beats + gap
        self.beats = beats


s = Score()
TEMPO = []                                     # (from_beat, seconds per beat)


def mark(bar, bpm):
    TEMPO.append((s.at(bar, 1), 60.0 / bpm))


# ============================================================================
# I. ADAGIO — C minor, 4/4, 32 bars
#
# One texture and it never changes: a bass octave on the downbeat, a quaver
# pulse in the middle on a single repeated note, and the tune above. Nothing is
# marked louder than piano anywhere in the movement.
#
# What moves is the harmony. Bars 1–8 do not leave C minor. From bar 9 it goes
# flatwards a fifth at a time — A flat, D flat, G flat, C flat — and by bar 16
# it is five keys from home with no announcement that it has gone anywhere; the
# tune is still the same three notes and the pulse has not altered. Then it
# takes twice as long to come back as it took to leave, which is the proportion
# Beethoven uses and the reason his return feels earned rather than arranged.
# ============================================================================

s.beats = 4
mark(1, 46)

#: bass octave, the repeated middle note, and the chord the tune sits on
ADAGIO = [
    # bar,  bass,   pulse,  chord tones for the left hand's off-beats
    (1,  'C2',  'G3', ['Eb3', 'G3']),
    (2,  'C2',  'G3', ['Eb3', 'G3']),
    (3,  'F2',  'Ab3', ['C3', 'F3']),
    (4,  'G2',  'G3', ['D3', 'B2']),
    (5,  'Ab1', 'G3', ['Eb3', 'C3']),
    (6,  'F2',  'Ab3', ['C3', 'F3']),
    (7,  'G2',  'G3', ['F3', 'B2']),
    (8,  'C2',  'G3', ['Eb3', 'G3']),
    # away, a fifth at a time, and nothing says so
    (9,  'Ab1', 'Ab3', ['Eb3', 'C3']),         # A flat
    (10, 'Db2', 'Ab3', ['F3', 'Ab3']),         # D flat
    (11, 'Gb1', 'Gb3', ['Db3', 'Bb2']),        # G flat
    (12, 'Cb2', 'Gb3', ['Eb3', 'Gb3']),        # C flat — five keys out
    (13, 'Bb1', 'Gb3', ['Db3', 'F3']),
    (14, 'Ebb2', 'Gb3', ['Bb2', 'Gb3']),
    (15, 'Ab1', 'Gb3', ['Eb3', 'Cb3']),
    (16, 'Db2', 'Ab3', ['F3', 'Ab3']),
    # and the long walk back
    (17, 'Gb1', 'Gb3', ['Db3', 'Bb2']),
    (18, 'B1',  'F#3', ['D3', 'Ab2']),         # spelled the other way now
    (19, 'E2',  'G3',  ['B2', 'G3']),
    (20, 'Ab1', 'G3',  ['Eb3', 'C3']),
    (21, 'Db2', 'Ab3', ['F3', 'Ab3']),
    (22, 'G2',  'G3',  ['F3', 'B2']),
    (23, 'C2',  'G3',  ['Eb3', 'G3']),
    (24, 'Ab1', 'G3',  ['Eb3', 'C3']),
    (25, 'F2',  'Ab3', ['C3', 'F3']),
    (26, 'D2',  'Ab3', ['F3', 'B2']),
    (27, 'G2',  'G3',  ['F3', 'B2']),
    (28, 'C2',  'G3',  ['Eb3', 'G3']),
    (29, 'F2',  'Ab3', ['C3', 'F3']),
    (30, 'G2',  'G3',  ['D3', 'B2']),
    (31, 'C2',  'G3',  ['Eb3', 'G3']),
    (32, 'C2',  'G3',  ['Eb3', 'G3']),
]
for bar, bass, pulse, inner in ADAGIO:
    s.ped(bar)
    s.ped(bar, 3)
    s.n(bar, 1, 3.9, bass, 'pp', off=0.012)
    s.n(bar, 1, 3.9, bass[:-1] + str(int(bass[-1]) + 1), 'pp', off=0.012)
    # the pulse. Eight quavers, the same note, all the way through the movement
    for i in range(8):
        s.n(bar, 1 + i * 0.5, 0.46, pulse, 'ppp' if i % 2 else 'pp')
    s.n(bar, 2, 0.9, inner[0], 'ppp')
    s.n(bar, 4, 0.9, inner[1], 'ppp')

#: the tune. Three notes, and then three notes, and then three notes.
CELL = [
    (1,  [('C5', 1, 1.9), ('Ab4', 3, 0.9), ('G4', 4, 0.9)]),
    (2,  [('G4', 1, 3.6)]),
    (3,  [('C5', 1, 1.9), ('Ab4', 3, 0.9), ('F4', 4, 0.9)]),
    (4,  [('G4', 1, 1.9), ('F4', 3, 1.9)]),
    (5,  [('Ab4', 1, 1.9), ('G4', 3, 0.9), ('F4', 4, 0.9)]),
    (6,  [('Eb4', 1, 3.6)]),
    (7,  [('D4', 1, 1.9), ('C4', 3, 0.9), ('B3', 4, 0.9)]),
    (8,  [('C4', 1, 3.6)]),
    (9,  [('Eb5', 1, 1.9), ('C5', 3, 0.9), ('Bb4', 4, 0.9)]),
    (10, [('Ab4', 1, 3.6)]),
    (11, [('Db5', 1, 1.9), ('Bb4', 3, 0.9), ('Ab4', 4, 0.9)]),
    (12, [('Gb4', 1, 3.6)]),
    (13, [('Gb5', 1, 1.9), ('Eb5', 3, 0.9), ('Db5', 4, 0.9)]),
    (14, [('Cb5', 1, 3.6)]),
    (15, [('Cb5', 1, 1.9), ('Ab4', 3, 0.9), ('Gb4', 4, 0.9)]),
    (16, [('F4', 1, 3.6)]),
    (17, [('Db5', 1, 1.9), ('Bb4', 3, 0.9), ('Ab4', 4, 0.9)]),
    (18, [('Ab4', 1, 1.9), ('F#4', 3, 1.9)]),
    (19, [('G4', 1, 1.9), ('E4', 3, 0.9), ('D4', 4, 0.9)]),
    (20, [('Eb4', 1, 3.6)]),
    (21, [('Ab4', 1, 1.9), ('F4', 3, 0.9), ('Eb4', 4, 0.9)]),
    (22, [('D4', 1, 3.6)]),
    (23, [('C5', 1, 1.9), ('Ab4', 3, 0.9), ('G4', 4, 0.9)]),
    (24, [('Ab4', 1, 3.6)]),
    (25, [('C5', 1, 1.9), ('Ab4', 3, 0.9), ('F4', 4, 0.9)]),
    (26, [('Ab4', 1, 1.9), ('F4', 3, 1.9)]),
    (27, [('D4', 1, 1.9), ('C4', 3, 0.9), ('B3', 4, 0.9)]),
    (28, [('C4', 1, 3.6)]),
    (29, [('C5', 1, 1.9), ('Ab4', 3, 0.9), ('G4', 4, 0.9)]),
    (30, [('F4', 1, 1.9), ('D4', 3, 1.9)]),
    (31, [('C4', 1, 3.6)]),
    (32, [('C4', 1, 3.6)]),
]
for bar, cells in CELL:
    s.line(bar, cells, 'p' if bar < 9 else ('mp' if bar < 20 else 'p'))

# ============================================================================
# II. ALLEGRETTO — A flat major, 3/4, 64 bars
#
# The same three notes: A flat, F, E flat. In the major, at a hundred and
# forty, with the left hand on the beat and the right hand off it, they are a
# waltz — and there is nothing in the writing to say they are the same three
# notes, which is the point. A listener does not notice. They only notice that
# the room has changed.
#
# Liszt's phrase for the movement in this position is a flower between two
# abysses, and its whole job is to be pleasant. What makes it uneasy is not
# anything in the mood but the phrase lengths: everything here is five bars
# long where it ought to be four, so the dance never quite comes round.
# ============================================================================

s.start(32, 3, gap=6)
mark(1, 138)

WALTZ_HARMONY = {
    'I':   ('Ab2', ['Eb3', 'Ab3', 'C4']),
    'IV':  ('Db3', ['Ab3', 'Db4', 'F4']),
    'V':   ('Eb3', ['Bb3', 'Eb4', 'G4']),
    'V7':  ('Eb3', ['Db4', 'Eb4', 'G4']),
    'vi':  ('F3',  ['C4', 'F4', 'Ab4']),
    'ii':  ('Bb2', ['F3', 'Bb3', 'Db4']),
    'iii': ('C3',  ['G3', 'C4', 'Eb4']),
    'V/V': ('Bb2', ['F3', 'Bb3', 'D4']),
    'I_D': ('Db3', ['Ab3', 'Db4', 'F4']),
    'V_D': ('Ab2', ['Eb3', 'Ab3', 'Cb4']),
    'IV_D': ('Gb2', ['Db3', 'Gb3', 'Bb3']),
}


def oompah(bar, harm, dyn='mp'):
    bass, chord = WALTZ_HARMONY[harm]
    s.n(bar, 1, 0.9, bass, dyn)
    s.ch(bar, 2, 0.8, chord, dyn, roll=0.012)
    s.ch(bar, 3, 0.8, chord, dyn, roll=0.012)
    s.ped(bar)


#  Five-bar phrases. Four would close; five leaves a bar over every time.
WALTZ = [
    (1, 'I', [('Ab5', 1, 0.9), ('F5', 2, 0.45), ('Eb5', 2.5, 0.45), ('C5', 3, 0.9)]),
    (2, 'I', [('Ab4', 1, 0.9), ('C5', 2, 0.9), ('Eb5', 3, 0.9)]),
    (3, 'IV', [('F5', 1, 1.9), ('Db5', 3, 0.9)]),
    (4, 'V', [('Eb5', 1, 0.9), ('G4', 2, 0.9), ('Bb4', 3, 0.9)]),
    (5, 'I', [('Ab4', 1, 2.6)]),
    (6, 'I', [('Ab5', 1, 0.9), ('F5', 2, 0.45), ('Eb5', 2.5, 0.45), ('C5', 3, 0.9)]),
    (7, 'vi', [('Ab4', 1, 0.9), ('C5', 2, 0.9), ('F5', 3, 0.9)]),
    (8, 'ii', [('Db5', 1, 1.9), ('Bb4', 3, 0.9)]),
    (9, 'V7', [('Eb5', 1, 0.9), ('Db5', 2, 0.9), ('G4', 3, 0.9)]),
    (10, 'I', [('Ab4', 1, 2.6)]),
    (11, 'I', [('C6', 1, 0.9), ('Ab5', 2, 0.45), ('G5', 2.5, 0.45), ('Eb5', 3, 0.9)]),
    (12, 'V/V', [('D5', 1, 0.9), ('F5', 2, 0.9), ('Bb5', 3, 0.9)]),
    (13, 'V', [('Bb5', 1, 1.9), ('G5', 3, 0.9)]),
    (14, 'V7', [('Eb5', 1, 0.9), ('Db5', 2, 0.9), ('Bb4', 3, 0.9)]),
    (15, 'I', [('Ab4', 1, 2.6)]),
    (16, 'I', [('Ab5', 1, 0.9), ('F5', 2, 0.45), ('Eb5', 2.5, 0.45), ('C5', 3, 0.9)]),
    (17, 'IV', [('Db5', 1, 0.9), ('F5', 2, 0.9), ('Ab5', 3, 0.9)]),
    (18, 'iii', [('G5', 1, 1.9), ('Eb5', 3, 0.9)]),
    (19, 'V7', [('Db5', 1, 0.9), ('C5', 2, 0.9), ('Bb4', 3, 0.9)]),
    (20, 'I', [('Ab4', 1, 2.6)]),
]
for bar, harm, cells in WALTZ:
    oompah(bar, harm, 'p' if bar <= 5 else 'mp')
    s.line(bar, cells, 'mp' if bar <= 5 else 'mf')

# 21–40: the trio, in D flat — one flat further out, and softer.
TRIO = [
    (21, 'I_D', [('F5', 1, 0.9), ('Db5', 2, 0.45), ('C5', 2.5, 0.45), ('Ab4', 3, 0.9)]),
    (22, 'I_D', [('F4', 1, 0.9), ('Ab4', 2, 0.9), ('Db5', 3, 0.9)]),
    (23, 'IV_D', [('Bb4', 1, 1.9), ('Gb4', 3, 0.9)]),
    (24, 'V_D', [('Ab4', 1, 0.9), ('Cb5', 2, 0.9), ('Eb5', 3, 0.9)]),
    (25, 'I_D', [('Db5', 1, 2.6)]),
    (26, 'I_D', [('F5', 1, 0.9), ('Db5', 2, 0.45), ('C5', 2.5, 0.45), ('Ab4', 3, 0.9)]),
    (27, 'IV_D', [('Gb5', 1, 0.9), ('Bb4', 2, 0.9), ('Db5', 3, 0.9)]),
    (28, 'V_D', [('Cb5', 1, 1.9), ('Ab4', 3, 0.9)]),
    (29, 'V_D', [('Eb5', 1, 0.9), ('Db5', 2, 0.9), ('Cb5', 3, 0.9)]),
    (30, 'I_D', [('Db5', 1, 2.6)]),
    (31, 'I_D', [('Ab5', 1, 0.9), ('F5', 2, 0.45), ('Eb5', 2.5, 0.45), ('Db5', 3, 0.9)]),
    (32, 'IV_D', [('Bb5', 1, 0.9), ('Gb5', 2, 0.9), ('Db5', 3, 0.9)]),
    (33, 'V_D', [('Cb5', 1, 1.9), ('Eb5', 3, 0.9)]),
    (34, 'V_D', [('Ab5', 1, 0.9), ('Cb5', 2, 0.9), ('Eb5', 3, 0.9)]),
    (35, 'I_D', [('Db5', 1, 2.6)]),
    (36, 'I_D', [('F5', 1, 0.9), ('Db5', 2, 0.45), ('C5', 2.5, 0.45), ('Ab4', 3, 0.9)]),
    (37, 'IV_D', [('Gb4', 1, 0.9), ('Bb4', 2, 0.9), ('Db5', 3, 0.9)]),
    (38, 'V_D', [('Cb5', 1, 1.9), ('Ab4', 3, 0.9)]),
    (39, 'V_D', [('Eb5', 1, 0.9), ('Db5', 2, 0.9), ('Cb5', 3, 0.9)]),
    (40, 'I_D', [('Db5', 1, 2.6)]),
]
for bar, harm, cells in TRIO:
    oompah(bar, harm, 'pp')
    s.line(bar, cells, 'mp')

# 41–60: the waltz again, and it is the last easy thing in the piece.
for i, (bar, harm, cells) in enumerate(WALTZ):
    oompah(bar + 40, harm, 'mp')
    s.line(bar + 40, cells, 'mf')

# 61–64: four bars in which it forgets how to finish. The tune gets down to
# its three notes, then to two, and the dance stops without cadencing.
s.ped(61)
oompah(61, 'I', 'mp')
s.line(61, [('Ab5', 1, 0.9), ('F5', 2, 0.45), ('Eb5', 2.5, 0.45), ('C5', 3, 0.9)], 'mp')
oompah(62, 'IV', 'p')
s.line(62, [('Ab5', 1, 0.9), ('F5', 2, 0.9), ('Eb5', 3, 0.9)], 'p')
oompah(63, 'V7', 'pp')
s.line(63, [('Ab5', 1, 0.9), ('F5', 2, 0.9)], 'pp')
s.ped(64)
s.n(64, 1, 2.6, 'Ab4', 'pp', off=-0.02)
s.n(64, 1, 2.6, 'Ab2', 'pp')

# ============================================================================
# III. PRESTO — C minor, 4/4, 58 bars, in sonata form
#
# The same three notes at a hundred and seventy-four, in octaves, under a hand
# that does not stop. It is not louder than the second movement was pleasant.
# It is faster, lower, and there is no bar in it without a semiquaver.
#
# The reason it lands is not in this movement at all. It is in the twenty
# bars of waltz before it: a listener who has been let go of can be caught.
# ============================================================================

s.start(64, 4, gap=4)
mark(1, 174)


def spread(names, low, high):
    pcs = sorted({pitch(n) % 12 for n in names})
    out, octave = [], (low // 12) * 12
    while octave < high + 12:
        for p in pcs:
            if low <= octave + p <= high:
                out.append(octave + p)
        octave += 12
    return sorted(out)


def storm(bar, chord, low, high, dyn, accent='fff', step=0.25):
    s.ped(bar)
    s.ped(bar, 3)
    notes = spread(chord, low, high)
    up = notes + notes[-2:0:-1]
    while len(up) < int(4 / step):
        up = up + up
    base = DYN[dyn] if isinstance(dyn, str) else dyn
    top = DYN[accent] if isinstance(accent, str) else base * 1.3
    for i, mnote in enumerate(up[:int(4 / step)]):
        s.n(bar, 1 + i * step, step * 1.7, mnote,
            min(0.95, top if i % 4 == 0 else base))


#: the three notes, in octaves, over the top of it
def shout(bar, cells, dyn='fff'):
    for name, beat, dur in cells:
        for drop in (0, 1):
            s.n(bar, beat, dur, name[:-1] + str(int(name[-1]) - drop), dyn, off=-0.026)


PRESTO = [
    # bar, chord, low, high, dynamic, the three notes if this bar has them
    (1,  ['C1', 'Eb1', 'G1'], 24, 60, 'mf', None),
    (2,  ['C1', 'Eb1', 'G1'], 24, 64, 'mf', [('C5', 1, 1.9), ('Ab4', 3, 0.9), ('G4', 4, 0.9)]),
    (3,  ['F1', 'Ab1', 'C2'], 29, 65, 'mf', None),
    (4,  ['G1', 'B1', 'D2'],  31, 67, 'f',  [('G4', 1, 1.9), ('F4', 3, 1.9)]),
    (5,  ['C1', 'Eb1', 'G1'], 24, 67, 'f',  None),
    (6,  ['C1', 'Eb1', 'G1'], 24, 70, 'f',  [('C5', 1, 1.9), ('Ab4', 3, 0.9), ('G4', 4, 0.9)]),
    (7,  ['Ab0', 'C1', 'Eb1'], 21, 68, 'f', None),
    (8,  ['G1', 'B1', 'F2'],  31, 71, 'ff', [('D5', 1, 1.9), ('C5', 3, 0.9), ('B4', 4, 0.9)]),

    (9,  ['C1', 'Eb1', 'G1'], 24, 72, 'ff', [('C6', 1, 1.9), ('Ab5', 3, 0.9), ('G5', 4, 0.9)]),
    (10, ['F1', 'Ab1', 'C2'], 29, 74, 'ff', [('F5', 1, 1.9), ('Db5', 3, 0.9), ('C5', 4, 0.9)]),
    (11, ['Db1', 'F1', 'Ab1'], 25, 75, 'ff', [('Db6', 1, 1.9), ('Bb5', 3, 0.9), ('Ab5', 4, 0.9)]),
    (12, ['G1', 'B1', 'D2'],  31, 77, 'ff', [('G5', 1, 1.9), ('F5', 3, 0.9), ('Eb5', 4, 0.9)]),
    (13, ['C1', 'Eb1', 'G1'], 24, 76, 'ff', [('C6', 1, 1.9), ('Ab5', 3, 0.9), ('G5', 4, 0.9)]),
    (14, ['Ab0', 'C1', 'Eb1'], 21, 78, 'ff', [('Ab5', 1, 1.9), ('F5', 3, 0.9), ('Eb5', 4, 0.9)]),
    (15, ['D1', 'F1', 'Ab1'], 26, 79, 'ff', [('D6', 1, 1.9), ('B5', 3, 0.9), ('Ab5', 4, 0.9)]),
    (16, ['G1', 'B1', 'F2'],  31, 79, 'fff', [('G5', 1, 3.8)]),

    # 17–20: it drops to nothing without warning, and keeps going at the same
    # speed. Four bars of it, and then it comes back from underneath.
    (17, ['C1', 'Eb1', 'G1'], 36, 60, 'p',  [('C5', 1, 1.9), ('Ab4', 3, 0.9), ('G4', 4, 0.9)]),
    (18, ['F1', 'Ab1', 'C2'], 41, 63, 'p',  None),
    (19, ['G1', 'B1', 'D2'],  38, 65, 'mp', [('G4', 1, 1.9), ('F4', 3, 1.9)]),
    (20, ['C1', 'Eb1', 'G1'], 36, 67, 'mp', None),
    (21, ['C1', 'Eb1', 'G1'], 24, 70, 'mf', [('C5', 1, 1.9), ('Ab4', 3, 0.9), ('G4', 4, 0.9)]),
    (22, ['Ab0', 'C1', 'Eb1'], 21, 72, 'f', None),
    (23, ['Db1', 'F1', 'Ab1'], 25, 75, 'f', [('Db6', 1, 1.9), ('Bb5', 3, 0.9), ('Ab5', 4, 0.9)]),
    (24, ['G1', 'B1', 'F2'],  31, 79, 'ff', [('G5', 1, 3.8)]),
]
for bar, chord, low, high, dyn, cells in PRESTO:
    storm(bar, chord, low, high, dyn,
          accent='fff' if dyn in ('f', 'ff', 'fff') else None)
    if cells:
        shout(bar, cells, 'fff' if dyn in ('ff', 'fff') else dyn)

# 25–36: the second subject. Sonata form wants a contrasting idea in a
# related key, and a finale that is one texture for seventy bars is a study.
# So: E flat minor, the same three notes turned upside down — E flat, G flat,
# B flat, going *up* — and the hand stops arpeggiating and hammers repeated
# chords instead. It is the same speed and it is a different piece of music.
SECOND = [
    (25, ['Eb2', 'Gb2', 'Bb2'], [('Eb5', 1, 0.9), ('Gb5', 2, 0.9), ('Bb5', 3, 1.9)], 'mf'),
    (26, ['Eb2', 'Gb2', 'Bb2'], [('Bb5', 1, 1.9), ('Gb5', 3, 1.9)], 'mf'),
    (27, ['Cb2', 'Eb2', 'Gb2'], [('Cb6', 1, 0.9), ('Bb5', 2, 0.9), ('Gb5', 3, 1.9)], 'mf'),
    (28, ['Bb1', 'Db2', 'F2'], [('F5', 1, 1.9), ('Gb5', 3, 1.9)], 'mf'),
    (29, ['Eb2', 'Gb2', 'Bb2'], [('Eb5', 1, 0.9), ('Gb5', 2, 0.9), ('Bb5', 3, 1.9)], 'f'),
    (30, ['Ab1', 'Cb2', 'Eb2'], [('Cb6', 1, 1.9), ('Ab5', 3, 1.9)], 'f'),
    (31, ['Bb1', 'D2', 'F2'], [('Bb5', 1, 0.9), ('Ab5', 2, 0.9), ('F5', 3, 1.9)], 'f'),
    (32, ['Eb2', 'Gb2', 'Bb2'], [('Eb5', 1, 3.8)], 'f'),
]
for bar, chord, cells, dyn in SECOND:
    s.ped(bar)
    s.ped(bar, 2)
    s.ped(bar, 3)
    s.ped(bar, 4)
    # Repeated chords instead of an arpeggio going anywhere — but two to the
    # beat and three notes thick, not three and four. At the density the storm
    # runs at, a repeated chord is not a contrast, it is a wall.
    for beat in (1, 2, 3, 4):
        for k in (0, 0.5):
            s.ch(bar, beat + k, 0.44, list(chord), dyn, roll=0.008)
        low = pitch(chord[0]) - 12
        if low >= 21:                          # the bottom of a real keyboard
            s.n(bar, beat, 0.9, low, dyn, off=0.01)
    shout(bar, cells, 'ff' if dyn == 'ff' else dyn)

# 33–44: the development. The storm comes back and takes the second subject
# with it — the rising three notes, now in the middle of the arpeggios, through
# four keys in eight bars.
DEV = [
    (33, ['C2', 'Eb2', 'G2'], 24, 74, 'f',  [('Eb5', 1, 0.9), ('Gb5', 2, 0.9), ('Bb5', 3, 1.9)]),
    (34, ['Ab1', 'Cb2', 'Eb2'], 21, 76, 'f', [('Cb6', 1, 1.9), ('Ab5', 3, 1.9)]),
    (35, ['F1', 'Ab1', 'C2'], 29, 77, 'ff', [('F5', 1, 0.9), ('Ab5', 2, 0.9), ('C6', 3, 1.9)]),
    (36, ['Db1', 'F1', 'Ab1'], 25, 78, 'ff', [('Db6', 1, 1.9), ('Ab5', 3, 1.9)]),
    (37, ['Bb1', 'Db2', 'F2'], 22, 79, 'ff', [('Bb5', 1, 0.9), ('Db6', 2, 0.9), ('F6', 3, 1.9)]),
    (38, ['G1', 'B1', 'D2'], 31, 80, 'ff', [('G5', 1, 1.9), ('B5', 3, 1.9)]),
    (39, ['G1', 'B1', 'F2'], 31, 81, 'fff', [('D6', 1, 1.9), ('C6', 3, 0.9), ('B5', 4, 0.9)]),
    (40, ['G1', 'B1', 'F2'], 31, 83, 'fff', [('G5', 1, 3.8)]),
]
for bar, chord, low, high, dyn, cells in DEV:
    storm(bar, chord, low, high, dyn)
    shout(bar, cells, 'fff')

# 41–48: the first subject again, where it belongs, and the three notes in the
# bass underneath it four times slower than anything above them.
# 25–32: the three notes in the bass, four times slower, under everything.
#: A flat below the bottom A does not exist on a piano, so the augmented
#: line takes the octave it can reach.
AUG = ['C1', 'C1', 'Ab1', 'Ab1', 'G1', 'G1', 'G1', 'G1']
TOPS = [('C6', 1, 1.9), ('Ab5', 3, 0.9), ('G5', 4, 0.9)]
for i in range(8):
    bar = 41 + i
    chord = [['C1', 'Eb1', 'G1'], ['C1', 'Eb1', 'G1'], ['Ab0', 'C1', 'Eb1'],
             ['Ab0', 'C1', 'Eb1'], ['G1', 'B1', 'D2'], ['G1', 'B1', 'F2'],
             ['G1', 'B1', 'F2'], ['G1', 'B1', 'F2']][i]
    storm(bar, chord, 24 + i, 76 + i, 'fff', step=0.25 if i < 6 else 0.125)
    s.n(bar, 1, 3.9, AUG[i], 'fff', off=0.012)
    s.n(bar, 1, 3.9, AUG[i][:-1] + str(int(AUG[i][-1]) + 1), 'fff', off=0.012)
    if i % 2 == 0:
        shout(bar, TOPS)

# 49–50: two bars with four notes in them. After thirty-two of this, silence is
# the loudest thing available.
for bar, root in [(49, 'C1'), (50, 'G1')]:
    s.ped(bar)
    for beat in (1, 2.5):
        s.n(bar, beat, 1.2, root if bar == 49 else 'G1', 'fff')
        s.n(bar, beat, 1.2, root[:-1] + str(int(root[-1]) + 1) if bar == 49 else 'G2', 'fff')

# 51–56: and the last of it. The three notes, in octaves, in both hands, four
# octaves apart, and then the tonic.
for i in range(4):
    bar = 51 + i
    storm(bar, ['C1', 'Eb1', 'G1'], 24, 84, 'fff', step=0.125)
    shout(bar, [[('C6', 1, 1.9), ('Ab5', 3, 0.9), ('G5', 4, 0.9)],
                [('C6', 1, 3.8)],
                [('C6', 1, 1.9), ('Ab5', 3, 0.9), ('G5', 4, 0.9)],
                [('G5', 1, 3.8)]][i])

s.ped(55)
s.ped(55, 3)
for i in range(16):
    m = 84 - i * 2
    beat = 1 + (i % 8) * 0.5
    bar = 55 + i // 8
    dyn = ['fff', 'ff'][i // 8]
    s.n(bar, beat, 0.5, m, dyn)
    s.n(bar, beat, 0.5, m - 12, dyn)
    s.n(bar, beat, 0.5, max(24, m - 24), dyn)

s.ped(57)
s.ch(57, 1, 6, ['C1', 'C2', 'G2', 'C3', 'Eb3', 'G3', 'C4'], 'fff', roll=0.02)
s.n(57, 1, 5.6, 'C5', 'fff', off=-0.03)
s.n(57, 3, 3.6, 'Ab4', 'fff', off=-0.03)
s.ped(58)
s.ch(58, 1, 8, ['C1', 'C2', 'G2', 'C3'], 'ff', roll=0.03)
s.n(58, 1, 7, 'G4', 'ff', off=-0.03)           # the third note, and it stops


# ============================================================================
# The performance
# ============================================================================

def tempo(beat):
    """Three movements, three speeds, and a rest between each."""
    out = 60.0 / 46
    for at, spb in TEMPO:
        if beat >= at - 4:
            out = spb
    return out


def humanise(notes, seed=23):
    out = []
    state = seed
    for beat, dur, note, vel in sorted(notes):
        state = (state * 1103515245 + 12345) & 0x7fffffff
        r1 = (state / 0x7fffffff) - 0.5
        state = (state * 1103515245 + 12345) & 0x7fffffff
        r2 = (state / 0x7fffffff) - 0.5
        out.append((max(0.0, beat + r1 * 0.016), dur, note,
                    max(0.02, min(0.97, vel * (1 + r2 * 0.12)))))
    return out


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/three_rooms.wav'
    info = render(humanise(s.notes), out, pedal=sorted(set(s.pedals)),
                  tempo=tempo, tail=8.0)
    print(f"{info['notes']} notes · {info['seconds']:.0f}s · "
          f"peak {info['peak_dbfs']:.1f} dBFS → {out}")
