/* ============================================================
   cipher.js — CIPHER (section 04) behaviour
   Death Note :: 暗号 / 復号

   A cryptographer's desk: a workbench of genuinely reversible
   ciphers, themed on the series' hidden-message subplot.

   Methods (all correct, round-trip verified):
     - Caesar / ROT shift (N 0–25, ROT13 preset)
     - Atbash (A↔Z mirror, self-inverse)
     - Base64 (UTF-8 safe via TextEncoder/TextDecoder)
     - Shinigami keyword substitution (Vigenère over A–Z)
     - Hidden acrostic (every-Nth-letter reveal / hide)

   - Live, debounced re-compute on input + param change
   - Copy (clipboard + graceful fallback), Swap, sample preset
   - Last method + params persisted to localStorage
   - aria-live status, reduced-motion aware, XSS-safe
     (all user text rendered via value/textContent — never innerHTML)

   Relies on the global `DN` from app.js. Adds no new globals.
   ============================================================ */

(function () {
  "use strict";

  const DN = window.DN;
  if (!DN) return; // app.js must load first

  const { $, reducedMotion } = DN.util;

  /* ========================================================
     PURE CIPHER CORE
     Every function is total (never throws for the alphabetic
     ciphers), preserves case, and passes non-letters through
     unchanged. Iterating with for…of keeps astral characters
     (e.g. emoji) intact; their surrogate code units never fall
     in the A–Z ranges, so they pass straight through.
     ======================================================== */

  /* Caesar: shift letters by `shift` (any integer, normalised). */
  function caesar(text, shift) {
    const s = (((shift % 26) + 26) % 26);
    let out = "";
    for (const ch of text) {
      const c = ch.charCodeAt(0);
      if (c >= 65 && c <= 90) {
        out += String.fromCharCode(((c - 65 + s) % 26) + 65);
      } else if (c >= 97 && c <= 122) {
        out += String.fromCharCode(((c - 97 + s) % 26) + 97);
      } else {
        out += ch;
      }
    }
    return out;
  }

  /* Atbash: A↔Z / a↔z mirror. Its own inverse. */
  function atbash(text) {
    let out = "";
    for (const ch of text) {
      const c = ch.charCodeAt(0);
      if (c >= 65 && c <= 90) out += String.fromCharCode(90 - (c - 65));
      else if (c >= 97 && c <= 122) out += String.fromCharCode(122 - (c - 97));
      else out += ch;
    }
    return out;
  }

  /* Vigenère over A–Z, driven by a keyword. `decode` reverses it.
     The key index advances only on letters, so non-letters pass
     through identically in both directions (exact round-trip). */
  function vigenere(text, keyword, decode) {
    const key = String(keyword).toUpperCase().replace(/[^A-Z]/g, "");
    if (!key) return text; // no usable key — nothing to do
    let out = "";
    let ki = 0;
    for (const ch of text) {
      const c = ch.charCodeAt(0);
      let base = -1;
      if (c >= 65 && c <= 90) base = 65;
      else if (c >= 97 && c <= 122) base = 97;
      if (base < 0) { out += ch; continue; }
      const k = key.charCodeAt(ki % key.length) - 65;
      const shift = decode ? -k : k;
      out += String.fromCharCode((((c - base + shift) % 26) + 26) % 26 + base);
      ki++;
    }
    return out;
  }

  /* Base64 — UTF-8 safe. btoa/atob only speak Latin-1, so we
     round-trip through TextEncoder/TextDecoder to survive any
     Unicode (Japanese, emoji, …). Both may throw on bad input;
     callers wrap them and surface an error state. */
  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    // Chunk to avoid call-stack limits on very large inputs.
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }

  function base64ToUtf8(b64) {
    // Tolerate whitespace/newlines that commonly wrap base64 blobs.
    const clean = String(b64).replace(/\s+/g, "");
    const bin = atob(clean); // throws on invalid base64 alphabet/length
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    // fatal:true rejects malformed UTF-8 rather than emitting U+FFFD.
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }

  /* Hidden acrostic — a nod to the message spread across pages.
     hide(secret, n): every Nth character carries a secret letter,
     the rest are filler dots. reveal(cover, n): pull every Nth
     character back out. reveal(hide(x, n), n) === x. */
  const ACROSTIC_FILLER = "·";

  function acrosticHide(secret, n) {
    const step = Math.max(1, Math.floor(n) || 1);
    let out = "";
    for (const ch of secret) {
      out += ACROSTIC_FILLER.repeat(step - 1) + ch;
    }
    return out;
  }

  function acrosticReveal(cover, n) {
    const step = Math.max(1, Math.floor(n) || 1);
    const chars = Array.from(cover);
    let out = "";
    for (let i = step - 1; i < chars.length; i += step) out += chars[i];
    return out;
  }

  /* --------------------------------------------------------
     Method registry. Each `run(text, params, decode)` returns
     the transformed string OR throws with a human message
     (only Base64 realistically throws).
     -------------------------------------------------------- */
  const METHODS = {
    caesar: {
      run(text, p, decode) {
        return caesar(text, decode ? -p.shift : p.shift);
      },
    },
    atbash: {
      run(text) { return atbash(text); }, // symmetric — decode ignored
    },
    base64: {
      run(text, p, decode) {
        if (decode) {
          try {
            return base64ToUtf8(text);
          } catch (err) {
            const e = new Error("Not valid Base64 — check the input.");
            e.isCipherError = true;
            throw e;
          }
        }
        return utf8ToBase64(text);
      },
    },
    vigenere: {
      run(text, p, decode) { return vigenere(text, p.keyword, decode); },
    },
    acrostic: {
      run(text, p, decode) {
        return decode ? acrosticReveal(text, p.n) : acrosticHide(text, p.n);
      },
    },
  };

  /* ========================================================
     UI LAYER
     ======================================================== */

  const STORE_KEY = "dn.cipher.v1";
  const SAMPLE = "L, do you know Shinigami love apples?";
  const DEFAULTS = { method: "caesar", mode: "encode", shift: 3, keyword: "SHINIGAMI", n: 5 };

  const els = {};
  let params = Object.assign({}, DEFAULTS);
  let mode = DEFAULTS.mode; // "encode" | "decode"
  let method = DEFAULTS.method;
  let debounceId = 0;

  /* ---- persistence (params only; never the text) ---- */
  function loadPrefs() {
    let raw;
    try { raw = window.localStorage.getItem(STORE_KEY); }
    catch (err) { return; } // storage disabled
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      if (!d || typeof d !== "object") return;
      if (METHODS[d.method]) method = d.method;
      if (d.mode === "encode" || d.mode === "decode") mode = d.mode;
      if (Number.isFinite(d.shift)) params.shift = clampInt(d.shift, 0, 25);
      if (typeof d.keyword === "string" && d.keyword) params.keyword = d.keyword.slice(0, 40);
      if (Number.isFinite(d.n)) params.n = clampInt(d.n, 1, 99);
    } catch (err) {
      /* corrupt JSON — fall back to defaults silently */
    }
  }

  function savePrefs() {
    const data = {
      method,
      mode,
      shift: params.shift,
      keyword: params.keyword,
      n: params.n,
    };
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
    catch (err) { /* storage unavailable — session still works */ }
  }

  function clampInt(v, min, max) {
    v = Math.round(Number(v) || 0);
    return Math.min(max, Math.max(min, v));
  }

  /* ---- aria-live status announcer ---- */
  function announce(msg, kind) {
    if (!els.status) return;
    els.status.dataset.kind = kind || "info";
    els.status.textContent = ""; // force re-announce of identical text
    window.requestAnimationFrame(() => { els.status.textContent = msg; });
  }

  /* ---- reflect active method across tabs + control panels ---- */
  function syncMethodUI() {
    els.tabs.forEach((tab) => {
      const active = tab.dataset.method === method;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
      tab.tabIndex = active ? 0 : -1;
    });
    // Toggle control groups for the active method.
    els.controlGroups.forEach((g) => {
      g.hidden = g.dataset.for !== method;
    });
    // Method blurb.
    const meta = METHOD_META[method];
    if (els.blurb) els.blurb.textContent = meta ? meta.blurb : "";
  }

  /* ---- reflect the encode/decode mode ---- */
  function syncModeUI() {
    els.encodeBtn.classList.toggle("is-active", mode === "encode");
    els.encodeBtn.setAttribute("aria-pressed", mode === "encode" ? "true" : "false");
    els.decodeBtn.classList.toggle("is-active", mode === "decode");
    els.decodeBtn.setAttribute("aria-pressed", mode === "decode" ? "true" : "false");
  }

  /* ---- recompute the output from current input + params ---- */
  function compute() {
    const input = els.input.value;
    updateCount(els.input, els.inCount);

    if (input.length === 0) {
      els.output.value = "";
      updateCount(els.output, els.outCount);
      setError(false);
      announce("Awaiting input.", "info");
      return;
    }

    const m = METHODS[method];
    let result;
    try {
      result = m.run(input, params, mode === "decode");
      setError(false);
    } catch (err) {
      // Only expected failure is invalid Base64 on decode.
      els.output.value = "";
      updateCount(els.output, els.outCount);
      setError(true);
      announce(err && err.message ? err.message : "Unable to process input.", "error");
      return;
    }

    els.output.value = result; // value assignment — never innerHTML
    updateCount(els.output, els.outCount);

    const meta = METHOD_META[method];
    announce(
      (mode === "encode" ? "Encoded" : "Decoded") +
      " with " + (meta ? meta.label : method) + ".",
      "info"
    );
  }

  function setError(on) {
    els.output.classList.toggle("is-error", !!on);
    if (els.outPanel) els.outPanel.classList.toggle("is-error", !!on);
  }

  function updateCount(field, node) {
    if (!node) return;
    // Count Unicode code points, not UTF-16 units.
    const n = Array.from(field.value).length;
    node.textContent = n + (n === 1 ? " char" : " chars");
  }

  /* Debounced recompute for high-frequency events (typing, slider). */
  function scheduleCompute() {
    window.clearTimeout(debounceId);
    debounceId = window.setTimeout(compute, 120);
  }

  /* ---- actions ---- */
  function setMode(next) {
    mode = next;
    syncModeUI();
    savePrefs();
    compute();
  }

  function setMethod(next) {
    if (!METHODS[next]) return;
    method = next;
    syncMethodUI();
    savePrefs();
    compute();
  }

  function loadSample() {
    els.input.value = SAMPLE;
    els.input.focus();
    compute();
    announce("Sample line loaded.", "info");
  }

  function swap() {
    const out = els.output.value;
    if (!out) { announce("Nothing to swap.", "info"); return; }
    els.input.value = out;
    compute();
    announce("Output moved to input.", "info");
  }

  function clearAll() {
    els.input.value = "";
    els.output.value = "";
    updateCount(els.input, els.inCount);
    updateCount(els.output, els.outCount);
    setError(false);
    els.input.focus();
    announce("Cleared.", "info");
  }

  /* Copy with clipboard API + a legacy execCommand fallback. */
  function copyOutput() {
    const text = els.output.value;
    if (!text) { announce("Nothing to copy.", "info"); return; }

    const done = () => flashCopy();
    const fail = () => announce("Copy failed — select the text manually.", "error");

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => {
        if (!legacyCopy(text)) fail(); else done();
      });
    } else {
      if (legacyCopy(text)) done(); else fail();
    }
  }

  function legacyCopy(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (err) {
      return false;
    }
  }

  function flashCopy() {
    announce("Copied to clipboard.", "info");
    if (!els.copyBtn) return;
    els.copyBtn.classList.add("is-copied");
    const label = els.copyBtn.querySelector("[data-copy-label]");
    if (label) label.textContent = "COPIED";
    if (reducedMotion()) {
      window.setTimeout(resetCopy, 1200);
    } else {
      window.setTimeout(resetCopy, 1400);
    }
  }

  function resetCopy() {
    if (!els.copyBtn) return;
    els.copyBtn.classList.remove("is-copied");
    const label = els.copyBtn.querySelector("[data-copy-label]");
    if (label) label.textContent = "COPY";
  }

  /* ---- control wiring for method params ---- */
  function bindControls() {
    // Caesar: slider <-> number stay in sync; ROT13 preset.
    if (els.shiftRange && els.shiftNum) {
      const applyShift = (val) => {
        params.shift = clampInt(val, 0, 25);
        els.shiftRange.value = String(params.shift);
        els.shiftNum.value = String(params.shift);
        savePrefs();
        scheduleCompute();
      };
      els.shiftRange.addEventListener("input", (e) => applyShift(e.target.value));
      els.shiftNum.addEventListener("input", (e) => applyShift(e.target.value));
      if (els.rot13Btn) {
        els.rot13Btn.addEventListener("click", () => {
          applyShift(13);
          announce("Shift set to 13 (ROT13).", "info");
        });
      }
    }

    // Vigenère keyword.
    if (els.keyword) {
      els.keyword.addEventListener("input", (e) => {
        params.keyword = e.target.value.slice(0, 40);
        savePrefs();
        scheduleCompute();
      });
    }

    // Acrostic step N.
    if (els.acrosticN) {
      els.acrosticN.addEventListener("input", (e) => {
        params.n = clampInt(e.target.value, 1, 99);
        els.acrosticN.value = String(params.n);
        savePrefs();
        scheduleCompute();
      });
    }
  }

  /* ---- push persisted params into the control inputs ---- */
  function primeControls() {
    if (els.shiftRange) els.shiftRange.value = String(params.shift);
    if (els.shiftNum) els.shiftNum.value = String(params.shift);
    if (els.keyword) els.keyword.value = params.keyword;
    if (els.acrosticN) els.acrosticN.value = String(params.n);
  }

  /* ---- keyboard support for the method tablist ---- */
  function tablistKeydown(e) {
    const idx = els.tabs.findIndex((t) => t.dataset.method === method);
    if (idx < 0) return;
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % els.tabs.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + els.tabs.length) % els.tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = els.tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setMethod(els.tabs[next].dataset.method);
    els.tabs[next].focus();
  }

  /* Method labels/blurbs live here so JS owns the copy shown in
     status + the active-method description. */
  const METHOD_META = {
    caesar:   { label: "Caesar shift", blurb: "Rotate every letter forward by N places. ROT13 is its own inverse." },
    atbash:   { label: "Atbash",       blurb: "Mirror the alphabet: A↔Z, B↔Y. Encoding and decoding are the same." },
    base64:   { label: "Base64",       blurb: "Byte-for-byte encoding, UTF-8 safe — Japanese and emoji survive intact." },
    vigenere: { label: "Shinigami key", blurb: "A keyword shifts each letter in turn — a polyalphabetic (Vigenère) cipher." },
    acrostic: { label: "Hidden acrostic", blurb: "Hide a message as every Nth character — the trick spread across pages." },
  };

  /* --------------------------------------------------------
     Staged reveal on first activation (mirrors note/intro)
     -------------------------------------------------------- */
  let revealed = false;
  function reveal() {
    if (revealed || !els.section) return;
    revealed = true;
    window.requestAnimationFrame(() => els.section.classList.add("is-revealed"));
  }

  /* --------------------------------------------------------
     Boot
     -------------------------------------------------------- */
  function init() {
    const section = $('[data-section="cipher"]');
    if (!section) return;

    Object.assign(els, {
      section,
      input: $("[data-cipher-input]", section),
      output: $("[data-cipher-output]", section),
      inCount: $("[data-cipher-incount]", section),
      outCount: $("[data-cipher-outcount]", section),
      outPanel: $("[data-cipher-outpanel]", section),
      status: $("[data-cipher-status]", section),
      blurb: $("[data-cipher-blurb]", section),
      encodeBtn: $("[data-cipher-encode]", section),
      decodeBtn: $("[data-cipher-decode]", section),
      copyBtn: $("[data-cipher-copy]", section),
      swapBtn: $("[data-cipher-swap]", section),
      sampleBtn: $("[data-cipher-sample]", section),
      clearBtn: $("[data-cipher-clear]", section),
      shiftRange: $("[data-cipher-shift-range]", section),
      shiftNum: $("[data-cipher-shift-num]", section),
      rot13Btn: $("[data-cipher-rot13]", section),
      keyword: $("[data-cipher-keyword]", section),
      acrosticN: $("[data-cipher-n]", section),
    });

    if (!els.input || !els.output) return; // markup missing — bail quietly

    els.tabs = Array.from(section.querySelectorAll("[data-method]"));
    els.controlGroups = Array.from(section.querySelectorAll("[data-for]"));

    // Restore persisted method + params, then paint the controls.
    loadPrefs();
    primeControls();

    // Tabs
    els.tabs.forEach((tab) => {
      tab.addEventListener("click", () => setMethod(tab.dataset.method));
    });
    const tablist = section.querySelector("[data-cipher-tablist]");
    if (tablist) tablist.addEventListener("keydown", tablistKeydown);

    // Mode buttons
    els.encodeBtn.addEventListener("click", () => setMode("encode"));
    els.decodeBtn.addEventListener("click", () => setMode("decode"));

    // Utility actions
    if (els.copyBtn) els.copyBtn.addEventListener("click", copyOutput);
    if (els.swapBtn) els.swapBtn.addEventListener("click", swap);
    if (els.sampleBtn) els.sampleBtn.addEventListener("click", loadSample);
    if (els.clearBtn) els.clearBtn.addEventListener("click", clearAll);

    // Live recompute while typing.
    els.input.addEventListener("input", () => {
      updateCount(els.input, els.inCount);
      scheduleCompute();
    });

    bindControls();

    // Initial paint.
    syncMethodUI();
    syncModeUI();
    updateCount(els.input, els.inCount);
    updateCount(els.output, els.outCount);
    compute();

    // Reveal now if cipher is the active section on load…
    if (DN.section === "cipher") reveal();
    // …and whenever the router switches to it.
    DN.onSection((id) => { if (id === "cipher") reveal(); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
