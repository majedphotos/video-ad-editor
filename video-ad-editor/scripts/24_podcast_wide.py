# -*- coding: utf-8 -*-
"""بودكاست كامل بالعرض 16:9 (يوتيوب) من ملفات الكاميرات الخام — مو ريل.
   python3 24_podcast_wide.py prep   <work> <مجلد_الكاميرات | ملف1 ملف2 …>   ← مزامنة بالصوت · صوت رئيسي · وجوه وفم · مين يتكلم
   python3 24_podcast_wide.py plan   <work> [--min 2.0] [--wide-every 45]      ← خطة القطعات edl.json + ملخص
   python3 24_podcast_wide.py render <work> [--preview 90] [--from 0]          ← الحلقة episode-wide.mp4 (أو مقطع معاينة)
   - الكاميرا اللي فيها شخصين أو أكثر = «الواسعة» (افتتاحية، سكتات، تداخل كلام، وكل --wide-every ثانية).
   - الباقي «قريبة»: تنتقل لكاميرا اللي يتكلم إذا استمر كلامه ثانية أو أكثر، وأقصر لقطة --min ثانية.
   - الصوت من المايك الأعلى (أو ملف صوت مستقل اسمه فيه audio/mic/zoom/rode)، ومعايَر ‎-14 LUFS.
   - ما فيه كابشن ولا قص سكتات افتراضاً — حلقة كاملة كما انقالت. ماك فقط (Vision للوجوه)."""
import sys, os, json, glob, subprocess, importlib.util, shutil
import numpy as np
SC = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("pod", os.path.join(SC, "15_podcast.py"))
P = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(P)
P.LOFPS = 8                              # حلقة ساعة: 8 فريمات/ث = 4 فريمات بكل نافذة نص ثانية (راصد الفم يبي 3 على الأقل)
VID = P.VID_EXT; AUD = ('.wav', '.m4a', '.mp3', '.WAV', '.M4A', '.MP3')
W_OUT, H_OUT, FPS = 1920, 1080, 30

