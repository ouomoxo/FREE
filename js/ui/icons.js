/**
 * MAESTRO — Icon set.
 *
 * Fine geometric line work on a 24-unit grid. The stroke width is compensated
 * for the rendered size, so every icon lands at the same hairline weight
 * whether it is drawn at 11px or 22px — the same restraint the rest of the
 * interface keeps, and the right companion to a face made of small dots.
 *
 * A few icons are solid (the transport triangles, the filled heart); those are
 * marked `filled` and drawn without a stroke.
 *
 * @module ui/icons
 */

const GRID = 24;

/**
 * @typedef {{d: string, filled?: boolean, cap?: 'round'|'butt'}} IconSpec
 */

/** @type {Record<string, IconSpec>} */
export const ICONS = {
  /* --- Navigation ------------------------------------------------------- */
  home: { d: 'M3.5 10.8 12 4l8.5 6.8M6 9.6V20h12V9.6M9.8 20v-5.6h4.4V20' },
  search: { d: 'M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13ZM15.4 15.4 20.5 20.5' },
  library: { d: 'M4.5 4.5v15M9.5 4.5v15M14.6 5l4.4 14.3' },
  concert: { d: 'M3.5 20.5h17M6.5 20.5v-4.5M10.2 20.5V9.5M13.8 20.5v-7.5M17.5 20.5v-3' },

  /* --- Transport --------------------------------------------------------- */
  play: { d: 'M8 5.2 18.6 12 8 18.8Z', filled: true },
  pause: { d: 'M8.6 5h2.6v14H8.6zM12.8 5h2.6v14h-2.6z', filled: true },
  next: { d: 'M6 5.6 14.6 12 6 18.4ZM16.6 5.2h1.9v13.6h-1.9z', filled: true },
  prev: { d: 'M18 5.6 9.4 12 18 18.4ZM5.5 5.2h1.9v13.6H5.5z', filled: true },
  stop: { d: 'M6 6h12v12H6z', filled: true },

  shuffle: {
    d: 'M3 7h3.2l3 3.6M3 17h3.2L16.5 5.2h3.4M13.5 13.4 16.5 17h3.4'
     + 'M17.8 3.4 20.4 5.2 17.8 7M17.8 15.2 20.4 17 17.8 18.8',
  },
  repeat: {
    d: 'M7.5 5.5h9a4 4 0 0 1 4 4v1.2M16.5 18.5h-9a4 4 0 0 1-4-4v-1.2'
     + 'M5.4 3.6 7.6 5.5 5.4 7.4M18.6 16.6l-2.2 1.9 2.2 1.9',
  },
  repeatOne: {
    d: 'M7.5 5.5h9a4 4 0 0 1 4 4v1.2M16.5 18.5h-9a4 4 0 0 1-4-4v-1.2'
     + 'M5.4 3.6 7.6 5.5 5.4 7.4M18.6 16.6l-2.2 1.9 2.2 1.9'
     + 'M11 10.6l1.4-.9V14M10.6 14h3.4',
  },

  /* --- Volume ------------------------------------------------------------ */
  volumeHigh: { d: 'M4 9.3h3.2L11.6 5v14L7.2 14.7H4ZM15 9.4a4 4 0 0 1 0 5.2M17.9 7a7.6 7.6 0 0 1 0 10' },
  volumeLow: { d: 'M4 9.3h3.2L11.6 5v14L7.2 14.7H4ZM15 9.4a4 4 0 0 1 0 5.2' },
  volumeMute: { d: 'M4 9.3h3.2L11.6 5v14L7.2 14.7H4ZM15.4 9.6 20.4 14.6M20.4 9.6 15.4 14.6' },

  /* --- Actions ----------------------------------------------------------- */
  heart: { d: 'M12 19.6C5.9 15 3.4 11.6 3.4 8.9A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8.6 1.7c0 2.7-2.5 6.1-8.6 10.7Z' },
  heartFull: { d: 'M12 19.6C5.9 15 3.4 11.6 3.4 8.9A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8.6 1.7c0 2.7-2.5 6.1-8.6 10.7Z', filled: true },
  plus: { d: 'M12 4.6v14.8M4.6 12h14.8' },
  check: { d: 'M4.8 12.4 9.8 17.4 19.2 6.6' },
  close: { d: 'M5.8 5.8 18.2 18.2M18.2 5.8 5.8 18.2' },
  more: { d: 'M4.6 12a1.4 1.4 0 1 0 2.8 0 1.4 1.4 0 0 0-2.8 0ZM10.6 12a1.4 1.4 0 1 0 2.8 0 1.4 1.4 0 0 0-2.8 0ZM16.6 12a1.4 1.4 0 1 0 2.8 0 1.4 1.4 0 0 0-2.8 0Z', filled: true },
  queue: { d: 'M3.5 6.5h11M3.5 11.5h11M3.5 16.5h6.5M17.5 17.6V6l3.5-1v11M15.2 20a2.3 2.3 0 1 0 4.6 0 2.3 2.3 0 0 0-4.6 0Z' },
  clock: { d: 'M12 3.8a8.2 8.2 0 1 1 0 16.4 8.2 8.2 0 0 1 0-16.4ZM12 7.4V12l3.4 2' },

  chevronLeft: { d: 'M15 4.8 7.8 12 15 19.2' },
  chevronRight: { d: 'M9 4.8 16.2 12 9 19.2' },
  chevronUp: { d: 'M4.8 15 12 7.8 19.2 15' },
  chevronDown: { d: 'M4.8 9 12 16.2 19.2 9' },

  expand: { d: 'M3.5 9V3.5H9M15 3.5h5.5V9M20.5 15v5.5H15M9 20.5H3.5V15' },
  collapse: { d: 'M9 3.5V9H3.5M15 3.5V9h5.5M15 20.5V15h5.5M9 20.5V15H3.5' },

  keyboard: { d: 'M2.8 6.4h18.4v11.2H2.8zM6.2 10h.01M9.6 10h.01M13 10h.01M16.4 10h.01M7.6 14h8.8' },
  sliders: { d: 'M3 8h18M3 16h18M8.4 8a1.9 1.9 0 1 0 3.8 0 1.9 1.9 0 0 0-3.8 0ZM13.6 16a1.9 1.9 0 1 0 3.8 0 1.9 1.9 0 0 0-3.8 0Z' },

  baton: { d: 'M7.6 17 19.4 4.6M4 20l3.4-3.4' },
  album: { d: 'M12 3.8a8.2 8.2 0 1 1 0 16.4 8.2 8.2 0 0 1 0-16.4ZM12 10.4a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Z' },
  artist: { d: 'M12 4.4a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2ZM4.8 20.2a7.2 7.2 0 0 1 14.4 0' },
  playlist: { d: 'M3.5 6.5h11M3.5 11.5h11M3.5 16.5h6.5M17.5 17.6V6l3.5-1v11M15.2 20a2.3 2.3 0 1 0 4.6 0 2.3 2.3 0 0 0-4.6 0Z' },
  dot: { d: 'M12 9.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8Z', filled: true },
  spark: { d: 'M12 3.5v5M12 15.5v5M3.5 12h5M15.5 12h5M6.4 6.4l3 3M14.6 14.6l3 3M17.6 6.4l-3 3M9.4 14.6l-3 3' },
};

/** Icon path cache, keyed by name. */
const pathCache = new Map();

/**
 * Build an icon element.
 *
 * @param {keyof typeof ICONS} name
 * @param {{size?: number, class?: string, title?: string, stroke?: number}} [o]
 * @returns {SVGSVGElement}
 */
export function icon(name, o = {}) {
  const spec = ICONS[name] ?? ICONS.dot;
  const size = o.size ?? 14;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${GRID} ${GRID}`);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('focusable', 'false');
  if (o.class) svg.setAttribute('class', o.class);
  if (o.title) {
    svg.setAttribute('role', 'img');
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    t.textContent = o.title;
    svg.appendChild(t);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', spec.d);
  if (spec.filled) {
    path.setAttribute('fill', 'currentColor');
  } else {
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    // Compensate for the viewBox scale so the stroke is the same hairline at
    // every rendered size.
    path.setAttribute('stroke-width', String(((o.stroke ?? 1.4) * GRID) / size));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
  }
  svg.appendChild(path);
  return svg;
}

export const ICON_NAMES = Object.keys(ICONS);
