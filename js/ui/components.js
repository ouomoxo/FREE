/**
 * MAESTRO — Shared view components.
 *
 * Plain functions returning DOM. Rows and cards subscribe to the narrow slices
 * of state they care about (is this the current track? is it liked?) and clean
 * themselves up when detached, so a long list costs a handful of subscriptions
 * rather than a re-render of the page.
 *
 * @module ui/components
 */

import { h, pxText, setAttr, on } from '../core/dom.js';
import { icon } from './icons.js';
import { coverDataURL } from '../pixel/art.js';
import { photoImage, REFERENCE } from '../pixel/photo.js';
import { formatTime, formatCount } from '../core/utils.js';
import { store, actions } from '../state.js';
import { player } from '../player.js';
import { getAlbum, getArtist, decorate } from '../data/catalog.js';
import { STYLES } from '../audio/composer.js';

/**
 * Attach a store subscription that disposes itself once `el` leaves the DOM.
 * A single shared observer handles every component on the page.
 *
 * @param {Element} el
 * @param {() => void} dispose
 */
const disposers = new WeakMap();
let detachObserver;

function autoDispose(el, dispose) {
  disposers.set(el, [...(disposers.get(el) ?? []), dispose]);
  if (!detachObserver) {
    detachObserver = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.removedNodes) {
          if (!(node instanceof Element)) continue;
          runDispose(node);
          node.querySelectorAll?.('*').forEach(runDispose);
        }
      }
    });
    detachObserver.observe(document.body, { childList: true, subtree: true });
  }
}

function runDispose(node) {
  const list = disposers.get(node);
  if (!list) return;
  for (const fn of list) { try { fn(); } catch { /* ignore */ } }
  disposers.delete(node);
}

/* ============================================================================
   Cover art
   ========================================================================== */

/**
 * @param {{seed:string, motif?:string, palette?:string, scale?:number, alt?:string, class?:string, size?:number}} o
 */
export function cover(o) {
  return h('img', {
    class: o.class ?? '',
    src: coverDataURL({ seed: o.seed, motif: o.motif, palette: o.palette, scale: o.scale ?? 4 }),
    alt: o.alt ?? '',
    width: o.size,
    height: o.size,
    decoding: 'async',
    loading: 'lazy',
  });
}

/**
 * Some entities' artwork is a reference photograph screened into dots rather
 * than a generated motif. `screened` renders that, at a dot pitch scaled to the
 * size actually being displayed.
 *
 * @param {{photo:string, photoCell?:number, photoZoom?:number, photoOffsetY?:number}} entity
 * @param {{scale?:number, class?:string, alt?:string}} o
 */
function screened(entity, o) {
  const size = (o.scale ?? 4) * 64;
  return photoImage({
    src: REFERENCE[entity.photo] ?? REFERENCE.b,
    size,
    // Keep the dot pitch proportional so a thumbnail is not a solid blob and a
    // full-size sleeve is not a fine grey mist.
    cell: Math.max(2, Math.round((entity.photoCell ?? 5) * (size / 256))),
    zoom: entity.photoZoom,
    offsetX: entity.photoOffsetX,
    offsetY: entity.photoOffsetY,
    alt: o.alt ?? '',
    class: o.class,
  });
}

/** @param {import('../data/catalog.js').Album} album */
export const albumCover = (album, o = {}) => (album.photo
  ? screened(album, { ...o, alt: `${album.title} — sleeve` })
  : cover({ seed: `album:${album.id}`, motif: album.motif, palette: album.palette, alt: `${album.title} — sleeve`, ...o }));

/** @param {import('../data/catalog.js').Artist} artist */
export const artistCover = (artist, o = {}) => (artist.photo
  ? screened(artist, { ...o, alt: `${artist.name} — portrait` })
  : cover({ seed: `artist:${artist.id}`, motif: artist.motif, palette: artist.palette, alt: `${artist.name} — portrait`, ...o }));

/** @param {import('../data/catalog.js').Playlist} pl */
export const playlistCover = (pl, o = {}) =>
  cover({ seed: `playlist:${pl.id}`, motif: pl.motif, palette: pl.palette, alt: `${pl.title} — artwork`, ...o });

/** @param {import('../data/catalog.js').Track} track */
export function trackCover(track, o = {}) {
  const album = getAlbum(track.albumId);
  return albumCover(album, { alt: '', ...o });
}

/* ============================================================================
   Buttons
   ========================================================================== */

/**
 * @param {{name:string, label:string, onClick:(e:Event)=>void, size?:number, class?:string, pressed?:boolean}} o
 */
export function iconButton(o) {
  const btn = h('button.ibtn', {
    type: 'button',
    class: o.class,
    'aria-label': o.label,
    title: o.label,
    onClick: o.onClick,
  }, icon(o.name, { size: o.size ?? 12 }));
  if (o.pressed !== undefined) btn.setAttribute('aria-pressed', String(o.pressed));
  return btn;
}

