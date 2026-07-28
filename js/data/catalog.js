/**
 * MAESTRO — Catalogue.
 *
 * An invented repertoire: nine ensembles, twenty records, and a couple of
 * hundred movements. Every piece is original — the musical content is
 * synthesised at runtime from the specs below, so nothing here is a recording
 * of anyone else's work.
 *
 * Musical parameters (tempo, bar count, register) are derived deterministically
 * from each track's seed, so the catalogue is byte-identical on every visit.
 *
 * @module data/catalog
 */

import { Random } from '../core/utils.js';
import { estimateDuration, tempoFor, STYLES } from '../audio/composer.js';

/* ============================================================================
   Ensembles
   ========================================================================== */

/**
 * @typedef {object} Artist
 * @property {string} id
 * @property {string} name
 * @property {string} role
 * @property {string} tagline
 * @property {string} bio
 * @property {string} city
 * @property {string} palette
 * @property {string} motif
 * @property {number} monthly Fictional monthly listener count.
 */

/** @type {Artist[]} */
export const ARTISTS = [
  {
    id: 'vantor',
    name: 'ELIAS VANTOR',
    role: 'CONDUCTOR',
    /** This ensemble's artwork is the reference photograph itself, screened. */
    photo: 'a',
    photoCell: 5,
    photoZoom: 1.7,
    photoOffsetY: -0.06,
    tagline: 'The gesture before the sound',
    city: 'VIENNA',
    palette: 'bone',
    motif: 'hands',
    monthly: 1_284_000,
    bio: 'Vantor conducts without a score and, for the last four seasons, without light. '
       + 'The hall is dark; a single lamp finds the hands and nothing else. What the audience '
       + 'watches is not a man but a shape — a wrist, a baton, an open palm asking the second '
       + 'violins for less. He calls the practice "reduction": remove the orchestra, remove the '
       + 'face, remove the room, and what remains is the smallest unit of music, which is a gesture.',
  },
  {
    id: 'vesper',
    name: 'VESPER QUARTET',
    role: 'STRING QUARTET',
    tagline: 'Four players, one grey',
    city: 'COPENHAGEN',
    palette: 'marble',
    motif: 'geometry',
    monthly: 612_400,
    bio: 'Formed in a disused printing house, the Vesper Quartet build their programmes the way '
       + 'a printer builds a tone: not by mixing, but by spacing. Their readings are famously '
       + 'literal — no rubato that is not written, no swell that is not marked — which leaves the '
       + 'listener to supply the colour.',
  },
  {
    id: 'rost',
    name: 'ANNIKA RØST',
    role: 'CELESTA · KEYBOARDS',
    tagline: 'Small hammers, large rooms',
    city: 'OSLO',
    palette: 'marble',
    motif: 'moon',
    monthly: 948_700,
    bio: 'Røst plays the celesta as if it were a clock that had been taught regret. Her recordings '
       + 'are made at night, in halls she is not supposed to be in, with the heating off so the '
       + 'building stops humming.',
  },
  {
    id: 'noctis',
    name: 'CHORUS NOCTIS',
    role: 'CHOIR',
    tagline: 'Thirty voices, no vibrato',
    city: 'TALLINN',
    palette: 'velvet',
    motif: 'rose',
    monthly: 421_900,
    bio: 'A choir of thirty that refuses vibrato entirely, on the grounds that a straight tone is '
       + 'the vocal equivalent of a hard edge. Their sound has been described, not unkindly, as '
       + '"a wall with a door in it".',
  },
  {
    id: 'halland',
    name: 'HÅLLAND SINFONIETTA',
    role: 'CHAMBER ORCHESTRA',
    tagline: 'Twenty-two players, one lamp',
    city: 'GOTHENBURG',
    palette: 'bone',
    motif: 'wave',
    monthly: 733_200,
    bio: 'A chamber orchestra of twenty-two that tours with its own lighting rig and no risers. '
       + 'The players stand. The audience sits in the dark. Nobody has complained yet.',
  },
  {
    id: 'moreau',
    name: 'OKTAV MOREAU',
    role: 'HARPSICHORD',
    tagline: 'Every note is a decision',
    city: 'LYON',
    palette: 'sepia',
    motif: 'lattice',
    monthly: 386_500,
    bio: 'The harpsichord cannot get louder, so Moreau makes it get denser. His playing is an '
       + 'argument that dynamics were always a special case of rhythm.',
  },
  {
    id: 'pixphil',
    name: 'THE PIXEL PHILHARMONIC',
    role: 'ORCHESTRA',
    tagline: 'Resolution is a choice',
    city: 'BERLIN',
    palette: 'gold',
    motif: 'sunrise',
    monthly: 2_140_000,
    bio: 'An orchestra assembled around a single provocation: that a symphony, like an image, has '
       + 'a resolution — and that lowering it does not destroy the work but reveals its structure. '
       + 'They perform under a grid of 4,096 lamps, one per player-second.',
  },
  {
    id: 'sable',
    name: 'SABLE & ASH',
    role: 'HARP · FLUTE',
    tagline: 'Two lines, held apart',
    city: 'GLASGOW',
    palette: 'sepia',
    motif: 'arch',
    monthly: 274_300,
    bio: 'A duo that has never played a unison. Their entire published output consists of two '
       + 'independent lines that agree only at cadences, and sometimes not even then.',
  },
  {
    id: 'kovacs',
    name: 'IRINA KOVÁCS',
    role: 'CONTRABASS',
    tagline: 'From the floor up',
    city: 'BUDAPEST',
    palette: 'brass',
    motif: 'staff',
    monthly: 198_600,
    bio: 'Kovács writes for the bottom of the register and lets everything else be implied. She '
       + 'describes her records as "architecture heard from the basement".',
  },
];

