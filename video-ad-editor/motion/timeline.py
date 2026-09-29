#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""timeline.py — يبني <proj>/timeline.json من project.json + vo/words.json، ويركّب vo/vo_full.wav.

  python3 timeline.py <proj>

project.json (المفاتيح اللي يقراها):
  bpm, beatsPerBar (4), beatOffset (0), duration (اختياري — يفرض الطول)
  timing: { snap: 'beat'|'half'|'quarter'|'bar'|'none'|<رقم بالنبضات>,   ← شبكة التثبيت (افتراضي half)
            snapTarget: 'line'|'scene',   ← line: بداية السطر على الشبكة، المشهد يبدأ قبلها بـleadIn
                                            scene: القطع على الشبكة والسطر بعده بـleadIn
            snapLines: 'all'|'first',     ← كل سطر يتثبّت أو أول سطر بالمشهد بس
            leadIn: 0.25, gap: 0.15, startPad: 0.2, tail: 0.6, keepOriginal: false }
            keepOriginal=true مع صوتك (--own): الأسطر تنحط بأوقاتها الأصلية بلا تثبيت
  scenes: [{ id, file, lines:[ids], minDur, duration (للمشهد بلا أسطر), transition:{type,dur,...} }]
  sections: [{ name:'intro'|'build'|'drop'|'break'|'outro'|..., at: ثواني | 'scene:id' | 'line:id' | 'beat:n' | 'bar:n' }]
