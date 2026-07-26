/**
 * MAESTRO — Search and library views.
 * @module views/search
 */

import { h, render, pxText, clear } from '../core/dom.js';
import { icon } from '../ui/icons.js';
import { searchGrouped, highlight, SUGGESTIONS, BROWSE_FORMS, tracksByStyle, INDEX_SIZE } from '../search.js';
import {
  albumCard, artistCard, playlistCard, trackList, section, emptyState,
  albumCover, artistCover, playlistCover, contextPlayButton, trackCover,
} from '../ui/components.js';
import { store, actions } from '../state.js';
import { player } from '../player.js';
import {
  TRACKS, ALBUM_LIST, PLAYLISTS, getTrack, getAlbum, getArtist, getPlaylist,
} from '../data/catalog.js';
import { formatCount, formatDuration, debounce } from '../core/utils.js';
import { STYLES } from '../audio/composer.js';

/* ============================================================================
   Search
   ========================================================================== */

export function searchView() {
  const results = h('div.results');
  const container = h('div', {}, results);

  let filter = 'all';

  function paint() {
    const q = store.state.query.trim();
    if (!q) { renderEmpty(); return; }

    const g = searchGrouped(q);
    if (!g.total) {
      render(results, emptyState({
        title: 'NOTHING FOUND',
        body: `Nothing in the catalogue matches “${q}”. Try a form (toccata, nocturne), `
            + 'an ensemble, or a colour word — the records are named after greys.',
        icon: 'search',
      }));
      return;
    }

    const tabs = h('div.result-tabs', {},
      ...[
        ['all', `ALL · ${g.total}`],
        ['tracks', `MOVEMENTS · ${g.tracks.length}`],
        ['albums', `RECORDS · ${g.albums.length}`],
        ['artists', `ENSEMBLES · ${g.artists.length}`],
        ['playlists', `PROGRAMMES · ${g.playlists.length}`],
      ].map(([id, label]) =>
        h('button.chip', {
          type: 'button',
          'aria-pressed': String(filter === id),
          onClick: () => { filter = id; paint(); },
        }, label)),
    );

    /** @type {Node[]} */
    const blocks = [tabs];

    if (filter === 'all' && g.top) blocks.push(spotlight(g.top, q));

    if ((filter === 'all' || filter === 'tracks') && g.tracks.length) {
      const tracks = g.tracks.slice(0, filter === 'all' ? 8 : 60).map((hit) => hit.entry.entity);
      blocks.push(section({
        eyebrow: 'MOVEMENTS',
        title: 'RESULTS',
        meta: `${g.tracks.length} MATCHES`,
        body: trackList({
          tracks,
          queue: tracks.map((t) => t.id),
          origin: { type: 'search', id: `q:${q}`, title: `“${q.toUpperCase()}”` },
        }),
      }));
    }

    if ((filter === 'all' || filter === 'albums') && g.albums.length) {
      blocks.push(section({
        eyebrow: 'RECORDS', title: 'RECORDS',
        meta: `${g.albums.length} MATCHES`,
        body: h('div.cards', {}, ...g.albums.slice(0, filter === 'all' ? 6 : 40).map((hit) => albumCard(hit.entry.entity))),
      }));
    }

    if ((filter === 'all' || filter === 'artists') && g.artists.length) {
      blocks.push(section({
        eyebrow: 'ENSEMBLES', title: 'ENSEMBLES',
        meta: `${g.artists.length} MATCHES`,
        body: h('div.cards', {}, ...g.artists.map((hit) => artistCard(hit.entry.entity))),
      }));
    }

    if ((filter === 'all' || filter === 'playlists') && g.playlists.length) {
      blocks.push(section({
        eyebrow: 'PROGRAMMES', title: 'PROGRAMMES',
        meta: `${g.playlists.length} MATCHES`,
        body: h('div.cards', {}, ...g.playlists.map((hit) => playlistCard(hit.entry.entity))),
      }));
    }

    render(results, blocks);
  }

  /** The single best match, given room to breathe. */
  function spotlight(hit, q) {
    const { entry } = hit;
    const e = entry.entity;
    let art;
    let href;
    let context = null;
    let facts = '';

    switch (entry.type) {
      case 'album':
        art = albumCover(e, { scale: 5 });
        href = `#/album/${e.id}`;
        context = { type: 'album', id: e.id, title: e.title, trackIds: e.trackIds };
        facts = `${e.kind} · ${e.year} · ${e.trackCount} MOVEMENTS · ${formatDuration(e.duration)}`;
        break;
      case 'artist':
        art = artistCover(e, { scale: 5 });
        href = `#/artist/${e.id}`;
        facts = `${e.role} · ${e.city} · ${formatCount(e.monthly)} LISTENERS`;
        break;
      case 'playlist':
        art = playlistCover(e, { scale: 5 });
        href = `#/playlist/${e.id}`;
        context = { type: 'playlist', id: e.id, title: e.title, trackIds: e.trackIds };
        facts = `${e.subtitle} · ${e.trackIds.length} MOVEMENTS`;
        break;
      default: {
        const album = getAlbum(e.albumId);
        art = trackCover(e, { scale: 5 });
        href = `#/album/${album.id}`;
        context = { type: 'album', id: album.id, title: album.title, trackIds: album.trackIds };
        facts = `${STYLES[e.style]?.label} · ${e.key} ${e.mode.toUpperCase()} · ${e.bpm} BPM`;
      }
    }

    const title = h('div', { style: 'font-size:24px;line-height:1.2;color:var(--c-bone-bright)' });
    title.append(highlight(entry.primary, hit.ranges));

    return h('div.spotlight', {},
      h('a', { href }, art),
      h('div.col.gap-3', {},
        h('div.t-eyebrow', {}, `TOP RESULT · ${entry.type.toUpperCase()}`),
        title,
        h('div.t-dim', { style: 'font-size:var(--t-sm)' }, entry.secondary),
        h('div.t-mono.t-dim', {}, facts),
        h('div.row.gap-3', { style: 'margin-top:var(--s-2)' },
          context ? contextPlayButton(context) : null,
          h('a.btn', { href }, 'OPEN'),
        ),
      ),
    );
  }

  function renderEmpty() {
    const history = store.state.searchHistory;
    render(results,
      h('div.section', {},
        h('div.section__head', {},
          h('div.section__title', {},
            h('div.t-eyebrow', {}, `${INDEX_SIZE} ENTRIES INDEXED`),
            pxText('SEARCH THE CATALOGUE', { scale: 3 }),
          ),
        ),
        history.length
          ? h('div', { style: 'margin-bottom:var(--s-6)' },
              h('div.row-between', { style: 'margin-bottom:var(--s-3)' },
                h('div.t-eyebrow', {}, 'RECENT'),
                h('button.btn.btn--ghost.btn--sm', {
                  type: 'button', onClick: () => { actions.clearSearchHistory(); paint(); },
                }, 'CLEAR'),
              ),
              h('div.row.gap-2', { style: 'flex-wrap:wrap' },
                ...history.map((q) => h('button.chip', {
                  type: 'button', onClick: () => actions.setQuery(q),
                }, q.toUpperCase())),
              ),
            )
          : null,
        h('div.t-eyebrow', { style: 'margin-bottom:var(--s-3)' }, 'TRY'),
        h('div.row.gap-2', { style: 'flex-wrap:wrap;margin-bottom:var(--s-8)' },
          ...SUGGESTIONS.map((q) => h('button.chip', {
            type: 'button', onClick: () => actions.setQuery(q),
          }, q)),
        ),
      ),
      section({
        eyebrow: 'BROWSE',
        title: 'BY FORM',
        meta: `${BROWSE_FORMS.length} FORMS`,
        body: h('div.cards.cards--wide', {}, ...BROWSE_FORMS.map(formCard)),
      }),
    );
  }

  function formCard(form) {
    const tracks = tracksByStyle(form.id);
    return h('button.card', {
      type: 'button',
      style: 'align-items:stretch',
      onClick: () => player.playContext({
        type: 'form', id: `form:${form.id}`, title: form.label,
        trackIds: tracks.map((t) => t.id),
      }),
    },
      h('div.card__art', { style: 'display:grid;place-items:center;background:var(--c-surface-2)' },
        h('div.col.gap-2', { style: 'align-items:center' },
          pxText(form.label, { scale: 2 }),
          h('div.t-mono.t-dim', {}, form.meter),
        ),
      ),
      h('div', {},
        h('div.card__title', {}, `${tracks.length} MOVEMENTS`),
        h('div.card__sub', {}, form.tempo),
      ),
    );
  }

  paint();
  const unsub = store.subscribe((s) => s.query, paint, { immediate: false });

  return { el: container, onUnmount: unsub };
}

