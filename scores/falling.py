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
    IV   THE LIGHT      A major. The same four notes — A, G#, F#, E — and in
                        this key they are the most ordinary consoling phrase
                        in music. Nothing has been added or taken away
    V    THE CURDLING   C sharp becomes C natural, and it does not calm down
    VI   PRESTO AGITATO the storm. Semiquavers, both hands, thirty-six bars,
                        and the four notes at the top of every second arpeggio
    VII  THE CLIMAX     the tonic, five octaves of it, and then the fall
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

LIGHT = [
    (29, ['A1', 'C#2', 'E2'], [('A5', 1.5), ('G#5', 0.5), ('F#5', 2)]),
    (30, ['E1', 'G#1', 'B1'], [('E5', 1.5), ('F#5', 0.5), ('G#5', 2)]),
    (31, ['A1', 'C#2', 'E2'], [('A5', 1.5), ('B5', 0.5), ('C#6', 2)]),
    (32, ['D1', 'F#1', 'A1'], [('D6', 1.5), ('C#6', 0.5), ('B5', 2)]),
    (33, ['E1', 'G#1', 'B1'], [('C#6', 1.5), ('B5', 0.5), ('A5', 2)]),
    (34, ['A1', 'C#2', 'E2'], [('A5', 4)]),
]
for bar, chord, cell in LIGHT:
    s.ped(bar)
    s.ped(bar, 3)
    s.run(bar, 1, 0.25, spread(chord, pitch(chord[0]), 79), 'ff', accent='fff')
    s.octaves(bar, 1, cell, 'fff')

# ============================================================================
# V. THE CURDLING (bars 35–38)
#
# One note. C sharp becomes C natural and A major becomes A minor — the same
# chord, the same bass, the same figuration, one finger a semitone to the left.
# Everything after it is consequence: the bass walks down, a diminished seventh
# takes the floor away, and by bar 38 there is no key left to be in.
#
# And it does not calm down. It accelerates.
# ============================================================================

CURDLE = [
    (35, ['A1', 'C2', 'E2'], [('C6', 1.5), ('A5', 0.5), ('E5', 2)]),
    (36, ['G#1', 'B1', 'D2', 'F2'], [('B5', 1.5), ('A5', 0.5), ('F5', 2)]),
    (37, ['G1', 'B1', 'D2'], [('G5', 1.5), ('F#5', 0.5), ('E5', 2)]),
    (38, ['C#1', 'E#1', 'G#1', 'B1'], [('E#5', 1.5), ('D#5', 0.5), ('C#5', 2)]),
]
for bar, chord, cell in CURDLE:
    s.ped(bar)
    s.ped(bar, 3)
    s.run(bar, 1, 0.25, spread(chord, pitch(chord[0]), 72), 'ff', accent='fff')
    s.octaves(bar, 1, cell, 'fff')

# ============================================================================
# VI. PRESTO AGITATO (bars 39–70)
#
# Semiquavers, both hands, and nothing in the section slower than a crotchet.
# Each bar is one chord taken up the whole keyboard and back down again, and
# every second bar has the four notes over the top of it in octaves — which is
# all that is left of the tune, and is enough.
#
# The chords are the ground from section II, an octave lower and four times as
# fast: the same descent, F#, E#, E, D#, D, C#, B, C#, that has been under
# everything since bar 9. It has not changed. What has changed is that it is
# now impossible to ignore.
# ============================================================================

