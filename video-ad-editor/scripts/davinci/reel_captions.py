"""كابشن لوتي لريل مقصوص من حلقة: يحوّل كلمات الأصل (توقيت الحلقة) لزمن الريل ويقسّمها كابشنات قصيرة.
التشغيل: python3 reel_captions.py transcript.json reel.json out.json
transcript.json = {"segments":[{"w":[[كلمة, بداية, نهاية],...]}]}  ← من تفريغ دافنشي
reel.json = {"segs": [[بداية, نهاية], ...], "fixes": {"كلمة غلط": "صح", ...}, "cy": 1330,
             "title": "عنوان الريل (حبّة فوق طول الريل — اختياري)",
             "end": {"lines": ["ملخص سطر 1", "سطر 2"], "cta": "اختياري", "secs": 3.5}}   ← بطاقة الختام (اختيارية)
يطبع "extra" = مدة بطاقة الختام — مرّرها لـdavinci_reels.py مع الريل.
"""
import sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lottie_lib import Doc, caption, load_theme, end_card, BLACK

TR, RL, OUT = sys.argv[1:4]
words = [w for s in json.load(open(TR))["segments"] for w in s["w"]]
R = json.load(open(RL)); fixes = R.get("fixes", {}); T = load_theme(R.get("theme", "theme.json"))
seq, off = [], 0.0
for s, e in R["segs"]:
    for w, a, b in words:
        mid = (a + b) / 2
        if s <= mid < e:
            seq.append([fixes.get(w, w), round(max(a, s) - s + off, 2), round(min(b, e) - s + off, 2)])
    off += e - s
seq = [w for w in seq if w[0]]
caps, cur = [], []
for w in seq:                                # كابشن: 45 حرف بالكثير أو 3.2 ث، وينقطع عند وقفة > 0.45 ث
    if cur and (len(" ".join(x[0] for x in cur + [w])) > 45 or w[2] - cur[0][1] > 3.2 or w[1] - cur[-1][2] > 0.45):
        caps.append(cur); cur = []
    cur.append(w)
if cur: caps.append(cur)
END = R.get("end"); EXTRA = float(END.get("secs", 3.5)) if END else 0.0
d = Doc(off + (EXTRA + 0.1 if END else 0.5))
if R.get("title"):
    d.pill(R["title"], 0.05, off, 540, 235, 54, T["acc"], T["bg"], BLACK)
for i, c in enumerate(caps):
    e = caps[i + 1][0][1] if i + 1 < len(caps) and caps[i + 1][0][1] - c[-1][2] < 0.6 else c[-1][2] + 0.25
    caption(d, c, c[0][1], min(e, off), R.get("cy", 1330), card=True, ink=T["ink"], acc=T["acc"], cardc=T["bg"])
if END:
    end_card(d, off, off + EXTRA, T, R.get("title", ""), END["lines"], END.get("cta", "تابعني عشان ما يفوتك الجاي"))
d.save(OUT)
print(f"✅ {OUT} — {len(caps)} كابشن · {off:.1f} ث" + (f" + ختام {EXTRA} ث (extra={EXTRA})" if END else ""))