/* ============================================================================
   Records
   ========================================================================== */

/**
 * @typedef {object} AlbumSpec
 * @property {string} id
 * @property {string} artist
 * @property {string} title
 * @property {number} year
 * @property {'ALBUM'|'EP'|'LIVE'|'SINGLE'} kind
 * @property {string} palette
 * @property {string} motif
 * @property {string} blurb
 * @property {keyof typeof STYLES} style   Default style for the record.
 * @property {string} key
 * @property {string} mode
 * @property {Array<string|[string, Partial<{style:string,key:string,mode:string,minutes:number}>]>} tracks
 */

/** @type {AlbumSpec[]} */
export const ALBUMS = [
  {
    // The one record here that is *written* rather than generated. Its three
    // movements are in `scores/` as source and in `js/data/scores/` as notes
    // with times on them, and they are played on a recorded instrument rather
    // than a synthesised one — see `js/audio/grand.js` for why.
    id: 'written', artist: 'vantor', title: 'THREE ROOMS', year: 2026, kind: 'ALBUM',
    palette: 'marble', motif: 'hands', photo: 'a', photoCell: 3, photoZoom: 2.1, photoOffsetY: -0.1,
    style: 'notturno', key: 'C', mode: 'minor',
    blurb: 'A sonata, and two pieces beside it. Three notes hold the sonata together — C, '
      + 'A flat, G — and it does not develop them: the first movement never rises above '
      + 'piano and goes five keys from home without saying so, the second is a waltz, and '
      + 'the third is what comes up the stairs.',
    tracks: [
      ['I. ADAGIO / II. ALLEGRETTO / III. PRESTO', { score: 'three_rooms', minutes: 5.8 }],
      ['COME BACK — nocturne in C minor', { score: 'comeback', minutes: 6.4 }],
      ['THE SAME FOUR NOTES, FALLING', { score: 'falling', minutes: 4.4 }],
    ],
  },
  {
    id: 'op27', artist: 'vantor', title: "THE CONDUCTOR'S HANDS", year: 2024, kind: 'ALBUM',
    palette: 'bone', motif: 'hands', photo: 'b', photoCell: 4, photoZoom: 1.45, photoOffsetY: -0.04, style: 'adagio', key: 'D', mode: 'minor',
    blurb: 'Six movements written to be conducted in darkness. The parts are identical; only the gesture changes.',
    tracks: [
      ['I. PREPARATION', { style: 'adagio', minutes: 3.4 }],
      ['II. THE UPBEAT', { style: 'chorale', minutes: 2.8 }],
      ['III. DOWNBEAT', { style: 'march', minutes: 3.6 }],
      ['IV. LEFT HAND, ASKING', { style: 'nocturne', minutes: 4.2 }],
      ['V. CUT-OFF', { style: 'scherzo', minutes: 2.2 }],
      ['VI. THE HANDS FALL', { style: 'adagio', minutes: 5.1 }],
    ],
  },
  {
    id: 'moonlight', artist: 'vantor', title: 'ONE FIGURE, HELD', year: 2025, kind: 'ALBUM',
    palette: 'marble', motif: 'hands', photo: 'b', photoCell: 5, photoZoom: 1.9, photoOffsetY: -0.06,
    style: 'notturno', key: 'C#', mode: 'minor',
    blurb: 'Written for one player and one figure. The right hand begins a broken chord in the '
      + 'first bar and has not put it down by the last; everything that happens, happens over it.',
    tracks: [
      ['I. ADAGIO SOSTENUTO', { style: 'notturno', key: 'C#', mode: 'minor', minutes: 5.4 }],
      ['II. THE SAME ROOM, LATER', { style: 'still', key: 'F#', mode: 'minor', minutes: 4.6 }],
      ['III. WITHOUT RESOLVING', { style: 'still', key: 'B', mode: 'minor', minutes: 5.8 }],
      ['IV. AND STILL HELD', { style: 'notturno', key: 'G#', mode: 'minor', minutes: 6.2 }],
    ],
  },
  {
    id: 'silent-baton', artist: 'vantor', title: 'SILENT BATON', year: 2022, kind: 'ALBUM',
    palette: 'gold', motif: 'baton', photo: 'a', photoCell: 6, photoZoom: 2.6, photoOffsetY: -0.2, style: 'chorale', key: 'A', mode: 'minor',
    blurb: 'Studies in what an orchestra does in the half-second before it plays.',
    tracks: [
      ['ANTICIPATION', { style: 'chorale', minutes: 3.1 }],
      ['THE INTAKE OF BREATH', { style: 'adagio', minutes: 3.8 }],
      ['A GESTURE, WITHDRAWN', { style: 'nocturne', minutes: 4.0 }],
      ['TUTTI', { style: 'march', minutes: 2.9 }],
      ['NIENTE', { style: 'aria', minutes: 4.6 }],
    ],
  },
  {
    id: 'downbeat-live', artist: 'vantor', title: 'DOWNBEAT — LIVE AT THE VOID', year: 2025, kind: 'LIVE',
    palette: 'velvet', motif: 'hall', photo: 'b', photoCell: 8, photoZoom: 1.9, photoOffsetY: -0.16, style: 'march', key: 'C', mode: 'minor',
    blurb: 'Recorded across three nights in a hall with the house lights broken. Nobody asked for them to be fixed.',
    tracks: [
      ['OVERTURE (LIVE)', { style: 'march', minutes: 4.4 }],
      ['PROCESSION (LIVE)', { style: 'march', minutes: 3.7 }],
      ['THE SLOW MOVEMENT (LIVE)', { style: 'adagio', minutes: 6.2 }],
      ['SCHERZO, TAKEN FAST (LIVE)', { style: 'scherzo', minutes: 2.6 }],
      ['FINALE (LIVE)', { style: 'toccata', minutes: 4.9 }],
      ['ENCORE — THE HANDS FALL (LIVE)', { style: 'adagio', minutes: 3.9 }],
    ],
  },

  {
    id: 'monochrome', artist: 'vesper', title: 'MONOCHROME SUITE', year: 2023, kind: 'ALBUM',
    palette: 'marble', motif: 'geometry', style: 'baroque', key: 'G', mode: 'minor',
    blurb: 'A suite in seven greys. The players were asked to ignore every dynamic marking except the first.',
    tracks: [
      ['GREY NO. 1 — OPEN', { style: 'chorale', minutes: 2.9 }],
      ['GREY NO. 2 — HATCHED', { style: 'baroque', minutes: 3.3 }],
      ['GREY NO. 3 — STIPPLED', { style: 'minimal', minutes: 4.1 }],
      ['GREY NO. 4 — SOLID', { style: 'adagio', minutes: 3.8 }],
      ['GREY NO. 5 — DITHERED', { style: 'toccata', minutes: 2.7 }],
      ['GREY NO. 6 — INVERTED', { style: 'scherzo', minutes: 2.4 }],
      ['GREY NO. 7 — CLOSED', { style: 'adagio', minutes: 4.5 }],
    ],
  },
  {
    id: 'greyscale', artist: 'vesper', title: 'GREYSCALE VARIATIONS', year: 2021, kind: 'ALBUM',
    palette: 'bone', motif: 'staff', style: 'baroque', key: 'E', mode: 'minor',
    blurb: 'One four-bar theme, reduced by one tone per variation until only rhythm remains.',
    tracks: [
      ['THEME', { style: 'chorale', minutes: 1.9 }],
      ['VAR. I — SEVEN TONES', { style: 'baroque', minutes: 2.2 }],
      ['VAR. II — FIVE TONES', { style: 'waltz', minutes: 2.1 }],
      ['VAR. III — FOUR TONES', { style: 'minimal', minutes: 3.0 }],
      ['VAR. IV — THREE TONES', { style: 'nocturne', minutes: 3.6 }],
      ['VAR. V — TWO TONES', { style: 'adagio', minutes: 4.0 }],
      ['VAR. VI — ONE TONE', { style: 'chorale', minutes: 3.2 }],
    ],
  },

  {
    id: 'nocturnes', artist: 'rost', title: 'NOCTURNES FOR AN EMPTY HALL', year: 2024, kind: 'ALBUM',
    palette: 'marble', motif: 'moon', style: 'nocturne', key: 'F', mode: 'minor',
    blurb: 'Recorded between one and four in the morning, in six halls, with permission from none of them.',
    tracks: [
      ['NOCTURNE I — ROW A', { style: 'nocturne', minutes: 4.3 }],
      ['NOCTURNE II — THE LAST ROW', { style: 'nocturne', minutes: 5.0 }],
      ['NOCTURNE III — UNDER THE STAGE', { style: 'aria', minutes: 4.6 }],
      ['NOCTURNE IV — THE LOBBY, LIT', { style: 'minimal', minutes: 3.9 }],
      ['NOCTURNE V — DOORS LOCKED', { style: 'adagio', minutes: 5.4 }],
    ],
  },
  {
    id: 'etudes8', artist: 'rost', title: 'ÉTUDES IN EIGHT BITS', year: 2022, kind: 'EP',
    palette: 'gold', motif: 'bars', style: 'minimal', key: 'C', mode: 'major',
    blurb: 'Eight studies, each restricted to eight distinct pitches and eight distinct durations.',
    tracks: [
      ['ÉTUDE I — ATTACK', { style: 'toccata', minutes: 2.0 }],
      ['ÉTUDE II — DECAY', { style: 'minimal', minutes: 2.6 }],
      ['ÉTUDE III — SUSTAIN', { style: 'adagio', minutes: 3.4 }],
      ['ÉTUDE IV — RELEASE', { style: 'nocturne', minutes: 3.1 }],
    ],
  },

  {
    id: 'dotmatrix', artist: 'noctis', title: 'DOT MATRIX MASS', year: 2023, kind: 'ALBUM',
    palette: 'velvet', motif: 'rose', style: 'chorale', key: 'D', mode: 'phrygian',
    blurb: 'An ordinary of the mass sung at a fixed dynamic, the way a printer lays down a fixed dot.',
    tracks: [
      ['KYRIE', { style: 'chorale', minutes: 4.2 }],
      ['GLORIA', { style: 'march', minutes: 3.5 }],
      ['CREDO', { style: 'chorale', minutes: 5.8 }],
      ['SANCTUS', { style: 'aria', minutes: 3.9 }],
      ['AGNUS DEI', { style: 'adagio', minutes: 5.2 }],
    ],
  },
  {
    id: 'vespers', artist: 'noctis', title: 'VESPERS AT LOW RESOLUTION', year: 2020, kind: 'ALBUM',
    palette: 'sepia', motif: 'arch', style: 'aria', key: 'A', mode: 'dorian',
    blurb: 'Evening service music, transcribed from a recording so degraded that the transcription became the work.',
    tracks: [
      ['DEUS IN ADIUTORIUM', { style: 'chorale', minutes: 2.4 }],
      ['DIXIT DOMINUS', { style: 'aria', minutes: 4.8 }],
      ['LAUDATE PUERI', { style: 'baroque', minutes: 4.0 }],
      ['NISI DOMINUS', { style: 'adagio', minutes: 5.5 }],
      ['MAGNIFICAT', { style: 'march', minutes: 4.4 }],
    ],
  },

  {
    id: 'sinfonia', artist: 'halland', title: 'SINFONIA IN GREY', year: 2025, kind: 'ALBUM',
    palette: 'bone', motif: 'wave', style: 'adagio', key: 'B', mode: 'minor',
    blurb: 'Four movements for twenty-two players standing in the dark.',
    tracks: [
      ['I. ALLEGRO, SENZA COLORE', { style: 'march', minutes: 5.6 }],
      ['II. ADAGIO', { style: 'adagio', minutes: 7.1 }],
      ['III. SCHERZO — PRESTO', { style: 'scherzo', minutes: 3.2 }],
      ['IV. FINALE — MODERATO', { style: 'toccata', minutes: 6.0 }],
    ],
  },
  {
    id: 'northlight', artist: 'halland', title: 'NORTHERN LIGHT, LOW LIGHT', year: 2021, kind: 'ALBUM',
    palette: 'brass', motif: 'aurora', style: 'minimal', key: 'E', mode: 'dorian',
    blurb: 'Written for a latitude where the sun does not set, and performed only where it does not rise.',
    tracks: [
      ['LATITUDE 63', { style: 'minimal', minutes: 5.2 }],
      ['THE BLUE HOUR', { style: 'nocturne', minutes: 4.7 }],
      ['ICE, THINNING', { style: 'aria', minutes: 4.1 }],
      ['MIDNIGHT, STILL BRIGHT', { style: 'minimal', minutes: 6.3 }],
      ['RETURN OF THE DARK', { style: 'adagio', minutes: 5.9 }],
    ],
  },

  {
    id: 'toccatas', artist: 'moreau', title: 'TOCCATAS FOR A DEAD PIXEL', year: 2024, kind: 'ALBUM',
    palette: 'sepia', motif: 'lattice', style: 'toccata', key: 'D', mode: 'minor',
    blurb: 'Six toccatas, each built on a figure that refuses to change one note of itself.',
    tracks: [
      ['TOCCATA I', { style: 'toccata', minutes: 3.4 }],
      ['TOCCATA II', { style: 'baroque', minutes: 3.0 }],
      ['TOCCATA III — THE STUCK NOTE', { style: 'minimal', minutes: 4.2 }],
      ['TOCCATA IV', { style: 'toccata', minutes: 2.8 }],
      ['TOCCATA V — LAMENT', { style: 'adagio', minutes: 4.9 }],
      ['TOCCATA VI — PERPETUUM', { style: 'toccata', minutes: 3.6 }],
    ],
  },
  {
    id: 'thirty', artist: 'moreau', title: 'THIRTY VARIATIONS ON A SINGLE DOT', year: 2019, kind: 'ALBUM',
    palette: 'gold', motif: 'spiral', style: 'baroque', key: 'G', mode: 'major',
    blurb: 'A ground bass of one note, varied thirty times. Eight of them are recorded here.',
    tracks: [
      ['ARIA', { style: 'aria', minutes: 3.2 }],
      ['VAR. IV — CANON AT THE UNISON', { style: 'baroque', minutes: 2.1 }],
      ['VAR. IX — CANON AT THE THIRD', { style: 'baroque', minutes: 2.4 }],
      ['VAR. XIII', { style: 'nocturne', minutes: 3.8 }],
      ['VAR. XVI — OVERTURE', { style: 'march', minutes: 2.9 }],
      ['VAR. XXV — THE BLACK PEARL', { style: 'adagio', minutes: 6.4 }],
      ['VAR. XXX — QUODLIBET', { style: 'toccata', minutes: 2.6 }],
      ['ARIA DA CAPO', { style: 'aria', minutes: 3.2 }],
    ],
  },

  {
    id: 'firstlight', artist: 'pixphil', title: 'FIRST LIGHT', year: 2025, kind: 'ALBUM',
    palette: 'gold', motif: 'sunrise', style: 'march', key: 'C', mode: 'major',
    blurb: 'The record that made the case: lower the resolution, and the structure becomes audible.',
    tracks: [
      ['FIRST LIGHT', { style: 'march', minutes: 5.1 }],
      ['SIXTEEN LAMPS', { style: 'minimal', minutes: 4.4 }],
      ['THE GRID', { style: 'toccata', minutes: 3.7 }],
      ['A FIELD OF DOTS', { style: 'minimal', minutes: 5.8 }],
      ['NEAREST NEIGHBOUR', { style: 'scherzo', minutes: 2.9 }],
      ['FULL SCALE', { style: 'march', minutes: 6.2 }],
    ],
  },
  {
    id: 'machine', artist: 'pixphil', title: 'MUSIC FOR A SLEEPING MACHINE', year: 2023, kind: 'ALBUM',
    palette: 'brass', motif: 'circuit', style: 'minimal', key: 'A', mode: 'mixolydian',
    blurb: 'Commissioned by a data centre that wanted something to play when nobody was there.',
    tracks: [
      ['IDLE', { style: 'minimal', minutes: 6.6 }],
      ['FAN CURVE', { style: 'minimal', minutes: 5.2 }],
      ['THERMAL', { style: 'nocturne', minutes: 4.8 }],
      ['NIGHT JOB', { style: 'toccata', minutes: 3.9 }],
      ['SHUTDOWN', { style: 'adagio', minutes: 5.7 }],
    ],
  },
  {
    id: 'anthems', artist: 'pixphil', title: 'ANTHEMS FOR SMALL SCREENS', year: 2022, kind: 'EP',
    palette: 'velvet', motif: 'bars', style: 'march', key: 'F', mode: 'major',
    blurb: 'Four anthems engineered to survive being played through a telephone speaker.',
    tracks: [
      ['ANTHEM I', { style: 'march', minutes: 2.8 }],
      ['ANTHEM II', { style: 'waltz', minutes: 2.5 }],
      ['ANTHEM III', { style: 'scherzo', minutes: 2.2 }],
      ['ANTHEM IV', { style: 'chorale', minutes: 3.4 }],
    ],
  },

  {
    id: 'dust', artist: 'sable', title: 'DUST & DAYLIGHT', year: 2024, kind: 'ALBUM',
    palette: 'sepia', motif: 'arch', style: 'aria', key: 'E', mode: 'lydian',
    blurb: 'Two lines that never meet, recorded in a room with one window.',
    tracks: [
      ['MORNING, WITH DUST', { style: 'aria', minutes: 4.1 }],
      ['A LINE, ASCENDING', { style: 'minimal', minutes: 3.6 }],
      ['A LINE, DESCENDING', { style: 'nocturne', minutes: 3.9 }],
      ['NOON', { style: 'waltz', minutes: 2.8 }],
      ['DUST, SETTLING', { style: 'adagio', minutes: 5.3 }],
    ],
  },
  {
    id: 'lull', artist: 'sable', title: 'LULLABIES FOR THE LAST ROW', year: 2021, kind: 'EP',
    palette: 'marble', motif: 'moon', style: 'nocturne', key: 'B', mode: 'minor',
    blurb: 'Written quietly enough that the back of the hall has to lean forward.',
    tracks: [
      ['LULLABY I', { style: 'nocturne', minutes: 4.0 }],
      ['LULLABY II', { style: 'aria', minutes: 3.5 }],
      ['LULLABY III', { style: 'adagio', minutes: 4.8 }],
      ['LULLABY IV — DAWN', { style: 'minimal', minutes: 3.3 }],
    ],
  },

  {
    id: 'lowend', artist: 'kovacs', title: 'THE LOW END OF THE HALL', year: 2023, kind: 'ALBUM',
    palette: 'brass', motif: 'wave', style: 'adagio', key: 'C', mode: 'phrygian',
    blurb: 'Everything above the stave is left to the room.',
    tracks: [
      ['FOUNDATION', { style: 'adagio', minutes: 5.6 }],
      ['LOAD-BEARING', { style: 'minimal', minutes: 4.9 }],
      ['THE BASEMENT', { style: 'nocturne', minutes: 5.1 }],
      ['SETTLING', { style: 'chorale', minutes: 4.2 }],
    ],
  },
  {
    id: 'ground', artist: 'kovacs', title: 'GROUND BASS', year: 2020, kind: 'ALBUM',
    palette: 'sepia', motif: 'lattice', style: 'baroque', key: 'G', mode: 'minor',
    blurb: 'A passacaglia and its consequences.',
    tracks: [
      ['THE GROUND', { style: 'baroque', minutes: 3.8 }],
      ['PASSACAGLIA', { style: 'baroque', minutes: 6.9 }],
      ['CHACONNE', { style: 'waltz', minutes: 4.5 }],
      ['THE GROUND, REMOVED', { style: 'adagio', minutes: 5.0 }],
    ],
  },
];