"""
import sys, os, json, math, wave
import numpy as np

SR = 48000


def read_wav(path):
    with wave.open(path, 'rb') as w:
        n = w.getnframes(); ch = w.getnchannels(); sw = w.getsampwidth(); sr = w.getframerate()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype='<i2' if sw == 2 else '<i4').astype(np.float32) / (32768.0 if sw == 2 else 2147483648.0)
    if ch > 1: x = x.reshape(-1, ch).mean(axis=1)
    if sr != SR: raise RuntimeError(f'{path}: expected {SR} Hz, got {sr}')
    return x


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype('<i2').tobytes())


def main():
    if len(sys.argv) < 2: print(__doc__); sys.exit(1)
    P = os.path.abspath(sys.argv[1])
    proj = json.load(open(os.path.join(P, 'project.json'), encoding='utf-8'))
    wj = os.path.join(P, 'vo', 'words.json')
    vo = {L['id']: L for L in json.load(open(wj, encoding='utf-8'))['lines']} if os.path.exists(wj) else {}
    bpm = float(proj.get('bpm', 120)); spb = 60.0 / bpm; bpb = int(proj.get('beatsPerBar', 4)); off = float(proj.get('beatOffset', 0))
    T = proj.get('timing', {}) or {}
    snap = T.get('snap', 'half'); grid = {'beat': 1, 'half': 0.5, 'quarter': 0.25, 'bar': bpb, 'none': 0}.get(snap, snap if isinstance(snap, (int, float)) else 0.5) * spb
    target = T.get('snapTarget', 'line'); snapLines = T.get('snapLines', 'all')
    leadIn = float(T.get('leadIn', 0.25)); gap = float(T.get('gap', 0.15)); pad = float(T.get('startPad', 0.2)); tail = float(T.get('tail', 0.6))
    keep = bool(T.get('keepOriginal', False))

    def up(t):
        if grid <= 0: return t
        return off + math.ceil((t - off) / grid - 1e-6) * grid

    scenes_in = proj.get('scenes', [])
    if not scenes_in: raise SystemExit('❌ project.json بلا scenes')
    placed = {}; scenes = []; cursor = pad
    for i, sc in enumerate(scenes_in):
        ids = [l for l in sc.get('lines', []) if l in vo]
        missing = [l for l in sc.get('lines', []) if l not in vo]
        if missing: print(f'  ⚠ {sc["id"]}: أسطر بلا صوت {missing} (شغّل voice.py)')
        minDur = float(sc.get('minDur', sc.get('duration', 0)) or 0)
        prev = scenes[-1] if scenes else None
        earliest = cursor
        if prev: earliest = max(earliest, prev['start'] + prev['_min'] + (leadIn if ids else 0))
        if ids:
            if keep and 'orig_start' in vo[ids[0]]:
                ls = max(earliest, vo[ids[0]]['orig_start']); start = 0.0 if i == 0 else ls - leadIn
            elif target == 'scene':
                start = 0.0 if i == 0 else up(earliest - leadIn); ls = max(start + leadIn, pad if i == 0 else 0)
            else:
                ls = up(max(earliest, leadIn if i == 0 else 0)); start = 0.0 if i == 0 else ls - leadIn
            t = ls
            for k, lid in enumerate(ids):
                L = vo[lid]
                if k > 0:
                    t = max(t, placed[ids[k - 1]]['end'] + (vo[ids[k - 1]].get('gap_after') if vo[ids[k - 1]].get('gap_after') is not None else gap))
                    if keep and 'orig_start' in L: t = max(t, L['orig_start'])
                    elif snapLines == 'all': t = up(t)
                placed[lid] = {'start': round(t, 4), 'end': round(t + L['dur'], 4)}
            last = vo[ids[-1]]
            cursor = placed[ids[-1]]['end'] + (last.get('gap_after') if last.get('gap_after') is not None else gap)
        else:
            start = 0.0 if i == 0 else (up(earliest) if target == 'scene' else earliest)
            cursor = start + float(sc.get('duration', 2.0))
        scenes.append({'id': sc['id'], 'file': sc.get('file', f'scenes/{sc["id"]}.js'), 'start': round(start, 4), 'lines': ids,
                       'transition': sc.get('transition'), '_min': max(minDur, 0.0), '_lastEnd': placed[ids[-1]]['end'] if ids else start + float(sc.get('duration', 2.0))})
    for i, sc in enumerate(scenes):
        if i + 1 < len(scenes): sc['end'] = scenes[i + 1]['start']
        else:
            e = max(sc['_lastEnd'] + (tail if sc['lines'] else 0), sc['start'] + sc['_min'])
            sc['end'] = round(up(e) if grid > 0 else e, 4)
    dur = float(proj['duration']) if proj.get('duration') else scenes[-1]['end']
    if proj.get('duration'):
        vo_end = max([p['end'] for p in placed.values()] or [0])
        if vo_end > dur: print(f'  ⚠ الصوت ينتهي {vo_end:.2f}s بعد الطول المفروض {dur:.2f}s — راح ينقص!')
        scenes[-1]['end'] = dur
    for sc in scenes:
        if sc['end'] - sc['start'] < 0.05: print(f'  ⚠ مشهد {sc["id"]} قصير جداً ({sc["end"]-sc["start"]:.2f}s)')
        del sc['_min'], sc['_lastEnd']
    beats = []; k = 0
    while off + k * spb < dur + 1e-6: beats.append(round(off + k * spb, 5)); k += 1

    def resolve(at):
        if isinstance(at, (int, float)): return float(at)
        kind, _, ref = str(at).partition(':')
        if kind == 'scene': return next(s['start'] for s in scenes if s['id'] == ref)
        if kind == 'line': return placed[ref]['start']
        if kind == 'beat': return off + int(ref) * spb
        if kind == 'bar': return off + int(ref) * bpb * spb
        return float(at)
    secs = sorted([{'name': s['name'], 'start': round(resolve(s['at']), 4)} for s in proj.get('sections', [])], key=lambda s: s['start'])
    for i, s in enumerate(secs): s['end'] = secs[i + 1]['start'] if i + 1 < len(secs) else round(dur, 4)

    vo_out = []
    for lid, pl in sorted(placed.items(), key=lambda kv: kv[1]['start']):
        L = vo[lid]
        vo_out.append({'id': lid, 'text': L['text'], 'file': L['file'], 'start': pl['start'], 'end': pl['end'], 'dur': L['dur'],
                       'words': [{'w': w['w'], 's': round(pl['start'] + w['s'], 4), 'e': round(pl['start'] + w['e'], 4)} for w in L['words']]})
    tl = {'fps': proj.get('fps', 60), 'width': proj.get('width', 1080), 'height': proj.get('height', 1920), 'duration': round(dur, 4),
          'bpm': bpm, 'beatsPerBar': bpb, 'beatOffset': off, 'grid': round(grid, 5), 'beats': beats,
          'bars': [b for i, b in enumerate(beats) if i % bpb == 0], 'sections': secs, 'scenes': scenes, 'vo': vo_out}
    json.dump(tl, open(os.path.join(P, 'timeline.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    # vo_full.wav — every line at its placed start
    n = int(math.ceil(dur * SR)) + 1; buf = np.zeros(n, dtype=np.float32)
    for L in vo_out:
        x = read_wav(os.path.join(P, L['file'])); i = int(round(L['start'] * SR)); j = min(n, i + len(x)); buf[i:j] += x[:j - i]
    os.makedirs(os.path.join(P, 'vo'), exist_ok=True)
    if vo_out: write_wav(os.path.join(P, 'vo', 'vo_full.wav'), buf)

    print(f'⏱  {dur:.3f}s · {bpm:g} bpm · grid {grid:.3f}s · {len(beats)} beats')
    for sc in scenes:
        print(f'  🎬 {sc["id"]:<10} {sc["start"]:7.3f} → {sc["end"]:7.3f}  ({sc["end"]-sc["start"]:.2f}s)  lines {sc["lines"]}  {(sc["transition"] or {}).get("type","")}')
    for L in vo_out: print(f'     🗣 {L["id"]:<6} {L["start"]:7.3f} → {L["end"]:7.3f}  «{L["text"][:40]}»')
    for s in secs: print(f'  ♫ {s["name"]:<6} {s["start"]:.2f} → {s["end"]:.2f}')
    print('✅ ' + os.path.join(P, 'timeline.json') + ('  + vo/vo_full.wav' if vo_out else ''))


if __name__ == '__main__':
    main()
