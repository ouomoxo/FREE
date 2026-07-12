// SOAP engine — reads and removes the surveillance metadata hidden in image files.
// Pure: no DOM, no network. Never throws. Operates on Uint8Array only.
//
// exports:
//   analyze(bytes, mime?) -> { format, findings, hasSensitive, segments }
//   scrub(bytes)          -> { cleaned, removed, bytesRemoved }
//
// Finding = { key, label, value, category, severity }
//   category: 'location'|'device'|'time'|'software'|'identity'|'other'
//   severity: 'high'|'med'|'low'

const dec = (() => {
  try { return new TextDecoder('latin1'); } catch { return null; }
})();
function str(bytes, start, len) {
  const end = Math.min(bytes.length, start + len);
  let s = '';
  if (dec) s = dec.decode(bytes.subarray(start, end));
  else for (let i = start; i < end; i++) s += String.fromCharCode(bytes[i]);
  // trim trailing NULs / whitespace
  return s.replace(/\0+$/g, '').replace(/\0/g, ' ').trim();
}

// ---- TIFF / EXIF ----
const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

// tags that matter, keyed by IFD context
const TAG = {
  ifd0: {
    0x010f: { key: 'Make', label: 'Camera make', category: 'device', severity: 'high' },
    0x0110: { key: 'Model', label: 'Camera model', category: 'device', severity: 'high' },
    0x0131: { key: 'Software', label: 'Software', category: 'software', severity: 'med' },
    0x0132: { key: 'DateTime', label: 'File date', category: 'time', severity: 'med' },
    0x013b: { key: 'Artist', label: 'Artist / owner', category: 'identity', severity: 'med' },
    0x8298: { key: 'Copyright', label: 'Copyright', category: 'identity', severity: 'med' },
    0x0100: { key: 'ImageWidth', label: 'Width', category: 'other', severity: 'low', skip: true },
    0x0101: { key: 'ImageLength', label: 'Height', category: 'other', severity: 'low', skip: true },
  },
  exif: {
    0x9003: { key: 'DateTimeOriginal', label: 'Date taken', category: 'time', severity: 'high' },
    0x9004: { key: 'DateTimeDigitized', label: 'Date digitised', category: 'time', severity: 'med' },
    0xa434: { key: 'LensModel', label: 'Lens model', category: 'device', severity: 'low' },
    0xa433: { key: 'LensMake', label: 'Lens make', category: 'device', severity: 'low' },
    0xa431: { key: 'BodySerialNumber', label: 'Camera serial number', category: 'identity', severity: 'high' },
    0xc62f: { key: 'CameraSerialNumber', label: 'Camera serial number', category: 'identity', severity: 'high' },
    0xa420: { key: 'ImageUniqueID', label: 'Image unique ID', category: 'identity', severity: 'high' },
    0x927c: { key: 'MakerNote', label: 'Maker note (proprietary blob)', category: 'other', severity: 'low', undefinedBlob: true },
  },
};

function makeReader(view, little) {
  return {
    u16: o => view.getUint16(o, little),
    u32: o => view.getUint32(o, little),
    i32: o => view.getInt32(o, little),
    u8: o => view.getUint8(o),
  };
}

// read one entry's value(s)
function readValue(bytes, view, r, tiffStart, entryPos) {
  const type = r.u16(entryPos + 2);
  const count = r.u32(entryPos + 4);
  const size = (TYPE_SIZE[type] || 1) * count;
  if (count < 0 || count > 100000) return null;
  let dataPos = entryPos + 8;
  if (size > 4) {
    const rel = r.u32(entryPos + 8);
    dataPos = tiffStart + rel;
  }
  if (dataPos < 0 || dataPos + size > bytes.length) return null;
  return { type, count, size, dataPos };
}
function asString(bytes, v) { return v ? str(bytes, v.dataPos, v.count) : ''; }
function asRationals(bytes, view, r, v) {
  if (!v || (v.type !== 5 && v.type !== 10)) return [];
  const out = [];
  for (let i = 0; i < v.count; i++) {
    const p = v.dataPos + i * 8;
    if (p + 8 > bytes.length) break;
    const num = v.type === 10 ? r.i32(p) : r.u32(p);
    const den = v.type === 10 ? r.i32(p + 4) : r.u32(p + 4);
    out.push(den === 0 ? 0 : num / den);
  }
  return out;
}

