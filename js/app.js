// PROJECT MAYHEM — app.js. Wiring, routing, rendering. Zero deps.
import { CATEGORIES, CHALLENGES, RULES, MANIFESTO } from './data.js';
import * as store from './store.js';

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return n;
};

const catById = id => CATEGORIES.find(c => c.id === id);
const challengeById = id => CHALLENGES.find(c => c.id === id);
const CUR = () => store.getState().settings?.currency || '$';

// ---------- deterministic "daily" pick (stable per local day) ----------
function seededDaily() {
  const key = store.todayKey();
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  const idx = Math.abs(h) % CHALLENGES.length;
  return CHALLENGES[idx];
}
function randomChallenge() {
  return CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
}

// ---------- toast ----------
let toastTimer;
function toast(msg) {
  let t = $('.toast');
  if (!t) { t = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(t); }
  t.textContent = msg;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------- modal ----------
function openModal(title, bodyNode, { onClose } = {}) {
  const host = $('#modalHost');
  host.innerHTML = '';
  host.hidden = false;
  const close = () => { host.hidden = true; host.innerHTML = ''; onClose && onClose(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  const modal = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    el('button', { class: 'btn ghost close', type: 'button', 'aria-label': 'Close', onclick: close }, '✕'),
    el('h3', {}, title),
    bodyNode
  );
  host.append(modal);
  host.addEventListener('click', e => { if (e.target === host) close(); }, { once: true });
  document.addEventListener('keydown', onKey);
  const focusable = modal.querySelector('textarea, input, button.primary, button');
  focusable && focusable.focus();
  return close;
}

// ---------- views ----------
function viewToday() {
  const s = store.getState();
  const st = store.stats();
  const wrap = el('section', {});

  // greeting
  const hour = new Date().getHours();
  const salute = hour < 5 ? 'STILL AWAKE' : hour < 12 ? 'MORNING' : hour < 18 ? 'AFTERNOON' : 'NIGHT';
  wrap.append(el('p', { class: 'eyebrow' }, `${salute} · ${store.todayKey()}${s.name ? ' · ' + s.name.toUpperCase() : ''}`));

  const active = s.active;
  const doneToday = st.completionDates.includes(store.todayKey());
  let ch = active ? challengeById(active.id) : null;
  if (!ch) ch = seededDaily();
  const cat = catById(ch.cat);

  if (doneToday && !active) {
    // completed today's, offer next / rest
    wrap.append(el('div', { class: 'hero' },
      el('span', { class: 'cat-tag' }, 'DONE FOR TODAY'),
      el('h1', { class: 'assign-title' }, 'YOU SHOWED UP.'),
      el('p', { class: 'assign-brief' }, 'One more day you didn’t sleepwalk through. That’s the whole game.'),
      el('p', { class: 'assign-detail' }, 'Come back tomorrow, or pull another assignment now if you’re hungry. The choice was always yours — that’s the point.'),
      el('div', { class: 'actions' },
        el('button', { class: 'btn primary', onclick: () => { pullSpecific(randomChallenge()); } }, 'ANOTHER'),
        el('a', { class: 'btn ghost', href: '#/assignments' }, 'CHOOSE ONE')
      )
    ));
  } else {
    const hero = el('div', { class: 'hero' },
      el('span', { class: 'cat-tag' }, cat ? cat.name : ch.cat),
      el('h1', { class: 'assign-title' }, ch.title),
      el('p', { class: 'assign-brief' }, ch.brief),
      el('p', { class: 'assign-detail' }, ch.detail),
      el('div', { class: 'meta' },
        el('span', {}, `⏱ ${ch.minutes} MIN`),
        cat && el('span', {}, `◆ ${cat.name}`),
        ch.tracks?.released ? el('span', {}, `▽ RELEASES ${ch.tracks.released}`) : null,
        ch.tracks?.reclaimed ? el('span', {}, `${CUR()} RECLAIMS ${ch.tracks.reclaimed}`) : null
      ),
      el('div', { class: 'actions' },
        el('button', { class: 'btn primary', onclick: () => completeFlow(ch) }, active ? 'MARK COMPLETE' : 'ACCEPT & COMPLETE'),
        el('button', { class: 'btn ghost', onclick: () => { store.skip(); toast('Skipped. No shame — just no credit.'); render(); } }, 'SKIP'),
        el('a', { class: 'btn ghost', href: '#/assignments' }, 'PICK ANOTHER')
      )
    );
    wrap.append(hero);
    if (!active) store.assign({ id: ch.id, cat: ch.cat, tracks: ch.tracks });
  }

  // quick stats
  wrap.append(el('h2', { class: 'sub' }, 'WHERE YOU STAND'));
  wrap.append(statTiles(st));

  return wrap;
}

function pullSpecific(ch) {
  store.assign({ id: ch.id, cat: ch.cat, tracks: ch.tracks });
  location.hash = '#/today';
  render();
}

function statTiles(st) {
  const g = el('div', { class: 'stats' });
  g.append(statTile(st.streakCurrent, 'DAY STREAK', true));
  g.append(statTile(st.totalDone, 'ASSIGNMENTS DONE'));
  g.append(statTile(st.released, 'THINGS RELEASED'));
  g.append(statTile(st.reclaimed, `${CUR()} RECLAIMED`, false, true));
  return g;
}
function statTile(n, k, accent = false, currency = false) {
  const num = currency
    ? el('div', { class: 'n' }, el('span', { class: 'cur' }, CUR()), String(n))
    : el('div', { class: 'n' }, String(n));
  return el('div', { class: 'stat' + (accent ? ' accent' : '') }, num, el('div', { class: 'k' }, k));
}

function completeFlow(ch) {
  const ta = el('textarea', { placeholder: 'What happened? What did it cost the comfortable version of you? (optional)', 'aria-label': 'Note' });
  const body = el('div', {},
    el('p', { class: 'dim', style: 'margin-top:0' }, ch.brief),
    el('label', { class: 'fl' }, 'FIELD REPORT'),
    ta,
    el('div', { class: 'actions' },
      el('button', { class: 'btn primary', onclick: () => {
        // ensure the active matches this challenge
        const cur = store.getState().active;
        if (!cur || cur.id !== ch.id) store.assign({ id: ch.id, cat: ch.cat, tracks: ch.tracks });
        store.complete({ note: ta.value.trim() });
        closeM();
        const gained = [];
        if (ch.tracks?.released) gained.push(`${ch.tracks.released} released`);
        if (ch.tracks?.reclaimed) gained.push(`${CUR()}${ch.tracks.reclaimed} reclaimed`);
        toast('LOGGED.' + (gained.length ? ' ' + gained.join(' · ') : ' Streak alive.'));
        render();
      } }, 'COMMIT')
    )
  );
  const closeM = openModal(ch.title, body);
}

function viewAssignments() {
  const wrap = el('section', {});
  wrap.append(el('p', { class: 'eyebrow' }, 'THE HOMEWORK'));
  wrap.append(el('h1', { class: 'title' }, 'ASSIGNMENTS'));
  wrap.append(el('p', { class: 'lede dim' }, 'Every one of these is a small mutiny against autopilot. Nothing here hurts anyone — least of all frees anyone but you. Pick a fight with your comfort, not a person.'));

  const st = store.stats();
  const doneIds = new Set(store.getState().completed.filter(c => c.date === store.todayKey()).map(c => c.id));
  let filter = sessionState.filter || 'all';

  const filters = el('div', { class: 'filters' });
  const mk = (id, label, acid) => el('button', {
    class: 'chip' + (acid ? ' acid' : ''), type: 'button', 'aria-pressed': String(filter === id),
    onclick: () => { sessionState.filter = id; render(); }
  }, label);
  filters.append(mk('all', 'ALL', true));
  CATEGORIES.forEach(c => filters.append(mk(c.id, c.name)));
  wrap.append(filters);

  const list = CHALLENGES.filter(c => filter === 'all' || c.cat === filter);
  const grid = el('div', { class: 'grid cols-2' });
  list.forEach(ch => {
    const cat = catById(ch.cat);
    const done = doneIds.has(ch.id);
    const card = el('div', {
      class: 'card assign-card' + (done ? ' done' : ''), role: 'button', tabindex: '0',
      'aria-label': `${ch.title}. ${ch.brief}`,
      onclick: () => openAssignment(ch),
      onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAssignment(ch); } }
    },
      el('div', { class: 'row' },
        el('span', { class: 'ac-cat' }, cat ? cat.name : ch.cat),
        el('span', { class: 'ac-min' }, `${ch.minutes}m`)
      ),
      el('div', { class: 'ac-title' }, ch.title),
      el('div', { class: 'ac-brief' }, ch.brief)
    );
    grid.append(card);
  });
  wrap.append(grid);
  return wrap;
}

