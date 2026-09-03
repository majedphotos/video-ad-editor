# -*- coding: utf-8 -*-
"""وضع المونتاج — مجموعة مقاطع بلا كلام → مونتاج واحد.

  python3 12_montage.py <work> scan <مجلد_المقاطع> [--shot 1.5] [--fps 4]
  python3 12_montage.py <work> show
  python3 12_montage.py <work> sheet [out.jpg] [--cols 6]
  python3 12_montage.py <work> drop 3 7      |  keep 1 2 5   |  undo
  python3 12_montage.py <work> plan [--dur 30] [--shot 1.5] [--bpm 0] [--order energy|best|folder]
  python3 12_montage.py <work> build [out.mp4] [--ar 9:16] [--xfade 0] [--amb 0] [--zoom 1]

الاختيار على المشهد نفسه: وضوح الصورة · حركة بمقدار (لا جمود ولا رجّة) · إضاءة · لون.
بلا تفريغ ولا كابشن — هذا وضع مستقل عن إعلان الكلام.
"""
import json, os, re, subprocess, sys, shutil, math

VID_EXT = (".mov", ".mp4", ".m4v", ".avi", ".mkv", ".webm", ".mts", ".m2ts")
AR = {"9:16": (1080, 1920), "1:1": (1080, 1080), "16:9": (1920, 1080), "4:5": (1080, 1350)}


# ───────────────────────── أدوات صغيرة ─────────────────────────
def die(m):
    print("❌ " + m)
    sys.exit(2)


def natkey(s):
    return [int(x) if x.isdigit() else x.lower() for x in re.split(r"(\d+)", s)]


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def probe(path):
    """مدة · مقاس · تردد · فيه صوت؟ — بلا افتراضات."""
    o = run(["ffprobe", "-v", "error", "-show_entries",
             "format=duration:stream=codec_type,width,height,avg_frame_rate"
             ":stream_side_data=rotation", "-of", "json", path]).stdout
    try:
        d = json.loads(o)
    except Exception:
        return None
    dur = float(d.get("format", {}).get("duration") or 0)
    w = h = 0
    fps = 30.0
    has_a = False
    for st in d.get("streams", []):
        if st.get("codec_type") == "video" and not w:
            w, h = int(st.get("width") or 0), int(st.get("height") or 0)
            # مقاطع الجوال تجي موسومة بدوران — ffmpeg يدوّرها وقت الرسم،
            # فالمقاس المعروض هو المقلوب. بدون هالسطر نقيس مقاساً ما يشوفه أحد.
            for sd in st.get("side_data_list") or []:
                try:
                    if abs(int(sd.get("rotation", 0))) % 180 == 90:
                        w, h = h, w
                except (TypeError, ValueError):
                    pass
            fr = st.get("avg_frame_rate") or "30/1"
            try:
                n, dn = fr.split("/")
                fps = float(n) / float(dn) if float(dn) else 30.0
            except Exception:
                fps = 30.0
        if st.get("codec_type") == "audio":
            has_a = True
    if dur <= 0 or not w:
        return None
    return {"dur": dur, "w": w, "h": h, "fps": round(fps, 3), "audio": has_a}


def load(W):
    p = os.path.join(W, "montage.json")
    if not os.path.exists(p):
        die("ما فيه montage.json — شغّل `scan <مجلد_المقاطع>` أولاً.")
    return json.load(open(p))


def save(W, d):
    json.dump(d, open(os.path.join(W, "montage.json"), "w"), ensure_ascii=False, indent=1)


def flag(args, name, default, cast=float):
    if name in args:
        i = args.index(name)
        if i + 1 < len(args):
            try:
                return cast(args[i + 1])
            except Exception:
                pass
    return default


def pct_ranks(vals):
    """رتبة مئوية 0..1 لكل قيمة — تقارن بين المقاطع بلا ثوابت سحرية."""
    n = len(vals)
    if n <= 1:
        return [0.5] * n
    order = sorted(range(n), key=lambda i: vals[i])
    r = [0.0] * n
    i = 0
    while i < n:
        j = i
        while j + 1 < n and vals[order[j + 1]] == vals[order[i]]:
            j += 1
        mid = (i + j) / 2.0 / (n - 1)
        for k in range(i, j + 1):
            r[order[k]] = mid
        i = j + 1
    return r