/** A like toggle bound to the store. @param {string} trackId */
export function likeButton(trackId, size = 12) {
  const btn = h('button.ibtn', {
    type: 'button',
    onClick: (e) => { e.stopPropagation(); actions.toggleLike(trackId); },
  });
  const paint = (liked) => {
    btn.replaceChildren(icon(liked ? 'heartFull' : 'heart', { size }));
    btn.setAttribute('aria-pressed', String(liked));
    btn.setAttribute('aria-label', liked ? 'Remove from library' : 'Save to library');
    btn.title = liked ? 'Remove from library' : 'Save to library';
  };
  const unsub = store.subscribe((s) => s.liked.includes(trackId), paint);
  autoDispose(btn, unsub);
  return btn;
}

/**
 * The big play/pause control for a context (album, playlist, artist).
 * Shows "pause" when that exact context is the one currently sounding.
 *
 * @param {{type:string,id:string,title:string,trackIds:string[]}} context
 * @param {{large?:boolean, gold?:boolean}} [o]
 */
export function contextPlayButton(context, o = {}) {
  const btn = h('button.playbtn', {
    type: 'button',
    class: o.large ? 'playbtn--lg' : '',
  });
  if (o.gold) btn.style.background = 'var(--c-gold)';

  const paint = ([originId, playing]) => {
    const active = originId === context.id && playing;
    btn.replaceChildren(icon(active ? 'pause' : 'play', { size: o.large ? 18 : 13 }));
    btn.setAttribute('aria-label', active ? `Pause ${context.title}` : `Play ${context.title}`);
    btn.title = active ? 'Pause' : `Play ${context.title}`;
  };
  const unsub = store.subscribe(
    (s) => [s.origin?.id ?? null, s.playing],
    paint,
    { equals: (a, b) => a[0] === b[0] && a[1] === b[1] },
  );
  autoDispose(btn, unsub);

  btn.addEventListener('click', () => {
    const s = store.state;
    if (s.origin?.id === context.id && s.playing) player.pause();
    else if (s.origin?.id === context.id && s.trackId) player.toggle();
    else player.playContext(context);
  });
  return btn;
}

/* ============================================================================
   Track rows
   ========================================================================== */

/**
 * @param {object} o
 * @param {import('../data/catalog.js').Track} o.track
 * @param {number} o.index         Display number (1-based).
 * @param {string[]} o.queue       Queue this row belongs to.
 * @param {{type:string,id:string,title:string}} o.origin
 * @param {boolean} [o.showArt=false]
 * @param {boolean} [o.showAlbum=true]
 * @param {boolean} [o.showMeta=true]
 */
export function trackRow(o) {
  const { track } = o;
  const album = getAlbum(track.albumId);
  const artist = getArtist(track.artistId);
  const style = STYLES[track.style];

  const eq = h('span.eq', { 'aria-hidden': 'true' }, h('span'), h('span'), h('span'));
  const num = h('span.track__num', {}, String(o.index).padStart(2, '0'));
  const indexCell = h('div.track__index', {},
    num,
    h('span.track__go', {}, icon('play', { size: 10 })),
  );

  const row = h('div.track', {
    role: 'button',
    tabindex: '0',
    'aria-label': `Play ${track.title} by ${artist?.name ?? ''}`,
    onDblclick: () => start(),
    onKeydown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); start(); }
    },
  },
    indexCell,
    h('div.track__main', {},
      o.showArt !== false ? trackCover(track, { class: 'track__art', size: 36 }) : null,
      h('div.track__text', {},
        h('div.track__title.truncate', {}, track.title),
        h('div.track__sub.truncate', {},
          h('a', {
            href: `#/artist/${track.artistId}`,
            onClick: (e) => e.stopPropagation(),
          }, artist?.name ?? ''),
        ),
      ),
    ),
    o.showAlbum !== false
      ? h('a.track__meta.truncate.tracks__col-optional', {
          href: `#/album/${album.id}`,
          onClick: (e) => e.stopPropagation(),
          title: album.title,
        }, album.title)
      : null,
    o.showMeta !== false
      ? h('div.track__meta.truncate.tracks__col-optional', {}, `${style?.label ?? ''} · ${track.key} ${track.mode.toUpperCase().slice(0, 3)} · ${track.bpm}BPM`)
      : null,
    h('div.track__time', {}, formatTime(track.duration)),
    h('div.track__actions', {},
      likeButton(track.id),
      iconButton({
        name: 'queue', label: 'Add to queue', size: 11,
        onClick: (e) => { e.stopPropagation(); player.enqueue(track.id); },
      }),
    ),
  );

  row.addEventListener('click', (e) => {
    if (/** @type {Element} */ (e.target).closest('a, button')) return;
    start();
  });

  function start() {
    player.play(track.id, { queue: o.queue, origin: o.origin });
  }

  const paint = ([currentId, playing]) => {
    const isCurrent = currentId === track.id;
    setAttr(row, 'data-current', String(isCurrent));
    if (isCurrent) {
      indexCell.replaceChildren(eq);
      eq.dataset.paused = String(!playing);
    } else if (!indexCell.contains(num)) {
      indexCell.replaceChildren(num, h('span.track__go', {}, icon('play', { size: 10 })));
    }
  };
  const unsub = store.subscribe(
    (s) => [s.trackId, s.playing],
    paint,
    { equals: (a, b) => a[0] === b[0] && a[1] === b[1] },
  );
  autoDispose(row, unsub);

  return row;
}

