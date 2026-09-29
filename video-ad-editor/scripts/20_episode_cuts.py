# -*- coding: utf-8 -*-
"""ريل من حلقة طويلة (v3.5) — يحوّل «من الكلمة الفلانية لين الكلمة الفلانية» لملفات السكل العادية، وبعدها الخطوات 5-11 كما هي.
  <work>/spec.json : {"segments": [[بداية_أول_كلمة, بداية_آخر_كلمة], ...]}  بثواني الحلقة (من transcript.txt / words.json لـ18)
                     الهوك أول قطعة (من وسط الكلام عادي) · تثبيت يدوي بعد فحص اللحمة: [s, e, {"a": 486.70, "b": 940.70}]
  ماك M1+:  uv run --python 3.12 --with mlx-whisper --with numpy python 20_episode_cuts.py <work> <episode.mp4> <words.json>
  غيره:     python3 20_episode_cuts.py <work> <episode.mp4> <words.json>      (openai-whisper، WHISPER_MODEL=turbo)
يكتب:
  cut.json   — حدود كل قطعة على أهدأ نقطة بين الكلمة وجارتها (ما يدخل نص كلمة الجار — درس اللحمات)
  a.json     — تفريغ ثاني لكل قطعة لحالها (أدق من تفريغ الحلقة)، جمل قصيرة، وكل جملة عليها "seg" (رقم قطعتها)
  fixes.json — قالب التصحيح (لو ما كان موجود): صحّح كل جملة بنفس عدد الكلمات · "" تشيل كلمة · نص وحدة لو وِسبر هلوس
  src.mov    — رابط للحلقة (03_cut_zoom يقصّ منها مباشرة، والعرضي يطلع بالطول حول الوجه)
بعدها: 02_captions.py ← 03_cut_zoom.py ← … ← 19_seam_check.py (إلزامي)."""
import sys as _sys, builtins as _bi
try:
    _sys.stdout.reconfigure(encoding="utf-8", errors="replace"); _sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception: pass
_real_open = _bi.open
def _utf8_open(f, mode="r", *a, **k):
    if "b" not in mode: k.setdefault("encoding", "utf-8")
    return _real_open(f, mode, *a, **k)
_bi.open = _utf8_open
import json, os, sys, subprocess, numpy as np
W, EP, WJ = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2]), sys.argv[3]
os.makedirs(W, exist_ok=True); SR = 16000
spec = json.load(open(os.path.join(W, "spec.json")))["segments"]
WORDS = sorted([w for s in json.load(open(WJ)) for w in s.get("words", []) if str(w.get("w", "")).strip()], key=lambda w: w["s"])
def audio(a, b):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{max(0,a):.3f}", "-t", f"{b-max(0,a):.3f}", "-i", EP, "-vn", "-ac", "1",
                          "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32)
def quietest(a, b):                       # أهدأ 60ms بين a و b
    if b - a < 0.07: return (a + b) / 2
    x = audio(a, b); hop = SR // 100; n = len(x) // hop
    if n < 7: return (a + b) / 2
    d = 20 * np.log10(np.sqrt((x[:n*hop].reshape(n, hop) ** 2).mean(1)) + 1e-9)
    k = np.convolve(d, np.ones(6) / 6, "valid"); return a + (int(k.argmin()) + 3) / 100
near = lambda t: min(range(len(WORDS)), key=lambda i: abs(WORDS[i]["s"] - t))
keep, log = [], []
for sg in spec:
    s0, e0, ov = sg[0], sg[1], (sg[2] if len(sg) > 2 else {})
    i0, i1 = near(s0), near(e0)
    pe = WORDS[i0-1]["e"] if i0 else s0 - 1; ns = WORDS[i1+1]["s"] if i1 + 1 < len(WORDS) else e0 + 2
    a = quietest(max(pe, WORDS[i0]["s"] - 0.5), WORDS[i0]["s"] + 0.02)
    lo = WORDS[i1]["e"]; hi = min(ns, lo + 0.6); b = quietest(lo, hi) if hi - lo > 0.07 else hi - 0.01
    a, b = ov.get("a", a), ov.get("b", b); keep.append([round(a, 3), round(b, 3)])
    log.append(f"  {len(keep)-1}: [{a:.2f}-{b:.2f}] {b-a:4.1f} ث «{WORDS[i0]['w']} … {WORDS[i1]['w']}»  (قبلها «{WORDS[i0-1]['w'] if i0 else ''}» · بعدها «{WORDS[i1+1]['w'] if i1+1<len(WORDS) else ''}»)")
json.dump({"keep": keep}, open(os.path.join(W, "cut.json"), "w"))
src = os.path.join(W, "src.mov")
if os.path.islink(src) or not os.path.exists(src):
    try: os.remove(src)
    except FileNotFoundError: pass
    os.symlink(EP, src)
print(f"القطع ({sum(b-a for a,b in keep):.1f} ث):\n" + "\n".join(log))
try:
    import mlx_whisper
    tr = lambda seg: mlx_whisper.transcribe(seg, path_or_hf_repo="mlx-community/whisper-large-v3-turbo", language="ar", word_timestamps=True, condition_on_previous_text=False)
except ImportError:
    import whisper; _m = whisper.load_model(os.environ.get("WHISPER_MODEL", "turbo"))
    tr = lambda seg: _m.transcribe(seg, language="ar", word_timestamps=True, condition_on_previous_text=False, fp16=False)
segs = []
for k, (a, b) in enumerate(keep):
    pts = [a]
    while b - pts[-1] > 22: pts.append(quietest(pts[-1] + 12, pts[-1] + 20))
    pts.append(b)
    for p, q in zip(pts, pts[1:]):
        for s in tr(audio(p, q))["segments"]:
            ws = [dict(word=w["word"].strip(), start=round(w["start"] + p, 3), end=round(w["end"] + p, 3)) for w in s.get("words", []) if w["word"].strip()]
            while ws:                                    # جمل قصيرة (≤ 6 كلمات / 34 حرف) — كرت الكابشن ما يطول
                n, L = 0, 0
                while n < len(ws) and n < 6 and L + len(ws[n]["word"]) <= 34: L += len(ws[n]["word"]) + 1; n += 1
                n = max(1, n); part, ws = ws[:n], ws[n:]
                segs.append(dict(seg=k, text=" ".join(w["word"] for w in part), words=part))
json.dump({"segments": segs}, open(os.path.join(W, "a.json"), "w"), ensure_ascii=False, indent=1)
fx = os.path.join(W, "fixes.json")
if not os.path.exists(fx):
    json.dump({"hot": [], "fix": [[w["word"] for w in s["words"]] for s in segs]}, open(fx, "w"), ensure_ascii=False, indent=1)
    print("📝 fixes.json قالب — صحّح كل جملة (نفس عدد الكلمات · \"\" تشيل · نص وحدة لو هلوس)")
else: print("⚠️ fixes.json موجود من قبل — تأكد عدد جمله يساوي", len(segs))
print(f"التفريغ: {len(segs)} جملة")
for i, s in enumerate(segs): print(f"  {i:2d} [ق{s['seg']}·{len(s['words'])}] {s['text']}")
