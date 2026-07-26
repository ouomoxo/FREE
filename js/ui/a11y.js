/**
 * MAESTRO — Accessibility services.
 *
 * Much of this interface is canvas-drawn and updates without a page load, so
 * two things have to be done deliberately: announce what changed, and put focus
 * somewhere sensible when the view is replaced.
 *
 * @module ui/a11y
 */

import { h, render, pxText, trapFocus, $ } from '../core/dom.js';
import { icon } from './icons.js';
import { store } from '../state.js';
import { bus, EVT } from '../core/bus.js';
import { getTrack, getArtist, getAlbum } from '../data/catalog.js';
import { formatTime } from '../core/utils.js';

/* ============================================================================
   Live region
   ========================================================================== */

/** @type {HTMLElement|null} */
let liveRegion = null;

/**
 * Announce a message to assistive technology.
 * @param {string} message
 * @param {'polite'|'assertive'} [priority]
 */
export function announce(message, priority = 'polite') {
  if (!liveRegion) return;
  liveRegion.setAttribute('aria-live', priority);
  // Clearing first guarantees the change is seen even when the text repeats.
  liveRegion.textContent = '';
  requestAnimationFrame(() => { liveRegion.textContent = message; });
}

/** @param {HTMLElement} host */
export function mountLiveRegion(host) {
  liveRegion = h('div.sr-only', {
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'true',
  });
  host.appendChild(liveRegion);

  store.subscribe((s) => s.trackId, (id) => {
    const track = id ? getTrack(id) : null;
    if (!track) return;
    const artist = getArtist(track.artistId);
    const album = getAlbum(track.albumId);
    announce(`Now playing: ${track.title}, ${artist?.name}, from ${album?.title}. ${formatTime(track.duration)}.`);
  }, { immediate: false });

  store.subscribe((s) => s.playing, (playing) => {
    if (store.state.trackId) announce(playing ? 'Playing' : 'Paused');
  }, { immediate: false });

  bus.on(EVT.ROUTE_RENDERED, ({ name }) => {
    announce(`${name.replace('-', ' ')} view loaded`);
  });
}

/* ============================================================================
   Keyboard shortcuts sheet
   ========================================================================== */

const SHORTCUTS = [
  ['TRANSPORT', [
    ['Space', 'Play or pause'],
    ['← / →', 'Seek five seconds'],
    ['Shift + ← / →', 'Previous or next movement'],
    ['↑ / ↓', 'Volume'],
    ['M', 'Mute'],
    ['S', 'Shuffle'],
    ['R', 'Cycle repeat'],
  ]],
  ['VIEW', [
    ['F', 'Enter or leave the concert hall'],
    ['Q', 'Show the queue'],
    ['/', 'Focus search'],
    ['⌘K / Ctrl K', 'Command palette'],
    ['?', 'This sheet'],
    ['Esc', 'Close whatever is open'],
  ]],
  ['GO TO', [
    ['G then H', 'The hall'],
    ['G then S', 'Search'],
    ['G then L', 'Library'],
    ['G then Q', 'Queue'],
  ]],
];

/**
 * Mount the shortcuts sheet. Toggled by the `helpOpen` flag in the store.
 * @param {HTMLElement} host
 */
export function mountShortcuts(host) {
  let release = null;

  const panel = h('div.palette', {
    role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Keyboard shortcuts',
    style: 'max-height:76vh',
  },
    h('div.palette__input', { style: 'justify-content:space-between' },
      h('div.row.gap-3', {}, icon('keyboard', { size: 14 }), pxText('KEYBOARD', { scale: 2 })),
      h('button.ibtn', {
        type: 'button', 'aria-label': 'Close',
        onClick: () => store.set({ helpOpen: false }, 'ui:help'),
      }, icon('close', { size: 11 })),
    ),
    h('div.palette__list', {},
      ...SHORTCUTS.map(([group, rows]) =>
        h('div', { style: 'margin-bottom:var(--s-5)' },
          h('div.t-eyebrow', { style: 'padding:var(--s-2) var(--s-3)' }, group),
          ...rows.map(([keys, what]) =>
            h('div.row-between', { style: 'padding:var(--s-2) var(--s-3);gap:var(--s-5)' },
              h('span', { style: 'font-size:var(--t-sm);color:var(--c-text)' }, what),
              h('span.row.gap-1', {}, ...keys.split(' ').map((k) =>
                (k === '/' || k === 'then' || k === '+' ? h('span.t-dim', {}, k) : h('kbd', {}, k)))),
            )),
        )),
    ),
  );

  const scrim = h('div.scrim', {
    onPointerdown: (e) => { if (e.target === scrim) store.set({ helpOpen: false }, 'ui:help'); },
  }, panel);

  store.subscribe((s) => s.helpOpen, (open) => {
    if (open) {
      host.appendChild(scrim);
      release = trapFocus(panel);
      requestAnimationFrame(() => panel.querySelector('button')?.focus());
    } else if (scrim.isConnected) {
      release?.();
      release = null;
      scrim.remove();
    }
  }, { immediate: false });
}

/**
 * Move focus to the top of the main region after a route change, so keyboard
 * and screen-reader users are not left at the bottom of the previous page.
 */
export function bindRouteFocus() {
  bus.on(EVT.ROUTE_RENDERED, () => {
    const view = $('#view');
    if (!view) return;
    // Only steal focus when it is somewhere that just got destroyed.
    const active = document.activeElement;
    if (!active || active === document.body || !document.contains(active)) {
      view.focus({ preventScroll: true });
    }
  });
}