/* ============================================================================
   Derivation
   ========================================================================== */

/**
 * @typedef {object} Track
 * @property {string} id
 * @property {string} title
 * @property {string} albumId
 * @property {string} artistId
 * @property {number} index      1-based position on the record.
 * @property {string} seed
 * @property {string} style
 * @property {string} key
 * @property {string} mode
 * @property {number} bpm
 * @property {number} targetBars
 * @property {number} duration   Seconds.
 * @property {[number,number]} meter
 * @property {number} plays      Fictional play count.
 */

/**
 * @typedef {AlbumSpec & {trackIds: string[], duration: number, trackCount: number, artistName: string}} Album
 */

const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Choose a bar count that lands the piece near a requested runtime.
 * @param {string} style @param {number} bpm @param {number} minutes
 */
function barsForMinutes(style, bpm, minutes) {
  const meterTop = (STYLES[style] ?? STYLES.baroque).meter[0];
  const wanted = (minutes * 60 * bpm) / (60 * meterTop);
  return Math.max(18, Math.min(160, Math.round(wanted * 0.92)));
}

/** @type {Track[]} */
export const TRACKS = [];
/** @type {Album[]} */
export const ALBUM_LIST = [];

for (const spec of ALBUMS) {
  const artist = ARTISTS.find((a) => a.id === spec.artist);
  const rnd = Random(`${spec.id}::album`);
  /** @type {string[]} */
  const trackIds = [];
  let albumDuration = 0;

  spec.tracks.forEach((entry, i) => {
    const [title, over] = Array.isArray(entry) ? entry : [entry, {}];
    const id = `${spec.id}-${i + 1}`;
    const seed = `${spec.id}::${i + 1}::${title}`;
    const style = over.style ?? spec.style;
    const key = over.key ?? (rnd.chance(0.7) ? spec.key : rnd.pick(KEYS));
    const mode = over.mode ?? spec.mode;
    const bpm = tempoFor({ seed, style });
    const minutes = over.minutes ?? rnd.float(2.6, 5.2);
    const targetBars = barsForMinutes(style, bpm, minutes);
    const trackSpec = { seed, style, key, mode, bpm, targetBars };
    // A written movement has a fixed length because it has fixed notes. A
    // generated one has to be estimated from its style and bar count.
    const duration = over.score ? minutes * 60 : estimateDuration(trackSpec);

    TRACKS.push({
      id, title, albumId: spec.id, artistId: spec.artist, index: i + 1,
      seed, style, key, mode, bpm, targetBars, duration,
      /** Set when the movement is written down rather than composed at load. */
      score: over.score ?? null,
      meter: (STYLES[style] ?? STYLES.baroque).meter,
      plays: Math.round(rnd.float(0.04, 1) * artist.monthly * 0.6),
    });
    trackIds.push(id);
    albumDuration += duration;
  });

  ALBUM_LIST.push({
    ...spec,
    trackIds,
    duration: albumDuration,
    trackCount: trackIds.length,
    artistName: artist.name,
  });
}