function openAssignment(ch) {
  const cat = catById(ch.cat);
  const body = el('div', {},
    el('p', { class: 'eyebrow', style: 'margin-bottom:8px' }, `${cat ? cat.name : ch.cat} · ${ch.minutes} MIN`),
    el('p', { class: 'assign-brief', style: 'font-size:17px;color:var(--soap)' }, ch.brief),
    el('p', { class: 'dim' }, ch.detail),
    (ch.tracks?.released || ch.tracks?.reclaimed) ? el('p', { class: 'eyebrow' },
      'MOVES THE LEDGER: ' + [ch.tracks?.released ? `${ch.tracks.released} released` : null,
        ch.tracks?.reclaimed ? `${CUR()}${ch.tracks.reclaimed} reclaimed` : null].filter(Boolean).join(' · ')) : null,
    el('div', { class: 'actions' },
      el('button', { class: 'btn ghost', onclick: () => { pullSpecific(ch); } }, 'SET AS TODAY'),
      el('button', { class: 'btn primary', onclick: () => { closeM(); completeFlow(ch); } }, 'DO IT NOW')
    )
  );
  const closeM = openModal(ch.title, body);
}

function viewLedger() {
  const st = store.stats();
  const s = store.getState();
  const wrap = el('section', {});
  wrap.append(el('p', { class: 'eyebrow' }, 'THE ACCOUNTING'));
  wrap.append(el('h1', { class: 'title' }, 'LEDGER'));
  wrap.append(el('p', { class: 'lede dim' }, 'This is what you’ve let go of, and what you took back. It only counts up. You can add to it by hand — nobody audits you but you.'));

  wrap.append(statTiles(st));

  // add-by-hand
  wrap.append(el('h2', { class: 'sub' }, 'RECORD A RELEASE'));
  const relIn = el('input', { type: 'number', min: '0', step: '1', placeholder: '0', 'aria-label': 'Things released' });
  const recIn = el('input', { type: 'number', min: '0', step: '1', placeholder: '0', 'aria-label': 'Money reclaimed' });
  const addRow = el('div', { class: 'grid cols-3' },
    el('div', {}, el('label', { class: 'fl' }, 'THINGS RELEASED'), relIn),
    el('div', {}, el('label', { class: 'fl' }, `${CUR()} RECLAIMED`), recIn),
    el('div', { style: 'display:flex;align-items:flex-end' },
      el('button', { class: 'btn primary block', onclick: () => {
        const r = Math.max(0, parseInt(relIn.value || '0', 10) || 0);
        const m = Math.max(0, parseInt(recIn.value || '0', 10) || 0);
        if (!r && !m) { toast('Nothing to record.'); return; }
        store.addLedger({ released: r, reclaimed: m });
        toast(`ADDED. ${r ? r + ' released' : ''}${r && m ? ' · ' : ''}${m ? CUR() + m + ' reclaimed' : ''}`);
        render();
      } }, 'ADD'))
  );
  wrap.append(addRow);

  // category breakdown
  wrap.append(el('h2', { class: 'sub' }, 'BY DISCIPLINE'));
  const maxCat = Math.max(1, ...CATEGORIES.map(c => st.byCat[c.id] || 0));
  const bars = el('div', { class: 'catbar' });
  CATEGORIES.forEach(c => {
    const n = st.byCat[c.id] || 0;
    bars.append(el('div', { class: 'cbrow' },
      el('span', {}, c.name),
      el('div', { class: 'track' }, el('div', { class: 'fill', style: `width:${(n / maxCat) * 100}%` })),
      el('span', { class: 'cnt' }, String(n))
    ));
  });
  wrap.append(bars);

  // recent log
  wrap.append(el('h2', { class: 'sub' }, 'FIELD REPORTS'));
  const recent = [...s.completed].reverse().slice(0, 12);
  if (!recent.length) {
    wrap.append(el('div', { class: 'empty' }, 'NOTHING LOGGED YET. GO DO SOMETHING THAT SCARES THE FURNITURE OUT OF YOU.'));
  } else {
    const log = el('div', { class: 'log-list' });
    recent.forEach(e => {
      const ch = challengeById(e.id);
      log.append(el('div', { class: 'log-item' },
        el('span', {}, el('strong', {}, (ch ? ch.title : e.id)), e.note ? el('span', { class: 'note' }, ' — “' + e.note + '”') : null),
        el('span', { class: 'd' }, e.date)
      ));
    });
    wrap.append(log);
  }
  return wrap;
}

