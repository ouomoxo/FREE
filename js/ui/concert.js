/**
 * MAESTRO — Concert hall.
 *
 * The full-screen view: the house lights go out, the conductor takes the stage
 * at full size, and the spectrum becomes the floor. Everything else is stripped
 * back to a title, a seek bar, and three controls.
 *
 * @module ui/concert
 */

import { h, render, setText, setAttr, setVar, pxText, clear, trapFocus } from '../core/dom.js';
import { icon } from './icons.js';
import { store, actions } from '../state.js';
import { player } from '../player.js';
import { transport } from '../audio/transport.js';
import { bus, EVT } from '../core/bus.js';
import { getTrack, getAlbum, getArtist } from '../data/catalog.js';
import { formatTime } from '../core/utils.js';
import { concertConductor } from './conductor.js';
import { REFERENCE } from '../pixel/halftone.js';
import { concertVisualizer, VISUALIZER_MODES } from './visualizer.js';
import { Slider } from './slider.js';
import { STYLES } from '../audio/composer.js';

/** @param {HTMLElement} root */
export function mountConcert(root) {
  const handsCanvas = h('canvas.concert__hands', { 'aria-hidden': 'true' });
  const spectrumCanvas = h('canvas.concert__spectrum', { 'aria-hidden': 'true' });

  const titleWord = h('div');
  const subLine = h('div.t-eyebrow', {}, '');
  const chordLine = h('div.concert__chords', {});

  const elapsed = h('div.player__time', {}, '0:00');
  const total = h('div.player__time.player__time--right', {}, '0:00');
  let scrubbing = false;

  const seek = new Slider({
    label: 'Seek',
    format: (v) => formatTime(v * (transport.duration || 0)),
    onInput: (v) => { scrubbing = true; setText(elapsed, formatTime(v * (transport.duration || 0))); },
    onChange: (v) => { scrubbing = false; player.seek(v * (transport.duration || 0)); },
  });

  const playBtn = h('button.playbtn.playbtn--lg', {
    type: 'button', 'aria-label': 'Play',
    onClick: () => player.toggle(),
  }, icon('play', { size: 18 }));

  const modeBtn = h('button.btn.btn--ghost.btn--sm', {
    type: 'button',
    title: 'Cycle the visualiser',
    onClick: () => {
      const i = VISUALIZER_MODES.indexOf(store.state.visualizer);
      const next = VISUALIZER_MODES[(i + 1) % VISUALIZER_MODES.length];
      actions.setVisualizer(next);
      concertVisualizer.setMode(next);
      setAttr(root, 'data-viz', next);
      setText(modeBtn, next.toUpperCase());
      concertVisualizer.resize();
      setAttr(root, 'data-viz', next);
    },
  }, store.state.visualizer.toUpperCase());

  const closeBtn = h('button.ibtn.ibtn--lg', {
    type: 'button', 'aria-label': 'Leave the concert hall', title: 'Close (Esc)',
    onClick: () => actions.setConcert(false),
  }, icon('collapse', { size: 14 }));

  render(root,
    h('div.concert__top', {},
      h('div.row.gap-3', {}, icon('baton', { size: 14 }), pxText('CONCERT HALL', { scale: 2 })),
      h('div.row.gap-3', {}, modeBtn, closeBtn),
    ),
    h('div.concert__stage', {}, handsCanvas, spectrumCanvas),
    h('div.concert__bottom', {},
      h('div.concert__title', {}, titleWord, subLine, chordLine),
      h('div.concert__scrub', {}, elapsed, seek.el, total),
      h('div.concert__controls', {},
        h('button.ibtn.ibtn--lg', {
          type: 'button', 'aria-label': 'Previous', onClick: () => player.previous(),
        }, icon('prev', { size: 14 })),
        playBtn,
        h('button.ibtn.ibtn--lg', {
          type: 'button', 'aria-label': 'Next', onClick: () => player.next(),
        }, icon('next', { size: 14 })),
      ),
    ),
  );

  let releaseFocus = null;
  let mounted = false;

  function layout() {
    concertVisualizer.resize();
  }

  const onResize = () => layout();

  function open() {
    if (mounted) return;
    mounted = true;
    root.hidden = false;
    setAttr(root, 'aria-hidden', 'false');
    concertConductor.mount(handsCanvas, {
      src: REFERENCE.b,
      cell: 7,
      fitTo: root.querySelector('.concert__stage'),
      fitW: 0.92, fitH: 0.96, maxWidth: 900,
      // The stage is far wider than the photograph, so this one is contained
      // rather than cropped: losing the baton to a crop would lose the subject.
      framing: { cover: false, zoom: 1.0, offsetY: 0 },
    });
    concertVisualizer.mount(spectrumCanvas, {
      columns: 72, rows: 22, gap: 2, mode: store.state.visualizer,
    });
    setAttr(root, 'data-viz', store.state.visualizer);
    window.addEventListener('resize', onResize);
    requestAnimationFrame(layout);
    releaseFocus = trapFocus(root);
    closeBtn.focus();
    paintTrack(store.state.trackId);
  }

  function close() {
    if (!mounted) return;
    mounted = false;
    concertConductor.unmount();
    concertVisualizer.unmount();
    window.removeEventListener('resize', onResize);
    releaseFocus?.();
    releaseFocus = null;
    root.hidden = true;
    setAttr(root, 'aria-hidden', 'true');
  }

  /** @param {string|null} id */
  function paintTrack(id) {
    const track = id ? getTrack(id) : null;
    if (!track) {
      render(titleWord, pxText('SILENCE', { scale: 5 }));
      setText(subLine, 'CHOOSE A MOVEMENT TO BEGIN');
      return;
    }
    const artist = getArtist(track.artistId);
    const album = getAlbum(track.albumId);
    const style = STYLES[track.style];
    render(titleWord, pxText(track.title, { scale: track.title.length > 22 ? 3 : 4 }));
    setText(subLine, `${artist.name} · ${album.title} · ${style?.label ?? ''}`);
  }

  store.subscribe((s) => s.concert, (on) => (on ? open() : close()), { immediate: false });
  store.subscribe((s) => s.trackId, paintTrack, { immediate: false });
  store.subscribe((s) => s.playing, (playing) => {
    playBtn.replaceChildren(icon(playing ? 'pause' : 'play', { size: 18 }));
    setAttr(playBtn, 'aria-label', playing ? 'Pause' : 'Play');
  });

  bus.on(EVT.TRACK_STARTED, ({ score }) => {
    if (score?.duration) seek.setMarks(score.sections.map((s) => s.t / score.duration));
  });

  bus.on(EVT.PLAYBACK_TICK, ({ position, duration, progress }) => {
    if (!mounted) return;
    if (!scrubbing) {
      seek.set(progress, { silent: true });
      setText(elapsed, formatTime(position));
    }
    if (duration) setText(total, formatTime(duration));

    const score = transport.score;
    if (score?.chords?.length) {
      let idx = 0;
      for (let i = score.chords.length - 1; i >= 0; i--) {
        if (position >= score.chords[i].t) { idx = i; break; }
      }
      const window = score.chords.slice(Math.max(0, idx - 1), idx + 3);
      render(chordLine, window.map((c, i) =>
        (Math.max(0, idx - 1) + i === idx ? h('b', {}, c.label) : h('span', {}, c.label))));
    }
  });

  return { open, close };
}