/* ============================================================================
   Curated programmes
   ========================================================================== */

/**
 * @typedef {object} Playlist
 * @property {string} id
 * @property {string} title
 * @property {string} subtitle
 * @property {string} blurb
 * @property {string} palette
 * @property {string} motif
 * @property {string[]} trackIds
 * @property {string} curator
 */

/**
 * Programmes are defined declaratively by a predicate over the catalogue, which
 * keeps them correct when the repertoire changes.
 * @type {Array<Omit<Playlist,'trackIds'> & {select: (t: Track) => boolean, limit?: number}>}
 */
const PROGRAMME_SPECS = [
  {
    id: 'tonight', title: "TONIGHT'S PROGRAMME", subtitle: 'CURATED · 90 MIN',
    blurb: 'An evening built the way Vantor builds one: slow, then inevitable.',
    palette: 'gold', motif: 'hall', curator: 'MAESTRO',
    select: (t) => ['adagio', 'chorale', 'march', 'aria'].includes(t.style), limit: 14,
  },
  {
    id: 'downbeat', title: 'DOWNBEAT', subtitle: 'THE LOUD END',
    blurb: 'Everything that begins on the beat and means it.',
    palette: 'velvet', motif: 'baton', curator: 'MAESTRO',
    select: (t) => ['march', 'toccata', 'scherzo'].includes(t.style), limit: 16,
  },
  {
    id: 'after-hours', title: 'AFTER HOURS', subtitle: 'FOR EMPTY ROOMS',
    blurb: 'Recorded at night, best heard at night.',
    palette: 'marble', motif: 'moon', curator: 'ANNIKA RØST',
    select: (t) => ['nocturne', 'aria'].includes(t.style), limit: 14,
  },
  {
    id: 'greyscale-only', title: 'STUDY IN GREYSCALE', subtitle: 'STRINGS ONLY',
    blurb: 'No colour. No vibrato worth speaking of. Structure, plainly stated.',
    palette: 'bone', motif: 'geometry', curator: 'VESPER QUARTET',
    select: (t) => ['adagio', 'chorale', 'minimal'].includes(t.style), limit: 12,
  },
  {
    id: 'the-machine', title: 'FOR A SLEEPING MACHINE', subtitle: 'LONG FORM',
    blurb: 'Cells, repeating. Nothing resolves in a hurry.',
    palette: 'brass', motif: 'circuit', curator: 'THE PIXEL PHILHARMONIC',
    select: (t) => t.style === 'minimal' || t.duration > 300, limit: 12,
  },
  {
    id: 'first-position', title: 'FIRST POSITION', subtitle: 'AN INTRODUCTION',
    blurb: 'If you have never sat in a dark hall before, start here.',
    palette: 'sepia', motif: 'staff', curator: 'MAESTRO',
    select: (t) => t.index === 1, limit: 16,
  },
];

