/**
 * MAESTRO — Now-playing panel.
 *
 * The conductor's stage, the movement's structure, the queue, and a small
 * per-section mixer. Everything here is driven by the live transport, so the
 * panel is a readout of the actual performance rather than static metadata.
 *
 * @module ui/aside
 */

import { h, render, setText, setAttr, pxText, clear } from '../core/dom.js';
import { icon } from './icons.js';
import { store, actions } from '../state.js';
import { player } from '../player.js';
import { transport } from '../audio/transport.js';
import { bus, EVT } from '../core/bus.js';
import { getTrack, getAlbum, getArtist } from '../data/catalog.js';
import { STYLES } from '../audio/composer.js';
import { INSTRUMENT_LABEL } from '../audio/instruments.js';
import { MODE_LABEL } from '../audio/theory.js';
import { formatTime } from '../core/utils.js';
import { asideConductor } from './conductor.js';
import { trackCover, likeButton } from './components.js';
import { Slider } from './slider.js';

/** @param {HTMLElement} root */
export function mountAside(root) {
  const stageCanvas = h('canvas', { 'aria-hidden': 'true' });
  const beatDots = h('div.np__beat', { 'aria-hidden': 'true' });
  const stage = h('div.np__stage', {},
    h('div.np__stage-label', {}, icon('baton', { size: 10 }), h('span', {}, 'CONDUCTOR')),
    beatDots,
    stageCanvas,
  );

  const titleEl = h('div', { style: 'font-size:var(--t-lg);color:var(--c-bone-bright);line-height:1.25' }, '—');
  const subEl = h('div.t-dim', { style: 'font-size:var(--t-sm)' }, 'Nothing playing');
  const factsEl = h('div.np__facts');

  const sectionBar = h('div.np__sectionbar', { 'aria-hidden': 'true' });
  const sectionName = h('div.t-mono', { style: 'color:var(--c-gold)' }, '—');
  const chordEl = h('div.t-mono.t-dim', {}, '');

  const structure = h('div.np__section', {},
    h('div.row-between', {},
      h('div.t-eyebrow', {}, 'STRUCTURE'),
      chordEl,
    ),
    sectionBar,
    sectionName,
  );

  const mixer = h('div.mixer');
  const mixerBlock = h('div.np__section', {},
    h('div.t-eyebrow', {}, 'DESK'),
    mixer,
  );

  const queueList = h('div.np__queue');
  const queueBlock = h('div', {},
    h('div.row-between', { style: 'margin-bottom:var(--s-3)' },
      h('div.t-eyebrow', {}, 'NEXT IN THE PROGRAMME'),
      h('button.btn.btn--ghost.btn--sm', {
        type: 'button',
        onClick: () => { window.location.hash = '#/queue'; },
      }, 'ALL'),
    ),
    queueList,
  );

  render(root,
    h('div.aside__head', {},
      pxText('NOW PLAYING', { scale: 2 }),
      h('button.ibtn.ibtn--sm', {
        type: 'button', 'aria-label': 'Close panel', title: 'Close panel',
        onClick: () => actions.toggleAside(),
      }, icon('close', { size: 10 })),
    ),
    h('div.aside__body.scroll', {},
      h('div.np', {},
        stage,
        h('div.np__title', {}, titleEl, subEl, factsEl),
        structure,
        mixerBlock,
        queueBlock,
      ),
    ),
  );

  /* --- Conductor -------------------------------------------------------- */
  asideConductor.mount(stageCanvas, {
    width: 104, height: 132, scale: 0, trail: true, fitTo: stage,
  });

  /* --- Beat dots -------------------------------------------------------- */
  let meterTop = 4;
  function paintBeatDots(active = -1) {
    if (beatDots.children.length !== meterTop) {
      render(beatDots, Array.from({ length: meterTop }, (_, i) =>
        h('i', { 'data-downbeat': String(i === 0) })));
    }
    Array.from(beatDots.children).forEach((el, i) => setAttr(el, 'data-on', String(i === active)));
  }
  paintBeatDots();
  bus.on(EVT.BEAT, ({ beatInBar, meter }) => {
    if (meter !== meterTop) { meterTop = meter; paintBeatDots(); }
    paintBeatDots(beatInBar);
  });

  /* --- Track metadata ---------------------------------------------------- */
  const idleNote = (text) => h('p.t-dim', {
    style: 'font-size:var(--t-xs);line-height:1.6;margin:var(--s-1) 0',
  }, text);

  store.subscribe((s) => s.trackId, (id) => {
    const track = id ? getTrack(id) : null;
    if (!track) {
      setText(titleEl, 'THE HALL IS EMPTY');
      render(subEl, 'Choose a movement and the conductor takes the stand.');
      clear(factsEl);
      render(sectionBar, idleNote('The form of the movement appears here — every section, sized by its length, filling as it plays.'));
      setText(sectionName, '');
      setText(chordEl, '');
      render(mixer, idleNote('A fader per instrument, live. The score is synthesised part by part, so any of them can be taken out.'));
      return;
    }
    const album = getAlbum(track.albumId);
    const artist = getArtist(track.artistId);
    const style = STYLES[track.style];

    setText(titleEl, track.title);
    render(subEl,
      h('a', { href: `#/artist/${artist.id}` }, artist.name),
      ' · ',
      h('a', { href: `#/album/${album.id}` }, album.title),
    );
    render(factsEl,
      h('span.tag', {}, style?.label ?? track.style),
      h('span.tag', {}, `${track.key} ${MODE_LABEL[track.mode] ?? track.mode}`),
      h('span.tag', {}, `${track.bpm} BPM`),
      h('span.tag', {}, `${track.meter[0]}/${track.meter[1]}`),
    );
    meterTop = track.meter[0];
    paintBeatDots();
    buildMixer();
  });

  /* --- Structure --------------------------------------------------------- */
  let sections = [];
  bus.on(EVT.TRACK_STARTED, ({ score }) => {
    sections = score.sections;
    render(sectionBar, sections.map((s) =>
      h('i', {
        style: { flex: `${s.duration} 0 0` },
        title: s.label,
      })));
    buildMixer();
  });

  bus.on(EVT.PLAYBACK_TICK, ({ position }) => {
    if (!sections.length) return;
    let activeIndex = 0;
    for (let i = sections.length - 1; i >= 0; i--) {
      if (position >= sections[i].t) { activeIndex = i; break; }
    }
    Array.from(sectionBar.children).forEach((el, i) => {
      setAttr(el, 'data-active', String(i === activeIndex));
      setAttr(el, 'data-past', String(i < activeIndex));
    });
    const s = sections[activeIndex];
    setText(sectionName, `${s.label} · BAR ${s.startBar + 1}`);

    const score = transport.score;
    if (score?.chords?.length) {
      let chord = score.chords[0];
      for (let i = score.chords.length - 1; i >= 0; i--) {
        if (position >= score.chords[i].t) { chord = score.chords[i]; break; }
      }
      setText(chordEl, chord.label);
    }
  });

  /* --- Mixer: per-instrument trims --------------------------------------- */
  function buildMixer() {
    const score = transport.score;
    if (!score) { clear(mixer); return; }
    render(mixer, score.instruments.map((inst) => {
      const value = transport.trims[inst] ?? 1;
      const readout = h('div.mixer__val', {}, `${Math.round(value * 100)}`);
      const slider = new Slider({
        label: `${INSTRUMENT_LABEL[inst] ?? inst} level`,
        value,
        small: true,
        onInput: (v) => {
          transport.trims[inst] = v;
          setText(readout, String(Math.round(v * 100)));
        },
      });
      return h('div.mixer__row', {},
        h('div.mixer__name.truncate', {}, INSTRUMENT_LABEL[inst] ?? inst),
        slider.el,
        readout,
      );
    }));
  }

  /* --- Queue ------------------------------------------------------------- */
  function paintQueue() {
    const s = store.state;
    const upcoming = s.queue.slice(s.queueIndex + 1, s.queueIndex + 7);
    if (!upcoming.length) {
      render(queueList, h('p.t-dim', { style: 'font-size:var(--t-xs);line-height:1.6' },
        'The programme ends with this movement.'));
      return;
    }
    render(queueList, upcoming.map((id, i) => {
      const track = getTrack(id);
      if (!track) return null;
      const artist = getArtist(track.artistId);
      return h('button.np__qitem', {
        type: 'button',
        onClick: () => player.jumpToIndex(s.queueIndex + 1 + i),
      },
        trackCover(track, { size: 30 }),
        h('div.grow', {},
          h('div.truncate', { style: 'font-size:var(--t-xs);color:var(--c-text)' }, track.title),
          h('div.truncate.t-dim', { style: 'font-size:var(--t-2xs)' }, artist?.name ?? ''),
        ),
        h('div.t-mono.t-dim', {}, formatTime(track.duration)),
      );
    }));
  }

  store.subscribe((s) => `${s.queue.join(',')}|${s.queueIndex}`, paintQueue);
}
