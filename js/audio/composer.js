/**
 * MAESTRO — Score composer.
 *
 * Turns a compact track specification into a complete, deterministic score: an
 * absolutely-timed list of note events plus the structural metadata the UI
 * needs (sections, bar lines, dynamics).
 *
 * The music is *motivic*, not random. Each piece generates one rhythmic and
 * melodic cell, then develops it — sequence, inversion, augmentation,
 * fragmentation — across a planned form over a functional chord progression
 * that cadences properly. That is the difference between "procedural music"
 * and noise.
 *
 * Because the whole score is materialised up front, seeking is exact and the
 * duration shown in the UI is the real duration.
 *
 * @module audio/composer
 */

import {
  scaleNote, diatonicChord, voice, PROGRESSIONS, SCALES, pitchClass, beatWeight, usesFlats,
} from './theory.js';
import { Random, clamp } from '../core/utils.js';

/**
 * @typedef {object} NoteEvent
 * @property {number} t     Start, seconds from the top of the piece.
 * @property {number} d     Duration, seconds.
 * @property {number} m     MIDI note.
 * @property {number} v     Velocity, 0..1.
 * @property {string} i     Instrument key.
 * @property {number} p     Pan, -1..1.
 */

/**
 * @typedef {object} Section
 * @property {string} name
 * @property {string} label
 * @property {number} startBar
 * @property {number} bars
 * @property {number} t        Start time in seconds.
 * @property {number} duration Seconds.
 * @property {number} intensity 0..1
 */

/**
 * @typedef {object} Score
 * @property {NoteEvent[]} events Sorted by `t`.
 * @property {Section[]} sections
 * @property {number} duration
 * @property {number} bpm
 * @property {[number, number]} meter
 * @property {number} secPerBeat
 * @property {number} bars
 * @property {string} key
 * @property {string} mode
 * @property {string[]} instruments
 * @property {Array<{bar:number, t:number, label:string}>} chords
 */

/* ============================================================================
   Style presets
   ========================================================================== */

/**
 * Every style declares its ensemble roles, register, and figuration. This is
 * the layer that makes a toccata sound unlike a nocturne.
 */