/** @type {Playlist[]} */
export const PLAYLISTS = PROGRAMME_SPECS.map((spec) => {
  const rnd = Random(`${spec.id}::programme`);
  const pool = TRACKS.filter(spec.select);
  const picked = rnd.shuffle(pool).slice(0, spec.limit ?? 12);
  const { select, limit, ...rest } = spec;
  return { ...rest, trackIds: picked.map((t) => t.id) };
});

/* ============================================================================
   Indexes and lookups
   ========================================================================== */

const trackById = new Map(TRACKS.map((t) => [t.id, t]));
const albumById = new Map(ALBUM_LIST.map((a) => [a.id, a]));
const artistById = new Map(ARTISTS.map((a) => [a.id, a]));
const playlistById = new Map(PLAYLISTS.map((p) => [p.id, p]));

/** @param {string} id @returns {Track|undefined} */
export const getTrack = (id) => trackById.get(id);
/** @param {string} id @returns {Album|undefined} */
export const getAlbum = (id) => albumById.get(id);
/** @param {string} id @returns {Artist|undefined} */
export const getArtist = (id) => artistById.get(id);
/** @param {string} id @returns {Playlist|undefined} */
export const getPlaylist = (id) => playlistById.get(id);

/** @param {string} albumId @returns {Track[]} */
export const albumTracks = (albumId) =>
  (albumById.get(albumId)?.trackIds ?? []).map((id) => trackById.get(id)).filter(Boolean);

