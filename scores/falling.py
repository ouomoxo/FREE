#!/usr/bin/env python3
"""THE SAME FOUR NOTES, FALLING — for piano, in F sharp minor.

Four notes going down — F#, E, D, C# — are the oldest way western music has of
saying that something is over. Purcell put them under Dido, Bach under the
Crucifixus, and everyone since has known what they mean without being told.
This piece has nothing else in it. Everything is those four notes: sung, buried
in the bass as a ground, stacked into octaves, and finally hammered.

The shape is not a curve up to a climax. It is:

    I    ALONE          one line, and bare fifths under it
    II   THE GROUND     the four notes go into the bass and stay there
    III  THE CLIMB      it rises, and gets to the dominant, and is refused
    IV   HOLLOW         almost nothing. The tune can only manage two notes
                        at a time now, and each attempt starts lower
    V    THE CLIMAX     the real one, arrived at from silence
    VI   AFTER          the opening again, in the wrong register, unfinished

The failure in III is the point of the piece. A climax that works the first
time is a piece about effort. This is a piece about the second attempt, which
is louder because it has nothing left to lose, and which does not fix anything:
the last bar is the tonic as low as the instrument goes with a G natural — the
flattened second, the one note that does not belong — left ringing over it,
unresolved, because it does not resolve.

Run:  python3 scores/falling.py out.wav
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'dev'))
from piano import DYN, pitch, render          # noqa: E402

BEATS = 4                                     # 4/4 throughout


class Score:
    """Somewhere to write it down. Bars and beats count from one."""

    def __init__(self):
        self.notes = []
        self.pedals = []

    def at(self, bar, beat):
        return (bar - 1) * BEATS + (beat - 1)

    def n(self, bar, beat, dur, name, dyn, roll=0.0, off=0.0):
        """One note. `roll` and `off` are in beats, for spreading a chord and
        for letting a melody lean very slightly early or late."""
        vel = DYN[dyn] if isinstance(dyn, str) else dyn
        self.notes.append((self.at(bar, beat) + roll + off, dur, pitch(name), vel))

    def ch(self, bar, beat, dur, names, dyn, roll=0.0, off=0.0):
        """A chord. Rolled from the bottom up if `roll` is given — a hand
        cannot put nine notes down at once and should not pretend to."""
        for i, name in enumerate(names):
            self.n(bar, beat, dur - i * roll, name, dyn, roll * i, off)

    def seq(self, bar, beat, dur, names, dyn, off=0.0):
        """One after another, each `dur` long: an arpeggio, a broken octave."""
        for i, name in enumerate(names):
            self.n(bar, beat + i * dur, dur, name, dyn, 0.0, off)

    def ped(self, bar, beat=1):
        """The pedal comes up here and goes straight back down."""
        self.pedals.append(self.at(bar, beat))


s = Score()

# ============================================================================
# I. ALONE (bars 1–12)
#
# One voice, and under it fifths with no third in them — the harmony is not
# yet willing to say whether it is major or minor, though everyone knows.
# ============================================================================

# Held across the two bars each harmony lasts. Restruck every bar they made
# the opening tick like a clock, which is not what being alone sounds like.
FIFTHS = [
    (1, 8, ['F#2', 'C#3']), (3, 8, ['B1', 'F#2']),
    (5, 8, ['D2', 'A2']), (7, 8, ['C#2', 'G#2']),
    (9, 4, ['F#2', 'C#3']), (10, 4, ['D2', 'A2']),
    (11, 4, ['C#2', 'G#2']), (12, 4, ['F#2', 'C#3']),
]
for bar, dur, notes in FIFTHS:
    s.ch(bar, 1, dur, notes, 'pp', roll=0.05)
    s.ped(bar)

# The tune. It goes down, it tries once to go up — bar 5, a sixth, the only
# leap in the whole section — and it comes down again lower than it started.
TUNE = [
    (1, [('F#4', 2), ('E4', 2)]),
    (2, [('D4', 4)]),
    (3, [('D4', 2), ('C#4', 2)]),
    (4, [('B3', 4)]),
    (5, [('A4', 2), ('F#4', 2)]),
    (6, [('E4', 2), ('D4', 2)]),
    (7, [('E#4', 2), ('D#4', 2)]),
    (8, [('C#4', 4)]),
    (9, [('F#4', 2), ('E4', 2)]),
    (10, [('D4', 2), ('C#4', 2)]),
    (11, [('B3', 2), ('A3', 2)]),
    (12, [('F#3', 4)]),
]
for bar, cell in TUNE:
    beat = 1
    for name, dur in cell:
        s.n(bar, beat, dur * 0.98, name, 'p', off=0.02)
        beat += dur

# ============================================================================
# II. THE GROUND (bars 13–28)
#
# The four notes go into the bass, and the space between them fills up with
# the chromatic notes that were always implied: F#, E#, E, D#, D, C#, B, C#.
# A four-bar ground, four times round, never varied. Above it the left hand
# breaks the harmony into quavers and the right hand finally sings.
# ============================================================================

GROUND = [
    ['F#2', 'C#3', 'F#3', 'A3'],        # i
    ['E#2', 'B2', 'C#3', 'G#3'],        # V6/5
    ['E2', 'C#3', 'F#3', 'A3'],         # i7, third inversion
    ['D#2', 'A2', 'B2', 'F#3'],         # V6/5 of the fourth
    ['D2', 'A2', 'D3', 'F#3'],          # VI
    ['C#2', 'G#2', 'C#3', 'E#3'],       # V
    ['B1', 'F#2', 'B2', 'D3'],          # iv
    ['C#2', 'G#2', 'C#3', 'E#3'],       # V
]
for cycle in range(4):
    for half in range(8):
        bar = 13 + cycle * 4 + half // 2
        beat = 1 + (half % 2) * 2
        level = ['p', 'p', 'mp', 'mp'][cycle]
        s.seq(bar, beat, 0.5, GROUND[half], level)
        s.ped(bar, beat)

ARCH = [
    (13, [(None, 2), ('C#5', 2)]),
    (14, [('D5', 2), ('C#5', 2)]),
    (15, [('B4', 2), ('A4', 2)]),
    (16, [('G#4', 4)]),
    (17, [('A4', 2), ('B4', 2)]),
    (18, [('C#5', 4)]),
    (19, [('D5', 2), ('E5', 2)]),
    (20, [('F#5', 4)]),                  # as high as it gets, and it is not high
    (21, [('E5', 2), ('D5', 2)]),
    (22, [('C#5', 4)]),
    (23, [('B4', 2), ('A4', 2)]),
    (24, [('G#4', 2), ('F#4', 2)]),
    (25, [('E5', 2), ('D5', 2)]),
    (26, [('C#5', 4)]),
    (27, [('B4', 2), ('A4', 2)]),
    (28, [('G#4', 4)]),
]
for bar, cell in ARCH:
    beat = 1
    for name, dur in cell:
        if name:
            dyn = 'mf' if bar >= 19 else 'mp'
            s.n(bar, beat, dur * 0.98, name, dyn, off=0.015)
        beat += dur

# ============================================================================
# III. THE CLIMB (bars 29–44)
#
# The four notes in octaves, sequenced up a step at a time, over broken
# octaves that will not stop. It arrives, correctly, on the dominant — and
# then nothing comes. Bar 44 is where the piece breaks: instead of the tonic
# at full force, three notes at the top of the keyboard, as quiet as possible.
# ============================================================================

CLIMB = [
    (29, ['F#1', 'F#2'], [('F#5', 2), ('E5', 2)], 'mp'),
    (30, ['C#1', 'C#2'], [('D5', 2), ('C#5', 2)], 'mp'),
    (31, ['G#1', 'G#2'], [('G#5', 2), ('F#5', 2)], 'mp'),
    (32, ['D1', 'D2'], [('E5', 2), ('D5', 2)], 'mf'),
    (33, ['A1', 'A2'], [('A5', 2), ('G#5', 2)], 'mf'),
    (34, ['E1', 'E2'], [('F#5', 2), ('E5', 2)], 'mf'),
    (35, ['B1', 'B2'], [('B5', 2), ('A5', 2)], 'mf'),
    (36, ['F#1', 'F#2'], [('G#5', 2), ('F#5', 2)], 'f'),
]
for bar, oct_pair, cell, dyn in CLIMB:
    s.seq(bar, 1, 0.5, oct_pair * 4, dyn)
    s.ped(bar)
    s.ped(bar, 3)
    beat = 1
    for name, dur in cell:
        # In octaves — it is not singing any more, it is insisting.
        s.n(bar, beat, dur * 0.96, name, dyn, off=0.01)
        low = name[:-1] + str(int(name[-1]) - 1)
        s.n(bar, beat, dur * 0.96, low, dyn, off=0.01)
        beat += dur

DRIVE = [
    (37, ['B1', 'B2'], [('B5', 1), ('C#6', 1), ('D6', 1), ('E6', 1)], 'mf'),
    (38, ['E1', 'E2'], [('F#6', 2), ('E6', 2)], 'mf'),
    (39, ['A1', 'A2'], [('E6', 2), ('C#6', 2)], 'mf'),
    (40, ['A1', 'A2'], [('A5', 4)], 'f'),
    (41, ['D1', 'D2'], [('D6', 2), ('C#6', 2)], 'f'),
    (42, ['G#1', 'G#2'], [('B5', 2), ('D6', 2)], 'f'),
    (43, ['C#1', 'C#2'], [('G#5', 1), ('A5', 1), ('B5', 1), ('C#6', 1)], 'f'),
]
for bar, oct_pair, cell, dyn in DRIVE:
    s.seq(bar, 1, 0.5, oct_pair * 4, dyn)
    s.ped(bar)
    beat = 1
    for name, dur in cell:
        s.n(bar, beat, dur * 0.96, name, dyn)
        low = name[:-1] + str(int(name[-1]) - 1)
        s.n(bar, beat, dur * 0.96, low, dyn)
        beat += dur

# The refusal.
s.ped(44)
s.ch(44, 1, 4, ['F#5', 'A5', 'C#6'], 'pp', roll=0.06)

# ============================================================================
# IV. HOLLOW (bars 45–54)
#
# It can only manage two notes now, and then it has to stop. Each attempt
# begins a third lower than the last. The bars in between are empty and are
# meant to be: the silence is the same length as the phrase.
# ============================================================================

s.ped(45)
s.ch(45, 1, 8, ['F#1', 'F#2'], 'ppp', roll=0.08)
s.ped(51)
s.ch(51, 1, 8, ['F#1', 'F#2'], 'ppp', roll=0.08)

FRAGMENTS = [
    (45, [('F#6', 2), ('E6', 2)]),
    (47, [('D#6', 2), ('C#6', 2)]),
    (49, [('B5', 2), ('A5', 2)]),
    (51, [('G#5', 2), ('F#5', 2)]),
    (53, [('E5', 4)]),
]
for bar, cell in FRAGMENTS:
    beat = 1
    for name, dur in cell:
        s.n(bar, beat, dur, name, 'ppp', off=0.03)
        beat += dur
    if bar not in (45, 51):
        s.ped(bar)

# ============================================================================
# V. THE CLIMAX (bars 55–76)
#
# The ground comes back underneath, an octave lower than it has ever been,
# and this time nothing stops it. Bars 67–68 are a G major chord, which in
# this key is the flattened second — the Neapolitan, the furthest away a
# chord can be while still meaning something. It is the only consolation the
# piece offers and it is over in two bars.
# ============================================================================

DEEP = [
    (55, [('F#1', 'F#2'), ('E#1', 'E#2')], ['F#3', 'A3', 'C#4'], ['E#3', 'G#3', 'B3'], 'p'),
    (56, [('E1', 'E2'), ('D#1', 'D#2')], ['F#3', 'A3', 'C#4'], ['F#3', 'A3', 'B3'], 'p'),
    (57, [('D1', 'D2'), ('C#1', 'C#2')], ['D3', 'F#3', 'A3'], ['E#3', 'G#3', 'B3'], 'mp'),
    (58, [('B0', 'B1'), ('C#1', 'C#2')], ['D3', 'F#3', 'B3'], ['E#3', 'G#3', 'B3'], 'mp'),
    (59, [('F#1', 'F#2'), ('E#1', 'E#2')], ['F#3', 'A3', 'C#4'], ['E#3', 'G#3', 'B3'], 'mf'),
    (60, [('E1', 'E2'), ('D#1', 'D#2')], ['F#3', 'A3', 'C#4'], ['F#3', 'A3', 'B3'], 'mf'),
    (61, [('D1', 'D2'), ('C#1', 'C#2')], ['D3', 'F#3', 'A3'], ['E#3', 'G#3', 'B3'], 'mf'),
    (62, [('B0', 'B1'), ('C#1', 'C#2')], ['D3', 'F#3', 'B3'], ['E#3', 'G#3', 'B3'], 'f'),
]
for bar, basses, ch1, ch2, dyn in DEEP:
    for i, pair in enumerate(basses):
        s.ch(bar, 1 + i * 2, 2, list(pair), dyn, roll=0.03)
        s.ch(bar, 1 + i * 2, 2, ch1 if i == 0 else ch2, dyn, roll=0.02)
        s.ped(bar, 1 + i * 2)

# The tune returns over it, in octaves, from bar 59.
OVER = [
    (59, [('F#5', 2), ('E5', 2)]),
    (60, [('D5', 2), ('C#5', 2)]),
    (61, [('D5', 2), ('E5', 2)]),
    (62, [('F#5', 4)]),
]
for bar, cell in OVER:
    beat = 1
    for name, dur in cell:
        dyn = 'mf' if bar < 61 else 'f'
        s.n(bar, beat, dur * 0.97, name, dyn, off=0.012)
        s.n(bar, beat, dur * 0.97, name[:-1] + str(int(name[-1]) - 1), dyn, off=0.012)
        beat += dur

# Bars 63–66: the ground doubles in speed and the harmony changes twice a bar.
FAST = [
    (63, ['F#1', 'F#2', 'E#1', 'E#2'], ['F#4', 'A4', 'C#5'], ['E#4', 'G#4', 'B4'], 'f'),
    (64, ['E1', 'E2', 'D#1', 'D#2'], ['F#4', 'A4', 'C#5'], ['F#4', 'A4', 'B4'], 'f'),
    (65, ['D1', 'D2', 'C#1', 'C#2'], ['D4', 'F#4', 'A4'], ['E#4', 'G#4', 'B4'], 'ff'),
    (66, ['B0', 'B1', 'C#1', 'C#2'], ['D4', 'F#4', 'B4'], ['E#4', 'G#4', 'B4'], 'ff'),
]
for bar, basses, ch1, ch2, dyn in FAST:
    s.seq(bar, 1, 1, basses, dyn)
    s.ch(bar, 1, 2, ch1, dyn, roll=0.02)
    s.ch(bar, 3, 2, ch2, dyn, roll=0.02)
    s.ped(bar, 1)
    s.ped(bar, 3)

# 67–68: the Neapolitan. G major, where no G major belongs.
for bar in (67, 68):
    s.ped(bar)
    s.seq(bar, 1, 1, ['G1', 'G2', 'D2', 'G2'], 'ff')
    s.ch(bar, 1, 4, ['G4', 'B4', 'D5', 'G5'], 'ff', roll=0.03)
s.n(67, 1, 4, 'B5', 'ff', off=0.02)
s.n(68, 1, 2, 'D6', 'ff', off=0.02)
s.n(68, 3, 2, 'B5', 'ff', off=0.02)

# 69: the diminished seventh — every note a minor third from the next, no key,
# no ground under the feet at all.
s.ped(69)
s.seq(69, 1, 1, ['E#1', 'E#2', 'E#1', 'E#2'], 'ff')
s.ch(69, 1, 2, ['E#3', 'G#3', 'B3', 'D4'], 'ff', roll=0.02)
s.ch(69, 3, 2, ['G#3', 'B3', 'D4', 'E#4'], 'ff', roll=0.02)
s.n(69, 1, 2, 'D6', 'ff'), s.n(69, 3, 2, 'B5', 'ff')

# 70: the dominant, held, with the tune at the top of its range.
s.ped(70)
s.seq(70, 1, 1, ['C#1', 'C#2', 'C#1', 'C#2'], 'ff')
s.ch(70, 1, 4, ['C#3', 'E#3', 'G#3', 'B3'], 'ff', roll=0.02)
s.n(70, 1, 2, 'A5', 'fff', off=0.01)
s.n(70, 3, 2, 'G#5', 'fff', off=0.01)

# 71–72: the tonic, at last, with everything the hands can hold — and the four
# notes come down through it.
s.ped(71)
s.ch(71, 1, 4, ['F#1', 'F#2', 'C#3', 'F#3', 'A3', 'C#4', 'F#4', 'A4', 'C#5'],
     'fff', roll=0.018)
s.ch(71, 1, 4, ['F#5', 'A5', 'C#6', 'F#6'], 'fff', roll=0.018, off=0.02)
s.ped(72)
s.seq(72, 1, 0.5, ['F#1', 'F#2'] * 4, 'fff')
s.ch(72, 1, 2, ['E5', 'A5', 'C#6', 'E6'], 'fff', roll=0.015)
s.ch(72, 3, 2, ['D5', 'A5', 'D6'], 'fff', roll=0.015)

# 73–74: it comes apart. Octaves falling, both hands, the whole lament twice
# over, and quieter each step, which is worse than louder.
FALL = [('C#6', 'ff'), ('B5', 'ff'), ('A5', 'f'), ('G#5', 'f'),
        ('F#5', 'mf'), ('E5', 'mf'), ('D5', 'mp'), ('C#5', 'mp')]
for i, (name, dyn) in enumerate(FALL):
    bar = 73 + i // 4
    beat = 1 + i % 4
    s.n(bar, beat, 1, name, dyn)
    s.n(bar, beat, 1, name[:-1] + str(int(name[-1]) - 2), dyn)
s.ped(73), s.ped(74)

# 75–76: the diminished seventh again, left to ring, and then nothing.
s.ped(75)
s.ch(75, 1, 8, ['E#2', 'G#2', 'B2', 'D3', 'E#3'], 'mp', roll=0.05)

# ============================================================================
# VI. AFTER (bars 77–88)
#
# The opening, an octave and a half too low for it, and it cannot finish. The
# phrase gets three notes in the first time and two the second. The last sound
# in the piece is the tonic as deep as the instrument goes with a G natural
# over it — the note the Neapolitan was built on, and the one note in the
# chromatic scale that cannot be part of this chord.
# ============================================================================

s.ped(77)
s.ch(77, 1, 8, ['F#1', 'F#2'], 'ppp', roll=0.09)

s.ped(79)
s.n(79, 1, 2, 'F#3', 'pp', off=0.03)
s.n(79, 3, 2, 'E3', 'pp', off=0.03)
s.n(80, 1, 4, 'D3', 'pp', off=0.03)
s.ped(81)
s.n(81, 1, 4, 'C#3', 'ppp', off=0.03)

s.ped(83)
s.n(83, 1, 2, 'F#3', 'ppp', off=0.04)
s.n(83, 3, 2, 'E3', 'ppp', off=0.04)
s.n(84, 1, 3, 'D3', 'ppp', off=0.04)

s.ped(86)
s.ch(86, 1, 10, ['F#1', 'F#2'], 'ppp', roll=0.12)
s.n(86, 3, 8, 'G4', 'pp', off=0.05)


# ============================================================================
# The performance
# ============================================================================

def tempo(beat):
    """Seconds per beat. A piece like this is not played at one speed: it
    hurries where it is agitated and drags where it has given up."""
    bar = beat / BEATS + 1
    if bar < 13:
        bpm = 52
    elif bar < 29:
        bpm = 52 + (bar - 13) * 0.4                 # the ground takes hold
    elif bar < 44:
        bpm = 58 + (bar - 29) * 0.5                 # the climb pushes
    elif bar < 45:
        bpm = 44                                    # the refusal, on the spot
    elif bar < 55:
        bpm = 46
    elif bar < 67:
        bpm = 48 + (bar - 55) * 0.9                 # the second attempt gathers
    elif bar < 71:
        bpm = 58
    elif bar < 73:
        bpm = 54
    elif bar < 77:
        bpm = 50 - (bar - 73) * 2                   # falling apart
    else:
        bpm = 42 - min(8, (bar - 77) * 0.7)         # and stopping
    return 60.0 / bpm


def humanise(notes, seed=7):
    """No two notes of a chord land together and no two bars are the same
    weight. Deterministic, because the piece should be the same piece."""
    out = []
    state = seed
    for beat, dur, note, vel in sorted(notes):
        state = (state * 1103515245 + 12345) & 0x7fffffff
        r1 = (state / 0x7fffffff) - 0.5
        state = (state * 1103515245 + 12345) & 0x7fffffff
        r2 = (state / 0x7fffffff) - 0.5
        out.append((max(0.0, beat + r1 * 0.012), dur, note,
                    max(0.02, vel * (1 + r2 * 0.11))))
    return out


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/falling.wav'
    info = render(humanise(s.notes), out, pedal=sorted(set(s.pedals)),
                  tempo=tempo, tail=7.0)
    print(f"{info['notes']} notes · {info['seconds']:.0f}s · "
          f"peak {info['peak_dbfs']:.1f} dBFS → {out}")