export const STYLES = {
  baroque: {
    label: 'BAROQUE',
    meter: [4, 4], bpmRange: [92, 116],
    melody: 'harpsichord', counter: 'strings', pad: 'strings',
    bass: 'contrabass', accent: null,
    melodyOctave: 5, padOctave: 3, bassOctave: 2,
    figuration: 'running', harmonicRhythm: 1, density: 0.9,
    swing: 0, reverb: 0.34, padLevel: 0.34,
  },
  toccata: {
    label: 'TOCCATA',
    meter: [4, 4], bpmRange: [126, 148],
    melody: 'harpsichord', counter: 'harpsichord', pad: 'strings',
    bass: 'contrabass', accent: null,
    melodyOctave: 5, padOctave: 3, bassOctave: 2,
    figuration: 'perpetual', harmonicRhythm: 2, density: 1,
    swing: 0, reverb: 0.3, padLevel: 0.26,
  },
  waltz: {
    label: 'WALTZ',
    meter: [3, 4], bpmRange: [150, 176],
    melody: 'strings', counter: 'flute', pad: 'strings',
    bass: 'contrabass', accent: 'harp',
    melodyOctave: 5, padOctave: 4, bassOctave: 2,
    figuration: 'oompah', harmonicRhythm: 1, density: 0.7,
    swing: 0, reverb: 0.44, padLevel: 0.3,
  },
  nocturne: {
    label: 'NOCTURNE',
    meter: [4, 4], bpmRange: [58, 72],
    melody: 'flute', counter: 'celeste', pad: 'strings',
    bass: 'contrabass', accent: 'celeste',
    melodyOctave: 5, padOctave: 4, bassOctave: 2,
    figuration: 'arpeggio', harmonicRhythm: 1, density: 0.55,
    swing: 0, reverb: 0.6, padLevel: 0.42,
  },
  adagio: {
    label: 'ADAGIO',
    meter: [4, 4], bpmRange: [46, 60],
    melody: 'strings', counter: 'choir', pad: 'strings',
    bass: 'contrabass', accent: null,
    melodyOctave: 5, padOctave: 4, bassOctave: 2,
    figuration: 'sustained', harmonicRhythm: 1, density: 0.35,
    swing: 0, reverb: 0.72, padLevel: 0.5,
  },
  march: {
    label: 'MARCH',
    meter: [4, 4], bpmRange: [104, 120],
    melody: 'strings', counter: 'flute', pad: 'strings',
    bass: 'contrabass', accent: 'timpani',
    melodyOctave: 5, padOctave: 4, bassOctave: 2,
    figuration: 'dotted', harmonicRhythm: 1, density: 0.8,
    swing: 0, reverb: 0.4, padLevel: 0.38,
  },
  scherzo: {
    label: 'SCHERZO',
    meter: [3, 4], bpmRange: [176, 208],
    melody: 'flute', counter: 'pizzicato', pad: 'strings',
    bass: 'pizzicato', accent: 'glockenspiel',
    melodyOctave: 5, padOctave: 4, bassOctave: 2,
    figuration: 'staccato', harmonicRhythm: 1, density: 0.85,
    swing: 0, reverb: 0.36, padLevel: 0.2,
  },
  chorale: {
    label: 'CHORALE',
    meter: [4, 4], bpmRange: [62, 76],
    melody: 'choir', counter: 'strings', pad: 'choir',
    bass: 'contrabass', accent: null,
    melodyOctave: 5, padOctave: 4, bassOctave: 2,
    figuration: 'block', harmonicRhythm: 1, density: 0.3,
    swing: 0, reverb: 0.78, padLevel: 0.55,
  },
  minimal: {
    label: 'MINIMALIST',
    meter: [4, 4], bpmRange: [96, 112],
    melody: 'celeste', counter: 'harp', pad: 'strings',
    bass: 'contrabass', accent: null,
    melodyOctave: 5, padOctave: 4, bassOctave: 2,
    figuration: 'cell', harmonicRhythm: 2, density: 0.95,
    swing: 0, reverb: 0.56, padLevel: 0.44,
  },
  aria: {
    label: 'ARIA',
    meter: [4, 4], bpmRange: [66, 82],
    melody: 'choir', counter: 'harp', pad: 'strings',
    bass: 'contrabass', accent: 'harp',
    melodyOctave: 5, padOctave: 4, bassOctave: 2,
    figuration: 'arpeggio', harmonicRhythm: 1, density: 0.45,
    swing: 0, reverb: 0.68, padLevel: 0.46,
  },
};

/** Rhythmic cells, in beats: `[offset, duration]` pairs within one bar. */
const RHYTHM_CELLS = {
  4: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[0, 1.5], [1.5, 0.5], [2, 1], [3, 1]],
    [[0, 0.5], [0.5, 0.5], [1, 1], [2, 1.5], [3.5, 0.5]],
    [[0, 2], [2, 1], [3, 1]],
    [[0, 1], [1, 0.5], [1.5, 0.5], [2, 2]],
    [[0, 0.75], [0.75, 0.25], [1, 1], [2, 0.75], [2.75, 0.25], [3, 1]],
    [[0, 3], [3, 1]],
    [[0, 0.5], [1, 0.5], [1.5, 0.5], [2, 1], [3, 0.5], [3.5, 0.5]],
  ],
  3: [
    [[0, 1], [1, 1], [2, 1]],
    [[0, 2], [2, 1]],
    [[0, 1], [1, 0.5], [1.5, 0.5], [2, 1]],
    [[0, 0.5], [0.5, 0.5], [1, 2]],
    [[0, 1.5], [1.5, 0.5], [2, 1]],
    [[0, 3]],
  ],
};

/** Melodic contours as scale-step offsets; the composer picks and mutates one. */
const CONTOURS = [
  [0, 1, 2, 1], [0, 2, 1, -1], [0, -1, -2, 0], [0, 2, 4, 2],
  [0, 1, -1, 0], [0, 3, 2, 1], [0, -2, 1, 3], [0, 4, 3, 1],
  [0, 1, 3, 2], [0, -1, 1, 2],
];

