# -*- coding: utf-8 -*-
"""فحص تفريغ وِسبر قبل الكابشن — تكرار مهلوس + كلام طاح.  (6.1 — ريل «1000$ بيوم»)
  python3 02a_whisper_check.py <work>         ← يفحص a.json على a.wav: يخرج 0 نظيف · 3 فيه مشكلة (يطبع النوافذ)
  python3 02a_whisper_check.py <work> --fix   ← يعيد تفريغ النوافذ المشكوكة بقطع ≤ 25 ث بلا سياق (condition_on_previous_text=False)
                                                 ويدمجها بـa.json (الأصل يبقى a_orig.json)، ثم يعيد الفحص
الدرس: medium على ريل 124 ث طلّع «اشترك في القناة» ×15 بآخر 26 ث (الكلام الحقيقي ضاع)، وطيّح 4 ث بالنص (25.9→30.0) بلا أثر.
وِسبر يكمّل على نصه السابق فالحلقة تجر نفسها — القطعة لحالها بلا سياق تنحل. (نفس درس 18_long_transcribe.py للحلقات.)
يكشف: نفس الجملة 3 مرات ورا بعض · جمل الهلوسة المعروفة · كلمة ×4 ورا بعض · compression_ratio > 2.4 ·
       فجوة ≥ 1 ث (أو أول/آخر الملف) فيها كلام ≥ 0.6 ث بالصوت بلا تفريغ.
يحتاج: ffmpeg + numpy (والإصلاح: openai-whisper — نفس الخطوة 4). WHISPER_MODEL يغيّر الموديل (الافتراضي medium)."""
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass
import json, os, re, shutil, subprocess, sys
import numpy as np

W = os.path.abspath(sys.argv[1]) + os.sep
FIX = "--fix" in sys.argv
SR = 16000
BAD = ["اشترك في القناة", "اشتركوا في القناة", "ترجمة نانسي قنقر", "نانسي قنقر", "شكرا للمشاهدة", "شكراً للمشاهدة",
       "شكرا على المشاهدة", "Amara.org"]

A = json.load(open(W + "a.json", encoding="utf-8"))
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", W + "a.wav", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                     capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.float32)
DUR = len(x) / SR
hop = SR // 100; n = len(x) // hop
db = 10 * np.log10((x[:n * hop].reshape(n, hop).astype(np.float64) ** 2).mean(1) + 1e-12)   # مستوى كل 10 ms
THR = max(-45.0, float(np.percentile(db, 90)) - 20)   # كلام = أعلى من (مستوى الكلام العالي − 20 dB)

def voiced(a, b):
    i, j = max(0, int(a * 100)), min(n, int(b * 100))
    return float((db[i:j] > THR).sum()) / 100

norm = lambda s: re.sub(r"[\u064B-\u0652\u0640\s.,،!؟?]+", "", s or "")

def problems(segs):
    out = []
    i = 0
    while i < len(segs):                                   # نفس الجملة 3 مرات ورا بعض
        j = i
        while j + 1 < len(segs) and norm(segs[i]["text"]) and norm(segs[j + 1]["text"]) == norm(segs[i]["text"]): j += 1
        if j - i + 1 >= 3: out.append((segs[i]["start"], segs[j]["end"], "«%s» ×%d" % (segs[i]["text"].strip(), j - i + 1)))
        i = j + 1
    for s in segs:
        if any(k in s["text"] for k in BAD): out.append((s["start"], s["end"], "جملة هلوسة معروفة «%s»" % s["text"].strip()))
        if s.get("compression_ratio", 0) > 2.4: out.append((s["start"], s["end"], "تكرار داخل الجملة (compression %.1f)" % s["compression_ratio"]))
        ws = [norm(w.get("word")) for w in s.get("words", [])]
        if any(ws[k] and ws[k] == ws[k + 1] == ws[k + 2] == ws[k + 3] for k in range(len(ws) - 3)):
            out.append((s["start"], s["end"], "كلمة ×4 ورا بعض"))
    edges = [(0.0, segs[0]["start"] if segs else DUR)] + [(segs[k]["end"], segs[k + 1]["start"]) for k in range(len(segs) - 1)] \
          + [(segs[-1]["end"] if segs else 0.0, DUR)]
    for a, b in edges:                                     # كلام بالصوت بلا تفريغ
        if b - a >= 1.0 and voiced(a, b) >= 0.6: out.append((a, b, "فجوة %.1f ث فيها كلام %.1f ث بلا تفريغ" % (b - a, voiced(a, b))))
    out.sort()
    win = []                                               # نوافذ: كل مشكلة + الجمل اللي تلمسها كاملة (الجملة قبل الفجوة غالباً مبتورة)
    for a, b, why in out:
        a, b = min([a] + [s["start"] for s in segs if s["end"] > a - 0.6 and s["start"] < b + 0.6]), \
               max([b] + [s["end"] for s in segs if s["end"] > a - 0.6 and s["start"] < b + 0.6])
        if win and a <= win[-1][1] + 2.0: win[-1][1] = max(win[-1][1], b); win[-1][2].append(why)
        else: win.append([a, b, [why]])
    return win

