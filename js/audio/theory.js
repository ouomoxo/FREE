/**
 * MAESTRO — Music theory primitives.
 *
 * Just enough functional harmony for the composer to write music that resolves
 * properly rather than wandering. Everything is expressed in MIDI note numbers.
 *
 * @module audio/theory
 */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** MIDI note -> frequency in Hz (A4 = 69 = 440 Hz). */
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** Frequency -> MIDI note. */
export const ftom = (f) => 69 + 12 * Math.log2(f / 440);

/** @param {number} m */
export const noteName = (m) => `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;

/** Pitch class of a key name, e.g. `"Eb"` -> 3. */
export function pitchClass(name) {
  const i = NOTE_NAMES.indexOf(name);
  if (i >= 0) return i;
  const j = NOTE_NAMES_FLAT.indexOf(name);
  return j >= 0 ? j : 0;
}

/** Scale interval sets, in semitones from the tonic. */
export const SCALES = Object.freeze({
  major:          [0, 2, 4, 5, 7, 9, 11],
  minor:          [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor:  [0, 2, 3, 5, 7, 8, 11],
  melodicMinor:   [0, 2, 3, 5, 7, 9, 11],
  dorian:         [0, 2, 3, 5, 7, 9, 10],
  phrygian:       [0, 1, 3, 5, 7, 8, 10],
  lydian:         [0, 2, 4, 6, 7, 9, 11],
  mixolydian:     [0, 2, 4, 5, 7, 9, 10],
  aeolian:        [0, 2, 3, 5, 7, 8, 10],
  wholeTone:      [0, 2, 4, 6, 8, 10],
  pentatonicMin:  [0, 3, 5, 7, 10],
  pentatonicMaj:  [0, 2, 4, 7, 9],
});

/** Human-facing mode labels. */
export const MODE_LABEL = Object.freeze({
  major: 'MAJOR', minor: 'MINOR', harmonicMinor: 'HARMONIC MINOR',
  melodicMinor: 'MELODIC MINOR', dorian: 'DORIAN', phrygian: 'PHRYGIAN',
  lydian: 'LYDIAN', mixolydian: 'MIXOLYDIAN', aeolian: 'AEOLIAN',
  wholeTone: 'WHOLE TONE', pentatonicMin: 'PENTATONIC', pentatonicMaj: 'PENTATONIC',
});

/**
 * Nth degree of a scale, allowing indices outside one octave.
 * @param {number} tonic MIDI note of the tonic
 * @param {keyof typeof SCALES} mode
 * @param {number} degree 0-based; may be negative or > 6
 */
export function scaleNote(tonic, mode, degree) {
  const set = SCALES[mode] ?? SCALES.major;
  const n = set.length;
  const octave = Math.floor(degree / n);
  const idx = ((degree % n) + n) % n;
  return tonic + set[idx] + octave * 12;
}

/**
 * Snap an arbitrary MIDI note to the nearest scale tone.
 * @param {number} midi @param {number} tonic @param {keyof typeof SCALES} mode
 */
export function snapToScale(midi, tonic, mode) {
  const set = SCALES[mode] ?? SCALES.major;
  const rel = ((midi - tonic) % 12 + 12) % 12;
  let best = set[0];
  let bestD = 99;
  for (const s of set) {
    const d = Math.min(Math.abs(s - rel), 12 - Math.abs(s - rel));
    if (d < bestD) { bestD = d; best = s; }
  }
  const base = midi - rel;
  return base + best;
}

/** Chord quality -> intervals from the chord root. */
export const CHORDS = Object.freeze({
  maj:   [0, 4, 7],
  min:   [0, 3, 7],
  dim:   [0, 3, 6],
  aug:   [0, 4, 8],
  sus2:  [0, 2, 7],
  sus4:  [0, 5, 7],
  maj7:  [0, 4, 7, 11],
  min7:  [0, 3, 7, 10],
  dom7:  [0, 4, 7, 10],
  dim7:  [0, 3, 6, 9],
  m7b5:  [0, 3, 6, 10],
  add9:  [0, 4, 7, 14],
  min9:  [0, 3, 7, 10, 14],
  maj9:  [0, 4, 7, 11, 14],
  six:   [0, 4, 7, 9],
  min6:  [0, 3, 7, 9],
});

/** Diatonic triad quality per scale degree. */
const DIATONIC = {
  major:         ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'],
  minor:         ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'],
  aeolian:       ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'],
  harmonicMinor: ['min', 'dim', 'aug', 'min', 'maj', 'maj', 'dim'],
  melodicMinor:  ['min', 'min', 'aug', 'maj', 'maj', 'dim', 'dim'],
  dorian:        ['min', 'min', 'maj', 'maj', 'min', 'dim', 'maj'],
  phrygian:      ['min', 'maj', 'maj', 'min', 'dim', 'maj', 'min'],
  lydian:        ['maj', 'maj', 'min', 'dim', 'maj', 'min', 'min'],
  mixolydian:    ['maj', 'min', 'dim', 'maj', 'min', 'min', 'maj'],
};

/**
 * @typedef {object} Chord
 * @property {number} root    MIDI note of the root
 * @property {string} quality
 * @property {number[]} notes MIDI notes, close position
 * @property {number} degree  0-based scale degree
 * @property {string} label   e.g. `Am7`
 */

/**
 * Build a diatonic chord on a scale degree.
 *
 * @param {number} tonic
 * @param {keyof typeof SCALES} mode
 * @param {number} degree 0-based
 * @param {{seventh?: boolean, inversion?: number, octave?: number}} [opts]
 * @returns {Chord}
 */
export function diatonicChord(tonic, mode, degree, opts = {}) {
  const table = DIATONIC[mode] ?? DIATONIC.major;
  const d = ((degree % 7) + 7) % 7;
  let quality = table[d];
  if (opts.seventh) {
    quality = { maj: 'maj7', min: 'min7', dim: 'm7b5', aug: 'maj7' }[quality] ?? 'maj7';
    // The dominant of a minor key is the classic V7, not a minor seventh.
    if ((mode === 'minor' || mode === 'aeolian' || mode === 'harmonicMinor') && d === 4) {
      quality = 'dom7';
    }
    if (mode === 'major' && d === 4) quality = 'dom7';
  }
  const root = scaleNote(tonic, mode, degree) + (opts.octave ?? 0) * 12;
  let notes = CHORDS[quality].map((i) => root + i);
  const inv = opts.inversion ?? 0;
  for (let i = 0; i < inv; i++) notes = [...notes.slice(1), notes[0] + 12];
  return {
    root,
    quality,
    notes,
    degree: d,
    label: `${spell(root, opts.flats)}${qualitySuffix(quality)}`,
  };
}

/**
 * Spell a pitch class with sharps or flats.
 *
 * A piece in A flat minor should not display its tonic chord as "G#m"; the
 * composer passes the key's own accidental preference down so the readout
 * agrees with the key signature shown beside it.
 *
 * @param {number} midi
 * @param {boolean} [flats]
 */
export function spell(midi, flats) {
  const pc = ((midi % 12) + 12) % 12;
  return (flats ? NOTE_NAMES_FLAT : NOTE_NAMES)[pc];
}

/**
 * Semitones from a mode's tonic down to its relative major.
 * Used to decide the key signature, and therefore the accidentals.
 */
const RELATIVE_MAJOR = {
  major: 0, lydian: 5, mixolydian: 7, dorian: 2, minor: 3,
  aeolian: 3, harmonicMinor: 3, melodicMinor: 3, phrygian: 4,
  pentatonicMaj: 0, pentatonicMin: 3, wholeTone: 0,
};

/** Major keys conventionally written with flats: F, Bb, Eb, Ab, Db, Gb. */
const FLAT_MAJORS = new Set([5, 10, 3, 8, 1, 6]);

/**
 * Whether a key should be spelled with flats.
 *
 * Decided from the *relative major*, so D minor gets B flat (one flat) rather
 * than A sharp, and E minor keeps its F sharp.
 *
 * @param {string} keyName e.g. `"Eb"`
 * @param {string} [mode]
 */
export function usesFlats(keyName, mode = 'major') {
  if (keyName.includes('b')) return true;
  if (keyName.includes('#')) return false;
  const rel = (pitchClass(keyName) + (RELATIVE_MAJOR[mode] ?? 0)) % 12;
  return FLAT_MAJORS.has(rel);
}

function qualitySuffix(q) {
  return {
    maj: '', min: 'm', dim: '°', aug: '+', dom7: '7', maj7: 'maj7', min7: 'm7',
    m7b5: 'ø7', dim7: '°7', sus2: 'sus2', sus4: 'sus4', add9: 'add9',
    six: '6', min6: 'm6', min9: 'm9', maj9: 'maj9',
  }[q] ?? q;
}

/**
 * Voice a chord into a register, keeping motion smooth relative to a previous
 * voicing (poor man's voice leading — enough to avoid ugly parallel leaps).
 *
 * @param {Chord} chord
 * @param {number} low   lowest acceptable MIDI note
 * @param {number} high  highest acceptable MIDI note
 * @param {number[]} [previous]
 * @returns {number[]}
 */
export function voice(chord, low, high, previous) {
  const pcs = chord.notes.map((n) => ((n % 12) + 12) % 12);
  /** @type {number[]} */
  const out = [];
  for (let i = 0; i < pcs.length; i++) {
    const pc = pcs[i];
    const target = previous?.[i] ?? (low + high) / 2;
    let best = null;
    let bestD = Infinity;
    for (let m = low; m <= high; m++) {
      if (((m % 12) + 12) % 12 !== pc) continue;
      const d = Math.abs(m - target);
      if (d < bestD) { bestD = d; best = m; }
    }
    out.push(best ?? chord.notes[i]);
  }
  return out.sort((a, b) => a - b);
}

/**
 * Cadential progressions, expressed as 0-based scale degrees.
 * The composer picks one per section and may extend it.
 */
export const PROGRESSIONS = Object.freeze({
  minor: [
    [0, 5, 2, 6],      // i  VI III VII
    [0, 3, 4, 0],      // i  iv  V   i
    [0, 6, 5, 4],      // i  VII VI  V
    [0, 2, 3, 4],      // i  III iv  V
    [5, 3, 0, 4],      // VI iv  i   V
    [0, 4, 5, 2],      // i  V   VI  III
    [0, 3, 6, 2],      // i  iv  VII III
  ],
  major: [
    [0, 4, 5, 3],      // I  V   vi  IV
    [0, 5, 3, 4],      // I  vi  IV  V
    [0, 3, 0, 4],      // I  IV  I   V
    [1, 4, 0, 0],      // ii V   I   I
    [0, 2, 3, 4],      // I  iii IV  V
    [5, 3, 0, 4],      // vi IV  I   V
  ],
});

/** Bar-level rhythmic weight: which beats feel strong in a given meter. */
export function beatWeight(beatInBar, meterTop) {
  if (beatInBar === 0) return 1;
  if (meterTop === 4 && beatInBar === 2) return 0.72;
  if (meterTop === 6 && beatInBar === 3) return 0.72;
  if (meterTop === 3 && beatInBar === 1) return 0.42;
  return 0.4;
}