/* ============================================================================
   Form
   ========================================================================== */

/**
 * Plan the movement's sections.
 *
 * Seeded independently of the note-level RNG so that the form — and therefore
 * the piece's duration — can be computed without composing a single note. List
 * views need every track's runtime up front; composing 120 scores at boot would
 * not be acceptable, so `estimateDuration` reuses exactly this function.
 *
 * @param {string} seed
 * @param {number} targetBars
 * @returns {Array<{name:string, label:string, bars:number, intensity:number, variant:number}>}
 */
export function planForm(seed, targetBars) {
  const rnd = Random(`${seed}::form`);
  const unit = Math.max(4, Math.round(targetBars / 12) * 2);
  /** @type {Array<{name:string,label:string,bars:number,intensity:number,variant:number}>} */
  const plan = [
    { name: 'intro', label: 'INTRODUZIONE',    bars: Math.max(2, unit / 2), intensity: 0.30, variant: 0 },
    { name: 'a1',    label: 'TEMA',            bars: unit, intensity: 0.58, variant: 0 },
    { name: 'a2',    label: 'TEMA — RIPRESA',  bars: unit, intensity: 0.68, variant: 1 },
    { name: 'b',     label: 'SVILUPPO',        bars: unit, intensity: 0.86, variant: 2 },
  ];
  if (rnd.chance(0.6)) {
    plan.push({ name: 'b2', label: 'SVILUPPO II', bars: unit, intensity: 0.95, variant: 3 });
  }
  plan.push({ name: 'a3',   label: 'RIPRESA', bars: unit, intensity: 0.74, variant: 1 });
  plan.push({ name: 'coda', label: 'CODA',    bars: Math.max(4, unit / 2), intensity: 0.42, variant: 4 });
  return plan;
}

/**
 * Resolve a spec's tempo. Shared by {@link compose} and {@link estimateDuration}
 * so the two can never disagree.
 * @param {TrackSpec} spec
 */
export function tempoFor(spec) {
  const style = STYLES[spec.style] ?? STYLES.baroque;
  if (spec.bpm) return spec.bpm;
  const rnd = Random(`${spec.seed}::tempo`);
  return Math.round(rnd.float(style.bpmRange[0], style.bpmRange[1]));
}

/**
 * Total bar count for a spec, without composing.
 * @param {TrackSpec} spec
 */
export function totalBarsFor(spec) {
  const style = STYLES[spec.style] ?? STYLES.baroque;
  const target = spec.targetBars ?? 48;
  return planForm(spec.seed, target).reduce((s, p) => s + p.bars, 0);
}

/**
 * Exact duration in seconds for a spec, without composing. Must stay in step
 * with the tail padding applied at the end of {@link compose}.
 * @param {TrackSpec} spec
 */
export function estimateDuration(spec) {
  const style = STYLES[spec.style] ?? STYLES.baroque;
  const secPerBeat = 60 / tempoFor(spec);
  return (totalBarsFor(spec) * style.meter[0] + 3) * secPerBeat;
}

/* ============================================================================
   Composition
   ========================================================================== */

/**
 * @typedef {object} TrackSpec
 * @property {string} seed
 * @property {keyof typeof STYLES} style
 * @property {string} key      e.g. `"D"`
 * @property {keyof typeof SCALES} mode
 * @property {number} [bpm]
 * @property {number} [targetBars]
 */

/**
 * Compose a complete score.
 * @param {TrackSpec} spec
 * @returns {Score}
 */
