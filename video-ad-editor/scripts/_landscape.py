# -*- coding: utf-8 -*-
"""🆕 v3.5 مصدر بالعرض (مقابلة · بودكاست · حلقة تلفزيون) → قصّ 9:16 حول الوجه لكل لقطة بدل المطّ.
يستدعيه 03_cut_zoom.py لحاله لما الفيديو أعرض من 9:16 — ما يحتاج أمر زيادة.
لكل مقطع بـcut.json: حدود اللقطات (تغيّر الكاميرا) بدقة فريم، ولكل لقطة وجه أكبر شخص (مكتبة Vision بالماك)
→ قصّ ثابت يحط الوجه بالثلث العلوي (مثل مصوّر، بلا لحاق يرجّف). لقطة عريضة (وجه صغير) تنقرّب شوي.
ما فيه راصد وجه (ويندوز / بلا Xcode)؟ قصّ من النص مع تنبيه. ويكتب <work>/shots.json للمراجعة."""
import json, os, re, subprocess, statistics

HERE = os.path.dirname(os.path.abspath(__file__))

def _facetrack():
    """راصد الوجه (نفس اللي يستخدمه وضع البودكاست) — يتبنى مرة وحدة جنب السكربتات"""
    ft = os.path.join(HERE, "facetrack")
    if os.path.exists(ft): return ft
    try:
        r = subprocess.run(["swiftc", "-O", "-o", ft, os.path.join(HERE, "facetrack.swift")], capture_output=True)
        return ft if r.returncode == 0 else None
    except Exception: return None

def _cuts(src, s, e):
    """أوقات تغيّر اللقطة داخل [s,e] بثواني الأصل (فلتر المشاهد بـffmpeg، دقة فريم)"""
    r = subprocess.run(["ffmpeg", "-nostdin", "-v", "info", "-ss", f"{s:.3f}", "-t", f"{e-s:.3f}", "-i", src, "-an",
                        "-vf", "scale=160:-2,select='gt(scene,0.30)',showinfo", "-f", "null", "-"], capture_output=True, text=True)
    ts = [s + float(m) for m in re.findall(r"pts_time:([\d.]+)", r.stderr)]
    out = []
    for t in ts:
        if t - s > 0.12 and e - t > 0.12 and (not out or t - out[-1] > 0.25): out.append(t)
    return out

def _faces(src, s, e, work, tag, ft):
    """الوجه الأكبر بعيّنات 4 فريم/ث: [(t, cx, cy, fw)] نسبية لعرض/ارتفاع الصورة"""
    d = os.path.join(work, "lsc", tag); os.makedirs(d, exist_ok=True)
    for f in os.listdir(d): os.remove(os.path.join(d, f))
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-ss", f"{s:.3f}", "-t", f"{e-s:.3f}", "-i", src, "-an",
                    "-vf", "fps=4,scale=480:-2", "-q:v", "4", os.path.join(d, "%05d.jpg")])
    js = os.path.join(d, "ft.json")
    subprocess.run([ft, d, js], capture_output=True)
    rows = json.load(open(js)) if os.path.exists(js) else []
    out = []
    for r in rows:   # عيّنة بلا وجه تنحفظ (None) عشان نعرف نسبة الوجه داخل كل لقطة
        f = r.get("face"); t = s + (int(r["f"][:5]) - 1) / 4
        out.append((t, f["x"] + f["w"] / 2, f["y"] + f["h"] / 2, f["w"]) if f else (t, None, None, None))
    return out

def _faces_hi(src, s, e, work, tag, ft):
    """الوجوه الصغيرة (لقطة الاستوديو كامل) ما تنلقط بـ480 — 3 فريمات بالدقة الكاملة"""
    d = os.path.join(work, "lsc", tag); os.makedirs(d, exist_ok=True)
    for j, t in enumerate([s + (e - s) * q for q in (0.25, 0.5, 0.75)]):
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-ss", f"{t:.3f}", "-i", src, "-frames:v", "1", "-q:v", "3", "-y",
                        os.path.join(d, f"{j+1:05d}.jpg")])
    js = os.path.join(d, "ft.json"); subprocess.run([ft, d, js], capture_output=True)
    rows = json.load(open(js)) if os.path.exists(js) else []
    return [(s, r["face"]["x"] + r["face"]["w"] / 2, r["face"]["y"] + r["face"]["h"] / 2, r["face"]["w"]) for r in rows if r.get("face")]

