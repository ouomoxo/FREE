/**
 * MAESTRO — Prelude.
 *
 * The front of the house. Not a landing page for a product: a piece, in thirteen
 * short movements, made of the two things the whole project is built from — a
 * point and a line.
 *
 * One population of a few thousand points carries the entire sequence. It
 * arrives as a conductor's hands, is drawn out into a harmonic curve, and then
 * becomes each of the plates in turn — a child answering himself in a mirror,
 * two animals cheek to cheek, a held look, a figure alone with a lamp, a face
 * under water, a fish that is nothing but a line, a flower that opens at
 * night, three blooms in a fist, two people running through weather, and the
 * hands again — the same points travelling from one picture to the next
 * without anything ever fading. At the end it lets you in.
 *
 * The hall itself, with its catalogue and its transport, is behind the last
 * door. Nothing sounds here.
 *
 * @module views/prelude
 */

import { h, render, pxText, setAttr, setVar } from '../core/dom.js';
import { icon } from '../ui/icons.js';
import { PointField, sampleImage } from '../art/points.js';
import { HarmonicCurves, INTERVALS } from '../art/curves.js';
import { loadImage } from '../pixel/halftone.js';
import { revealText } from '../pixel/font.js';
import { clamp, damp, prefersReducedMotion, debounce } from '../core/utils.js';

const plate = (name) => new URL(`../../assets/plates/${name}`, import.meta.url).href;
const reference = (name) => new URL(`../../assets/reference/${name}`, import.meta.url).href;

/**
 * The movements.
 *
 * `src` is the plate the points form; `null` leaves them loose. `side` is which
 * half of the frame the picture stands in — the writing takes the other half,
 * so the two never sit on top of one another. On a narrow screen the plate
 * drops to the lower two-thirds and the writing rides above it instead.
 *
 * @type {Array<{
 *   numeral: string, title: string, line: string, src: string|null,
 *   side?: 'left'|'right', fit?: number, fitW?: number, cy?: number,
 *   zoom?: number, offsetX?: number, offsetY?: number, floor?: number,
 *   curves?: number, mode?: 'tone'|'shadow'|'edge'|'relief', gamma?: number,
 * }>}
 */