export function compose(spec) {
  const style = STYLES[spec.style] ?? STYLES.baroque;
  const rnd = Random(spec.seed);

  const [meterTop, meterBottom] = style.meter;
  const bpm = tempoFor(spec);
  const secPerBeat = 60 / bpm;
  const tonic = 12 * 4 + pitchClass(spec.key); // octave 3 reference
  const mode = spec.mode;

  const targetBars = spec.targetBars ?? 48;
  const flats = usesFlats(spec.key, spec.mode);
  const form = planForm(spec.seed, targetBars);
  const totalBars = form.reduce((s, p) => s + p.bars, 0);

  /** @type {NoteEvent[]} */
  const events = [];
  /** @type {Section[]} */
  const sections = [];
  /** @type {Array<{bar:number,t:number,label:string}>} */
  const chordMarks = [];

  const beatSec = (beat) => beat * secPerBeat;
  const push = (beatPos, durBeats, midi, vel, inst, pan = 0, jitter = 1) => {
    if (midi < 24 || midi > 104) return;
    const humanize = (rnd.float(-1, 1) * 0.012) * jitter;
    events.push({
      t: Math.max(0, beatSec(beatPos) + humanize),
      d: Math.max(0.05, beatSec(durBeats)),
      m: Math.round(midi),
      v: clamp(vel, 0.05, 1),
      i: inst,
      p: clamp(pan, -1, 1),
    });
  };

  // --- The cell: one rhythm, one contour, developed all the way through. ---
  const cells = RHYTHM_CELLS[meterTop] ?? RHYTHM_CELLS[4];
  const baseRhythm = rnd.pick(cells);
  const baseContour = rnd.pick(CONTOURS);
  const progressionBank = PROGRESSIONS[mode === 'major' || mode === 'lydian' || mode === 'mixolydian' ? 'major' : 'minor'];

  let bar = 0;
  /** @type {number[]|undefined} */
  let previousVoicing;
  let melodyAnchor = 0;

  for (const part of form) {
    const sectionStartBar = bar;
    const progression = rnd.pick(progressionBank);
    const intensity = part.intensity;

    // Development transforms, chosen per section.
    const rhythm = transformRhythm(baseRhythm, part.variant, meterTop, rnd);
    const contour = transformContour(baseContour, part.variant, rnd);

    for (let b = 0; b < part.bars; b++, bar++) {
      const barBeat = bar * meterTop;
      const isLastBarOfSection = b === part.bars - 1;
      const isFinalBar = bar === totalBars - 1;
      const isPenultimate = bar === totalBars - 2;

      // --- Harmony -------------------------------------------------------
      let degree;
      if (isFinalBar) degree = 0;
      else if (isPenultimate) degree = 4;                       // V
      else if (isLastBarOfSection && part.name !== 'intro') degree = rnd.chance(0.6) ? 4 : progression[b % progression.length];
      else degree = progression[b % progression.length];

      const seventh = style.figuration !== 'block' && rnd.chance(0.35 + intensity * 0.25);
      const chord = diatonicChord(tonic, mode, degree, { seventh, flats });
      const voicing = voice(chord, tonic + style.padOctave * 12 - 12, tonic + style.padOctave * 12 + 6, previousVoicing);
      previousVoicing = voicing;
      chordMarks.push({ bar, t: beatSec(barBeat), label: chord.label });

      // --- Pad / harmony ---------------------------------------------------
      writePad(push, {
        style, voicing, barBeat, meterTop, intensity, rnd,
        isFinal: isFinalBar,
      });

      // --- Bass ------------------------------------------------------------
      writeBass(push, {
        style, chord, barBeat, meterTop, tonic, mode, intensity, rnd,
        isFinal: isFinalBar,
      });

      // --- Accent / percussion --------------------------------------------
      if (style.accent) {
        writeAccent(push, {
          style, chord, barBeat, meterTop, intensity, rnd,
          isSectionEdge: b === 0, isFinal: isFinalBar,
        });
      }

      // --- Melody ----------------------------------------------------------
      if (part.name !== 'intro' || b >= part.bars - 2) {
        melodyAnchor = writeMelody(push, {
          style, chord, rhythm, contour, barBeat, meterTop, tonic, mode,
          intensity, rnd, anchor: melodyAnchor, isFinal: isFinalBar,
          fragment: part.name === 'coda',
        });
      }

      // --- Counter-line, from the second theme onwards ---------------------
      if (style.counter && (part.name === 'a2' || part.name === 'b' || part.name === 'b2' || part.name === 'a3')) {
        writeCounter(push, {
          style, chord, barBeat, meterTop, tonic, mode, intensity, rnd,
        });
      }
    }

    sections.push({
      name: part.name,
      label: part.label,
      startBar: sectionStartBar,
      bars: part.bars,
      t: beatSec(sectionStartBar * meterTop),
      duration: beatSec(part.bars * meterTop),
      intensity: part.intensity,
    });
  }

  // Final tonic chord, held.
  const endBeat = totalBars * meterTop;
  const finalChord = diatonicChord(tonic, mode, 0, { flats });
  for (const m of voice(finalChord, tonic + style.padOctave * 12 - 12, tonic + style.padOctave * 12 + 8)) {
    push(endBeat - 1, 4, m, 0.4, style.pad, 0, 0);
  }
  push(endBeat - 1, 4, finalChord.root - 12 * (style.padOctave - style.bassOctave), 0.5, style.bass, 0, 0);

  events.sort((a, b) => a.t - b.t);

  const duration = beatSec(endBeat + 3);
  const instruments = Array.from(new Set(events.map((e) => e.i)));

  return {
    events, sections, duration, bpm,
    meter: [meterTop, meterBottom],
    secPerBeat, bars: totalBars,
    key: spec.key, mode, instruments, chords: chordMarks,
    reverb: style.reverb,
    styleLabel: style.label,
  };
}

