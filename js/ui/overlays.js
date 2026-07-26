/**
 * MAESTRO — Overlays: command palette and toasts.
 * @module ui/overlays
 */

import { h, render, clear, trapFocus, setAttr, pxText } from '../core/dom.js';
import { icon } from './icons.js';
import { store, actions } from '../state.js';
import { player } from '../player.js';
import { router } from '../router-instance.js';
import { search, highlight } from '../search.js';
import { getAlbum, getArtist } from '../data/catalog.js';
import { albumCover, artistCover, playlistCover, trackCover } from './components.js';

/* ============================================================================
   Command palette
   ========================================================================== */

/**
 * Static commands, always available. Everything else comes from the catalogue
 * index, so the palette is both a launcher and a search box.
 */
const COMMANDS = [
  { id: 'play', label: 'PLAY / PAUSE', hint: 'SPACE', icon: 'play', run: () => player.toggle() },
  { id: 'next', label: 'NEXT MOVEMENT', hint: '→', icon: 'next', run: () => player.next() },
  { id: 'prev', label: 'PREVIOUS MOVEMENT', hint: '←', icon: 'prev', run: () => player.previous() },
  { id: 'shuffle', label: 'TOGGLE SHUFFLE', hint: 'S', icon: 'shuffle', run: () => actions.toggleShuffle() },
  { id: 'repeat', label: 'CYCLE REPEAT', hint: 'R', icon: 'repeat', run: () => actions.cycleRepeat() },
  { id: 'concert', label: 'ENTER THE CONCERT HALL', hint: 'F', icon: 'expand', run: () => actions.setConcert(true) },
  { id: 'home', label: 'GO TO THE HALL', hint: 'G H', icon: 'home', run: () => router.go('/hall') },
  { id: 'library', label: 'GO TO LIBRARY', hint: 'G L', icon: 'library', run: () => router.go('/library') },
  { id: 'queue', label: 'GO TO QUEUE', hint: 'G Q', icon: 'queue', run: () => router.go('/queue') },
  { id: 'mute', label: 'TOGGLE MUTE', hint: 'M', icon: 'volumeMute', run: () => actions.toggleMute() },
];

/** @param {HTMLElement} host */
export function mountPalette(host) {
  const input = h('input', {
    type: 'text',
    placeholder: 'Type a command, or search the catalogue…',
    'aria-label': 'Command or search',
    autocomplete: 'off',
    spellcheck: 'false',
  });

  const list = h('div.palette__list', { role: 'listbox', id: 'palette-list' });

  const panel = h('div.palette', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Command palette' },
    h('div.palette__input', {}, icon('search', { size: 14 }), input,
      h('kbd', {}, 'ESC')),
    list,
    h('div.palette__foot', {},
      h('span', {}, h('kbd', {}, '↑'), ' ', h('kbd', {}, '↓'), ' NAVIGATE'),
      h('span', {}, h('kbd', {}, '↵'), ' SELECT'),
      h('span', {}, h('kbd', {}, 'ESC'), ' CLOSE'),
    ),
  );

  const scrim = h('div.scrim', {
    onPointerdown: (e) => { if (e.target === scrim) actions.setCommandOpen(false); },
  }, panel);

  /** @type {Array<{label:string, hint?:string, art?:Node, iconName?:string, sub?:string, ranges?:any, run:()=>void}>} */
  let items = [];
  let cursor = 0;
  let release = null;

  function build() {
    const q = input.value.trim();
    items = [];

    if (!q) {
      items = COMMANDS.map((c) => ({
        label: c.label, hint: c.hint, iconName: c.icon, run: c.run,
      }));
    } else {
      const matchedCommands = COMMANDS.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));
      items.push(...matchedCommands.map((c) => ({
        label: c.label, hint: c.hint, iconName: c.icon, run: c.run,
      })));

      for (const hit of search(q, { limit: 12 })) {
        const { entry } = hit;
        const e = entry.entity;
        let art;
        let run;
        switch (entry.type) {
          case 'album':
            art = albumCover(e, { scale: 2 });
            run = () => router.go(`/album/${e.id}`);
            break;
          case 'artist':
            art = artistCover(e, { scale: 2 });
            run = () => router.go(`/artist/${e.id}`);
            break;
          case 'playlist':
            art = playlistCover(e, { scale: 2 });
            run = () => router.go(`/playlist/${e.id}`);
            break;
          default: {
            const album = getAlbum(e.albumId);
            art = trackCover(e, { scale: 2 });
            run = () => player.play(e.id, {
              queue: album.trackIds,
              origin: { type: 'album', id: album.id, title: album.title },
            });
          }
        }
        items.push({
          label: entry.primary,
          sub: `${entry.type.toUpperCase()} · ${entry.secondary}`,
          ranges: hit.ranges,
          art,
          run,
        });
      }
    }

    cursor = 0;
    paint();
  }

  function paint() {
    if (!items.length) {
      render(list, h('div.palette__group.t-dim', {}, 'NO MATCHES'));
      return;
    }
    render(list, items.map((item, i) => {
      const label = h('span.truncate', {});
      if (item.ranges) label.append(highlight(item.label, item.ranges));
      else label.textContent = item.label;

      return h('button.palette__item', {
        type: 'button',
        role: 'option',
        'aria-selected': String(i === cursor),
        onPointerenter: () => { cursor = i; paintSelection(); },
        onClick: () => runItem(i),
      },
        item.art ?? (item.iconName ? icon(item.iconName, { size: 12 }) : null),
        h('div.col', { style: 'min-width:0' },
          label,
          item.sub ? h('span.truncate.t-dim', { style: 'font-size:var(--t-2xs)' }, item.sub) : null,
        ),
        item.hint ? h('span.palette__hint', {}, item.hint) : null,
      );
    }));
    scrollCursorIntoView();
  }

  function paintSelection() {
    Array.from(list.children).forEach((el, i) => setAttr(el, 'aria-selected', String(i === cursor)));
  }

  function scrollCursorIntoView() {
    const el = list.children[cursor];
    el?.scrollIntoView?.({ block: 'nearest' });
  }

  function runItem(i) {
    const item = items[i];
    if (!item) return;
    actions.setCommandOpen(false);
    item.run();
  }

  input.addEventListener('input', build);
  input.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); cursor = (cursor + 1) % Math.max(1, items.length); paintSelection(); scrollCursorIntoView(); break;
      case 'ArrowUp': e.preventDefault(); cursor = (cursor - 1 + items.length) % Math.max(1, items.length); paintSelection(); scrollCursorIntoView(); break;
      case 'Enter': e.preventDefault(); runItem(cursor); break;
      case 'Escape': e.preventDefault(); actions.setCommandOpen(false); break;
      default: break;
    }
  });

  store.subscribe((s) => s.commandOpen, (open) => {
    if (open) {
      host.appendChild(scrim);
      input.value = '';
      build();
      release = trapFocus(panel);
      requestAnimationFrame(() => input.focus());
    } else if (scrim.isConnected) {
      release?.();
      release = null;
      scrim.remove();
    }
  }, { immediate: false });
}

/* ============================================================================
   Toast
   ========================================================================== */

/** @param {HTMLElement} host */
export function mountToast(host) {
  let node = null;
  store.subscribe((s) => s.toast, (toast) => {
    node?.remove();
    node = null;
    if (!toast) return;
    node = h('div.toast', { role: 'status', 'data-tone': toast.tone }, toast.message);
    host.appendChild(node);
  }, { immediate: false });
}
