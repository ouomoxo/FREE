#!/usr/bin/env python3
"""THE SAME FOUR NOTES, FALLING — for grand piano, in F sharp minor.

Four notes going down — F#, E, D, C# — are the oldest way western music has of
saying that something is over. Purcell put them under Dido, Bach under the
Crucifixus. This piece has nothing else in it, and it does not develop them; it
changes what they mean, and the last time it does so by force.

    I    ALONE          one line, and bare fifths under it
    II   THE GROUND     the four notes go into the bass. Three turns, and the
                        figure doubles in speed each time
    III  THE CLIMB      it rises, and leaves the key on the way up
    IV   THE LIGHT      A major, a second subject, and a chorale — the first
                        music in the piece with no figuration in it at all.
                        The four notes are in the tenor, for anyone listening
    V    THE CURDLING   C sharp becomes C natural. The chorale collapses into
                        bare octaves: unison, four octaves apart, no harmony
    VI   PRESTO AGITATO the storm. Semiquavers, both hands, thirty-six bars,
                        with the four notes in augmentation underneath it from
                        bar 61 and two bars of near-silence cut into it
    VII  THE CLIMAX     the four notes descending against the same four notes
                        rising, and then the fall
    VIII AFTER          the opening in the wrong register, unfinished

Three measurements shaped it, all taken from Beethoven's Op. 27 No. 2, which
was sitting in this repository the whole time and which the earlier drafts of
this piece were only pretending to have read.

**Note density.** The Adagio sostenuto runs at 4.1 notes a second. The Presto
agitato runs at **6.1**, of which two and a half thousand are semiquavers. An
earlier version of this piece ran at 3.0 and was slow from the first bar to the
last. A tragedy that never moves is not restrained, it is empty — and the
sonata everyone quotes for its slow movement earns that movement with a finale
that never stops. Section VI is the answer to that.

**Rhythm.** Seven distinct onset positions to the bar in the Adagio; that tune
never once moves in equal note values. Everything here is dotted, and the third
turn of the ground is tied over the barline so that the voice and the ground
stop agreeing about where the beat is.

**Register.** The Adagio opens from thirty-four semitones to fifty-five at its
climax and closes to twenty-four; the Presto holds fifty-odd without let-up.
The span is a dramatic parameter and it is used as one here: thirty-four at the
start, sixty in the storm, and thirty-seven at the end.

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


def spread(names, low, high):
    """Every note of a chord, in every octave between two limits.

    An arpeggio is not a list of notes anybody writes out. It is a chord and a
    range, and the hand fills in the rest."""
    pcs = sorted({pitch(n) % 12 for n in names})
    out = []
    octave = (low // 12) * 12
    while octave < high + 12:
        for p in pcs:
            m = octave + p
            if low <= m <= high:
                out.append(m)
        octave += 12
    return sorted(out)


class Score:
    """Somewhere to write it down. Bars and beats count from one."""

    def __init__(self):
        self.notes = []
        self.pedals = []

    def at(self, bar, beat):
        return (bar - 1) * BEATS + (beat - 1)

    def n(self, bar, beat, dur, name, dyn, roll=0.0, off=0.0):
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

    def run(self, bar, beat, step, notes, dyn, accent=None, every=4):
        """A stream of equal notes with a weight on the first of each group.

        Semiquavers that all weigh the same are a machine. A player leans on
        the first of every four without being asked, and that is the only
        reason the ear hears bars in a torrent of them."""
        base = DYN[dyn] if isinstance(dyn, str) else dyn
        top = DYN[accent] if isinstance(accent, str) else (accent or base * 1.35)
        for i, m in enumerate(notes):
            self.n(bar, beat + i * step, step * 1.7, m,
                   min(0.95, top if i % every == 0 else base))

    def bend(self, bar, beat, dur, name, dyn, semitones=1, gap=0.11):
        """A grace note from below, and the note it was going to. As close as a
        piano gets to bending a pitch, and the only thing on this instrument
        that sounds like wanting something."""
        soft = (DYN[dyn] if isinstance(dyn, str) else dyn) * 0.55
        self.n(bar, beat, gap * 1.6, below(name, semitones), soft, off=-gap)
        self.n(bar, beat, dur, name, dyn)

    def sigh(self, bar, beat, dur, upper, lower, dyn, weight=1.25):
        """An appoggiatura: the dissonance takes the strong beat and the
        consonance has to wait for it."""
        base = DYN[dyn] if isinstance(dyn, str) else dyn
        self.n(bar, beat, dur * 0.52, upper, min(0.95, base * weight))
        self.n(bar, beat + dur * 0.5, dur * 0.5, lower, base * 0.72)

    def octaves(self, bar, beat, cell, dyn, down=1):
        """A melody doubled at the octave. It is not singing any more."""
        for name, dur in cell:
            self.n(bar, beat, dur * 0.95, name, dyn, off=-0.024)
            self.n(bar, beat, dur * 0.95,
                   name[:-1] + str(int(name[-1]) - down), dyn, off=-0.024)
            beat += dur

    def ped(self, bar, beat=1):
        self.pedals.append(self.at(bar, beat))


s = Score()

# ============================================================================
# I. ALONE (bars 1–8)
#
# Six bars of one voice, and then the ground starts underneath it before it
# has finished — the sections of this piece overlap rather than stopping and
# starting, which is the difference between a piece and a list of sections.
#
# One voice, and under it fifths with no third in them — the harmony is not yet
# willing to say whether it is major or minor, though everyone knows. Dotted
# from the first bar: four notes in equal values are a scale; the same four
# with the first held and the second hurrying after it are a sentence.
# ============================================================================

for bar, dur, notes in [(1, 8, ['F#2', 'C#3']), (3, 8, ['B1', 'F#2']),
                        (5, 4, ['D2', 'A2']), (6, 4, ['C#2', 'G#2'])]:
    s.ch(bar, 1, dur, notes, 'pp', roll=0.05)
    s.ped(bar)

s.bend(1, 1, 1.45, 'F#4', 'p')
s.n(1, 2.5, 0.45, 'E4', 'p', off=-0.02)
s.n(1, 3, 1.9, 'D4', 'p', off=-0.02)
s.n(2, 1, 3.4, 'C#4', 'p', off=-0.02)
s.n(3, 1, 1.45, 'D4', 'p', off=-0.02)
s.n(3, 2.5, 0.45, 'C#4', 'p', off=-0.02)
s.n(3, 3, 1.9, 'B3', 'p', off=-0.02)
s.n(4, 1, 3.4, 'A3', 'p', off=-0.02)
s.bend(5, 1, 1.45, 'A4', 'mp')                 # the one leap, and it is bent
s.n(5, 2.5, 0.45, 'G#4', 'mp', off=-0.02)
s.n(5, 3, 1.9, 'F#4', 'p', off=-0.02)
s.sigh(6, 1, 1.5, 'E#4', 'D#4', 'p')
s.n(6, 3, 1.45, 'C#4', 'pp', off=-0.02)
s.n(6, 4.5, 0.45, 'B3', 'pp', off=-0.02)

# 7–8: the ground arrives underneath before anyone has finished speaking. Two
# bars of it alone, quiet, and then the voice comes back in over the top.
s.ped(7)
s.ped(7, 3)
s.ped(8)
s.ped(8, 3)
s.seq(7, 1, 0.5, ['F#2', 'C#3', 'F#3', 'A3'], 'pp')
s.seq(7, 3, 0.5, ['E#2', 'B2', 'C#3', 'G#3'], 'pp')
s.seq(8, 1, 0.5, ['E2', 'C#3', 'F#3', 'A3'], 'pp')
s.seq(8, 3, 0.5, ['D#2', 'A2', 'B2', 'F#3'], 'pp')
s.n(8, 1, 3.4, 'A3', 'p', off=-0.02)

# ============================================================================
# II. THE GROUND (bars 9–20)
#
# The four notes go into the bass and the space between them fills with the
# chromatic steps that were always implied: F#, E#, E, D#, D, C#, B, C#.
# Three turns, and the accompaniment doubles in speed each one.
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
for turn, (start, step, dyn) in enumerate([(9, 0.5, 'p'), (13, 0.25, 'mp'),
                                           (17, 0.25, 'mf')]):
    for half in range(8):
        bar = start + half // 2
        beat = 1 + (half % 2) * 2
        bass, upper = GROUND[half]
        s.ped(bar, beat)
        if step == 0.5:
            s.seq(bar, beat, 0.5, bass + upper, dyn)
        elif turn == 1:
            s.seq(bar, beat, 0.25, bass + upper + upper[::-1][1:] + bass, dyn)
        else:
            low = bass[0][:-1] + str(int(bass[0][-1]) - 1)
            s.n(bar, beat, 2, low, dyn)
            s.seq(bar, beat, 0.25, bass + upper + [upper[-1]] + upper[::-1], dyn)

s.n(9, 3, 1.45, 'C#5', 'mp', off=-0.02)
s.n(9, 4.5, 0.45, 'D5', 'mp', off=-0.02)
s.n(10, 1, 1.45, 'E5', 'mp', off=-0.02)
s.n(10, 2.5, 0.45, 'D5', 'mp', off=-0.02)
s.n(10, 3, 1.9, 'C#5', 'mp', off=-0.02)
s.n(11, 1, 1.45, 'B4', 'mp', off=-0.02)
s.n(11, 2.5, 0.45, 'A4', 'mp', off=-0.02)
s.n(11, 3, 1.9, 'G#4', 'mp', off=-0.02)
s.n(12, 1, 3.4, 'A4', 'mp', off=-0.02)

# An inner voice, in the tenor, singing the same phrase one bar behind the
# top one. Two voices doing the same thing at different times is the oldest
# trick in counterpoint and it is the first time in this piece that anything
# has been in more than one place at once.
s.n(14, 1, 1.45, 'C#4', 'mp', off=0.01)
s.n(14, 2.5, 0.45, 'D4', 'mp', off=0.01)
s.n(14, 3, 1.9, 'E4', 'mp', off=0.01)
s.n(15, 1, 1.45, 'F#4', 'mp', off=0.01)
s.n(15, 2.5, 0.45, 'E4', 'mp', off=0.01)
s.n(15, 3, 1.9, 'D4', 'mp', off=0.01)
s.n(16, 1, 0.95, 'C#4', 'mp', off=0.01)
s.n(16, 2, 0.95, 'B3', 'mp', off=0.01)
s.n(16, 3, 1.9, 'A3', 'mp', off=0.01)

s.bend(13, 1, 1.45, 'C#5', 'mf')
s.n(13, 2.5, 0.45, 'D5', 'mf', off=-0.02)
s.n(13, 3, 1.9, 'E5', 'mf', off=-0.02)
s.n(14, 1, 1.45, 'F#5', 'mf', off=-0.02)
s.n(14, 2.5, 0.45, 'E5', 'mf', off=-0.02)
s.n(14, 3, 1.9, 'D5', 'mf', off=-0.02)
s.n(15, 1, 0.95, 'C#5', 'mf', off=-0.02)
s.n(15, 2, 0.95, 'B4', 'mf', off=-0.02)
s.n(15, 3, 1.45, 'A4', 'mf', off=-0.02)
s.n(15, 4.5, 0.45, 'G#4', 'mf', off=-0.02)
s.n(16, 1, 1.9, 'F#4', 'mf', off=-0.02)
s.n(16, 3, 1.9, 'E#4', 'mp', off=-0.02)

# Third turn: every phrase begins on the second quaver and is tied over the
# barline, so the voice and the ground stop agreeing where the beat is.
s.n(17, 1.5, 1.45, 'D5', 'f', off=-0.02)
s.n(17, 3, 0.95, 'C#5', 'f', off=-0.02)
s.n(17, 4, 1.4, 'B4', 'f', off=-0.02)
s.n(18, 2.5, 0.45, 'C#5', 'f', off=-0.02)
s.n(18, 3, 1.9, 'A4', 'f', off=-0.02)
s.n(19, 1.5, 0.95, 'G#4', 'f', off=-0.02)
s.n(19, 2.5, 0.45, 'F#4', 'f', off=-0.02)
s.n(19, 3, 1.9, 'E#4', 'f', off=-0.02)
s.sigh(20, 1, 1.5, 'F#4', 'E#4', 'f')
s.n(20, 3, 1.9, 'D#4', 'f', off=-0.02)

# ============================================================================
# III. THE CLIMB (bars 21–28)
#
# It rises, and while it rises it leaves the key. F sharp minor is A major's
# relative minor, so the door is always open: a B minor, an E seventh, and the
# same music is in the major. Bar 27 is one bar of it — quiet, and snatched
# straight back. That bar is a promise, and the piece keeps it.
# ============================================================================

CLIMB = [
    (21, ['F#1', 'F#2'], [('F#5', 1.5), ('E5', 0.5), ('D5', 2)], 'mp'),
    (22, ['C#1', 'C#2'], [('C#5', 1.5), ('D5', 0.5), ('E5', 2)], 'mp'),
    (23, ['B1', 'B2'], [('G#5', 1.5), ('F#5', 0.5), ('E5', 2)], 'mp'),
    (24, ['F#1', 'F#2'], [('D#5', 1.5), ('E5', 0.5), ('F#5', 2)], 'mf'),
    (25, ['B1', 'B2'], [('A5', 1.5), ('G#5', 0.5), ('F#5', 2)], 'mf'),
    (26, ['E1', 'E2'], [('E5', 1.5), ('F#5', 0.5), ('G#5', 2)], 'mf'),
]
for bar, oct_pair, cell, dyn in CLIMB:
    s.seq(bar, 1, 0.25, oct_pair * 8, dyn)
    s.ped(bar)
    s.ped(bar, 3)
    s.octaves(bar, 1, cell, dyn)

s.ped(27)                                       # the glimpse
s.seq(27, 1, 0.5, ['C#2', 'A2', 'C#3', 'E3'] * 2, 'p')
s.n(27, 1, 1.45, 'A4', 'mp', off=-0.02)
s.n(27, 2.5, 0.45, 'B4', 'mp', off=-0.02)
s.n(27, 3, 1.9, 'C#5', 'mp', off=-0.02)

s.ped(28)                                       # and the dominant of A major
s.run(28, 1, 0.25, spread(['E1', 'G#1', 'B1', 'D2'], 28, 64), 'mf', accent='f')
s.octaves(28, 1, [('G#5', 1.5), ('A5', 0.5), ('B5', 2)], 'f')

# ============================================================================
# IV. THE LIGHT (bars 29–34)
#
# A major. The same four notes — A, G sharp, F sharp, E — and in this key they
# are not a lament at all. Nothing has been added and nothing taken away. The
# shape that has meant *this is over* since the first bar means *it is all
# right* here, because of one accidental.
#
# The only major-key music in the piece. It lasts about twenty seconds.
# ============================================================================

# It is also the only place in the piece with a *tune* rather than a motif —
# a second subject, in the sonata sense: different key, different character,
# different texture. The four notes are still there, underneath, in the tenor,
# where they can be heard by anyone who is listening for them.
#
# And the texture is a chorale. Block chords, four voices moving together, no
# figuration at all — after twenty-eight bars of broken chords the absence of
# them is itself an event.
LIGHT = [
    (29, ['A1', 'A2', 'E3', 'A3', 'C#4'], [('E5', 1.5), ('F#5', 0.5), ('A5', 2)], 'A4'),
    (30, ['F#1', 'F#2', 'C#3', 'A3', 'D4'], [('A5', 1.5), ('G#5', 0.5), ('F#5', 2)], 'G#4'),
    (31, ['B1', 'B2', 'F#3', 'B3', 'D4'], [('E5', 1.5), ('F#5', 0.5), ('G#5', 2)], 'F#4'),
    (32, ['E1', 'E2', 'B2', 'G#3', 'D4'], [('B5', 1.5), ('A5', 0.5), ('G#5', 2)], 'E4'),
    (33, ['A1', 'A2', 'E3', 'A3', 'C#4'], [('A5', 1.5), ('B5', 0.5), ('C#6', 2)], 'A4'),
    (34, ['D1', 'D2', 'A2', 'F#3', 'D4'], [('D6', 1.5), ('C#6', 0.5), ('B5', 2)], 'F#4'),
    (35, ['E1', 'E2', 'B2', 'G#3', 'D4'], [('C#6', 1.5), ('B5', 0.5), ('A5', 2)], 'E4'),
    (36, ['A1', 'A2', 'E3', 'A3', 'C#4'], [('A5', 4)], 'A4'),
]
for bar, chord, cell, tenor in LIGHT:
    s.ped(bar)
    s.ped(bar, 3)
    s.ch(bar, 1, 2.9, chord, 'f', roll=0.035)
    s.ch(bar, 3, 1.9, chord, 'f', roll=0.03)
    s.n(bar, 1, 3.7, tenor, 'mf', off=0.015)      # the four notes, in the tenor
    beat = 1
    for name, dur in cell:
        s.n(bar, beat, dur * 0.96, name, 'ff', off=-0.03)
        beat += dur

# ============================================================================
# V. THE CURDLING (bars 37–40)
#
# One note. C sharp becomes C natural and A major becomes A minor — the same
# chord, the same bass, one finger a semitone to the left.
#
# And the texture goes with it. The chorale collapses into bare octaves: both
# hands playing the same line four octaves apart with no harmony under it at
# all. Unison is the loneliest sound a piano can make, and after eight bars of
# five-part writing it is the sound of everyone leaving.
# ============================================================================

UNISON = [
    (37, [('C6', 1.5), ('A5', 0.5), ('E5', 2)], 'ff'),
    (38, [('C6', 1.5), ('B5', 0.5), ('A5', 2)], 'ff'),
    (39, [('G5', 1.5), ('F#5', 0.5), ('E5', 2)], 'f'),
    (40, [('E#5', 1.5), ('D#5', 0.5), ('C#5', 2)], 'ff'),
]
for bar, cell, dyn in UNISON:
    s.ped(bar)
    beat = 1
    for name, dur in cell:
        for drop in (0, 1, 2, 3):
            s.n(bar, beat, dur * 0.9,
                name[:-1] + str(int(name[-1]) - drop), dyn, off=-0.02 + drop * 0.006)
        beat += dur

# ============================================================================
# VI. PRESTO AGITATO (bars 41–76)
#
# Semiquavers, both hands. Every bar is one chord taken up the keyboard and
# back, and the chords are the ground from section II an octave lower and four
# times as fast: the same descent that has been under everything since bar 7,
# now impossible to ignore.
#
# Three things keep it from being weather rather than music.
#
# **The bars with almost nothing in them.** Beethoven's Presto has bars of
# forty-one notes and bars of two, next to each other. An earlier version of
# this section had thirty-six bars of exactly sixteen, and measured against his
# it was more varied in every way except the one that matters.
#
# **The four notes in augmentation.** From bar 61 they are in the bottom octave
# at one note to the bar, four times slower than anything else and under all
# of it.
#
# **The subito piano at 59.** Same speed, same figure, nothing prepared.
# ============================================================================

def storm_bar(bar, chord, low, high, dyn, tune=None, accent='fff', step=0.25):
    """One chord, taken up the keyboard and back, in one bar.

    `step` of 0.25 is semiquavers and 0.125 is twice that — used only where the
    section has to go past what it has already been doing, since a torrent that
    has been at one speed for twenty bars is not a torrent any more."""
    s.ped(bar)
    s.ped(bar, 3)
    span = int(round(4 / step))
    notes = spread(chord, low, high)
    up = notes + notes[-2:0:-1]
    while len(up) < span:
        up = up + up
    s.run(bar, 1, step, up[:span], dyn, accent=accent,
          every=4 if step >= 0.25 else 8)
    if tune:
        s.octaves(bar, 1, [(tune, 3.7)], 'fff' if dyn in ('ff', 'fff') else dyn)


def hammer_bar(bar, root, dyn='fff'):
    """One octave, struck twice, and then two beats of nothing.

    Four notes in a bar, between bars of twenty-four. Beethoven's Presto puts
    bars of two next to bars of forty-one and that ratio is the whole reason it
    sounds like weather happening to somebody rather than weather."""
    s.ped(bar)
    for beat in (1, 2.5):
        s.n(bar, beat, 1.2, root, dyn)
        s.n(bar, beat, 1.2, root[:-1] + str(int(root[-1]) + 1), dyn)


GROUND_CHORDS = [
    (['F#1', 'A1', 'C#2'], 30), (['E#1', 'G#1', 'C#2'], 29),
    (['E1', 'A1', 'C#2'], 28), (['D#1', 'F#1', 'B1'], 27),
    (['D1', 'F#1', 'A1'], 26), (['C#1', 'E#1', 'G#1'], 25),
    (['B0', 'D1', 'F#1'], 23), (['C#1', 'E#1', 'G#1', 'B1'], 25),
]

# 41–48: it starts.
for i, (chord, low) in enumerate(GROUND_CHORDS):
    dyn = ['mf', 'mf', 'f', 'f', 'f', 'f', 'ff', 'ff'][i]
    tune = ['F#5', None, 'E5', None, 'D5', None, 'C#5', None][i]
    storm_bar(41 + i, chord, low, 66 + i * 2, dyn, tune)

# 49–50: and stops dead. Two bars, four chords, nothing else.
hammer_bar(49, 'F#1')
hammer_bar(50, 'C#1')

# 51–58: again, higher, and the tune is in every bar now.
for i, (chord, low) in enumerate(GROUND_CHORDS):
    tune = ['F#6', 'E#6', 'E6', 'D#6', 'D6', 'C#6', 'B5', 'C#6'][i]
    storm_bar(51 + i, chord, low, 78 + i, 'ff', tune)

# 59–60: subito piano. Same speed, same figure, and the bottom drops out of the
# volume with nothing prepared.
storm_bar(59, GROUND_CHORDS[0][0], 30, 66, 'p', 'F#4', accent=None)
storm_bar(60, GROUND_CHORDS[1][0], 29, 68, 'p', 'E#4', accent=None)

# 61–68: it builds again, and this time the four notes are in the bottom octave
# underneath, one to the bar — four times slower than anything above them,
# which is what augmentation is for.
AUGMENTED = ['F#1', 'F#1', 'E1', 'E1', 'D1', 'D1', 'C#1', 'C#1']
for i, (chord, low) in enumerate(GROUND_CHORDS):
    bar = 61 + i
    dyn = ['mp', 'mp', 'mf', 'mf', 'f', 'f', 'ff', 'ff'][i]
    tune = ['F#5', 'E#5', 'E5', 'D#5', 'D5', 'C#5', 'B5', 'C#6'][i]
    storm_bar(bar, chord, low, 74 + i * 2, dyn, tune,
              accent='fff' if dyn in ('ff', 'f') else None)
    s.n(bar, 1, 3.9, AUGMENTED[i], 'fff', off=0.01)
    s.n(bar, 1, 3.9, AUGMENTED[i][:-1] + '2', 'fff', off=0.01)

# 69–70: the hammer bars again, and louder.
hammer_bar(69, 'B0')
hammer_bar(70, 'C#1')

# 71–72: the Neapolitan, where no G major belongs. The only consolation in the
# whole storm, and it lasts two bars.
for bar in (71, 72):
    storm_bar(bar, ['G1', 'B1', 'D2'], 31, 86, 'fff')
s.octaves(71, 1, [('G6', 1.45), ('D6', 0.45), ('B5', 1.9)], 'fff')
s.sigh(72, 1, 1.5, 'D6', 'B5', 'fff')
s.bend(72, 3, 1.9, 'G5', 'fff')

# 73–74: a diminished seventh, which is in no key at all.
for bar in (73, 74):
    storm_bar(bar, ['E#1', 'G#1', 'B1', 'D2'], 29, 88, 'fff')
s.octaves(73, 1, [('D6', 3.7)], 'fff')
s.octaves(74, 1, [('B5', 1.9), ('G#5', 1.8)], 'fff')

# 75–76: the dominant, over a pedal point. The bass does not move for two bars
# while everything above it does, which is the oldest way of making an arrival
# unbearable before it arrives.
for bar in (75, 76):
    storm_bar(bar, ['C#1', 'E#1', 'G#1', 'B1'], 25, 85, 'fff', step=0.125)
    s.n(bar, 1, 3.9, 'C#1', 'fff', off=0.01)
    s.n(bar, 1, 3.9, 'C#2', 'fff', off=0.01)
s.octaves(75, 1, [('C#6', 3.7)], 'fff')
s.octaves(76, 1, [('B5', 1.45), ('A5', 0.45), ('G#5', 1.9)], 'fff')

# ============================================================================
# VII. THE CLIMAX (bars 77–84)
#
# The four notes descending in the right hand and the same four notes
# *inverted* — rising — in the left, at the same time, in octaves, four octaves
# apart. A subject against its own inversion is the thing counterpoint was
# invented to be able to do, and there is nowhere else in this piece where it
# would mean anything.
#
# Then the fall: every semitone from the top of the storm to the bottom of the
# instrument, in three octaves at once, getting quieter the whole way, which is
# worse than getting louder.
# ============================================================================

DOWN = ['F#6', 'E6', 'D6', 'C#6']
UP = ['F#1', 'G#1', 'A1', 'B1']
for i in range(4):
    bar = 77 + i
    storm_bar(bar, ['F#1', 'A1', 'C#2'], 30, 90, 'fff',
              step=0.125 if i >= 2 else 0.25)
    s.octaves(bar, 1, [(DOWN[i], 3.8)], 'fff')
    s.n(bar, 1, 3.8, UP[i], 'fff', off=0.012)
    s.n(bar, 1, 3.8, UP[i][:-1] + '2', 'fff', off=0.012)

for bar in (81, 82, 83, 84):
    s.ped(bar)
    s.ped(bar, 3)
for i in range(32):
    m = 90 - i
    bar = 81 + i // 8
    beat = 1 + (i % 8) * 0.5
    dyn = ['fff', 'ff', 'f', 'mf'][i // 8]
    s.n(bar, beat, 0.5, m, dyn)
    s.n(bar, beat, 0.5, m - 12, dyn)
    s.n(bar, beat, 0.5, max(21, m - 24), dyn)

# 85: what is left ringing has no key in it either.
s.ped(85)
s.ch(85, 1, 7, ['E#2', 'G#2', 'B2', 'D3', 'E#3'], 'p', roll=0.05)

# ============================================================================
# VIII. AFTER (bars 87–91)
#
# The opening, an octave and a half too low for it, and it cannot finish: three
# notes the first time, two the second. The last sound is the tonic low on the
# instrument with a G natural over it — the note the Neapolitan was built on,
# and the one note in the scale that cannot belong to this chord.
# ============================================================================

s.ped(87)
s.ch(87, 1, 6, ['F#1', 'F#2'], 'ppp', roll=0.09)
s.bend(87, 3, 1.45, 'F#3', 'pp')
s.n(87, 4.5, 0.45, 'E3', 'pp', off=-0.03)
s.n(88, 1, 3.4, 'D3', 'pp', off=-0.03)
s.ped(89)
s.n(89, 1, 3.6, 'C#3', 'ppp', off=-0.03)
s.ped(89, 3)
s.n(89, 3, 1.45, 'F#3', 'ppp', off=-0.04)
s.n(89, 4.5, 0.45, 'E3', 'ppp', off=-0.04)
s.n(90, 1, 2.4, 'D3', 'ppp', off=-0.04)         # and it stops there

s.ped(91)
s.ch(91, 1, 7, ['F#1', 'F#2'], 'ppp', roll=0.12)
s.n(91, 3, 5, 'G4', 'pp', off=-0.05)


# ============================================================================
# The performance
# ============================================================================

def tempo(beat):
    """Seconds per beat.

    The lament is slow and the storm is not, and the join between them is the
    curdling, which accelerates straight through. Nothing here is played at one
    speed for longer than twelve bars."""
    bar = beat / BEATS + 1
    if bar < 9:
        bpm = 56
    elif bar < 21:
        bpm = 58 + (bar - 9) * 1.2              # the ground takes hold
    elif bar < 27:
        bpm = 74 + (bar - 21) * 1.5             # the climb pushes
    elif bar < 28:
        bpm = 62                                # the glimpse holds still
    elif bar < 29:
        bpm = 80
    elif bar < 37:
        bpm = 72                                # the light, broad
    elif bar < 41:
        bpm = 80 + (bar - 37) * 14              # the curdling accelerates
    elif bar < 49:
        bpm = 138                               # presto agitato
    elif bar < 51:
        bpm = 116                               # the hammer bars, given room
    elif bar < 59:
        bpm = 144
    elif bar < 61:
        bpm = 138                               # the subito piano, a shade back
    elif bar < 69:
        bpm = 142 + (bar - 61)                  # and climbing again
    elif bar < 71:
        bpm = 116                               # the hammer bars again
    elif bar < 77:
        bpm = 152                               # it does not let up
    elif bar < 81:
        bpm = 138                               # the climax, held back to land
    elif bar < 85:
        bpm = 148
    elif bar < 87:
        bpm = 58
    else:
        bpm = 50 - min(8, (bar - 87) * 1.6)     # and stopping
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
        out.append((max(0.0, beat + r1 * 0.012), dur, note,
                    max(0.02, min(0.97, vel * (1 + r2 * 0.12)))))
    return out


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/falling.wav'
    info = render(humanise(s.notes), out, pedal=sorted(set(s.pedals)),
                  tempo=tempo, tail=7.0)
    print(f"{info['notes']} notes · {info['seconds']:.0f}s · "
          f"peak {info['peak_dbfs']:.1f} dBFS → {out}")
