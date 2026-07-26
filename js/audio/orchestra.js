/**
 * MAESTRO — Orchestration.
 *
 * The composer writes the music. This decides who plays it.
 *
 * A score arrives as one texture spread evenly across the available voices,
 * which is how a machine writes and not how an orchestra sounds. An orchestra
 * sounds like a body of players who are *not all playing*: a line begins on one
 * instrument alone, is joined at the octave, is answered, is doubled, and at
 * the moment everything is at stake every section is on it at once — and then
 * they leave, one at a time, and it ends with fewer players than it began with.
 *
 * So this pass does two things and nothing else.
 *
 * It computes a **tension curve** over the whole work: a long arch with its
 * summit about two thirds through, roughened by a slower wave so the climb is
 * not a ramp. Every decision below reads from that curve.
 *
 * It then **doubles and thins**. At low tension a line is left alone. As the
 * curve rises the melody is doubled at the octave, the harmony gains a sustained
 * body under it, the bass is reinforced an octave down, and at the summit the
 * timpani marks the downbeat and the cymbal is allowed exactly one stroke. On
 * the way down all of it is taken away again in reverse order.
 *
 * Nothing here changes a pitch or a rhythm. The music is the composer's; this
 * is the seating.
 *
 * @module audio/orchestra
 */

import { clamp, Random } from '../core/utils.js';

/**
 * The desk.
 *
 * `at` is the tension at which a desk enters, so the entries are staggered and
 * the tutti assembles rather than switching on. `octave` is where it doubles
 * relative to the line it is doubling.
 */
const DESKS = [
  { part: 'melody', voice: 'flute', at: 0.34, octave: 1, gain: 0.55 },
  { part: 'melody', voice: 'choir', at: 0.58, octave: 0, gain: 0.42 },
  { part: 'melody', voice: 'glockenspiel', at: 0.82, octave: 1, gain: 0.3 },
  { part: 'harmony', voice: 'strings', at: 0.26, octave: 0, gain: 0.5 },
  { part: 'harmony', voice: 'harp', at: 0.66, octave: 1, gain: 0.34 },
  { part: 'bass', voice: 'contrabass', at: 0.2, octave: -1, gain: 0.6 },
  { part: 'bass', voice: 'timpani', at: 0.74, octave: -1, gain: 0.7 },
];

/** Below this a work is too short for an arch and is left as written. */
const MIN_EVENTS = 24;

/**
 * The tension at a point in the work, 0..1.
 *
 * An arch, not a ramp: the summit sits at 0.68 — late enough that the ear has
 * given up expecting it, early enough that there is room to come down. The
 * slow wave laid over it means no two moments at the same height feel the
 * same, and the small lift at the very end is the cadence, not a climax.
 *
 * @param {number} u  Position through the work, 0..1.
 */
export function tensionAt(u) {
  const x = clamp(u, 0, 1);
  const peak = 0.68;
  // Rises on a curve that accelerates; falls faster than it rose, because a
  // collapse that takes as long as the climb is not a collapse.
  const arch = x < peak
    ? Math.pow(x / peak, 1.55)
    : Math.pow(1 - (x - peak) / (1 - peak), 1.15);
  const swell = Math.sin(x * Math.PI * 3.3) * 0.08 + Math.sin(x * Math.PI * 7.1) * 0.035;
  const cadence = x > 0.94 ? (x - 0.94) / 0.06 * 0.22 : 0;
  return clamp(arch + swell * arch + cadence, 0, 1);
}

/**
 * Sort the written parts into what an orchestrator actually thinks in.
 *
 * The melody is the part that travels furthest between consecutive notes — not
 * the highest, which is usually a pad. The bass is the lowest. Everything else
 * is harmony.
 *
 * @returns {{melody: string|null, bass: string|null}}
 */
