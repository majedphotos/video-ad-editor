# -*- coding: utf-8 -*-
"""فحص اللحمات لريل مقصوص من حلقة طويلة (v3.5): يفرّغ الملف النهائي ±4 ث حول كل لحمة (حدود cut.json) ويطبع
المسموع جنب المتوقع (caps.json) — كلمة مكررة عند اللحمة أو بقايا كلام من برّا تبان هني. ⚠️ = كلمتين متتاليتين نفس الشي.
  uv run --python 3.12 --with mlx-whisper --with numpy python 19_seam_check.py <work> <final.mp4>   (أو python3 مع openai-whisper)
التكرار ممكن يكون من كلام الشخص نفسه — شيّك بالمصدر قبل ما تقص. الحل المعتاد: ثبّت بداية/نهاية القطعة يدوياً على أهدأ نقطة."""
import json, sys, os, re, subprocess, numpy as np
W, F = sys.argv[1], sys.argv[2]; SR = 16000
keep = json.load(open(os.path.join(W, "cut.json")))["keep"]; caps = json.load(open(os.path.join(W, "caps.json")))
x = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", F, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout, np.float32)
try:
    import mlx_whisper
    tr = lambda seg: mlx_whisper.transcribe(seg, path_or_hf_repo="mlx-community/whisper-large-v3-turbo", language="ar", word_timestamps=True, condition_on_previous_text=False)
except ImportError:
    import whisper; _m = whisper.load_model(os.environ.get("WHISPER_MODEL", "turbo"))
    tr = lambda seg: _m.transcribe(seg, language="ar", word_timestamps=True, condition_on_previous_text=False, fp16=False)
norm = lambda s: re.sub(r"[^ء-ي0-9]", "", s).translate(str.maketrans("أإآىة", "ااايه"))
CW = [w for c in caps["cards"] for w in c["w"]]; acc, bad = 0, 0
for i, (a0, b0) in enumerate(keep[:-1]):
    acc += b0 - a0; a, b = max(0, acc - 4), acc + 4
    got = [(w["word"].strip(), w["start"] + a) for s in tr(x[int(a*SR):int(b*SR)])["segments"] for w in s.get("words", [])]
    ng = [norm(g) for g, _ in got]; dup = [ng[k] for k in range(1, len(ng)) if ng[k] == ng[k-1] and len(ng[k]) > 1]
    bad += bool(dup)
    print(f"لحمة {i+1} عند {acc:.2f} ث — حولها: " + " ".join(f"{g}({s:.1f})" for g, s in got if abs(s - acc) < 1.6))
    print("   المتوقع: " + " ".join(w["t"] for w in CW if a + 0.3 <= w["s"] <= b - 0.3))
    print("   المسموع: " + " ".join(g for g, _ in got))
    print(("   ⚠️ مكرر: " + " ".join(dup)) if dup else "   ✅ بلا تكرار")
print(f"{'✅ كل اللحمات نظيفة' if not bad else f'⚠️ {bad} لحمة تحتاج نظرة'} ({len(keep)-1} لحمة)")
