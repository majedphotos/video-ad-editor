# -*- coding: utf-8 -*-
"""فحص اللحمات لريل مقصوص من حلقة طويلة (v3.5): يفرّغ الملف النهائي ±4 ث حول كل لحمة (حدود cut.json) ويطبع
المسموع جنب المتوقع (caps.json) — كلمة مكررة عند اللحمة أو بقايا كلام من برّا تبان هني. ⚠️ = كلمتين متتاليتين نفس الشي.
  uv run --python 3.12 --with mlx-whisper --with numpy python 19_seam_check.py <work> <final.mp4>   (أو python3 مع openai-whisper)
التكرار ممكن يكون من كلام الشخص نفسه — شيّك بالمصدر قبل ما تقص. الحل المعتاد: ثبّت بداية/نهاية القطعة يدوياً على أهدأ نقطة.

🆕 6.8 — الفحص النهائي الآلي (أي ريل أو إعلان، قبل التسليم):
  python3 19_seam_check.py final <final.mp4> [<work>] [--json] [--save]
  يفحص الملف النهائي نفسه (مو الخطة): فك الملف بلا أخطاء · الشكل (مقاس/فريمات/ترميز/صوت موجود) · فريمات سودا · تجمّد · مستوى الصوت والذروة والقطع والسكتات
  · مزامنة مدة الصوت مع الصورة · ألوان الحاوية (HDR يتسرّب؟) · لقطات من الفيديو فيها فريم فاضي · وبوجود <work>/caps.json: الكابشن (بداية/نهاية/تداخل/كرت أقل من 1.2 ث/كلمة بروحها) ومدته مع مدة الفيديو.
  ❌ = لا تسلّم · ⚠️ = شوف ووافق عليه بنفسك · يخرج بالرمز 3 عند أي ❌ (مثل 08_safe_check). ما يحتاج غير ffmpeg (بايثون عادي، بلا numpy). `--save` يكتب <work>/final_check.json (بدونه ما يكتب شي بأي مكان).
  ما يغني عن: 08_safe_check.js (المنطقة الآمنة) ولا مقارنة التفريغ بالكابشن (خطوة التحقق 1 بالسكل) ولا العين."""
import json, sys, os, re, subprocess, statistics

