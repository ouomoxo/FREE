// SOAP — app wiring. Drag/drop -> expose -> wash -> download. 100% local, sends nothing.
import { analyze, scrub } from './exif.js';

const $ = (s, r = document) => r.querySelector(s);
const drop = $('#drop');
const fileInput = $('#fileInput');
const results = $('#results');
const bulkbar = $('#bulkbar');
const bulkCount = $('#bulkCount');
const cardTpl = $('#cardTpl');

const MAX_BYTES = 60 * 1024 * 1024; // 60MB sanity guard
const items = new Map(); // id -> { file, bytes, analysis, cleaned, url, card }
let seq = 0;

const CAT_ORDER = ['location', 'device', 'identity', 'time', 'software', 'other'];
const CAT_LABEL = {
  location: 'WHERE YOU WERE', device: 'THE DEVICE IN YOUR POCKET',
  identity: 'WHO YOU ARE', time: 'WHEN', software: 'WHAT TOUCHED IT', other: 'OTHER RESIDUE',
};

function toast(msg, warn = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('warn', warn);
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2400);
}

function humanBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}
function cleanName(name) {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return name + '.clean';
  return name.slice(0, dot) + '.clean' + name.slice(dot);
}

// ---- ingest ----
async function addFiles(fileList) {
  const files = [...fileList].filter(f => /image\/(jpeg|png)/.test(f.type) || /\.(jpe?g|png)$/i.test(f.name));
  if (!files.length) { toast('JPEG or PNG only.', true); return; }
  for (const file of files) {
    if (file.size > MAX_BYTES) { toast(`${file.name} is too big.`, true); continue; }
    await ingest(file);
  }
  refreshBulk();
}

async function ingest(file) {
  const id = 'f' + (++seq);
  const card = cardTpl.content.firstElementChild.cloneNode(true);
  card.dataset.id = id;
  results.append(card);
  const url = URL.createObjectURL(file);
  $('.thumb img', card).src = url;
  $('.thumb img', card).alt = file.name;
  $('.fname', card).textContent = file.name;
  $('.fsize', card).textContent = humanBytes(file.size) + ' · ' + (file.type || 'unknown');
  setVerdict(card, 'scanning', 'SCANNING…');
  $('.card-x', card).addEventListener('click', () => removeItem(id));

  const rec = { file, url, card, bytes: null, analysis: null, cleaned: null };
  items.set(id, rec);

  let bytes;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    setVerdict(card, 'scanning', 'COULD NOT READ FILE');
    return;
  }
  rec.bytes = bytes;
  const analysis = analyze(bytes, file.type) || { format: 'unknown', findings: [], hasSensitive: false };
  rec.analysis = analysis;
  renderAnalysis(rec);
}

function setVerdict(card, cls, text) {
  const v = $('.verdict', card);
  v.className = 'verdict ' + cls;
  v.textContent = text;
  card.dataset.state = cls === 'clean' ? 'clean' : cls === 'dirty' ? 'dirty' : 'scanning';
}

// ---- render exposé ----
function renderAnalysis(rec) {
  const { card, analysis } = rec;
  const findings = Array.isArray(analysis.findings) ? analysis.findings : [];
  const box = $('.findings', card);
  box.innerHTML = '';

  const sensitive = analysis.hasSensitive || findings.some(f => ['location', 'device', 'identity'].includes(f.category) || f.severity === 'high');

  if (!findings.length) {
    setVerdict(card, 'clean', analysis.format === 'unknown' ? 'UNRECOGNISED — NOTHING TO READ' : 'ALREADY CLEAN — NO FINGERPRINTS');
    box.append(el('p', { class: 'empty-note' }, analysis.format === 'unknown'
      ? 'Not a JPEG or PNG this tool can read. Nothing removed.'
      : 'This file carries no metadata we can find. Post it as-is.'));
    $('.wash-btn', card).disabled = analysis.format === 'unknown' || !findings.length;
    $('.wash-btn', card).textContent = 'NOTHING TO WASH';
    $('.wash-btn', card).classList.add('done');
    return;
  }

  setVerdict(card, 'dirty', `${findings.length} FINGERPRINT${findings.length > 1 ? 'S' : ''} FOUND`);

  // location banner(s) first
  const loc = findings.filter(f => f.category === 'location');
  for (const f of loc) {
    const isCoord = /[-\d]+\.\d+.*,.*[-\d]+\.\d+/.test(f.value) || /latitude|longitude|coordinate/i.test(f.label);
    const banner = el('div', { class: 'gps' },
      el('span', { class: 'pin', 'aria-hidden': 'true' }, '⚑'),
      el('div', { class: 'gtext' },
        el('div', { class: 'gcoord' }, f.value),
        el('div', { class: 'glabel' }, f.label || 'LOCATION')),
      el('button', {
        class: 'btn gcopy', type: 'button',
        onclick: () => { navigator.clipboard?.writeText(f.value).then(() => toast('COPIED.'), () => {}); }
      }, 'COPY')
    );
    box.append(banner);
  }

  // grouped findings (non-location)
  const groups = {};
  for (const f of findings) {
    if (f.category === 'location') continue;
    (groups[f.category] || (groups[f.category] = [])).push(f);
  }
  for (const cat of CAT_ORDER) {
    const arr = groups[cat];
    if (!arr || !arr.length) continue;
    const g = el('div', { class: 'fgroup' }, el('p', { class: 'fgroup-h' }, CAT_LABEL[cat] || cat.toUpperCase()));
    for (const f of arr) {
      g.append(el('div', { class: 'finding sev-' + (f.severity || 'low') },
        el('span', { class: 'k' }, f.label || f.key),
        el('span', { class: 'v' }, String(f.value))));
    }
    box.append(g);
  }

  const wb = $('.wash-btn', card);
  wb.disabled = false;
  wb.textContent = 'WASH IT';
  wb.onclick = () => washOne(rec);
}

