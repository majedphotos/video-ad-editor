# -*- coding: utf-8 -*-
"""ريل مراجعة منتج: تعليق صوتي فوق لقطات منتج، بخطوط تتبع القطعة وكرت خصم.
   python3 review.py inspect <مجلد المواد> <work>    يفرّغ، يطلع ورقات فريمات، يقيس الثبات والحدة
   python3 review.py grid <work> <ملف> <ثانية>       فريم بشبكة إحداثيات لاختيار نقاط القطع
   python3 review.py voice <work>                    عزل الضوضاء والقص والمستوى
   python3 review.py track <work>                    تتبع القطع والكاميرا
   python3 review.py still <work> 1.2 5.0 9.8 ...    فريمات تجربة بلا رسم كامل
   python3 review.py render <work>                   الرسم الكامل
   python3 review.py finish <work>                   المكس والدمج والنسخة الخفيفة وفحص النهائي
   python3 review.py cover <work>                    كفر المنتج المقصوص بثلاث مقاسات
   كل شي يقرا من <work>/plan.json — الشكل بـreferences/review-video.md
"""
import glob, json, os, shutil, subprocess, sys, tempfile
import numpy as np
W, H, FPS = 1080, 1920, 30
SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.abspath(os.path.join(HERE, "..", ".."))
VIDEO = (".mov", ".mp4", ".m4v", ".mkv", ".webm")
IMAGE = (".png", ".jpg", ".jpeg", ".heic", ".webp")
AUDIO = (".m4a", ".mp3", ".wav", ".aac", ".flac")


def die(m):
    print("❌ " + m); sys.exit(2)


def run(*a, **k):
    return subprocess.run(a, capture_output=True, text=k.pop("text", True), **k)


def need(work, name):
    p = os.path.join(work, name)
    if not os.path.exists(p): die(f"ما لقيت {name} — سوّ الخطوة اللي قبلها")
    return p


def load_plan(work):
    plan = json.load(open(need(work, "plan.json"), encoding="utf-8"))
    base = plan.get("materials") or work
    plan["_base"] = base
    return plan


def path_of(plan, p):
    return p if os.path.isabs(p) else os.path.join(plan["_base"], p)


def ffprobe(p):
    r = run("ffprobe", "-v", "error", "-show_entries",
            "format=duration:stream=codec_type,width,height,r_frame_rate,color_transfer,pix_fmt:stream_side_data=rotation",
            "-of", "json", p)
    try: return json.loads(r.stdout)
    except Exception: return {}


def to_image(p, out):
    if p.lower().endswith(".heic") and shutil.which("sips"):
        run("sips", "-s", "format", "png", p, "--out", out)
    else:
        run("ffmpeg", "-v", "error", "-y", "-i", p, "-frames:v", "1", out)
    return out


def is_hdr(info):
    return any(s.get("color_transfer") in ("arib-std-b67", "smpte2084") for s in info.get("streams", []) if s.get("codec_type") == "video")