def show(win):
    for a, b, why in win: print("  ⚠️ %6.2f → %6.2f ث : %s" % (a, b, " · ".join(dict.fromkeys(why))))

segs = A["segments"]
win = problems(segs)
if not win:
    print("✅ التفريغ نظيف — بلا تكرار ولا كلام طاح (%d جملة · %.1f ث)" % (len(segs), DUR)); sys.exit(0)
print("وِسبر: %d نافذة مشكوك فيها" % len(win)); show(win)
if not FIX:
    print("صلّحها: python3 scripts/02a_whisper_check.py <work> --fix   (يعيد تفريغ النوافذ بس، والأصل يبقى a_orig.json)")
    sys.exit(3)

import whisper
MODEL = os.environ.get("WHISPER_MODEL", "medium")
print("⏳ إعادة تفريغ %.0f ث بموديل %s (بلا سياق)…" % (sum(b - a for a, b, _ in win), MODEL), flush=True)
m = whisper.load_model(MODEL)

def quiet(lo, hi):                                         # أهدأ نقطة بين lo و hi
    i, j = max(0, int(lo * 100)), min(n, int(hi * 100))
    return (i + int(db[i:j].argmin())) / 100 if j > i else lo

keep = list(segs)
for a, b, _ in win:
    prev = max([s["end"] for s in segs if s["end"] <= a] + [0.0])
    nxt = min([s["start"] for s in segs if s["start"] >= b] + [DUR])
    a2, b2 = quiet(max(prev, a - 0.6), a), quiet(b, min(nxt, b + 0.6))   # حدود القطعة بالسكتة، بلا ما تقص كلمة من الجيران
    cuts = [a2]
    while b2 - cuts[-1] > 25: cuts.append(quiet(cuts[-1] + 18, cuts[-1] + 23))
    cuts.append(b2)
    new = []
    for c0, c1 in zip(cuts, cuts[1:]):
        r = m.transcribe(x[int(c0 * SR):int(c1 * SR)].copy(), language="ar", word_timestamps=True,
                         condition_on_previous_text=False, fp16=False)
        for s in r["segments"]:
            if not s["text"].strip() or any(k in s["text"] for k in BAD): continue
            s["start"] = round(s["start"] + c0, 2); s["end"] = round(s["end"] + c0, 2)
            for w in s.get("words", []): w["start"] = round(w["start"] + c0, 2); w["end"] = round(w["end"] + c0, 2)
            new.append(s)
    keep = [s for s in keep if s["end"] <= a2 or s["start"] >= b2] + new
    print("  ✓ %6.2f → %6.2f : %s" % (a2, b2, " ".join(s["text"].strip() for s in new)[:160]), flush=True)

keep.sort(key=lambda s: s["start"])
for i, s in enumerate(keep): s["id"] = i
if not os.path.exists(W + "a_orig.json"): shutil.copy(W + "a.json", W + "a_orig.json")
A["segments"] = keep; A["text"] = " ".join(s["text"].strip() for s in keep)
json.dump(A, open(W + "a.json", "w", encoding="utf-8"), ensure_ascii=False)
nw = lambda ss: sum(len(s.get("words", [])) for s in ss)
print("✅ a.json: %d ← %d جملة · %d ← %d كلمة (الأصل a_orig.json)" % (len(segs), len(keep), nw(segs), nw(keep)))
left = problems(keep)
if left:
    print("⚠️ باقي بعد الإصلاح — صحّحها بـfixes.json (نص وحدة بدل القائمة للجملة المهلوسة):"); show(left); sys.exit(3)
