// js/store.js — PROJECT MAYHEM state + persistence + derived stats
//
// Zero-dependency ES module. No imports. Works in the browser and parses/loads
// under Node (localStorage is guarded with an in-memory fallback).
//
// NOTE ON assign() SIGNATURE (intentional deviation from the loose contract):
//   The STORE CONTRACT sketches `assign(challengeId)`, but complete() needs to
//   know the active challenge's category and its `tracks` (ledger deltas) to do
//   its job, and store.js must stay DECOUPLED from data.js (no imports).
//   SOLUTION: assign() takes the FULL challenge object and snapshots what it
//   needs onto the active record.
//
//     assign(challenge)  where challenge = { id, cat, tracks? }
//     -> stores active = { id, cat, tracks, date }
//
//   complete() then reads active.cat / active.tracks directly. This keeps the
//   store self-contained and lets it apply ledger deltas without ever touching
//   the content module.

const STORAGE_KEY = 'mayhem.v1';

// --- localStorage guard (Node has no localStorage) -------------------------
const storage = (() => {
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  // In-memory fallback so the module works under Node for testing.
  const mem = Object.create(null);
  return {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; },
  };
})();

// --- date helpers ----------------------------------------------------------
function pad2(n) { return n < 10 ? '0' + n : '' + n; }

function keyFromDate(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

// LOCAL date 'YYYY-MM-DD' (built from local getters, NOT toISOString).
function todayKey() {
  return keyFromDate(new Date());
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return keyFromDate(d);
}

// --- default state ---------------------------------------------------------
function defaultState() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    name: '',
    streak: { current: 0, longest: 0, lastDate: null },
    completed: [],   // [{id,date,note,cat}]
    skipped: [],     // [{id,date}]
    ledger: { released: 0, reclaimed: 0, awakeDays: 0 },
    active: null,    // {id,cat,tracks,date} | null
    settings: { currency: '$' },
  };
}

// --- validation ------------------------------------------------------------
function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function num(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }
function nonNeg(v) { const n = num(v); return n > 0 ? n : 0; }

// Coerce an arbitrary parsed object into a valid state shape. Never throws.
function coerceState(raw) {
  if (!isObj(raw)) return null;
  const d = defaultState();
  const out = {
    version: 1,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : d.createdAt,
    name: typeof raw.name === 'string' ? raw.name : '',
    streak: { current: 0, longest: 0, lastDate: null },
    completed: [],
    skipped: [],
    ledger: { released: 0, reclaimed: 0, awakeDays: 0 },
    active: null,
    settings: { currency: '$' },
  };

  if (isObj(raw.streak)) {
    out.streak.current = nonNeg(raw.streak.current);
    out.streak.longest = nonNeg(raw.streak.longest);
    out.streak.lastDate = typeof raw.streak.lastDate === 'string' ? raw.streak.lastDate : null;
  }

  if (Array.isArray(raw.completed)) {
    out.completed = raw.completed
      .filter(isObj)
      .map((e) => ({
        id: String(e.id),
        date: String(e.date),
        note: typeof e.note === 'string' ? e.note : '',
        cat: typeof e.cat === 'string' ? e.cat : '',
      }));
  }

  if (Array.isArray(raw.skipped)) {
    out.skipped = raw.skipped
      .filter(isObj)
      .map((e) => ({ id: String(e.id), date: String(e.date) }));
  }

  if (isObj(raw.ledger)) {
    out.ledger.released = nonNeg(raw.ledger.released);
    out.ledger.reclaimed = nonNeg(raw.ledger.reclaimed);
    out.ledger.awakeDays = nonNeg(raw.ledger.awakeDays);
  }

  if (isObj(raw.active) && raw.active.id != null) {
    out.active = {
      id: String(raw.active.id),
      cat: typeof raw.active.cat === 'string' ? raw.active.cat : '',
      tracks: isObj(raw.active.tracks) ? raw.active.tracks : null,
      date: typeof raw.active.date === 'string' ? raw.active.date : todayKey(),
    };
  }

  if (isObj(raw.settings) && typeof raw.settings.currency === 'string') {
    out.settings.currency = raw.settings.currency;
  }

  return out;
}

// --- load / persist --------------------------------------------------------
function load() {
  try {
    const rawStr = storage.getItem(STORAGE_KEY);
    if (!rawStr) return defaultState();
    const parsed = JSON.parse(rawStr);
    const coerced = coerceState(parsed);
    return coerced || defaultState();
  } catch (e) {
    return defaultState();
  }
}

let state = load();

function persist() {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // Storage full or unavailable — keep running with in-memory state.
  }
}

// --- deep copy -------------------------------------------------------------
function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

