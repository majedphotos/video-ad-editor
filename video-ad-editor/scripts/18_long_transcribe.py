# -*- coding: utf-8 -*-
"""تفريغ حلقة كاملة (بودكاست/مقابلة ساعة) بسرعة ودقة — للاختيار قبل القص. (v3.5، مجرّب 27 سبتمبر على حلقة 53 د)
الدرس: وِسبر على الملف الطويل مرة وحدة يطيّح نوافذ كاملة ويخترع جملاً («اشتركوا في القناة» · «ترجمة نانسي قنقر»).
الحل: قطع ~20 ث تنقص عند السكتات، كل قطعة لحالها، ثم الفجوات (>7 ث) تنعاد بقطع 10 ث.
  ماك M1+ (أسرع ~8×، large-v3-turbo على كرت الشاشة):
    uv run --python 3.12 --with mlx-whisper --with numpy python 18_long_transcribe.py <فيديو> <مجلد>
  غيره (أبطأ): python3 18_long_transcribe.py <فيديو> <مجلد>   (openai-whisper، موديل WHISPER_MODEL=turbo افتراضاً)
يكتب <مجلد>/words.json ([{start,end,text,words:[{w,s,e}]}] بثواني الأصل) و<مجلد>/transcript.txt (دقيقة:ثانية + النص)."""
import json, os, sys, subprocess, time, numpy as np
src, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True); SR = 16000
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-vn", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
x = np.frombuffer(raw, np.float32); dur = len(x) / SR
BAD = ["اشتركوا في القناة", "ترجمة نانسي قنقر", "شكرا للمشاهدة"]
try:
    import mlx_whisper
    def tr(seg): return mlx_whisper.transcribe(seg, path_or_hf_repo="mlx-community/whisper-large-v3-turbo", language="ar",
                                               word_timestamps=True, condition_on_previous_text=False)
    ENG = "mlx turbo"
except ImportError:
    import whisper
    _m = whisper.load_model(os.environ.get("WHISPER_MODEL", "turbo"))
    def tr(seg): return _m.transcribe(seg, language="ar", word_timestamps=True, condition_on_previous_text=False, fp16=False)
    ENG = "openai-whisper"
hop = SR // 100; db = 20 * np.log10(np.sqrt(np.convolve(x[:len(x)//hop*hop].reshape(-1, hop).var(1) + 1e-12, np.ones(25) / 25, "same")) + 1e-9)
def cut_near(t):                       # أهدأ نقطة بين t-6 و t+6
    a, b = int((t - 6) * 100), int((t + 6) * 100); return (a + int(db[a:b].argmin())) / 100
cuts = [0.0]
while cuts[-1] < dur - 25: cuts.append(cut_near(cuts[-1] + 20))
cuts.append(dur)
def run(a, b, tag=0):
    r = tr(x[int(a * SR):int(b * SR)]); o = []
    for s in r["segments"]:
        t = s["text"].strip()
        if not t or any(k in t for k in BAD): continue
        o.append(dict(start=round(s["start"] + a, 2), end=round(s["end"] + a, 2), text=t, gap=tag,
                      words=[dict(w=w["word"].strip(), s=round(w["start"] + a, 2), e=round(w["end"] + a, 2)) for w in s.get("words", [])]))
    return o
t0 = time.time(); res = []
for i, (a, b) in enumerate(zip(cuts, cuts[1:])):
    res += run(a, b)
    if i % 20 == 0: print(f"{i}/{len(cuts)-1} · {b/60:.0f} د · {time.time()-t0:.0f} ث", flush=True)
gaps = [(p["end"], q["start"]) for p, q in zip(res, res[1:]) if q["start"] - p["end"] > 7]
for a, b in gaps:
    t = a
    while t < b - 1: e = min(t + 10, b + 0.3); res += run(t, e, 1); t = e
res.sort(key=lambda s: s["start"])
json.dump(res, open(os.path.join(out, "words.json"), "w"), ensure_ascii=False)
open(os.path.join(out, "transcript.txt"), "w").write("\n".join(f"{int(s['start']//60):02d}:{s['start']%60:04.1f} {s['text']}" for s in res))
print(f"✅ {ENG} · {dur/60:.0f} د صوت بـ{(time.time()-t0)/60:.1f} د · {len(res)} جملة · فجوات أعيدت: {len(gaps)} → {out}/transcript.txt")