/** @param {string} artistId @returns {Album[]} */
export const artistAlbums = (artistId) =>
  ALBUM_LIST.filter((a) => a.artist === artistId).sort((a, b) => b.year - a.year);

/** @param {string} artistId @returns {Track[]} */
export const artistTracks = (artistId) => TRACKS.filter((t) => t.artistId === artistId);

/** @param {string} artistId @returns {Track[]} most-played first */
export const artistTopTracks = (artistId, n = 5) =>
  artistTracks(artistId).sort((a, b) => b.plays - a.plays).slice(0, n);

/** @param {string} id @returns {Track[]} */
export const playlistTracks = (id) =>
  (playlistById.get(id)?.trackIds ?? []).map((t) => trackById.get(t)).filter(Boolean);

/**
 * Resolve any entity reference of the form `type:id`.
 * @param {string} ref
 */
export function resolve(ref) {
  const [type, id] = ref.split(':');
  switch (type) {
    case 'track': return getTrack(id);
    case 'album': return getAlbum(id);
    case 'artist': return getArtist(id);
    case 'playlist': return getPlaylist(id);
    default: return undefined;
  }
}

/**
 * Everything needed to render a track row without further lookups.
 * @param {Track} track
 */
export function decorate(track) {
  const album = albumById.get(track.albumId);
  const artist = artistById.get(track.artistId);
  return { track, album, artist };
}

export const CATALOG_STATS = Object.freeze({
  artists: ARTISTS.length,
  albums: ALBUM_LIST.length,
  tracks: TRACKS.length,
  totalDuration: TRACKS.reduce((s, t) => s + t.duration, 0),
});
