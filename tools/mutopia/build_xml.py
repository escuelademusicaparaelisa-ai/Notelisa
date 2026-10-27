"""Rebuilds a piano score as MusicXML from the events dumped by nl-dump.ly.

usage: python tools/mutopia/build_xml.py events.txt out.musicxml --title T --composer C [--rights R] [--tempo 4=120]
"""
import argparse
import collections
from fractions import Fraction as F

from music21 import (articulations, bar, chord, clef, dynamics, expressions, key, layout, metadata,
                     meter, note, pitch, spanner, stream, tempo)

STEPS = 'CDEFGAB'


def rat(s):
    n, d = s.split('/')
    return F(int(n), int(d))


def mom(s):
    a, b = s.split(' ')
    return rat(a), rat(b)


def parse(path, score=1):
    """Events of one score of the file (files with several movements have several)."""
    ev = collections.defaultdict(list)
    current = 0
    for line in open(path, encoding='utf-8'):
        f = line.rstrip('\n').split('\t')
        if f[0] == 'SCORE':
            current += 1
        elif current == score or current == 0:
            ev[f[0]].append(f[1:])
    return ev


def make_clef(glyph, pos, transp):
    pos, transp = int(pos), int(transp)
    if glyph == 'clefs.G':
        c = clef.Treble8vbClef() if transp == -7 else clef.TrebleClef()
    elif glyph == 'clefs.F':
        c = clef.BassClef()
    elif glyph == 'clefs.C':
        c = clef.AltoClef() if pos == 0 else clef.TenorClef()
    else:
        c = clef.TrebleClef()
    return c


ART = {
    'staccato': articulations.Staccato, 'staccatissimo': articulations.Staccatissimo,
    'accent': articulations.Accent, 'tenuto': articulations.Tenuto, 'marcato': articulations.StrongAccent,
    'portato': articulations.DetachedLegato,
}
EXPR = {
    'fermata': expressions.Fermata, 'trill': expressions.Trill, 'mordent': expressions.Mordent,
    'prall': expressions.InvertedMordent, 'turn': expressions.Turn, 'reverseturn': expressions.InvertedTurn,
}