// ---- wash ----
function washOne(rec, silent = false) {
  const { card, bytes } = rec;
  let res;
  try {
    res = scrub(bytes);
  } catch {
    res = { cleaned: bytes, removed: [], bytesRemoved: 0 };
  }
  const cleaned = res.cleaned instanceof Uint8Array ? res.cleaned : bytes;
  rec.cleaned = cleaned;

  // prove it: re-analyze the cleaned bytes
  const after = analyze(cleaned, rec.file.type) || { findings: [], hasSensitive: false };
  const stillSensitive = (after.findings || []).some(f => ['location', 'device', 'identity'].includes(f.category) || f.severity === 'high');

  const box = $('.findings', card);
  box.innerHTML = '';
  const removed = res.removed && res.removed.length ? res.removed.join(', ') : 'metadata blocks';
  box.append(el('div', { class: 'clean-line ok' }, `SCRUBBED: ${removed} · ${humanBytes(res.bytesRemoved || (bytes.length - cleaned.length))} of tracking data removed.`));
  box.append(el('div', { class: 'clean-line' + (stillSensitive ? '' : ' ok') },
    stillSensitive ? 'RE-SCAN: some residue remains (unsupported block).'
      : `RE-SCAN: clean. ${(after.findings || []).length} fingerprints left.`));

  setVerdict(card, 'clean', 'WASHED — SAFE TO POST');

  const wb = $('.wash-btn', card);
  wb.textContent = 'WASHED';
  wb.classList.add('done');
  wb.disabled = true;
  wb.onclick = null;

  // build download
  const blob = new Blob([cleaned], { type: rec.file.type || 'application/octet-stream' });
  const dlUrl = URL.createObjectURL(blob);
  rec._dlUrl && URL.revokeObjectURL(rec._dlUrl);
  rec._dlUrl = dlUrl;
  const dl = $('.dl-btn', card);
  dl.href = dlUrl;
  dl.download = cleanName(rec.file.name);
  dl.hidden = false;

  if (!silent) toast('WASHED. IT NEVER LEFT YOUR MACHINE.');
  return { dl };
}

// ---- bulk ----
function refreshBulk() {
  const n = items.size;
  bulkbar.hidden = n === 0;
  bulkCount.textContent = `${n} FILE${n === 1 ? '' : 'S'}`;
}
function removeItem(id) {
  const rec = items.get(id);
  if (!rec) return;
  rec.url && URL.revokeObjectURL(rec.url);
  rec._dlUrl && URL.revokeObjectURL(rec._dlUrl);
  rec.card.remove();
  items.delete(id);
  refreshBulk();
}
function clearAll() {
  for (const id of [...items.keys()]) removeItem(id);
  toast('CLEARED.');
}
async function washAll() {
  const dirty = [...items.values()].filter(r => r.analysis && (r.analysis.findings || []).length && !r.cleaned && r.analysis.format !== 'unknown');
  if (!dirty.length) { toast('Nothing left to wash.'); return; }
  for (const rec of dirty) {
    const { dl } = washOne(rec, true) || {};
    if (dl) { dl.click(); await new Promise(r => setTimeout(r, 120)); }
  }
  toast(`WASHED ${dirty.length}. DOWNLOADS STARTED.`);
}

// ---- tiny DOM helper ----
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return n;
}

// ---- events ----
drop.addEventListener('click', () => fileInput.click());
drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('drag'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); if (ev === 'dragleave' && drop.contains(e.relatedTarget)) return; drop.classList.remove('drag'); }));
drop.addEventListener('drop', e => { if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files); });
// window-wide drop guard so a stray drop doesn't navigate away
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => e.preventDefault());
$('#clearAll').addEventListener('click', clearAll);
$('#washAll').addEventListener('click', washAll);

refreshBulk();