export function readParts(events) {
  /** @type {Map<string, {last: number, travel: number, n: number, sum: number}>} */
  const parts = new Map();
  for (const e of events) {
    if (e.i === 'timpani' || e.i === 'cymbal') continue;
    const p = parts.get(e.i) ?? { last: e.m, travel: 0, n: 0, sum: 0 };
    p.travel += Math.abs(e.m - p.last);
    p.last = e.m;
    p.sum += e.m;
    p.n++;
    parts.set(e.i, p);
  }
  let melody = null;
  let bass = null;
  let best = -1;
  let lowest = Infinity;
  for (const [name, p] of parts) {
    const travel = (p.travel / Math.max(1, p.n)) * Math.sqrt(p.n);
    if (travel > best) { best = travel; melody = name; }
    const mean = p.sum / Math.max(1, p.n);
    if (mean < lowest) { lowest = mean; bass = name; }
  }
  if (melody === bass && parts.size > 1) bass = null;
  return { melody, bass };
}

/**
 * Orchestrate a composed score in place-safe fashion, returning a new one.
 *
 * @param {object} score  As returned by `compose`.
 * @param {string} [seed] So the same work is always seated the same way.
 * @returns {object} The score with an orchestrated event list.
 */
export function orchestrate(score, seed = 'orchestra') {
  const events = score.events;
  if (!Array.isArray(events) || events.length < MIN_EVENTS) return score;
  // Some music is for one player. Putting a timpani under a nocturne does not
  // make it bigger; it makes it a different and worse piece.
  if (score.solo) return score;

  const rnd = Random(`${seed}:orchestra`);
  const { melody, bass } = readParts(events);
  const duration = score.duration || (events[events.length - 1].t + events[events.length - 1].d) || 1;
  const barLen = (score.secPerBeat ?? 0.5) * (score.meter?.[0] ?? 4);

  /** @type {Array<{t:number,d:number,m:number,v:number,i:string}>} */
  const added = [];
  let cymbalAt = -Infinity;

  for (const e of events) {
    if (e.i === 'timpani' || e.i === 'cymbal') continue;
    const u = clamp(e.t / duration, 0, 1);
    const tension = tensionAt(u);

    const part = e.i === melody ? 'melody' : e.i === bass ? 'bass' : 'harmony';

    for (const desk of DESKS) {
      if (desk.part !== part) continue;
      if (tension < desk.at) continue;
      if (desk.voice === e.i) continue;

      // Just past its entry a desk plays only some of the notes, so it fades in
      // by taking more of the line rather than by getting louder.
      const settled = clamp((tension - desk.at) / 0.18, 0, 1);
      if (settled < 1 && rnd.float() > settled) continue;

      const m = e.m + desk.octave * 12;
      if (m < 24 || m > 100) continue;

      // The timpani is not a doubling; it marks, and only on a downbeat.
      if (desk.voice === 'timpani') {
        if (barLen <= 0) continue;
        const intoBar = e.t % barLen;
        if (intoBar > 0.06) continue;
      }

      added.push({
        t: e.t,
        d: desk.voice === 'timpani' ? Math.min(e.d, 0.5) : e.d,
        m,
        v: clamp((e.v ?? 0.6) * desk.gain * (0.6 + tension * 0.6), 0.02, 1),
        i: desk.voice,
      });
    }

    // One cymbal, at the summit, and never twice within eight seconds. An
    // orchestra that crashes on every climax has no climax.
    if (tension > 0.93 && e.t - cymbalAt > 8) {
      cymbalAt = e.t;
      added.push({ t: e.t, d: 2.4, m: 72, v: 0.42, i: 'cymbal' });
    }
  }

  if (!added.length) return score;

  // Every written note is also shaded by the curve, so the whole body breathes
  // with it and the doublings are not the only thing that changes.
  const shaded = events.map((e) => {
    const tension = tensionAt(clamp(e.t / duration, 0, 1));
    return { ...e, v: clamp((e.v ?? 0.6) * (0.62 + tension * 0.5), 0.02, 1) };
  });

  const all = shaded.concat(added);
  all.sort((a, b) => a.t - b.t);

  return {
    ...score,
    events: all,
    instruments: Array.from(new Set(all.map((e) => e.i))),
    orchestrated: true,
  };
}