def life_score(m):
    """الحركة بمقياس مطلق (متوسط فرق الإضاءة بين فريمين، 0-255):
       جامد=رديء · هادئ=مقبول · 8-16=حي · فوق ذلك رجّة."""
    if m < 0.5:
        return 0.0                                   # مجمّد
    if m < 8.0:
        return 0.25 + m / 8.0 * 0.75
    if m <= 16.0:
        return 1.0
    return max(0.10, 1.0 - (m - 16.0) / 16.0 * 0.9)  # 32 فما فوق = رجّة


def expo_score(l):
    """الإضاءة (متوسط لمعان 0-255): المعتم والمحروق مرفوضان بلا مجاملة."""
    if l <= 40 or l >= 225:
        return 0.03
    if l < 95:
        return max(0.05, (l - 40) / 55.0 * 0.95)
    if l <= 180:
        return 1.0
    return max(0.05, 1.0 - (l - 180) / 45.0 * 0.95)


# ───────────────────────── 1) فحص المقاطع ─────────────────────────
def metrics(path, mf, fps):
    """مرور واحد بـffmpeg: وضوح (blur) · حركة (YDIF) · إضاءة (YAVG) · لون (SATAVG)."""
    if os.path.exists(mf):
        os.remove(mf)
    vf = (f"fps={fps},scale=320:-2,blurdetect=low=0.05:high=0.15,"
          f"signalstats,metadata=print:file={mf}")
    run(["ffmpeg", "-v", "error", "-i", path, "-an", "-vf", vf, "-f", "null", "-"])
    if not os.path.exists(mf):
        return []
    rows, cur = [], None
    for ln in open(mf, encoding="utf-8", errors="replace"):
        ln = ln.strip()
        m = re.match(r"frame:\d+\s+pts:\S+\s+pts_time:([0-9.]+)", ln)
        if m:
            cur = {"t": float(m.group(1))}
            rows.append(cur)
            continue
        if cur is None:
            continue
        m = re.match(r"lavfi\.(blur|signalstats\.YDIF|signalstats\.YAVG|signalstats\.SATAVG)=([0-9.eE+-]+)", ln)
        if m:
            key = {"blur": "blur", "signalstats.YDIF": "mot",
                   "signalstats.YAVG": "lum", "signalstats.SATAVG": "sat"}[m.group(1)]
            try:
                cur[key] = float(m.group(2))
            except ValueError:
                pass
    return [r for r in rows if "blur" in r and "mot" in r]


def windows(rows, dur, shot, fps, margin=0.30):
    """نوافذ مرشّحة داخل المقطع (يقصّ أول وآخر ثلث ثانية — لحظة اليد على الجهاز)."""
    rows = [r for r in rows if r["t"] > 1e-6]      # أول فريم حركته صفر دائماً (ما قبله شي)
    if not rows:
        return []
    a0, b0 = margin, max(margin + 0.2, dur - margin)
    L = min(shot, max(0.35, b0 - a0))
    step = max(0.20, 1.0 / fps * 2, (b0 - a0) / 120.0)   # سقف ١٢٠ نافذة للمقطع الطويل
    out, t = [], a0
    while t + L <= b0 + 1e-6:
        seg = [r for r in rows if t - 1e-6 <= r["t"] <= t + L + 1e-6]
        if len(seg) >= 2:
            mm = [r.get("mot", 0.0) for r in seg]
            mean = sum(mm) / len(mm)
            var = sum((x - mean) ** 2 for x in mm) / len(mm)
            out.append({
                "a": round(t, 3), "b": round(t + L, 3),
                "blur": sum(r.get("blur", 8.0) for r in seg) / len(seg),
                "mot": mean, "jit": math.sqrt(var),
                "lum": sum(r.get("lum", 128.0) for r in seg) / len(seg),
                "sat": sum(r.get("sat", 20.0) for r in seg) / len(seg),
            })
        t += step
    return out


