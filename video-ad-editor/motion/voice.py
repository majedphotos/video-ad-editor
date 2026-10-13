#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""voice.py — صوت «شرح بالموشن»: سطر سطر بتوقيت كل كلمة.

  python3 voice.py <proj>                     # edge-tts بالصوت المختار (project.json ← voice.name أو --voice) لكل سطر بـ<proj>/script.json
  python3 voice.py <proj> --voice ar-KW-NouraNeural --rate +8% --pitch +0Hz
  python3 voice.py <proj> --only l2,l3        # يعيد أسطر معيّنة بس (الباقي من الكاش)
  python3 voice.py <proj> --force             # يتجاهل الكاش
  python3 voice.py <proj> --align whisper     # توقيت الكلمات من وِسبر بدل حدود edge-tts
  python3 voice.py <proj> --own voice.wav [--whisper-model small]
                                              # صوت الشخص نفسه: وِسبر يوقّت الكلمات ويقسّمه على أسطر script.json

script.json: [{"id":"l1","text":"...","rate":"+5%","pitch":"+0Hz","gap_after":0.2,"voice":"..."}]
المخرج: <proj>/vo/<id>.wav (48k mono) + <proj>/vo/words.json
  words.json = {"voice":..., "source":..., "lines":[{"id","text","file","dur","words":[{"w","s","e"}],"gap_after","source","orig_start"?}]}
  أوقات الكلمات نسبةً لبداية ملف السطر (ثواني).