// --- reactive layer --------------------------------------------------------
const subscribers = new Set();

function subscribe(fn) {
  if (typeof fn !== 'function') return () => {};
  subscribers.add(fn);
  return () => { subscribers.delete(fn); };
}

function notify() {
  const snap = getState();
  subscribers.forEach((fn) => {
    try { fn(snap); } catch (e) { /* subscriber errors must not break the store */ }
  });
}

// Persist + notify after a mutation.
function commit() {
  persist();
  notify();
}

// --- public API ------------------------------------------------------------
function getState() {
  return clone(state);
}

function setName(name) {
  state.name = typeof name === 'string' ? name : '';
  commit();
}

// assign(challenge) — challenge = { id, cat, tracks? }
function assign(challenge) {
  if (!isObj(challenge) || challenge.id == null) return;
  state.active = {
    id: String(challenge.id),
    cat: typeof challenge.cat === 'string' ? challenge.cat : '',
    tracks: isObj(challenge.tracks) ? clone(challenge.tracks) : null,
    date: todayKey(),
  };
  commit();
}

// complete({note}) — completes the current active challenge.
function complete(arg) {
  const active = state.active;
  if (!active) return getState();

  const note = isObj(arg) && typeof arg.note === 'string' ? arg.note : '';
  const today = todayKey();

  // Idempotent per day for the same challenge: skip if already completed today.
  const already = state.completed.some((e) => e.id === active.id && e.date === today);
  if (already) {
    state.active = null;
    commit();
    return getState();
  }

  // Record completion.
  state.completed.push({ id: active.id, date: today, note, cat: active.cat || '' });

  // Streak.
  if (state.streak.lastDate === today) {
    // Already credited a completion today — do not double-count the streak.
  } else if (state.streak.lastDate === yesterdayKey()) {
    state.streak.current = state.streak.current + 1;
  } else {
    state.streak.current = 1;
  }
  if (state.streak.current > state.streak.longest) {
    state.streak.longest = state.streak.current;
  }

  // awakeDays: once per day max (tie to lastDate transition).
  if (state.streak.lastDate !== today) {
    state.ledger.awakeDays = state.ledger.awakeDays + 1;
  }
  state.streak.lastDate = today;

  // Apply the challenge's ledger deltas.
  if (isObj(active.tracks)) {
    state.ledger.released += nonNeg(active.tracks.released);
    state.ledger.reclaimed += nonNeg(active.tracks.reclaimed);
  }

  state.active = null;
  commit();
  return getState();
}

// skip() — records the skip, clears active, no streak credit.
function skip() {
  const active = state.active;
  if (!active) return getState();
  state.skipped.push({ id: active.id, date: todayKey() });
  state.active = null;
  commit();
  return getState();
}

// addLedger({released,reclaimed}) — manual non-negative increments.
function addLedger(arg) {
  if (!isObj(arg)) return getState();
  state.ledger.released += nonNeg(arg.released);
  state.ledger.reclaimed += nonNeg(arg.reclaimed);
  commit();
  return getState();
}

// stats() — derived view.
function stats() {
  const byCat = {};
  const completionDates = [];
  const seenDates = Object.create(null);

  state.completed.forEach((e) => {
    if (e.cat) byCat[e.cat] = (byCat[e.cat] || 0) + 1;
    if (e.date && !seenDates[e.date]) {
      seenDates[e.date] = true;
      completionDates.push(e.date);
    }
  });

  return {
    totalDone: state.completed.length,
    byCat,
    streakCurrent: state.streak.current,
    streakLongest: state.streak.longest,
    released: state.ledger.released,
    reclaimed: state.ledger.reclaimed,
    awakeDays: state.ledger.awakeDays,
    completionDates,
  };
}

// exportJSON() — pretty JSON string of state.
function exportJSON() {
  return JSON.stringify(state, null, 2);
}

// importJSON(str) — validate shape, never throw.
function importJSON(str) {
  if (typeof str !== 'string') {
    return { ok: false, error: 'Import must be a JSON string.' };
  }
  let parsed;
  try {
    parsed = JSON.parse(str);
  } catch (e) {
    return { ok: false, error: 'Invalid JSON.' };
  }
  const coerced = coerceState(parsed);
  if (!coerced) {
    return { ok: false, error: 'Not a valid MAYHEM state object.' };
  }
  state = coerced;
  commit();
  return { ok: true };
}

// reset() — self-destruct to default state.
function reset() {
  state = defaultState();
  try { storage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  commit();
}

export {
  getState,
  subscribe,
  setName,
  assign,
  complete,
  skip,
  addLedger,
  todayKey,
  stats,
  exportJSON,
  importJSON,
  reset,
};
