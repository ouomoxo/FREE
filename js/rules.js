/* ============================================================
   rules.js — THE RULES (section 03) behaviour
   Death Note :: 死神の手帳

   Intentionally tiny. The rules page is static; the only
   behaviour is a staged, cinematic reveal the first time the
   section becomes active:
     - marks the section .is-js (enables the hidden pre-reveal
       state defined in rules.css — so no-JS visitors just see
       the content)
     - assigns a staggered --d delay to each [data-reveal]
     - toggles .is-revealed to play the entrance
   Respects prefers-reduced-motion (no per-element delays).

   Relies on the global `DN` from app.js. Adds no new globals.
   ============================================================ */

(function () {
  "use strict";

  const DN = window.DN;
  if (!DN) return; // app.js must load first

  const { $, $$, reducedMotion } = DN.util;

  const raf = (fn) => window.requestAnimationFrame(fn);

  /* Per-step stagger between revealed elements (ms). */
  const STEP = 70;
  /* Cap so a long list never feels sluggish at the tail. */
  const MAX_DELAY = 900;

  let section = null;
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
    section = $('[data-rules]');
    if (!section) return; // markup missing — bail quietly

    // Enable the hidden pre-reveal state now that JS is confirmed running.
    section.classList.add("is-js");

    // Reveal immediately if RULES is the active section on load…
    if (DN.section === "rules") reveal();
    // …otherwise on the first switch to it.
    DN.onSection((id) => {
      if (id === "rules") reveal();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