function viewManifesto() {
  const wrap = el('section', {});
  wrap.append(el('p', { class: 'eyebrow' }, 'WHY WE DO THIS'));
  wrap.append(el('h1', { class: 'title' }, 'MANIFESTO'));
  const man = el('div', { class: 'manifesto' });
  String(MANIFESTO).split('\n\n').forEach(p => man.append(el('p', {}, p.trim())));
  wrap.append(man);

  wrap.append(el('hr', { class: 'rule' }));
  wrap.append(el('h2', { class: 'sub' }, 'THE RULES OF PROJECT MAYHEM'));
  const ul = el('ul', { class: 'rules' });
  RULES.forEach(r => ul.append(el('li', {}, el('span', {}, r))));
  wrap.append(ul);

  wrap.append(el('hr', { class: 'rule' }));
  wrap.append(el('h2', { class: 'sub' }, 'YOUR NAME (OPTIONAL)'));
  const nameIn = el('input', { type: 'text', maxlength: '40', placeholder: 'What do we call you?', value: store.getState().name || '' });
  wrap.append(el('div', { style: 'max-width:360px' }, nameIn,
    el('button', { class: 'btn', onclick: () => { store.setName(nameIn.value.trim()); toast('NOTED.'); } }, 'SAVE')));
  return wrap;
}