/* ============================================================================
   Development transforms
   ========================================================================== */

function transformRhythm(cell, variant, meterTop, rnd) {
  switch (variant) {
    case 1: { // fragmentation — subdivide one note
      const out = [];
      for (const [o, d] of cell) {
        if (d >= 1 && rnd.chance(0.45)) { out.push([o, d / 2], [o + d / 2, d / 2]); }
        else out.push([o, d]);
      }
      return out;
    }
    case 2: { // syncopation — shift interior attacks off the beat
      return cell.map(([o, d], i) => (i > 0 && o + 0.5 < meterTop && rnd.chance(0.5) ? [o + 0.5, Math.max(0.25, d - 0.5)] : [o, d]));
    }
    case 3: { // diminution — twice as busy
      const out = [];
      for (const [o, d] of cell) {
        if (d >= 0.5) { out.push([o, d / 2], [o + d / 2, d / 2]); }
        else out.push([o, d]);
      }
      return out.filter(([o]) => o < meterTop);
    }
    case 4: { // augmentation — half as busy, for the coda
      const out = [];
      let acc = 0;
      for (const [, d] of cell) {
        if (acc >= meterTop) break;
        const dd = Math.min(d * 2, meterTop - acc);
        out.push([acc, dd]);
        acc += dd;
      }
      return out;
    }
    default:
      return cell;
  }
}

function transformContour(contour, variant, rnd) {
  switch (variant) {
    case 1: return contour.map((v) => v + (rnd.chance(0.5) ? 1 : -1)); // sequence
    case 2: return contour.map((v) => -v);                              // inversion
    case 3: return contour.slice().reverse();                           // retrograde
    case 4: return contour.map((v) => Math.round(v / 2));               // smoothed
    default: return contour;
  }
}

/* ============================================================================
   Part writers
   ========================================================================== */