def arg(name, default):
    return type(default)(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else default

def prep(W, args):
    os.makedirs(os.path.join(W, "bt"), exist_ok=True)
    src = args[0] if len(args) == 1 and os.path.isdir(args[0]) else None
    files = sorted(glob.glob(os.path.join(src, "*"))) if src else [os.path.abspath(a) for a in args]
    vids = [f for f in files if f.endswith(VID)]
    ext_audio = [f for f in files if f.endswith(AUD) and any(k in os.path.basename(f).lower() for k in ("audio", "mic", "zoom", "rode", "صوت"))]
    if len(vids) < 2: sys.exit("❌ أحتاج كاميرتين على الأقل")
    cams = []
    for i, f in enumerate(vids):
        p = P.probe(f); cams.append({"id": i + 1, "file": os.path.abspath(f), "name": os.path.basename(f), **p, "offset": 0.0})
        P.wav16(f, os.path.join(W, f"a{i+1}.wav"))
    e1 = P.envelope(P.readwav(os.path.join(W, "a1.wav"))); same_audio = True
    for c in cams[1:]:
        off, peak = P.xcorr_offset(e1, P.envelope(P.readwav(os.path.join(W, f"a{c['id']}.wav"))))
        c["offset"], c["sync_peak"] = round(off, 3), round(peak, 3)
        if peak < 0.98: same_audio = False
    start = max(0.0, max(c["offset"] for c in cams)); end = min(c["offset"] + c["dur"] for c in cams); total = round(end - start, 3)
    print("المزامنة:", " · ".join(f"كام{c['id']} {c['offset']:+.2f}ث (تطابق {c.get('sync_peak',1):.2f})" for c in cams[1:]), f"→ المشترك {total/60:.1f} د")
    weak = [c for c in cams[1:] if c.get("sync_peak", 1) < 0.5]
    if weak: print("⚠️ مزامنة ضعيفة لـ", [c["name"] for c in weak], "— صفّق بأول التصوير أو تأكد إن كل كاميرا مسجلة صوت")
    # الصوت الرئيسي: ملف مايك مستقل لو موجود، وإلا الكاميرا الأعلى صوتاً
    master = None
    if ext_audio:
        a = ext_audio[0]; P.wav16(a, os.path.join(W, "ext.wav"))
        off, peak = P.xcorr_offset(e1, P.envelope(P.readwav(os.path.join(W, "ext.wav"))))
        master = {"file": a, "offset": round(off, 3)}; print(f"الصوت: {os.path.basename(a)} (مزامنة {peak:.2f})")
    else:
        best = None
        for c in cams:
            x = P.readwav(os.path.join(W, f"a{c['id']}.wav")); s0 = int((start - c["offset"]) * 16000); seg = x[s0:s0 + int(total * 16000)]
            c["rms"] = float(np.sqrt((seg * seg).mean())) if len(seg) else 0
            if best is None or c["rms"] > best["rms"]: best = c
        master = {"file": best["file"], "offset": best["offset"]}; print(f"الصوت: من {best['name']}")
    # فريمات خفيفة بلا قص (الواسعة لازم تبين كاملة) + الوجوه
    ft = os.path.join(W, "bt", "facetrack")
    if not os.path.exists(ft):
        r = P.sh(["swiftc", "-O", "-o", ft, os.path.join(SC, "facetrack.swift")])
        if r.returncode != 0: sys.exit("❌ راصد الوجه يحتاج أدوات Xcode: xcode-select --install")
    procs = []
    for c in cams:
        lo = os.path.join(W, "lo", f"cam{c['id']}"); os.makedirs(lo, exist_ok=True)
        procs.append(subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-ss", f"{start-c['offset']:.3f}", "-t", f"{total:.3f}", "-i", c["file"],
                                       "-vf", f"fps={P.LOFPS},scale=480:-2", "-q:v", "5", os.path.join(lo, "%06d.jpg")]))
    for p in procs: p.wait()
    for c in cams:
        P.sh([ft, os.path.join(W, "lo", f"cam{c['id']}"), os.path.join(W, "bt", f"face{c['id']}.json")])
        rows = json.load(open(os.path.join(W, "bt", f"face{c['id']}.json")))
        ns = [r.get("n", 0) for r in rows]
        c["faces_n"] = float(np.median(ns)) if ns else 0; c["face_rate"] = round(sum(1 for n in ns if n) / max(1, len(ns)), 2)
    for c in cams: c["role"] = "wide" if c["faces_n"] >= 2 else "close"
    if not any(c["role"] == "wide" for c in cams):   # ما فيه كاميرا تجمعهم: الأبعد (أصغر وجه) تصير الواسعة بس لو 3 كاميرات أو أكثر
        if len(cams) >= 3:
            def fh(c):
                rows = json.load(open(os.path.join(W, "bt", f"face{c['id']}.json"))); hs = [r["face"]["h"] for r in rows if "face" in r]
                return np.median(hs) if hs else 1
            min(cams, key=fh)["role"] = "wide"
    spk = P.speaker_timeline(W, [c for c in cams if c["role"] == "close" and c["face_rate"] > 0.3] or cams, start, total, same_audio)
    json.dump({"start": start, "total": total, "same_audio": same_audio, "master": master, "cams": cams}, open(os.path.join(W, "cams.json"), "w"), ensure_ascii=False, indent=1)
    print("الكاميرات:", " · ".join(f"كام{c['id']}={'واسعة' if c['role']=='wide' else 'قريبة'} (وجوه {c['faces_n']:.0f})" for c in cams))
    print("الكلام:", " · ".join(f"كام{k} {v:.0f}٪" for k, v in spk["share"].items()), "·", spk.get("diag", ""))