# ───────────────────────── 🆕 الفحص النهائي الآلي: python3 19_seam_check.py final <final.mp4> [<work>] [--json] [--save] ─────────────────────────
def _final_check(args):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    as_json = "--json" in args; save = "--save" in args
    pos = [a for a in args if not a.startswith("--")]
    if not pos:
        sys.exit("الاستخدام: python3 19_seam_check.py final <final.mp4> [<work>] [--json] [--save]")
    F = pos[0]; W = pos[1] if len(pos) > 1 else None
    if not os.path.isfile(F):
        sys.exit(f"❌ ما لقيت الملف: {F}")
    res = []                                   # (مستوى, مفتاح, رسالة) — مستوى: ok / warn / fail
    def add(lv, key, msg): res.append((lv, key, msg))
    def run(cmd):
        # stdin مسدود + -nostdin: ffmpeg يقرأ الطرفية ويطلع لو شاف q — داخل حلقة bash كان يقطع التحليل بنصه (انكشف باختبار ريلات حقيقية)
        if cmd and cmd[0] == "ffmpeg": cmd = [cmd[0], "-nostdin"] + cmd[1:]
        return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", stdin=subprocess.DEVNULL)

    # 1) ffprobe — الشكل
    pr = run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", F])
    try:
        info = json.loads(pr.stdout)
    except Exception:
        info = {}
    streams = info.get("streams") or []
    vs = next((x for x in streams if x.get("codec_type") == "video"), None)
    au = next((x for x in streams if x.get("codec_type") == "audio"), None)
    if not vs:
        add("fail", "format", "ما فيه مسار فيديو بالملف (أو الملف مكسور ما ينقرا)")
        return _final_report(res, F, W, 0.0, as_json, save)
    def fnum(v, d=0.0):
        try: return float(v)
        except Exception: return d
    def frate(r):
        try:
            a, b = str(r).split("/"); return float(a) / float(b) if float(b) else 0.0
        except Exception:
            return fnum(r)
    dur = fnum((info.get("format") or {}).get("duration"), fnum(vs.get("duration")))
    w, h = int(vs.get("width") or 0), int(vs.get("height") or 0)
    fps = frate(vs.get("avg_frame_rate")); rfps = frate(vs.get("r_frame_rate"))
    codec, pix = vs.get("codec_name"), vs.get("pix_fmt")
    desc = f"{w}×{h} · {fps:.2f} فريم · {codec} · {pix} · {dur:.2f} ث"
    bad_fmt = []
    if (w, h) not in ((1080, 1920), (1920, 1080), (1080, 1350), (1080, 1080)): bad_fmt.append("المقاس مو من مقاسات انستقرام/يوتيوب المعتادة")
    if codec != "h264": bad_fmt.append(f"الترميز {codec} (المتوقع h264)")
    if pix != "yuv420p": bad_fmt.append(f"{pix} (المتوقع yuv420p — غيره ما ينقرا بكل الجوالات)")
    if fps < 23 or (rfps and abs(fps - rfps) > 0.5): bad_fmt.append("عدد الفريمات متغيّر أو واطي")
    add("warn" if bad_fmt else "ok", "format", desc + ((" — " + " · ".join(bad_fmt)) if bad_fmt else ""))
    if dur < 1.0:
        add("fail", "duration", f"المدة {dur:.2f} ث — الملف شبه فاضي")

    # 2) الصوت موجود + مدته مع الصورة
    if not au:
        add("fail", "audio-stream", "ما فيه مسار صوت — الريل صامت!")
    else:
        vd, ad = fnum(vs.get("duration"), dur), fnum(au.get("duration"), dur)
        gap = abs(vd - ad)
        if gap > 1.0: add("fail", "av-sync", f"مدة الصوت {ad:.2f} ث ومدة الصورة {vd:.2f} ث — فرق {gap:.2f} ث (الصوت أو الصورة ينقطع قبل الثاني)")
        elif gap > 0.25: add("warn", "av-sync", f"مدة الصوت {ad:.2f} ث ومدة الصورة {vd:.2f} ث — فرق {gap:.2f} ث")
        else: add("ok", "av-sync", f"الصوت والصورة بنفس المدة (فرق {gap:.2f} ث)")

    # 3) ألوان الحاوية — HDR متسرّب، أو ملف ألوان الحاوية (colr) غير اللي يطلعه خط السكل (prof)
    tr, cs, cp = vs.get("color_transfer"), vs.get("color_space"), vs.get("color_primaries")
    def colr_kind():
        # نوع صندوق colr بالـmp4: prof = ملف ألوان sRGB (اللي يطلعه خط السكل) · nclx = وسوم فقط (أبل يعرضه أفتح) · None = ما فيه. نفس طريقة tools/color-check.sh
        try:
            sz = os.path.getsize(F)
            with open(F, "rb") as fh:
                head = fh.read(4 << 20); i = head.find(b"colr")
                if i < 0 and sz > (4 << 20):
                    fh.seek(max(0, sz - (8 << 20))); tailb = fh.read(); i = tailb.find(b"colr"); head = tailb
            return head[i + 4:i + 8].decode("latin1") if i >= 0 else None
        except Exception:
            return None
    ck = colr_kind(); tags = "/".join(str(x) for x in (cs, cp, tr))
    if tr in ("smpte2084", "arib-std-b67"):
        add("fail", "color", f"الفيديو HDR ({tr}) — ينعرض باهت/غلط على أغلب الشاشات. لازم يتحوّل بمحوّل أبل (hdr2sdr) قبل الرسم")
    elif ck == "prof":
        add("ok", "color", f"ألوان الحاوية سليمة (ملف prof · وسوم {tags})")
    elif ck is None and all(x in (None, "unknown") for x in (cs, cp, tr)):
        add("warn", "color", "ما فيه ملف ألوان ولا وسوم بالحاوية — ممكن الريل يتفتّح على مشغّل أبل (شغّل tools/color-check.sh)")
    else:
        add("warn", "color", f"ملف ألوان الحاوية «{ck or 'ما فيه'}» مو prof (وسوم {tags}) — لو الريل من خط السكل أبل ممكن يعرضه أفتح، شغّل tools/color-check.sh")

    # 4) فك الملف كاملاً بلا أخطاء
    dec = run(["ffmpeg", "-v", "error", "-i", F, "-f", "null", "-"])
    errs = [l for l in dec.stderr.splitlines() if l.strip()]
    if errs: add("fail", "decode", f"أخطاء فك ({len(errs)}): " + " | ".join(errs[:2])[:200])
    else: add("ok", "decode", "الملف ينفك كامل بلا أخطاء")

    # 5) تحليل بمرور واحد: فريمات سودا + تجمّد + سكتات + مستوى الصوت
    vf = "blackdetect=d=0.1:pix_th=0.10,freezedetect=n=0.003:d=1.5"
    cmd = ["ffmpeg", "-hide_banner", "-nostats", "-v", "info", "-i", F, "-vf", vf]
    if au: cmd += ["-af", "silencedetect=n=-50dB:d=1.0,ebur128=peak=true:framelog=quiet"]
    cmd += ["-f", "null", "-"]
    ana = run(cmd).stderr
    blacks = [(float(a), float(b), float(c)) for a, b, c in re.findall(r"black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)", ana)]
    # ❌ فقط لو أسود ≥ 2 ث أو أول فريم (الكفر) أسود ≥ 0.5 ث. أقل من كذا ممكن يكون كرت داكن مقصود قبل دخول نصه (ريل البطاريات 35.0–35.5 ث طلع إنذار كاذب)
    hard_black = [b for b in blacks if b[2] >= 2.0 or (b[0] < 0.05 and b[2] >= 0.5)]
    soft_black = [b for b in blacks if b not in hard_black and b[2] >= 0.2]
    first_black = [b for b in blacks if b[0] < 0.05 and b[2] >= 0.1 and b not in hard_black]
    fmt_seg = lambda L: " · ".join(f"{a:.1f}–{b:.1f} ث" for a, b, _ in L[:4])
    if hard_black: add("fail", "black", f"فريمات سودا {len(hard_black)} مقطع ({fmt_seg(hard_black)}) — الرسم طاح أو فيه فراغ")
    elif first_black: add("warn", "black", f"أول الفيديو أسود ({first_black[0][2]:.2f} ث) — أول فريم هو الكفر")
    elif soft_black: add("warn", "black", f"لحظات سودا قصيرة ({fmt_seg(soft_black)}) — لو مو كرت داكن أو فيد مقصود شوفها")
    else: add("ok", "black", "ما فيه فريمات سودا")

    # تجمّد: freezedetect يطبع start ثم duration ثم end؛ لو انتهى الفيديو وهو متجمّد ما يكتب end
    fs = [float(x) for x in re.findall(r"freeze_start:\s*([\d.]+)", ana)]
    fd = [float(x) for x in re.findall(r"freeze_duration:\s*([\d.]+)", ana)]
    freezes = [(s0, fd[i] if i < len(fd) else max(0.0, dur - s0)) for i, s0 in enumerate(fs)]
    freezes = [f for f in freezes if not (f[0] + f[1] >= dur - 0.4 and f[1] <= 4.0)]   # كرت ختام ثابت بآخر الفيديو (≤ 4 ث) طبيعي
    frozen_total = sum(d for _, d in freezes)
    mid_long = [f for f in freezes if f[1] >= 6.0 and f[0] + f[1] < dur - 2.5]
    if (dur > 0 and frozen_total / dur >= 0.5) or mid_long:
        add("fail", "freeze", f"تجمّد طويل ({fmt_seg([(a, a + d, 0) for a, d in (mid_long or freezes)])}) — الصورة واقفة أو الرسم عالق")
    elif [f for f in freezes if f[1] >= 2.0]:
        L = [f for f in freezes if f[1] >= 2.0]
        add("warn", "freeze", f"الصورة ثابتة {len(L)} مرة ≥ 2 ث ({fmt_seg([(a, a + d, 0) for a, d in L])}) — لو مو كرت مقصود شوفها")
    else: add("ok", "freeze", "ما فيه تجمّد")

    if au:
        m_i = re.findall(r"\bI:\s+(-?[\d.]+|-inf)\s+LUFS", ana); m_pk = re.findall(r"\bPeak:\s+(-?[\d.]+|-inf)\s+dBFS", ana)
        lufs = fnum(m_i[-1], -99.0) if m_i else None; tp = fnum(m_pk[-1], -99.0) if m_pk else None
        if lufs is None:
            add("warn", "loudness", "ما قدرت أقيس مستوى الصوت")
        else:
            msg = f"مستوى الصوت {lufs:.1f} LUFS" + (f" · الذروة {tp:.1f} dBTP" if tp is not None else "")
            if lufs < -30: add("fail", "loudness", msg + " — الصوت شبه معدوم")
            elif tp is not None and tp >= -0.1: add("fail", "loudness", msg + " — الصوت يقطع (clipping)، أعد 06b_master.sh")
            elif lufs < -16.5 or lufs > -12.0: add("warn", "loudness", msg + " (الهدف قرابة -14)")
            elif tp is not None and tp > -1.0: add("warn", "loudness", msg + " (الذروة فوق -1.0)")
            else: add("ok", "loudness", msg)
        ss = [float(x) for x in re.findall(r"silence_start:\s*(-?[\d.]+)", ana)]
        sd = [float(x) for x in re.findall(r"silence_duration:\s*([\d.]+)", ana)]
        sil = [(max(0.0, s0), sd[i] if i < len(sd) else max(0.0, dur - s0)) for i, s0 in enumerate(ss)]
        if dur and sum(d for _, d in sil) / dur >= 0.9: add("fail", "silence", "الصوت صامت تقريباً طول الفيديو")
        else:
            lead = [x for x in sil if x[0] < 0.1 and x[1] >= 0.5]
            inner = [x for x in sil if x[0] >= 0.1 and x[1] >= 1.5 and x[0] + x[1] < dur - 0.3]
            if lead: add("warn", "silence", f"أول الفيديو صامت {lead[0][1]:.1f} ث — الهوك لازم يبدأ فوراً")
            elif inner: add("warn", "silence", f"سكتات صوت طويلة ({fmt_seg([(a, a + d, 0) for a, d in inner])}) — الصوت ممكن ينقطع بنص الفيديو")
            else: add("ok", "silence", "ما فيه سكتات صوت طويلة")

    # 6) لقطات من الفيديو: فريم فاضي (أبيض/لون واحد) ما يمسكه blackdetect
    def grab(t):
        r = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-ss", f"{max(0.0, t):.3f}", "-i", F, "-frames:v", "1",
                            "-vf", "scale=108:-2,format=gray", "-f", "rawvideo", "-"], capture_output=True, stdin=subprocess.DEVNULL)
        return r.stdout if len(r.stdout) > 100 else None
    flat, probed = [], 0
    for k in range(10):
        t = 0.04 if k == 0 else (dur - 0.15 if k == 9 else dur * k / 9.0)
        a = grab(t)
        if a is None:
            flat.append((t, "ما انسحب فريم")); continue
        probed += 1
        if statistics.pstdev(a) < 1.5: flat.append((t, f"لون واحد (متوسط {statistics.fmean(a):.0f})"))
    if flat: add("warn" if len(flat) < 3 else "fail", "frames", f"{len(flat)} من 10 لقطات فاضية/ما انسحبت: " + " · ".join(f"{t:.1f} ث {why}" for t, why in flat[:4]))
    else: add("ok", "frames", "10 لقطات موزّعة: كلها فيها محتوى")

    # 7) الكابشن (لو عطيته مجلد الشغل وفيه caps.json)
    cj = os.path.join(W, "caps.json") if W else None
    if cj and os.path.isfile(cj):
        try: caps = json.load(open(cj, encoding="utf-8"))
        except Exception: caps = None
        cards = (caps or {}).get("cards") or []
        if not cards:
            add("fail", "captions", "caps.json فاضي — ما فيه ولا كرت كابشن")
        else:
            prob_f, prob_w = [], []
            if cards[0]["s"] > 0.5: prob_w.append(f"أول كابشن عند {cards[0]['s']:.2f} ث (الأفضل قبل 0.5 — 08_safe_check هو الحَكَم)")
            last_e = max(c["e"] for c in cards)
            if last_e > dur + 0.1: prob_f.append(f"الكابشن يمتد لـ{last_e:.2f} ث والفيديو {dur:.2f} ث — الفيديو انقص من الكلام")
            if any(c["e"] <= c["s"] for c in cards): prob_f.append("فيه كرت نهايته قبل بدايته")
            ov = sum(1 for i in range(len(cards) - 1) if cards[i]["e"] > cards[i + 1]["s"] + 0.05)
            if ov: prob_w.append(f"{ov} كرت يتداخل مع اللي بعده")
            shortc = [c for c in cards if c["e"] - c["s"] < 1.2]
            if shortc: prob_w.append(f"{len(shortc)} كرت أقل من 1.2 ث (أولها عند {shortc[0]['s']:.1f} ث) — يطلع ويختفي بسرعة")
            lone = [c for c in cards if len(c.get("w") or []) == 1 and c is not cards[-1]]
            if lone: prob_w.append(f"{len(lone)} كرت بكلمة وحدة (أولها «{lone[0]['w'][0].get('t', '')}» عند {lone[0]['s']:.1f} ث)")
            tot = fnum((caps or {}).get("total"))
            if tot:
                try: outro = fnum(json.load(open(os.path.join(W, "sfx.json"), encoding="utf-8")).get("outro"))   # 06_encode.sh: DUR = caps.total + sfx.outro
                except Exception: outro = 0.0
                tot += outro; d = abs(tot - dur)
                if d > 2.0: prob_f.append(f"مدة الخطة {tot:.2f} ث (الكابشن + الختام) والفيديو {dur:.2f} ث — فرق {d:.2f} ث (قطع ضايع أو زايد)")
                elif d > 0.6: prob_w.append(f"مدة الخطة {tot:.2f} ث والفيديو {dur:.2f} ث — فرق {d:.2f} ث")
            lv = "fail" if prob_f else ("warn" if prob_w else "ok")
            add(lv, "captions", f"الكابشن: {len(cards)} كرت" + ((" — " + " · ".join(prob_f + prob_w)) if (prob_f or prob_w) else " · التوقيت والمدة سليمة"))
    elif W:
        add("warn", "captions", f"ما لقيت caps.json بـ{W} — فحص الكابشن تخطّيته")

    # 8) 🔗 كلمة الختام ← الأوتوميشن (6.8): نفس الكلمة بكرت الختام وبالكابشن. المشاهد يكتب اللي يشوفه، والأوتوميشن يرد على كلمة وحدة
    #    ما نشغّل أي أوتوميشن من هني (يحتاج دخول المستخدم بزورجا) — نطلّع الكلمة جاهزة لمسودته بـfinal_check.json ← automation
    if W and os.path.isdir(W):
        def _nw(t): return re.sub("[ًٌٍَُِّْـ«»\"'،.!؟?:]", "", t or "").replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ة", "ه").replace("ى", "ي").strip()
        outro_w = ""
        try: outro_w = (((json.load(open(os.path.join(W, "theme.json"), encoding="utf-8")).get("outro")) or {}).get("word") or "").strip()
        except Exception: pass
        caps_w = []
        try:
            cj2 = json.load(open(os.path.join(W, "caps.json"), encoding="utf-8"))
            txt = " ".join(" ".join(w.get("t", "") for w in (c.get("w") or [])) for c in (cj2.get("cards") or []))
            nwords = max(1, len(outro_w.split()))   # الكلمة بكرت الختام قد تكون كلمتين («قبل العصر»)؛ بدونها نقرا كلمة وحدة بعد «اكتب»
            caps_w = [m for m in re.findall(r"اكتب\s+[«\"“]?((?:[^\s«»\"”،.!؟?]+\s*){%d})" % nwords, txt)]
            caps_w = [c.strip() for c in caps_w]
        except Exception: pass
        if outro_w or caps_w:
            kw = outro_w or caps_w[-1]
            hit = any(_nw(kw) and _nw(kw).split()[0] in _nw(c).split() for c in caps_w) if caps_w else False
            if outro_w and caps_w and not hit:
                add("warn", "automation", f"كلمة الختام «{outro_w}» مو نفسها اللي بالكابشن ({' / '.join(caps_w[-2:])}) — المشاهد يكتب اللي يسمعه، وحّدهم قبل الأوتوميشن")
            elif outro_w and not caps_w:
                add("warn", "automation", f"كرت الختام فيه الكلمة «{outro_w}» بس الكابشن ما فيه «اكتب {outro_w}» — ما أحد بيعرف يكتبها إلا لو انقالت")
            elif not outro_w:
                add("ok", "automation", f"كلمة الأوتوميشن «{kw}» من الكابشن (كرت الختام ما فيه كلمة) — تنربط بزورجا بعد نزول الريل")
            else:
                add("ok", "automation", f"كلمة الأوتوميشن «{kw}» — موحّدة بالكرت والكابشن (تنربط بزورجا بعد نزول الريل)")
            _AUTO["keyword"] = kw; _AUTO["from"] = "outro" if outro_w else "caps"; _AUTO["file"] = os.path.basename(F)
    return _final_report(res, F, W, dur, as_json, save)