// ---------- router ----------
const ROUTES = { today: viewToday, assignments: viewAssignments, ledger: viewLedger, manifesto: viewManifesto };
const sessionState = { filter: 'all' };

function currentRoute() {
  const h = (location.hash || '#/today').replace(/^#\//, '');
  return ROUTES[h] ? h : 'today';
}

function render() {
  const route = currentRoute();
  const view = $('#view');
  view.innerHTML = '';
  view.append(ROUTES[route]());
  // nav active
  document.querySelectorAll('.nav a').forEach(a => {
    a.toggleAttribute('aria-current', a.dataset.route === route);
    if (a.dataset.route === route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  // streak
  const st = store.stats();
  const sn = $('#streakNum'); if (sn) sn.textContent = String(st.streakCurrent);
  const streakEl = $('.streak'); if (streakEl) streakEl.classList.toggle('cold', st.streakCurrent === 0);
  view.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'auto' });
}

// ---------- footer wiring ----------
function download(name, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function wireFooter() {
  $('#footExport').addEventListener('click', () => {
    download(`project-mayhem-${store.todayKey()}.json`, store.exportJSON());
    toast('EXPORTED. IT’S YOURS.');
  });
  const fileInput = $('#importFile');
  $('#footImport').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = store.importJSON(String(reader.result));
      if (res.ok) { toast('IMPORTED.'); render(); }
      else toast('BAD FILE: ' + (res.error || 'invalid'));
      fileInput.value = '';
    };
    reader.readAsText(f);
  });
  $('#footReset').addEventListener('click', () => {
    const body = el('div', {},
      el('p', { class: 'dim', style: 'margin-top:0' }, 'This erases everything — every streak, every report, the whole ledger. It cannot be undone. Export first if you want proof you were ever here.'),
      el('div', { class: 'actions' },
        el('button', { class: 'btn', onclick: () => { download(`project-mayhem-backup.json`, store.exportJSON()); toast('BACKED UP.'); } }, 'EXPORT FIRST'),
        el('button', { class: 'btn primary', style: 'background:#c9403a;border-color:#c9403a;color:#0a0a0a', onclick: () => { store.reset(); closeM(); toast('GONE. YOU’RE FREE.'); location.hash = '#/today'; render(); } }, 'ERASE IT ALL')
      )
    );
    const closeM = openModal('SELF-DESTRUCT', body);
  });
}

// ---------- boot ----------
window.addEventListener('hashchange', render);
store.subscribe(() => {
  const st = store.stats();
  const sn = $('#streakNum'); if (sn) sn.textContent = String(st.streakCurrent);
});
wireFooter();
if (!location.hash) location.hash = '#/today';
render();