def plan(W):
    C = json.load(open(os.path.join(W, "cams.json"))); S = json.load(open(os.path.join(W, "speak.json")))
    MIN, EVERY = arg("--min", 2.0), arg("--wide-every", 45.0)
    win, tl, total = S["win"], S["tl"], C["total"]
    wide = next((c["id"] for c in C["cams"] if c["role"] == "wide"), None)
    closes = [c["id"] for c in C["cams"] if c["role"] == "close"] or [C["cams"][0]["id"]]
    want = []                                   # لكل نافذة: الكاميرا المطلوبة
    known = sum(1 for v in tl if v) / max(1, len(tl))
    if known < 0.15:
        # ما قدرنا نعرف مين يتكلم (نفس الشخص بكل الكاميرات، أو وجوه مو واضحة) ← نبدّل بين الكاميرات عند السكتات كل 6-12 ث
        print(f"⚠️ مين يتكلم غير واضح ({known:.0%}) — تبديل عند السكتات بدل المتكلم")
        x = P.readwav(os.path.join(W, "a1.wav")); s0 = int(C["start"] * 16000); hop = int(win * 16000)
        e = np.array([np.sqrt((x[s0 + k * hop:s0 + (k + 1) * hop] ** 2).mean() + 1e-12) for k in range(len(tl))])
        quiet = e < np.percentile(e, 20); order = [c["id"] for c in C["cams"]]; i, last = 0, 0
        for k in range(len(tl)):
            if quiet[k] and (k - last) * win >= 6 or (k - last) * win >= 12: i, last = i + 1, k
            want.append(order[i % len(order)])
        tl = want
    else:
        for k, v in enumerate(tl):
            want.append(v if v in closes else (wide or (want[-1] if want else closes[0])))
    # المتكلم الجديد لازم يستمر ثانية قبل ما ننتقل له (يمنع التنطيط على «إي» و«صح»)
    need = max(1, int(round(1.0 / win))); cur = wide or want[0]; out = []
    run_c, run_n = None, 0
    for k, v in enumerate(want):
        if v == run_c: run_n += 1
        else: run_c, run_n = v, 1
        if v != cur and run_n >= need: cur = v
        out.append(cur)
    segs = []
    for k, v in enumerate(out):
        t = k * win
        if segs and segs[-1]["cam"] == v: segs[-1]["e"] = min(total, t + win)
        else: segs.append({"s": t, "e": min(total, t + win), "cam": v})
    # أقصر لقطة: الأقصر من MIN يندمج بالسابقة
    merged = []
    for g in segs:
        if merged and g["e"] - g["s"] < MIN: merged[-1]["e"] = g["e"]
        else: merged.append(dict(g))
    # افتتاحية واسعة + واسعة دورية داخل اللقطات الطويلة
    if wide:
        if merged: merged[0]["cam"] = wide if merged[0]["e"] - merged[0]["s"] <= 8 else merged[0]["cam"]
        final = []
        for g in merged:
            s = g["s"]
            while g["cam"] != wide and g["e"] - s > EVERY + 2 * MIN + 4:
                cut = s + EVERY; final += [{"s": s, "e": cut, "cam": g["cam"]}, {"s": cut, "e": cut + 4, "cam": wide}]; s = cut + 4
            final.append({"s": s, "e": g["e"], "cam": g["cam"]})
        merged = final
    tidy = []                                    # بعد الإدخال: أي لقطة أقصر من MIN تندمج بجارتها
    for g in merged:
        if tidy and (g["e"] - g["s"] < MIN or g["cam"] == tidy[-1]["cam"]): tidy[-1]["e"] = g["e"]
        else: tidy.append(g)
    merged = tidy
    if len(merged) > 1 and merged[0]["e"] - merged[0]["s"] < MIN:   # أول لقطة قصيرة ← تنضم للي بعدها
        merged[1]["s"] = merged[0]["s"]; merged = merged[1:]
    for g in merged: g["s"], g["e"] = round(g["s"], 2), round(g["e"], 2)
    merged[-1]["e"] = round(total, 2)
    json.dump({"segs": merged, "total": total}, open(os.path.join(W, "edl.json"), "w"), indent=1)
    lens = [g["e"] - g["s"] for g in merged]; share = {}
    for g in merged: share[g["cam"]] = share.get(g["cam"], 0) + g["e"] - g["s"]
    print(f"الخطة: {len(merged)} لقطة · متوسط {np.mean(lens):.1f}ث · أقصر {min(lens):.1f}ث · " +
          " · ".join(f"كام{k} {100*v/total:.0f}٪" for k, v in sorted(share.items())))

