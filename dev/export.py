#!/usr/bin/env python3
"""Write a score out for the browser to play.

The scores in `scores/` are Python because that is a reasonable way to write
music down. The site is not going to run Python, so this resolves each one all
the way to sound — beats to seconds through the tempo map, note values to ring
times through the pedal — and leaves a list of notes with times on it.

What comes out is deliberately stupid: no metre, no key, no pedal, no
dynamics. Four numbers a note. Everything interpretive has already happened,
which means the browser cannot get it wrong and the file is the same music on
every machine that opens it.

    python3 dev/export.py                     # every score, into js/data/scores
    python3 dev/export.py three_rooms         # just one
"""
import importlib.util
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
import piano                                             # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'js', 'data', 'scores')


def load_score(name):
    """Import a score without letting it render itself."""
    real = piano.render
    piano.render = lambda *a, **k: {'notes': 0, 'seconds': 0, 'peak_dbfs': 0}
    argv = sys.argv
    sys.argv = ['x']
    try:
        spec = importlib.util.spec_from_file_location(
            name, os.path.join(ROOT, 'scores', f'{name}.py'))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod
    finally:
        piano.render = real
        sys.argv = argv


def export(name):
    mod = load_score(name)
    events, last = piano.resolve(mod.s.notes, sorted(set(mod.s.pedals)), mod.tempo)

    # Three decimal places is a millisecond, which is finer than anybody can
    # hear and half the size of what json.dump would write otherwise.
    out = [[round(t, 3), round(d, 3), m, round(v, 3)] for t, d, m, v in events]
    doc = {
        'id': name,
        'duration': round(last + 6, 2),
        'notes': out,
    }
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f'{name}.json')
    with open(path, 'w') as f:
        json.dump(doc, f, separators=(',', ':'))
    size = os.path.getsize(path)
    print(f'  {name:14} {len(out):>5} notes  {doc["duration"]:>6.0f}s  {size/1024:>6.1f} KB')


if __name__ == '__main__':
    names = sys.argv[1:] or [f[:-3] for f in sorted(os.listdir(os.path.join(ROOT, 'scores')))
                             if f.endswith('.py') and not f.startswith('_')]
    for n in names:
        export(n)
