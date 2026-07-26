/**
 * MAESTRO — DOM layer.
 *
 * A deliberately tiny hyperscript. No virtual DOM: views are cheap to rebuild
 * and the few hot paths (player bar, progress, visualiser) mutate nodes
 * directly. This keeps the runtime dependency-free and the frame budget honest.
 *
 * @module core/dom
 */

/**
 * @typedef {Node|string|number|false|null|undefined} Child
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'path', 'g', 'circle', 'rect', 'line', 'polyline', 'polygon', 'defs', 'use', 'clipPath', 'mask', 'linearGradient', 'stop', 'text', 'tspan']);

/**
 * Create an element.
 *
 * `h('button.btn.btn--ghost', { onClick }, 'Play')`
 *
 * Props:
 *   class / className     string | string[] | Record<string, boolean>
 *   style                 string | Record<string, string|number>
 *   dataset               Record<string, string>
 *   on*                   event listener (onClick, onPointerdown, …)
 *   ref                   (el) => void
 *   html                  raw innerHTML (callers are responsible for safety)
 *   anything else         attribute, or property when it exists on the node
 *
 * @param {string} spec  tag plus optional `.class` and `#id` shorthand
 * @param {Record<string, any>|null} [props]
 * @param {...Child|Child[]} children
 * @returns {HTMLElement|SVGElement}
 */
export function h(spec, props = null, ...children) {
  const { tag, id, classes } = parseSpec(spec);
  const el = SVG_TAGS.has(tag)
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag);

  if (id) el.id = id;
  if (classes.length) el.setAttribute('class', classes.join(' '));

  if (props) applyProps(el, props);
  append(el, children);
  return /** @type {any} */ (el);
}

