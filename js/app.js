/* ============================================================
   app.js — APP BOOTSTRAP + SECTION ROUTER
   Death Note :: 死神の手帳

   Responsibilities:
     - Single-page section switching (crossfade via CSS classes)
     - Nav active states + aria-current
     - Deep-linking via location.hash, back/forward support
     - Mobile drawer toggle
     - Small utility helpers
   Everything is namespaced under the global `DN`. No other globals.
   ============================================================ */

(function () {
  "use strict";

  /* --------------------------------------------------------
     Tiny DOM helpers
     -------------------------------------------------------- */
  const $  = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  /* Known section ids, in nav order. First is the default. */
  const SECTIONS = ["intro", "note", "rules", "cipher", "about"];

  /* --------------------------------------------------------
     Router state + elements (resolved on init)
     -------------------------------------------------------- */
  const state = {
    current: null,
    els: {
      app: null,
      sections: {},   // id -> <section>
      navLinks: {},   // id -> <a>
    },
    listeners: [],    // subscribers to section changes
    ready: false,
  };

  /* --------------------------------------------------------
     Normalise a raw hash/id into a valid section id.
     Falls back to the first section when unknown.
     -------------------------------------------------------- */
  function normalize(raw) {
    const id = String(raw || "").replace(/^#/, "").trim().toLowerCase();
    return SECTIONS.includes(id) ? id : SECTIONS[0];
  }

  /* --------------------------------------------------------
     Core: activate a section by id.
     `pushHash` controls whether we update location.hash
     (false when reacting to a hashchange to avoid loops).
     -------------------------------------------------------- */
  function go(rawId, pushHash) {
    const id = normalize(rawId);
    if (!state.ready) return;
    if (id === state.current) {
      // Already here — still ensure the hash reflects it.
      if (pushHash !== false) writeHash(id);
      return;
    }

    const prev = state.current;

    // Toggle section visibility classes
    Object.entries(state.els.sections).forEach(([sid, el]) => {
      const active = sid === id;
      el.classList.toggle("is-active", active);
      el.setAttribute("aria-hidden", active ? "false" : "true");
    });

    // Toggle nav active states / aria-current
    Object.entries(state.els.navLinks).forEach(([sid, link]) => {
      const active = sid === id;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    state.current = id;

    // Scroll the freshly shown section back to the top
    const target = state.els.sections[id];
    if (target) target.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: "auto" });

    // Update the URL hash for deep-linking / history
    if (pushHash !== false) writeHash(id);

    // Close the mobile drawer on navigation
    closeNav();

    // Notify subscribers (e.g. intro.js triggers its reveal)
    emit(id, prev);
  }

  /* Write the hash without triggering our own hashchange handler twice */
  function writeHash(id) {
    const next = "#" + id;
    if (location.hash !== next) {
      // Use replaceState for intro (default) to keep history clean,
      // pushState-like behaviour comes naturally from hash assignment.
      history.pushState(null, "", next);
    }
  }

  /* --------------------------------------------------------
     Pub/sub for section changes
     -------------------------------------------------------- */
  function onSection(fn) {
    if (typeof fn === "function") state.listeners.push(fn);
  }
  function emit(id, prev) {
    state.listeners.forEach((fn) => {
      try { fn(id, prev); } catch (err) { /* isolate subscriber errors */ }
    });
  }

  /* --------------------------------------------------------
     Mobile drawer
     -------------------------------------------------------- */
  function openNav()   { state.els.app && state.els.app.classList.add("is-nav-open"); syncBurger(); }
  function closeNav()  { state.els.app && state.els.app.classList.remove("is-nav-open"); syncBurger(); }
  function toggleNav() { state.els.app && state.els.app.classList.toggle("is-nav-open"); syncBurger(); }
  function syncBurger() {
    const burger = $("[data-burger]");
    if (!burger) return;
    const open = state.els.app.classList.contains("is-nav-open");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
  }

  /* --------------------------------------------------------
     Wire up all event listeners
     -------------------------------------------------------- */
  function bindEvents() {
    // Nav links (delegation-friendly explicit binding)
    $$("[data-nav]").forEach((link) => {
      const id = link.getAttribute("data-nav");
      state.els.navLinks[id] = link;
      link.addEventListener("click", (e) => {
        e.preventDefault();
        go(id);
      });
    });

    // Any element with [data-go] acts as an in-app router link (CTA, etc.)
    $$("[data-go]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        go(el.getAttribute("data-go"));
      });
    });

    // Burger + scrim
    const burger = $("[data-burger]");
    if (burger) burger.addEventListener("click", toggleNav);
    const scrim = $("[data-scrim]");
    if (scrim) scrim.addEventListener("click", closeNav);

    // Escape closes the drawer
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeNav();
    });

    // Browser back/forward + manual hash edits
    window.addEventListener("hashchange", () => go(location.hash, false));
    window.addEventListener("popstate", () => go(location.hash, false));
  }

  /* --------------------------------------------------------
     Boot
     -------------------------------------------------------- */
  function init() {
    state.els.app = $("[data-app]");

    // Resolve section elements
    $$("[data-section]").forEach((el) => {
      state.els.sections[el.getAttribute("data-section")] = el;
    });

    bindEvents();
    state.ready = true;

    // Initial route from the hash (deep-link) or default to intro
    const initial = normalize(location.hash);
    // Force emit even if it equals default by clearing current first
    state.current = null;
    go(initial, false);

    // Reflect the resolved section in the URL without adding history noise
    if (location.hash.replace(/^#/, "") !== initial) {
      history.replaceState(null, "", "#" + initial);
    }
  }

  /* --------------------------------------------------------
     Public API — the ONLY global this file creates
     -------------------------------------------------------- */
  const DN = {
    /* Navigation */
    go,
    onSection,
    get section() { return state.current; },
    sections: SECTIONS.slice(),

    /* Drawer controls (exposed for completeness) */
    nav: { open: openNav, close: closeNav, toggle: toggleNav },

    /* Shared utilities other modules can reuse */
    util: {
      $, $$,
      /* Clamp a number into [min, max] */
      clamp: (n, min, max) => Math.min(max, Math.max(min, n)),
      /* Linear interpolate */
      lerp: (a, b, t) => a + (b - a) * t,
      /* Random float in [min, max) */
      rand: (min, max) => min + Math.random() * (max - min),
      /* Does the user prefer reduced motion? (live query) */
      reducedMotion: () =>
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    },
  };

  window.DN = DN;

  /* Kick off once the DOM is parsed */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
