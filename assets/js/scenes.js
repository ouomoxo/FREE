/* ─────────────────────────────────────────────────────────────
   선율 · SEONYUL — six movements
   000 field · 001 dot · 002 line · 003 world · 004 form · 005 silence
   ───────────────────────────────────────────────────────────── */
(function (w, d) {
  'use strict';

  var SY = w.SY, U = SY.u, S = SY.s;
  var IVORY = '237,234,228';
  SY.info = {};

  function q(p) { return U.clamp(p, 0, 1); }

  // Thousands of dots, ten fills. Quantising alpha into bands lets every
  // movement stay smooth enough that the motion itself can carry the piece.
  var BANDS = 10, bank = [];
  for (var bi = 0; bi < BANDS; bi++) bank.push([]);
  function band(a) { return bank[a < 0 ? 0 : a > 0.999 ? BANDS - 1 : (a * BANDS) | 0]; }
  function flush(c, tint) {
    var smear = U.clamp(-S.sv * 0.9, -13, 13);   // dots stretch along the scroll
    for (var b = 0; b < BANDS; b++) {
      var arr = bank[b];
      if (!arr.length) continue;
      c.fillStyle = 'rgba(' + (tint || IVORY) + ',' + ((b + 0.5) / BANDS).toFixed(3) + ')';
      c.beginPath();
      var sm = Math.abs(smear) > 1.2;
      for (var k = 0; k < arr.length; k += 3) {
        c.moveTo(arr[k] + arr[k + 2], arr[k + 1]);
        c.arc(arr[k], arr[k + 1], arr[k + 2], 0, 6.2832);
        if (sm) {
          c.moveTo(arr[k] + arr[k + 2] * 0.8, arr[k + 1] + smear);
          c.arc(arr[k], arr[k + 1] + smear, arr[k + 2] * 0.8, 0, 6.2832);
          c.moveTo(arr[k] + arr[k + 2] * 0.5, arr[k + 1] + smear * 0.55);
          c.arc(arr[k], arr[k + 1] + smear * 0.55, arr[k + 2] * 0.5, 0, 6.2832);
        }
      }
      c.fill();
      arr.length = 0;
    }
  }
  function rip(x, y) {
    // shared click ripples: returns extra energy at (x,y)
    var e = 0, R = SY.ripples;
    for (var i = 0; i < R.length; i++) {
      var r = R[i], rad = r.t * 620, dx = x - r.x, dy = y - r.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var band = Math.abs(dist - rad);
      if (band < 110) e += (1 - band / 110) * (1 - r.t / 2.2);
    }
    return e;
  }

  /* ══ 000 · FIELD ══════════════════════════════════════════
     정적인 점의 장(場). 파동이 지나가며 점을 깨운다.            */
  var field = {
    name: 'field',
    dots: [],
    resize: function (w0, h0) {
      var gap = w0 < 700 ? 24 : w0 < 1200 ? 28 : 32;
      var cols = Math.ceil(w0 / gap) + 1, rows = Math.ceil(h0 / gap) + 1;
      var ox = (w0 - (cols - 1) * gap) / 2, oy = (h0 - (rows - 1) * gap) / 2;
      this.dots = [];
      for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
        var px = ox + x * gap, py = oy + y * gap;
        var dx = px - w0 / 2, dy = py - h0 / 2;
        this.dots.push({ x: px, y: py, r: Math.sqrt(dx * dx + dy * dy) });
      }
      this.maxR = Math.sqrt(w0 * w0 + h0 * h0) / 2;
    },
    draw: function (c, w0, h0, p, alpha, dt) {
      var t = S.t, P = S.pointer, D = this.dots, i, o;
      var out = U.smooth(U.clamp((p - 0.45) / 0.55, 0, 1));   // scrolls away
      var born = S.ready ? U.clamp((t - SY.readyAt) * 0.42, 0, 1) : 0;

      c.globalCompositeOperation = 'lighter';
      for (i = 0; i < D.length; i++) {
        o = D[i];
        var appear = U.clamp(born * 2.2 - (o.r / this.maxR) * 1.15, 0, 1);
        if (appear <= 0) continue;

        var v = Math.sin(o.x * 0.0062 + o.y * 0.0104 - t * 0.85) * 0.5 + 0.5;
        var v2 = Math.sin(o.x * -0.0031 + o.y * 0.0057 + t * 0.42) * 0.5 + 0.5;
        var e = v * v * v * v * v * 1.5 + v2 * v2 * 0.3;

        var dx = o.x - P.x, dy = o.y - P.y;
        var dist2 = dx * dx + dy * dy;
        if (dist2 < 62500) { var f = 1 - Math.sqrt(dist2) / 250; e += f * f * 2.1; }
        e += rip(o.x, o.y) * 1.8;

        var push = out * 190 * (o.r / this.maxR);
        var ang = Math.atan2(o.y - h0 / 2, o.x - w0 / 2);
        var sx = o.x + Math.cos(ang) * push, sy = o.y + Math.sin(ang) * push;

        // birth: everything travels out of a single point at the centre
        if (appear < 1) {
          var bz = appear * appear * (3 - 2 * appear);
          sx = U.lerp(w0 / 2, sx, bz);
          sy = U.lerp(h0 / 2, sy, bz);
        }

        var a = U.clamp((0.07 + e * 0.72) * appear * (1 - out * 0.85), 0, 1);
        if (a < 0.01) continue;
        band(a).push(sx, sy, (0.55 + e * 1.5) * (1 - out * 0.4));
      }
      flush(c);
      c.globalCompositeOperation = 'source-over';
    }
  };

  /* ══ 001 · DOT ════════════════════════════════════════════
     흩어짐 → 격자 → 원 → 황금나선 → 흩어짐                     */
  var dot = {
    name: 'dot',
    resize: function (w0, h0) {
      var N = (this.N = w0 < 700 ? 620 : w0 < 1200 ? 1100 : 1600);
      SY.info.dots = N;
      var R = Math.min(w0, h0) * 0.33;
      var cols = Math.round(Math.sqrt(N * (w0 / h0)));
      var rows = Math.ceil(N / cols);
      var gw = Math.min(w0 * 0.56, h0 * 1.05), gh = h0 * 0.58;
      var ps = (this.ps = []);
      for (var i = 0; i < N; i++) {
        var cx = i % cols, cy = Math.floor(i / cols);
        var grid = [
          w0 / 2 + (cx / (cols - 1) - 0.5) * gw,
          h0 / 2 + (cy / Math.max(1, rows - 1) - 0.5) * gh
        ];
        var ang = (i / N) * Math.PI * 2;
        var thick = (U.hash(i, 7) - 0.5) * 9;
        var ring = [w0 / 2 + Math.cos(ang) * (R + thick), h0 / 2 + Math.sin(ang) * (R + thick)];
        var ga = i * 2.39996323, gr = Math.sqrt(i / N) * R * 1.42;
        var spir = [w0 / 2 + Math.cos(ga) * gr, h0 / 2 + Math.sin(ga) * gr];
        var sa = U.hash(i, 3) * Math.PI * 2, sr = (0.35 + U.hash(i, 11)) * Math.max(w0, h0) * 0.8;
        var scat = [w0 / 2 + Math.cos(sa) * sr, h0 / 2 + Math.sin(sa) * sr * 0.7];
        ps.push({
          x: scat[0], y: scat[1], vx: 0, vy: 0,
          f: [scat, grid, ring, spir, scat], s: U.hash(i, 23)
        });
      }
    },
    draw: function (c, w0, h0, p, alpha, dt) {
      var Q = q(p), ps = this.ps, P = S.pointer, i, o;
      var stage = Q * 4;                       // 0..4 across five formations
      var a0 = Math.min(3, Math.floor(stage));
      // dwell: each formation holds before it becomes the next
      var mv = U.clamp((stage - a0 - 0.16) / 0.62, 0, 1);
      var mix = mv * mv * mv * (mv * (mv * 6 - 15) + 10);
      var names = ['DISPERSED', 'GRID', 'RING', 'PHI', 'RELEASED'];
      var st = U.clamp(Math.round(stage), 0, 4);
      SY.info.state = names[st];
      if (st !== this.lastSt) {            // a formation locking in has a sound
        if (this.lastSt !== undefined) SY.audio.pluck(0.34 + st * 0.12, 0.55);
        this.lastSt = st;
      }

      var rot = (Q - 0.5) * 0.9 + S.t * 0.045;
      var cr = Math.cos(rot), sr = Math.sin(rot);
      var k = 1 - Math.pow(0.0006, dt);

      for (i = 0; i < ps.length; i++) {
        o = ps[i];
        var A = o.f[a0], B = o.f[a0 + 1];
        var tx = A[0] + (B[0] - A[0]) * mix;
        var ty = A[1] + (B[1] - A[1]) * mix;
        // rotate the formation about centre (only the ordered ones)
        if (a0 >= 2 && a0 <= 3) {
          var rx = tx - w0 / 2, ry = ty - h0 / 2;
          tx = w0 / 2 + rx * cr - ry * sr;
          ty = h0 / 2 + rx * sr + ry * cr;
        }
        o.vx += (tx - o.x) * k * (0.55 + o.s * 0.5);
        o.vy += (ty - o.y) * k * (0.55 + o.s * 0.5);

        var dx = o.x - P.x, dy = o.y - P.y, dd = dx * dx + dy * dy;
        if (dd < 30000 && dd > 0.01) {
          var dist = Math.sqrt(dd), fo = (1 - dist / 173);
          o.vx += (dx / dist) * fo * fo * 340 * dt;
          o.vy += (dy / dist) * fo * fo * 340 * dt;
        }
        o.vx *= 0.90; o.vy *= 0.90;
        o.x += o.vx; o.y += o.vy;
        o.d = Math.abs(tx - o.x) + Math.abs(ty - o.y);
      }

      // constellation: a cohort spread across the whole formation, so the air stays thin
      var L = 190, stride = Math.max(1, Math.floor(ps.length / L));
      c.lineWidth = 1;
      c.globalCompositeOperation = 'lighter';
      for (i = 0; i < ps.length; i += stride) {
        var a = ps[i];
        for (var j = i + stride; j < ps.length; j += stride) {
          var b = ps[j], ddx = a.x - b.x, ddy = a.y - b.y;
          var m = ddx * ddx + ddy * ddy;
          if (m > 8100) continue;
          var al = (1 - Math.sqrt(m) / 90) * 0.115;
          c.strokeStyle = 'rgba(' + IVORY + ',' + al.toFixed(3) + ')';
          c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
        }
      }

      for (i = 0; i < ps.length; i++) {
        o = ps[i];
        var settle = U.clamp(1 - o.d / 60, 0, 1);
        var al2 = Math.min(1, (0.16 + settle * 0.62) * (0.6 + rip(o.x, o.y) * 1.4));
        band(al2).push(o.x, o.y, 0.7 + settle * 0.9 + (i % 47 === 0 ? 0.9 : 0));
      }
      flush(c);
      c.globalCompositeOperation = 'source-over';
    }
  };

  /* ══ 002 · LINE ═══════════════════════════════════════════
     일곱 개의 선, 하나의 재생선. 화면이 스스로를 연주한다.        */
  var line = {
    name: 'line',
    V: 7,
    resize: function () {
      this.voices = [];
      for (var i = 0; i < this.V; i++) {
        this.voices.push({
          f1: 0.0016 + i * 0.00042, f2: 0.0041 + i * 0.00075, f3: 0.0092 - i * 0.0004,
          a1: 52 + i * 8, a2: 23 - i * 1.4, a3: 8,
          sp: 0.24 + i * 0.055, ph: i * 1.37, prev: 0, pslope: 0
        });
      }
      this.flash = [];
      this.pts = [];
    },
    y: function (v, x, cy, spread, idx, amp, t) {
      var base = cy + (idx - (this.V - 1) / 2) * spread;
      return base
        + Math.sin(x * v.f1 + t * v.sp + v.ph) * v.a1 * amp
        + Math.sin(x * v.f2 - t * v.sp * 1.6 + v.ph * 2) * v.a2 * amp
        + Math.sin(x * v.f3 + t * v.sp * 0.7) * v.a3 * amp;
    },
    draw: function (c, w0, h0, p, alpha, dt) {
      var Q = q(p), t = S.t, P = S.pointer, cy = h0 * 0.5;
      var amp = (Math.pow(Math.sin(Math.PI * U.clamp(Q, 0, 1)), 0.6) * 1.05 + 0.05) * (1 + Math.abs(S.sv) * 0.055);
      var spread = U.lerp(h0 * 0.052, h0 * 0.008, Math.pow(U.clamp((Q - 0.55) / 0.45, 0, 1), 1.4));
      var step = w0 < 700 ? 8 : 5;

      // staff — numerals of the score
      c.strokeStyle = 'rgba(' + IVORY + ',0.045)';
      c.lineWidth = 1;
      for (var g = 0; g <= 24; g++) {
        var gx = (w0 / 24) * g;
        c.beginPath(); c.moveTo(gx, h0 * 0.24); c.lineTo(gx, h0 * 0.76); c.stroke();
      }
      c.strokeStyle = 'rgba(' + IVORY + ',0.09)';
      c.beginPath(); c.moveTo(0, cy); c.lineTo(w0, cy); c.stroke();

      var head = ((t * 0.085) % 1) * w0;
      c.globalCompositeOperation = 'lighter';

      for (var i = 0; i < this.V; i++) {
        var v = this.voices[i];
        var wgt = 1 - Math.abs(i - (this.V - 1) / 2) / this.V;
        c.lineWidth = 0.7 + wgt * 0.9;
        c.strokeStyle = 'rgba(' + IVORY + ',' + (0.10 + wgt * 0.34).toFixed(3) + ')';
        c.beginPath();
        var first = true, pts = this.pts; pts.length = 0;
        for (var x = -step; x <= w0 + step; x += step) {
          var y = this.y(v, x, cy, spread, i, amp, t);
          var dxp = x - P.x;
          var gsn = Math.exp(-(dxp * dxp) / 64800);
          y += (P.y - y) * gsn * 0.55;
          var rr = rip(x, y);
          if (rr > 0) y -= rr * 26;
          if (first) { c.moveTo(x, y); first = false; } else c.lineTo(x, y);
          pts.push(x, y);
        }
        c.stroke();

        // the line remembers that it is made of points
        c.fillStyle = 'rgba(' + IVORY + ',' + (0.10 + wgt * 0.30).toFixed(3) + ')';
        for (var pi = 0; pi < pts.length; pi += 16) {
          c.beginPath(); c.arc(pts[pi], pts[pi + 1], 1.05, 0, 6.2832); c.fill();
        }

        // reflection — the melody's shadow
        c.save();
        c.globalAlpha = alpha * 0.16;
        c.translate(0, cy * 2); c.scale(1, -1);
        c.stroke();
        c.restore();

        // playhead reading the curve: peaks become notes
        var hy = this.y(v, head, cy, spread, i, amp, t);
        var hy2 = this.y(v, head + 4, cy, spread, i, amp, t);
        var slope = hy2 - hy;
        if (((v.pslope < 0 && slope >= 0) || (v.pslope > 0 && slope <= 0)) && amp > 0.22) {
          this.flash.push({ x: head, y: hy, t: 0 });   // every turn of a line is a note
          SY.audio.pluck(hy / h0, 0.45 + wgt * 0.5);
          SY.info.hz = (261.63 * Math.pow(2, (this.V - i) / 12)).toFixed(2);
        }
        v.pslope = slope;
      }

      // playhead
      c.strokeStyle = 'rgba(' + IVORY + ',0.22)';
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(head, h0 * 0.2); c.lineTo(head, h0 * 0.8); c.stroke();
      var lg = c.createLinearGradient(head - 130, 0, head, 0);
      lg.addColorStop(0, 'rgba(' + IVORY + ',0)');
      lg.addColorStop(1, 'rgba(' + IVORY + ',0.03)');
      c.fillStyle = lg;
      c.fillRect(head - 130, 0, 130, h0);

      for (var k = this.flash.length - 1; k >= 0; k--) {
        var f = this.flash[k];
        f.t += dt;
        if (f.t > 1.6) { this.flash.splice(k, 1); continue; }
        var fa = 1 - f.t / 1.6;
        c.fillStyle = 'rgba(255,255,255,' + (fa * 0.9).toFixed(3) + ')';
        c.beginPath(); c.arc(f.x, f.y, 1.6 + fa * 1.4, 0, 6.2832); c.fill();
        c.strokeStyle = 'rgba(' + IVORY + ',' + (fa * 0.22).toFixed(3) + ')';
        c.lineWidth = 1;
        c.beginPath(); c.arc(f.x, f.y, 4 + (1 - fa) * 34, 0, 6.2832); c.stroke();
      }
      c.globalCompositeOperation = 'source-over';
      SY.info.phase = ((t * 0.085) % 1).toFixed(3);
    }
  };

  /* ══ 003 · WORLD ══════════════════════════════════════════
     대륙이 점이 된다. 가운데가 열리고, 다시 닫힌다.              */
  var world = {
    name: 'world',
    resize: function () {
      if (this.cells) return;
      var M = w.SY_MAP, cells = (this.cells = []);
      for (var y = 0; y < M.rows; y++) {
        var row = M.data[y];
        for (var x = 0; x < M.cols; x++) if (row.charCodeAt(x) === 49) cells.push(x, y);
      }
      this.cols = M.cols; this.rows = M.rows;
      SY.info.land = cells.length / 2;
      // deterministic arcs between land points
      var arcs = (this.arcs = []), n = cells.length / 2;
      for (var i = 0; i < 6; i++) {
        var a = Math.floor(U.hash(i, 1.7) * n), b = Math.floor(U.hash(i, 9.3) * n);
        arcs.push({ ax: cells[a * 2], ay: cells[a * 2 + 1], bx: cells[b * 2], by: cells[b * 2 + 1], o: U.hash(i, 5) });
      }
    },
    draw: function (c, w0, h0, p, alpha, dt) {
      var Q = q(p), t = S.t, P = S.pointer, C = this.cells;
      var cols = this.cols, rows = this.rows;
      var cell = Math.min((w0 * 0.88) / cols, (h0 * 0.66) / rows);
      var ox = (w0 - cols * cell) / 2, oy = (h0 - rows * cell) / 2 - h0 * 0.07;
      var split = Math.pow(Math.sin(Math.PI * U.clamp(Q, 0, 1)), 1.4) * w0 * 0.075;
      var drift = t * 1.35 + Q * 26;
      var dcol = Math.floor(drift) % cols;
      SY.info.drift = drift;

      var scan = (((t * 0.16) % 1.35) - 0.17) * rows;
      var base = cell * 0.32;
      var LENS = 5200 * U.clamp(alpha * 1.4 - 0.4, 0, 1);
      SY.info.lens = Math.sqrt(LENS);

      c.globalCompositeOperation = 'lighter';
      for (var i = 0; i < C.length; i += 2) {
        var gx = C[i], gy = C[i + 1];
        var xc = (gx + dcol) % cols;
        var side = xc < cols / 2 ? -1 : 1;
        var x = ox + xc * cell + cell / 2 + side * split;
        var y = oy + gy * cell + cell / 2;

        // gravitational lens: the cursor is a mass, and the fabric obeys it
        var lx = x - P.x, ly = y - P.y, l2 = lx * lx + ly * ly;
        if (l2 < 250000 && l2 > 1) {
          var ld = Math.sqrt(l2), bend = LENS / (ld + 26);
          x += (lx / ld) * bend; y += (ly / ld) * bend;
        }

        var wv = 0.5 + 0.5 * Math.sin(t * 1.15 - gx * 0.055 + gy * 0.09);
        var e = 0.22 + wv * 0.5;

        var sd = Math.abs(gy - scan);
        if (sd < 2.2) e += (1 - sd / 2.2) * 1.5;

        var dx = x - P.x, dy = y - P.y, dd = dx * dx + dy * dy;
        if (dd < 36100) { var f = 1 - Math.sqrt(dd) / 190; e += f * f * 1.6; }
        e += rip(x, y) * 2;

        var hs = U.hash(gx, gy);
        if ((hs * 41.3 + t * 0.22) % 1 > 0.9965) {
          e += 2.4;
          if (t - (this.rang || 0) > 1.15) { this.rang = t; SY.audio.pluck(gy / rows, 0.3); }
        }

        band(Math.min(1, e)).push(x, y, base * (0.55 + Math.min(e, 2.2) * 0.5));
      }
      flush(c);

      // travelling arcs
      for (var a = 0; a < this.arcs.length; a++) {
        var A = this.arcs[a];
        var axc = (A.ax + dcol) % cols, bxc = (A.bx + dcol) % cols;
        if (Math.abs(axc - bxc) > cols * 0.45) continue;   // skip wrapped pairs
        var x1 = ox + axc * cell, y1 = oy + A.ay * cell;
        var x2 = ox + bxc * cell, y2 = oy + A.by * cell;
        x1 += (axc < cols / 2 ? -1 : 1) * split;
        x2 += (bxc < cols / 2 ? -1 : 1) * split;
        var mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.abs(x2 - x1) * 0.32 - 40;
        c.strokeStyle = 'rgba(' + IVORY + ',0.10)';
        c.lineWidth = 1;
        c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo(mx, my, x2, y2); c.stroke();
        var u = ((t * 0.22 + A.o) % 1);
        var iv = 1 - u;
        var px = iv * iv * x1 + 2 * iv * u * mx + u * u * x2;
        var py = iv * iv * y1 + 2 * iv * u * my + u * u * y2;
        var fade = Math.sin(u * Math.PI);
        c.fillStyle = 'rgba(255,255,255,' + (fade * 0.85).toFixed(3) + ')';
        c.beginPath(); c.arc(px, py, 1.7, 0, 6.2832); c.fill();
      }

      // the rift
      if (split > 2) {
        var gx2 = c.createLinearGradient(w0 / 2 - split, 0, w0 / 2 + split, 0);
        gx2.addColorStop(0, 'rgba(' + IVORY + ',0)');
        gx2.addColorStop(0.5, 'rgba(' + IVORY + ',' + (0.05 * (split / (w0 * 0.075))).toFixed(3) + ')');
        gx2.addColorStop(1, 'rgba(' + IVORY + ',0)');
        c.fillStyle = gx2;
        c.fillRect(w0 / 2 - split, oy - cell, split * 2, rows * cell + cell * 2);
      }
      c.globalCompositeOperation = 'source-over';
    }
  };

  /* ══ 004 · FORM ═══════════════════════════════════════════
     빛을 0과 1로 번역한다. 회전하는 환(環).                     */
  var form = {
    name: 'form',
    resize: function (w0, h0) {
      var k = w0 < 700 ? 0.8 : 1;
      this.cw = 8 * k; this.ch = 10 * k;
      this.cols = Math.ceil(w0 / this.cw);
      this.rows = Math.ceil(h0 / this.ch);
      var n = this.cols * this.rows;
      this.z = new Float32Array(n);
      this.l = new Float32Array(n);
      SY.info.cells = n;
      this.noiseAt = -9;
      this.noise = d.createElement('canvas');
      this.noise.width = Math.floor(w0); this.noise.height = Math.floor(h0);
    },
    bake: function (w0, h0) {
      // faint static field of digits behind the form
      var n = this.noise.getContext('2d');
      n.clearRect(0, 0, w0, h0);
      n.font = '300 ' + (this.ch - 2) + 'px "JetBrains Mono", monospace';
      n.textBaseline = 'top';
      var seed = Math.floor(S.t * 1.5);
      for (var y = 0; y < this.rows; y++) {
        for (var x = 0; x < this.cols; x++) {
          var hs = U.hash(x + seed * 3.1, y - seed * 1.7);
          if (hs > 0.20) continue;
          n.fillStyle = 'rgba(' + IVORY + ',' + (0.035 + hs * 0.28).toFixed(3) + ')';
          n.fillText(hs > 0.1 ? '1' : '0', x * this.cw, y * this.ch);
        }
      }
      this.noiseAt = S.t;
    },
    draw: function (c, w0, h0, p, alpha, dt) {
      var Q = q(p), t = S.t, cols = this.cols, rows = this.rows;
      var z = this.z, l = this.l, n = cols * rows, i;
      for (i = 0; i < n; i++) { z[i] = 0; l[i] = 0; }

      if (t - this.noiseAt > 0.42) this.bake(w0, h0);
      c.drawImage(this.noise, 0, 0, w0, h0);

      var A = t * 0.42 + Q * 2.6 + S.sv * 0.02, B = t * 0.27 + Q * 1.1 - S.sv * 0.012;
      var cA = Math.cos(A), sA = Math.sin(A), cB = Math.cos(B), sB = Math.sin(B);
      var R1 = 1, R2 = 2.1, K2 = 5.6;
      var grow = U.lerp(0.84, 1.18, U.smooth(U.clamp(Q * 1.25, 0, 1)));
      // fit to whichever axis is tighter, so narrow screens keep the whole body
      var K1 = Math.min(rows * 2.2, cols * 1.6) * K2 / (8 * (R1 + R2)) * grow;
      var P = S.pointer;
      var tilt = (P.y / h0 - 0.5) * 0.5;
      var cT = Math.cos(tilt), sT = Math.sin(tilt);

      for (var th = 0; th < 6.2832; th += 0.055) {
        var ct = Math.cos(th), st = Math.sin(th);
        for (var ph = 0; ph < 6.2832; ph += 0.017) {
          var cp = Math.cos(ph), sp = Math.sin(ph);
          var cx = R2 + R1 * ct, cy = R1 * st;
          var x = cx * (cB * cp + sA * sB * sp) - cy * cA * sB;
          var y = cx * (sB * cp - sA * cB * sp) + cy * cA * cB;
          var zz = K2 + cA * cx * sp + cy * sA;
          // extra tilt so the ring answers the cursor
          var y2 = y * cT - (zz - K2) * sT;
          var z2 = (zz - K2) * cT + y * sT + K2;
          var ooz = 1 / z2;
          var sx = (cols >> 1) + (K1 * 1.9) * ooz * x | 0;
          var sy = (rows >> 1) - K1 * ooz * y2 | 0;
          if (sx < 0 || sx >= cols || sy < 0 || sy >= rows) continue;
          var L = cp * ct * sB - cA * ct * sp - sA * st + cB * (cA * st - ct * sA * sp);
          if (L <= 0) continue;
          var idx = sx + sy * cols;
          if (ooz > z[idx]) { z[idx] = ooz; l[idx] = L * 0.707; }
        }
      }

      // chiaroscuro: light from above, darkness eating the edges,
      // and a silhouette that dissolves into the field of digits
      var buckets = [[], [], [], [], [], [], []];
      var cxp = cols * 0.5, cyp = rows * 0.5, seed = Math.floor(t * 2.5);
      for (var yy = 0; yy < rows; yy++) {
        var vert = U.clamp(1.32 - (yy / rows) * 1.28, 0, 1.2);
        for (var xx = 0; xx < cols; xx++) {
          var id = xx + yy * cols;
          var lum = l[id];
          if (lum <= 0.01) continue;
          var dx = (xx - cxp) / cols, dy = (yy - cyp) / rows;
          var fall = 1 - U.clamp(Math.sqrt(dx * dx * 1.5 + dy * dy * 1.1) * 1.35, 0, 1);
          lum *= (0.34 + vert * 0.82) * (0.42 + fall * 1.05);
          if (lum <= 0.03) continue;
          // sparse where dim, dense where bright — the form melts at its edges
          if (U.hash(xx * 3.1 + seed, yy * 1.7 - seed) > 0.1 + lum * 1.7) continue;
          var b = U.clamp(Math.floor(lum * 7.4), 0, 6);
          buckets[b].push(xx * this.cw, yy * this.ch, U.hash(xx * 1.7 + seed, yy) > 0.5 ? 1 : 0);
        }
      }

      c.font = '400 ' + (this.ch - 2) + 'px "JetBrains Mono", ui-monospace, monospace';
      c.textBaseline = 'top';
      var al = [0.12, 0.22, 0.36, 0.52, 0.7, 0.88, 1];
      for (var b3 = 0; b3 < 7; b3++) {
        var arr = buckets[b3];
        if (!arr.length) continue;
        c.fillStyle = b3 === 6 ? 'rgba(255,255,255,1)' : 'rgba(' + IVORY + ',' + al[b3] + ')';
        for (var kk = 0; kk < arr.length; kk += 3) {
          c.fillText(arr[kk + 2] ? '1' : '0', arr[kk], arr[kk + 1]);
        }
      }
      SY.info.rot = A.toFixed(2) + ' / ' + B.toFixed(2);
    }
  };


  /* ══ 005 · DIMENSION ══════════════════════════════════════
     여덟 개의 정육면체가 한 몸을 이룬다. 안이 밖이 되고,
     밖이 다시 안이 된다. 우리에게 닿는 것은 그림자뿐이다.      */
  var dim = {
    name: 'dim',
    resize: function () {
      var V = (this.V = []), i, a, b;
      for (i = 0; i < 16; i++) V.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
      var E = (this.E = []);
      for (a = 0; a < 16; a++) for (b = a + 1; b < 16; b++) {
        var x = a ^ b;
        if ((x & (x - 1)) === 0) E.push(a, b);        // one coordinate apart → an edge
      }
      this.P = [];
      for (i = 0; i < 16; i++) this.P.push([0, 0, 0, 0]);
    },
    draw: function (c, w0, h0, p, alpha, dt) {
      var Q = q(p), t = S.t, P = S.pointer, V = this.V, E = this.E, pr = this.P, i, self = this;
      var cx = w0 * 0.5, cy = h0 * 0.5;
      var base = Math.min(w0, h0) * 0.21 * U.lerp(0.8, 1.2, U.smooth(Q));

      // three of the six planes of rotation — two of them leave our world
      var axw = t * 0.27 + Q * 2.4 + (P.x / w0 - 0.5) * 2.6;
      var ayz = t * 0.19 + (P.y / h0 - 0.5) * 1.9;
      var axy = t * 0.085;

      // one of the eight cells burns brighter, and hands the light to the next
      var cell = Math.floor(t * 0.17) % 8;
      var axis = cell >> 1, sign = (cell & 1) ? 1 : -1;
      SY.info.cell = (cell + 1) + ' / 8';
      if (cell !== this.lastCell) {
        if (this.lastCell !== undefined) SY.audio.pluck(0.26 + cell * 0.085, 0.6);
        this.lastCell = cell;
      }
      SY.info.w = (Math.sin(axw) >= 0 ? '+' : '−') + Math.abs(Math.sin(axw)).toFixed(3);

      function project(scale, sgn) {
        var c1 = Math.cos(axw * sgn), s1 = Math.sin(axw * sgn);
        var c2 = Math.cos(ayz * sgn), s2 = Math.sin(ayz * sgn);
        var c3 = Math.cos(axy), s3 = Math.sin(axy);
        for (var j = 0; j < 16; j++) {
          var v = V[j], x = v[0], y = v[1], z = v[2], ww = v[3];
          var nx = x * c1 - ww * s1; ww = x * s1 + ww * c1; x = nx;
          var ny = y * c2 - z * s2; z = y * s2 + z * c2; y = ny;
          var nx2 = x * c3 - y * s3; y = x * s3 + y * c3; x = nx2;
          var f4 = 2.35 / (3.15 - ww);            // 4D → 3D
          x *= f4; y *= f4; z *= f4;
          var f3 = 3.1 / (4.1 - z);               // 3D → 2D
          var o = pr[j];
          o[0] = cx + x * f3 * scale;
          o[1] = cy + y * f3 * scale;
          o[2] = U.clamp((ww + 1.25) / 2.5, 0, 1);   // how far along the fourth axis
        }
      }

      function render(mul, dots) {
        for (var k = 0; k < E.length; k += 2) {
          var A = pr[E[k]], B = pr[E[k + 1]];
          var inCell = (V[E[k]][axis] === sign && V[E[k + 1]][axis] === sign);
          var w4 = (A[2] + B[2]) * 0.5;
          var lit = (inCell ? 1.55 : 1) * (0.22 + w4 * 0.9) * mul;
          if (dots) {
            var n = 26;
            for (var u = 0; u <= n; u++) {
              var f = u / n;
              var dpt = A[2] + (B[2] - A[2]) * f;
              var pulse = 0.72 + 0.28 * Math.sin(t * 2.1 - f * 5.2 + k);
              band(Math.min(1, lit * (0.16 + dpt * 0.62) * pulse))
                .push(A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f,
                      (0.45 + dpt * 1.15) * (inCell ? 1.25 : 1));
            }
          }
          c.strokeStyle = 'rgba(' + IVORY + ',' + (0.028 + w4 * 0.055 * (inCell ? 2.2 : 1)) * mul + ')';
          c.lineWidth = 1;
          c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke();
        }
        if (dots) flush(c);
      }

      c.globalCompositeOperation = 'lighter';

      // the shadow of the shadow: the same body, turned the other way through w
      project(base * 2.15, -1);
      render(0.3, false);
      for (i = 0; i < 16; i++) {
        c.fillStyle = 'rgba(' + IVORY + ',' + (0.05 + pr[i][2] * 0.16).toFixed(3) + ')';
        c.beginPath(); c.arc(pr[i][0], pr[i][1], 0.9 + pr[i][2] * 1.2, 0, 6.2832); c.fill();
      }

      // and the body itself
      project(base, 1);
      render(1, true);
      for (i = 0; i < 16; i++) {
        var o4 = pr[i];
        c.fillStyle = 'rgba(255,255,255,' + (0.2 + o4[2] * 0.8).toFixed(3) + ')';
        c.beginPath(); c.arc(o4[0], o4[1], 1.1 + o4[2] * 2.3, 0, 6.2832); c.fill();
      }

      // the horizon it does not belong to
      var hy = cy + Math.min(w0, h0) * 0.4;
      var g = c.createLinearGradient(cx - w0 * 0.42, 0, cx + w0 * 0.42, 0);
      g.addColorStop(0, 'rgba(' + IVORY + ',0)');
      g.addColorStop(0.5, 'rgba(' + IVORY + ',0.1)');
      g.addColorStop(1, 'rgba(' + IVORY + ',0)');
      c.fillStyle = g;
      c.fillRect(cx - w0 * 0.42, hy, w0 * 0.84, 1);
      c.globalCompositeOperation = 'source-over';
    }
  };

  /* ══ 006 · SILENCE ════════════════════════════════════════
     모든 것이 하나의 점으로. 그리고 하나의 선으로.               */
  var silence = {
    name: 'silence',
    resize: function (w0, h0) {
      var N = (this.N = w0 < 700 ? 320 : 720), ps = (this.ps = []);
      for (var i = 0; i < N; i++) {
        var a = U.hash(i, 2.3) * Math.PI * 2;
        var r = (0.25 + U.hash(i, 8.1) * 0.85) * Math.max(w0, h0) * 0.55;
        ps.push({ a: a, r: r, s: U.hash(i, 13), x: 0, y: 0 });
      }
    },
    draw: function (c, w0, h0, p, alpha, dt) {
      var Q = q(p), t = S.t, cx = w0 / 2, cy = h0 * 0.72, i, o;
      var pull = U.smooth(U.clamp(Q / 0.62, 0, 1));
      if (pull > 0.45 && !this.rang) { this.rang = 1; SY.audio.pluck(0.97, 0.9); }
      if (pull < 0.15) this.rang = 0;
      c.globalCompositeOperation = 'lighter';
      for (i = 0; i < this.ps.length; i++) {
        o = this.ps[i];
        var ease = Math.pow(pull, 1 + o.s * 1.6);
        var r = o.r * (1 - ease);
        var ang = o.a + ease * (1.4 + o.s) + t * 0.03;
        var x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r * 0.72;
        var a = (0.1 + (1 - ease) * 0.55) * (1 - Math.pow(pull, 3) * 0.9);
        if (a < 0.012) continue;
        band(Math.min(1, a)).push(x, y, 0.7 + (1 - ease) * 0.8);
      }
      flush(c);

      // the last line
      var open = U.smooth(U.clamp((Q - 0.5) / 0.5, 0, 1));
      var half = open * w0 * 0.34;
      if (half > 1) {
        var g = c.createLinearGradient(cx - half, 0, cx + half, 0);
        g.addColorStop(0, 'rgba(' + IVORY + ',0)');
        g.addColorStop(0.5, 'rgba(' + IVORY + ',' + (0.5 * open).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(' + IVORY + ',0)');
        c.fillStyle = g;
        c.fillRect(cx - half, cy - 0.5, half * 2, 1);
      }

      // the last dot
      var pulse = 0.5 + 0.5 * Math.sin(t * 1.5);
      var rg = c.createRadialGradient(cx, cy, 0, cx, cy, 46 + pulse * 26);
      rg.addColorStop(0, 'rgba(255,255,255,' + (0.16 + pulse * 0.1).toFixed(3) + ')');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = rg;
      c.beginPath(); c.arc(cx, cy, 46 + pulse * 26, 0, 6.2832); c.fill();
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(cx, cy, 1.6 + pulse * 0.9, 0, 6.2832); c.fill();
      c.globalCompositeOperation = 'source-over';
    }
  };

  SY.scenes = [field, dot, line, world, form, dim, silence];

})(window, document);
