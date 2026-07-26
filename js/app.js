/**
 * MAESTRO — Bootstrap.
 *
 * Wires the shell, mounts the overlays, registers the routes, binds the global
 * key map, and raises the curtain.
 *
 * @module app
 */

import { $, render, h, setAttr } from './core/dom.js';
import { store, actions } from './state.js';
import { router } from './router-instance.js';
import { player } from './player.js';
import { engine } from './audio/engine.js';
import { bus, EVT } from './core/bus.js';
import { mountSidebar, mountTopbar, mountTabbar, bindScrollState } from './ui/shell.js';
import { mountPlayerBar } from './ui/playerbar.js';
import { mountAside } from './ui/aside.js';
import { mountConcert } from './ui/concert.js';
import { mountPalette, mountToast } from './ui/overlays.js';
import { homeView } from './views/home.js';
import { albumView, playlistView, artistView, queueView, notFoundView } from './views/album.js';
import { searchView, libraryView } from './views/search.js';
import { PixelSurface } from './pixel/surface.js';
import { drawHand, batonHand, shapingHand } from './pixel/hand.js';
import { sleep, prefersReducedMotion } from './core/utils.js';
import { read, STORAGE_KEYS } from './core/storage.js';
import './pixel/font.js';

/* ============================================================================
   Boot curtain
   ========================================================================== */

const BOOT_STEPS = [
  'TUNING',
  'BUILDING THE HALL',
  'DRAWING THE HANDS',
  'SETTING THE STANDS',
  'HOUSE LIGHTS DOWN',
];