/**
 * Column headings above a track list.
 * @param {{album?:boolean, meta?:boolean}} [o]
 */
export function trackHead(o = {}) {
  return h('div.tracks__head', {},
    h('div.t-eyebrow', { style: 'text-align:right' }, '#'),
    h('div.t-eyebrow', {}, 'MOVEMENT'),
    o.album !== false ? h('div.t-eyebrow.tracks__col-optional', {}, 'RECORD') : null,
    o.meta !== false ? h('div.t-eyebrow.tracks__col-optional', {}, 'FORM · KEY · TEMPO') : null,
    h('div.t-eyebrow', { style: 'text-align:right' }, icon('clock', { size: 11 })),
    h('div'),
  );
}

/**
 * A complete track list with its heading row.
 * @param {{tracks:any[], queue:string[], origin:any, album?:boolean, meta?:boolean, startIndex?:number, showArt?:boolean}} o
 */
export function trackList(o) {
  // Hidden columns are omitted from the template entirely — collapsing them to
  // zero width would leave their grid gaps behind as a canyon mid-row.
  const cols = [
    '32px',
    o.album === false ? 'minmax(0, 3fr)' : 'minmax(0, 2.2fr)',
    o.album !== false ? 'minmax(0, 1.5fr)' : null,
    o.meta !== false ? 'minmax(0, 1.4fr)' : null,
    '64px',
    '72px',
  ].filter(Boolean).join(' ');

  return h('div.tracks', { style: { '--track-cols': cols } },
    trackHead({ album: o.album, meta: o.meta }),
    ...o.tracks.map((track, i) => trackRow({
      track,
      index: (o.startIndex ?? 1) + i,
      queue: o.queue,
      origin: o.origin,
      showAlbum: o.album,
      showMeta: o.meta,
      showArt: o.showArt,
    })),
  );
}

/* ============================================================================
   Cards
   ========================================================================== */

/**
 * @param {object} o
 * @param {string} o.href
 * @param {Node} o.art
 * @param {string} o.title
 * @param {string} o.sub
 * @param {{type:string,id:string,title:string,trackIds:string[]}} [o.context]
 */
export function card(o) {
  return h('a.card', { href: o.href },
    h('div.card__art', {},
      o.art,
      o.context ? h('div.card__play', {}, contextPlayButton(o.context)) : null,
    ),
    h('div', {},
      h('div.card__title.clamp-2', {}, o.title),
      h('div.card__sub.truncate', {}, o.sub),
    ),
  );
}

/** @param {import('../data/catalog.js').Album} album */
export function albumCard(album) {
  return card({
    href: `#/album/${album.id}`,
    art: albumCover(album, { scale: 4 }),
    title: album.title,
    sub: `${album.year} · ${album.artistName}`,
    context: { type: 'album', id: album.id, title: album.title, trackIds: album.trackIds },
  });
}

/** @param {import('../data/catalog.js').Playlist} pl */
export function playlistCard(pl) {
  return card({
    href: `#/playlist/${pl.id}`,
    art: playlistCover(pl, { scale: 4 }),
    title: pl.title,
    sub: pl.subtitle,
    context: { type: 'playlist', id: pl.id, title: pl.title, trackIds: pl.trackIds },
  });
}

/** @param {import('../data/catalog.js').Artist} artist */
export function artistCard(artist) {
  return card({
    href: `#/artist/${artist.id}`,
    art: artistCover(artist, { scale: 4 }),
    title: artist.name,
    sub: `${artist.role} · ${formatCount(artist.monthly)} LISTENERS`,
  });
}

/* ============================================================================
   Section scaffolding
   ========================================================================== */

/**
 * @param {object} o
 * @param {string} o.title
 * @param {string} [o.eyebrow]
 * @param {string} [o.meta]
 * @param {{label:string, href:string}} [o.action]
 * @param {Node|Node[]} o.body
 */
export function section(o) {
  return h('section.section', {},
    h('div.section__head', {},
      h('div.section__title', {},
        o.eyebrow ? h('div.t-eyebrow', {}, o.eyebrow) : null,
        pxText(o.title, { scale: 3 }),
      ),
      h('div.row.gap-4', {},
        o.meta ? h('div.section__meta', {}, o.meta) : null,
        o.action ? h('a.btn.btn--ghost.btn--sm', { href: o.action.href }, o.action.label) : null,
      ),
    ),
    ...(Array.isArray(o.body) ? o.body : [o.body]),
  );
}

/**
 * @param {{title:string, body:string, icon?:string, action?:Node}} o
 */
export function emptyState(o) {
  return h('div.empty', {},
    icon(o.icon ?? 'dot', { size: 32 }),
    pxText(o.title, { scale: 3, class: 'empty__title' }),
    h('p.empty__body', {}, o.body),
    o.action ?? null,
  );
}

export { autoDispose };