/* ============================================================================
   Library
   ========================================================================== */

/** @param {string} [tab] */
export function libraryView(tab = 'all') {
  const body = h('div');
  let active = tab;

  function paint() {
    const s = store.state;
    const liked = s.liked.map(getTrack).filter(Boolean);
    const likedAlbums = s.likedAlbums.map(getAlbum).filter(Boolean);
    const recent = s.recent.map(getTrack).filter(Boolean);
    const mostPlayed = Object.entries(s.playCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => getTrack(id))
      .filter(Boolean)
      .slice(0, 10);

    const tabs = h('div.result-tabs', {},
      ...[
        ['all', 'OVERVIEW'],
        ['liked', `SAVED · ${liked.length}`],
        ['albums', `RECORDS · ${likedAlbums.length}`],
        ['recent', `HISTORY · ${recent.length}`],
      ].map(([id, label]) => h('button.chip', {
        type: 'button',
        'aria-pressed': String(active === id),
        onClick: () => { active = id; paint(); },
      }, label)),
    );

    /** @type {Node[]} */
    const blocks = [
      h('div.section__head', {},
        h('div.section__title', {},
          h('div.t-eyebrow', {}, 'YOUR SHELF'),
          pxText('LIBRARY', { scale: 4 }),
        ),
        h('div.section__meta', {},
          `${liked.length + likedAlbums.length} SAVED · ${recent.length} PLAYED`),
      ),
      tabs,
    ];

    if (active === 'all' || active === 'liked') {
      blocks.push(liked.length
        ? section({
            eyebrow: 'SAVED', title: 'MOVEMENTS',
            meta: formatDuration(liked.reduce((a, t) => a + t.duration, 0)),
            body: trackList({
              tracks: active === 'all' ? liked.slice(0, 8) : liked,
              queue: liked.map((t) => t.id),
              origin: { type: 'library', id: 'liked', title: 'SAVED MOVEMENTS' },
            }),
          })
        : emptyState({
            title: 'NOTHING SAVED',
            body: 'The heart beside any movement files it here. Nothing is uploaded '
                + 'anywhere — your shelf lives in this browser only.',
            icon: 'heart',
            action: h('a.btn', { href: '#/hall' }, 'BROWSE THE HALL'),
          }));
    }

    if ((active === 'all' || active === 'albums') && likedAlbums.length) {
      blocks.push(section({
        eyebrow: 'SAVED', title: 'RECORDS',
        meta: `${likedAlbums.length}`,
        body: h('div.cards', {}, ...likedAlbums.map(albumCard)),
      }));
    }

    if ((active === 'all' || active === 'recent') && recent.length) {
      blocks.push(section({
        eyebrow: 'HISTORY', title: 'RECENTLY PLAYED',
        meta: `${recent.length} MOVEMENTS`,
        body: trackList({
          tracks: active === 'all' ? recent.slice(0, 8) : recent,
          queue: recent.map((t) => t.id),
          origin: { type: 'library', id: 'recent', title: 'RECENTLY PLAYED' },
        }),
      }));
    }

    if (active === 'all' && mostPlayed.length > 2) {
      blocks.push(section({
        eyebrow: 'ON REPEAT', title: 'MOST PLAYED',
        body: trackList({
          tracks: mostPlayed,
          queue: mostPlayed.map((t) => t.id),
          origin: { type: 'library', id: 'most', title: 'MOST PLAYED' },
        }),
      }));
    }

    if (active === 'all') {
      blocks.push(section({
        eyebrow: 'ALWAYS AVAILABLE', title: 'PROGRAMMES',
        body: h('div.cards', {}, ...PLAYLISTS.map(playlistCard)),
      }));
    }

    render(body, blocks);
  }

  paint();
  const unsub = store.subscribe(
    (s) => `${s.liked.length}|${s.likedAlbums.length}|${s.recent.length}`,
    paint,
    { immediate: false },
  );

  return { el: body, onUnmount: unsub };
}