const MOVEMENTS = [
  {
    numeral: 'I',
    title: 'MAESTRO',
    line: 'A hall made of points and lines. Nothing here is a photograph, a '
        + 'recording, or a file — only marks on a dark ground, and the intervals '
        + 'between them.',
    src: reference('conductor-a.jpg'),
    side: 'left',
    fit: 0.78,
    fitW: 0.42,
    floor: 0.1,
    gamma: 0.88,
    curves: 0.12,
  },
  {
    numeral: 'II',
    title: 'THE INTERVAL',
    line: 'Two tones, plotted against one another, draw a closed figure when '
        + 'their frequencies stand in a simple ratio. This is not an ornament. '
        + 'It is the shape of a fifth.',
    src: null,
    curves: 1,
  },
  {
    numeral: 'III',
    title: 'THE ANSWER',
    line: 'A fugue begins alone. Then the same phrase returns, a fifth higher, '
        + 'in another voice — not a reply but the subject looking back at '
        + 'itself, and refusing to be one thing.',
    src: plate('mirror.jpg'),
    mode: 'shadow',
    side: 'right',
    fit: 0.8,
    fitW: 0.4,
    floor: 0.42,
    curves: 0.18,
  },
  {
    numeral: 'IV',
    title: 'THE DUET',
    line: 'Consonance is not sameness. Two voices hold their distance and agree '
        + 'anyway — which is the whole of counterpoint, and most of everything else.',
    src: plate('cats.jpg'),
    // One animal lit and one in shadow, cheek to cheek. The pale one arrives
    // as a mass, the dark one as almost nothing — and a single gold eye. That
    // asymmetry is the movement, so nothing is done to even it out.
    mode: 'relief',
    side: 'left',
    fit: 0.7,
    fitW: 0.44,
    floor: 0.2,
    curves: 0.14,
  },
  {
    numeral: 'V',
    title: 'THE GAZE',
    line: 'A held note and a held look are the same refusal: to move on, to '
        + 'resolve, to let the moment finish. Everything a piece means happens '
        + 'while nothing is happening.',
    src: plate('gaze.jpg'),
    // Brows, lashes, and one strand of hair fallen across the frame: the whole
    // picture is its dark marks, so those are what the points are given.
    mode: 'shadow',
    side: 'right',
    fit: 0.54,
    fitW: 0.46,
    floor: 0.42,
    curves: 0.1,
  },
  {
    numeral: 'VI',
    title: 'ALONE',
    line: 'Almost all of this music was written for one person in a dark room. '
        + 'A single lamp, a turned back, and something being listened to very '
        + 'closely.',
    src: plate('solitude.jpg'),
    side: 'left',
    fit: 0.72,
    fitW: 0.42,
    // Low enough to keep the drapes, so the lamp has a room to stand in and
    // the figure is a hole cut out of the light.
    floor: 0.11,
    gamma: 0.86,
    curves: 0.08,
  },
  {
    numeral: 'VII',
    title: 'THE SURFACE',
    line: 'Sound reaches a submerged ear late, and with the top taken off it. '
        + 'Most listening is done from under something.',
    src: plate('surface.jpg'),
    mode: 'shadow',
    side: 'right',
    fit: 0.76,
    fitW: 0.4,
    floor: 0.4,
    curves: 0.1,
  },
  {
    numeral: 'VIII',
    title: 'THE LINE',
    line: 'One voice, unaccompanied, moving through something that resists it '
        + 'exactly enough to make the movement visible. A melody is not a shape. '
        + 'It is a shape being drawn.',
    src: plate('line.jpg'),
    mode: 'shadow',
    side: 'left',
    fit: 0.82,
    fitW: 0.44,
    floor: 0.34,
    curves: 0.16,
  },
  {
    numeral: 'IX',
    title: 'THE BLOOM',
    line: 'A night-flowering cereus opens once, after dark, for a few hours. '
        + 'Nobody is required to be there. It opens anyway.',
    src: plate('bloom.jpg'),
    side: 'right',
    fit: 0.68,
    fitW: 0.42,
    floor: 0.2,
    gamma: 0.9,
    curves: 0.12,
  },
  {
    numeral: 'X',
    title: 'THE OFFERING',
    line: 'Three white flowers held against a black coat. The quietest movement '
        + 'in any programme is the one where almost nothing is played, and '
        + 'everyone leans in.',
    src: plate('flowers.jpg'),
    // Almost the whole frame is coat. What survives the floor is a hand and
    // three blooms — a fraction of the points the other plates use, and the
    // sparseness is the point.
    side: 'left',
    fit: 0.72,
    fitW: 0.42,
    floor: 0.3,
    curves: 0.14,
  },
  {
    numeral: 'XI',
    title: 'THE RAIN',
    line: 'Two people running through weather, holding on, going somewhere they '
        + 'have not explained. Every piece of music is finally about this and '
        + 'pretends to be about something else.',
    src: plate('rain.jpg'),
    // Cropped hard into the two of them. At full frame the trees win, and the
    // trees are not what the movement is about.
    mode: 'shadow',
    side: 'right',
    fit: 0.78,
    fitW: 0.44,
    zoom: 1.9,
    offsetX: -0.1,
    offsetY: -0.06,
    floor: 0.56,
    curves: 0.12,
  },
  {
    numeral: 'XII',
    title: 'THE HANDS',
    line: 'Painted, not photographed: someone else looking at the same subject '
        + 'and finding the same answer. Light on a hand, and everything around '
        + 'it given away.',
    src: plate('hands.jpg'),
    side: 'left',
    fit: 0.74,
    fitW: 0.42,
    floor: 0.22,
    gamma: 0.9,
    curves: 0.16,
  },
  {
    numeral: 'XIII',
    title: 'THE HALL',
    line: 'Beyond this, a repertoire that does not exist: nine ensembles, twenty '
        + 'records, a hundred and five movements, every note composed and '
        + 'synthesised at the moment you ask for it.',
    src: reference('conductor-b.jpg'),
    // Cropped in, so the hands fill the plate. At full frame most of the
    // photograph is black and most of the field would have nothing to do.
    side: 'right',
    fit: 0.86,
    fitW: 0.44,
    zoom: 1.32,
    offsetY: -0.02,
    floor: 0.08,
    gamma: 0.86,
    curves: 0.2,
  },
];

/** Points in the field. Enough to hold a picture; few enough to stay a field. */
const POINTS = 5200;

