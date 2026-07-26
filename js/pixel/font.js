/**
 * MAESTRO — Bitmap display typeface.
 *
 * A hand-authored 5x7 pixel face. Every glyph is a literal grid so that type
 * lands on exactly the same pixel lattice as the artwork; scaling is always an
 * integer multiple, so the face never blurs.
 *
 * The face is uppercase-only by design (it is a display face, not body copy).
 * Body copy uses the system sans; anything set in this face also emits an
 * accessible text node so screen readers are unaffected.
 *
 * @module pixel/font
 */

const G = (...rows) => rows;

/**
 * Glyph table. `#` = ink, `.` = paper. Exactly 5 columns x 7 rows each.
 * @type {Record<string, string[]>}
 */
export const GLYPHS = {
  'A': G('.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'),
  'B': G('####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'),
  'C': G('.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'),
  'D': G('####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'),
  'E': G('#####', '#....', '#....', '####.', '#....', '#....', '#####'),
  'F': G('#####', '#....', '#....', '####.', '#....', '#....', '#....'),
  'G': G('.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'),
  'H': G('#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'),
  'I': G('#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'),
  'J': G('..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'),
  'K': G('#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'),
  'L': G('#....', '#....', '#....', '#....', '#....', '#....', '#####'),
  'M': G('#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'),
  'N': G('#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'),
  'O': G('.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'),
  'P': G('####.', '#...#', '#...#', '####.', '#....', '#....', '#....'),
  'Q': G('.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'),
  'R': G('####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'),
  'S': G('.####', '#....', '#....', '.###.', '....#', '....#', '####.'),
  'T': G('#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'),
  'U': G('#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'),
  'V': G('#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'),
  'W': G('#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'),
  'X': G('#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'),
  'Y': G('#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'),
  'Z': G('#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'),

  '0': G('.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'),
  '1': G('..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'),
  '2': G('.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'),
  '3': G('#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'),
  '4': G('...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'),
  '5': G('#####', '#....', '####.', '....#', '....#', '#...#', '.###.'),
  '6': G('..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'),
  '7': G('#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'),
  '8': G('.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'),
  '9': G('.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'),

  ' ': G('.....', '.....', '.....', '.....', '.....', '.....', '.....'),
  '.': G('.....', '.....', '.....', '.....', '.....', '.##..', '.##..'),
  ',': G('.....', '.....', '.....', '.....', '.##..', '.##..', '.#...'),
  '!': G('..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'),
  '?': G('.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'),
  "'": G('..#..', '..#..', '.....', '.....', '.....', '.....', '.....'),
  '"': G('.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'),
  '-': G('.....', '.....', '.....', '#####', '.....', '.....', '.....'),
  '_': G('.....', '.....', '.....', '.....', '.....', '.....', '#####'),
  '+': G('.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'),
  '=': G('.....', '.....', '#####', '.....', '#####', '.....', '.....'),
  ':': G('.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'),
  ';': G('.....', '.##..', '.##..', '.....', '.##..', '.##..', '.#...'),
  '/': G('....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'),
  '\\': G('#....', '#....', '.#...', '..#..', '...#.', '....#', '....#'),
  '&': G('.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'),
  '(': G('...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'),
  ')': G('.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'),
  '[': G('..###', '..#..', '..#..', '..#..', '..#..', '..#..', '..###'),
  ']': G('###..', '..#..', '..#..', '..#..', '..#..', '..#..', '###..'),
  '<': G('...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'),
  '>': G('.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'),
  '#': G('.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'),
  '*': G('.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'),
  '%': G('##..#', '##.#.', '..#..', '.#...', '#..##', '...##', '.....'),
  '♪': G('...##', '...##', '..#.#', '..#.#', '###.#', '###..', '.#...'),
  '•': G('.....', '.....', '..#..', '.###.', '..#..', '.....', '.....'),
  '↑': G('..#..', '.###.', '#.#.#', '..#..', '..#..', '..#..', '..#..'),
  '→': G('.....', '..#..', '...#.', '#####', '...#.', '..#..', '.....'),
  '★': G('..#..', '..#..', '#####', '.###.', '#####', '#...#', '.....'),
};

export const GLYPH_W = 5;
export const GLYPH_H = 7;

/** Fallback glyph for anything not in the table. */
const TOFU = G('#####', '#...#', '#.#.#', '#.#.#', '#...#', '#...#', '#####');

/**
 * @param {string} ch
 * @returns {string[]}
 */
function glyphFor(ch) {
  return GLYPHS[ch] ?? GLYPHS[ch.toUpperCase()] ?? TOFU;
}

/**
 * @typedef {object} TextMetrics
 * @property {number} width   Width in *pixel units* (before scaling).
 * @property {number} height  Height in pixel units.
 * @property {number} lines   Line count.
 */

/**
 * Measure a string in unscaled pixel units.
 * @param {string} text
 * @param {{tracking?: number, leading?: number}} [opts]
 * @returns {TextMetrics}
 */
