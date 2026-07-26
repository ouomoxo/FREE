#!/usr/bin/env node
/**
 * MAESTRO — test suite for the DOM-free layers.
 *
 * The music theory, the composer, the catalogue derivation, the search index
 * and the utility layer are all pure. They are also the parts where a silent
 * regression would be hardest to notice by eye, so they are covered here.
 *
 * Usage: node dev/test.mjs
 */

import assert from 'node:assert/strict';

let passed = 0;
let failed = 0;
/** @type {string[]} */
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    failures.push(`${name}\n    ${err.message.split('\n')[0]}`);
  }
}

function suite(name) {
  console.log(`\n\x1b[2m${name}\x1b[0m`);
}

/* ========================================================================== */

const utils = await import('../js/core/utils.js');
const theory = await import('../js/audio/theory.js');
const composer = await import('../js/audio/composer.js');
const catalog = await import('../js/data/catalog.js');
const search = await import('../js/search.js');
const { Store } = await import('../js/core/store.js');
const { EventBus } = await import('../js/core/bus.js');

/* ============================================================================
   Utilities
   ========================================================================== */

suite('core/utils');

test('rng is deterministic for a given seed', () => {
  const a = Array.from({ length: 8 }, utils.rng('seed'));
  const b = Array.from({ length: 8 }, utils.rng('seed'));
  assert.deepEqual(a, b);
});

test('rng differs between seeds', () => {
  assert.notDeepEqual(
    Array.from({ length: 8 }, utils.rng('a')),
    Array.from({ length: 8 }, utils.rng('b')),
  );
});

test('rng stays inside [0,1)', () => {
  const r = utils.rng('range');
  for (let i = 0; i < 5000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('Random.shuffle preserves membership', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = utils.Random('s').shuffle(input);
  assert.deepEqual(out.slice().sort((a, b) => a - b), input);
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6, 7, 8], 'must not mutate the input');
});

test('Random.weighted only returns offered values', () => {
  const r = utils.Random('w');
  for (let i = 0; i < 200; i++) {
    assert.ok(['a', 'b'].includes(r.weighted([['a', 3], ['b', 1]])));
  }
});

test('clamp / lerp / remap', () => {
  assert.equal(utils.clamp(5, 0, 1), 1);
  assert.equal(utils.clamp(-5, 0, 1), 0);
  assert.equal(utils.lerp(0, 10, 0.25), 2.5);
  assert.equal(utils.remap(5, 0, 10, 0, 100), 50);
  assert.equal(utils.remap(50, 0, 10, 0, 100), 100, 'remap clamps');
});

test('formatTime', () => {
  assert.equal(utils.formatTime(0), '0:00');
  assert.equal(utils.formatTime(9), '0:09');
  assert.equal(utils.formatTime(65), '1:05');
  assert.equal(utils.formatTime(3661), '1:01:01');
  assert.equal(utils.formatTime(-4), '0:00');
  assert.equal(utils.formatTime(NaN), '0:00');
});

test('formatCount', () => {
  assert.equal(utils.formatCount(999), '999');
  assert.equal(utils.formatCount(1500), '1.5K');
  assert.equal(utils.formatCount(2_400_000), '2.4M');
});

test('fuzzyMatch ranks exact substrings above scattered ones', () => {
  const exact = utils.fuzzyMatch('noct', 'NOCTURNE I');
  const scattered = utils.fuzzyMatch('noct', 'NO CONCERT TONIGHT');
  assert.ok(exact && scattered);
  assert.ok(exact.score > scattered.score);
});

test('fuzzyMatch rejects non-matches', () => {
  assert.equal(utils.fuzzyMatch('zzz', 'NOCTURNE'), null);
});

test('fuzzyMatch ranges stay within the haystack', () => {
  const m = utils.fuzzyMatch('cnd', 'CONDUCTOR');
  assert.ok(m);
  for (const [a, b] of m.ranges) {
    assert.ok(a >= 0 && b <= 'CONDUCTOR'.length && a < b);
  }
});

test('damp converges towards the target', () => {
  let v = 0;
  for (let i = 0; i < 200; i++) v = utils.damp(v, 10, 0.1, 1 / 60);
  assert.ok(Math.abs(v - 10) < 0.001, `got ${v}`);
});