def cmd_scan(W, args):
    if not args:
        die("عطني مجلد المقاطع: `scan <مجلد>`")
    src = os.path.abspath(args[0])
    if not os.path.isdir(src):
        die(f"ما لقيت المجلد {src}")
    shot = flag(args, "--shot", 1.5)
    fps = flag(args, "--fps", 4.0)
    files = sorted((f for f in os.listdir(src)
                    if f.lower().endswith(VID_EXT) and not f.startswith(".")), key=natkey)
    if not files:
        die("المجلد ما فيه مقاطع فيديو.")
    tmp = os.path.join(W, ".mscan")
    os.makedirs(tmp, exist_ok=True)

    print(f"📼 {len(files)} مقطعاً — أفحصها (أربعة بنفس الوقت)…")

    def one(n_f):
        n, f = n_f
        p = os.path.join(src, f)
        info = probe(p)
        if not info:
            return (n, f, None, None)
        rows = metrics(p, os.path.join(tmp, f"m{n}.txt"), fps)
        ws = windows(rows, info["dur"], shot, fps)
        if not ws:                                   # مقطع قصير جداً: خذه كله
            ws = [{"a": 0.0, "b": round(min(info["dur"], shot), 3), "blur": 8.0,
                   "mot": 4.0, "jit": 2.0, "lum": 128.0, "sat": 20.0}]
        return (n, f, info, ws)

    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=4) as ex:
        res = list(ex.map(one, list(enumerate(files, 1))))

    clips, allw = [], []
    for n, f, info, ws in res:
        if not info:
            print(f"  {n:2d}. {f} — ما قدرت أقراه، تخطّيته")
            continue
        c = dict(info)
        c.update({"i": len(clips) + 1, "file": os.path.join(src, f), "name": f,
                  "win": ws, "skip": False})
        clips.append(c)
        allw += [(c["i"], w) for w in ws]
        print(f"  {c['i']:2d}. {f}  {info['dur']:5.1f}s  {info['w']}×{info['h']}  {len(ws)} نافذة")
    if not clips:
        die("ما طلع ولا مقطع صالح.")

    # الوضوح يُقاس بنسبة المقطع لوسيط المجموعة — نسبة بلا وحدة، تشتغل بأي دقة وأي مشهد.
    bl = sorted(w["blur"] for _, w in allw)
    medb = bl[len(bl) // 2] or 1.0
    rj = pct_ranks([w["jit"] for _, w in allw])
    rs = pct_ranks([w["sat"] for _, w in allw])
    for k, (ci, w) in enumerate(allw):
        sharp = min(1.0, max(0.0, (1.5 - w["blur"] / medb) / 0.7))
        steady = 1.0 - rj[k]
        color = 0.5 + rs[k] * 0.5
        base = 0.40 * life_score(w["mot"]) + 0.25 * steady + 0.15 * color + 0.20
        # الوضوح والإضاءة والجمود **تضرب** ولا تُضاف: اللقطة المهزوزة أو المظلمة أو
        # المجمّدة ما تنفع مهما حسنت بقية صفاتها. (والصورة المعتمة تخدع مقياس الوضوح:
        # تقلّ تفاصيلها فتبين «حادّة» — فالإضاءة تنقض ذلك.)
        w["score"] = round(base * (0.20 + 0.80 * sharp) * expo_score(w["lum"])
                           * (0.35 if w["mot"] < 0.5 else 1.0), 4)

    for c in clips:
        best = max(c["win"], key=lambda w: w["score"])
        c["pick"] = [best["a"], best["b"]]
        c["score"] = best["score"]
        c["mot"] = round(best["mot"], 2)
        c["lum"] = round(best["lum"], 1)
        c["blur"] = round(best["blur"], 2)
        c["win"] = [{"a": w["a"], "b": w["b"], "score": w["score"], "mot": round(w["mot"], 2)}
                    for w in c["win"]]

    shutil.rmtree(tmp, ignore_errors=True)
    save(W, {"src": src, "shot": shot, "clips": clips})
    print(f"\n✅ montage.json — {len(clips)} مقطعاً، أحلى لحظة بكل واحد مختارة.")
    cmd_show(W, [])


# ───────────────────────── 2) عرض وتحرير ─────────────────────────
def cmd_show(W, args):
    d = load(W)
    cs = d["clips"]
    live = [c for c in cs if not c.get("skip")]
    print(f"\n🎬 {len(live)} مقطعاً شغّالاً من {len(cs)}  ·  طول اللقطة {d['shot']}s\n")
    for c in cs:
        mark = "  " if not c.get("skip") else "⊘ "
        bar = "█" * int(round(c["score"] * 10)) + "·" * (10 - int(round(c["score"] * 10)))
        print(f"{mark}{c['i']:2d}. {bar} {c['score']:.2f}  {c['pick'][0]:6.2f}→{c['pick'][1]:6.2f}"
              f"  حركة {c['mot']:5.1f}  {c['name']}")
    if "plan" in d:
        tot = sum(p["dur"] for p in d["plan"])
        print(f"\n📋 خطة جاهزة: {len(d['plan'])} لقطة · {tot:.1f} ثانية")


def cmd_pick(W, args, mode):
    d = load(W)
    nums = {int(a) for a in args if a.isdigit()}
    if not nums:
        die("عطني أرقام المقاطع.")
    bak = os.path.join(W, "montage.json.bak")
    json.dump(d, open(bak, "w"), ensure_ascii=False, indent=1)
    for c in d["clips"]:
        c["skip"] = (c["i"] in nums) if mode == "drop" else (c["i"] not in nums)
    d.pop("plan", None)
    save(W, d)
    print(f"✅ {'شلت' if mode=='drop' else 'أبقيت'} {sorted(nums)} — الباقي "
          f"{len([c for c in d['clips'] if not c['skip']])} مقطعاً. (خطة قديمة أُلغيت)")


def cmd_undo(W, args):
    bak = os.path.join(W, "montage.json.bak")
    if not os.path.exists(bak):
        die("ما فيه تراجع محفوظ.")
    shutil.copy(bak, os.path.join(W, "montage.json"))
    print("↩️  رجّعت الحالة السابقة.")
    cmd_show(W, [])


# ───────────────────────── 3) ورقة اللقطات ─────────────────────────
def _font(px):
    """أول خط متاح بالنظام — وإلا الخط المدمج."""
    from PIL import ImageFont
    for p in ("/System/Library/Fonts/Supplemental/Arial Bold.ttf",
              "/System/Library/Fonts/Supplemental/Arial.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "C:/Windows/Fonts/arialbd.ttf"):
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, px)
            except Exception:
                pass
    try:
        return ImageFont.load_default(size=px)
    except TypeError:
        return ImageFont.load_default()


def cmd_sheet(W, args):
    d = load(W)
    out = args[0] if args and not args[0].startswith("--") else os.path.join(W, "montage-sheet.jpg")
    cols = int(flag(args, "--cols", 6))
    live = [c for c in d["clips"] if not c.get("skip")]
    if not live:
        die("كل المقاطع مشطوبة.")
    # خلية الورقة تاخذ شكل المقاطع نفسها — بلا فراغ أسود
    ars = sorted((c["w"] / c["h"]) for c in live if c.get("h"))
    ar = ars[len(ars) // 2] if ars else 0.5625
    CH = 300
    CW = max(150, min(540, int(round(CH * ar / 2) * 2)))
    tmp = os.path.join(W, ".msheet")
    shutil.rmtree(tmp, ignore_errors=True)
    os.makedirs(tmp)

    shots = []
    for k, c in enumerate(live):
        t = (c["pick"][0] + c["pick"][1]) / 2.0
        f = os.path.join(tmp, f"{k:03d}.jpg")
        run(["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", c["file"], "-frames:v", "1",
             "-vf", f"scale={CW}:{CH}:force_original_aspect_ratio=decrease,"
                    f"pad={CW}:{CH}:(ow-iw)/2:(oh-ih)/2:color=0x111111", "-y", f])
        if os.path.exists(f) and os.path.getsize(f) > 0:
            shots.append((c, f))
    if not shots:
        die("ما قدرت أطلّع ولا لقطة.")
    rows = max(1, math.ceil(len(shots) / cols))
    order = " · ".join(str(c["i"]) for c, _ in shots)

    try:                                    # الأفضل: أرقام واضحة على كل لقطة
        from PIL import Image, ImageDraw
        P = 6
        sheet = Image.new("RGB", (cols * (CW + P) + P, rows * (CH + P) + P), (17, 17, 17))
        dr = ImageDraw.Draw(sheet)
        fnt = _font(max(20, CH // 9))
        for k, (c, f) in enumerate(shots):
            x, y = P + (k % cols) * (CW + P), P + (k // cols) * (CH + P)
            sheet.paste(Image.open(f), (x, y))
            lbl = str(c["i"])
            bw = 20 + 15 * len(lbl)
            dr.rectangle([x + 4, y + 4, x + 4 + bw, y + 4 + CH // 7], fill=(0, 0, 0))
            dr.text((x + 14, y + 8), lbl, fill=(255, 255, 255), font=fnt)
        sheet.save(out, quality=88)
        shutil.rmtree(tmp, ignore_errors=True)
        print(f"✅ {out}  ({len(shots)} لقطة · {cols}×{rows}) — الرقم على كل لقطة هو رقم المقطع.")
    except ImportError:                     # بلا PIL: ورقة بلا أرقام + مفتاح الترتيب
        r = run(["ffmpeg", "-v", "error", "-i", os.path.join(tmp, "%03d.jpg"),
                 "-vf", f"tile={cols}x{rows}:padding=6:margin=6:color=0x111111",
                 "-frames:v", "1", "-q:v", "3", "-y", out])
        shutil.rmtree(tmp, ignore_errors=True)
        if r.returncode:
            die("فشل تجميع الورقة:\n" + r.stderr[-400:])
        print(f"✅ {out}  ({len(shots)} لقطة · {cols}×{rows}) — بلا أرقام على الصور.\n"
              f"   الترتيب من فوق-يسار وسطراً سطراً: {order}")
    print("اقرأها وحدة، لا تقرأ الصور فرادى.")


# ───────────────────────── 4) الخطة ─────────────────────────
def cmd_plan(W, args):
    d = load(W)
    live = [c for c in d["clips"] if not c.get("skip")]
    if not live:
        die("كل المقاطع مشطوبة.")
    target = flag(args, "--dur", 0.0)
    shot = flag(args, "--shot", d.get("shot", 1.5))
    bpm = flag(args, "--bpm", 0.0)
    order = "energy"
    if "--order" in args:
        i = args.index("--order")
        if i + 1 < len(args):
            order = args[i + 1]

    # إيقاع اللقطات: على النبضة إن أُعطي BPM، وإلا نمط متغيّر يكسر الرتابة
    if bpm > 0:
        beat = 60.0 / bpm
        k = max(1, round(shot / beat))
        # نمط ينكسر بلقطة أطول، بلا لقطة نبضة وحدة — تطلع كخطأ مو كإيقاع
        pat = [k, k, k, k + 1] if k <= 2 else [k, k, k - 1, k + 1]
        durs = [p * beat for p in pat]
    else:
        durs = [shot * m for m in (1.0, 0.82, 1.24, 0.94)]

    ranked = sorted(live, key=lambda c: -c["score"])
    if order == "folder":
        seq = sorted(live, key=lambda c: c["i"])
    elif order == "best":
        seq = ranked
    else:                                   # energy: هادئ/متحرك بالتناوب، والأقوى بالبداية
        mid = sorted(x["mot"] for x in live)[len(live) // 2]
        hi = sorted([c for c in live if c["mot"] >= mid], key=lambda c: -c["score"])
        his = {c["i"] for c in hi}
        lo = sorted([c for c in live if c["i"] not in his], key=lambda c: -c["score"])
        seq, a, b = [], 0, 0
        while a < len(hi) or b < len(lo):
            if a < len(hi):
                seq.append(hi[a]); a += 1
            if b < len(lo):
                seq.append(lo[b]); b += 1
        top = ranked[0]["i"]                      # أقوى لقطة أول شي يشوفه المشاهد
        seq = [c for c in seq if c["i"] != top]
        seq.insert(0, ranked[0])

    plan, tot = [], 0.0
    for k, c in enumerate(seq):
        want = durs[k % len(durs)]
        avail = max(0.35, c["dur"] - 0.20)
        L = min(want, avail)
        mid = (c["pick"][0] + c["pick"][1]) / 2.0
        a = max(0.0, min(mid - L / 2.0, c["dur"] - L))
        plan.append({"i": c["i"], "file": c["file"], "name": c["name"],
                     "in": round(a, 3), "dur": round(L, 3), "audio": c["audio"],
                     "w": c["w"], "h": c["h"]})
        tot += L
        if target and tot >= target:
            break
    d["plan"] = plan
    d["shot"] = shot
    save(W, d)
    if target and tot < target * 0.92:
        print(f"⚠️  المقاطع ما تكفي {target:.0f} ثانية — طلع {tot:.1f}. "
              f"زد `--shot` أو زد مقاطع (ما نكرّر لقطة مرتين).")
    print(f"📋 {len(plan)} لقطة · {tot:.1f} ثانية"
          + (f" · على نبضة {bpm:.0f}" if bpm else "") + f" · ترتيب {order}")
    for k, p in enumerate(plan, 1):
        print(f"  {k:2d}. [{p['i']:2d}] {p['in']:6.2f} +{p['dur']:.2f}s  {p['name']}")


# ───────────────────────── 5) التركيب ─────────────────────────
def cmd_build(W, args):
    d = load(W)
    if "plan" not in d:
        cmd_plan(W, args)
        d = load(W)
    plan = d["plan"]
    out = args[0] if args and not args[0].startswith("--") else os.path.join(W, "montage.mp4")
    ar = "9:16"
    if "--ar" in args:
        i = args.index("--ar")
        if i + 1 < len(args):
            ar = args[i + 1]
    if ar not in AR:
        die("المقاس المتاح: " + " · ".join(AR))
    OW, OH = AR[ar]
    xf = flag(args, "--xfade", 0.0)
    amb = flag(args, "--amb", 0.0)
    zoom = flag(args, "--zoom", 1.0)
    R = 30

    # ffmpeg ≤7 يحتاج eval=frame عشان يعيد حساب القص كل فريم، و8 حذف الخيار وصار الافتراضي.
    ev = ":eval=frame" if "eval" in run(["ffmpeg", "-hide_banner", "-h", "filter=crop"]).stdout else ""
    ins, fc, vs, nozoom = [], [], [], 0
    for k, p in enumerate(plan):
        ins += ["-ss", f"{p['in']:.3f}", "-t", f"{p['dur']:.3f}", "-i", p["file"]]
        # زوم داخلي خفيف — بس إذا كان المصدر أكبر من المخرَج بمراحل.
        # على مصدر بحجم المخرَج القصّ يتحرك بكسلاً كاملاً بالفريم فيبين الزوم متقطّعاً.
        K = 0.055
        pw, ph = p.get("w", 0), p.get("h", 0)
        big = min(max(pw, ph) / max(OW, OH), min(pw, ph) / min(OW, OH)) >= 1.4
        if zoom and not big:
            nozoom += 1
        crop = (f"crop=w='iw/(1+{K}*t/{p['dur']:.3f})':h='ih/(1+{K}*t/{p['dur']:.3f})'"
                f":x='(iw-ow)/2':y='(ih-oh)/2'{ev},") if (zoom and big) else ""
        fc.append(f"[{k}:v]setpts=PTS-STARTPTS,fps={R},{crop}"
                  f"scale={OW}:{OH}:force_original_aspect_ratio=increase:flags=lanczos,"
                  f"crop={OW}:{OH},setsar=1,"
                  f"setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,"
                  f"format=yuv420p[v{k}]")
        vs.append(f"[v{k}]")

    if xf > 0 and len(plan) > 1:
        prev, off = "[v0]", 0.0
        for k in range(1, len(plan)):
            off += plan[k - 1]["dur"] - xf
            lbl = f"[x{k}]"
            fc.append(f"{prev}[v{k}]xfade=transition=fade:duration={xf:.3f}:offset={off:.3f}{lbl}")
            prev = lbl
        fc.append(f"{prev}null[vo]")
        total = sum(p["dur"] for p in plan) - xf * (len(plan) - 1)
    else:
        fc.append("".join(vs) + f"concat=n={len(plan)}:v=1:a=0[vo]")
        total = sum(p["dur"] for p in plan)

    # الصوت: أجواء المقاطع إن طُلبت وكلها فيها صوت، وإلا مسار صامت (يلزمه 06b_master)
    use_amb = amb > 0 and all(p.get("audio") for p in plan) and xf <= 0
    if use_amb:
        for k, p in enumerate(plan):
            fc.append(f"[{k}:a]asetpts=PTS-STARTPTS,aresample=48000,"
                      f"aformat=sample_fmts=fltp:channel_layouts=stereo,"
                      f"afade=t=in:st=0:d=0.05,afade=t=out:st={max(0,p['dur']-0.08):.3f}:d=0.08[a{k}]")
        fc.append("".join(f"[a{k}]" for k in range(len(plan))) + f"concat=n={len(plan)}:v=0:a=1[ac]")
        fc.append(f"[ac]volume={amb:.3f}[ao]")
        amap = ["-map", "[ao]"]
    else:
        ins += ["-f", "lavfi", "-t", f"{total:.3f}", "-i", "anullsrc=r=48000:cl=stereo"]
        amap = ["-map", f"{len(plan)}:a"]
        if amb > 0:
            print("ℹ️  الأجواء متخطّاة (مقطع بلا صوت أو تلاشٍ مفعّل) — مسار صامت.")

    cmd = (["ffmpeg", "-v", "error", "-stats"] + ins
           + ["-filter_complex", ";".join(fc), "-map", "[vo]"] + amap
           + ["-c:v", "libx264", "-preset", "slow", "-crf", "20", "-maxrate", "8M",
              "-bufsize", "16M", "-profile:v", "high", "-level", "4.0",
              "-pix_fmt", "yuv420p", "-r", str(R), "-c:a", "aac", "-b:a", "160k",
              "-ar", "48000", "-shortest", "-movflags", "+faststart", "-y", out])
    print(f"🎬 أركّب {len(plan)} لقطة → {total:.1f} ثانية · {ar}"
          + (f" · تلاشٍ {xf}s" if xf > 0 else " · قطع حاد")
          + ("" if not zoom else (" · بلا زوم (المصدر مو أكبر من المخرَج)" if nozoom == len(plan)
                                  else f" · زوم على {len(plan)-nozoom} لقطة")))
    r = subprocess.run(cmd)
    if r.returncode:
        die("فشل التركيب.")
    print(f"✅ {out}")
    print(run(["ffprobe", "-v", "error", "-show_entries", "format=duration,size",
               "-show_entries", "stream=width,height", "-of", "default=nw=1", out]).stdout.strip())
    print(f"↩︎ بعدها: bash scripts/06b_master.sh {W} {out} "
          f"{os.path.join(W, 'montage-master.mp4')}")


# ───────────────────────── الموجّه ─────────────────────────
CMDS = {"scan": cmd_scan, "show": cmd_show, "sheet": cmd_sheet, "plan": cmd_plan,
        "build": cmd_build, "undo": cmd_undo,
        "drop": lambda W, a: cmd_pick(W, a, "drop"),
        "keep": lambda W, a: cmd_pick(W, a, "keep")}

if __name__ == "__main__":
    if len(sys.argv) < 3 or sys.argv[2] not in CMDS:
        print(__doc__)
        sys.exit(1)
    Wd = os.path.abspath(sys.argv[1])
    os.makedirs(Wd, exist_ok=True)
    CMDS[sys.argv[2]](Wd, sys.argv[3:])
