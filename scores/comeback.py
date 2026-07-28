#!/usr/bin/env python3
"""COME BACK — nocturne for grand piano, in C minor.

One phrase. It reaches up a minor sixth, holds there, and walks back down, and
that is the whole piece: it is asked thirty-odd times and never once answered.
The last time it is asked it does not get to the end.

Everything about how it is built came from measuring pieces people have not
been able to stop humming for two hundred years — Chopin's Nocturne Op. 9 No. 2
and three of the Preludes, the Pathétique's Adagio cantabile, both outer
movements of the Moonlight — and then from reading how the phrases in them are
actually put together.

**What the measurements said.**

    four-note figures occurring more than once, as a share of the melody

        Chopin, Nocturne Op. 9 No. 2 ......... 71%
        Beethoven, Pathétique II ............. 46%
        Beethoven, Moonlight I ............... 41%
        an earlier piece of mine ............. 12%

Famous melodies are not inventive. They say the same small thing over and over,
changing one note at a time, and by the fourth time you own it. Development is
what happens *after* that, and a piece that develops from bar one never lets
anybody own anything. Two thirds of the motion in those melodies is by step;
the leaps are rare and each is an event. Their phrases sit inside an octave.

The apex — the highest note in the piece — falls at 65%, 67%, 80% and 93% of
the way through in four of the five. Not in the middle. Late.

Their bass notes change every half beat to every beat. In an earlier draft of
this piece the harmony moved once a bar and the whole thing sat still.

**What the reading said.** Classical phrases have *functions*, not just
lengths, and the functions are what make an eight-bar span feel inevitable
rather than merely finished:

    presentation   a two-bar basic idea, then the same idea again — exact, or
                   answered on the dominant, or sequenced up a step. Harmony
                   stays on the tonic. Nothing happens, on purpose
    continuation   fragmentation: the two-bar unit becomes one bar, then half
                   a bar. Harmony accelerates — one chord a bar becomes two,
                   then four. This is where the tension comes from and it is
                   structural, not dynamic
    cadential      the line descends, the motif is liquidated down to nothing
                   characteristic, and the cadence closes it

So the piece is written to those functions:

    A     1–16   a period (1–8, half cadence then perfect authentic) and then
                 a sentence (9–16) whose continuation fragments the phrase and
                 doubles the harmonic rhythm twice
    B    17–32   E flat major. The same phrase, and a minor sixth in the major
                 means the opposite. It is the only place the answer seems to
                 be yes, and it curdles one note at a time
    A'   33–48   the phrase in octaves, the accompaniment doubled
    C    49–62   the apex, at 72% of the way through, reached by five
                 statements a step apart over a bass walking the other way,
                 and closed with a cadential six-four — the gesture that makes
                 an arrival sound like one
    coda 63–72   the accompaniment stops. Three more askings, each lower, and
                 the last stops on the note it was reaching for

Run:  python3 scores/comeback.py out.wav
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'dev'))
from piano import DYN, pitch, render          # noqa: E402

#: 12/8 — four beats to the bar and each of them three quavers, which is what
#: gives a nocturne its limp. A bar of four is even; a bar of four threes is
#: not, and the ear never quite settles into it.
BEATS = 4
E = 1 / 3                                     # one quaver


class Score:
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
        for i, name in enumerate(names):
            self.n(bar, beat, dur - i * roll, name, dyn, roll * i, off)

    def seq(self, bar, beat, dur, names, dyn, off=0.0):
        for i, name in enumerate(names):
            self.n(bar, beat + i * dur, dur * 1.6, name, dyn, 0.0, off)

    def ped(self, bar, beat=1):
        self.pedals.append(self.at(bar, beat))


s = Score()

# ============================================================================
# The left hand
#
# Bass, fifth, octave — and then tenth, octave, fifth — rocking up and back
# down, twice a bar, in quavers. It is the left hand of every nocturne ever
# written and there is a reason: it holds a bass note under the ear for a whole
# bar while putting something in the middle of the texture on every quaver, so
# the tune can be as slow as it likes and the piece still moves.
# ============================================================================

CHORDS = {
    # C minor
    'i':     ('C2', 'G2', 'C3', 'Eb3'),
    'i6':    ('Eb2', 'C3', 'Eb3', 'G3'),
    'i64':   ('G1', 'C3', 'Eb3', 'G3'),        # the cadential six-four
    'iv':    ('F2', 'C3', 'F3', 'Ab3'),
    'iv6':   ('Ab1', 'F2', 'Ab2', 'C3'),
    'iio6':  ('F2', 'D3', 'F3', 'Ab3'),
    'V':     ('G1', 'D2', 'G2', 'B2'),
    'V7':    ('G1', 'F2', 'G2', 'B2'),
    'V43':   ('D2', 'F2', 'G2', 'B2'),
    'VI':    ('Ab1', 'Eb2', 'Ab2', 'C3'),
    'III':   ('Eb2', 'Bb2', 'Eb3', 'G3'),
    'N6':    ('F2', 'Db3', 'F3', 'Ab3'),       # the Neapolitan, in its place
    'V/V':   ('D2', 'A2', 'D3', 'F#3'),
    'V/iv':  ('C2', 'Bb2', 'C3', 'E3'),
    'viio7': ('B1', 'F2', 'Ab2', 'D3'),
    # E flat major
    'I_':    ('Eb2', 'Bb2', 'Eb3', 'G3'),
    'IV_':   ('Ab1', 'Eb2', 'Ab2', 'C3'),
    'V_':    ('Bb1', 'F2', 'Bb2', 'D3'),
    'vi_':   ('C2', 'G2', 'C3', 'Eb3'),
    'ii_':   ('F2', 'C3', 'F3', 'Ab3'),
    'V/vi_': ('G1', 'D2', 'G2', 'B2'),
}


def rock(bar, names, dyn='p', octaves=False):
    """One bar of the figure. `names` is one chord for the bar, or two, or
    four — which is how the harmonic rhythm accelerates without anything else
    in the texture changing."""
    if isinstance(names, str):
        names = [names] * 4
    elif len(names) == 2:
        names = [names[0], names[0], names[1], names[1]]
    for beat, key in enumerate(names, start=1):
        lo, fifth, oct_, tenth = CHORDS[key]
        cell = [lo, fifth, oct_] if beat % 2 else [tenth, oct_, fifth]
        s.seq(bar, beat, E, cell, dyn)
        if octaves and beat % 2:
            s.n(bar, beat, 1.9, lo[:-1] + str(int(lo[-1]) - 1), dyn, off=0.012)


# ============================================================================
# The phrase
#
#     G4  ———  Eb5 ————  D5 —  C5
#      └ a minor sixth ┘  └ and back down by step ┘
#
# One leap, two steps, four notes. The leap is the only one in the piece: a
# rising minor sixth is what music has always used for wanting something, and
# the gap it opens is filled by walking back down through it, which is what
# ears expect a leap to do and what makes the shape feel finished rather than
# merely stopped.
# ============================================================================

def call(bar, top, dyn, tail=None, lead='G4', beat=1, hold=1.5, oct_below=False):
    """One statement. `top` is where the sixth lands."""
    def put(name, at, dur):
        s.n(bar, at, dur, name, dyn, off=-0.024)
        if oct_below:
            s.n(bar, at, dur, name[:-1] + str(int(name[-1]) - 1), dyn, off=-0.024)
    put(lead, beat, 0.9)
    put(top, beat + 1, hold)
    if tail:
        put(tail[0], beat + 2.6, 0.38)
        put(tail[1], beat + 3, 1.2)


def fall(bar, cells, dyn, oct_below=False):
    """The walk down that answers it: (note, beat, length)."""
    for name, beat, dur in cells:
        s.n(bar, beat, dur, name, dyn, off=-0.02)
        if oct_below:
            s.n(bar, beat, dur, name[:-1] + str(int(name[-1]) - 1), dyn, off=-0.02)


# ============================================================================
# A — bars 1–16
#
# Bars 1–8 are a period: a four-bar antecedent that stops on the dominant
# without closing, and a four-bar consequent that says the same thing and does
# close. Bars 9–16 are a sentence, and its continuation is where the piece
# first accelerates — the two-bar unit becomes one bar and then half a bar,
# and the harmony goes from one chord a bar to two and then to four.
# ============================================================================

# --- antecedent: basic idea, contrasting idea, half cadence ----------------
for bar, harm in [(1, 'i'), (2, 'VI'), (3, 'iv'), (4, ['iio6', 'V'])]:
    s.ped(bar)
    s.ped(bar, 3)
    rock(bar, harm, 'pp')
call(1, 'Eb5', 'p', ('D5', 'C5'))
fall(2, [('Bb4', 1, 1.4), ('Ab4', 2.6, 0.38), ('G4', 3, 1.9)], 'p')
call(3, 'F5', 'p', ('Eb5', 'D5'), lead='Ab4')
fall(4, [('C5', 1, 1.4), ('B4', 2.6, 0.38), ('D5', 3, 1.9)], 'p')   # half cadence

# --- consequent: the same, and this time it closes ------------------------
for bar, harm in [(5, 'i'), (6, 'VI'), (7, ['iv', 'iio6']), (8, ['i64', 'V7'])]:
    s.ped(bar)
    s.ped(bar, 3)
    rock(bar, harm, 'pp')
call(5, 'Eb5', 'p', ('D5', 'C5'))
fall(6, [('Bb4', 1, 1.4), ('Ab4', 2.6, 0.38), ('G4', 3, 1.9)], 'p')
call(7, 'F5', 'mp', ('Eb5', 'D5'), lead='Ab4')
fall(8, [('Eb5', 1, 1.4), ('D5', 2.6, 0.38), ('C5', 3, 1.9)], 'mp')  # perfect authentic
s.ped(9)
rock(9, 'i', 'pp')

# --- sentence: presentation (9–12) ----------------------------------------
for bar, harm in [(10, 'i'), (11, 'III'), (12, 'III')]:
    s.ped(bar)
    s.ped(bar, 3)
    rock(bar, harm, 'p')
call(9, 'Eb5', 'p', ('D5', 'C5'))
fall(10, [('Bb4', 1, 1.4), ('Ab4', 2.6, 0.38), ('G4', 3, 1.9)], 'p')
call(11, 'G5', 'mp', ('F5', 'Eb5'), lead='Bb4')      # sequenced up a third
fall(12, [('D5', 1, 1.4), ('Eb5', 2.6, 0.38), ('F5', 3, 1.9)], 'mp')

# --- continuation: fragmentation, and the harmony doubles twice -----------
#
# The phrase loses its tail and becomes just the reach, twice in bar 13. In
# bar 14 it loses the reach too and becomes two notes, four times. Nothing has
# been added — things have been taken away, and it is the taking away that
# tightens.
s.ped(13)
s.ped(13, 3)
rock(13, ['iv', 'V/V'], 'mp')
call(13, 'F5', 'mf', None, lead='Ab4', hold=0.9)
call(13, 'F#5', 'mf', None, lead='A4', beat=3, hold=0.9)

s.ped(14)
s.ped(14, 2)
s.ped(14, 3)
s.ped(14, 4)
rock(14, ['V', 'viio7', 'i6', 'iv'], 'mp')
for beat, (a, b) in zip((1, 2, 3, 4), [('G5', 'F5'), ('F5', 'Eb5'),
                                       ('Eb5', 'D5'), ('D5', 'C5')]):
    s.n(14, beat, 0.55, a, 'mp', off=-0.02)
    s.n(14, beat + 0.6, 0.4, b, 'mp', off=-0.02)

# --- cadential ------------------------------------------------------------
s.ped(15)
s.ped(15, 3)
rock(15, ['i64', 'V7'], 'mp')
fall(15, [('C5', 1, 1.4), ('B4', 2.6, 0.38), ('D5', 3, 1.9)], 'mp')
s.ped(16)
rock(16, 'i', 'p')
fall(16, [('C5', 1, 3.4)], 'p')

# ============================================================================
# B — bars 17–32
#
# E flat major, the relative. The same four notes, and a rising minor sixth in
# the major means the opposite of what it means in the minor. This is the only
# stretch in which the answer seems to be yes.
#
# It goes back one note at a time: an A flat in bar 26, a D flat in bar 28, and
# by 30 it is a Neapolitan sixth in C minor and there was never any question.
# ============================================================================

B = [(17, 'I_'), (18, 'I_'), (19, 'IV_'), (20, 'I_'),
     (21, 'ii_'), (22, 'V_'), (23, 'I_'), (24, ['V/vi_', 'V_']),
     (25, 'I_'), (26, 'vi_'), (27, 'IV_'), (28, ['ii_', 'V_']),
     (29, 'N6'), (30, ['N6', 'V7']), (31, ['i64', 'V7']), (32, 'i')]
for bar, harm in B:
    s.ped(bar)
    s.ped(bar, 3)
    rock(bar, harm, 'p' if bar < 25 else 'mp')

call(17, 'G5', 'mp', ('F5', 'Eb5'), lead='Bb4')
fall(18, [('D5', 1, 1.4), ('Eb5', 2.6, 0.38), ('F5', 3, 1.9)], 'mp')
call(19, 'Ab5', 'mp', ('G5', 'F5'), lead='C5')
fall(20, [('Eb5', 1, 1.4), ('F5', 2.6, 0.38), ('G5', 3, 1.9)], 'mp')
call(21, 'Bb5', 'mp', ('Ab5', 'G5'), lead='D5')
fall(22, [('F5', 1, 1.4), ('Eb5', 2.6, 0.38), ('D5', 3, 1.9)], 'mp')
call(23, 'G5', 'mp', ('F5', 'Eb5'), lead='Bb4')
fall(24, [('D5', 1, 3.4)], 'mp')

call(25, 'G5', 'mp', ('F5', 'Eb5'), lead='Bb4')
fall(26, [('C5', 1, 1.4), ('Bb4', 2.6, 0.38), ('Ab4', 3, 1.9)], 'mp')  # A flat
call(27, 'F5', 'mp', ('Eb5', 'D5'), lead='Ab4')
fall(28, [('C5', 1, 1.4), ('Db5', 2.6, 0.38), ('C5', 3, 1.9)], 'mp')   # D flat
fall(29, [('Db5', 1, 2.4), ('C5', 3, 1.4)], 'mp')
fall(30, [('Db5', 1, 1.4), ('C5', 2.6, 0.38), ('B4', 3, 1.9)], 'mp')
fall(31, [('C5', 1, 1.4), ('B4', 2.6, 0.38), ('D5', 3, 1.9)], 'mp')
fall(32, [('C5', 1, 3.4)], 'mp')

# ============================================================================
# A' — bars 33–48
#
# The same sixteen bars, in octaves, over the same figure with the bass doubled
# an octave down. Nothing new is said; it is said harder. That is what a
# reprise is for, and a reprise that develops is not a reprise.
# ============================================================================

REPRISE = [(33, 'i'), (34, 'VI'), (35, 'iv'), (36, ['iio6', 'V']),
           (37, 'i'), (38, 'VI'), (39, ['iv', 'iio6']), (40, ['i64', 'V7']),
           (41, 'i'), (42, 'i'), (43, 'III'), (44, 'III'),
           (45, ['iv', 'V/V']), (46, ['V', 'viio7', 'i6', 'iv']),
           (47, ['i64', 'V7']), (48, 'i')]
for bar, harm in REPRISE:
    s.ped(bar)
    s.ped(bar, 3)
    rock(bar, harm, 'f', octaves=True)

call(33, 'Eb5', 'f', ('D5', 'C5'), oct_below=True)
fall(34, [('Bb4', 1, 1.4), ('Ab4', 2.6, 0.38), ('G4', 3, 1.9)], 'f', oct_below=True)
call(35, 'F5', 'f', ('Eb5', 'D5'), lead='Ab4', oct_below=True)
fall(36, [('C5', 1, 1.4), ('B4', 2.6, 0.38), ('D5', 3, 1.9)], 'f', oct_below=True)
call(37, 'Eb5', 'ff', ('D5', 'C5'), oct_below=True)
fall(38, [('Bb4', 1, 1.4), ('Ab4', 2.6, 0.38), ('G4', 3, 1.9)], 'ff', oct_below=True)
call(39, 'F5', 'ff', ('Eb5', 'D5'), lead='Ab4', oct_below=True)
fall(40, [('Eb5', 1, 1.4), ('D5', 2.6, 0.38), ('C5', 3, 1.9)], 'ff', oct_below=True)
call(41, 'Eb5', 'ff', ('D5', 'C5'), oct_below=True)
fall(42, [('Bb4', 1, 1.4), ('Ab4', 2.6, 0.38), ('G4', 3, 1.9)], 'ff', oct_below=True)
call(43, 'G5', 'ff', ('F5', 'Eb5'), lead='Bb4', oct_below=True)
fall(44, [('D5', 1, 1.4), ('Eb5', 2.6, 0.38), ('F5', 3, 1.9)], 'ff', oct_below=True)
call(45, 'F5', 'ff', None, lead='Ab4', hold=0.9, oct_below=True)
call(45, 'F#5', 'ff', None, lead='A4', beat=3, hold=0.9, oct_below=True)
for beat, (a, b) in zip((1, 2, 3, 4), [('G5', 'F5'), ('F5', 'Eb5'),
                                       ('Eb5', 'D5'), ('D5', 'C5')]):
    s.n(46, beat, 0.55, a, 'ff', off=-0.02)
    s.n(46, beat, 0.55, a[:-1] + str(int(a[-1]) - 1), 'ff', off=-0.02)
    s.n(46, beat + 0.6, 0.4, b, 'ff', off=-0.02)
fall(47, [('C5', 1, 1.4), ('B4', 2.6, 0.38), ('D5', 3, 1.9)], 'ff', oct_below=True)
fall(48, [('C5', 1, 3.4)], 'f', oct_below=True)

# ============================================================================
# C — bars 49–62
#
# The apex, and it is at seventy-two per cent of the way through because that
# is where the measured ones are — sixty-five, sixty-seven, eighty, ninety-three
# in the four pieces that had one. Not in the middle.
#
# Five statements of the phrase a step apart, over a bass walking the other
# way, and then a cadential six-four: the tonic chord over the dominant in the
# bass, which is not a tonic at all — it is a dominant with the tonic leaning
# on it, and it has to fall. Nothing else in tonal music makes an arrival sound
# as much like one.
# ============================================================================

RISE = [('i', 'Eb5', 'G4'), ('iv', 'F5', 'Ab4'), ('N6', 'Gb5', 'Bb4'),
        ('V/V', 'A5', 'C#5'), ('viio7', 'C6', 'Eb5')]
for i, (harm, top, lead) in enumerate(RISE):
    bar = 49 + i * 2
    for b in (bar, bar + 1):
        s.ped(b)
        s.ped(b, 3)
        rock(b, harm, 'ff', octaves=True)
    call(bar, top, 'fff', lead=lead, oct_below=True)
    d = pitch(top)
    for name, beat, dur in [(d - 2, 1, 1.4), (d - 3, 2.6, 0.38), (d - 5, 3, 1.9)]:
        s.n(bar + 1, beat, dur, name, 'fff', off=-0.02)
        s.n(bar + 1, beat, dur, name - 12, 'fff', off=-0.02)

# 59–60: the six-four, held, with everything on it. The apex is here.
for bar in (59, 60):
    s.ped(bar)
    s.ped(bar, 3)
    rock(bar, 'i64' if bar == 59 else 'V7', 'fff', octaves=True)
    s.n(bar, 1, 3.9, 'G1', 'fff', off=0.012)  # the lowest G a piano has
call(59, 'Eb6', 'fff', lead='G5', hold=2.6, oct_below=True)
fall(60, [('D6', 1, 1.4), ('C6', 2.6, 0.38), ('B5', 3, 1.9)], 'fff', oct_below=True)

# 61–62: and it falls, as a six-four must.
s.ped(61)
s.ped(61, 3)
rock(61, ['V7', 'V7'], 'ff', octaves=True)
fall(61, [('C6', 1, 1.4), ('B5', 2.6, 0.38), ('D6', 3, 1.9)], 'ff', oct_below=True)
s.ped(62)
rock(62, 'i', 'f', octaves=True)
fall(62, [('C6', 1, 3.6)], 'f', oct_below=True)

# ============================================================================
# coda — bars 63–72
#
# The accompaniment stops. Three more askings with almost nothing under them,
# each lower and quieter than the last, and the third gets as far as the note
# it was reaching for and no further.
# ============================================================================

s.ped(63)
s.ch(63, 1, 3.8, ['C2', 'G2', 'C3', 'Eb3'], 'p', roll=0.05)
call(63, 'Eb5', 'mp', ('D5', 'C5'))

s.ped(65)
s.ch(65, 1, 3.8, ['Ab1', 'Eb2', 'Ab2', 'C3'], 'pp', roll=0.05)
call(65, 'Eb5', 'p', ('D5', 'C5'))

s.ped(67)
s.ch(67, 1, 3.8, ['F2', 'C3', 'F3', 'Ab3'], 'pp', roll=0.06)
call(67, 'C5', 'pp', ('Bb4', 'Ab4'), lead='Eb4')

s.ped(69)
s.ch(69, 1, 5, ['G1', 'D2', 'G2', 'B2'], 'ppp', roll=0.07)
s.n(69, 1, 0.9, 'G4', 'pp', off=-0.02)
s.n(69, 2, 3.4, 'Eb5', 'pp', off=-0.03)

s.ped(71)
s.ch(71, 1, 9, ['C1', 'C2', 'G2', 'C3'], 'ppp', roll=0.11)
s.n(71, 1, 0.9, 'G4', 'ppp', off=-0.02)
s.n(71, 2, 6.5, 'Eb5', 'ppp', off=-0.03)       # and the last one, alone


# ============================================================================
# The performance
# ============================================================================

def tempo(beat):
    """Seconds per dotted crotchet. A nocturne is not played in time: it leans
    into the top of a phrase and takes the time back coming down, and the only
    place it is strict is where it is loudest."""
    bar = beat / BEATS + 1
    if bar < 13:
        bpm = 44 + (bar - 1) * 0.2
    elif bar < 17:
        bpm = 47 + (bar - 13) * 0.8             # the continuation pushes
    elif bar < 25:
        bpm = 48
    elif bar < 33:
        bpm = 48 - (bar - 25) * 0.3
    elif bar < 45:
        bpm = 47 + (bar - 33) * 0.2
    elif bar < 49:
        bpm = 50 + (bar - 45) * 0.8
    elif bar < 59:
        bpm = 54                                # the rise, strict
    elif bar < 61:
        bpm = 46                                # the six-four, given its time
    elif bar < 63:
        bpm = 50
    elif bar < 69:
        bpm = 40                                # the coda drags
    else:
        bpm = 36 - min(6, (bar - 69) * 1.2)
    return 60.0 / bpm


def humanise(notes, seed=11):
    out = []
    state = seed
    for beat, dur, note, vel in sorted(notes):
        state = (state * 1103515245 + 12345) & 0x7fffffff
        r1 = (state / 0x7fffffff) - 0.5
        state = (state * 1103515245 + 12345) & 0x7fffffff
        r2 = (state / 0x7fffffff) - 0.5
        out.append((max(0.0, beat + r1 * 0.02), dur, note,
                    max(0.02, min(0.97, vel * (1 + r2 * 0.13)))))
    return out


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/comeback.wav'
    info = render(humanise(s.notes), out, pedal=sorted(set(s.pedals)),
                  tempo=tempo, tail=8.0)
    print(f"{info['notes']} notes · {info['seconds']:.0f}s · "
          f"peak {info['peak_dbfs']:.1f} dBFS → {out}")