function writePad(push, o) {
  const { style, voicing, barBeat, meterTop, intensity, rnd, isFinal } = o;
  const level = style.padLevel * (0.6 + intensity * 0.5);

  switch (style.figuration) {
    case 'oompah': {
      // Beat 1 is the bass (written elsewhere); 2 and 3 are the chord.
      for (let b = 1; b < meterTop; b++) {
        voicing.forEach((m, i) => {
          push(barBeat + b, 0.62, m, level * (i === 0 ? 0.9 : 0.7), style.pad, (i - 1) * 0.22);
        });
      }
      break;
    }
    case 'arpeggio': {
      const pattern = [0, 1, 2, 1, 2, 3, 2, 1];
      const step = meterTop / 4;
      for (let k = 0; k < 8; k++) {
        const m = voicing[pattern[k] % voicing.length] + (pattern[k] >= voicing.length ? 12 : 0);
        push(barBeat + (k * step) / 2, step * 0.9, m, level * (0.55 + (k % 2 ? 0 : 0.15)), style.counter, ((k % 4) - 1.5) * 0.16);
      }
      break;
    }
    case 'block':
    case 'sustained': {
      voicing.forEach((m, i) => {
        push(barBeat, meterTop, m, level * (0.85 - i * 0.06), style.pad, (i - voicing.length / 2) * 0.18, 0.4);
      });
      break;
    }
    case 'cell': {
      const cellPattern = [0, 2, 1, 2, 0, 3, 1, 2];
      for (let k = 0; k < meterTop * 2; k++) {
        const m = voicing[cellPattern[k % cellPattern.length] % voicing.length];
        push(barBeat + k * 0.5, 0.48, m, level * 0.55, style.counter, ((k % 4) - 1.5) * 0.2);
      }
      voicing.forEach((m, i) => push(barBeat, meterTop, m - 12, level * 0.4, style.pad, 0, 0.3));
      break;
    }
    case 'dotted': {
      voicing.forEach((m, i) => {
        push(barBeat, 1.4, m, level * 0.8, style.pad, (i - 1) * 0.2);
        push(barBeat + 2, 1.4, m, level * 0.7, style.pad, (i - 1) * 0.2);
      });
      break;
    }
    case 'staccato': {
      for (let b = 0; b < meterTop; b++) {
        if (b === 0 && !rnd.chance(0.4)) continue;
        voicing.forEach((m, i) => push(barBeat + b, 0.3, m, level * 0.6, style.pad, (i - 1) * 0.24));
      }
      break;
    }
    default: { // running / perpetual — sustained strings under the figuration
      voicing.forEach((m, i) => {
        push(barBeat, meterTop, m, level * (0.7 - i * 0.05), style.pad, (i - voicing.length / 2) * 0.2, 0.4);
      });
    }
  }
  if (isFinal) return;
}

function writeBass(push, o) {
  const { style, chord, barBeat, meterTop, intensity, rnd } = o;
  const root = chord.root - (style.padOctave - style.bassOctave) * 12;
  const fifth = root + 7;
  const level = 0.5 + intensity * 0.3;

  switch (style.figuration) {
    case 'oompah':
      push(barBeat, 0.9, root, level, style.bass, -0.1);
      break;
    case 'running':
    case 'perpetual': {
      // Walking crotchets — the continuo line.
      const line = [root, root, fifth, root + 12];
      for (let b = 0; b < meterTop; b++) {
        push(barBeat + b, 0.92, line[b % line.length], level * (b === 0 ? 1 : 0.78), style.bass, -0.12);
      }
      break;
    }
    case 'dotted':
      push(barBeat, 1.4, root, level, style.bass, -0.1);
      push(barBeat + 1.5, 0.4, root, level * 0.7, style.bass, -0.1);
      push(barBeat + 2, 1.4, fifth, level * 0.85, style.bass, -0.1);
      push(barBeat + 3.5, 0.4, root, level * 0.7, style.bass, -0.1);
      break;
    case 'staccato':
      for (let b = 0; b < meterTop; b++) {
        push(barBeat + b, 0.35, b % 2 === 0 ? root : fifth, level * 0.8, style.bass, -0.15);
      }
      break;
    case 'cell':
      push(barBeat, meterTop, root, level * 0.9, style.bass, -0.08, 0.3);
      break;
    default:
      push(barBeat, meterTop * 0.95, root, level, style.bass, -0.1, 0.4);
      if (rnd.chance(0.25 * intensity)) push(barBeat + meterTop / 2, meterTop / 2, fifth, level * 0.6, style.bass, -0.1);
  }
}

function writeAccent(push, o) {
  const { style, chord, barBeat, meterTop, intensity, rnd, isSectionEdge, isFinal } = o;
  if (!style.accent) return;

  if (style.accent === 'timpani') {
    const root = chord.root - 24;
    push(barBeat, 1, root, 0.55 + intensity * 0.35, 'timpani', 0);
    if (intensity > 0.7 && rnd.chance(0.5)) push(barBeat + meterTop - 1, 0.5, root, 0.4, 'timpani', 0);
    if (isFinal) push(barBeat, 2, root, 0.9, 'timpani', 0);
    return;
  }
  if (style.accent === 'glockenspiel') {
    if (isSectionEdge || rnd.chance(0.22 * intensity)) {
      push(barBeat, 1.2, chord.notes[0] + 24, 0.3 + intensity * 0.2, 'glockenspiel', 0.3);
    }
    return;
  }
  if (style.accent === 'harp' || style.accent === 'celeste') {
    if (isSectionEdge || rnd.chance(0.35)) {
      const notes = chord.notes;
      for (let k = 0; k < notes.length; k++) {
        push(barBeat + k * 0.12, 2.4, notes[k] + 12, 0.28 + intensity * 0.2, style.accent, 0.35);
      }
    }
  }
}