function gpsToDecimal(parts, ref) {
  if (!parts || parts.length < 1) return null;
  const deg = parts[0] || 0, min = parts[1] || 0, sec = parts[2] || 0;
  let dd = deg + min / 60 + sec / 3600;
  if (/^[SW]/i.test(ref || '')) dd = -dd;
  return dd;
}

// parse an IFD, dispatching to sub-IFDs. Guards recursion & bounds.
function parseIFD(bytes, view, r, tiffStart, ifdRel, ctx, findings, seen, gps) {
  const ifdPos = tiffStart + ifdRel;
  if (ifdPos < 0 || ifdPos + 2 > bytes.length) return;
  const key = ctx + '@' + ifdPos;
  if (seen.has(key)) return;
  seen.add(key);
  if (seen.size > 32) return;
  const count = r.u16(ifdPos);
  if (count > 4000) return;
  for (let i = 0; i < count; i++) {
    const entryPos = ifdPos + 2 + i * 12;
    if (entryPos + 12 > bytes.length) break;
    const tag = r.u16(entryPos);

    // pointer tags
    if (ctx === 'ifd0' && tag === 0x8769) { // Exif SubIFD
      const rel = r.u32(entryPos + 8);
      parseIFD(bytes, view, r, tiffStart, rel, 'exif', findings, seen, gps);
      continue;
    }
    if (ctx === 'ifd0' && tag === 0x8825) { // GPS IFD
      const rel = r.u32(entryPos + 8);
      parseGPS(bytes, view, r, tiffStart, rel, findings, seen, gps);
      continue;
    }

    const def = (TAG[ctx] || {})[tag];
    if (!def || def.skip) continue;
    const v = readValue(bytes, view, r, tiffStart, entryPos);
    if (!v) continue;
    let value;
    if (def.undefinedBlob) {
      value = `${v.count} bytes (may hide serials/settings)`;
    } else if (v.type === 2) {
      value = asString(bytes, v);
    } else if (v.type === 5 || v.type === 10) {
      value = asRationals(bytes, view, r, v).join(', ');
    } else {
      // numeric
      const nums = [];
      for (let j = 0; j < Math.min(v.count, 8); j++) {
        const p = v.dataPos + j * (TYPE_SIZE[v.type] || 1);
        if (v.type === 3) nums.push(r.u16(p));
        else if (v.type === 4) nums.push(r.u32(p));
        else if (v.type === 1 || v.type === 7) nums.push(r.u8(p));
        else nums.push(r.u32(p));
      }
      value = nums.join(', ');
    }
    if (value === '' || value == null) continue;
    findings.push({ key: def.key, label: def.label, value: String(value), category: def.category, severity: def.severity });
  }
}

