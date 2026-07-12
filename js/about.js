/* ============================================================
   about.js — ABOUT / 奥付 (section 05) behaviour
   Death Note :: 死神の手帳

   Intentionally tiny. The colophon is static; the only
   behaviour is a staged, cinematic reveal the first time the
   section becomes active:
     - marks the section .is-js (enables the hidden pre-reveal
       state defined in about.css — so no-JS visitors just see
       the content)
     - assigns a staggered --d delay to each [data-reveal]
     - toggles .is-revealed to play the entrance
   Respects prefers-reduced-motion (no per-element delays).

   IMPORTANT: the reveal state lives on the .dn-about element
   (about.css: `.dn-about.is-revealed [data-reveal]`), which is
   the inner <div data-about> — NOT the <section> wrapper. We
   query it directly so the classes land on the right element.

   Relies on the global `DN` from app.js. Adds no new globals.
   ============================================================ */

(function () {
  "use strict";

  const DN = window.DN;
  if (!DN) return; // app.js must load first

  const { $, $$, reducedMotion } = DN.util;

  const raf = (fn) => window.requestAnimationFrame(fn);

  /* Per-step stagger between revealed elements (ms). */
  const STEP = 80;
  /* Cap so the tail never feels sluggish. */
  const MAX_DELAY = 700;

  let section = null;      // the .dn-about inner div (bears the reveal state)
  let revealed = false;

  /* --------------------------------------------------------
     Play the staged reveal exactly once.
     -------------------------------------------------------- */
  function reveal() {
    if (revealed || !section) return;
    revealed = true;

    // Assign staggered entrance delays (skipped when motion is reduced;
    // the reduced-motion CSS shows everything at once regardless).
    if (!reducedMotion()) {
      $$("[data-reveal]", section).forEach((el, i) => {
        el.style.setProperty("--d", Math.min(i * STEP, MAX_DELAY) + "ms");
      });
    }

    raf(() => section.classList.add("is-revealed"));
  }

  /* --------------------------------------------------------
     Boot
     -------------------------------------------------------- */
  function init() {
    // [data-about] IS the .dn-about inner div — the element the CSS
    // reveal selector expects the class on.
    section = $("[data-about]");
    if (!section) return; // markup missing — bail quietly

    // Enable the hidden pre-reveal state now that JS is confirmed running.
    section.classList.add("is-js");

    // Reveal immediately if ABOUT is the active section on load…
    if (DN.section === "about") reveal();
    // …otherwise on the first switch to it.
    DN.onSection((id) => {
      if (id === "about") reveal();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
