/**
 * MAESTRO — Record, programme, artist and queue views.
 * @module views/album
 */

import { h, pxText, render } from '../core/dom.js';
import { icon } from '../ui/icons.js';
import {
  getAlbum, getArtist, getPlaylist, albumTracks, playlistTracks,
  artistAlbums, artistTopTracks, artistTracks, ALBUM_LIST, TRACKS,
} from '../data/catalog.js';
import {
  albumCover, artistCover, playlistCover, trackList, contextPlayButton,
  section, albumCard, emptyState, likeButton,
} from '../ui/components.js';
import { store, actions } from '../state.js';
import { player } from '../player.js';
import { formatDuration, formatCount, formatTime } from '../core/utils.js';
import { STYLES } from '../audio/composer.js';

/* ============================================================================
   Record
   ========================================================================== */

/** @param {string} id */
export function albumView(id) {
  const album = getAlbum(id);
  if (!album) return notFoundView(`No record filed under “${id}”.`);

  const artist = getArtist(album.artist);
  const tracks = albumTracks(id);
  const context = { type: 'album', id: album.id, title: album.title, trackIds: album.trackIds };

  const forms = Array.from(new Set(tracks.map((t) => STYLES[t.style]?.label ?? t.style)));

  const saveBtn = h('button.btn', {
    type: 'button',
    onClick: () => actions.toggleAlbumLike(album.id),
  });
  const paintSave = (saved) => {
    render(saveBtn, icon(saved ? 'heartFull' : 'heart', { size: 12 }), saved ? 'IN LIBRARY' : 'ADD TO LIBRARY');
    saveBtn.setAttribute('aria-pressed', String(saved));
  };
  store.subscribe((s) => s.likedAlbums.includes(album.id), paintSave);

  const el = h('div', {},
    h('div.hero', { style: { '--hero-glow': heroGlow(album.palette) } },
      albumCover(album, { class: 'hero__art', scale: 6 }),
      h('div.hero__text', {},
        h('div.hero__kind', {},
          h('span.tag', { class: album.kind === 'LIVE' ? 'tag--live' : '' }, album.kind),
          h('span.tag', {}, String(album.year)),
        ),
        pxText(album.title, { scale: album.title.length > 24 ? 4 : 5 }),
        h('p.hero__blurb', {}, album.blurb),
        h('div.hero__facts', {},
          h('a', { href: `#/artist/${artist.id}`, style: 'color:var(--c-bone)' }, artist.name),
          h('span', {}, '·'),
          h('span', {}, `${album.trackCount} MOVEMENTS`),
          h('span', {}, '·'),
          h('span', {}, formatDuration(album.duration)),
          h('span', {}, '·'),
          h('span', {}, forms.join(' / ')),
        ),
        h('div.hero__actions', {},
          contextPlayButton(context, { large: true }),
          saveBtn,
          h('button.btn.btn--ghost', {
            type: 'button',
            onClick: () => {
              for (const t of tracks) player.enqueue(t.id);
            },
          }, icon('queue', { size: 12 }), 'QUEUE ALL'),
        ),
      ),
    ),

    trackList({
      tracks,
      queue: album.trackIds,
      origin: { type: 'album', id: album.id, title: album.title },
      album: false,
      showArt: false,
    }),

    h('div.rule'),

    h('div.credits', {},
      h('div.credit', {}, h('dt', {}, 'ENSEMBLE'), h('dd', {}, artist.name)),
      h('div.credit', {}, h('dt', {}, 'ROLE'), h('dd', {}, artist.role)),
      h('div.credit', {}, h('dt', {}, 'RECORDED'), h('dd', {}, `${artist.city}, ${album.year}`)),
      h('div.credit', {}, h('dt', {}, 'FORMAT'), h('dd', {}, `${album.kind} · SYNTHESISED LIVE`)),
      h('div.credit', {}, h('dt', {}, 'SLEEVE'), h('dd', {}, `PROCEDURAL · ${album.motif.toUpperCase()} · ${album.palette.toUpperCase()}`)),
      h('div.credit', {}, h('dt', {}, 'RUNTIME'), h('dd', {}, formatDuration(album.duration))),
    ),

    moreFrom(artist, album.id),
  );

  return { el };
}

function moreFrom(artist, excludeId) {
  const others = artistAlbums(artist.id).filter((a) => a.id !== excludeId);
  if (!others.length) return null;
  return h('div', { style: 'margin-top:var(--s-10)' },
    section({
      eyebrow: 'ALSO BY',
      title: artist.name,
      action: { label: 'ARTIST →', href: `#/artist/${artist.id}` },
      body: h('div.cards', {}, ...others.map(albumCard)),
    }),
  );
}

function heroGlow(palette) {
  return {
    gold: 'rgba(217,185,120,.18)',
    velvet: 'rgba(200,95,106,.15)',
    marble: 'rgba(151,166,184,.14)',
    sepia: 'rgba(196,155,108,.15)',
    brass: 'rgba(120,167,138,.13)',
    bone: 'rgba(236,231,220,.10)',
  }[palette] ?? 'rgba(236,231,220,.10)';
}

/* ============================================================================
   Programme (playlist)
   ========================================================================== */

