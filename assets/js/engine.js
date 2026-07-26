/* ─────────────────────────────────────────────────────────────
   선율 · SEONYUL — engine
   canvas stage / scroll conductor / pointer / synth
   ───────────────────────────────────────────────────────────── */
(function (w, d) {
  'use strict';

  var SY = (w.SY = w.SY || {});

  /* ── math ─────────────────────────────────────────────── */
  var U = (SY.u = {
    clamp: function (v, a, b) { return v < a ? a : v > b ? b : v; },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    smooth: function (t) { return t * t * (3 - 2 * t); },
    ease: function (t) { return 1 - Math.pow(1 - t, 3); },
    map: function (v, a, b, c, e) { return c + ((v - a) / (b - a)) * (e - c); },
    // deterministic pseudo-random, so the composition is reproducible
    hash: function (x, y) {
      var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return n - Math.floor(n);
    },
    pad: function (n, len) {
      var s = String(Math.abs(Math.round(n)));
      while (s.length < len) s = '0' + s;
      return s;
    }
  });

  /* ── state ────────────────────────────────────────────── */
  var S = (SY.s = {
    t: 0, dt: 0, frame: 0,
    w: 0, h: 0, dpr: 1,
    scroll: 0, vh: 0, doc: 0, progress: 0, sv: 0, idle: 0,
    active: 0, activeP: 0,
    small: false,
    reduced: w.matchMedia('(prefers-reduced-motion: reduce)').matches,
    touch: w.matchMedia('(hover:none)').matches,
    ready: false,
    pointer: { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, has: false, down: 0 }
  });

  /* ── canvas ───────────────────────────────────────────── */
  var cv = d.getElementById('stage');
  var ctx = cv.getContext('2d', { alpha: false });
  SY.ctx = ctx;

  function resize() {
    S.w = w.innerWidth;
    S.h = w.innerHeight;
    S.dpr = Math.min(w.devicePixelRatio || 1, 2);
    S.small = S.w < 900;
    S.vh = S.h;
    cv.width = Math.floor(S.w * S.dpr);
    cv.height = Math.floor(S.h * S.dpr);
    cv.style.width = S.w + 'px';
    cv.style.height = S.h + 'px';
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    measure();
    for (var i = 0; i < SY.scenes.length; i++) {
      if (SY.scenes[i].resize) SY.scenes[i].resize(S.w, S.h);
    }
  }
  SY.resize = resize;

  /* ── scroll conductor ─────────────────────────────────── */
  var sections = [];
  function measure() {
    sections = [];
    var els = d.querySelectorAll('[data-scene]');
    var top = w.pageYOffset || d.documentElement.scrollTop;
    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();
      sections.push({
        el: els[i],
        name: els[i].getAttribute('data-scene'),
        label: els[i].getAttribute('data-name'),
        han: els[i].getAttribute('data-han'),
        top: r.top + top,
        h: r.height
      });
    }
    S.doc = Math.max(1, d.body.scrollHeight - S.h);
  }
  SY.measure = measure;

  // Each frame is pinned while scroll ∈ [top, top + h − vh]; it travels in and out
  // over exactly one viewport. So the crossfade window IS that travel — scene and
  // type move as one body.
  function conduct() {
    var y = S.scroll, F = Math.max(1, S.h * 0.7);
    var best = 0, bestA = -1;
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      var start = s.top, end = s.top + s.h - S.h;
      var aIn = U.clamp((y - (start - F)) / F, 0, 1);
      var aOut = U.clamp(((end + F) - y) / F, 0, 1);
      s.alpha = Math.sqrt(U.clamp(aIn * aOut, 0, 1));
      s.p = end > start ? U.clamp((y - start) / (end - start), 0, 1)
                        : U.clamp((y - start) / F, 0, 1);
      if (s.alpha > bestA) { bestA = s.alpha; best = i; }
    }
    S.active = best;
    S.activeP = sections[best] ? sections[best].p : 0;
    S.progress = U.clamp(y / S.doc, 0, 1);
  }
  SY.sections = function () { return sections; };

  /* ── pointer ──────────────────────────────────────────── */
  var P = S.pointer;
  function move(x, y) { P.tx = x; P.ty = y; P.has = true; S.idle = 0; }
  d.addEventListener('mousemove', function (e) { move(e.clientX, e.clientY); }, { passive: true });
  d.addEventListener('touchmove', function (e) {
    if (e.touches[0]) move(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  d.addEventListener('touchstart', function (e) {
    if (e.touches[0]) { move(e.touches[0].clientX, e.touches[0].clientY); P.x = P.tx; P.y = P.ty; P.down = 1; }
  }, { passive: true });
  d.addEventListener('mousedown', function () { P.down = 1; SY.pulse(); });
  d.addEventListener('mouseup', function () { P.down = 0; });
  d.addEventListener('touchend', function () { P.down = 0; });

  // click ripples, shared by scenes
  var ripples = (SY.ripples = []);
  SY.pulse = function () {
    if (!P.has) return;
    ripples.push({ x: P.x, y: P.y, t: 0 });
    if (ripples.length > 6) ripples.shift();
    if (SY.audio) SY.audio.pluck(0.6 + Math.random() * 0.3, 1);
  };

  /* ── synth ────────────────────────────────────────────── */
  var A = (SY.audio = {
    on: false, ac: null, master: null, drone: [],
    scale: [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99],
    boot: function () {
      if (this.ac) return;
      var AC = w.AudioContext || w.webkitAudioContext;
      if (!AC) return;
      this.ac = new AC();
      this.master = this.ac.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ac.destination);
      var f = this.ac.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 620; f.Q.value = 0.4;
      f.connect(this.master);
      this.bus = f;
      // a slow drone: two detuned voices, breathing
      var self = this;
      [65.41, 98.0].forEach(function (hz, i) {
        var o = self.ac.createOscillator();
        var g = self.ac.createGain();
        o.type = i ? 'sine' : 'triangle';
        o.frequency.value = hz;
        g.gain.value = i ? 0.05 : 0.08;
        var lfo = self.ac.createOscillator();
        var lg = self.ac.createGain();
        lfo.frequency.value = 0.05 + i * 0.033;
        lg.gain.value = i ? 0.03 : 0.05;
        lfo.connect(lg); lg.connect(g.gain);
        o.connect(g); g.connect(f);
        o.start(); lfo.start();
        self.drone.push(o);
      });
    },
    toggle: function () {
      this.boot();
      if (!this.ac) return false;
      if (this.ac.state === 'suspended') this.ac.resume();
      this.on = !this.on;
      var t = this.ac.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(this.master.gain.value, t);
      this.master.gain.linearRampToValueAtTime(this.on ? 0.5 : 0, t + (this.on ? 2.2 : 0.9));
      return this.on;
    },
    // soft pluck; v is 0..1 vertical position → picks a degree of the scale
    pluck: function (v, vel) {
      if (!this.on || !this.ac) return;
      var t = this.ac.currentTime;
      var idx = Math.round(U.clamp(1 - v, 0, 1) * (this.scale.length - 1));
      var hz = this.scale[idx];
      var o = this.ac.createOscillator();
      var g = this.ac.createGain();
      o.type = 'sine'; o.frequency.value = hz;
      var amp = 0.13 * (vel || 1);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      o.connect(g); g.connect(this.bus || this.master);
      o.start(t); o.stop(t + 2.5);
      // a fifth above, quieter — the "선율" doubling
      var o2 = this.ac.createOscillator(), g2 = this.ac.createGain();
      o2.type = 'sine'; o2.frequency.value = hz * 1.5;
      g2.gain.setValueAtTime(0, t);
      g2.gain.linearRampToValueAtTime(amp * 0.32, t + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o2.connect(g2); g2.connect(this.bus || this.master);
      o2.start(t); o2.stop(t + 1.7);
    }
  });

  /* ── loop ─────────────────────────────────────────────── */
  SY.scenes = [];
  var last = 0, lastActive = -1;
  var curtain = [];   // a ring of air drawn at every change of movement

  function frame(now) {
    w.requestAnimationFrame(frame);
    var dt = Math.min((now - last) / 1000 || 0, 0.05);
    last = now;
    S.dt = dt; S.t += S.reduced ? dt * 0.18 : dt; S.frame++;   // reduced motion: the piece breathes, slowly

    var prev = S.scroll;
    S.scroll = w.pageYOffset || d.documentElement.scrollTop;
    // the scroll wheel is an instrument: its speed swells the work
    S.sv = U.lerp(S.sv, U.clamp((S.scroll - prev) / Math.max(dt, 0.001) / 60, -26, 26), 0.22);
    conduct();

    // pointer easing — and when no one is here, the piece performs for itself
    S.idle += dt;
    if (!P.has || S.idle > 4) {
      var it = S.t * 0.11, amp = P.has ? U.clamp((S.idle - 4) / 3, 0, 1) : 1;
      var gx = S.w * (0.5 + 0.31 * Math.sin(it) * Math.cos(it * 0.37));
      var gy = S.h * (0.5 + 0.26 * Math.sin(it * 1.31 + 1.1));
      P.tx = U.lerp(P.tx, gx, amp);
      P.ty = U.lerp(P.ty, gy, amp);
    }
    var px = P.x, py = P.y;
    P.x = U.lerp(P.x, P.tx, 1 - Math.pow(0.001, dt));
    P.y = U.lerp(P.y, P.ty, 1 - Math.pow(0.001, dt));
    P.vx = P.x - px; P.vy = P.y - py;

    for (var r = ripples.length - 1; r >= 0; r--) {
      ripples[r].t += dt;
      if (ripples[r].t > 2.2) ripples.splice(r, 1);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, S.w, S.h);

    // the seal: each movement's ideogram, breathing behind the work
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var k = 0; k < sections.length; k++) {
      var sk = sections[k];
      if (!(sk.alpha > 0.01) || !sk.han) continue;
      ctx.save();
      ctx.globalAlpha = sk.alpha * (S.small ? 0.02 : 0.028);
      ctx.fillStyle = '#EDEAE4';
      var fs = S.h * (S.small ? 0.4 : 0.58);
      ctx.font = '400 ' + fs + 'px "Nanum Myeongjo", "Apple SD Gothic Neo", ui-serif, serif';
      ctx.fillText(sk.han, S.w * 0.5, S.h * 0.52 + (0.5 - sk.p) * 40);
      ctx.restore();
    }
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';

    for (var i = 0; i < sections.length; i++) {
      var sec = sections[i];
      var sc = SY.byName[sec.name];
      if (!sc || !(sec.alpha > 0.004)) continue;
      ctx.save();
      ctx.globalAlpha = sec.alpha;
      sc.draw(ctx, S.w, S.h, sec.p, sec.alpha, dt);
      ctx.restore();
    }

    // between movements: one expanding ring, then silence again
    if (S.active !== lastActive) {
      if (lastActive >= 0) curtain.push({ t: 0 });
      lastActive = S.active;
    }
    for (var ci = curtain.length - 1; ci >= 0; ci--) {
      var cu = curtain[ci];
      cu.t += dt;
      if (cu.t > 1.8) { curtain.splice(ci, 1); continue; }
      var u = cu.t / 1.8, R = Math.max(S.w, S.h) * 0.78 * (1 - Math.pow(1 - u, 3));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(237,234,228,' + (Math.pow(1 - u, 2) * 0.16).toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(S.w / 2, S.h / 2, R, 0, 6.2832); ctx.stroke();
      ctx.strokeStyle = 'rgba(237,234,228,' + (Math.pow(1 - u, 3) * 0.09).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(S.w / 2, S.h / 2, R * 0.82, 0, 6.2832); ctx.stroke();
      ctx.restore();
    }

    if (SY.hud) SY.hud(sections);
  }

  SY.start = function () {
    SY.byName = {};
    for (var i = 0; i < SY.scenes.length; i++) SY.byName[SY.scenes[i].name] = SY.scenes[i];
    resize();
    w.addEventListener('resize', resize, { passive: true });
    w.addEventListener('orientationchange', function () { setTimeout(resize, 250); });
    w.requestAnimationFrame(frame);
  };

})(window, document);
