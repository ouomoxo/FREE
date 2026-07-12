/* ============================================================
   note.js — THE NOTE (section 02) behaviour
   Death Note :: 死神の手帳

   - Staged reveal when the section first activates
   - The writing form: validation gates the INSCRIBE button
   - Cinematic inscription "ceremony": ink-bleed, the lore
     40s / 6:40 windows dramatised on a countdown ring, seal
   - THE LEDGER: add / remove / clear, persisted to localStorage
   - aria-live announcements, reduced-motion aware, XSS-safe
     (all user text is inserted via textContent — never innerHTML)

   Relies on the global `DN` from app.js. Adds no new globals.
   ============================================================ */

(function () {
  "use strict";

  const DN = window.DN;
  if (!DN) return; // app.js must load first

  const { $, reducedMotion, clamp } = DN.util;

  /* --------------------------------------------------------
     Persistence — namespaced, versioned localStorage key.
     Schema (dn.ledger.v1): Array of entries, newest first.
       { id:string, name:string, cause:string,
         details:string, ts:number }
     -------------------------------------------------------- */
  const STORE_KEY = "dn.ledger.v1";

  function loadLedger() {
    let raw;
    try {
      raw = window.localStorage.getItem(STORE_KEY);
    } catch (err) {
      return []; // storage disabled (private mode, etc.)
    }
    if (!raw) return [];
    try {
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      // Defensively coerce each record to the known shape.
      return data
        .filter((e) => e && typeof e === "object")
        .map((e) => ({
          id: String(e.id || uid()),
          name: String(e.name || ""),
          cause: String(e.cause || "heart attack"),
          details: String(e.details || ""),
          ts: Number(e.ts) || Date.now(),
        }))
        .filter((e) => e.name);
    } catch (err) {
      return []; // corrupt JSON — start clean rather than throw
    }
  }

  function saveLedger(list) {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(list));
    } catch (err) {
      /* storage unavailable — the session still works in-memory */
    }
  }

  /* --------------------------------------------------------
     Small helpers
     -------------------------------------------------------- */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  const pad2 = (n) => String(n).padStart(2, "0");

  /* "2026·07·12 · 21:04" */
  function formatTime(ts) {
    const d = new Date(ts);
    return (
      d.getFullYear() + "·" + pad2(d.getMonth() + 1) + "·" + pad2(d.getDate()) +
      " · " + pad2(d.getHours()) + ":" + pad2(d.getMinutes())
    );
  }

  /* Format a number of seconds as either "40" or "6:40". */
  function formatSeconds(total, asClock) {
    if (!asClock) return String(Math.ceil(total));
    const s = Math.ceil(total);
    return Math.floor(s / 60) + ":" + pad2(s % 60);
  }

  const raf = (fn) => window.requestAnimationFrame(fn);

  /* --------------------------------------------------------
     Module state + resolved elements
     -------------------------------------------------------- */
  let ledger = [];
  let busy = false;     // an inscription ceremony is running
  let confirmingClear = false;
  const els = {};
  let RING_CIRC = 0;

  /* --------------------------------------------------------
     Validation — INSCRIBE is enabled only when a name is
     written AND the "I can picture their face" rule is met.
     -------------------------------------------------------- */
  function refreshSubmit() {
    if (!els.submit) return;
    const ok = els.name.value.trim().length > 0 && els.face.checked;
    els.submit.disabled = !ok || busy;
  }

  /* --------------------------------------------------------
     Ceremony — animate one lore "window" on the ring.
     Drains the ring from full to empty while counting down
     from `seconds`. Resolves when the window closes.
     -------------------------------------------------------- */
  function animateWindow(seconds, duration, asClock) {
    return new Promise((resolve) => {
      if (reducedMotion() || duration <= 0) {
        els.ringCount.textContent = "0";
        resolve();
        return;
      }
      const start = performance.now();
      function tick(now) {
        const t = clamp((now - start) / duration, 0, 1);
        // Ring drains: offset grows from 0 (full) to circumference (empty)
        els.ringProg.style.strokeDashoffset = String(RING_CIRC * t);
        els.ringCount.textContent = formatSeconds(seconds * (1 - t), asClock);
        if (t < 1) {
          raf(tick);
        } else {
          resolve();
        }
      }
      els.ringProg.style.strokeDashoffset = "0";
      raf(tick);
    });
  }

  /* A tiny awaitable delay (0 when motion is reduced). */
  function beat(ms) {
    return new Promise((resolve) => {
      if (reducedMotion() || ms <= 0) return resolve();
      window.setTimeout(resolve, ms);
    });
  }

  function setStatus(html) {
    // Trusted lore strings only (no user input) — a small red accent span.
    els.status.innerHTML = html;
  }

  /* Run the full cinematic inscription, then commit the entry. */
  async function inscribe() {
    if (busy) return;
    const name = els.name.value.trim();
    if (!name || !els.face.checked) return;

    const causeRaw = els.cause.value.trim();
    const detailsRaw = els.details.value.trim();
    const cause = causeRaw || "heart attack";

    busy = true;
    refreshSubmit();
    els.form.setAttribute("aria-busy", "true");

    // Open the ceremony layer with the name (XSS-safe: textContent).
    els.ceremonyName.textContent = name;
    els.ceremony.hidden = false;
    els.ceremony.classList.remove("is-sealing");
    els.ceremony.classList.add("is-writing");
    els.ringProg.style.strokeDashoffset = "0";
    els.ringCount.textContent = formatSeconds(40, false);
    setStatus("The name is written&hellip;");

    // 1) Ink bleeds into the page.
    await beat(950);

    // 2) The 40-second window — a cause may be specified.
    setStatus('<span class="lore">40s</span> · specify a cause of death');
    await animateWindow(40, 1600, false);
    if (causeRaw) {
      setStatus("Cause inscribed · " + "the window closes");
    } else {
      setStatus("No cause given · it defaults to a heart attack");
    }
    await beat(700);

    // 3) The 6-minute-40-second window — details may be added.
    setStatus('<span class="lore">6:40</span> · the details take hold');
    els.ringCount.textContent = formatSeconds(400, true);
    await animateWindow(400, 1400, true);

    // 4) Seal the entry — crimson pulse + colour shift.
    els.ceremony.classList.remove("is-writing");
    els.ceremony.classList.add("is-sealing");
    setStatus("刻む · SEALED");
    await beat(750);

    // Commit to the ledger (newest first) + persist.
    const entry = { id: uid(), name, cause, details: detailsRaw, ts: Date.now() };
    ledger.unshift(entry);
    saveLedger(ledger);
    addEntryNode(entry, true);
    updateCount();
    toggleEmpty();

    announce(
      "Inscribed: " + name + ". Cause of death: " + cause + "." +
      (detailsRaw ? " Details recorded." : "") + " Added to the ledger."
    );

    // Close the ceremony + reset the page for the next name.
    els.ceremony.hidden = true;
    els.ceremony.classList.remove("is-sealing", "is-writing");
    els.form.reset();
    els.form.removeAttribute("aria-busy");
    busy = false;
    refreshSubmit();
    els.name.focus();
  }

  /* --------------------------------------------------------
     Ledger rendering
     -------------------------------------------------------- */
  function createEl(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text; // always textContent — safe
    return el;
  }

  /* Build one ledger row. All user text goes through textContent. */
  function createEntryNode(entry, fresh) {
    const li = createEl("li", "dn-entry" + (fresh ? " is-fresh" : ""));
    li.setAttribute("data-id", entry.id);

    const name = createEl("span", "dn-entry__name", entry.name);

    const cause = createEl("span", "dn-entry__cause");
    cause.appendChild(createEl("span", "k", "cause"));
    cause.appendChild(document.createTextNode(entry.cause));

    const seal = createEl("span", "dn-entry__seal", "封"); // 封 (sealed)

    li.appendChild(name);
    li.appendChild(seal);
    li.appendChild(cause);

    if (entry.details) {
      li.appendChild(createEl("p", "dn-entry__details", entry.details));
    }

    li.appendChild(createEl("span", "dn-entry__time", formatTime(entry.ts)));

    const remove = createEl("button", "dn-entry__remove", "✕");
    remove.type = "button";
    remove.setAttribute(
      "aria-label",
      "Remove " + entry.name + " from the ledger"
    );
    remove.addEventListener("click", () => removeEntry(entry.id));
    li.appendChild(remove);

    if (fresh) {
      li.addEventListener(
        "animationend",
        () => li.classList.remove("is-fresh"),
        { once: true }
      );
    }
    return li;
  }

  function addEntryNode(entry, fresh) {
    els.list.insertBefore(createEntryNode(entry, fresh), els.list.firstChild);
  }

  function renderAll() {
    els.list.textContent = "";
    ledger.forEach((entry) => els.list.appendChild(createEntryNode(entry, false)));
    updateCount();
    toggleEmpty();
  }

  function updateCount() {
    const n = ledger.length;
    els.count.textContent = n + (n === 1 ? " name" : " names");
  }

  function toggleEmpty() {
    const empty = ledger.length === 0;
    els.empty.hidden = !empty;
    els.list.hidden = empty;
    els.foot.hidden = empty;
  }

  function removeEntry(id) {
    const node = els.list.querySelector('[data-id="' + id + '"]');
    const entry = ledger.find((e) => e.id === id);
    ledger = ledger.filter((e) => e.id !== id);
    saveLedger(ledger);
    if (node) node.remove();
    updateCount();
    toggleEmpty();
    if (entry) announce(entry.name + " struck from the ledger.");
  }

  /* --------------------------------------------------------
     Clear the note — a two-step confirm inline in the footer.
     -------------------------------------------------------- */
  function showClearConfirm(show) {
    confirmingClear = show;
    els.clearBtn.hidden = show;
    els.confirm.hidden = !show;
    if (show) els.confirmYes.focus();
    else els.clearBtn.focus();
  }

  function clearLedger() {
    ledger = [];
    saveLedger(ledger);
    renderAll();
    showClearConfirm(false);
    announce("The note is blank. Every name has been erased.");
  }

  /* --------------------------------------------------------
     aria-live announcer
     -------------------------------------------------------- */
  function announce(msg) {
    if (!els.live) return;
    els.live.textContent = "";      // force re-announce of identical text
    raf(() => (els.live.textContent = msg));
  }

  /* --------------------------------------------------------
     Staged reveal on first activation
     -------------------------------------------------------- */
  let revealed = false;
  function reveal() {
    if (revealed || !els.section) return;
    revealed = true;
    raf(() => els.section.classList.add("is-revealed"));
  }

  /* --------------------------------------------------------
     Wire up + boot
     -------------------------------------------------------- */
  function init() {
    const section = $('[data-section="note"]');
    if (!section) return;

    Object.assign(els, {
      section,
      form: $("[data-note-form]", section),
      name: $("[data-field-name]", section),
      cause: $("[data-field-cause]", section),
      details: $("[data-field-details]", section),
      face: $("[data-field-face]", section),
      submit: $("[data-inscribe]", section),
      ceremony: $("[data-ceremony]", section),
      ceremonyName: $("[data-ceremony-name]", section),
      ringProg: $("[data-ring-prog]", section),
      ringCount: $("[data-ring-count]", section),
      status: $("[data-ceremony-status]", section),
      list: $("[data-ledger-list]", section),
      empty: $("[data-ledger-empty]", section),
      foot: $("[data-ledger-foot]", section),
      count: $("[data-ledger-count]", section),
      clearBtn: $("[data-ledger-clear]", section),
      confirm: $("[data-ledger-confirm]", section),
      confirmYes: $("[data-confirm-yes]", section),
      confirmNo: $("[data-confirm-no]", section),
      live: $("[data-note-live]", section),
    });

    if (!els.form) return; // markup missing — bail quietly

    // Prime the countdown ring geometry from its rendered radius.
    const r = Number(els.ringProg.getAttribute("r")) || 52;
    RING_CIRC = 2 * Math.PI * r;
    els.ringProg.style.strokeDasharray = String(RING_CIRC);
    els.ringProg.style.strokeDashoffset = "0";

    // Validation triggers
    els.name.addEventListener("input", refreshSubmit);
    els.face.addEventListener("change", refreshSubmit);

    // Submit the form -> run the ceremony
    els.form.addEventListener("submit", (e) => {
      e.preventDefault();
      inscribe();
    });

    // Clear-the-note flow
    els.clearBtn.addEventListener("click", () => showClearConfirm(true));
    els.confirmYes.addEventListener("click", clearLedger);
    els.confirmNo.addEventListener("click", () => showClearConfirm(false));
    section.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && confirmingClear) showClearConfirm(false);
    });

    // Load + paint any persisted ledger
    ledger = loadLedger();
    renderAll();
    refreshSubmit();

    // Reveal now if the note is the active section on load…
    if (DN.section === "note") reveal();
    // …and whenever the router switches to it.
    DN.onSection((id) => {
      if (id === "note") reveal();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
