/**
 * MAESTRO — Search.
 *
 * A small inverted-ish index built once at boot: every entity contributes a
 * haystack string, and queries are scored with the shared fuzzy matcher.
 * Exact substring hits outrank scattered subsequence hits, and matches on the
 * primary field outrank matches on secondary fields, so "vantor" finds the
 * conductor before it finds a record he happens to appear on.
 *
 * @module search
 */

import { TRACKS, ALBUM_LIST, ARTISTS, PLAYLISTS, getArtist, getAlbum } from './data/catalog.js';
import { fuzzyMatch, normalizeText } from './core/utils.js';
import { STYLES } from './audio/composer.js';

/**
 * @typedef {object} IndexEntry
 * @property {'track'|'album'|'artist'|'playlist'} type
 * @property {string} id
 * @property {string} primary    The name shown to the user.
 * @property {string} secondary  Supporting text.
 * @property {string} extra      Everything else worth matching.
 * @property {number} weight     Static prior (popularity, importance).
 * @property {any} entity
 */

/** @type {IndexEntry[]} */
const INDEX = [];

for (const artist of ARTISTS) {
  INDEX.push({
    type: 'artist', id: artist.id, entity: artist,
    primary: artist.name,
    secondary: artist.role,
    extra: `${artist.city} ${artist.tagline}`,
    weight: 1.35 + artist.monthly / 4_000_000,
  });
}

for (const album of ALBUM_LIST) {
  INDEX.push({
    type: 'album', id: album.id, entity: album,
    primary: album.title,
    secondary: album.artistName,
    extra: `${album.kind} ${album.year} ${album.blurb}`,
    weight: 1.15,
  });
}

for (const pl of PLAYLISTS) {
  INDEX.push({
    type: 'playlist', id: pl.id, entity: pl,
    primary: pl.title,
    secondary: pl.subtitle,
    extra: `${pl.curator} ${pl.blurb} programme playlist`,
    weight: 1.1,
  });
}

for (const track of TRACKS) {
  const album = getAlbum(track.albumId);
  const artist = getArtist(track.artistId);
  INDEX.push({
    type: 'track', id: track.id, entity: track,
    primary: track.title,
    secondary: `${artist.name} · ${album.title}`,
    extra: `${STYLES[track.style]?.label ?? track.style} ${track.key} ${track.mode} ${track.bpm}bpm`,
    weight: 1 + track.plays / 3_000_000,
  });
}

/**
 * @typedef {object} SearchHit
 * @property {IndexEntry} entry
 * @property {number} score
 * @property {Array<[number,number]>} ranges Highlight ranges in `primary`.
 */

/**
 * Score the whole index against a query.
 * @param {string} query
 * @param {{limit?: number, types?: string[]}} [opts]
 * @returns {SearchHit[]}
 */
export function search(query, opts = {}) {
  const q = query.trim();
  if (!q) return [];
  /** @type {SearchHit[]} */
  const hits = [];

  for (const entry of INDEX) {
    if (opts.types && !opts.types.includes(entry.type)) continue;

    const p = fuzzyMatch(q, entry.primary);
    const s = p ? null : fuzzyMatch(q, entry.secondary);
    const e = p || s ? null : fuzzyMatch(q, entry.extra);

    let score = 0;
    /** @type {Array<[number,number]>} */
    let ranges = [];
    if (p) { score = p.score * 1.0; ranges = p.ranges; }
    else if (s) { score = s.score * 0.55; }
    else if (e) { score = e.score * 0.3; }
    else continue;

    hits.push({ entry, score: score * entry.weight, ranges });
  }

  hits.sort((a, b) => b.score - a.score);
  return opts.limit ? hits.slice(0, opts.limit) : hits;
}

/**
 * Search, grouped by entity type, with a single "top result".
 * @param {string} query
 */
export function searchGrouped(query) {
  const hits = search(query);
  const groups = { track: [], album: [], artist: [], playlist: [] };
  for (const hit of hits) groups[hit.entry.type].push(hit);
  return {
    top: hits[0] ?? null,
    tracks: groups.track,
    albums: groups.album,
    artists: groups.artist,
    playlists: groups.playlist,
    total: hits.length,
  };
}

/**
 * Wrap matched ranges in `<mark>`, safely.
 * @param {string} text @param {Array<[number,number]>} ranges
 * @returns {DocumentFragment}
 */
export function highlight(text, ranges) {
  const frag = document.createDocumentFragment();
  if (!ranges?.length) { frag.append(text); return frag; }
  // Ranges are computed against the normalised string; lengths match because
  // normalisation only folds diacritics and case, never changes length.
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) frag.append(text.slice(cursor, start));
    const mark = document.createElement('mark');
    mark.textContent = text.slice(start, end);
    frag.append(mark);
    cursor = end;
  }
  if (cursor < text.length) frag.append(text.slice(cursor));
  return frag;
}

/** Suggestions shown before the user has typed anything. */
export const SUGGESTIONS = [
  'CONDUCTOR', 'NOCTURNE', 'TOCCATA', 'GREY', 'HANDS', 'PIXEL', 'ADAGIO', 'MASS',
];

/** Browse-by-form tiles for the empty search state. */
export const BROWSE_FORMS = Object.entries(STYLES).map(([id, s]) => ({
  id, label: s.label, meter: `${s.meter[0]}/${s.meter[1]}`,
  tempo: `${s.bpmRange[0]}–${s.bpmRange[1]} BPM`,
}));

/** @param {string} styleId */
export const tracksByStyle = (styleId) => TRACKS.filter((t) => t.style === styleId);

export const INDEX_SIZE = INDEX.length;
