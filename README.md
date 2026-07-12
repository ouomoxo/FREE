# DEATH NOTE ─ 死神の手帳

*The Shinigami's Notebook* — a dark, cinematic, single-page interactive
experience themed around the anime/manga **Death Note**.

A fan tribute built as a polished web product: atmospheric, gothic, and
completely **dependency-FREE**.

---

## Run it

No build step. No server required. No dependencies.

> **Open `index.html` in any modern browser.**

That's it.

---

## Tech

- **Zero dependencies** — pure HTML, CSS, and vanilla JavaScript.
- No frameworks, no libraries, no CDN, no build tooling, no external requests
  of any kind (fonts, images, and the favicon are all inline / system-provided).
- Single-page application: sections are swapped in-place by a small JS router
  with smooth cinematic crossfades, deep-linking (`#hash`), and back/forward
  support.
- Accessible and responsive down to ~360px; respects `prefers-reduced-motion`.

---

## Structure

```
FREE/
├─ index.html         Single page: nav shell + all section containers
├─ css/
│  ├─ reset.css       Minimal modern CSS reset
│  ├─ theme.css       Design system — the single source of truth (tokens)
│  ├─ layout.css      App shell: fixed sidebar / mobile drawer, main area
│  └─ intro.css       Intro (landing) section styles
├─ js/
│  ├─ app.js          Bootstrap + section router (global `DN`)
│  └─ intro.js        Intro behaviour: apple SVG, ambient particles, reveal
├─ assets/            Reserved for future inline/local assets
└─ README.md          You are here
```

---

## Sections

1. **Intro** — 序 · cinematic landing *(built)*
2. **The Note** — 手帳 · interactive notebook *(coming soon)*
3. **Rules** — 規則 · the rules of the Death Note *(coming soon)*
4. **Cipher** — 暗号 · encode / decode tool *(coming soon)*
5. **About** — 奥付 · credits & colophon *(coming soon)*

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
This is a non-commercial tribute.

*Colophon and full credits: see the **About** section (coming soon).*