export function measure(text, opts = {}) {
  const tracking = opts.tracking ?? 1;
  const leading = opts.leading ?? 2;
  const lines = String(text).split('\n');
  let width = 0;
  for (const line of lines) {
    const w = line.length === 0 ? 0 : line.length * (GLYPH_W + tracking) - tracking;
    if (w > width) width = w;
  }
  return {
    width,
    height: lines.length * (GLYPH_H + leading) - leading,
    lines: lines.length,
  };
}

/**
 * Draw bitmap text onto a 2D context, one filled rect per lit pixel.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {object} o
 * @param {number} o.x            Left edge, in device px.
 * @param {number} o.y            Top edge, in device px.
 * @param {number} [o.scale=1]    Integer pixel size.
 * @param {string} [o.color]      Ink colour.
 * @param {number} [o.tracking=1] Gap between glyphs, in pixel units.
 * @param {number} [o.leading=2]  Gap between lines, in pixel units.
 * @param {number} [o.gap=0]      Shrinks each dot to expose the lattice.
 * @param {'left'|'center'|'right'} [o.align='left']
 * @param {{color:string,dx:number,dy:number}} [o.shadow]
 * @returns {{width:number,height:number}} Rendered size in device px.
 */
export function drawText(ctx, text, o) {
  const scale = Math.max(1, Math.round(o.scale ?? 1));
  const tracking = o.tracking ?? 1;
  const leading = o.leading ?? 2;
  const gap = o.gap ?? 0;
  const dot = Math.max(1, scale - gap);
  const m = measure(text, { tracking, leading });
  const lines = String(text).split('\n');

  const paint = (color, offX, offY) => {
    ctx.fillStyle = color;
    lines.forEach((line, li) => {
      const lw = line.length === 0 ? 0 : line.length * (GLYPH_W + tracking) - tracking;
      let originX = o.x + offX;
      if (o.align === 'center') originX += ((m.width - lw) * scale) / 2;
      else if (o.align === 'right') originX += (m.width - lw) * scale;
      const originY = o.y + offY + li * (GLYPH_H + leading) * scale;

      for (let ci = 0; ci < line.length; ci++) {
        const rows = glyphFor(line[ci]);
        const gx = originX + ci * (GLYPH_W + tracking) * scale;
        for (let r = 0; r < GLYPH_H; r++) {
          const row = rows[r];
          for (let c = 0; c < GLYPH_W; c++) {
            if (row[c] !== '#') continue;
            ctx.fillRect(gx + c * scale, originY + r * scale, dot, dot);
          }
        }
      }
    });
  };

  if (o.shadow) paint(o.shadow.color, o.shadow.dx, o.shadow.dy);
  paint(o.color ?? '#ece7dc', 0, 0);

  return { width: m.width * scale, height: m.height * scale };
}

/**
 * `<px-text>` — declarative bitmap type.
 *
 * Renders its `text` attribute into a canvas at device-pixel resolution and
 * mirrors the string into a visually-hidden span so the accessibility tree and
 * text search behave exactly as they would for real text.
 *
 * Attributes:
 *   text      — the string (uppercased by the face)
 *   scale     — integer pixel size (default 2)
 *   color     — CSS colour (default currentColor resolved at paint time)
 *   tracking  — glyph gap in pixel units (default 1)
 *   gap       — dot inset, for a dot-matrix look (default 0)
 *   as        — semantic role hint: h1|h2|h3|div (default div)
 */
export class PixelTextElement extends HTMLElement {
  static observedAttributes = ['text', 'scale', 'color', 'tracking', 'gap', 'leading'];

  #canvas = document.createElement('canvas');
  #label = document.createElement('span');
  #frame = 0;

  connectedCallback() {
    if (!this.#canvas.isConnected) {
      this.#canvas.setAttribute('aria-hidden', 'true');
      this.#label.className = 'sr-only';
      this.append(this.#canvas, this.#label);
    }
    this.#schedule();
  }

  attributeChangedCallback() {
    if (this.isConnected) this.#schedule();
  }

  #schedule() {
    cancelAnimationFrame(this.#frame);
    this.#frame = requestAnimationFrame(() => this.render());
  }

  render() {
    const text = (this.getAttribute('text') ?? this.textContent ?? '').toUpperCase();
    const scale = parseInt(this.getAttribute('scale') ?? '2', 10);
    const tracking = parseInt(this.getAttribute('tracking') ?? '1', 10);
    const leading = parseInt(this.getAttribute('leading') ?? '2', 10);
    const gap = parseInt(this.getAttribute('gap') ?? '0', 10);
    const color =
      this.getAttribute('color') || getComputedStyle(this).color || '#ece7dc';

    const m = measure(text, { tracking, leading });
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = Math.max(1, m.width * scale);
    const h = Math.max(1, m.height * scale);

    this.#canvas.width = Math.ceil(w * dpr);
    this.#canvas.height = Math.ceil(h * dpr);
    this.#canvas.style.width = `${w}px`;
    this.#canvas.style.height = `${h}px`;

    const ctx = this.#canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    drawText(ctx, text, { x: 0, y: 0, scale, color, tracking, leading, gap });

    this.#label.textContent = text;
  }
}

if (!customElements.get('px-text')) {
  customElements.define('px-text', PixelTextElement);
}