async function runBootSequence() {
  const bootEl = $('#boot');
  const fill = $('#boot-fill');
  const status = $('#boot-status');
  const canvas = /** @type {HTMLCanvasElement} */ ($('#boot-hands'));

  // A still of the two hands, drawn at the boot resolution.
  if (canvas) {
    const surf = new PixelSurface(canvas, { width: 120, height: 160, scale: 2 });
    const draw = (t) => {
      surf.clear();
      drawHand(surf.ctx, shapingHand({
        x: 40, y: 58 + Math.sin(t * 0.9) * 3, scale: 13,
        forearmAngle: 3.0, palmAngle: 0.24, exposure: 0.8,
      }));
      drawHand(surf.ctx, batonHand({
        x: 62, y: 108 + Math.sin(t * 0.9 + 1) * 4, scale: 15,
        baton: -0.72 + Math.sin(t * 0.9) * 0.08, batonLength: 5.4,
      }));
      surf.present({ palette: 'bone', strength: 0.8, gamma: 1.1 });
    };
    let raf = 0;
    const start = performance.now();
    const loop = () => {
      draw((performance.now() - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    if (prefersReducedMotion()) draw(0); else loop();
    bootEl?.addEventListener('transitionend', () => cancelAnimationFrame(raf), { once: true });
  }

  const fast = prefersReducedMotion();
  for (let i = 0; i < BOOT_STEPS.length; i++) {
    if (status) status.textContent = BOOT_STEPS[i];
    if (fill) fill.style.width = `${((i + 1) / BOOT_STEPS.length) * 100}%`;
    await sleep(fast ? 0 : 90);
  }

  $('#app')?.removeAttribute('hidden');
  await sleep(fast ? 0 : 40);
  bootEl?.setAttribute('data-done', 'true');
  setTimeout(() => bootEl?.remove(), 500);
}

/* ============================================================================
   Routing
   ========================================================================== */

/** @type {{el: Node, onMount?: Function, onUnmount?: Function}|null} */
let activeView = null;

/**
 * Swap the main view, running lifecycle hooks and restoring scroll.
 * @param {() => {el: Node, onMount?: Function, onUnmount?: Function}} factory
 * @param {string} name
 * @param {Record<string,string>} [params]
 * @param {string} [title]
 */
function mountView(factory, name, params = {}, title = '') {
  const host = $('#main-content');
  const view = $('#view');
  if (!host || !view) return;

  try { activeView?.onUnmount?.(); }
  catch (err) { console.error('[app] view unmount failed', err); }

  let next;
  try {
    next = factory();
  } catch (err) {
    console.error(`[app] view "${name}" failed to build`, err);
    next = notFoundView('Something went wrong building that page.');
  }

  activeView = next;
  render(host, next.el);
  store.set({ routeName: name, routeParams: params }, `route:${name}`);

  document.title = title ? `${title} · MAESTRO` : 'MAESTRO — a pixel concert hall';

  try { next.onMount?.(); }
  catch (err) { console.error('[app] view mount failed', err); }

  view.scrollTop = 0;
  bus.emit(EVT.ROUTE_RENDERED, { name, params });
}

function registerRoutes() {
  router
    .route('home', '/', () => mountView(homeView, 'home'))
    .route('search', '/search', () => mountView(searchView, 'search', {}, 'SEARCH'))
    .route('library', '/library', () => mountView(() => libraryView('all'), 'library', {}, 'LIBRARY'))
    .route('library', '/library/:tab', (m) =>
      mountView(() => libraryView(m.params.tab), 'library', m.params, 'LIBRARY'))
    .route('album', '/album/:id', (m) =>
      mountView(() => albumView(m.params.id), 'album', m.params, m.params.id.toUpperCase()))
    .route('playlist', '/playlist/:id', (m) =>
      mountView(() => playlistView(m.params.id), 'playlist', m.params))
    .route('artist', '/artist/:id', (m) =>
      mountView(() => artistView(m.params.id), 'artist', m.params))
    .route('queue', '/queue', () => mountView(queueView, 'queue', {}, 'QUEUE'))
    .route('concert', '/concert', () => {
      // The concert hall is an overlay, not a page: show it over whatever is
      // behind, and send the route back so closing it lands somewhere real.
      if (!activeView) mountView(homeView, 'home');
      store.set({ routeName: 'concert' }, 'route:concert');
      actions.setConcert(true);
    })
    .fallback(() => mountView(() => notFoundView(), 'not-found', {}, 'NOT FOUND'));
}

/* ============================================================================
   Global key map
   ========================================================================== */

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/** @param {{focusSearch: () => void}} topbar */
function bindKeys(topbar) {
  let pendingG = false;

  window.addEventListener('keydown', (e) => {
    const typing = isTypingTarget(document.activeElement);

    // Command palette is available everywhere.
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      actions.setCommandOpen(!store.state.commandOpen);
      return;
    }

    if (e.key === 'Escape') {
      if (store.state.commandOpen) { actions.setCommandOpen(false); return; }
      if (store.state.concert) {
        actions.setConcert(false);
        if (store.state.routeName === 'concert') router.go('/');
        return;
      }
    }

    if (typing || store.state.commandOpen) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    // `g` prefix for "go to".
    if (pendingG) {
      pendingG = false;
      const map = { h: '/', l: '/library', s: '/search', q: '/queue' };
      const target = map[e.key.toLowerCase()];
      if (target) { e.preventDefault(); router.go(target); return; }
    }

    switch (e.key) {
      case ' ':
        e.preventDefault();
        player.toggle();
        break;
      case 'ArrowRight':
        if (e.shiftKey) { e.preventDefault(); player.next(); }
        else { e.preventDefault(); player.nudge(5); }
        break;
      case 'ArrowLeft':
        if (e.shiftKey) { e.preventDefault(); player.previous(); }
        else { e.preventDefault(); player.nudge(-5); }
        break;
      case 'ArrowUp':
        e.preventDefault();
        actions.setVolume(store.state.volume + 0.05);
        break;
      case 'ArrowDown':
        e.preventDefault();
        actions.setVolume(store.state.volume - 0.05);
        break;
      case '/':
        e.preventDefault();
        topbar.focusSearch();
        break;
      case 'g': case 'G':
        pendingG = true;
        setTimeout(() => { pendingG = false; }, 900);
        break;
      case 's': case 'S': actions.toggleShuffle(); break;
      case 'r': case 'R': actions.cycleRepeat(); break;
      case 'm': case 'M': actions.toggleMute(); break;
      case 'f': case 'F': actions.setConcert(!store.state.concert); break;
      case 'q': case 'Q': actions.setQueueOpen(true); if (!store.state.asideOpen) actions.toggleAside(); break;
      case '?': actions.setCommandOpen(true); break;
      default: break;
    }
  });
}

/* ============================================================================
   Layout state
   ========================================================================== */

function bindLayout() {
  const app = $('#app');
  if (!app) return;
  store.subscribe((s) => s.sidebarOpen, (open) => setAttr(app, 'data-sidebar', open ? 'open' : 'closed'));
  store.subscribe((s) => s.asideOpen, (open) => setAttr(app, 'data-aside', open ? 'open' : 'closed'));

  // Below 1120px the now-playing panel becomes an overlay sheet, so it must not
  // start open — it would cover the page. The user's preference is restored the
  // moment there is room for it again.
  const narrow = window.matchMedia('(max-width: 1120px)');
  const applyWidth = () => {
    store.set(
      { asideOpen: narrow.matches ? false : read(STORAGE_KEYS.ASIDE_OPEN, true) },
      'ui:aside:responsive',
    );
  };
  applyWidth();
  narrow.addEventListener('change', applyWidth);
}

/**
 * Browsers will not start an AudioContext outside a gesture. Rather than
 * nagging, listen once for the first real interaction and quietly unlock.
 */
function bindAudioUnlock() {
  const unlock = () => {
    player.unlock().then((ok) => {
      if (ok) {
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      }
    });
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
}

/* ============================================================================
   Start
   ========================================================================== */

async function main() {
  bindLayout();

  mountSidebar($('#sidebar'));
  const topbar = mountTopbar($('#topbar'));
  mountTabbar($('#tabbar'));
  mountPlayerBar($('#playerbar'));
  mountAside($('#aside'));
  mountConcert($('#concert'));
  mountPalette($('#overlays'));
  mountToast($('#overlays'));

  bindScrollState($('#view'), $('#topbar'));
  bindKeys(topbar);
  bindAudioUnlock();

  player.init();
  registerRoutes();
  router.start();

  await runBootSequence();

  // Keep the URL honest when the concert overlay closes.
  store.subscribe((s) => s.concert, (on) => {
    if (!on && location.hash === '#/concert') router.go('/', { replace: true });
  }, { immediate: false });
}

window.addEventListener('error', (e) => {
  // Benign browser notification: a ResizeObserver callback ran past its frame
  // budget. It is not an exception and there is nothing to recover from.
  if (typeof e.message === 'string' && e.message.startsWith('ResizeObserver loop')) {
    e.stopImmediatePropagation();
    return;
  }
  console.error('[app] uncaught', e.error ?? e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[app] unhandled rejection', e.reason);
});

main().catch((err) => {
  console.error('[app] failed to start', err);
  const boot = $('#boot');
  if (boot) {
    render(boot, h('div.boot__inner', {},
      h('div', { style: 'color:var(--c-live);letter-spacing:.2em;font-size:12px' }, 'THE HALL DID NOT OPEN'),
      h('p', { style: 'color:var(--c-text-dim);max-width:44ch;font-size:13px;line-height:1.6' },
        String(err?.message ?? err)),
    ));
  }
});