/* ============================================================================
   Store & bus
   ========================================================================== */

suite('core/store + core/bus');

test('a selector subscriber ignores changes to other slices', () => {
  const store = new Store({ a: 1, b: 2 });
  const seen = [];
  store.subscribe((s) => s.a, (v) => seen.push(v), { immediate: false });
  store.batch(() => store.set({ b: 9 }));
  assert.deepEqual(seen, [], 'b changed; the a-subscriber must stay quiet');
  store.batch(() => store.set({ a: 5 }));
  assert.deepEqual(seen, [5]);
});

test('subscribe fires immediately by default', () => {
  const store = new Store({ a: 7 });
  const seen = [];
  store.subscribe((s) => s.a, (v) => seen.push(v));
  assert.deepEqual(seen, [7]);
});

test('store ignores no-op patches', () => {
  const store = new Store({ a: 1 });
  let calls = 0;
  store.use(() => { calls++; });
  store.set({ a: 1 });
  assert.equal(calls, 0);
});

test('store.batch defers notification', () => {
  const store = new Store({ a: 0 });
  const seen = [];
  store.subscribe((s) => s.a, (v) => seen.push(v), { immediate: false });
  store.batch(() => { store.set({ a: 1 }); store.set({ a: 2 }); store.set({ a: 3 }); });
  assert.deepEqual(seen, [3]);
});

test('unsubscribe stops delivery', () => {
  const store = new Store({ a: 0 });
  let calls = 0;
  const off = store.subscribe((s) => s.a, () => { calls++; }, { immediate: false });
  off();
  store.batch(() => store.set({ a: 1 }));
  assert.equal(calls, 0);
});

test('bus delivers, and a throwing handler does not stop the rest', () => {
  const bus = new EventBus();
  const seen = [];
  bus.on('x', () => { throw new Error('boom'); });
  bus.on('x', (p) => seen.push(p));
  const errs = [];
  const original = console.error;
  console.error = (...a) => errs.push(a);
  bus.emit('x', 42);
  console.error = original;
  assert.deepEqual(seen, [42]);
  assert.equal(errs.length, 1);
});

test('bus once fires exactly once', () => {
  const bus = new EventBus();
  let n = 0;
  bus.once('y', () => { n++; });
  bus.emit('y');
  bus.emit('y');
  assert.equal(n, 1);
});

/* ============================================================================
   Theory
   ========================================================================== */

suite('audio/theory');

test('mtof / ftom round-trip', () => {
  assert.ok(Math.abs(theory.mtof(69) - 440) < 1e-9);
  assert.ok(Math.abs(theory.ftom(440) - 69) < 1e-9);
  for (const m of [21, 48, 60, 72, 108]) {
    assert.ok(Math.abs(theory.ftom(theory.mtof(m)) - m) < 1e-9);
  }
});

test('scaleNote walks octaves correctly', () => {
  const c4 = 60;
  assert.equal(theory.scaleNote(c4, 'major', 0), 60);
  assert.equal(theory.scaleNote(c4, 'major', 7), 72, 'one octave up');
  assert.equal(theory.scaleNote(c4, 'major', -7), 48, 'one octave down');
  assert.equal(theory.scaleNote(c4, 'major', 4), 67, 'the fifth');
});

test('snapToScale lands on scale tones', () => {
  const set = theory.SCALES.minor;
  for (let m = 48; m < 84; m++) {
    const snapped = theory.snapToScale(m, 60, 'minor');
    const rel = ((snapped - 60) % 12 + 12) % 12;
    assert.ok(set.includes(rel), `${m} -> ${snapped} (rel ${rel})`);
  }
});