export class Prelude {
  /** @type {HTMLElement|null} */ #root = null;
  /** @type {HTMLCanvasElement|null} */ #canvas = null;
  /** @type {CanvasRenderingContext2D|null} */ #ctx = null;
  /** @type {HTMLElement|null} */ #flow = null;

  #field = new PointField({ count: POINTS, seed: 'prelude' });
  #curves = new HarmonicCurves({ lines: 3 });
  /** @type {Array<import('../art/points.js').Constellation|null>} */ #plates = [];
  /** @type {HTMLImageElement[]} */ #images = [];

  #raf = 0;
  #running = false;
  #last = 0;
  #t = 0;
  #dpr = 1;

  #act = -1;
  #progress = 0;
  #hold = 0;
  #curveAmount = 0;
  /** Where the figure is drawn — it follows the plate across the frame. */
  #curveCx = 0.5;
  /** 1 the instant a picture is called for, decaying to 0 as it arrives. */
  #transit = 0;
  #mounted = false;

  /** @type {HTMLElement[]} */ #movementEls = [];
  /** @type {HTMLElement[]} */ #ticks = [];
  /** @type {HTMLElement|null} */ #intervalLabel = null;

  /* ---------------------------------------------------------------- */

  /** @param {HTMLElement} root */
  mount(root) {
    if (this.#mounted) { this.show(); return; }
    this.#mounted = true;
    this.#root = root;
    this.#build();
    this.#loadPlates();
    this.show();
  }

  show() {
    if (!this.#root) return;
    this.#root.hidden = false;
    this.#root.setAttribute('aria-hidden', 'false');
    this.#start();
    requestAnimationFrame(() => { this.#resize(); this.#onScroll(); });
  }

  hide() {
    if (!this.#root) return;
    this.#stop();
    this.#root.hidden = true;
    this.#root.setAttribute('aria-hidden', 'true');
  }

  /* --- Structure ---------------------------------------------------- */

  #build() {
    const root = this.#root;
    this.#canvas = h('canvas.prelude__stage', { 'aria-hidden': 'true' });
    this.#ctx = this.#canvas.getContext('2d', { alpha: false });

    this.#intervalLabel = h('div.prelude__interval.t-mono', {}, '');

    this.#movementEls = MOVEMENTS.map((m, i) => {
      const title = pxText(m.title, { scale: i === 0 ? 6 : 4.4, tracking: 1.4 });
      // The writing stands opposite the picture.
      const align = m.side === 'left' ? 'right' : m.side === 'right' ? 'left' : 'center';
      const el = h('section.movement', { 'data-index': String(i), 'data-align': align },
        h('div.movement__inner', {},
          h('div.movement__numeral.t-mono', {}, m.numeral),
          h('div.movement__title', {}, title),
          h('p.movement__line', {}, m.line),
          i === MOVEMENTS.length - 1
            ? h('a.prelude__enter', { href: '#/hall' },
                h('span', {}, 'ENTER THE HALL'),
                icon('chevronRight', { size: 13 }))
            : null,
        ),
      );
      el._title = title;
      return el;
    });

    this.#ticks = MOVEMENTS.map((m, i) =>
      h('button.prelude__tick', {
        type: 'button',
        'aria-label': `Movement ${m.numeral} — ${m.title}`,
        onClick: () => this.#scrollToAct(i),
      }));

    this.#flow = h('div.prelude__flow.scroll', { onScroll: () => this.#onScroll() },
      ...this.#movementEls,
    );

    render(root,
      this.#canvas,
      h('div.prelude__grain', { 'aria-hidden': 'true' }),
      this.#flow,
      h('div.prelude__rail', { 'aria-hidden': 'true' }, ...this.#ticks),
      this.#intervalLabel,
      h('div.prelude__corner', {},
        h('div.prelude__mark', {}, pxText('MAESTRO', { scale: 2.2, tracking: 1.4 })),
        h('a.prelude__skip', { href: '#/hall' }, 'SKIP TO THE HALL'),
      ),
      h('div.prelude__hint', { 'aria-hidden': 'true' },
        h('span', {}, 'SCROLL'),
        h('i', {}),
      ),
    );

    this.#onResize = debounce(() => { this.#resize(); this.#rebuildPlates(); }, 220);
    window.addEventListener('resize', this.#onResize);
  }

  /** @type {(() => void)|null} */ #onResize = null;

  /* --- Plates ------------------------------------------------------- */

  async #loadPlates() {
    this.#plates = MOVEMENTS.map(() => null);
    await Promise.all(MOVEMENTS.map(async (m, i) => {
      if (!m.src) return;
      try {
        const img = await loadImage(m.src);
        this.#images[i] = img;
        this.#plates[i] = this.#sample(i);
        // If we are already standing on this movement, take it now.
        if (this.#act === i) this.#field.setTargets(this.#plates[i]);
      } catch (err) {
        console.warn('[prelude] plate failed', m.src, err);
      }
    }));
  }

  /** @param {number} i */
  #sample(i) {
    const img = this.#images[i];
    if (!img || !this.#canvas) return null;
    const m = MOVEMENTS[i];
    const aspect = (this.#canvas.width || 1) / (this.#canvas.height || 1);
    const narrow = window.innerWidth < 900;

    // Wide: the plate takes one half and the writing the other. Narrow: the
    // plate sinks to the bottom of the frame and the writing rides above it.
    const cx = narrow || !m.side ? 0.5 : (m.side === 'left' ? 0.31 : 0.69);
    const cy = narrow ? 0.7 : (m.cy ?? 0.5);
    const fit = narrow ? 0.44 : (m.fit ?? 0.7);
    const fitW = narrow ? 0.78 : (m.fitW ?? 0.42);

    return sampleImage(img, {
      count: POINTS,
      aspect,
      // The lattice is a little finer on a wide screen, where the plate has the
      // room to carry the extra resolution.
      pitch: clamp(0.0052 * (1400 / Math.max(600, window.innerWidth)), 0.0036, 0.0092),
      floor: m.floor ?? 0.2,
      mode: m.mode ?? 'tone',
      gamma: m.gamma ?? 1,
      fit,
      fitW,
      cx,
      cy,
      zoom: m.zoom ?? 1,
      offsetX: m.offsetX ?? 0,
      offsetY: m.offsetY ?? 0,
      seed: `plate:${i}`,
    });
  }

  #rebuildPlates() {
    for (let i = 0; i < MOVEMENTS.length; i++) {
      if (this.#images[i]) this.#plates[i] = this.#sample(i);
    }
    if (this.#act >= 0) this.#field.setTargets(this.#plates[this.#act] ?? null);
  }

  /* --- Scroll ------------------------------------------------------- */

  #scrollToAct(i) {
    const el = this.#movementEls[i];
    el?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  #onScroll() {
    const flow = this.#flow;
    if (!flow) return;
    const max = flow.scrollHeight - flow.clientHeight;
    const p = max > 0 ? clamp(flow.scrollTop / max, 0, 1) : 0;
    this.#progress = p;

    // Which movement is on stage. The act changes at the point where its panel
    // reaches the middle of the frame.
    const mid = flow.scrollTop + flow.clientHeight * 0.5;
    let act = 0;
    for (let i = 0; i < this.#movementEls.length; i++) {
      if (this.#movementEls[i].offsetTop <= mid) act = i;
    }
    if (act !== this.#act) this.#enterAct(act);

    // Each panel resolves as it arrives and recedes as it leaves.
    for (const el of this.#movementEls) {
      const centre = el.offsetTop + el.offsetHeight / 2;
      const d = (centre - mid) / flow.clientHeight;      // -1 .. 1
      const near = clamp(1 - Math.abs(d) * 1.9, 0, 1);
      setVar(el, '--near', near.toFixed(3));
      setVar(el, '--drift', `${(d * 34).toFixed(1)}px`);
    }

    this.#ticks.forEach((tick, i) => setAttr(tick, 'data-on', String(i === this.#act)));
    setAttr(this.#root, 'data-first', String(this.#act === 0));
  }

  /** @param {number} i */
  #enterAct(i) {
    this.#act = i;
    const m = MOVEMENTS[i];

    this.#field.setTargets(this.#plates[i] ?? null);

    // The gesture. Every point is turned about the centre before it is allowed
    // to travel, and the direction alternates with the movements, so the piece
    // beats one way and then the other. Downward through the piece, the field
    // is also drawn slightly in — a breath taken before the phrase.
    if (!prefersReducedMotion()) {
      this.#field.impulse(i % 2 ? -0.42 : 0.42, -0.16);
      this.#transit = 1;
    }

    // The interval advances with the movements, so the curve is never the same
    // shape twice in a row.
    const spec = this.#curves.setInterval(i + 2);
    if (this.#intervalLabel) {
      this.#intervalLabel.textContent = m.curves
        ? `${spec.ratio[0]}:${spec.ratio[1]}  ·  ${spec.name}`
        : '';
    }

    const el = this.#movementEls[i];
    if (el?._title && !prefersReducedMotion()) {
      revealText(el._title, { duration: 1400 });
    }
  }

  /* --- Frame -------------------------------------------------------- */

  #start() {
    if (this.#running) return;
    this.#running = true;
    this.#last = performance.now();
    this.#raf = requestAnimationFrame(this.#frame);
  }

  #stop() {
    this.#running = false;
    cancelAnimationFrame(this.#raf);
  }

  #resize() {
    const canvas = this.#canvas;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    // The field is thousands of arcs a frame; 1.5x is plenty and keeps a
    // laptop's fan quiet.
    this.#dpr = Math.min(1.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * this.#dpr);
    canvas.height = Math.round(r.height * this.#dpr);
  }

  #frame = (now) => {
    if (!this.#running) return;
    const dt = Math.min(0.05, (now - this.#last) / 1000);
    this.#last = now;
    this.#t += dt;
    try { this.#update(dt); this.#draw(); }
    catch (err) { console.error('[prelude] frame failed', err); this.#stop(); }
    this.#raf = requestAnimationFrame(this.#frame);
  };

  #update(dt) {
    const m = MOVEMENTS[Math.max(0, this.#act)];
    const hasPlate = !!this.#plates[Math.max(0, this.#act)];

    // Points are held tightly only while a picture is on stage.
    this.#hold = damp(this.#hold, hasPlate ? 1 : 0, 0.5, dt);
    this.#curveAmount = damp(this.#curveAmount, m?.curves ?? 0, 0.6, dt);
    // Snapped off at the tail so a settled picture is drawn on a clean ground
    // rather than on a faint smear of where it used to be.
    this.#transit = damp(this.#transit, 0, 0.85, dt);
    if (this.#transit < 0.05) this.#transit = 0;

    const narrow = window.innerWidth < 900;
    const target = narrow || !m?.side ? 0.5 : (m.side === 'left' ? 0.31 : 0.69);
    this.#curveCx = damp(this.#curveCx, target, 0.7, dt);

    this.#field.update(dt, this.#t, {
      hold: this.#hold,
      turbulence: 1 - this.#hold * 0.7,
    });
    this.#curves.update(dt, { reveal: this.#curveAmount > 0.05 ? 1 : 0 });
  }

  #draw() {
    const ctx = this.#ctx;
    const canvas = this.#canvas;
    if (!ctx || !canvas || !canvas.width) return;
    const W = canvas.width;
    const H = canvas.height;

    // The ground is not wiped while the field is travelling — it is washed,
    // so every point leaves the trace of its own path behind it. For those two
    // seconds the picture is made of lines; when it arrives, the wash goes back
    // to opaque and the lines close up into points again. Nothing in this piece
    // is more literally its subject than that.
    const wash = 1 - 0.93 * clamp(this.#transit, 0, 1);
    ctx.fillStyle = `rgba(5, 5, 6, ${wash.toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);

    // A held picture is never quite still: it turns by a fraction of a degree
    // and breathes by a fraction of a percent, on two periods that do not
    // divide into one another.
    const breath = prefersReducedMotion() ? 0 : this.#hold * (1 - this.#transit);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(Math.sin(this.#t * 0.063) * 0.005 * breath);
    ctx.scale(1 + Math.sin(this.#t * 0.041) * 0.004 * breath,
              1 + Math.sin(this.#t * 0.041) * 0.004 * breath);
    ctx.translate(-W / 2, -H / 2);

    // The curve sits behind the points, and only when a movement calls for it.
    this.#curves.draw(ctx, W, H, {
      cx: this.#curveCx,
      cy: 0.5,
      radius: 0.3,
      opacity: this.#curveAmount,
      dpr: this.#dpr,
    });

    this.#field.draw(ctx, W, H, {
      ink: '#ece7dc',
      accent: 'rgba(217,185,120,0.9)',
      scale: this.#dpr,
      opacity: 1,
      minR: 0.5,
      maxR: 1.5 + this.#hold * 0.5,
    });
    ctx.restore();
  }

  destroy() {
    this.#stop();
    if (this.#onResize) window.removeEventListener('resize', this.#onResize);
    this.#mounted = false;
  }
}

export const prelude = new Prelude();