/** @param {string} id */
export function playlistView(id) {
  const pl = getPlaylist(id);
  if (!pl) return notFoundView(`No programme filed under “${id}”.`);

  const tracks = playlistTracks(id);
  const duration = tracks.reduce((s, t) => s + t.duration, 0);
  const context = { type: 'playlist', id: pl.id, title: pl.title, trackIds: pl.trackIds };

  const el = h('div', {},
    h('div.hero', { style: { '--hero-glow': heroGlow(pl.palette) } },
      playlistCover(pl, { class: 'hero__art', scale: 6 }),
      h('div.hero__text', {},
        h('div.hero__kind', {}, h('span.tag.tag--gold', {}, 'PROGRAMME')),
        pxText(pl.title, { scale: pl.title.length > 24 ? 4 : 5 }),
        h('p.hero__blurb', {}, pl.blurb),
        h('div.hero__facts', {},
          h('span', {}, `CURATED BY ${pl.curator}`),
          h('span', {}, '·'),
          h('span', {}, `${tracks.length} MOVEMENTS`),
          h('span', {}, '·'),
          h('span', {}, formatDuration(duration)),
        ),
        h('div.hero__actions', {},
          contextPlayButton(context, { large: true }),
          h('button.btn', {
            type: 'button',
            onClick: () => { actions.toggleShuffle(); player.playContext(context); },
          }, icon('shuffle', { size: 12 }), 'SHUFFLE'),
        ),
      ),
    ),
    trackList({
      tracks,
      queue: pl.trackIds,
      origin: { type: 'playlist', id: pl.id, title: pl.title },
    }),
  );

  return { el };
}

/* ============================================================================
   Ensemble (artist)
   ========================================================================== */

/** @param {string} id */
export function artistView(id) {
  const artist = getArtist(id);
  if (!artist) return notFoundView(`No ensemble filed under “${id}”.`);

  const albums = artistAlbums(id);
  const top = artistTopTracks(id, 6);
  const all = artistTracks(id);
  const context = { type: 'artist', id: artist.id, title: artist.name, trackIds: all.map((t) => t.id) };

  const el = h('div', {},
    h('div.artist-hero', {},
      artistCover(artist, { class: 'artist-hero__bg', scale: 12 }),
      h('div.artist-hero__text', {},
        h('div.t-eyebrow', {}, artist.role),
        pxText(artist.name, { scale: artist.name.length > 18 ? 4 : 5 }),
        h('div.hero__facts', {},
          h('span', {}, artist.city),
          h('span', {}, '·'),
          h('span', {}, `${formatCount(artist.monthly)} MONTHLY LISTENERS`),
          h('span', {}, '·'),
          h('span', {}, `${albums.length} RECORDS`),
        ),
        h('div.hero__actions', {},
          contextPlayButton(context, { large: true }),
          h('a.btn', { href: `#/search` }, 'FIND SIMILAR'),
        ),
      ),
    ),

    h('p.bio', {}, artist.bio),
    h('div.rule.rule--dotted'),

    section({
      eyebrow: 'MOST PLAYED',
      title: 'SELECTED WORK',
      body: trackList({
        tracks: top,
        queue: all.map((t) => t.id),
        origin: { type: 'artist', id: artist.id, title: artist.name },
      }),
    }),

    section({
      eyebrow: 'DISCOGRAPHY',
      title: 'RECORDS',
      meta: `${albums.length} RELEASES`,
      body: h('div.cards', {}, ...albums.map(albumCard)),
    }),
  );

  return { el };
}

/* ============================================================================
   Queue
   ========================================================================== */

export function queueView() {
  const container = h('div');

  function paint() {
    const s = store.state;
    const current = s.queue[s.queueIndex];
    const upcoming = s.queue.slice(s.queueIndex + 1).map((id) => TRACKS.find((t) => t.id === id)).filter(Boolean);
    const nowTrack = TRACKS.find((t) => t.id === current);

    render(container,
      h('div.section__head', {},
        h('div.section__title', {},
          h('div.t-eyebrow', {}, s.origin ? `FROM ${s.origin.title}` : 'THE QUEUE'),
          pxText('QUEUE', { scale: 4 }),
        ),
        h('div.row.gap-3', {},
          h('div.section__meta', {}, `${upcoming.length} REMAINING`),
        ),
      ),
      nowTrack
        ? h('div', { style: 'margin-bottom:var(--s-8)' },
            h('div.t-eyebrow', { style: 'margin-bottom:var(--s-3)' }, 'SOUNDING NOW'),
            trackList({
              tracks: [nowTrack],
              queue: s.queue,
              origin: s.origin ?? { type: 'queue', id: 'queue', title: 'QUEUE' },
              startIndex: s.queueIndex + 1,
            }),
          )
        : null,
      upcoming.length
        ? h('div', {},
            h('div.t-eyebrow', { style: 'margin-bottom:var(--s-3)' }, 'NEXT'),
            trackList({
              tracks: upcoming,
              queue: s.queue,
              origin: s.origin ?? { type: 'queue', id: 'queue', title: 'QUEUE' },
              startIndex: s.queueIndex + 2,
            }),
          )
        : emptyState({
            title: 'NOTHING QUEUED',
            body: 'Play a record or a programme and the rest of it lines up here. '
                + 'The queue icon on any movement adds it to the end.',
            icon: 'queue',
          }),
    );
  }

  paint();
  const unsub = store.subscribe((s) => `${s.queue.join(',')}|${s.queueIndex}`, paint, { immediate: false });

  return { el: container, onUnmount: unsub };
}

/* ============================================================================
   Not found
   ========================================================================== */

/** @param {string} [message] */
export function notFoundView(message) {
  return {
    el: h('div', {},
      emptyState({
        title: 'NOT IN THE PROGRAMME',
        body: message ?? 'That page is not part of tonight’s performance.',
        icon: 'close',
        action: h('a.btn', { href: '#/' }, 'BACK TO THE HALL'),
      }),
    ),
  };
}