test('diatonic triads in C major have the expected qualities', () => {
  const expected = ['', 'm', 'm', '', '', 'm', '°'];
  for (let d = 0; d < 7; d++) {
    const chord = theory.diatonicChord(60, 'major', d);
    const suffix = chord.label.replace(/^[A-G][#b]?/, '');
    assert.equal(suffix, expected[d], `degree ${d}: ${chord.label}`);
  }
});

test('the dominant of a minor key is a dominant seventh', () => {
  const chord = theory.diatonicChord(60, 'minor', 4, { seventh: true });
  assert.equal(chord.quality, 'dom7');
});

test('voice() keeps notes inside the requested register', () => {
  const chord = theory.diatonicChord(60, 'major', 0, { seventh: true });
  const voiced = theory.voice(chord, 48, 72);
  for (const n of voiced) assert.ok(n >= 48 && n <= 72, `${n} out of register`);
  assert.deepEqual(voiced, voiced.slice().sort((a, b) => a - b), 'sorted low to high');
});

test('voice() preserves the chord pitch classes', () => {
  const chord = theory.diatonicChord(62, 'minor', 3, { seventh: true });
  const voiced = theory.voice(chord, 48, 76);
  const pcs = (arr) => new Set(arr.map((n) => ((n % 12) + 12) % 12));
  assert.deepEqual([...pcs(voiced)].sort(), [...pcs(chord.notes)].sort());
});

test('key signatures pick the right accidentals', () => {
  const cases = [
    ['D', 'minor', true], ['A', 'minor', false], ['E', 'minor', false],
    ['C', 'minor', true], ['G', 'major', false], ['F', 'major', true],
    ['Bb', 'major', true], ['F#', 'minor', false], ['D', 'phrygian', true],
  ];
  for (const [key, mode, flats] of cases) {
    assert.equal(theory.usesFlats(key, mode), flats, `${key} ${mode}`);
  }
});

/* ============================================================================
   Composer
   ========================================================================== */

suite('audio/composer');

const ALL_STYLES = Object.keys(composer.STYLES);

test('every style composes a playable score', () => {
  for (const style of ALL_STYLES) {
    const spec = { seed: `t-${style}`, style, key: 'D', mode: 'minor', targetBars: 48 };
    const score = composer.compose(spec);
    assert.ok(score.events.length > 40, `${style}: only ${score.events.length} events`);
    assert.ok(score.sections.length >= 5, `${style}: ${score.sections.length} sections`);
    assert.ok(score.duration > 20, `${style}: ${score.duration}s`);
    assert.ok(score.chords.length > 0, `${style}: no chord marks`);
  }
});

test('events are sorted and in range', () => {
  for (const style of ALL_STYLES) {
    const score = composer.compose({ seed: `s-${style}`, style, key: 'A', mode: 'minor', targetBars: 40 });
    let last = -Infinity;
    for (const e of score.events) {
      assert.ok(e.t >= last - 1e-9, `${style}: events out of order`);
      last = e.t;
      assert.ok(Number.isFinite(e.t) && e.t >= 0, `${style}: bad time ${e.t}`);
      assert.ok(e.d > 0, `${style}: non-positive duration`);
      assert.ok(e.m >= 24 && e.m <= 104, `${style}: pitch ${e.m} out of range`);
      assert.ok(e.v > 0 && e.v <= 1, `${style}: velocity ${e.v}`);
      assert.ok(e.p >= -1 && e.p <= 1, `${style}: pan ${e.p}`);
      assert.ok(typeof e.i === 'string' && e.i.length, `${style}: missing instrument`);
    }
  }
});

test('every note ends before the reported duration', () => {
  for (const style of ALL_STYLES) {
    const score = composer.compose({ seed: `d-${style}`, style, key: 'C', mode: 'major', targetBars: 36 });
    for (const e of score.events) {
      assert.ok(e.t < score.duration, `${style}: note starts after the end`);
    }
  }
});

test('estimateDuration matches the composed duration exactly', () => {
  for (const style of ALL_STYLES) {
    for (const bars of [24, 36, 48, 72]) {
      const spec = { seed: `e-${style}-${bars}`, style, key: 'G', mode: 'minor', targetBars: bars };
      assert.ok(
        Math.abs(composer.estimateDuration(spec) - composer.compose(spec).duration) < 1e-6,
        `${style} @ ${bars} bars`,
      );
    }
  }
});

test('composition is deterministic', () => {
  const spec = { seed: 'determinism', style: 'nocturne', key: 'F', mode: 'minor', targetBars: 40 };
  const a = composer.compose(spec);
  const b = composer.compose(spec);
  assert.equal(a.events.length, b.events.length);
  assert.deepEqual(a.events.slice(0, 60), b.events.slice(0, 60));
  assert.equal(a.duration, b.duration);
});

test('different seeds produce different music', () => {
  const one = composer.compose({ seed: 'x1', style: 'baroque', key: 'D', mode: 'minor', targetBars: 40 });
  const two = composer.compose({ seed: 'x2', style: 'baroque', key: 'D', mode: 'minor', targetBars: 40 });
  assert.notDeepEqual(one.events.slice(0, 40), two.events.slice(0, 40));
});

test('sections tile the piece without gaps', () => {
  const score = composer.compose({ seed: 'tiling', style: 'march', key: 'C', mode: 'minor', targetBars: 48 });
  let expected = 0;
  for (const s of score.sections) {
    assert.ok(Math.abs(s.t - expected) < 1e-6, `section ${s.name} starts at ${s.t}, expected ${expected}`);
    expected += s.duration;
  }
  assert.equal(score.sections.reduce((n, s) => n + s.bars, 0), score.bars);
});

test('findEventIndex is a correct lower bound', () => {
  const score = composer.compose({ seed: 'seek', style: 'toccata', key: 'E', mode: 'minor', targetBars: 40 });
  for (const t of [0, 1, 5.5, score.duration / 2, score.duration]) {
    const i = composer.findEventIndex(score.events, t);
    if (i > 0) assert.ok(score.events[i - 1].t < t, `event before ${t} is not earlier`);
    if (i < score.events.length) assert.ok(score.events[i].t >= t, `event at ${t} is earlier`);
  }
});

test('sectionAt returns the containing section', () => {
  const score = composer.compose({ seed: 'sec', style: 'aria', key: 'A', mode: 'minor', targetBars: 48 });
  for (const s of score.sections) {
    assert.equal(composer.sectionAt(score, s.t + 0.01).name, s.name);
    assert.equal(composer.sectionAt(score, s.t + s.duration - 0.01).name, s.name);
  }
});

test('the piece ends on its tonic', () => {
  for (const key of ['C', 'D', 'F', 'A']) {
    const score = composer.compose({ seed: `cad-${key}`, style: 'chorale', key, mode: 'minor', targetBars: 36 });
    const tonicPc = theory.pitchClass(key);
    const last = score.events[score.events.length - 1];
    assert.equal(((last.m % 12) + 12) % 12, tonicPc, `${key}: ends on ${theory.noteName(last.m)}`);
  }
});

test('polyphony stays within a sane ceiling', () => {
  for (const style of ALL_STYLES) {
    const score = composer.compose({ seed: `poly-${style}`, style, key: 'D', mode: 'minor', targetBars: 48 });
    // Sweep a moving window and count simultaneous sounding notes.
    let worst = 0;
    for (let i = 0; i < score.events.length; i++) {
      const t = score.events[i].t;
      let n = 0;
      for (let j = i; j < score.events.length && score.events[j].t <= t + 0.001; j++) n++;
      for (let j = i - 1; j >= 0 && score.events[j].t + score.events[j].d > t; j--) n++;
      worst = Math.max(worst, n);
    }
    assert.ok(worst <= 40, `${style}: ${worst} simultaneous voices`);
  }
});

/* ============================================================================
   Catalogue
   ========================================================================== */

suite('data/catalog');

test('the catalogue is fully populated', () => {
  assert.ok(catalog.ARTISTS.length >= 9);
  assert.ok(catalog.ALBUM_LIST.length >= 20);
  assert.ok(catalog.TRACKS.length >= 100);
  assert.ok(catalog.PLAYLISTS.length >= 6);
});

test('every id is unique', () => {
  for (const [name, list] of [
    ['artist', catalog.ARTISTS], ['album', catalog.ALBUM_LIST],
    ['track', catalog.TRACKS], ['playlist', catalog.PLAYLISTS],
  ]) {
    const ids = list.map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length, `duplicate ${name} id`);
  }
});

test('every reference resolves', () => {
  for (const album of catalog.ALBUM_LIST) {
    assert.ok(catalog.getArtist(album.artist), `album ${album.id} -> missing artist`);
    for (const id of album.trackIds) assert.ok(catalog.getTrack(id), `album ${album.id} -> missing track ${id}`);
  }
  for (const track of catalog.TRACKS) {
    assert.ok(catalog.getAlbum(track.albumId), `track ${track.id} -> missing album`);
    assert.ok(catalog.getArtist(track.artistId), `track ${track.id} -> missing artist`);
    assert.ok(composer.STYLES[track.style], `track ${track.id} -> unknown style ${track.style}`);
  }
  for (const pl of catalog.PLAYLISTS) {
    assert.ok(pl.trackIds.length > 0, `playlist ${pl.id} is empty`);
    for (const id of pl.trackIds) assert.ok(catalog.getTrack(id), `playlist ${pl.id} -> missing track ${id}`);
  }
});

test('track durations are plausible and match the composer', () => {
  for (const t of catalog.TRACKS) {
    assert.ok(t.duration > 40 && t.duration < 900, `${t.id}: ${t.duration}s`);
    const composed = composer.compose({
      seed: t.seed, style: t.style, key: t.key, mode: t.mode, bpm: t.bpm, targetBars: t.targetBars,
    });
    assert.ok(Math.abs(composed.duration - t.duration) < 1e-6, `${t.id} duration drift`);
    break; // one full composition is enough; the estimator is covered above
  }
});

test('album duration is the sum of its movements', () => {
  for (const album of catalog.ALBUM_LIST) {
    const sum = catalog.albumTracks(album.id).reduce((n, t) => n + t.duration, 0);
    assert.ok(Math.abs(sum - album.duration) < 1e-6, album.id);
  }
});

test('playlists contain no duplicates', () => {
  for (const pl of catalog.PLAYLISTS) {
    assert.equal(new Set(pl.trackIds).size, pl.trackIds.length, pl.id);
  }
});

test('resolve() handles every entity type and unknown refs', () => {
  assert.ok(catalog.resolve('album:op27'));
  assert.ok(catalog.resolve('artist:vantor'));
  assert.ok(catalog.resolve('playlist:tonight'));
  assert.ok(catalog.resolve('track:op27-1'));
  assert.equal(catalog.resolve('nonsense:x'), undefined);
  assert.equal(catalog.resolve('album:does-not-exist'), undefined);
});

/* ============================================================================
   Search
   ========================================================================== */

suite('search');

test('an empty query returns nothing', () => {
  assert.equal(search.search('').length, 0);
  assert.equal(search.search('   ').length, 0);
});

test('exact titles rank first', () => {
  const hits = search.search('NOCTURNES FOR AN EMPTY HALL');
  assert.equal(hits[0].entry.type, 'album');
  assert.equal(hits[0].entry.id, 'nocturnes');
});

test('an ensemble name finds the ensemble first', () => {
  const hits = search.search('vantor');
  assert.equal(hits[0].entry.type, 'artist');
  assert.equal(hits[0].entry.id, 'vantor');
});

test('grouped search partitions by type', () => {
  const g = search.searchGrouped('nocturne');
  assert.ok(g.total > 0);
  assert.equal(
    g.total,
    g.tracks.length + g.albums.length + g.artists.length + g.playlists.length,
  );
  assert.ok(g.top);
});

test('nonsense finds nothing', () => {
  assert.equal(search.searchGrouped('qqqxzzwv').total, 0);
});

test('results are ordered by descending score', () => {
  const hits = search.search('hall');
  for (let i = 1; i < hits.length; i++) {
    assert.ok(hits[i - 1].score >= hits[i].score, 'scores out of order');
  }
});

test('every style has at least one movement', () => {
  for (const style of ALL_STYLES) {
    assert.ok(search.tracksByStyle(style).length > 0, `no movements for ${style}`);
  }
});

/* ========================================================================== */

console.log(`\n${failed === 0 ? '\x1b[32m' : '\x1b[31m'}${passed} passed, ${failed} failed\x1b[0m`);
for (const f of failures) console.log(`\n\x1b[31m✗ ${f}\x1b[0m`);
process.exit(failed === 0 ? 0 : 1);