function parseGPS(bytes, view, r, tiffStart, ifdRel, findings, seen, gps) {
  const ifdPos = tiffStart + ifdRel;
  if (ifdPos < 0 || ifdPos + 2 > bytes.length) return;
  const key = 'gps@' + ifdPos;
  if (seen.has(key)) return;
  seen.add(key);
  const count = r.u16(ifdPos);
  if (count > 200) return;
  let latRef = '', lat = null, lonRef = '', lon = null, altRef = 0, alt = null;
  for (let i = 0; i < count; i++) {
    const entryPos = ifdPos + 2 + i * 12;
    if (entryPos + 12 > bytes.length) break;
    const tag = r.u16(entryPos);
    const v = readValue(bytes, view, r, tiffStart, entryPos);
    if (!v) continue;
    if (tag === 0x0001) latRef = asString(bytes, v);
    else if (tag === 0x0002) lat = asRationals(bytes, view, r, v);
    else if (tag === 0x0003) lonRef = asString(bytes, v);
    else if (tag === 0x0004) lon = asRationals(bytes, view, r, v);
    else if (tag === 0x0005) altRef = v.dataPos < bytes.length ? bytes[v.dataPos] : 0;
    else if (tag === 0x0006) { const a = asRationals(bytes, view, r, v); alt = a.length ? a[0] : null; }
  }
  const latD = gpsToDecimal(lat, latRef);
  const lonD = gpsToDecimal(lon, lonRef);
  if (latD != null && lonD != null && (lat && lat.length)) {
    findings.push({
      key: 'GPS', label: 'GPS coordinates', category: 'location', severity: 'high',
      value: `${latD.toFixed(6)}, ${lonD.toFixed(6)}`,
    });
    gps.found = true;
  }
  if (alt != null) {
    findings.push({
      key: 'GPSAltitude', label: 'Altitude', category: 'location', severity: 'med',
      value: `${(altRef === 1 ? -alt : alt).toFixed(1)} m`,
    });
  }
}

// parse a raw TIFF/EXIF block starting at tiffStart
function parseTiff(bytes, tiffStart, findings) {
  try {
    if (tiffStart + 8 > bytes.length) return;
    const b0 = bytes[tiffStart], b1 = bytes[tiffStart + 1];
    let little;
    if (b0 === 0x49 && b1 === 0x49) little = true;        // II
    else if (b0 === 0x4d && b1 === 0x4d) little = false;   // MM
    else return;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const r = makeReader(view, little);
    const magic = r.u16(tiffStart + 2);
    if (magic !== 0x2a) return;
    const ifd0Rel = r.u32(tiffStart + 4);
    const seen = new Set();
    const gps = { found: false };
    parseIFD(bytes, view, r, tiffStart, ifd0Rel, 'ifd0', findings, seen, gps);
  } catch { /* never throw */ }
}

// ---- JPEG ----
function isJpeg(b) { return b.length > 3 && b[0] === 0xff && b[1] === 0xd8; }