def build(events, title, composer, rights, default_tempo, score=1):
    ev = parse(events, score)
    notes = []
    for i, f in enumerate(ev['N']):
        staff, voice = int(f[0]), int(f[1])
        t, g = mom(f[2])
        notes.append(dict(i=i, staff=staff, voice=voice, t=t, g=g, octave=int(f[3]) + 4, step=STEPS[int(f[4])],
                          alter=rat(f[5]) * 2, len=rat(f[6]), log=int(f[7]), dots=int(f[8])))
    rests = []
    for f in ev['REST']:
        t, g = mom(f[2])
        if g == 0:
            rests.append(dict(staff=int(f[0]), voice=int(f[1]), t=t, len=rat(f[3])))
    staves = sorted({n['staff'] for n in notes if n['staff'] > 0})
    end = max(n['t'] + n['len'] for n in notes)

    # Measures as LilyPond counted them.
    starts, numbers = [], {}
    for f in ev['B']:
        t, g = mom(f[0])
        if g != 0 or t >= end:
            continue
        if rat(f[2]) == 0 or t == 0:
            if t not in numbers:
                starts.append(t)
                numbers[t] = int(f[1]) if rat(f[2]) == 0 else 0
    # Repeat signs in the middle of a bar (after a pickup) split it in two, as MusicXML barlines sit between measures.
    for f in ev['R'] + ev['VS']:
        t, g = mom(f[0])
        if 0 < t < end and t not in numbers:
            numbers[t] = numbers[max(x for x in starts if x < t)]
            starts.append(t)
    starts = sorted(set(starts))
    bounds = list(zip(starts, starts[1:] + [end]))
    times = sorted({(mom(f[0])[0], int(f[1]), int(f[2])) for f in ev['T']})

    def time_at(t):
        cur = times[0]
        for x in times:
            if x[0] <= t:
                cur = x
        return cur

    def measure_index(t):
        for i, (s, e) in enumerate(bounds):
            if s <= t < e:
                return i
        return len(bounds) - 1

    # Ties, slurs, articulations, fingerings keyed by (staff, voice, t, grace).
    at = collections.defaultdict(list)
    for n in notes:
        at[(n['voice'], n['t'], n['g'])].append(n)
    tied = {(int(f[1]), *mom(f[2])) for f in ev['TIE']}
    arts = collections.defaultdict(list)
    for f in ev['ART']:
        arts[(int(f[1]), *mom(f[2]))].append(f[3])
    fings = collections.defaultdict(list)
    for f in ev['FING']:
        fings[(int(f[1]), *mom(f[2]))].append(int(f[3]))
    slur_ev = [(int(f[1]), *mom(f[2]), int(f[3])) for f in ev['SLUR']]

    score = stream.Score()
    md = metadata.Metadata()
    md.title = title
    md.composer = composer
    if rights:
        md.copyright = rights
    score.insert(0, md)
    all_keys = sorted({(mom(f[1])[0], int(f[2]), int(f[3]), f[4]) for f in ev['K']})
    parts = []
    m21_of = {}  # (voice, t, g) -> music21 object
    for staff in staves:
        part = stream.PartStaff()
        part.partName = 'Piano'
        sn = [n for n in notes if n['staff'] == staff]
        sr = [r for r in rests if r['staff'] == staff]
        # Highest voice first: it is drawn with stems up and gets the rests.
        heights = collections.defaultdict(list)
        for n in sn:
            heights[n['voice']].append(n['octave'] * 7 + STEPS.index(n['step']))
        order = sorted(heights, key=lambda v: -sum(heights[v]) / len(heights[v]))
        clefs = sorted({(mom(f[1])[0], f[2], f[3], f[4]) for f in ev['C'] if int(f[0]) == staff})
        keys = sorted({(mom(f[1])[0], int(f[2]), int(f[3]), f[4]) for f in ev['K'] if int(f[0]) == staff})
        dyns = [(mom(f[1])[0], f[2]) for f in ev['D'] if int(f[0]) == staff]
        last_time = None
        for mi, (s, e) in enumerate(bounds):
            m = stream.Measure(number=numbers[s])
            ts = time_at(s)
            full = F(ts[1], ts[2])
            if (ts[1], ts[2]) != last_time:
                m.timeSignature = meter.TimeSignature(f'{ts[1]}/{ts[2]}')
                last_time = (ts[1], ts[2])
            if mi == 0 and e - s < full:
                m.paddingLeft = float((full - (e - s)) * 4)
            elif mi == len(bounds) - 1 and e - s < full:
                m.paddingRight = float((full - (e - s)) * 4)
            for (t, glyph, pos, tr) in clefs:
                if (mi == 0 and t <= s) or s <= t < e and t > 0:
                    if not (mi == 0 and t < s and any(c[0] <= s and c[0] > t for c in clefs)):
                        c = make_clef(glyph, pos, tr)
                        m.insert(float((max(t, s) - s) * 4), c)
            staff_keys = keys
            if mi == 0 and not any(k[0] <= s for k in keys):
                # Staff with no key of its own at the start: use the other staff's.
                staff_keys = [k for k in all_keys if k[0] <= s][-1:] or [(F(0), 0, 0, '0/1')]
                staff_keys += keys
            for (t, fifths, tonic, talt) in staff_keys:
                if (mi == 0 and t <= s) or (s <= t < e and t > 0):
                    if mi == 0 and any(k[0] <= s and k[0] > t for k in staff_keys):
                        continue
                    k = key.KeySignature(fifths)
                    m.insert(float((max(t, s) - s) * 4), k)
            for (t, text) in dyns:
                if s <= t < e:
                    m.insert(float((t - s) * 4), dynamics.Dynamic(text))
            # Voices in this measure.
            vlist = []
            for v in order:
                vn = [n for n in sn if n['voice'] == v and s <= n['t'] < e]
                vr = [r for r in sr if r['voice'] == v and s <= r['t'] < e]
                if vn:
                    vlist.append((v, vn, vr))
            if not vlist:
                r = note.Rest(quarterLength=float((e - s) * 4))
                m.insert(0, r)
            containers = []
            for vi, (v, vn, vr) in enumerate(vlist):
                cont = stream.Voice(id=str(vi + 1)) if len(vlist) > 1 else m
                groups = collections.defaultdict(list)
                for n in vn:
                    groups[(n['t'], n['g'])].append(n)
                items = []
                for (t, g), ns in sorted(groups.items()):
                    ns.sort(key=lambda n: n['i'])
                    lens = {n['len'] for n in ns}
                    ln = min(lens)
                    pitches = []
                    for n in ns:
                        p = pitch.Pitch(n['step'] + str(n['octave']))
                        if n['alter']:
                            p.accidental = pitch.Accidental(float(n['alter']))
                        pitches.append(p)
                    if len(pitches) == 1:
                        obj = note.Note(pitches[0])
                    else:
                        obj = chord.Chord(pitches)
                    if g < 0:
                        obj.duration.quarterLength = float(min(n['len'] for n in ns) * 4)
                        obj = obj.getGrace()
                    else:
                        obj.duration.quarterLength = ln * 4
                    k = (v, t, g)
                    for a in arts.get(k, []):
                        if a in ART:
                            obj.articulations.append(ART[a]())
                        elif a in EXPR:
                            obj.expressions.append(EXPR[a]())
                    fs = fings.get(k, [])
                    if fs and len(fs) <= len(pitches):
                        for d in fs[:1] if len(pitches) == 1 else []:
                            obj.articulations.append(articulations.Fingering(d))
                    m21_of[k] = (obj, ns)
                    items.append((t, g, obj, ln if g == 0 else 0))
                for r in vr:
                    if not any(it[0] < r['t'] + r['len'] and r['t'] < it[0] + it[3] for it in items if it[3]):
                        # Rests of inner voices only clutter the score on screen (and OSMD draws hidden ones).
                        if vi == 0:
                            items.append((r['t'], F(0), note.Rest(quarterLength=r['len'] * 4), r['len']))
                items.sort(key=lambda it: (it[0], it[1] >= 0, it[1]))
                # Fill gaps with rests (hidden for secondary voices).
                cursor = s
                filled = []
                for (t, g, obj, ln) in items:
                    if t > cursor and vi == 0:
                        filled.append((cursor, note.Rest(quarterLength=(t - cursor) * 4)))
                    filled.append((t, obj))
                    cursor = max(cursor, t + ln)
                if cursor < e and vi == 0:
                    filled.append((cursor, note.Rest(quarterLength=(e - cursor) * 4)))
                for (t, obj) in filled:
                    cont.insert((t - s) * 4, obj)
                if cont is not m:
                    containers.append(cont)
            for c in containers:
                m.insert(0, c)
            part.append(m)
        parts.append(part)

    # Ties.
    for (v, t, g), (obj, ns) in m21_of.items():
        if (v, t, g) not in tied:
            continue
        ln = min(n['len'] for n in ns)
        nxt = m21_of.get((v, t + ln, F(0)))
        if not nxt:
            continue
        nobj, nns = nxt
        for n in ns:
            midi = (n['octave'] + 1) * 12 + [0, 2, 4, 5, 7, 9, 11][STEPS.index(n['step'])] + n['alter']
            for nn in nns:
                nmidi = (nn['octave'] + 1) * 12 + [0, 2, 4, 5, 7, 9, 11][STEPS.index(nn['step'])] + nn['alter']
                if nmidi == midi:
                    a = obj if isinstance(obj, note.Note) else next((x for x in obj.notes if x.pitch.ps == float(midi)), None)
                    b = nobj if isinstance(nobj, note.Note) else next((x for x in nobj.notes if x.pitch.ps == float(midi)), None)
                    if a is None or b is None:
                        continue
                    from music21 import tie
                    a.tie = tie.Tie('continue' if a.tie and a.tie.type in ('stop', 'continue') else 'start')
                    b.tie = tie.Tie('stop')
    # Slurs.
    open_slurs = {}
    for (v, t, g, d) in sorted(slur_ev, key=lambda x: (x[1], x[2], x[3] > 0)):
        k = (v, t, g)
        if k not in m21_of:
            continue
        if d < 0:
            open_slurs[v] = m21_of[k][0]
        elif v in open_slurs:
            a, b = open_slurs.pop(v), m21_of[k][0]
            if a is not b:
                sl = spanner.Slur(a, b)
                staff = m21_of[k][1][0]['staff']
                parts[staves.index(staff)].insert(0, sl)

    # Repeats and voltas.
    rep = {(mom(f[0])[0], f[1]) for f in ev['R']}
    for part in parts:
        ms = list(part.getElementsByClass(stream.Measure))
        for (t, kind) in rep:
            for i, (s, e) in enumerate(bounds):
                if kind == 'start-repeat' and s == t and t > 0:
                    ms[i].leftBarline = bar.Repeat(direction='start')
                if kind == 'end-repeat' and e == t:
                    ms[i].rightBarline = bar.Repeat(direction='end')
        vs = sorted({(mom(f[0])[0], int(f[1]), f[2]) for f in ev['VS']}, key=lambda x: (x[0], x[1] < 0))
        opened = None
        for (t, d, nums) in vs:
            if d < 0:
                opened = (t, nums)
            elif opened:
                i0 = next(i for i, (s, e) in enumerate(bounds) if s <= opened[0] < e)
                i1 = next(i for i, (s, e) in enumerate(bounds) if s < t <= e)
                rb = spanner.RepeatBracket(ms[i0:i1 + 1], number=opened[1] or '1')
                part.insert(0, rb)
                opened = None
        if not isinstance(ms[-1].rightBarline, bar.Repeat):
            ms[-1].rightBarline = bar.Barline('final')

    # Tempo.
    tm = ev['M'][0] if ev['M'] else None
    if tm:
        unit, count = rat(tm[1]), int(float(tm[2]))
        mm = tempo.MetronomeMark(number=count, referent=float(unit * 4))
    else:
        unit, count = default_tempo
        mm = tempo.MetronomeMark(number=count, referent=float(unit * 4))
    first = parts[0].getElementsByClass(stream.Measure)[0]
    first.insert(0, mm)

    for part in parts:
        for m in part.getElementsByClass(stream.Measure):
            for c in [m] + list(m.voices):
                try:
                    c.makeBeams(inPlace=True)
                except Exception:
                    pass
        score.insert(0, part)
    score.insert(0, layout.StaffGroup(parts, name='Piano', symbol='brace', barTogether=True))
    return score


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('events')
    ap.add_argument('out')
    ap.add_argument('--title', required=True)
    ap.add_argument('--composer', required=True)
    ap.add_argument('--rights', default='')
    ap.add_argument('--tempo', default='4=100')
    ap.add_argument('--score', type=int, default=1)
    a = ap.parse_args()
    u, c = a.tempo.split('=')
    unit = F(1, int(u.rstrip('.'))) * (F(3, 2) if u.endswith('.') else 1)
    s = build(a.events, a.title, a.composer, a.rights, (unit, int(c)), a.score)
    s.splitAtDurations(recurse=True)
    s.write('musicxml', fp=a.out, makeNotation=False)
    print('ok', a.out)
