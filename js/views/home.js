/**
 * MAESTRO — Hall (home).
 * @module views/home
 */

import { h, pxText } from '../core/dom.js';
import { icon } from '../ui/icons.js';
import {
  ALBUM_LIST, PLAYLISTS, ARTISTS, TRACKS, CATALOG_STATS,
  getTrack, getAlbum, albumTracks, playlistTracks, artistTopTracks, getArtist,
} from '../data/catalog.js';
import {
  section, albumCard, playlistCard, artistCard, trackList, contextPlayButton,
  trackCover, albumCover, playlistCover,
} from '../ui/components.js';
import { store } from '../state.js';
import { player } from '../player.js';
import { marqueeConductor } from '../ui/conductor.js';
import { REFERENCE } from '../pixel/halftone.js';
import { formatDuration, formatCount } from '../core/utils.js';

/**
 * @returns {{el: Node, onMount?: () => void, onUnmount?: () => void}}
 */
export function homeView() {
  const stageCanvas = h('canvas', { 'aria-hidden': 'true', width: 340, height: 420 });

  const featured = getAlbum('op27');
  const featuredContext = {
    type: 'album', id: featured.id, title: featured.title, trackIds: featured.trackIds,
  };

  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'STILL AWAKE'
    : hour < 12 ? 'GOOD MORNING'
    : hour < 18 ? 'GOOD AFTERNOON'
    : 'GOOD EVENING';

  /* --- Marquee ---------------------------------------------------------- */
  const marquee = h('div.marquee', {},
    h('div.marquee__copy', {},
      h('div.t-eyebrow', {}, greeting),
      pxText('THE HALL IS DARK', { scale: 5 }),
      h('p.marquee__lede', {},
        'Nine ensembles. Twenty records. ',
        h('b', {}, `${CATALOG_STATS.tracks} movements`),
        ', none of which exist as a file: every note is composed and synthesised '
        + 'the moment you press play. Beside it, a photograph of a conductor\u2019s hands, '
        + 'screened into dots that swell on every beat of the bar.',
      ),
      h('div.marquee__actions', {},
        h('div', {}, contextPlayButton(featuredContext, { large: true })),
        h('a.btn.btn--lg', { href: `#/album/${featured.id}` }, 'OPEN THE RECORD'),
        h('button.btn.btn--lg.btn--ghost', {
          type: 'button',
          onClick: () => { window.location.hash = '#/concert'; },
        }, icon('expand', { size: 12 }), 'CONCERT HALL'),
      ),
      h('div.marquee__stats', {},
        h('div', {}, h('b', {}, String(CATALOG_STATS.tracks)), 'MOVEMENTS'),
        h('div', {}, h('b', {}, String(CATALOG_STATS.albums)), 'RECORDS'),
        h('div', {}, h('b', {}, String(CATALOG_STATS.artists)), 'ENSEMBLES'),
        h('div', {}, h('b', {}, formatDuration(CATALOG_STATS.totalDuration).replace(' MIN', 'M')), 'RUNTIME'),
      ),
    ),
    h('div.marquee__stage', {}, stageCanvas),
  );

  /* --- Quick picks: recents, or a starter set --------------------------- */
  const s = store.state;
  const quickIds = s.recent.length
    ? s.recent.slice(0, 8)
    : PLAYLISTS.slice(0, 4).map((p) => p.trackIds[0]).filter(Boolean);

  const quick = h('div.quick', {},
    ...quickIds.map((id) => {
      const track = getTrack(id);
      if (!track) return null;
      const album = getAlbum(track.albumId);
      return h('button.quick__item', {
        type: 'button',
        onClick: () => player.play(track.id, {
          queue: album.trackIds,
          origin: { type: 'album', id: album.id, title: album.title },
        }),
      },
        trackCover(track, { size: 52 }),
        h('span.truncate.grow', {}, track.title),
        icon('play', { size: 11 }),
      );
    }).filter(Boolean),
  );

  /* --- Sections ---------------------------------------------------------- */
  const programmes = section({
    eyebrow: 'CURATED',
    title: 'PROGRAMMES',
    meta: `${PLAYLISTS.length} SETS`,
    body: h('div.cards', {}, ...PLAYLISTS.map(playlistCard)),
  });

  const newReleases = section({
    eyebrow: 'RECENTLY PRESSED',
    title: 'NEW RECORDS',
    meta: 'BY YEAR',
    body: h('div.cards', {},
      ...ALBUM_LIST.slice().sort((a, b) => b.year - a.year).slice(0, 12).map(albumCard)),
  });

  const houseTracks = artistTopTracks('vantor', 6);
  const house = section({
    eyebrow: 'ARTIST IN RESIDENCE',
    title: 'ELIAS VANTOR',
    meta: `${formatCount(getArtist('vantor').monthly)} LISTENERS`,
    action: { label: 'ALL WORK →', href: '#/artist/vantor' },
    body: trackList({
      tracks: houseTracks,
      queue: houseTracks.map((t) => t.id),
      origin: { type: 'artist', id: 'vantor', title: 'ELIAS VANTOR' },
      meta: false,
    }),
  });

  const ensembles = section({
    eyebrow: 'THE ROSTER',
    title: 'ENSEMBLES',
    meta: `${ARTISTS.length} ON THE BOOKS`,
    body: h('div.cards', {}, ...ARTISTS.map(artistCard)),
  });

  const everything = section({
    eyebrow: 'THE WHOLE CATALOGUE',
    title: 'ALL RECORDS',
    meta: `${ALBUM_LIST.length} RECORDS`,
    body: h('div.cards', {}, ...ALBUM_LIST.map(albumCard)),
  });

  const el = h('div', {},
    marquee,
    h('div.t-eyebrow', { style: 'margin-bottom:var(--s-4)' },
      s.recent.length ? 'PICK UP WHERE YOU LEFT OFF' : 'START HERE'),
    quick,
    programmes,
    newReleases,
    house,
    ensembles,
    everything,
  );

  return {
    el,
    onMount() {
      marqueeConductor.mount(stageCanvas, {
        src: REFERENCE.a, cell: 6, maxWidth: 460, maxHeight: 340,
        framing: { zoom: 1.2, offsetX: -0.03, offsetY: -0.05 },
      });
    },
    onUnmount() {
      marqueeConductor.unmount();
    },
  };
}