"""
import sys, os, json, re, argparse, asyncio, hashlib, subprocess, tempfile, wave, difflib
import numpy as np

SR = 48000
DEF_VOICE = None   # ⛔ لا صوت افتراضي: المستخدم يختار (صفحة البداية) أو جرّب الأصوات على نصّه واختار الأوضح


def run(cmd):
    r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if r.returncode != 0:
        raise RuntimeError('command failed: ' + ' '.join(cmd) + '\n' + r.stderr.decode('utf-8', 'replace')[-800:])
    return r.stdout


def decode(path_or_bytes, suffix='.mp3'):
    """any audio → float32 mono @48k"""
    tmp = None
    if isinstance(path_or_bytes, (bytes, bytearray)):
        tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False); tmp.write(path_or_bytes); tmp.close(); src = tmp.name
    else:
        src = path_or_bytes
    raw = run(['ffmpeg', '-v', 'error', '-i', src, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'])
    if tmp: os.unlink(tmp.name)
    return np.frombuffer(raw, dtype=np.float32).copy()


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype('<i2').tobytes())


def trim(x, thr_db=-45, pre=0.03, post=0.09):
    """trim leading/trailing silence → (y, shift_seconds)"""
    win = int(0.01 * SR)
    if len(x) < win * 3: return x, 0.0
    n = len(x) // win
    rms = np.sqrt(np.mean(x[:n * win].reshape(n, win) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms + 1e-12)
    on = np.where(db > thr_db)[0]
    if not len(on): return x, 0.0
    a = max(0, on[0] * win - int(pre * SR)); b = min(len(x), (on[-1] + 1) * win + int(post * SR))
    y = x[a:b].copy()
    f = int(0.004 * SR)  # tiny fades → no clicks
    y[:f] *= np.linspace(0, 1, f); y[-f:] *= np.linspace(1, 0, f)
    return y, a / SR


AR_DIAC = re.compile(r'[ً-ٰٟـ]')
def norm(w):
    w = AR_DIAC.sub('', w)
    w = re.sub(r'[إأآٱ]', 'ا', w); w = w.replace('ة', 'ه').replace('ى', 'ي').replace('ؤ', 'و').replace('ئ', 'ي')
    w = re.sub(r'[^\w]', '', w, flags=re.UNICODE)
    return w.lower()


def split_words(text):
    return [w for w in re.split(r'\s+', text.strip()) if norm(w)]


_WHISPER = {}
def whisper_words(path, model='small', lang='ar', prompt=None):
    import whisper  # openai-whisper (installed for python3.9)
    if model not in _WHISPER: _WHISPER[model] = whisper.load_model(model)
    r = _WHISPER[model].transcribe(path, language=lang, word_timestamps=True, fp16=False, initial_prompt=prompt, condition_on_previous_text=False)
    out = []
    for seg in r.get('segments', []):
        for w in seg.get('words', []) or []:
            if norm(w['word']): out.append({'w': w['word'].strip(), 's': float(w['start']), 'e': float(w['end'])})
    return out


def align(script_words, heard):
    """map each script word to a heard word time (difflib on normalized tokens), interpolate gaps"""
    A = [norm(w) for w in script_words]; B = [norm(h['w']) for h in heard]
    times = [None] * len(A)
    sm = difflib.SequenceMatcher(a=A, b=B, autojunk=False)
    for blk in sm.get_opcodes():
        tag, a0, a1, b0, b1 = blk
        if tag == 'equal' or (tag == 'replace' and (a1 - a0) == (b1 - b0)):
            for k in range(a1 - a0): times[a0 + k] = (heard[b0 + k]['s'], heard[b0 + k]['e'])
        elif tag == 'replace' and b1 > b0:          # uneven replace → spread proportionally over the heard span
            s0, e0 = heard[b0]['s'], heard[b1 - 1]['e']; n = a1 - a0
            for k in range(n): times[a0 + k] = (s0 + (e0 - s0) * k / n, s0 + (e0 - s0) * (k + 1) / n)
    # interpolate missing
    known = [i for i, t in enumerate(times) if t]
    if not known: raise RuntimeError('whisper alignment found no matching words')
    for i in range(len(times)):
        if times[i]: continue
        prv = max([k for k in known if k < i], default=None); nxt = min([k for k in known if k > i], default=None)
        if prv is None: s = times[nxt][0] - 0.25 * (nxt - i); times[i] = (max(0, s), max(0, s) + 0.2)
        elif nxt is None: s = times[prv][1] + 0.05 * (i - prv); times[i] = (s, s + 0.25)
        else:
            s0, e0 = times[prv][1], times[nxt][0]; span = (e0 - s0) / (nxt - prv)
            times[i] = (s0 + span * (i - prv - 1) + 0.01, s0 + span * (i - prv))
    return times


async def tts(text, voice, rate, pitch):
    import edge_tts
    c = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary='WordBoundary')
    audio = bytearray(); words = []
    async for ch in c.stream():
        if ch['type'] == 'audio': audio.extend(ch['data'])
        elif ch['type'] == 'WordBoundary':
            s = ch['offset'] / 1e7; words.append({'w': ch['text'], 's': s, 'e': s + ch['duration'] / 1e7})
    return bytes(audio), words


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('proj'); ap.add_argument('--voice'); ap.add_argument('--rate'); ap.add_argument('--pitch')
    ap.add_argument('--only'); ap.add_argument('--force', action='store_true')
    ap.add_argument('--align', choices=['boundary', 'whisper'], default='boundary')
    ap.add_argument('--own'); ap.add_argument('--whisper-model', default='small')
    ap.add_argument('--keep-silence', action='store_true')   # مع --own: لا تقصّر السكتات الطويلة
    a = ap.parse_args()
    P = os.path.abspath(a.proj); VO = os.path.join(P, 'vo'); os.makedirs(VO, exist_ok=True)
    script = json.load(open(os.path.join(P, 'script.json'), encoding='utf-8'))
    proj = json.load(open(os.path.join(P, 'project.json'), encoding='utf-8'))
    pv = proj.get('voice', {}) or {}
    voice = a.voice or pv.get('name') or DEF_VOICE
    if not voice and not a.own:
        sys.exit('⛔ ما فيه صوت مختار — حط project.json ← voice.name (أو --voice). جرّب أكثر من صوت على 3 جمل وقيّمها بوِسبر medium، وخل المستخدم يسمع ويختار. الفصحى المشكّلة أضمن من اللهجة.')
    wj = os.path.join(VO, 'words.json')
    old = {}
    if os.path.exists(wj):
        try: old = {L['id']: L for L in json.load(open(wj, encoding='utf-8')).get('lines', [])}
        except Exception: old = {}
    only = set(a.only.split(',')) if a.only else None
    lines = []

    if a.own:                                                   # ── person's own voiceover
        # ⚠️ صوت الشخص ما يُقص عند حدود كلمات وِسبر (كان يقص أول الكلام وأواخر الجمل — بلاغ 8 أكتوبر 2026).
        #    القطع تغطي التسجيل كامل بلا فراغ، الحدود عند أهدأ نقطة بين الأسطر، والقص الوحيد =
        #    تقصير السكتات الطويلة (≥0.45 ث ← 0.30 ث) بتلاشي 8 مللي (إلا مع --keep-silence).
        src = os.path.abspath(a.own); x = decode(src); x = x if x.ndim == 1 else x.mean(1)
        print(f'🎙  صوتك: {os.path.basename(src)} ({len(x)/SR:.1f}s) → وِسبر {a.whisper_model} …', flush=True)
        tmpw = os.path.join(VO, '_own_48k.wav'); write_wav(tmpw, x)
        heard = whisper_words(tmpw, a.whisper_model, prompt=' '.join(L['text'] for L in script)[:600])
        allw, owner = [], []
        for li, L in enumerate(script):
            for w in split_words(L['text']): allw.append(w); owner.append(li)
        T = align(allw, heard)
        HOP = 480                                               # 10 مللي
        def frames(sig):
            n = len(sig) // HOP; return 20 * np.log10(np.sqrt(np.mean(sig[:n * HOP].reshape(n, HOP) ** 2, axis=1)) + 1e-9)
        r = frames(x); spm = r > -42; spi = np.where(spm)[0]
        if not len(spi): sys.exit('⛔ ما لقيت كلام بالتسجيل')
        first, last = int(spi[0]), int(spi[-1])               # بداية/نهاية الكلام بالطاقة — مو بوِسبر (يفوّت أول كلمة أحياناً)
        # كلمات البداية اللي وِسبر ما سمعها تنحط قبل الكلام (أو تتكدس عند 0) → نوزّعها من بداية الكلام الفعلية لأول كلمة مسموعة
        onset = first * HOP / SR; k = 0
        while k < len(T) and T[k][0] < onset - 0.02: k += 1
        if k:
            stop = T[k][0] if k < len(T) else onset + 0.3 * k
            step = (stop - onset) / k if stop - onset > 0.12 * k else 0.25
            for q in range(k): T[q] = (onset + step * q, onset + step * (q + 1))
            print(f'  ↪ {k} كلمة بالبداية ما انسمعت — توزّعت من بداية الكلام ({onset:.2f}s)')
        runs, i = [], first
        while i <= last:
            if spm[i]: i += 1; continue
            j = i
            while j <= last and not spm[j]: j += 1
            if not a.keep_silence and j - i >= 45: runs.append((i, j))
            i = j
        keep, seg0 = [], max(0, (first - 12) * HOP)            # 0.12 ث قبل أول كلمة
        for ra, rb in runs:
            keep.append((seg0, (ra + 15) * HOP)); seg0 = (rb - 15) * HOP   # نخلي 0.15 ث بكل طرف من السكتة
        keep.append((seg0, min(len(x), (last + 50) * HOP)))  # 0.5 ث بعد آخر كلمة
        F = int(0.008 * SR); pieces, emap, pos = [], [], 0
        for k, (p0, p1) in enumerate(keep):
            sg = x[p0:p1].copy()
            if k > 0: sg[:F] *= np.linspace(0, 1, F)
            if k < len(keep) - 1: sg[-F:] *= np.linspace(1, 0, F)
            pieces.append(sg); emap.append((p0 / SR, p1 / SR, pos / SR)); pos += len(sg)
        y = np.concatenate(pieces)
        def newt(t):
            for p0, p1, p in emap:
                if p0 <= t <= p1: return p + (t - p0)
            for p0, p1, p in emap:
                if t < p0: return p
            return emap[-1][2] + (emap[-1][1] - emap[-1][0])
        Tn = [(newt(s_), newt(e_)) for s_, e_ in T]
        ry = frames(y)
        def valley(t0, t1):                                    # أهدأ 10 مللي بالنافذة = مكان الحد
            fa = max(0, int(t0 * SR / HOP)); fb = min(len(ry) - 1, int(t1 * SR / HOP))
            if fb <= fa: return int((t0 + t1) / 2 * SR)
            k = fa + int(np.argmin(ry[fa:fb + 1])); return int((k + .5) * HOP)
        lis = [li for li in range(len(script)) if li in owner]
        bounds = [0]
        for lp, li in zip(lis, lis[1:]):
            ip = [q for q, o in enumerate(owner) if o == lp][-1]; inx = [q for q, o in enumerate(owner) if o == li][0]
            t0 = max(Tn[ip][1] - 0.12, Tn[ip][0] + 0.05); t1 = min(Tn[inx][0] + 0.12, Tn[inx][1] - 0.02)
            bounds.append(max(valley(t0, max(t1, t0 + 0.02)), bounds[-1] + HOP))
        bounds.append(len(y))
        bad = 0
        for n_, li in enumerate(lis):
            L = script[li]; p0, p1 = bounds[n_], bounds[n_ + 1]; seg = y[p0:p1].copy(); s0 = p0 / SR
            fn = os.path.join(VO, L['id'] + '.wav'); write_wav(fn, seg)
            idx = [q for q, o in enumerate(owner) if o == li]
            words = [{'w': allw[q], 's': round(max(0.0, Tn[q][0] - s0), 4), 'e': round(max(0.0, Tn[q][1] - s0), 4)} for q in idx]
            lines.append({'id': L['id'], 'text': L['text'], 'file': 'vo/' + L['id'] + '.wav', 'dur': round(len(seg) / SR, 4), 'words': words,
                          'gap_after': 0, 'source': 'own-clean', 'orig_start': round(s0, 4), 'orig_end': round(p1 / SR, 4)})
            if n_ > 0:                                         # فحص: الحد لازم يكون سكتة، مو داخل كلام
                near = float(20 * np.log10(np.sqrt(np.mean(y[max(0, p0 - 240):p0 + 240] ** 2)) + 1e-9))
                loc = float(20 * np.log10(np.sqrt(np.mean(y[max(0, p0 - 14400):p0 + 14400] ** 2)) + 1e-9))
                if near > loc - 14: bad += 1; print(f'  ⚠ حد {L["id"]} عند {s0:.2f}s قريب من كلام ({near:.0f} dB)')
            print(f'  ✓ {L["id"]}  {s0:6.2f}→{p1/SR:6.2f}s  {len(words)} كلمة')
        os.unlink(tmpw); write_wav(os.path.join(VO, '_own_clean_full.wav'), y)
        print(f'  التسجيل {len(x)/SR:.1f}s ← النظيف {len(y)/SR:.1f}s · سكتات مقصّرة {len(runs)} · حدود داخل كلام: {bad}')
        json.dump({'voice': 'own:' + os.path.basename(src), 'source': 'own', 'lines': lines}, open(wj, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('  👉 حط بـproject.json: "timing": {"keepOriginal": true, "snap": "none"} — وaudio.py يعاير صوتك على ‎-20 LUFS تلقائياً (بلا ليمتر يغيّر صوتك)')
        print('✅ ' + wj); return

    for L in script:                                            # ── edge-tts per line
        v = L.get('voice') or voice; rate = L.get('rate') or a.rate or pv.get('rate') or '+0%'; pitch = L.get('pitch') or a.pitch or pv.get('pitch') or '+0Hz'
        key = hashlib.sha1(json.dumps([L['text'], v, rate, pitch, a.align]).encode()).hexdigest()[:12]
        fn = os.path.join(VO, L['id'] + '.wav'); o = old.get(L['id'])
        if not a.force and (only is None or L['id'] not in only) and o and o.get('hash') == key and os.path.exists(fn):
            o['gap_after'] = L.get('gap_after'); lines.append(o); print(f'  = {L["id"]} (كاش)'); continue
        audio, words = None, []
        for attempt in range(2):                                # network hiccup → one retry, then stop (red-flag rule)
            try: audio, words = asyncio.run(tts(L['text'], v, rate, pitch)); break
            except Exception as e:
                if attempt: raise
                print('  ⚠ edge-tts فشل، محاولة ثانية وحدة:', e)
        x = decode(audio); y, shift = trim(x)
        src = 'edge-tts'
        if a.align == 'whisper' or not words:
            tmp = fn + '.tmp.wav'; write_wav(tmp, y)
            try:
                heard = whisper_words(tmp, a.whisper_model, prompt=L['text']); sw = split_words(L['text'])
                T = align(sw, heard); words = [{'w': sw[i], 's': T[i][0], 'e': T[i][1]} for i in range(len(sw))]; src = 'edge-tts+whisper'; shift = 0.0
            except Exception as e:                              # last resort: proportional by characters
                sw = split_words(L['text']); tot = sum(len(w) for w in sw); acc = 0; dur = len(y) / SR; words = []
                for w in sw: words.append({'w': w, 's': dur * acc / tot, 'e': dur * (acc + len(w)) / tot}); acc += len(w)
                src = 'edge-tts+proportional'; shift = 0.0; print('  ⚠ whisper fallback failed:', e)
            finally:
                if os.path.exists(tmp): os.unlink(tmp)
        dur = len(y) / SR
        words = [{'w': w['w'], 's': round(max(0.0, w['s'] - shift), 4), 'e': round(min(dur, max(0.0, w['e'] - shift)), 4)} for w in words]
        write_wav(fn, y)
        lines.append({'id': L['id'], 'text': L['text'], 'file': 'vo/' + L['id'] + '.wav', 'dur': round(dur, 4), 'words': words,
                      'gap_after': L.get('gap_after'), 'source': src, 'voice': v, 'rate': rate, 'pitch': pitch, 'hash': key})
        print(f'  ✓ {L["id"]}  {dur:5.2f}s  {len(words)} كلمة  [{src}]  «{L["text"][:40]}»')
    json.dump({'voice': voice, 'source': 'tts', 'lines': lines}, open(wj, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('✅ ' + wj)


if __name__ == '__main__':
    main()
