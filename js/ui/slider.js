/**
 * MAESTRO — Slider.
 *
 * One control serves the seek bar and the volume fader. Pointer, keyboard and
 * touch all drive the same value pipeline, and the element exposes the full
 * `role="slider"` contract so it is operable and announced correctly without a
 * native `<input type=range>` (which cannot be styled to sit on the pixel grid).
 *
 * @module ui/slider
 */

import { h, setVar, setAttr } from '../core/dom.js';
import { clamp } from '../core/utils.js';

/**
 * @typedef {object} SliderOptions
 * @property {number} [value=0]        0..1
 * @property {string} label            Accessible name.
 * @property {(value:number)=>void} [onInput]   Fires continuously while dragging.
 * @property {(value:number)=>void} [onChange]  Fires on release / keyboard commit.
 * @property {(value:number)=>string} [format]  Value text for assistive tech.
 * @property {number} [step=0.02]
 * @property {number} [bigStep=0.1]
 * @property {boolean} [small]
 * @property {string} [class]
 */

export class Slider {
  /** @param {SliderOptions} o */
  constructor(o) {
    this.o = o;
    this.value = clamp(o.value ?? 0, 0, 1);
    this.dragging = false;

    this.fill = h('div.slider__fill');
    this.thumb = h('div.slider__thumb');
    this.marks = h('div.slider__marks');

    this.el = h('div.slider', {
      class: [o.small ? 'slider--sm' : '', o.class ?? ''].filter(Boolean).join(' '),
      role: 'slider',
      tabindex: '0',
      'aria-label': o.label,
      'aria-valuemin': '0',
      'aria-valuemax': '100',
    },
      h('div.slider__track', {}, this.fill, this.marks),
      this.thumb,
    );

    this.#bind();
    this.set(this.value, { silent: true });
  }

  /**
   * @param {number} v 0..1
   * @param {{silent?: boolean}} [opts]
   */
  set(v, opts = {}) {
    this.value = clamp(v, 0, 1);
    setVar(this.el, '--value', String(this.value));
    setAttr(this.el, 'aria-valuenow', String(Math.round(this.value * 100)));
    if (this.o.format) setAttr(this.el, 'aria-valuetext', this.o.format(this.value));
    if (!opts.silent) this.o.onInput?.(this.value);
  }

  /** Draw tick marks at the given fractions (used for movement sections). */
  setMarks(fractions) {
    this.marks.replaceChildren(
      ...fractions
        .filter((f) => f > 0.001 && f < 0.999)
        .map((f) => h('div.slider__mark', { style: { left: `${f * 100}%` } })),
    );
  }

  /** @param {boolean} disabled */
  setDisabled(disabled) {
    setAttr(this.el, 'aria-disabled', disabled ? 'true' : null);
    this.el.style.opacity = disabled ? '0.4' : '';
    this.el.style.pointerEvents = disabled ? 'none' : '';
  }

  #valueFromEvent(e) {
    const rect = this.el.getBoundingClientRect();
    if (!rect.width) return this.value;
    return clamp((e.clientX - rect.left) / rect.width, 0, 1);
  }

  #bind() {
    const el = this.el;

    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      this.dragging = true;
      el.dataset.dragging = 'true';
      this.set(this.#valueFromEvent(e));
    });

    el.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.set(this.#valueFromEvent(e));
    });

    const end = (e) => {
      if (!this.dragging) return;
      this.dragging = false;
      delete el.dataset.dragging;
      try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      this.o.onChange?.(this.value);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    el.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? (this.o.bigStep ?? 0.1) : (this.o.step ?? 0.02);
      let next = this.value;
      switch (e.key) {
        case 'ArrowRight': case 'ArrowUp': next = this.value + step; break;
        case 'ArrowLeft': case 'ArrowDown': next = this.value - step; break;
        case 'PageUp': next = this.value + (this.o.bigStep ?? 0.1); break;
        case 'PageDown': next = this.value - (this.o.bigStep ?? 0.1); break;
        case 'Home': next = 0; break;
        case 'End': next = 1; break;
        default: return;
      }
      e.preventDefault();
      e.stopPropagation();
      this.set(next);
      this.o.onChange?.(this.value);
    });
  }
}
