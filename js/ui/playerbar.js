/**
 * MAESTRO — Transport bar.
 *
 * Subscribes to coarse state through the store, but takes the playhead straight
 * off the event bus and writes it into the DOM by hand. At 60 Hz that is the
 * difference between a store notification storm and three property writes.
 *
 * @module ui/playerbar
 */

import { h, render, setText, setAttr, setVar, pxText } from '../core/dom.js';
import { icon } from './icons.js';
import { Slider } from './slider.js';
import { store, actions } from '../state.js';
import { player } from '../player.js';
import { transport } from '../audio/transport.js';
import { bus, EVT } from '../core/bus.js';
import { getTrack, getAlbum, getArtist } from '../data/catalog.js';
import { formatTime } from '../core/utils.js';
import { likeButton, trackCover } from './components.js';

/** @param {HTMLElement} root */
export function mountPlayerBar(root) {
  /* --- Now playing ------------------------------------------------------ */
  const art = h('a.player__art', { href: '#/', 'aria-label': 'Open the record' });
  const title = h('div.player__title.truncate', {}, '—');
  const sub = h('div.player__sub.truncate', {}, 'NOTHING SELECTED');
  const likeSlot = h('div', { style: 'display:flex;align-items:center' });

  const now = h('div.player__now', {},
    art,
    h('div.player__meta', {}, title, sub),
    likeSlot,
  );

  /* --- Transport controls ----------------------------------------------- */
  const shuffleBtn = h('button.ibtn', {
    type: 'button', 'aria-label': 'Shuffle', title: 'Shuffle',
    onClick: () => actions.toggleShuffle(),
  }, icon('shuffle', { size: 12 }));

  const prevBtn = h('button.ibtn', {
    type: 'button', 'aria-label': 'Previous movement', title: 'Previous',
    onClick: () => player.previous(),
  }, icon('prev', { size: 12 }));

  const playBtn = h('button.playbtn', {
    type: 'button', 'aria-label': 'Play',
    onClick: () => player.toggle(),
  }, icon('play', { size: 13 }));

  const nextBtn = h('button.ibtn', {
    type: 'button', 'aria-label': 'Next movement', title: 'Next',
    onClick: () => player.next(),
  }, icon('next', { size: 12 }));

  const repeatBtn = h('button.ibtn', {
    type: 'button', 'aria-label': 'Repeat', title: 'Repeat',
    onClick: () => actions.cycleRepeat(),
  }, icon('repeat', { size: 12 }));

  const elapsed = h('div.player__time', {}, '0:00');
  const total = h('div.player__time.player__time--right', {}, '0:00');

  const seek = new Slider({
    label: 'Seek',
    format: (v) => formatTime(v * (transport.duration || 0)),
    onInput: (v) => { setText(elapsed, formatTime(v * (transport.duration || 0))); scrubbing = true; },
    onChange: (v) => { scrubbing = false; player.seek(v * (transport.duration || 0)); },
  });
  let scrubbing = false;

  const center = h('div.player__center', {},
    h('div.player__buttons', {}, shuffleBtn, prevBtn, playBtn, nextBtn, repeatBtn),
    h('div.player__scrub', {}, elapsed, seek.el, total),
  );

  /* --- Right-hand cluster ------------------------------------------------ */
  const muteBtn = h('button.ibtn', {
    type: 'button', 'aria-label': 'Mute', title: 'Mute',
    onClick: () => actions.toggleMute(),
  }, icon('volumeHigh', { size: 12 }));

  const volume = new Slider({
    label: 'Volume',
    value: store.state.volume,
    small: true,
    format: (v) => `${Math.round(v * 100)} per cent`,
    onInput: (v) => actions.setVolume(v),
  });

  const queueBtn = h('button.ibtn', {
    type: 'button', 'aria-label': 'Queue', title: 'Queue',
    onClick: () => { actions.setQueueOpen(true); if (!store.state.asideOpen) actions.toggleAside(); },
  }, icon('queue', { size: 12 }));

  const concertBtn = h('button.ibtn.player__expand', {
    type: 'button', 'aria-label': 'Concert hall', title: 'Concert hall view',
    onClick: () => actions.setConcert(true),
  }, icon('expand', { size: 12 }));

  const right = h('div.player__right', {},
    queueBtn,
    h('div.player__volume', {}, muteBtn, volume.el),
    concertBtn,
  );

  const bar = h('div.player', {}, now, center, right);
  render(root, bar);

  /* --- Wiring ------------------------------------------------------------ */

  store.subscribe((s) => s.trackId, (id) => {
    const track = id ? getTrack(id) : null;
    if (!track) {
      setText(title, '—');
      setText(sub, 'NOTHING SELECTED');
      art.replaceChildren();
      likeSlot.replaceChildren();
      seek.setDisabled(true);
      return;
    }
    const album = getAlbum(track.albumId);
    const artist = getArtist(track.artistId);
    setText(title, track.title);
    setAttr(art, 'href', `#/album/${album.id}`);
    setAttr(art, 'aria-label', `Open ${album.title}`);
    art.replaceChildren(trackCover(track, { size: 48 }));
    render(sub, h('a', { href: `#/artist/${artist.id}` }, artist.name));
    likeSlot.replaceChildren(likeButton(track.id, 12));
    seek.setDisabled(false);
    setText(total, formatTime(track.duration));
  });

  store.subscribe((s) => s.playing, (playing) => {
    playBtn.replaceChildren(icon(playing ? 'pause' : 'play', { size: 13 }));
    setAttr(playBtn, 'aria-label', playing ? 'Pause' : 'Play');
  });

  store.subscribe((s) => s.shuffle, (on) => setAttr(shuffleBtn, 'aria-pressed', String(on)));

  store.subscribe((s) => s.repeat, (mode) => {
    repeatBtn.replaceChildren(icon(mode === 'one' ? 'repeatOne' : 'repeat', { size: 12 }));
    setAttr(repeatBtn, 'aria-pressed', String(mode !== 'off'));
    setAttr(repeatBtn, 'title', `Repeat: ${mode}`);
  });

  store.subscribe((s) => [s.volume, s.muted], ([v, muted]) => {
    volume.set(muted ? 0 : v, { silent: true });
    const name = muted || v === 0 ? 'volumeMute' : v < 0.5 ? 'volumeLow' : 'volumeHigh';
    muteBtn.replaceChildren(icon(name, { size: 12 }));
    setAttr(muteBtn, 'aria-pressed', String(muted));
  }, { equals: (a, b) => a[0] === b[0] && a[1] === b[1] });

  // Section markers appear once a score is loaded.
  bus.on(EVT.TRACK_STARTED, ({ score }) => {
    if (!score?.duration) return;
    seek.setMarks(score.sections.map((s) => s.t / score.duration));
  });

  // The hot path.
  bus.on(EVT.PLAYBACK_TICK, ({ position, duration, progress }) => {
    if (!scrubbing) {
      seek.set(progress, { silent: true });
      setText(elapsed, formatTime(position));
    }
    if (duration) setText(total, formatTime(duration));
    setVar(bar, '--progress', String(progress));
  });

  return { seek };
}