def fit_vf(c):
    # أي كاميرا (عرضية أو طولية) ← 1920×1080 بدون مغط: العرضية تملأ، والطولية بنص الكادر على خلفية مغبّشة منها
    if c["w"] / c["h"] >= 1.5:
        return f"scale={W_OUT}:{H_OUT}:force_original_aspect_ratio=increase,crop={W_OUT}:{H_OUT},fps={FPS},setsar=1"
    return (f"split[a][b];[a]scale={W_OUT}:{H_OUT}:force_original_aspect_ratio=increase,crop={W_OUT}:{H_OUT},boxblur=40:2[bg];"
            f"[b]scale=-2:{H_OUT}[fg];[bg][fg]overlay=(W-w)/2:0,fps={FPS},setsar=1")

def render(W):
    C = json.load(open(os.path.join(W, "cams.json"))); E = json.load(open(os.path.join(W, "edl.json")))
    cams = {c["id"]: c for c in C["cams"]}; start = C["start"]
    t0, prev = arg("--from", 0.0), arg("--preview", 0.0)
    t1 = t0 + prev if prev else E["total"]
    segs = [dict(g, s=max(g["s"], t0), e=min(g["e"], t1)) for g in E["segs"] if g["e"] > t0 and g["s"] < t1]
    sd = os.path.join(W, "wide_segs"); shutil.rmtree(sd, ignore_errors=True); os.makedirs(sd)
    jobs = []
    for i, g in enumerate(segs):
        c = cams[g["cam"]]; out = os.path.join(sd, f"{i:05d}.mp4")
        jobs.append(["ffmpeg", "-v", "error", "-y", "-ss", f"{g['s']+start-c['offset']:.3f}", "-t", f"{g['e']-g['s']:.3f}", "-i", c["file"],
                     "-filter_complex", fit_vf(c), "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", out])
    run = []
    for j in jobs:                               # 4 بالتوازي
        run.append(subprocess.Popen(j))
        if len(run) >= 4: run.pop(0).wait()
    for r in run: r.wait()
    lst = os.path.join(sd, "list.txt")
    open(lst, "w").write("".join(f"file '{os.path.join(sd, f'{i:05d}.mp4')}'\n" for i in range(len(segs))))
    m = C["master"]; name = "episode-wide-preview.mp4" if prev else "episode-wide.mp4"; out = os.path.join(W, name)
    P.sh(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-ss", f"{t0+start-m['offset']:.3f}", "-t", f"{t1-t0:.3f}", "-i", m["file"],
          "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
          "-shortest", "-movflags", "+faststart", out], quiet=False)
    d = P.probe(out)["dur"]
    print(f"→ {out} · {d/60:.1f} د · {len(segs)} لقطة · {os.path.getsize(out)/1e6:.0f} ميقا")

if __name__ == "__main__":
    if len(sys.argv) < 3: print(__doc__); sys.exit(1)
    cmd, W = sys.argv[1], os.path.abspath(sys.argv[2])
    if cmd == "prep": prep(W, [a for a in sys.argv[3:] if not a.startswith("--")])
    elif cmd == "plan": plan(W)
    elif cmd == "render": render(W)
    else: print(__doc__)
