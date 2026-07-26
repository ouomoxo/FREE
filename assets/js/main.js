/* ─────────────────────────────────────────────────────────────
   선율 · SEONYUL — interface
   loader / reveal / hud numerals / cursor / rail
   ───────────────────────────────────────────────────────────── */
(function (w, d) {
  'use strict';

  var SY = w.SY, U = SY.u, S = SY.s;
  var $ = function (id) { return d.getElementById(id); };

  /* ── loader ───────────────────────────────────────────── */
  var loader = $('loader'), lBin = $('loaderBin'), lBar = $('loaderBar'), lNum = $('loaderNum');
  var pct = 0, done = false;

  function tickLoad() {
    if (done) return;
    pct += (100 - pct) * 0.06 + 0.35;
    if (pct > 99.4) pct = 100;
    var v = Math.floor(pct);
    lNum.textContent = U.pad(v, 3);
    lBar.style.width = pct + '%';
    lBin.textContent = ('00000000' + v.toString(2)).slice(-8);
    if (pct >= 100) { done = true; setTimeout(open, 420); return; }
    w.requestAnimationFrame(tickLoad);
  }

  function open() {
    loader.classList.add('is-done');
    d.body.classList.remove('is-locked');
    d.body.classList.add('is-ready');
    S.ready = true;
    SY.readyAt = S.t;
    var hero = $('s0');
    setTimeout(function () { hero.classList.add('is-in'); }, 120);
    SY.measure();
  }

  d.body.classList.add('is-locked');

  /* ── reveal ───────────────────────────────────────────── */
  var secs = d.querySelectorAll('.sec');
  if ('IntersectionObserver' in w) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) e.target.classList.add('is-in');
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    for (var i = 1; i < secs.length; i++) io.observe(secs[i]);
  } else {
    for (var j = 0; j < secs.length; j++) secs[j].classList.add('is-in');
  }

  /* ── cursor ───────────────────────────────────────────── */
  var cur = $('cur'), curDot = $('curDot');
  var hot = d.querySelectorAll('a, button');
  for (var h = 0; h < hot.length; h++) {
    hot[h].addEventListener('mouseenter', function () { d.body.classList.add('cur-hot'); });
    hot[h].addEventListener('mouseleave', function () { d.body.classList.remove('cur-hot'); });
  }

  /* ── sound ────────────────────────────────────────────── */
  var sndBtn = $('sndBtn'), sndState = $('sndState');
  sndBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    var on = SY.audio.toggle();
    sndBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    sndState.textContent = on ? 'ON' : 'OFF';
  });

  /* ── numerals ─────────────────────────────────────────── */
  var mIdx = $('mIdx'), mName = $('mName'), mLat = $('mLat'), mLon = $('mLon'),
    mClock = $('mClock'), mFrame = $('mFrame'), dDots = $('dDots'), dState = $('dState'),
    dHz = $('dHz'), dPhase = $('dPhase'), dLand = $('dLand'), dDrift = $('dDrift'),
    dCells = $('dCells'), dRot = $('dRot'), footBin = $('footBin');
  var ticks = d.querySelectorAll('.rail__tick');
  var lastIdx = -1, tock = 0;

  // every frame of type breathes with its own movement
  var frames = [];
  (function () {
    var els = d.querySelectorAll('[data-scene] .frame');
    for (var i = 0; i < els.length; i++) frames.push({ el: els[i], a: -1 });
  })();

  // the index doesn't change, it counts — numerals as motion
  var scrambling = 0;
  function scramble(el, to) {
    var n = 0, id = ++scrambling;
    (function step() {
      if (id !== scrambling) return;
      if (n++ > 7) { el.textContent = to; return; }
      el.textContent = U.pad(Math.floor(Math.random() * 999), 3);
      setTimeout(step, 42);
    })();
  }

  function fmt(n, dec) {
    var s = Math.abs(n).toFixed(dec);
    return (n < 0 ? '−' : '') + s;
  }
  function comma(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  SY.hud = function (sections) {
    // cursor follows every frame
    if (cur) {
      var tr = 'translate3d(' + S.pointer.x.toFixed(1) + 'px,' + S.pointer.y.toFixed(1) + 'px,0)';
      cur.style.transform = tr;
      curDot.style.transform = 'translate3d(' + S.pointer.tx.toFixed(1) + 'px,' + S.pointer.ty.toFixed(1) + 'px,0)';
    }
    // type fades in step with its scene, so two movements never speak at once
    for (var f = 0; f < frames.length; f++) {
      var sc = sections[f];
      if (!sc) continue;
      var ta = U.clamp((sc.alpha - 0.62) / 0.33, 0, 1);   // type arrives only once its frame is nearly pinned
      var fr = frames[f];
      if (Math.abs(ta - fr.a) > 0.008) {
        fr.a = ta;
        fr.el.style.opacity = ta.toFixed(3);
        fr.el.style.transform = ta < 0.999 ? 'translateY(' + ((1 - ta) * 30).toFixed(1) + 'px)' : '';
      }
    }

    if (++tock % 3) return;

    var i = S.active, sec = sections[i];
    if (i !== lastIdx) {
      lastIdx = i;
      scramble(mIdx, U.pad(i, 3));
      mName.textContent = sec ? sec.label : '';
      for (var k = 0; k < ticks.length; k++) ticks[k].classList.toggle('is-on', k === i);
    }

    var P = S.pointer;
    var lon = (P.x / S.w) * 360 - 180, lat = 90 - (P.y / S.h) * 180;
    mLat.textContent = fmt(lat, 4);
    mLon.textContent = fmt(lon, 4);

    var now = new Date();
    mClock.textContent =
      U.pad(now.getUTCHours(), 2) + ':' + U.pad(now.getUTCMinutes(), 2) + ':' + U.pad(now.getUTCSeconds(), 2);
    mFrame.textContent = U.pad(S.frame % 1000000, 6);

    var I = SY.info;
    if (I.dots) dDots.textContent = comma(I.dots);
    if (I.state) dState.textContent = I.state;
    if (I.hz) dHz.textContent = I.hz;
    if (I.phase) dPhase.textContent = I.phase;
    if (I.land) dLand.textContent = comma(I.land);
    if (I.drift != null) dDrift.textContent = '+' + fmt((I.drift * 2.4) % 360, 1) + '°';
    if (I.cells) dCells.textContent = U.pad(I.cells, 5);
    if (I.rot) dRot.textContent = I.rot;

    footBin.textContent =
      (S.frame % 2 ? '0101' : '0100') + ' ' +
      ('0000' + Math.round(S.progress * 100).toString(2)).slice(-4) + ' ' +
      U.pad(Math.round(S.progress * 100), 4);
  };

  /* ── rail smooth-scroll (also for browsers without CSS smooth) ── */
  for (var r = 0; r < ticks.length; r++) {
    ticks[r].addEventListener('click', function (e) {
      var id = this.getAttribute('href');
      var el = d.querySelector(id);
      if (!el) return;
      e.preventDefault();
      w.scrollTo({ top: el.offsetTop + 4, behavior: S.reduced ? 'auto' : 'smooth' });
    });
  }

  /* ── boot ─────────────────────────────────────────────── */
  SY.start();
  w.requestAnimationFrame(tickLoad);
  w.addEventListener('load', function () { setTimeout(SY.measure, 60); });
  setTimeout(SY.measure, 900);

  // guard: never leave the visitor locked out
  setTimeout(function () { if (!S.ready) open(); }, 6000);

})(window, document);
