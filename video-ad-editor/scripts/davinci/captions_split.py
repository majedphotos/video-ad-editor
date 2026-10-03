"""يبني caps.json لوضع دافنشي: التوقيت من تفريغ دافنشي نفسه، والنص من تصحيحك.
التشغيل: python3 captions_split.py transcript.json fixes.json scenes.json caps.json

transcript.json = [[كلمة, بداية, نهاية], ...]   ← من MediaPoolItem.GetTranscription() (حوّل التايم كود لثواني)
fixes.json      = {"sentences": [["النص المصحّح للجملة", عدد كلمات دافنشي اللي تغطيها], ...]}
scenes.json     = [[بداية, نهاية, "F"|"D"], ...]   ← F ملء الشاشة · D كرت تحت والرسم فوق

ليش التوقيت من دافنشي: وِسبر ضغط آخر كلمتين بجملة الهوك بعُشر ثانية فخلص التظليل قبل الكلام (بلاغ 25 سبتمبر)،
وتفريغ دافنشي كان صح. النص المصحّح ينوزّع على مدة كلمات دافنشي اللي يغطيها (بالتساوي لو نفس العدد، وإلا بطول الحروف).
"""
import sys, json

TR, FX, SC, OUT = sys.argv[1:5]
words = json.load(open(TR)); fixes = json.load(open(FX))["sentences"]; scenes = json.load(open(SC))
MAXC = 52                                   # أكثر من كذا حرف = جملتين (يضمن 3 أسطر بالكثير)
down = [(s, e) for s, e, m in scenes if m == "D"]
bounds = sorted({b for s, e, _ in scenes for b in (s, e)})
mode = lambda t: "D" if any(a <= t + 0.25 < b for a, b in down) else "F"

sentences, i = [], 0
for text, k in fixes:
    src = words[i:i + k]; i += k
    if not src:
        continue
    toks = text.split()
    if len(toks) == len(src):
        ws = [[t, w[1], w[2]] for t, w in zip(toks, src)]
    else:                                    # عدد مختلف: وزّع على المدة بطول الحروف
        s0, e0 = src[0][1], src[-1][2]; tot = sum(len(t) for t in toks); acc = 0; ws = []
        for t in toks:
            a = s0 + (e0 - s0) * acc / tot; acc += len(t); ws.append([t, round(a, 2), round(s0 + (e0 - s0) * acc / tot, 2)])
    sentences.append(ws)
if i != len(words):
    print(f"⚠️ غطّيت {i} كلمة من {len(words)} — راجع الأعداد بـfixes.json")

out = []
for n, ws in enumerate(sentences):
    s, e = ws[0][1], (sentences[n + 1][0][1] if n + 1 < len(sentences) else ws[-1][2])
    parts = [ws]
    for b in bounds:                          # جملة تعبر حد تخطيط → تنقسم عنده
        if s + 0.3 < b < e - 0.3 and len(ws) > 1:
            k = min(range(1, len(ws)), key=lambda j: abs(ws[j][1] - b)); parts = [ws[:k], ws[k:]]; break
    fin = []
    for p in parts:
        txt = " ".join(w[0] for w in p)
        if len(txt) > MAXC and len(p) > 3:
            acc, k = 0, 1
            for j, w in enumerate(p):
                acc += len(w[0]) + 1
                if acc >= len(txt) / 2: k = j + 1; break
            fin += [p[:k], p[k:]]
        else:
            fin.append(p)
    for j, p in enumerate(fin):
        ps = p[0][1]; pe = fin[j + 1][0][1] if j + 1 < len(fin) else e
        out.append([round(ps, 2), round(pe, 2), mode(ps), p])
json.dump(out, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"✅ {OUT} — {len(out)} كابشن من {len(sentences)} جملة")
for c in out:
    print(f"{c[0]:6.2f}-{c[1]:6.2f} {c[2]} {' '.join(w[0] for w in c[3])}")
