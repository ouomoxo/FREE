/* ============================================================
   intro.js — INTRO SECTION BEHAVIOUR
   Death Note :: 死神の手帳

   - Injects the red-apple inline SVG motif
   - Drives the ambient particle background (drifting motes),
     performant via requestAnimationFrame + capped count
   - Triggers the staged cinematic reveal when intro activates
   - Fully respects prefers-reduced-motion
   Relies on the global `DN` from app.js. Adds no new globals.
   ============================================================ */

(function () {
  "use strict";

  const DN = window.DN;
  if (!DN) return; // app.js must load first

  const { $, reducedMotion } = DN.util;

  /* --------------------------------------------------------
     1) APPLE MOTIF — inline SVG (shinigami nod)
     A stylised red apple with a leaf, glint and cast sheen.
     -------------------------------------------------------- */
  const APPLE_SVG = `
  <svg viewBox="0 0 64 64" role="img" aria-label="A red apple">
    <defs>
      <radialGradient id="dn-apple-body" cx="38%" cy="34%" r="72%">
        <stop offset="0%"  stop-color="#e5343c"/>
        <stop offset="55%" stop-color="#b3121b"/>
        <stop offset="100%" stop-color="#6b0a10"/>
      </radialGradient>
      <linearGradient id="dn-apple-leaf" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"  stop-color="#3f6b34"/>
        <stop offset="100%" stop-color="#20401b"/>
      </linearGradient>
    </defs>
    <!-- stem -->
    <path d="M32 15 C31 10 33 6 37 4"
          fill="none" stroke="#4a2f1c" stroke-width="2.4"
          stroke-linecap="round"/>
    <!-- leaf -->
    <path d="M33 13 C40 7 50 8 52 12 C48 18 39 18 33 13 Z"
          fill="url(#dn-apple-leaf)"/>
    <!-- body: two lobes -->
    <path d="M32 16
             C25 12 14 14 12 26
             C10 38 18 54 26 57
             C29 58 31 56 32 56
             C33 56 35 58 38 57
             C46 54 54 38 52 26
             C50 14 39 12 32 16 Z"
          fill="url(#dn-apple-body)"/>
    <!-- specular glint -->
    <ellipse cx="23" cy="27" rx="4.4" ry="6.6"
             fill="#ffffff" opacity="0.22"
             transform="rotate(-22 23 27)"/>
  </svg>`;

  function mountApple() {
    const host = $(".dn-intro__apple");
    if (host && !host.childElementCount) host.innerHTML = APPLE_SVG;
  }

  /* --------------------------------------------------------
     2) STAGED REVEAL — add .is-revealed to the intro section
     the first time it becomes active. If reduced-motion is on,
     we still reveal (CSS neutralises the transition durations).
     -------------------------------------------------------- */
  let revealed = false;
  function revealIntro() {
    const intro = $('[data-section="intro"]');
    if (intro && !revealed) {
      revealed = true;
      // Next frame so the transition is observed from the hidden state.
      requestAnimationFrame(() => intro.classList.add("is-revealed"));
    }
  }

  /* --------------------------------------------------------
     3) AMBIENT PARTICLES — drifting motes on a full-bleed canvas
     Runs only while a section is active AND motion is allowed.
     Capped particle count; DPR-aware; pauses when tab hidden.
     -------------------------------------------------------- */
  const Ambient = (function () {
    let canvas, ctx, raf = 0;
    let w = 0, h = 0, dpr = 1;
    let motes = [];
    let running = false;
    let lastT = 0;

    /* Particle budget scales with viewport but is hard-capped */
    function budget() {
      const area = window.innerWidth * window.innerHeight;
      return Math.max(28, Math.min(70, Math.round(area / 26000)));
    }

    function makeMote() {
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: DN.util.rand(0.4, 1.8),          // radius
        vy: DN.util.rand(4, 16),            // fall speed px/s
        vx: DN.util.rand(-6, 6),            // drift px/s
        sway: DN.util.rand(0, Math.PI * 2), // sway phase
        swaySpeed: DN.util.rand(0.2, 0.7),
        a: DN.util.rand(0.05, 0.35),        // alpha
        crimson: Math.random() < 0.12,      // a few embers glow red
      };
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = budget();
      if (motes.length < target) {
        while (motes.length < target) motes.push(makeMote());
      } else {
        motes.length = target;
      }
    }

    function step(t) {
      if (!running) return;
      const dt = Math.min(0.05, (t - lastT) / 1000 || 0);
      lastT = t;

      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < motes.length; i++) {
        const m = motes[i];
        m.sway += m.swaySpeed * dt;
        m.y += m.vy * dt;
        m.x += (m.vx + Math.sin(m.sway) * 6) * dt;

        // Recycle when it drifts off the bottom/sides
        if (m.y - m.r > h) { m.y = -m.r; m.x = Math.random() * w; }
        if (m.x < -10) m.x = w + 10;
        if (m.x > w + 10) m.x = -10;

        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        if (m.crimson) {
          ctx.fillStyle = "rgba(211,35,45," + m.a + ")";
          ctx.shadowColor = "rgba(211,35,45,0.7)";
          ctx.shadowBlur = 6;
        } else {
          ctx.fillStyle = "rgba(232,230,224," + m.a + ")";
          ctx.shadowBlur = 0;
        }
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(step);
    }

    function start() {
      if (running || reducedMotion()) return;
      running = true;
      lastT = performance.now();
      raf = requestAnimationFrame(step);
    }
    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    function init() {
      canvas = $("#dn-ambient");
      if (!canvas || reducedMotion()) return;
      ctx = canvas.getContext("2d");
      resize();
      window.addEventListener("resize", debounce(resize, 200));
      // Pause when the tab is hidden to save cycles/battery
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) stop();
        else start();
      });
      start();
    }

    return { init, start, stop };
  })();

  /* Small debounce util (local, not global) */
  function debounce(fn, ms) {
    let id;
    return function () {
      clearTimeout(id);
      id = setTimeout(fn, ms);
    };
  }

  /* --------------------------------------------------------
     Boot the intro module
     -------------------------------------------------------- */
  function init() {
    mountApple();
    Ambient.init();

    // Reveal now if intro is the active section on load…
    if (DN.section === "intro") revealIntro();
    // …and whenever the router switches to intro.
    DN.onSection((id) => {
      if (id === "intro") revealIntro();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