#
# It also has a shape. A storm at one volume for thirty bars is weather, not
# music: this one starts at forte, builds for sixteen bars, and then at 55 —
# with no warning and nothing prepared — drops to piano and starts again from
# underneath. The hole in the middle is what makes the second half possible.
STORM = [
    # bar, chord, lowest, highest, the note in the tune, how loud
    (39, ['F#1', 'A1', 'C#2'], 30, 66, None, 'mf'),
    (40, ['F#1', 'A1', 'C#2'], 30, 69, 'F#5', 'mf'),
    (41, ['E#1', 'G#1', 'C#2'], 29, 68, None, 'f'),
    (42, ['E#1', 'G#1', 'C#2'], 29, 71, 'E5', 'f'),
    (43, ['E1', 'A1', 'C#2'], 28, 69, None, 'f'),
    (44, ['E1', 'A1', 'C#2'], 28, 73, 'D5', 'f'),
    (45, ['D#1', 'F#1', 'B1'], 27, 71, None, 'f'),
    (46, ['D#1', 'F#1', 'B1'], 27, 74, 'C#5', 'ff'),
    (47, ['D1', 'F#1', 'A1'], 26, 73, None, 'ff'),
    (48, ['D1', 'F#1', 'A1'], 26, 76, 'B5', 'ff'),
    (49, ['C#1', 'E#1', 'G#1'], 25, 75, None, 'ff'),
    (50, ['C#1', 'E#1', 'G#1'], 25, 78, 'A5', 'ff'),
    (51, ['B0', 'D1', 'F#1'], 23, 76, None, 'ff'),
    (52, ['B0', 'D1', 'F#1'], 23, 79, 'G#5', 'ff'),
    (53, ['C#1', 'E#1', 'G#1', 'B1'], 25, 78, None, 'ff'),
    (54, ['C#1', 'E#1', 'G#1', 'B1'], 25, 81, 'F#5', 'ff'),

    # 55: subito piano. Same speed, same figure, nothing else changed.
    (55, ['F#1', 'A1', 'C#2'], 30, 66, 'F#4', 'p'),
    (56, ['E#1', 'G#1', 'C#2'], 29, 68, 'E#4', 'p'),
    (57, ['E1', 'A1', 'C#2'], 28, 69, 'E4', 'mp'),
    (58, ['D#1', 'F#1', 'B1'], 27, 71, 'D#4', 'mp'),
    (59, ['D1', 'F#1', 'A1'], 26, 74, 'D5', 'mf'),
    (60, ['C#1', 'E#1', 'G#1'], 25, 76, 'C#5', 'mf'),
    (61, ['B0', 'D1', 'F#1'], 23, 78, 'B5', 'f'),
    (62, ['C#1', 'E#1', 'G#1', 'B1'], 25, 81, 'C#6', 'f'),
    (63, ['F#1', 'A1', 'C#2'], 30, 83, 'F#6', 'ff'),
    (64, ['E#1', 'G#1', 'C#2'], 29, 85, 'E#6', 'ff'),
    (65, ['E1', 'A1', 'C#2'], 28, 85, 'E6', 'ff'),
    (66, ['D#1', 'F#1', 'B1'], 27, 87, 'D#6', 'fff'),
]
for bar, chord, low, high, tune, dyn in STORM:
    s.ped(bar)
    s.ped(bar, 3)
    notes = spread(chord, low, high)
    up = notes + notes[-2:0:-1]
    while len(up) < 16:
        up = up + up
    s.run(bar, 1, 0.25, up[:16], dyn,
          accent='fff' if dyn in ('ff', 'fff') else None)
    if tune:
        s.octaves(bar, 1, [(tune, 3.7)], dyn if dyn in ('p', 'mp', 'mf') else 'fff')

# 67–68: the Neapolitan, where no G major belongs. The only consolation in
# the whole storm, and it lasts two bars.
for bar in (67, 68):
    s.ped(bar)
    s.ped(bar, 3)
    s.run(bar, 1, 0.25, spread(['G1', 'B1', 'D2'], 31, 86)[:16], 'fff')
s.octaves(67, 1, [('G6', 1.45), ('D6', 0.45), ('B5', 1.9)], 'fff')
s.sigh(68, 1, 1.5, 'D6', 'B5', 'fff')
s.bend(68, 3, 1.9, 'G5', 'fff')

# 69–70: a diminished seventh, which is in no key at all.
for bar in (69, 70):
    s.ped(bar)
    s.ped(bar, 3)
    s.run(bar, 1, 0.25, spread(['E#1', 'G#1', 'B1', 'D2'], 29, 88)[:16], 'fff')
s.octaves(69, 1, [('D6', 3.7)], 'fff')
s.octaves(70, 1, [('B5', 1.9), ('G#5', 1.8)], 'fff')

# 71–74: the dominant. Four bars of it, which is three longer than anyone can
# stand, and that is the point.
for bar in (71, 72, 73, 74):
    s.ped(bar)
    s.ped(bar, 3)
    s.run(bar, 1, 0.25, spread(['C#1', 'E#1', 'G#1', 'B1'], 25, 85)[:16], 'fff')