_AUTO = {}   # كلمة الأوتوميشن اللي لقاها الفحص (تنكتب بـfinal_check.json مع --save)

def _final_report(res, F, W, dur, as_json, save=False):
    nf = sum(1 for r in res if r[0] == "fail"); nw = sum(1 for r in res if r[0] == "warn")
    verdict = "fail" if nf else ("warn" if nw else "ok")
    if as_json:
        print(json.dumps({"file": F, "duration": round(dur, 3), "verdict": verdict, "fail": nf, "warn": nw, "automation": _AUTO or None,
                          "checks": [{"level": a, "check": b, "msg": c} for a, b, c in res]}, ensure_ascii=False, indent=1))
    else:
        ic = {"ok": "✅", "warn": "⚠️", "fail": "❌"}
        for lv, key, msg in res: print(f"{ic[lv]} {msg}")
        print({"ok": "✅ الفحص النهائي: نظيف — جاهز للتسليم (يبقى عيني وفحص 08)",
               "warn": f"⚠️ الفحص النهائي: {nw} تنبيه — شوفها قبل التسليم",
               "fail": f"❌ الفحص النهائي: {nf} مشكلة{(' و' + str(nw) + ' تنبيه') if nw else ''} — لا تسلّم"}[verdict])
    if save and W and os.path.isdir(W):
        try: json.dump({"verdict": verdict, "automation": _AUTO or None, "checks": [{"level": a, "check": b, "msg": c} for a, b, c in res]},
                       open(os.path.join(W, "final_check.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        except Exception: pass
    return 3 if nf else 0


if len(sys.argv) > 1 and sys.argv[1] == "final":
    sys.exit(_final_check(sys.argv[2:]))
# ───────────────────────── (تحت: فحص اللحمات القديم — ما تغيّر) ─────────────────────────
import numpy as np
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