def plan(src, work, keep, SW, SH, zooms, anch=0.30):
    """يرجّع [(s, e, فلتر القصّ)] بثواني الأصل — قطعة لكل لقطة داخل كل مقطع. zooms = زوم كل مقطع (نفس إيقاع 03)."""
    ft = _facetrack()
    if not ft: print("⚠️ ما قدرت أبني راصد الوجه (يحتاج ماك + أدوات Xcode) — بقصّ الفيديو العرضي من النص")
    pieces, shots, acc = [], [], 0.0
    for i, ((s, e), z) in enumerate(zip(keep, zooms)):
        b = [s] + _cuts(src, s, e) + [e]
        fs = _faces(src, s, e, work, f"k{i:03d}", ft) if ft else []
        for a, c in zip(b, b[1:]):
            smp = [f for f in fs if a + 0.15 <= f[0] <= c - 0.15]          # بعيد عن حدود اللقطة (العيّنة ممكن تكون من اللي بعدها)
            inn = [f for f in smp if f[1] is not None]
            if smp and len(inn) < 0.4 * len(smp): inn = []                  # الوجه بأغلب اللقطة مو موجود = لقطة عريضة
            if not inn and c - a < 0.6: inn = [f for f in fs if a - 0.3 <= f[0] <= c + 0.3 and f[1] is not None]   # لقطة خاطفة: خذ جيرانها
            if not inn and ft and c - a >= 0.6: inn = _faces_hi(src, a, c, work, f"k{i:03d}h{len(shots)}", ft)   # عريضة جداً: دوّر بالدقة الكاملة
            zz = z
            if inn:
                cx = statistics.median(f[1] for f in inn); cy = statistics.median(f[2] for f in inn)
                fw = statistics.median(f[3] for f in inn)
                if fw < 0.035: zz = z * 1.6          # لقطة عريضة جداً (الاستوديو كامل)
                elif fw < 0.07: zz = z * 1.35        # لقطة عريضة: قرّب على الشخص
                kind = "face"
            else: cx, cy, fw, kind = 0.5, 0.35, 0, "center"
            shots.append(dict(s=round(acc, 3), e=round(acc + c - a, 3), src=[round(a, 2), round(c, 2)], kind=kind,
                              face_w=round(fw, 3), _p=(a, c, cx, cy, zz))); acc += c - a
    # لقطة بلا وجه (الاستوديو كامل من بعيد): القصّ يروح لمكان المتكلم باللقطة اللي جنبها بدل النص
    for j, sh in enumerate(shots):
        if sh["kind"] != "center": continue
        nb = sorted((abs(k - j), k) for k, x in enumerate(shots) if x["kind"] == "face")
        if nb: a, c, _, _, zz = sh["_p"]; k = nb[0][1]; sh["_p"] = (a, c, shots[k]["_p"][2], 0.40, zz); sh["kind"] = "near"
    for sh in shots:
        a, c, cx, cy, zz = sh.pop("_p")
        h = min(SH, int(SH / zz)) // 2 * 2; w = min(SW, int(h * 9 / 16)) // 2 * 2
        x = int(min(max(cx * SW - w / 2, 0), SW - w))
        y = int(min(max(cy * SH - h * anch, 0), SH - h))
        pieces.append((a, c, f"crop={w}:{h}:{x}:{y}")); sh["crop"] = [w, h, x, y]
    json.dump(shots, open(os.path.join(work, "shots.json"), "w"), ensure_ascii=False, indent=1)
    small = sum(1 for x in shots if x["kind"] == "face" and x["face_w"] < 0.07)
    print(f"📐 الفيديو بالعرض ({SW}×{SH}) — قصّيته بالطول حول الوجه: {len(shots)} لقطة"
          + (f" · {small} عريضة قرّبت عليها" if small else "")
          + (f" · {sum(1 for x in shots if x['kind']=='near')} بلا وجه واضح (تبعت مكان المتكلم)" if any(x['kind']=='near' for x in shots) else "")
          + (f" · {sum(1 for x in shots if x['kind']=='center')} من النص" if any(x['kind']=='center' for x in shots) else ""))
    return pieces
