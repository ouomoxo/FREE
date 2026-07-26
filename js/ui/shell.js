/**
 * MAESTRO — Application shell: sidebar, topbar, mobile tab bar.
 * @module ui/shell
 */

import { h, render, pxText, setAttr, $, on } from '../core/dom.js';
import { icon } from './icons.js';
import { store, actions } from '../state.js';
import { player } from '../player.js';
import { router } from '../router-instance.js';
import { PLAYLISTS, ALBUM_LIST, getTrack, getAlbum, CATALOG_STATS } from '../data/catalog.js';
import { playlistCover, albumCover, cover } from './components.js';
import { formatCount, debounce } from '../core/utils.js';

/* ============================================================================
   Brand mark
   ========================================================================== */

/** The wordmark's baton, drawn with the same hairline as every other icon. */
function brandMark() {
  const mark = icon('baton', { size: 22, class: 'brand__mark' });
  mark.style.color = 'var(--c-gold)';
  return mark;
}

/* ============================================================================
   Sidebar
   ========================================================================== */

const NAV = [
  { id: 'home', label: 'HALL', icon: 'home', href: '#/hall' },
  { id: 'search', label: 'SEARCH', icon: 'search', href: '#/search' },
  { id: 'library', label: 'LIBRARY', icon: 'library', href: '#/library' },
  { id: 'concert', label: 'CONCERT', icon: 'concert', href: '#/concert' },
];

/** @param {HTMLElement} root */
export function mountSidebar(root) {
  const navItems = NAV.map((item) =>
    h('a.nav__item', { href: item.href, 'data-nav': item.id },
      h('span.nav__icon', {}, icon(item.icon, { size: 14 })),
      h('span.nav__label', {}, item.label),
    ),
  );

  const libraryList = h('div.library__list.scroll');
  const filters = h('div.library__filters');

  const block = h('div.sidebar__block.sidebar__block--library', {},
    h('div.library', {},
      h('div.library__head', {},
        pxText('LIBRARY', { scale: 2 }),
        h('button.ibtn.ibtn--sm', {
          type: 'button',
          'aria-label': 'Open search',
          title: 'Search the catalogue',
          onClick: () => router.go('/search'),
        }, icon('plus', { size: 11 })),
      ),
      filters,
      libraryList,
    ),
  );

  render(root,
    h('div.sidebar__block.sidebar__block--nav', {},
      h('a.brand', { href: '#/', 'aria-label': 'MAESTRO — back to the prelude', title: 'Back to the prelude' },
        brandMark(),
        h('span.brand__wordmark', {}, pxText('MAESTRO', { scale: 3.2, weight: 0.68 })),
      ),
      h('nav.nav', { 'aria-label': 'Primary' }, ...navItems),
    ),
    block,
  );

  /* --- Library filters -------------------------------------------------- */
  let filter = 'all';
  const FILTERS = [
    ['all', 'ALL'],
    ['programmes', 'PROGRAMMES'],
    ['records', 'RECORDS'],
    ['saved', 'SAVED'],
  ];

  function paintFilters() {
    render(filters, FILTERS.map(([id, label]) =>
      h('button.chip', {
        type: 'button',
        'aria-pressed': String(filter === id),
        onClick: () => { filter = id; paintFilters(); paintLibrary(); },
      }, label),
    ));
  }

  function paintLibrary() {
    const s = store.state;
    /** @type {Node[]} */
    const rows = [];

    const pushRow = (href, art, title, sub) => {
      rows.push(h('a.lib-row', { href }, art, h('div.lib-row__text', {},
        h('div.truncate', { style: 'font-size:var(--t-sm);color:var(--c-bone)' }, title),
        h('div.truncate.t-dim', { style: 'font-size:var(--t-xs)' }, sub),
      )));
    };

    if (filter === 'all' || filter === 'saved') {
      pushRow('#/library/liked',
        cover({ seed: 'liked-songs', motif: 'rose', palette: 'gold', scale: 3, alt: '' }),
        'SAVED MOVEMENTS',
        `${s.liked.length} ${s.liked.length === 1 ? 'MOVEMENT' : 'MOVEMENTS'}`);
    }
    if (filter === 'all' || filter === 'programmes') {
      for (const pl of PLAYLISTS) {
        pushRow(`#/playlist/${pl.id}`, playlistCover(pl, { scale: 3 }), pl.title, `PROGRAMME · ${pl.curator}`);
      }
    }
    if (filter === 'all' || filter === 'records') {
      for (const album of ALBUM_LIST) {
        pushRow(`#/album/${album.id}`, albumCover(album, { scale: 3 }), album.title, `${album.kind} · ${album.artistName}`);
      }
    }
    if (filter === 'saved') {
      for (const id of s.likedAlbums) {
        const album = getAlbum(id);
        if (album) pushRow(`#/album/${album.id}`, albumCover(album, { scale: 3 }), album.title, `${album.kind} · ${album.artistName}`);
      }
      if (!s.likedAlbums.length && !s.liked.length) {
        rows.push(h('p.t-dim', { style: 'padding:var(--s-4);font-size:var(--t-xs);line-height:1.6' },
          'Nothing saved yet. The heart on any movement or record files it here.'));
      }
    }
    render(libraryList, rows);
  }

  paintFilters();
  paintLibrary();
  store.subscribe((s) => [s.liked.length, s.likedAlbums.length].join(':'), paintLibrary, { immediate: false });

  /* --- Active route highlighting ---------------------------------------- */
  store.subscribe((s) => s.routeName, (name) => {
    for (const el of root.querySelectorAll('[data-nav]')) {
      setAttr(el, 'aria-current', el.dataset.nav === name ? 'page' : null);
    }
  });
}