const specCache = new Map();
function parseSpec(spec) {
  let cached = specCache.get(spec);
  if (cached) return cached;
  const classes = [];
  let id = '';
  let tag = 'div';
  const m = spec.match(/^([a-zA-Z][\w-]*)?((?:[.#][\w-]+)*)$/);
  if (m) {
    tag = m[1] || 'div';
    const rest = m[2] || '';
    for (const token of rest.match(/[.#][\w-]+/g) ?? []) {
      if (token[0] === '.') classes.push(token.slice(1));
      else id = token.slice(1);
    }
  } else {
    tag = spec;
  }
  cached = { tag, id, classes };
  specCache.set(spec, cached);
  return cached;
}

/**
 * @param {Element} el
 * @param {Record<string, any>} props
 */
export function applyProps(el, props) {
  for (const key in props) {
    const value = props[key];
    if (value === false || value === null || value === undefined) {
      if (key !== 'class' && key !== 'className' && !key.startsWith('on')) {
        el.removeAttribute(key);
      }
      continue;
    }
    if (key === 'ref') { value(el); continue; }
    if (key === 'html') { el.innerHTML = value; continue; }
    if (key === 'class' || key === 'className') {
      const extra = classString(value);
      if (extra) el.setAttribute('class', [el.getAttribute('class'), extra].filter(Boolean).join(' '));
      continue;
    }
    if (key === 'style') {
      if (typeof value === 'string') el.setAttribute('style', value);
      else for (const p in value) {
        if (p.startsWith('--')) el.style.setProperty(p, String(value[p]));
        else el.style[p] = typeof value[p] === 'number' && !UNITLESS.has(p) ? `${value[p]}px` : value[p];
      }
      continue;
    }
    if (key === 'dataset') {
      for (const d in value) if (value[d] != null) el.dataset[d] = String(value[d]);
      continue;
    }
    if (key.startsWith('on') && key.length > 2) {
      const type = key.slice(2).toLowerCase();
      if (typeof value === 'function') el.addEventListener(type, value);
      else el.addEventListener(type, value.handler, value.options);
      continue;
    }
    if (value === true) { el.setAttribute(key, ''); continue; }
    if (key in el && !(el instanceof SVGElement) && key !== 'list' && key !== 'form') {
      try { el[key] = value; continue; } catch { /* fall through to attribute */ }
    }
    el.setAttribute(key, String(value));
  }
}

const UNITLESS = new Set(['opacity', 'zIndex', 'flex', 'flexGrow', 'flexShrink', 'order', 'lineHeight', 'fontWeight', 'zoom']);

/**
 * @param {string|string[]|Record<string, any>} value
 * @returns {string}
 */
export function classString(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.filter(Boolean).join(' ');
  return Object.keys(value).filter((k) => value[k]).join(' ');
}

/**
 * Append children, flattening arrays and skipping falsy values.
 * @param {Node} parent
 * @param {any} children
 */
export function append(parent, children) {
  if (children == null || children === false) return;
  if (Array.isArray(children)) { for (const c of children) append(parent, c); return; }
  parent.appendChild(children instanceof Node ? children : document.createTextNode(String(children)));
}

/** Remove every child of a node. */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/**
 * Replace a node's children in one shot. Accepts any number of children,
 * flattening arrays and skipping falsy values, exactly like `h`.
 *
 * @param {Element} node
 * @param {...Child|Child[]} children
 */
export function render(node, ...children) {
  clear(node);
  append(node, children);
  return node;
}

/** @type {(sel: string, root?: ParentNode) => HTMLElement|null} */
export const $ = (sel, root = document) => root.querySelector(sel);
/** @type {(sel: string, root?: ParentNode) => HTMLElement[]} */
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/**
 * Add a listener and return a disposer.
 * @param {EventTarget} target @param {string} type
 * @param {EventListenerOrEventListenerObject} handler
 * @param {AddEventListenerOptions|boolean} [options]
 * @returns {() => void}
 */
export function on(target, type, handler, options) {
  target.addEventListener(type, handler, options);
  return () => target.removeEventListener(type, handler, options);
}

/**
 * Event delegation.
 * @param {Element} root @param {string} type @param {string} selector
 * @param {(e: Event, matched: Element) => void} handler
 * @returns {() => void}
 */
export function delegate(root, type, selector, handler) {
  return on(root, type, (e) => {
    const target = /** @type {Element} */ (e.target);
    const matched = target?.closest?.(selector);
    if (matched && root.contains(matched)) handler(e, matched);
  });
}

/**
 * Toggle classes from a map.
 * @param {Element} el @param {Record<string, boolean>} map
 */
export function setClasses(el, map) {
  for (const key in map) el.classList.toggle(key, !!map[key]);
}

/**
 * Set text only when it changed — avoids needless layout on hot paths.
 * @param {Element} el @param {string} text
 */
export function setText(el, text) {
  const s = String(text);
  if (el.textContent !== s) el.textContent = s;
}

/**
 * Set an attribute only when it changed.
 * @param {Element} el @param {string} name @param {string|number|null} value
 */
export function setAttr(el, name, value) {
  if (value === null || value === false) {
    if (el.hasAttribute(name)) el.removeAttribute(name);
    return;
  }
  const s = String(value);
  if (el.getAttribute(name) !== s) el.setAttribute(name, s);
}

/**
 * Set a custom property only when it changed.
 * @param {HTMLElement} el @param {string} name @param {string} value
 */
export function setVar(el, name, value) {
  if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value);
}

/**
 * A `<px-text>` element, as a function.
 * @param {string} text
 * @param {{scale?:number, color?:string, tracking?:number, weight?:number, square?:boolean, class?:string}} [o]
 */
export function pxText(text, o = {}) {
  return h('px-text', {
    text,
    scale: o.scale ?? 3,
    tracking: o.tracking ?? 1.2,
    ...(o.weight !== undefined ? { weight: o.weight } : {}),
    ...(o.square ? { square: true } : {}),
    ...(o.color ? { color: o.color } : {}),
    ...(o.class ? { class: o.class } : {}),
  });
}

/**
 * Focus trap for modal surfaces.
 * @param {HTMLElement} container
 * @returns {() => void} release
 */
export function trapFocus(container) {
  const previous = /** @type {HTMLElement|null} */ (document.activeElement);
  const selector = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
  const handler = (e) => {
    if (e.key !== 'Tab') return;
    const items = $$(selector, container).filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  container.addEventListener('keydown', handler);
  return () => {
    container.removeEventListener('keydown', handler);
    previous?.focus?.();
  };
}
