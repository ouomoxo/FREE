#!/usr/bin/env python3
"""THE SAME FOUR NOTES, FALLING — for grand piano, in F sharp minor.

Four notes going down — F#, E, D, C# — are the oldest way western music has of
saying that something is over. Purcell put them under Dido, Bach under the
Crucifixus. This piece has nothing else in it. Everything is those four notes:
sung, ground into the bass, leaned on, counted out, and finally hammered.

    I    ALONE          one line, and bare fifths under it
    II   THE GROUND     the four notes go into the bass. Three turns, and no
                        two of them the same — the figure doubles in speed
                        each time and the voice above it gets shorter of breath
    III  THE CLIMB      it rises and arrives, correctly, on the dominant —
                        and is refused
    IV   HOLLOW         the tune can manage two notes at a time now, each
                        attempt a third lower than the last
    V    THE COUNTING   one note, repeated. Half notes, then quarters, then
                        eighths, then triplets, then sixteenths. It never gets
                        past mezzo-piano. What builds is not the volume
    VI   THE BREAK      everything at once, and then the fall
    VII  AFTER          the opening in the wrong register, unfinished

Two things are held to throughout.

**The refusal.** A climax that works the first time is a piece about effort.
Bar 36 arrives on the dominant with everything in place and what comes instead
of the tonic is three notes at the top of the keyboard, as quietly as possible.

**한.** Not sadness — sadness passes. This is the kind that has been carried so
long it has become load-bearing, and the piano has three ways of saying it: the
grace note that bends up into the pitch from a semitone below and lets go; the
leaned appoggiatura that arrives on the beat as a dissonance and only then
becomes consonant; and section V, where nothing gets louder and the pulse
closes in anyway. Pressure held, not released. When it finally does break, in
VI, it does not fix anything — the last bar is the tonic low on the instrument
with a G natural, the flattened second, left ringing over it.

Run:  python3 scores/falling.py out.wav
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'dev'))
from piano import DYN, pitch, render          # noqa: E402

BEATS = 4                                     # 4/4 throughout


def below(name, semitones=1):
    """The note a semitone or two under — where a grace note comes from."""
    return pitch(name) - semitones


class Score:
    """Somewhere to write it down. Bars and beats count from one."""

    def __init__(self):
        self.notes = []
        self.pedals = []

    def at(self, bar, beat):
        return (bar - 1) * BEATS + (beat - 1)

    def n(self, bar, beat, dur, name, dyn, roll=0.0, off=0.0):
        """One note. `roll` and `off` are in beats, for spreading a chord and
        for letting a voice lean very slightly early or late."""
        vel = DYN[dyn] if isinstance(dyn, str) else dyn
        note = name if isinstance(name, int) else pitch(name)
        self.notes.append((self.at(bar, beat) + roll + off, dur, note, vel))

    def ch(self, bar, beat, dur, names, dyn, roll=0.0, off=0.0):
        """A chord, rolled from the bottom up if `roll` is given — a hand
        cannot put nine notes down at once and should not pretend to."""
        for i, name in enumerate(names):
            self.n(bar, beat, dur - i * roll, name, dyn, roll * i, off)

    def seq(self, bar, beat, dur, names, dyn, off=0.0):
        """One after another, each `dur` long: an arpeggio, a broken octave."""
        for i, name in enumerate(names):
            self.n(bar, beat + i * dur, dur, name, dyn, 0.0, off)

    def bend(self, bar, beat, dur, name, dyn, semitones=1, gap=0.11):
        """A grace note from below, and the note it was going to.

        This is as close as a piano gets to bending a pitch. The lower note is
        struck just before the beat and let go immediately; the ear hears one
        note arrived at from underneath rather than two notes. Nothing else on
        this instrument sounds like wanting something."""
        soft = (DYN[dyn] if isinstance(dyn, str) else dyn) * 0.55
        self.n(bar, beat, gap * 1.6, below(name, semitones), soft, off=-gap)
        self.n(bar, beat, dur, name, dyn)

    def sigh(self, bar, beat, dur, upper, lower, dyn, weight=1.25):
        """Two notes: the first on the beat, leaned on, and the second under it
        and softer. An appoggiatura — the dissonance takes the strong beat and
        the consonance has to wait for it."""
        base = DYN[dyn] if isinstance(dyn, str) else dyn
        self.n(bar, beat, dur * 0.52, upper, min(0.95, base * weight))
        self.n(bar, beat + dur * 0.5, dur * 0.5, lower, base * 0.72)

    def ped(self, bar, beat=1):
        """The pedal comes up here and goes straight back down."""
        self.pedals.append(self.at(bar, beat))


s = Score()

# ============================================================================
# I. ALONE (bars 1–10)
#
# One voice, and under it fifths with no third in them — the harmony is not yet
# willing to say whether it is major or minor, though everyone knows. The tune
# is bent into twice and leaned on twice in ten bars, and that is all the
# ornament the piece gets until the very end.
# ============================================================================

for bar, dur, notes in [(1, 8, ['F#2', 'C#3']), (3, 8, ['B1', 'F#2']),
                        (5, 8, ['D2', 'A2']), (7, 6, ['C#2', 'G#2']),
                        (9, 4, ['D2', 'A2']), (10, 4, ['C#2', 'G#2'])]:
    s.ch(bar, 1, dur, notes, 'pp', roll=0.05)
    s.ped(bar)

s.bend(1, 1, 1.9, 'F#4', 'p')                  # up into the first note
s.n(1, 3, 1.9, 'E4', 'p', off=-0.02)
s.n(2, 1, 3.9, 'D4', 'p', off=-0.02)
s.n(3, 1, 1.9, 'D4', 'p', off=-0.02)
s.n(3, 3, 1.9, 'C#4', 'p', off=-0.02)
s.n(4, 1, 3.9, 'B3', 'p', off=-0.02)
s.bend(5, 1, 1.9, 'A4', 'mp')                  # the one leap, and it is bent
s.n(5, 3, 1.9, 'F#4', 'p', off=-0.02)
s.sigh(6, 1, 2, 'E4', 'D4', 'p')
s.n(6, 3, 1.9, 'C#4', 'p', off=-0.02)
s.sigh(7, 1, 2, 'E#4', 'D#4', 'p')
s.n(7, 3, 1.9, 'C#4', 'pp', off=-0.02)
s.n(8, 1, 3.6, 'B3', 'pp', off=-0.02)
s.n(9, 1, 1.9, 'D4', 'pp', off=-0.02)
s.n(9, 3, 1.9, 'C#4', 'pp', off=-0.02)
s.n(10, 1, 3.9, 'B3', 'ppp', off=-0.02)

# ============================================================================
# II. THE GROUND (bars 11–22)
#
# The four notes go into the bass and the space between them fills with the
# chromatic steps that were always implied: F#, E#, E, D#, D, C#, B, C#.
#
# Three turns, not four, and the accompaniment is never the same twice: quavers,
# then semiquavers, then semiquavers in both hands with the bass in octaves.
# A ground that does not develop is the idea; a *texture* that does not develop
# is just a long accompaniment.
# ============================================================================

GROUND = [
    (['F#2'], ['C#3', 'F#3', 'A3']),        # i
    (['E#2'], ['B2', 'C#3', 'G#3']),        # V6/5
    (['E2'], ['C#3', 'F#3', 'A3']),         # i7, third inversion
    (['D#2'], ['A2', 'B2', 'F#3']),         # V6/5 of the fourth
    (['D2'], ['A2', 'D3', 'F#3']),          # VI
    (['C#2'], ['G#2', 'C#3', 'E#3']),       # V
    (['B1'], ['F#2', 'B2', 'D3']),          # iv
    (['C#2'], ['G#2', 'C#3', 'E#3']),       # V
]

for turn, (start, step, dyn) in enumerate([(11, 0.5, 'p'), (15, 0.25, 'mp'), (19, 0.25, 'mf')]):
    for half in range(8):
        bar = start + half // 2
        beat = 1 + (half % 2) * 2
        bass, upper = GROUND[half]
        s.ped(bar, beat)
        if step == 0.5:
            s.seq(bar, beat, 0.5, bass + upper, dyn)
        elif turn == 1:
            # Twice as busy: up and back down again inside the same half bar.
            s.seq(bar, beat, 0.25, bass + upper + upper[::-1][1:] + bass, dyn)
        else:
            # And now the bass doubles at the octave and the figure widens.
            low = bass[0][:-1] + str(int(bass[0][-1]) - 1)
            s.n(bar, beat, 2, low, dyn)
            s.seq(bar, beat, 0.25, bass + upper + [upper[-1]] + upper[::-1], dyn)

# The voice. It sings a long arch the first time round, and each time after
# that it has less breath: the phrases get shorter and the rests get longer.
s.n(11, 3, 1.9, 'C#5', 'mp', off=-0.02)
s.sigh(12, 1, 2, 'D5', 'C#5', 'mp')
s.n(12, 3, 1.9, 'B4', 'mp', off=-0.02)
s.n(13, 1, 1.9, 'A4', 'mp', off=-0.02)
s.bend(13, 3, 1.9, 'B4', 'mp')
s.n(14, 1, 3.8, 'G#4', 'mp', off=-0.02)

s.bend(15, 1, 1.9, 'C#5', 'mf')
s.n(15, 3, 1.9, 'D5', 'mf', off=-0.02)
s.sigh(16, 1, 2, 'E5', 'D5', 'mf')
s.n(16, 3, 1.9, 'C#5', 'mf', off=-0.02)
s.n(17, 1, 2.9, 'F#5', 'mf', off=-0.02)          # the highest it will get
s.n(17, 4, 0.9, 'E5', 'mf', off=-0.02)
s.n(18, 1, 1.9, 'D5', 'mf', off=-0.02)
s.n(18, 3, 1.9, 'C#5', 'mp', off=-0.02)

s.sigh(19, 1, 2, 'D5', 'C#5', 'mf', weight=1.35)
s.n(19, 3, 0.9, 'B4', 'mf', off=-0.02)           # shorter
s.n(20, 1, 1.9, 'C#5', 'mf', off=-0.02)
s.bend(20, 3, 0.9, 'B4', 'mf')                  # shorter still
s.n(21, 1, 0.9, 'A4', 'mf', off=-0.02)
s.n(21, 2, 0.9, 'G#4', 'mf', off=-0.02)
s.n(21, 3, 1.9, 'F#4', 'mf', off=-0.02)
s.sigh(22, 1, 2, 'G#4', 'F#4', 'mf')
s.n(22, 3, 1.9, 'E#4', 'mf', off=-0.02)          # left on the leading note

# ============================================================================
# III. THE CLIMB (bars 23–36)
#
# The four notes in octaves, sequenced up a step at a time, over broken octaves
# that will not stop. It arrives, correctly, on the dominant at bar 35 — and
# then nothing comes. Bar 36 is where the piece breaks.
# ============================================================================

CLIMB = [
    (23, ['F#1', 'F#2'], [('F#5', 2), ('E5', 2)], 'mp'),
    (24, ['C#1', 'C#2'], [('D5', 2), ('C#5', 2)], 'mp'),
    (25, ['G#1', 'G#2'], [('G#5', 2), ('F#5', 2)], 'mp'),
    (26, ['D1', 'D2'], [('E5', 2), ('D5', 2)], 'mf'),
    (27, ['A1', 'A2'], [('A5', 2), ('G#5', 2)], 'mf'),
    (28, ['E1', 'E2'], [('F#5', 2), ('E5', 2)], 'mf'),
    (29, ['B1', 'B2'], [('B5', 2), ('A5', 2)], 'mf'),
    (30, ['F#1', 'F#2'], [('G#5', 2), ('F#5', 2)], 'f'),
]
for bar, oct_pair, cell, dyn in CLIMB:
    s.seq(bar, 1, 0.5, oct_pair * 4, dyn)
    s.ped(bar)
    s.ped(bar, 3)
    beat = 1
    for name, dur in cell:
        # In octaves — it is not singing any more, it is insisting.
        s.n(bar, beat, dur * 0.96, name, dyn, off=-0.01)
        s.n(bar, beat, dur * 0.96, name[:-1] + str(int(name[-1]) - 1), dyn, off=-0.01)
        beat += dur

DRIVE = [
    (31, ['B1', 'B2'], [('B5', 1), ('C#6', 1), ('D6', 1), ('E6', 1)], 'mf'),
    (32, ['E1', 'E2'], [('F#6', 2), ('E6', 2)], 'mf'),
    (33, ['A1', 'A2'], [('E6', 2), ('C#6', 2)], 'f'),
    (34, ['D1', 'D2'], [('D6', 2), ('C#6', 2)], 'f'),
    (35, ['C#1', 'C#2'], [('G#5', 1), ('A5', 1), ('B5', 1), ('C#6', 1)], 'f'),
]
for bar, oct_pair, cell, dyn in DRIVE:
    s.seq(bar, 1, 0.25, oct_pair * 8, dyn)
    s.ped(bar)
    beat = 1
    for name, dur in cell:
        s.n(bar, beat, dur * 0.96, name, dyn)
        s.n(bar, beat, dur * 0.96, name[:-1] + str(int(name[-1]) - 1), dyn)
        beat += dur

# The refusal.
s.ped(36)
s.ch(36, 1, 5, ['F#5', 'A5', 'C#6'], 'pp', roll=0.06)

# ============================================================================
# IV. HOLLOW (bars 37–46)
#
# Two notes at a time, and then it has to stop. Each attempt begins a third
# lower than the last. The bars in between are empty and are meant to be.
# ============================================================================

s.ped(37)
s.ch(37, 1, 6, ['F#1', 'F#2'], 'ppp', roll=0.08)
s.ped(40)
s.ch(40, 1, 6, ['F#1', 'F#2'], 'ppp', roll=0.08)

# Every bar and a half, so the silence is still longer than the phrase but no
# longer outstays it. The first version left ten bars here and it was the
# emptiest fifty-five seconds in the piece.
for bar, beat, hi, lo in [(37, 1, 'F#6', 'E6'), (38, 3, 'D#6', 'C#6'),
                          (40, 1, 'B5', 'A5'), (41, 3, 'G#5', 'F#5')]:
    s.sigh(bar, beat, 3, hi, lo, 'ppp')
    if beat == 3:
        s.ped(bar, 3)
s.ped(43)
s.bend(43, 1, 4, 'E5', 'ppp')

# ============================================================================
# V. THE COUNTING (bars 47–58)
#
# One note. C sharp — the dominant, the note the whole piece has been unable to
# get away from — struck over and over in the middle of the keyboard, in half
# notes, then quarters, then eighths, then triplets, then sixteenths.
#
# It does not get louder. It gets *closer together*, and that is the whole
# device: the pressure is in the pulse and not in the volume, so there is no
# release in it anywhere. Underneath, the four notes go on descending in the
# bass, bent up into from below every time, and by the last bar the two hands
# are so far apart that there is nothing at all in the middle.
# ============================================================================

RATES = [(45, 2, 'ppp'), (46, 1, 'ppp'), (47, 1, 'pp'), (48, 0.5, 'pp'),
         (49, 0.5, 'pp'), (50, 1 / 3, 'p'), (51, 1 / 3, 'p'), (52, 0.25, 'p'),
         (53, 0.25, 'mp'), (54, 0.25, 'mp'), (55, 1 / 6, 'mp'), (56, 1 / 6, 'mp')]
for bar, step, dyn in RATES:
    s.ped(bar)
    k = 0
    beat = 1.0
    # The counting stops halfway through its last bar. Two beats of nothing,
    # and then everything. A break is not made bigger by what precedes it
    # being loud; it is made bigger by there being nothing there at all.
    end = 3.0 if bar == 56 else 5.0
    while beat < end - 1e-6:
        # Every fourth stroke leans, so that a pulse is a pulse and not a
        # machine. This is the only thing keeping the section alive.
        lean = 1.18 if k % 4 == 0 else 0.88
        base = DYN[dyn] * lean * (1 + 0.16 * (bar - 45) / 11)
        s.n(bar, beat, step * 0.92, 'C#5', min(0.72, base))
        beat += step
        k += 1

BASS_LAMENT = [
    (45, 'F#2'), (46, 'E#2'), (47, 'E2'), (48, 'D#2'),
    (49, 'D2'), (50, 'C#2'), (51, 'B1'), (52, 'C#2'),
    (53, 'F#1'), (54, 'E1'), (55, 'D1'), (56, 'C#1'),
]
for bar, name in BASS_LAMENT:
    dyn = 'pp' if bar < 49 else ('p' if bar < 53 else 'mp')
    s.bend(bar, 1, 3.8, name, dyn, semitones=1, gap=0.13)
    if bar >= 53:
        s.n(bar, 1, 3.8, name[:-1] + str(int(name[-1]) + 1), dyn, off=-0.02)

# The tune tries once more, in the low middle, and gets four notes in.
s.n(51, 1, 1.9, 'F#3', 'mp', off=-0.03)
s.n(51, 3, 1.9, 'E3', 'mp', off=-0.03)
s.n(52, 1, 1.9, 'D3', 'mp', off=-0.03)
s.sigh(52, 3, 2, 'D3', 'C#3', 'mp')

# The last bars: the counting is all there is, and then it stops dead.
s.ped(56, 3)

# ============================================================================
# VI. THE BREAK (bars 57–73)
#
# Everything at once. The four notes hammered in octaves in both hands against
# a bass that will not stop; the Neapolitan at 65, which is the furthest a
# chord can get from this key and still mean something, and the only
# consolation on offer; the diminished seventh, which has no key at all; the
# tonic at last with both hands full; and then the fall.
# ============================================================================

BREAK = [
    (57, ['F#1', 'F#2'], ['F#4', 'A4', 'C#5'], [('F#5', 2), ('E5', 2)], 'ff'),
    (58, ['E#1', 'E#2'], ['E#4', 'G#4', 'B4'], [('D5', 2), ('C#5', 2)], 'ff'),
    (59, ['E1', 'E2'], ['F#4', 'A4', 'C#5'], [('D5', 2), ('E5', 2)], 'ff'),
    (60, ['D#1', 'D#2'], ['F#4', 'A4', 'B4'], [('F#5', 4)], 'ff'),
    (61, ['D1', 'D2'], ['D4', 'F#4', 'A4'], [('A5', 2), ('G#5', 2)], 'ff'),
    (62, ['C#1', 'C#2'], ['E#4', 'G#4', 'B4'], [('F#5', 2), ('E#5', 2)], 'ff'),
    (63, ['B0', 'B1'], ['D4', 'F#4', 'B4'], [('D6', 2), ('C#6', 2)], 'fff'),
    (64, ['C#1', 'C#2'], ['E#4', 'G#4', 'B4'], [('B5', 2), ('A5', 2)], 'fff'),
]
for bar, basses, chord, cell, dyn in BREAK:
    s.ped(bar)
    s.ped(bar, 3)
    s.seq(bar, 1, 0.25, basses * 8, dyn)
    s.ch(bar, 1, 2, chord, dyn, roll=0.015)
    s.ch(bar, 3, 2, chord, dyn, roll=0.015)
    beat = 1
    for name, dur in cell:
        s.n(bar, beat, dur * 0.95, name, dyn, off=-0.012)
        s.n(bar, beat, dur * 0.95, name[:-1] + str(int(name[-1]) + 1), dyn, off=-0.012)
        beat += dur

# 65–66: G major, where no G major belongs.
for bar in (65, 66):
    s.ped(bar)
    s.seq(bar, 1, 0.25, ['G1', 'G2', 'D2', 'G2'] * 2, 'fff')
    s.ch(bar, 1, 4, ['G4', 'B4', 'D5', 'G5'], 'fff', roll=0.025)
s.n(65, 1, 3.9, 'B5', 'fff', off=-0.02)
s.sigh(66, 1, 2, 'D6', 'B5', 'fff')
s.bend(66, 3, 2, 'G5', 'fff', semitones=1)

# 67: the diminished seventh, and a run up out of it. No key, no floor.
s.ped(67)
s.seq(67, 1, 0.25, ['E#1', 'E#2'] * 8, 'fff')
s.ch(67, 1, 2, ['E#3', 'G#3', 'B3', 'D4'], 'fff', roll=0.02)
s.seq(67, 3, 0.25, ['B4', 'D5', 'E#5', 'G#5', 'B5', 'D6', 'E#6', 'G#6'], 'fff')

# 68: the dominant, held, with the voice at the top of its range.
s.ped(68)
s.seq(68, 1, 0.25, ['C#1', 'C#2'] * 8, 'fff')
s.ch(68, 1, 4, ['C#3', 'E#3', 'G#3', 'B3'], 'fff', roll=0.02)
s.sigh(68, 1, 2, 'B5', 'A5', 'fff', weight=1.1)
s.n(68, 3, 1.9, 'G#5', 'fff', off=-0.01)

# 69–70: the tonic, with everything the hands can hold, and the four notes
# coming down through the middle of it.
s.ped(69)
s.ch(69, 1, 4, ['F#1', 'F#2', 'C#3', 'F#3', 'A3', 'C#4', 'F#4', 'A4', 'C#5'],
     'fff', roll=0.016)
s.ch(69, 1, 4, ['F#5', 'A5', 'C#6', 'F#6'], 'fff', roll=0.016, off=-0.022)
s.ped(70)
s.seq(70, 1, 0.25, ['F#1', 'F#2'] * 8, 'fff')
s.ch(70, 1, 2, ['E5', 'A5', 'C#6', 'E6'], 'fff', roll=0.014)
s.ch(70, 3, 2, ['D5', 'A5', 'D6'], 'fff', roll=0.014)

# 71–72: the fall. Both hands in octaves, in semiquavers, right down the
# instrument — and quieter every step, which is worse than louder.
FALL = ['C#6', 'B5', 'A5', 'G#5', 'F#5', 'E5', 'D5', 'C#5',
        'B4', 'A4', 'G#4', 'F#4', 'E4', 'D4', 'C#4', 'B3']
s.ped(71)
s.ped(72)
for i, name in enumerate(FALL):
    dyn = ['ff', 'ff', 'ff', 'ff', 'f', 'f', 'f', 'f',
           'mf', 'mf', 'mf', 'mp', 'mp', 'p', 'p', 'pp'][i]
    bar = 71 + i // 8
    beat = 1 + (i % 8) * 0.5
    s.n(bar, beat, 0.5, name, dyn)
    s.n(bar, beat, 0.5, name[:-1] + str(int(name[-1]) - 2), dyn)

# 73: what is left ringing has no key in it either.
s.ped(73)
s.ch(73, 1, 6, ['E#2', 'G#2', 'B2', 'D3', 'E#3'], 'p', roll=0.05)

# ============================================================================
# VII. AFTER (bars 75–80)
#
# The opening, an octave and a half too low for it, and it cannot finish: three
# notes the first time, two the second. The last sound is the tonic low on the
# instrument with a G natural over it — the note the Neapolitan was built on,
# and the one note in the scale that cannot belong to this chord.
#
# Six bars. The first version took twelve and they were the longest twelve in
# the piece: an ending is not made more final by being longer.
# ============================================================================

s.ped(75)
s.ch(75, 1, 6, ['F#1', 'F#2'], 'ppp', roll=0.09)
s.bend(75, 3, 1.9, 'F#3', 'pp')
s.n(76, 1, 1.9, 'E3', 'pp', off=-0.03)
s.n(76, 3, 2.6, 'D3', 'pp', off=-0.03)
s.ped(77)
s.n(77, 1, 3.6, 'C#3', 'ppp', off=-0.03)

s.ped(78)
s.n(78, 1, 1.9, 'F#3', 'ppp', off=-0.04)
s.n(78, 3, 1.9, 'E3', 'ppp', off=-0.04)
s.n(79, 1, 2.4, 'D3', 'ppp', off=-0.04)          # and it stops there

s.ped(80)
s.ch(80, 1, 10, ['F#1', 'F#2'], 'ppp', roll=0.12)
s.n(80, 3, 8, 'G4', 'pp', off=-0.05)


# ============================================================================
# The performance
# ============================================================================

def tempo(beat):
    """Seconds per beat.

    Nothing here is played at one speed. The counting in V pushes without ever
    getting loud, the break holds itself back so the octaves can land, and the
    end does not so much slow down as give up."""
    bar = beat / BEATS + 1
    if bar < 11:
        bpm = 52
    elif bar < 23:
        bpm = 52 + (bar - 11) * 0.8             # the ground takes hold
    elif bar < 31:
        bpm = 60 + (bar - 23) * 0.8             # the climb pushes
    elif bar < 36:
        bpm = 66
    elif bar < 37:
        bpm = 42                                # the refusal, on the spot
    elif bar < 45:
        bpm = 50
    elif bar < 57:
        bpm = 52 + (bar - 45) * 1.4             # the counting closes in
    elif bar < 65:
        bpm = 64
    elif bar < 69:
        bpm = 60                                # held back, to let it land
    elif bar < 71:
        bpm = 56
    elif bar < 74:
        bpm = 54 - (bar - 71) * 3               # falling apart
    else:
        bpm = 40 - min(8, (bar - 74) * 1.1)     # and stopping
    return 60.0 / bpm


def humanise(notes, seed=7):
    """No two notes of a chord land together and no two bars weigh the same.
    Deterministic, because it should be the same piece every time."""
    out = []
    state = seed
    for beat, dur, note, vel in sorted(notes):
        state = (state * 1103515245 + 12345) & 0x7fffffff
        r1 = (state / 0x7fffffff) - 0.5
        state = (state * 1103515245 + 12345) & 0x7fffffff
        r2 = (state / 0x7fffffff) - 0.5
        out.append((max(0.0, beat + r1 * 0.014), dur, note,
                    max(0.02, min(0.97, vel * (1 + r2 * 0.12)))))
    return out


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/falling.wav'
    info = render(humanise(s.notes), out, pedal=sorted(set(s.pedals)),
                  tempo=tempo, tail=7.0)
    print(f"{info['notes']} notes · {info['seconds']:.0f}s · "
          f"peak {info['peak_dbfs']:.1f} dBFS → {out}")
