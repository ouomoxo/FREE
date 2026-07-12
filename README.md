# DEATH NOTE ─ 死神の手帳

*The Shinigami's Notebook* — a dark, cinematic, single-page interactive
experience themed around the anime/manga **Death Note**.

A fan tribute built as a polished web product: atmospheric, gothic, and
completely **dependency-FREE**.

---

## Run it

No build step. No server required. No dependencies.

> **Open `index.html` in any modern browser.**

That's it. It also works fully offline — nothing is ever fetched over the network.

---

## Tech

- **Zero dependencies** — pure HTML, CSS, and vanilla JavaScript.
- No frameworks, no libraries, no CDN, no build tooling, and **zero external
  requests** of any kind (fonts, images, favicon are all inline / system-provided).
- Single-page application: sections are swapped in-place by a small JS router
  with smooth cinematic crossfades, deep-linking (`#hash`), and back/forward
  support.
- Accessible and responsive down to ~360px; respects `prefers-reduced-motion`.
- Your data never leaves the browser — the Note's ledger and the Cipher's
  preferences are stored only in `localStorage`.

---

## Structure

```
FREE/
├─ index.html         Single page: nav shell + all five sections
├─ css/
│  ├─ reset.css       Minimal modern CSS reset
│  ├─ theme.css       Design system — the single source of truth (tokens)
│  ├─ layout.css      App shell: fixed sidebar / mobile drawer, section grid
│  ├─ intro.css       Intro (landing) styles
│  ├─ note.css        The Note (interactive notebook) styles
│  ├─ rules.css       Rules (typeset codex) styles
│  ├─ cipher.css      Cipher (cryptographer's desk) styles
│  └─ about.css       About (colophon) styles
├─ js/
│  ├─ app.js          Bootstrap + section router (global `DN`)
│  ├─ intro.js        Intro: apple SVG, ambient particles, staged reveal
│  ├─ note.js         The Note: inscription ceremony + persistent ledger
│  ├─ rules.js        Rules: staged reveal on first activation
│  ├─ cipher.js       Cipher: reversible cipher core + UI
│  └─ about.js        About: staged reveal
├─ partials/          Section inner-HTML sources (authoring reference)
├─ assets/            Reserved for future inline/local assets
└─ README.md          You are here
```

---

## Sections

1. **Intro** — 序 · cinematic landing with ambient motes and a shinigami's apple.
2. **The Note** — 手帳 · an interactive notebook. Write a name (you must picture
   the face), optionally set a cause and details, and watch the lore-accurate
   inscription ceremony — the 40-second and 6:40 windows — seal it into a
   **persistent ledger** stored in your browser.
3. **Rules** — 規則 · the fourteen rules of the Death Note, typeset as an
   illuminated codex.
4. **Cipher** — 暗号 · a working encode/decode workbench: Caesar shift, Atbash,
   Base64 (UTF-8 safe), a Shinigami-keyword Vigenère, and a hidden acrostic.
   Every method is exact and reversible.
5. **About** — 奥付 · credits & colophon.

> **This is interactive fiction.** The notebook, its rules, and the ledger are
> invention. No real person is named, targeted, or harmed — nothing written
> here reaches beyond the screen.

---

## Design system (quick reference)

Everything visual is driven by CSS custom properties in **`css/theme.css`** —
edit tokens there, never hard-code values elsewhere.

- **Palette:** near-black voids (`#08080a` / `#0a0a0b`), bone/parchment text
  (`#e8e6e0`), a single blood-crimson accent (`#b3121b` / `#d4232d`), and
  sparing gothic gold (`#b8963e`).
- **Type:** system stacks only — gothic serif (Georgia) for display, system
  sans for UI, on a ~1.25 modular scale.
- **Motion:** cinematic cubic-bezier easing tokens; all motion is gated behind
  `prefers-reduced-motion`.

### JavaScript API (`window.DN`)

- `DN.go(sectionId)` — navigate to a section (`"intro" | "note" | "rules" | "cipher" | "about"`).
- `DN.onSection(fn)` — subscribe to section changes: `fn(currentId, prevId)`.
- `DN.section` — the active section id.
- `DN.nav.open() | .close() | .toggle()` — mobile drawer controls.
- `DN.util` — small helpers: `$`, `$$`, `clamp`, `lerp`, `rand`, `reducedMotion`.

---

## Credits

Fan project. Death Note © Tsugumi Ohba / Takeshi Obata / Shueisha.
This is a non-commercial tribute, not affiliated with or endorsed by the
rights holders.