# ───────────── فحص المواد
def sheet(src, out, step, dur):
    from PIL import Image, ImageDraw, ImageFont
    tmp = tempfile.mkdtemp()
    run("ffmpeg", "-v", "error", "-i", src, "-vf", f"fps=1/{step},scale=220:-2", "-q:v", "3", tmp + "/%04d.jpg")
    fs = sorted(glob.glob(tmp + "/*.jpg"))
    if not fs: return
    ims = [Image.open(f).convert("RGB") for f in fs][:48]
    w, h = ims[0].size; c = 12; r = (len(ims) + c - 1) // c
    S = Image.new("RGB", (w * c, h * r))
    for i, im in enumerate(ims):
        d = ImageDraw.Draw(im); d.rectangle((0, 0, 64, 16), fill="black"); d.text((3, 2), f"{i*step:.1f}s", fill="yellow")
        S.paste(im, ((i % c) * w, (i // c) * h))
    S.save(out, quality=85); shutil.rmtree(tmp)


def clip_stats(src):
    import cv2
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", src, "-vf", "fps=10,scale=180:320,format=gray", "-f", "rawvideo", "-"], stdout=subprocess.PIPE)
    prev = None; m = []; s = []
    while True:
        b = p.stdout.read(180 * 320)
        if len(b) < 180 * 320: break
        g = np.frombuffer(b, np.uint8).reshape(320, 180).astype(np.float32)
        if prev is not None: m.append(float(np.mean(abs(g - prev))))
        s.append(float(cv2.Laplacian(g, cv2.CV_32F).var())); prev = g
    p.wait()
    k = 5
    return [dict(t=i * .5, motion=round(float(np.mean(m[i * k:(i + 1) * k])), 1), sharp=round(float(np.mean(s[i * k:(i + 1) * k])), 1)) for i in range(len(m) // k)]


def transcribe(wav):
    """mlx على ماك، وإلا وِسبر. يرجع كلمات بتوقيتها"""
    code = ("import json,sys\n"
            "try:\n import mlx_whisper as M\n r=M.transcribe(sys.argv[1],path_or_hf_repo='mlx-community/whisper-large-v3-turbo',language='ar',word_timestamps=True,condition_on_previous_text=False)\n"
            "except ImportError:\n import whisper\n r=whisper.load_model(__import__('os').environ.get('WHISPER_MODEL','medium')).transcribe(sys.argv[1],language='ar',word_timestamps=True,condition_on_previous_text=False)\n"
            "print(json.dumps([{'text':s['text'],'start':s['start'],'end':s['end'],'words':[{'w':w['word'].strip(),'s':round(w['start'],2),'e':round(w['end'],2)} for w in s.get('words',[])]} for s in r['segments']],ensure_ascii=False))\n")
    tries = [[sys.executable, "-c", code, wav]]
    uv = shutil.which("uv") or os.path.expanduser("~/.local/bin/uv")
    if os.path.exists(uv): tries.insert(0, [uv, "run", "-q", "--python", "3.12", "--with", "mlx-whisper", "--with", "soundfile", "python", "-c", code, wav])
    for c in tries:
        r = subprocess.run(c, capture_output=True, text=True)
        out = r.stdout.strip().splitlines()
        if r.returncode == 0 and out: return json.loads(out[-1])
    return None


def speech_map(path, thr=-36):
    x = read_mono(path); h = SR // 100
    db = np.array([20 * np.log10(np.sqrt(np.mean(x[i:i + h] ** 2)) + 1e-7) for i in range(0, len(x) - h, h)])
    seg = []; s = None
    for i, v in enumerate(db > thr):
        if v and s is None: s = i
        if not v and s is not None: seg.append([s / 100, i / 100]); s = None
    out = [seg[0]] if seg else []
    for a, b in seg[1:]:
        if a - out[-1][1] < .12: out[-1][1] = b
        else: out.append([a, b])
    return out


def read_mono(p):
    return np.frombuffer(run("ffmpeg", "-v", "error", "-i", p, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-", text=False).stdout, np.float32).copy()


def cmd_inspect(folder, work):
    os.makedirs(work, exist_ok=True); rep = dict(folder=os.path.abspath(folder), videos=[], images=[], audio=[])
    for f in sorted(os.listdir(folder)):
        p = os.path.join(folder, f); e = os.path.splitext(f)[1].lower()
        if e in VIDEO:
            i = ffprobe(p); d = float(i.get("format", {}).get("duration", 0))
            sheet(p, os.path.join(work, f"sheet_{f}.jpg"), max(.5, round(d / 40, 1)), d)
            rep["videos"].append(dict(file=f, dur=round(d, 2), hdr=is_hdr(i), stats=clip_stats(p),
                                      has_audio=any(s.get("codec_type") == "audio" for s in i.get("streams", []))))
        elif e in IMAGE:
            to_image(p, os.path.join(work, f"img_{f}.png")); rep["images"].append(f)
        elif e in AUDIO:
            wav = os.path.join(work, f"audio_{f}.wav")
            run("ffmpeg", "-v", "error", "-y", "-i", p, "-ac", "1", "-ar", "16000", wav)
            rep["audio"].append(dict(file=f, dur=round(float(ffprobe(p).get("format", {}).get("duration", 0)), 2),
                                     speech=speech_map(p), words=transcribe(wav)))
            os.remove(wav)
    json.dump(rep, open(os.path.join(work, "inspect.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"✅ inspect.json: {len(rep['videos'])} مقطع · {len(rep['images'])} صورة · {len(rep['audio'])} صوت")
    for v in rep["videos"]:
        if v["hdr"]: print(f"⚠️ {v['file']} HDR، يتحول تلقائي قبل الرسم")
    print("ℹ️ توقيت التفريغ تقريبي. اعتمد خريطة speech لبداية الكلمة المهمة.")


def cmd_grid(work, src, t):
    from PIL import Image, ImageDraw
    p = os.path.join(work, "grid.png")
    run("ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", src, "-frames:v", "1", "-vf", f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}", p)
    im = Image.open(p).convert("RGB"); d = ImageDraw.Draw(im)
    for x in range(0, W, 180): d.line([(x, 0), (x, H)], fill=(255, 255, 0), width=2); d.text((x + 4, 4), str(x), fill="yellow")
    for y in range(0, H, 240): d.line([(0, y), (W, y)], fill=(255, 255, 0), width=2); d.text((4, y + 4), str(y), fill="yellow")
    out = os.path.join(work, f"grid_{os.path.basename(src)}_{t}.jpg"); im.resize((540, 960)).save(out, quality=88); print(out)


# ───────────── الصوت
def find_dfn():
    for c in (os.path.join(SKILL, "bin", "deep-filter"), os.path.join(SKILL, "bin", "deep-filter.exe")):
        if os.path.exists(c): return c
    return shutil.which("deep-filter")


def denoise(src, work, limit):
    wav = os.path.join(work, "vo_in.wav")
    run("ffmpeg", "-v", "error", "-y", "-i", src, "-ac", "1", "-ar", str(SR), "-c:a", "pcm_s16le", wav)
    if not limit: return wav
    dfn = find_dfn()
    if dfn:
        od = os.path.join(work, "dfn"); os.makedirs(od, exist_ok=True)
        r = run(dfn, "-D", "-a", str(limit), "-o", od, wav)
        got = glob.glob(od + "/vo_in*.wav")
        if r.returncode == 0 and got:
            print(f"✅ عزل الضوضاء بـDeepFilterNet بحد {limit} ديسيبل"); return got[0]
    out = os.path.join(work, "vo_clean.wav")
    run("ffmpeg", "-v", "error", "-y", "-i", wav, "-af", "highpass=f=70,afftdn=nf=-30", out)
    print("⚠️ DeepFilterNet مو موجود: استخدمت تنظيف ffmpeg. أقوى نتيجة: 00_setup.sh --extras"); return out


def lufs(x):
    p = subprocess.run(["ffmpeg", "-hide_banner", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-af", "ebur128=peak=true", "-f", "null", "-"],
                       input=x.astype(np.float32).tobytes(), capture_output=True)
    for l in reversed(p.stderr.decode(errors="ignore").splitlines()):
        if "I:" in l: return float(l.split("I:")[1].split("LUFS")[0])
    return -23.


def cmd_voice(work):
    plan = load_plan(work); v = plan["voice"]
    src = denoise(path_of(plan, v["src"]), work, v.get("denoise", 18))
    a = read_mono(src); fd = int(.012 * SR); out = []; edges = []; pos = 0
    d = lambda t: 20 * np.log10(np.sqrt(np.mean(a[max(0, int(t * SR) - 240):int(t * SR) + 240] ** 2)) + 1e-7)
    floor = float(np.percentile([d(t) for t in np.arange(.2, len(a) / SR - .2, .1)], 12))
    warn = 0
    for s, e in v["keep"]:
        x = a[int(s * SR):int(e * SR)].copy(); x[:fd] *= np.linspace(0, 1, fd); x[-fd:] *= np.linspace(1, 0, fd)
        for t in (s, e):
            if d(t) > floor + 12: print(f"⚠️ قص {t:.2f}ث عند {d(t):.0f} ديسيبل، الأرضية {floor:.0f}: غالباً داخل كلمة"); warn += 1
        edges.append(round(pos / SR, 3)); pos += len(x); out.append(x)
    x = np.concatenate(out + [np.zeros(int(v.get("tail", 1.7) * SR), np.float32)]).astype(np.float64)
    i = lufs(x); g = v.get("lufs", -17) - i; x *= 10 ** (g / 20)
    c = 10 ** (-1.5 / 20); over = np.abs(x) > c
    x[over] = np.sign(x[over]) * (c + (1 - c) * np.tanh((np.abs(x[over]) - c) / (1 - c)) * .5)
    np.save(os.path.join(work, "voice.npy"), x.astype(np.float32))
    h = SR // FPS; env = [float(np.sqrt(np.mean(x[k:k + h] ** 2))) for k in range(0, len(x), h)]
    json.dump(dict(edges=edges, dur=len(x) / SR, voiceEnd=pos / SR), open(os.path.join(work, "voice.json"), "w"))
    json.dump(env, open(os.path.join(work, "env.json"), "w"))
    print(f"✅ الصوت {len(x)/SR:.2f}ث · رفع {g:+.1f} · محدود {over.sum()/48:.1f} مللي ثانية · تحذيرات القص {warn}")
    print("بدايات المقاطع بالخط الزمني:", edges)
    wav = os.path.join(work, "voice16.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-ar", "16000", wav], input=x.astype(np.float32).tobytes())
    w = transcribe(wav)
    if w: json.dump(w, open(os.path.join(work, "voice_words.json"), "w", encoding="utf-8"), ensure_ascii=False)
    json.dump(speech_map_arr(x), open(os.path.join(work, "voice_speech.json"), "w"))
    print("✅ voice_words.json + voice_speech.json: ركّب الكلمات على بدايات الطاقة")


def speech_map_arr(x):
    h = SR // 100; db = np.array([20 * np.log10(np.sqrt(np.mean(x[i:i + h] ** 2)) + 1e-7) for i in range(0, len(x) - h, h)])
    seg = []; s = None
    for i, v in enumerate(db > -30):
        if v and s is None: s = i
        if not v and s is not None: seg.append([s / 100, i / 100]); s = None
    return seg


# ───────────── اللقطات
def source_frames(work, plan, s, n):
    if str(s["src"]).lower().endswith(IMAGE): return None
    src = path_of(plan, s["src"])
    if is_hdr(ffprobe(src)):
        sdr = os.path.join(work, "sdr_" + os.path.basename(src) + ".mov"); tool = os.path.join(SKILL, "scripts", "hdr2sdr")
        if not os.path.exists(sdr) and os.path.exists(tool): run(tool, src, sdr)
        if os.path.exists(sdr): src = sdr
    tm = s.get("tmap"); nn = int(tm[-1][1] * FPS) + 2 if tm else n
    vf = f"fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},scale=in_color_matrix=bt709:flags=accurate_rnd+full_chroma_int+full_chroma_inp+bicubic,format=rgb24"   # 🎨 فك دقيق — العادي يغمّق الصورة درجتين من 255
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", str(s.get("ss", 0)), "-i", src, "-vf", vf, "-frames:v", str(nn), "-f", "rawvideo", "-"], stdout=subprocess.PIPE)
    fr = []
    while len(fr) < nn:
        b = p.stdout.read(W * H * 3)
        if len(b) < W * H * 3: break
        fr.append(np.frombuffer(b, np.uint8).reshape(H, W, 3))
    p.stdout.close(); p.wait()
    if not fr: die(f"ما قدرت أقرا {s['src']}")
    if tm:
        ts = [a for a, _ in tm]; ys = [c for _, c in tm]
        fr = [fr[min(len(fr) - 1, int(round(np.interp(i / FPS, ts, ys) * FPS)))] for i in range(n)]
    while len(fr) < n: fr.append(fr[-1])
    return fr


def ease(u): return u * u * (3 - 2 * u)


def track_points(s, fr, n):
    import cv2
    from scipy.ndimage import gaussian_filter1d
    names = list(s.get("anchors", {})); P = np.zeros((n, max(1, len(names)), 2), np.float32)
    if not names: return names, P
    p0 = np.array([s["anchors"][k] for k in names], np.float32)
    if fr is None or not s.get("track", True): P[:] = p0; return names, P
    k0 = int(np.clip((s.get("seed", s.get("ss", 0)) - s.get("ss", 0)) * FPS, 0, n - 1))
    gr = [cv2.cvtColor(cv2.resize(f, (540, 960), interpolation=cv2.INTER_AREA), cv2.COLOR_RGB2GRAY) for f in fr]
    P[k0] = p0
    lk = dict(winSize=(41, 41), maxLevel=3, criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, .01))
    for rng in (range(k0 + 1, n), range(k0 - 1, -1, -1)):
        cur = (p0 / 2).reshape(-1, 1, 2).copy(); prev = gr[k0]
        for i in rng:
            nx, st, _ = cv2.calcOpticalFlowPyrLK(prev, gr[i], cur, None, **lk)
            bad = st.ravel() == 0; nx[bad] = cur[bad]
            P[i] = nx.reshape(-1, 2) * 2; cur = nx; prev = gr[i]
    return names, gaussian_filter1d(P, 2.0, axis=0, mode="nearest")


def camera(s, names, P, n):
    z0, z1 = s.get("zoom", [1.02, 1.1]); U = np.linspace(0, 1, n); S = z0 + (z1 - z0) * U
    if "center" in s:
        c0 = np.array(s["center"], float); c1 = np.array(s.get("center_end", s["center"]), float)
        C = c0[None] + (c1 - c0)[None] * ease(U)[:, None]
    else:
        i = names.index(s["follow"]) if s.get("follow") in names else 0; t = P[:, i]; w = s.get("follow_weight", .65)
        C = t.mean(0)[None] * (1 - w) + t * w + np.array([0, -40])[None]
    C = C.copy(); C[:, 0] = np.clip(C[:, 0], W / 2 / S, W - W / 2 / S); C[:, 1] = np.clip(C[:, 1], H / 2 / S, H - H / 2 / S)
    return S, C


def cmd_track(work):
    plan = load_plan(work); res = {}
    for s in plan["shots"]:
        n = int(round(s["t1"] * FPS)) - int(round(s["t0"] * FPS)); fr = source_frames(work, plan, s, n)
        names, P = track_points(s, fr, n); Sc, C = camera(s, names, P, n)
        O = (P - C[:, None, :]) * Sc[:, None, None] + np.array([W / 2, H / 2])[None, None]
        res[s["id"]] = dict(t0=s["t0"], t1=s["t1"], names=names, pts=np.round(O, 1).tolist())
        np.savez(os.path.join(work, f"cam_{s['id']}.npz"), S=Sc, C=C, P=P)
        if names and (O.min() < -80 or O[..., 1].max() > H + 80): print(f"⚠️ لقطة {s['id']}: نقطة طلعت برا الكادر")
    json.dump(res, open(os.path.join(work, "track.json"), "w"))
    print(f"✅ تتبع {len(res)} لقطة")


def data_uri(p):
    import base64, mimetypes
    t = mimetypes.guess_type(p)[0] or "image/png"
    return f"data:{t};base64," + base64.b64encode(open(p, "rb").read()).decode()


def render_overlay(work, frames):
    pl = load_plan(work)
    data = dict(plan={k: v for k, v in pl.items() if not k.startswith("_")}, track=json.load(open(need(work, "track.json"))), env=json.load(open(need(work, "env.json"))))
    data["fontdir"] = os.path.join(SKILL, "motion", "fonts"); data["dur"] = json.load(open(need(work, "voice.json")))["dur"]
    data["logos"] = {k: data_uri(path_of(pl, v)) for k, v in pl.get("logos", {}).items()}
    json.dump(data, open(os.path.join(work, "overlay_data.json"), "w", encoding="utf-8"), ensure_ascii=False)
    arg = ",".join(map(str, frames)) if frames else ""
    r = subprocess.run(["node", os.path.join(HERE, "render_overlay.js"), os.path.abspath(work), arg], cwd=SKILL)
    if r.returncode: die("رسم الطبقة فشل")


def apply_shot(s, im, i, Sc, C, P, names, pre):
    import cv2
    t = s["t0"] + i / FPS; sc = Sc[i]; c = C[i]
    xx, yy = GRID
    M = np.array([[sc * pre, 0, W / 2 - c[0] * sc], [0, sc * pre, H / 2 - c[1] * sc]], np.float32)
    im = cv2.warpAffine(im, M, (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
    im = cv2.LUT(im, LUT).astype(np.float32)
    ap = lambda k: (P[i, names.index(k)] - c) * sc + np.array([W / 2, H / 2])
    for d in s.get("sheen", []):
        u = (t - d["t"]) / d["d"]
        if not 0 <= u <= 1: continue
        if "poly" in d:
            pl = np.array([(np.array(q, float) - c) * sc + [W / 2, H / 2] for q in d["poly"]], np.int32)
            m = np.zeros((H, W), np.uint8); cv2.fillConvexPoly(m, pl, 255, cv2.LINE_AA); m = cv2.GaussianBlur(m, (0, 0), 5).astype(np.float32) / 255
        else:
            p = ap(d["anchor"]); g = cv2.cvtColor(im.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
            circ = np.minimum(1, np.clip(1.2 - np.hypot(xx - p[0], yy - p[1]) / d.get("r", 200), 0, 1) * 4)
            m = cv2.GaussianBlur(np.clip((105 - g) / 45, 0, 1) * circ, (0, 0), 2)
        w = 150.; ct = -500 + (W + 1000) * ease(u); dd = xx + yy * .45 - (ct + H / 2 * .45)
        band = np.exp(-(dd / w) ** 2) + .45 * np.exp(-((dd - 250) / 60) ** 2)
        im = np.minimum(255, im + (band * m * d.get("g", .7) * 255)[..., None] * np.array([1., .97, .93], np.float32))
    for d in s.get("spot", []):
        k = np.clip((t - d["t0"]) / .22, 0, 1) * np.clip((d["t1"] - t) / .12, 0, 1)
        if k > 0:
            p = ap(d["anchor"]); r = np.hypot(xx - p[0], yy - p[1]) / d.get("r", 320)
            im = im * (1 - d.get("k", .4) * k * np.clip((r - .75) / .9, 0, 1))[..., None]
    if "top_dark" in s:
        g = np.clip(1 - (yy - 200) / s["top_dark"], 0, 1) ** 1.4; im = im * (1 - .72 * g)[..., None]
    if "top_blur" in s:
        b = cv2.GaussianBlur(im, (0, 0), 26); m = np.clip((s["top_blur"] - yy) / 90, 0, 1)[..., None]; im = im * (1 - m) + b * .55 * m
    if "end_blur_t" in s:
        k = ease(np.clip((t - s["end_blur_t"]) / .4, 0, 1))
        if k > 0: im = cv2.GaussianBlur(im, (0, 0), 16 * k + .1) * (1 - .8 * k)
    return im


def compose(work, only=None, out=None):
    import cv2
    global GRID, LUT
    plan = load_plan(work)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32); GRID = (xx, yy)
    x = np.arange(256) / 255; LUT = np.clip(255 * (x - .05 * np.sin(2 * np.pi * x)), 0, 255).astype(np.uint8)
    ov = os.path.join(work, "overlay"); ff = None
    if out:
        ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "15",
                               "-vf", "scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int+full_chroma_inp+bicubic,format=yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
                               "-bsf:v", "h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0", out], stdin=subprocess.PIPE)
    done = []
    for s in plan["shots"]:
        f0 = int(round(s["t0"] * FPS)); f1 = int(round(s["t1"] * FPS)); n = f1 - f0
        if only is not None and not any(f0 <= k < f1 for k in only): continue
        fr = source_frames(work, plan, s, n); z = np.load(os.path.join(work, f"cam_{s['id']}.npz")); names = list(s.get("anchors", {}))
        photo = None; pre = 1.
        if fr is None:
            pth = path_of(plan, s["src"]); png = os.path.join(work, "photo_" + os.path.basename(pth) + ".png")
            if not os.path.exists(png): to_image(pth, png)
            im = cv2.cvtColor(cv2.imread(png), cv2.COLOR_BGR2RGB); h, w = im.shape[:2]; r = max(2 * W / w, 2 * H / h)
            im = cv2.resize(im, (int(w * r), int(h * r)), interpolation=cv2.INTER_AREA if r < 1 else cv2.INTER_CUBIC)
            h, w = im.shape[:2]; y = (h - 2 * H) // 2; x0 = (w - 2 * W) // 2; photo = im[y:y + 2 * H, x0:x0 + 2 * W]; pre = .5
        for i in range(n):
            f = f0 + i
            if only is not None and f not in only: continue
            im = apply_shot(s, photo if fr is None else fr[i], i, z["S"], z["C"], z["P"], names, pre)
            o = cv2.imread(f"{ov}/{f:04d}.png", cv2.IMREAD_UNCHANGED)
            if o is not None:
                a = o[..., 3:4].astype(np.float32) / 255; im = im * (1 - a) + o[..., [2, 1, 0]].astype(np.float32) * a
            o8 = np.clip(im, 0, 255).astype(np.uint8)
            if ff: ff.stdin.write(o8.tobytes())
            else:
                q = os.path.join(work, f"still_{f:04d}.jpg"); cv2.imwrite(q, cv2.cvtColor(o8, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 88]); done.append(q)
    if ff:
        ff.stdin.close(); ff.wait()
        if ff.returncode: die("الترميز فشل")
    return done


def contact(files, out, cols=6):
    from PIL import Image
    r = (len(files) + cols - 1) // cols; S = Image.new("RGB", (324 * cols, 576 * r))
    for i, f in enumerate(files): S.paste(Image.open(f).convert("RGB").resize((324, 576)), ((i % cols) * 324, (i // cols) * 576))
    S.save(out, quality=88); print("🖼️", out)


def cmd_still(work, ts):
    fr = [int(round(float(t) * FPS)) for t in ts]
    for f in glob.glob(os.path.join(work, "still_*.jpg")): os.remove(f)
    render_overlay(work, fr); contact(compose(work, only=set(fr)), os.path.join(work, "stills.jpg"))


def cmd_render(work):
    dur = json.load(open(need(work, "voice.json")))["dur"]; n = int(round(dur * FPS))
    shutil.rmtree(os.path.join(work, "overlay"), ignore_errors=True)
    render_overlay(work, list(range(n)))
    tmp = os.path.join(work, "base.tmp.mp4"); compose(work, out=tmp); os.replace(tmp, os.path.join(work, "base.mp4")); print("✅ base.mp4")


def cmd_finish(work):
    import cv2
    plan = load_plan(work); base = need(work, "base.mp4"); v = np.load(need(work, "voice.npy")).astype(np.float64); sf = np.zeros(len(v))
    SFX = os.path.join(SKILL, "studio", "sfx_prev")
    for e in plan.get("sfx", []):
        x = read_mono(os.path.join(SFX, e["name"] + ".wav")) * 10 ** (e.get("db", -30) / 20); i = int(e["t"] * SR); k = min(len(sf), i + len(x)); sf[i:k] += x[:k - i]
    m = v + sf
    if len(plan.get("sfx", [])) > 12: print("⚠️ المؤثرات أكثر من 12: خففها")
    mix = os.path.join(work, "mix.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-ac", "2", "-c:a", "pcm_s24le", mix], input=m.astype(np.float32).tobytes())
    name = plan.get("name", "review"); oD = plan.get("out") or os.path.join(work, "out"); os.makedirs(oD, exist_ok=True)
    final = os.path.join(oD, name + "-final.mp4"); tmp = final + ".tmp.mp4"
    r = run("ffmpeg", "-v", "error", "-y", "-i", base, "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", "-shortest", "-f", "mp4", tmp)
    if r.returncode: die("الدمج فشل: " + r.stderr[-200:])
    os.replace(tmp, final)
    mob = os.path.join(oD, name + "-mobile.mp4")
    run("ffmpeg", "-v", "error", "-y", "-i", final, "-vf", "scale=720:1280:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", mob)
    c = cv2.VideoCapture(final); n = int(c.get(7)); exp = int(round(json.load(open(os.path.join(work, "voice.json")))["dur"] * FPS))
    if abs(n - exp) > 1: die(f"عدد الفريمات {n} والمتوقع {exp}")
    ts = plan.get("qa", []) or [s["t0"] + .6 for s in plan["shots"]]; fs = []
    for t in ts:
        c.set(cv2.CAP_PROP_POS_FRAMES, int(t * FPS)); ok, f = c.read(); q = os.path.join(work, f"qa_{t:.2f}.jpg"); cv2.imwrite(q, f); fs.append(q)
    contact(fs, os.path.join(work, "qa.jpg"))
    print(f"✅ {final}\n✅ {mob}\n⛔ قبل التسليم افتح qa.jpg بعينك، واقرا السعر والتاريخ والأسماء حرف حرف")


def cutout(src, out):
    """قص الخلفية: FAL لو مفتاحه موجود (ترفع الصورة لخدمتهم)، وإلا rembg على الجهاز"""
    key = os.environ.get("FAL_KEY")
    if key:
        import urllib.request
        req = urllib.request.Request("https://fal.run/fal-ai/birefnet/v2", data=json.dumps(dict(image_url=data_uri(src), model="General Use (Heavy)", output_format="png", refine_foreground=True)).encode(), headers={"Authorization": "Key " + key, "Content-Type": "application/json"})
        try:
            urllib.request.urlretrieve(json.load(urllib.request.urlopen(req, timeout=120))["image"]["url"], out); return out
        except Exception as e: print("⚠️ FAL ما اشتغل:", str(e)[:120])
    uv = shutil.which("uv") or os.path.expanduser("~/.local/bin/uv"); code = "import sys;from rembg import remove;open(sys.argv[2],'wb').write(remove(open(sys.argv[1],'rb').read()))"
    r = run(uv, "run", "-q", "--python", "3.12", "--with", "rembg[cpu]", "python", "-c", code, src, out) if os.path.exists(uv) else None
    if not r or r.returncode: die("قص الخلفية يحتاج uv أو FAL_KEY")
    return out


def cmd_cover(work):
    from PIL import Image, ImageFilter
    plan = load_plan(work); c = plan["cover"]; th = plan.get("theme", {}); ac = th.get("accent", "#2E9BE8"); hl = th.get("highlight", "#7CC8F5")
    bg = c.get("bg")
    if bg: bg = path_of(plan, bg)
    else:
        bg = os.path.join(work, "cover_stage.png"); run(sys.executable, os.path.join(HERE, "stage.py"), bg, ac)
    items = []
    for i, it in enumerate(c["items"]):
        src = path_of(plan, it["src"]); png = os.path.join(work, f"cover_item{i}.png")
        if src.lower().endswith(".heic"): src = to_image(src, png + ".src.png")
        if it.get("cut", True): cutout(src, png); im = Image.open(png).convert("RGBA")
        else: im = Image.open(src).convert("RGBA")
        a = im.getchannel("A"); box = a.point(lambda v: 255 if v > 40 else 0).getbbox()
        if box: im = im.crop(box)
        if it.get("pick"): im = im.crop(tuple(it["pick"]))
        rgb = im.convert("RGB").filter(ImageFilter.UnsharpMask(3, 80, 2)); arr = np.clip((np.asarray(rgb, np.float32) / 255) ** it.get("gamma", .85), 0, 1)
        out = Image.fromarray((arr * 255).astype(np.uint8)); out.putalpha(im.getchannel("A")); out.save(png)
        items.append(dict(src=data_uri(png), x=it["x"], y=it["y"], w=it["w"], rot=it.get("rot", 0)))
    cfg = dict(bg=data_uri(bg), items=items, logos=[data_uri(path_of(plan, v)) for v in c.get("logos", [])], top=c["top"], bottom=c["bottom"], accent=ac, light=hl, fontdir=os.path.join(SKILL, "motion", "fonts"))
    st = os.path.abspath(os.path.join(work, "cover_setup.json")); json.dump(cfg, open(st, "w"))
    oD = os.path.abspath(plan.get("out") or os.path.join(work, "out")); os.makedirs(oD, exist_ok=True); pre = os.path.join(oD, plan.get("name", "review") + "-cover")
    r = subprocess.run(["node", os.path.join(HERE, "cover_render.js"), st, pre], cwd=SKILL)
    if r.returncode: die("رسم الكفر فشل")
    print(f"✅ {pre}-9x16.png · 3x4 · 1x1\nافحصه: python3 scripts/34_phone_preview.py {pre}-9x16.png")


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) < 2: print(__doc__); sys.exit(1)
    c = a[0]
    if c == "inspect": cmd_inspect(a[1], a[2])
    elif c == "grid": cmd_grid(a[1], a[2], a[3])
    elif c == "voice": cmd_voice(a[1])
    elif c == "track": cmd_track(a[1])
    elif c == "still": cmd_still(a[1], a[2:])
    elif c == "render": cmd_render(a[1])
    elif c == "finish": cmd_finish(a[1])
    elif c == "cover": cmd_cover(a[1])
    else: print(__doc__); sys.exit(1)