/* ============================================================================
   Topbar
   ========================================================================== */

/** @param {HTMLElement} root */
export function mountTopbar(root) {
  const searchInput = h('input', {
    type: 'search',
    placeholder: 'SEARCH MOVEMENTS, RECORDS, ENSEMBLES',
    'aria-label': 'Search the catalogue',
    autocomplete: 'off',
    spellcheck: 'false',
  });

  const searchBox = h('label.searchbox', { style: 'flex:1 1 auto;max-width:420px' },
    icon('search', { size: 12 }),
    searchInput,
  );

  const back = h('button.ibtn', {
    type: 'button', 'aria-label': 'Back', title: 'Back',
    onClick: () => router.back(),
  }, icon('chevronLeft', { size: 12 }));

  const sidebarToggle = h('button.ibtn', {
    type: 'button', 'aria-label': 'Toggle navigation', title: 'Toggle navigation',
    onClick: () => actions.toggleSidebar(),
  }, icon('sliders', { size: 12 }));

  const asideToggle = h('button.ibtn', {
    type: 'button', 'aria-label': 'Toggle now playing panel', title: 'Now playing panel',
    onClick: () => actions.toggleAside(),
  }, icon('queue', { size: 12 }));

  const commandBtn = h('button.btn.btn--ghost.btn--sm', {
    type: 'button',
    title: 'Command palette',
    onClick: () => actions.setCommandOpen(true),
  }, icon('keyboard', { size: 12 }), h('kbd', {}, '⌘K'));

  render(root,
    h('div.row.gap-2', {}, sidebarToggle, back),
    searchBox,
    h('div.grow'),
    h('div.row.gap-2.topbar__extras', {},
      commandBtn,
      h('span.tag', {}, `${CATALOG_STATS.tracks} MOVEMENTS`),
    ),
    asideToggle,
  );

  const pushQuery = debounce((value) => {
    actions.setQuery(value);
    if (store.state.routeName !== 'search') router.go('/search');
  }, 160);

  searchInput.addEventListener('input', () => pushQuery(searchInput.value));
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { actions.rememberSearch(searchInput.value); router.go('/search'); }
    if (e.key === 'Escape') { searchInput.value = ''; actions.setQuery(''); searchInput.blur(); }
  });

  // Keep the field in step with the store (the palette can set the query too).
  store.subscribe((s) => s.query, (q) => {
    if (document.activeElement !== searchInput && searchInput.value !== q) searchInput.value = q;
  }, { immediate: false });

  return { focusSearch: () => { searchInput.focus(); searchInput.select(); } };
}

/* ============================================================================
   Mobile tab bar
   ========================================================================== */

/** @param {HTMLElement} root */
export function mountTabbar(root) {
  render(root, NAV.map((item) =>
    h('a.tabbar__item', { href: item.href, 'data-tab': item.id },
      icon(item.icon, { size: 14 }),
      h('span', {}, item.label),
    ),
  ));

  store.subscribe((s) => s.routeName, (name) => {
    for (const el of root.querySelectorAll('[data-tab]')) {
      setAttr(el, 'aria-current', el.dataset.tab === name ? 'page' : null);
    }
  });
}

/* ============================================================================
   Scroll shadow on the topbar
   ========================================================================== */

/** @param {HTMLElement} view @param {HTMLElement} topbar */
export function bindScrollState(view, topbar) {
  let ticking = false;
  on(view, 'scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      setAttr(topbar, 'data-scrolled', String(view.scrollTop > 8));
      router.rememberScroll(view.scrollTop);
      ticking = false;
    });
  }, { passive: true });
}