s.octaves(71, 1, [('C#6', 3.7)], 'fff')
s.octaves(72, 1, [('B5', 3.7)], 'fff')
s.octaves(73, 1, [('A5', 1.9), ('G#5', 1.8)], 'fff')
s.octaves(74, 1, [('A5', 1.45), ('G#5', 0.45), ('E#5', 1.9)], 'fff')

# ============================================================================
# VII. THE CLIMAX (bars 75–82)
#
# F sharp minor, five octaves of it, and the four notes come down through the
# middle in octaves for the last time. Then the fall: every semitone from the
# top of the storm to the bottom of the instrument, in three octaves at once,
# getting quieter the whole way — which is worse than getting louder.
# ============================================================================

for bar in (75, 76, 77, 78):
    s.ped(bar)
    s.ped(bar, 3)
    s.run(bar, 1, 0.25, spread(['F#1', 'A1', 'C#2'], 30, 90)[:16], 'fff')
s.ch(75, 1, 3.8, ['F#1', 'F#2', 'C#3', 'F#3'], 'fff', roll=0.02)
s.octaves(75, 1, [('F#6', 3.7)], 'fff')
s.octaves(76, 1, [('E6', 1.45), ('D6', 0.45), ('C#6', 1.9)], 'fff')
s.ch(77, 1, 3.8, ['F#1', 'F#2', 'C#3', 'F#3'], 'fff', roll=0.02)
s.octaves(77, 1, [('F#6', 3.7)], 'fff')
s.octaves(78, 1, [('E6', 1.45), ('D6', 0.45), ('C#6', 1.9)], 'fff')

for bar in (79, 80, 81, 82):
    s.ped(bar)
    s.ped(bar, 3)
for i in range(32):
    m = 90 - i
    bar = 79 + i // 8
    beat = 1 + (i % 8) * 0.5
    dyn = ['fff', 'ff', 'f', 'mf'][i // 8]
    s.n(bar, beat, 0.5, m, dyn)
    s.n(bar, beat, 0.5, m - 12, dyn)
    s.n(bar, beat, 0.5, max(21, m - 24), dyn)

# 83: what is left ringing has no key in it either.
s.ped(83)
s.ch(83, 1, 7, ['E#2', 'G#2', 'B2', 'D3', 'E#3'], 'p', roll=0.05)

# ============================================================================
# VIII. AFTER (bars 85–89)
#
# The opening, an octave and a half too low for it, and it cannot finish: three
# notes the first time, two the second. The last sound is the tonic low on the
# instrument with a G natural over it — the note the Neapolitan was built on,
# and the one note in the scale that cannot belong to this chord.
# ============================================================================

s.ped(85)
s.ch(85, 1, 6, ['F#1', 'F#2'], 'ppp', roll=0.09)
s.bend(85, 3, 1.45, 'F#3', 'pp')
s.n(85, 4.5, 0.45, 'E3', 'pp', off=-0.03)
s.n(86, 1, 3.4, 'D3', 'pp', off=-0.03)
s.ped(87)
s.n(87, 1, 3.6, 'C#3', 'ppp', off=-0.03)

s.ped(87, 3)
s.n(87, 3, 1.45, 'F#3', 'ppp', off=-0.04)
s.n(87, 4.5, 0.45, 'E3', 'ppp', off=-0.04)
s.n(88, 1, 2.4, 'D3', 'ppp', off=-0.04)         # and it stops there

s.ped(89)
s.ch(89, 1, 7, ['F#1', 'F#2'], 'ppp', roll=0.12)
s.n(89, 3, 5, 'G4', 'pp', off=-0.05)


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
    elif bar < 35:
        bpm = 76                                # the light, broad
    elif bar < 39:
        bpm = 84 + (bar - 35) * 13              # the curdling accelerates
    elif bar < 55:
        bpm = 138                               # presto agitato
    elif bar < 59:
        bpm = 132                               # the subito piano, a shade back
    elif bar < 67:
        bpm = 140 + (bar - 59)                  # and climbing again
    elif bar < 75:
        bpm = 150                               # it does not let up
    elif bar < 79:
        bpm = 138                               # the climax, held back to land
    elif bar < 83:
        bpm = 146
    elif bar < 85:
        bpm = 58
    else:
        bpm = 50 - min(8, (bar - 85) * 1.6)     # and stopping
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