function writeMelody(push, o) {
  const {
    style, chord, rhythm, contour, barBeat, meterTop, tonic, mode,
    intensity, rnd, anchor, isFinal, fragment,
  } = o;

  const base = style.melodyOctave * 12 + (tonic % 12) - 12;
  const chordDegrees = chord.notes.map((n) => n - chord.root);
  let degree = anchor;
  const level = 0.5 + intensity * 0.4;

  if (isFinal) {
    push(barBeat, meterTop, scaleNote(tonic, mode, 0) + (style.melodyOctave - 4) * 12, level, style.melody, 0.05, 0.3);
    return 0;
  }

  const notes = fragment ? rhythm.slice(0, Math.max(1, rhythm.length - 1)) : rhythm;

  notes.forEach(([offset, dur], idx) => {
    const step = contour[idx % contour.length];
    degree = anchor + step;

    let midi = scaleNote(tonic, mode, degree) + (style.melodyOctave - 4) * 12;

    // Strong beats take chord tones; weak beats may pass through.
    const weight = beatWeight(Math.floor(offset), meterTop);
    if (weight > 0.6) {
      const target = chord.root + chordDegrees[idx % chordDegrees.length];
      const octaves = Math.round((midi - target) / 12);
      midi = target + octaves * 12;
    }

    // Keep the line inside a singable ambitus.
    const lo = base - 2;
    const hi = base + 19;
    while (midi < lo) midi += 12;
    while (midi > hi) midi -= 12;

    const vel = level * (0.7 + weight * 0.4) * (rnd.chance(0.12) ? 0.75 : 1);
    const articulation = style.figuration === 'staccato' ? 0.45
      : style.figuration === 'sustained' ? 1.0
      : 0.92;
    push(barBeat + offset, dur * articulation, midi, vel, style.melody, 0.08);
  });

  // Drift the anchor so successive bars form a phrase arc rather than a loop.
  const drift = rnd.weighted([[0, 4], [1, 3], [-1, 3], [2, 1.5], [-2, 1.5]]);
  let next = anchor + drift;
  if (next > 6) next -= 7;
  if (next < -4) next += 7;
  return next;
}

function writeCounter(push, o) {
  const { style, chord, barBeat, meterTop, tonic, mode, intensity, rnd } = o;
  if (!style.counter || style.counter === style.pad) {
    // Styles whose "counter" is the pad get a discreet inner line instead.
    if (!rnd.chance(0.4)) return;
  }
  const inst = style.counter ?? style.pad;
  const octave = (style.melodyOctave - 1 - 4) * 12;
  const tones = chord.notes.map((n) => n + octave);
  const pattern = rnd.pick([[0, 2, 1], [2, 1, 0], [1, 0, 2]]);
  const step = meterTop / pattern.length;
  pattern.forEach((p, i) => {
    push(barBeat + i * step, step * 0.9, tones[p % tones.length], 0.22 + intensity * 0.18, inst, -0.3);
  });
}

/* ============================================================================
   Helpers used by the scheduler / UI
   ========================================================================== */

/**
 * Index of the first event at or after `time` (binary search).
 * @param {NoteEvent[]} events @param {number} time
 */
export function findEventIndex(events, time) {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].t < time) lo = mid + 1; else hi = mid;
  }
  return lo;
}

/**
 * Section containing a given time.
 * @param {Score} score @param {number} time
 */
export function sectionAt(score, time) {
  for (let i = score.sections.length - 1; i >= 0; i--) {
    if (time >= score.sections[i].t) return score.sections[i];
  }
  return score.sections[0] ?? null;
}