// Walk JPEG segments. cb(marker, segStart, segEnd, payloadStart, payloadLen) for each APPn/COM.
// Returns list of {marker, start, end} for metadata segments and a "stopAt" (SOS position).
function walkJpeg(b) {
  const segs = [];
  let i = 2;
  const n = b.length;
  let sos = -1;
  while (i + 1 < n) {
    if (b[i] !== 0xff) { i++; continue; } // skip fill/padding defensively
    let m = b[i + 1];
    while (m === 0xff && i + 2 < n) { i++; m = b[i + 1]; } // skip fill bytes
    // standalone markers (no length)
    if (m === 0xd8 || m === 0xd9 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    if (m === 0xda) { sos = i; break; } // start of scan: entropy data follows
    if (i + 4 > n) break;
    const len = (b[i + 2] << 8) | b[i + 3];
    const segStart = i, segEnd = i + 2 + len;
    if (len < 2 || segEnd > n) break;
    if ((m >= 0xe0 && m <= 0xef) || m === 0xfe) {
      segs.push({ marker: m, start: segStart, end: segEnd, payloadStart: i + 4, payloadLen: len - 2 });
    }
    i = segEnd;
  }
  return { segs, sos };
}

function jpegSegName(m, b, payloadStart) {
  if (m === 0xfe) return 'COM';
  if (m === 0xe0) return 'APP0(JFIF)';
  const idx = m - 0xe0;
  if (m === 0xe1) {
    if (str(b, payloadStart, 6) === 'Exif') return 'APP1(EXIF)';
    if (str(b, payloadStart, 4).startsWith('http')) return 'APP1(XMP)';
    return 'APP1';
  }
  if (m === 0xe2 && str(b, payloadStart, 11) === 'ICC_PROFILE') return 'APP2(ICC)';
  if (m === 0xed && str(b, payloadStart, 13) === 'Photoshop 3.0') return 'APP13(IPTC)';
  return 'APP' + idx;
}

function analyzeJpeg(b) {
  const findings = [];
  const segments = [];
  const { segs } = walkJpeg(b);
  for (const s of segs) {
    const name = jpegSegName(s.marker, b, s.payloadStart);
    if (name === 'APP0(JFIF)') continue; // harmless
    segments.push(name);
    if (name === 'APP1(EXIF)') {
      parseTiff(b, s.payloadStart + 6, findings); // skip "Exif\0\0"
    } else if (name === 'APP1(XMP)') {
      findings.push({ key: 'XMP', label: 'XMP metadata block', value: `${s.payloadLen} bytes of embedded XML`, category: 'other', severity: 'med' });
    } else if (name === 'APP2(ICC)') {
      findings.push({ key: 'ICC', label: 'ICC colour profile', value: `${s.payloadLen} bytes`, category: 'other', severity: 'low' });
    } else if (name === 'APP13(IPTC)') {
      findings.push({ key: 'IPTC', label: 'IPTC / Photoshop record', value: `${s.payloadLen} bytes (captions, credits, keywords)`, category: 'identity', severity: 'med' });
    } else if (s.marker === 0xfe) {
      const c = str(b, s.payloadStart, Math.min(s.payloadLen, 120));
      findings.push({ key: 'COM', label: 'Embedded comment', value: c || `${s.payloadLen} bytes`, category: 'other', severity: 'low' });
    } else {
      findings.push({ key: name, label: name + ' segment', value: `${s.payloadLen} bytes`, category: 'other', severity: 'low' });
    }
  }
  return { findings, segments };
}

function scrubJpeg(b) {
  const { segs, sos } = walkJpeg(b);
  const drop = new Set();
  const removed = [];
  for (const s of segs) {
    const name = jpegSegName(s.marker, b, s.payloadStart);
    // drop all APP1..APP15 and COM; keep APP0(JFIF)
    if (name === 'APP0(JFIF)') continue;
    if ((s.marker >= 0xe1 && s.marker <= 0xef) || s.marker === 0xfe) {
      drop.add(s.start);
      removed.push(name);
    }
  }
  if (!removed.length) return { cleaned: b.slice(), removed: [], bytesRemoved: 0 };
  // rebuild: copy byte ranges except dropped segments
  const keepRanges = [];
  let cursor = 0;
  // build a sorted list of dropped [start,end)
  const dropped = segs.filter(s => drop.has(s.start)).sort((a, b2) => a.start - b2.start);
  for (const d of dropped) {
    if (d.start > cursor) keepRanges.push([cursor, d.start]);
    cursor = d.end;
  }
  keepRanges.push([cursor, b.length]);
  let total = 0;
  for (const [s, e] of keepRanges) total += e - s;
  const out = new Uint8Array(total);
  let o = 0;
  for (const [s, e] of keepRanges) { out.set(b.subarray(s, e), o); o += e - s; }
  return { cleaned: out, removed, bytesRemoved: b.length - out.length };
}

// ---- PNG ----
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
function isPng(b) { return b.length > 8 && PNG_SIG.every((v, i) => b[i] === v); }
const PNG_META = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

function walkPng(b) {
  const chunks = [];
  let i = 8;
  const n = b.length;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  while (i + 8 <= n) {
    const len = view.getUint32(i);
    const type = str(b, i + 4, 4);
    const dataStart = i + 8;
    const end = dataStart + len + 4; // + CRC
    if (len > n || end > n) break;
    chunks.push({ type, start: i, end, dataStart, len });
    i = end;
    if (type === 'IEND') break;
  }
  return chunks;
}

function analyzePng(b) {
  const findings = [];
  const segments = [];
  const chunks = walkPng(b);
  for (const c of chunks) {
    if (!PNG_META.has(c.type)) continue;
    segments.push(c.type);
    if (c.type === 'tEXt') {
      const raw = str(b, c.dataStart, c.len);
      const nul = raw.indexOf(' ') >= 0 ? raw : raw; // keyword\0text already NUL-normalised to space
      findings.push({ key: 'tEXt', label: 'Text record', value: raw.slice(0, 160), category: guessTextCat(raw), severity: 'low' });
    } else if (c.type === 'zTXt') {
      const kw = str(b, c.dataStart, Math.min(c.len, 80)).split(' ')[0];
      findings.push({ key: 'zTXt', label: 'Compressed text record', value: (kw || 'keyword') + ' = (compressed)', category: guessTextCat(kw), severity: 'low' });
    } else if (c.type === 'iTXt') {
      const raw = str(b, c.dataStart, Math.min(c.len, 200));
      findings.push({ key: 'iTXt', label: 'International text record', value: raw.slice(0, 160), category: guessTextCat(raw), severity: 'low' });
    } else if (c.type === 'eXIf') {
      parseTiff(b, c.dataStart, findings);
      findings.push({ key: 'eXIf', label: 'Embedded EXIF block', value: `${c.len} bytes`, category: 'other', severity: 'med' });
    } else if (c.type === 'tIME') {
      if (c.len >= 7) {
        const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
        const y = view.getUint16(c.dataStart);
        const val = `${y}-${pad(b[c.dataStart + 2])}-${pad(b[c.dataStart + 3])} ${pad(b[c.dataStart + 4])}:${pad(b[c.dataStart + 5])}:${pad(b[c.dataStart + 6])}`;
        findings.push({ key: 'tIME', label: 'Last-modified time', value: val, category: 'time', severity: 'med' });
      }
    }
  }
  return { findings, segments };
}
function pad(n) { return String(n).padStart(2, '0'); }
function guessTextCat(s) {
  const l = (s || '').toLowerCase();
  if (/author|artist|owner|copyright|creator|email|name/.test(l)) return 'identity';
  if (/software|source|tool|program/.test(l)) return 'software';
  return 'other';
}

function scrubPng(b) {
  const chunks = walkPng(b);
  const removed = [];
  const keep = [];
  for (const c of chunks) {
    if (PNG_META.has(c.type)) { removed.push(c.type); continue; }
    keep.push(c);
  }
  if (!removed.length) return { cleaned: b.slice(), removed: [], bytesRemoved: 0 };
  let total = 8;
  for (const c of keep) total += c.end - c.start;
  const out = new Uint8Array(total);
  out.set(PNG_SIG, 0);
  let o = 8;
  for (const c of keep) { out.set(b.subarray(c.start, c.end), o); o += c.end - c.start; }
  return { cleaned: out, removed, bytesRemoved: b.length - out.length };
}

// ---- public API ----
function toBytes(x) {
  if (x instanceof Uint8Array) return x;
  if (x instanceof ArrayBuffer) return new Uint8Array(x);
  if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
  return new Uint8Array(0);
}

export function analyze(bytes, _mime) {
  try {
    const b = toBytes(bytes);
    let format = 'unknown', findings = [], segments = [];
    if (isJpeg(b)) { format = 'jpeg'; ({ findings, segments } = analyzeJpeg(b)); }
    else if (isPng(b)) { format = 'png'; ({ findings, segments } = analyzePng(b)); }
    const hasSensitive = findings.some(f =>
      f.category === 'location' || f.category === 'device' || f.category === 'identity' || f.severity === 'high');
    return { format, findings, hasSensitive, segments };
  } catch {
    return { format: 'unknown', findings: [], hasSensitive: false, segments: [] };
  }
}

export function scrub(bytes) {
  try {
    const b = toBytes(bytes);
    if (isJpeg(b)) return scrubJpeg(b);
    if (isPng(b)) return scrubPng(b);
    return { cleaned: b.slice(), removed: [], bytesRemoved: 0 };
  } catch {
    const b = toBytes(bytes);
    return { cleaned: b.slice ? b.slice() : new Uint8Array(0), removed: [], bytesRemoved: 0 };
  }
}
