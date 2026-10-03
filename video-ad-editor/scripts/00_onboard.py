#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
صفحة التعارف — أول شي يشوفه المستخدم الجديد (references/onboarding.md).

  python3 scripts/00_onboard.py [serve] [--work DIR] [--port N] [--no-open] [--timeout SEC]
      يفتح الصفحة بالمتصفح، ينتظر لين يضغط «احفظ» أو «تخطّ»، يحفظ
      ~/.video-ad-editor/profile.json (+ DIR/profile.json لو انعطى --work) ويطبع الـJSON ويطلع.
      سطر «URL: …» ينطبع أول شي — لو المتصفح ما انفتح، عطه للمستخدم.
      الرمز: 0 = انحفظ · 2 = خلص الوقت بلا إرسال · 1 = خطأ.
  python3 scripts/00_onboard.py show            يطبع الملف المحفوظ (أو {} لو ما فيه)
  python3 scripts/00_onboard.py theme DIR [--force]
      يكتب DIR/theme.json من الملف (ما يلمس ثيماً موجوداً إلا بـ--force) وينسخ الشعار.
  python3 scripts/00_onboard.py onacc DIR       يحسب لون النص فوق التمييز ويكتبه theme.onAcc (بعد ما تكتب ألواناً بيدك)
  python3 scripts/00_onboard.py path            يطبع مسار الملف

  VAE_HOME=<مجلد> يغيّر مكان الحفظ (للتجربة) بدل ~/.video-ad-editor
  يشتغل على ماك وويندوز (python بدل python3 على ويندوز) — مكتبات بايثون القياسية بس.
"""
import base64, json, os, re, shutil, subprocess, sys, threading, time, webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

SKILL = Path(__file__).resolve().parent.parent
PAGE = SKILL / "onboarding" / "index.html"
HOME = Path(os.environ.get("VAE_HOME") or (Path.home() / ".video-ad-editor"))
PROFILE = HOME / "profile.json"
VOICE_RE = re.compile(r"^[a-z]{2}-[A-Z]{2}-[A-Za-z]+Neural$")
SAMPLE_TEXT = "هلا والله! هذا صوتي. أقدر أقرا لك سكربت الفيديو كامل، شرايك فيه؟"   # لهجة
SAMPLE_FUSHA = "أَهْلًا بِكَ. هٰذَا صَوْتِي، وَأَسْتَطِيعُ أَنْ أَقْرَأَ لَكَ نَصَّ الْفِيدْيُو كَامِلًا بِوُضُوح."   # فصحى مشكّلة — تطلع بلا غلط
LOGO_EXT = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/svg+xml": ".svg"}

# نفس لوحات الصفحة — لو وصل palette بلا colors نرجع لها
PALETTES = {
    "night-gold":   dict(bg="#101828", ink="#F5F7FA", acc="#F2B33D", clay="#C98B18", mut="#98A2B3"),
    "paper-indigo": dict(bg="#F7F8FC", ink="#111827", acc="#3B5BFD", clay="#2A3FC0", mut="#6B7280"),
    "coal-lime":    dict(bg="#0E0F0C", ink="#F4F4EF", acc="#C6F432", clay="#93B51F", mut="#8C8F85"),
    "deep-mint":    dict(bg="#0B2A26", ink="#EAF6F2", acc="#3DDC97", clay="#1FA774", mut="#8FB5AA"),
    "plum-pink":    dict(bg="#1A1030", ink="#F7F2FF", acc="#FF5C8A", clay="#D63A6A", mut="#A89BC2"),
    "white-red":    dict(bg="#FFFFFF", ink="#0A0A0A", acc="#FF3B30", clay="#C62A22", mut="#737373"),
    "ocean":        dict(bg="#06283D", ink="#EAF4FB", acc="#47B5FF", clay="#1C82C9", mut="#8BA9BD"),
    "white-teal":   dict(bg="#F4F8F8", ink="#0B1F24", acc="#0E9C9C", clay="#0A7575", mut="#5E7479"),
}
LRM = "\u200e"   # علامة اتجاه يسار←يمين غير مرئية: تثبّت @ أول الحساب داخل رسم عربي (بدونها يطلع my.brand@)
CTA_MAX = 16     # أطول جملة بالسطر الكبير (900 88px) بكرت النهاية — قياس 28 سبتمبر: أعرض خط (نوتو كوفي) ≈ 55px للحرف ← 16 حرف ≈ 880 من 1080
SMALL_MAX = 34   # أطول سطر رمادي صغير (700 40px) — الجملة الأطول تنقسم سطرين (l1 + l2)


def split_small(txt):
    """جملة طويلة ← سطرين متوازنين على حدود الكلمات (l1, l2)."""
    if len(txt) <= SMALL_MAX:
        return txt, ""
    w = txt.split()
    best = None
    for i in range(1, len(w)):
        a, b = " ".join(w[:i]), " ".join(w[i:])
        score = max(len(a), len(b))
        if best is None or score < best[0]:
            best = (score, a, b)
    if not best:
        return txt[:SMALL_MAX], ""
    return best[1], best[2]


CAP_STYLES = {"card", "shadow", "big", "underline", "bar", "type"}
HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")


def _lum(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    c = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def contrast(a, b):
    x, y = _lum(a), _lum(b)
    return (max(x, y) + 0.05) / (min(x, y) + 0.05)


def on_accent(acc, ink, bg):
    """لون النص فوق لون التمييز — نفس القاعدة بالصفحة (onColor) حرفياً:
    الأوضح من ألوانه (ink/bg) لو تباينه 4.5 وفوق، وإلا الأوضح من ألوانه + الأبيض + الأسود."""
    best = max((ink, bg), key=lambda c: contrast(c, acc))
    if contrast(best, acc) >= 4.5:
        return best
    return max((ink, bg, "#FFFFFF", "#111111"), key=lambda c: contrast(c, acc))


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def load_profile():
    try:
        return json.loads(PROFILE.read_text(encoding="utf-8"))
    except Exception:
        return None


def atomic_write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)


def clean(obj):
    """ينظّف الإرسال: يحفظ الشعار ملفاً، ويتأكد من الألوان والقيم."""
    if not isinstance(obj, dict):
        raise ValueError("المدخل مو كائن JSON")
    obj = dict(obj)
    obj.setdefault("version", 1)
    obj["savedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    if obj.get("skip"):
        note = str(obj.get("note") or "")[:4000]
        prev = load_profile()
        if prev and not prev.get("skip"):
            # مستخدم راجع ضغط «تخطّ» = خلّ اختياراتي القديمة كما هي، بس حدّث الملاحظة
            prev.update(note=note, savedAt=obj["savedAt"], keptPrevious=True)
            return prev
        return {"version": 1, "skip": True, "note": note, "savedAt": obj["savedAt"]}
    obj["note"] = str(obj.get("note") or "")[:4000]
    idn = dict(obj.get("identity") or {"mode": "auto"})
    if idn.get("mode") == "palette" and not idn.get("colors"):
        idn["colors"] = PALETTES.get(idn.get("palette"))
    cols = idn.get("colors")
    if cols is not None:
        if not isinstance(cols, dict) or not all(HEX.match(str(cols.get(k, ""))) for k in ("bg", "ink", "acc")):
            raise ValueError("ألوان غير صالحة")
    lg = idn.get("logo")
    if isinstance(lg, dict) and str(lg.get("data", "")).startswith("data:"):
        head, _, b64 = lg["data"].partition(",")
        mime = head[5:].split(";")[0]
        ext = LOGO_EXT.get(mime)
        if not ext:
            raise ValueError("صيغة الشعار مو مدعومة")
        raw = base64.b64decode(b64)
        if len(raw) > 8 * 1024 * 1024:
            raise ValueError("الشعار كبير")
        HOME.mkdir(parents=True, exist_ok=True)
        for old in HOME.glob("logo.*"):
            old.unlink()
        dst = HOME / ("logo" + ext)
        dst.write_bytes(raw)
        idn["logo"] = str(dst)
    elif lg is not None and not isinstance(lg, str):
        idn.pop("logo", None)
    elif lg is None:
        prev = (load_profile() or {}).get("identity", {}) or {}
        if isinstance(prev.get("logo"), str) and Path(prev["logo"]).exists():
            idn["logo"] = prev["logo"]  # ما رفع شعاراً جديداً = نخلي القديم
    obj["identity"] = idn
    if obj.get("capStyle") not in CAP_STYLES | {"auto"}:
        obj["capStyle"] = "auto"
    if obj.get("digits") not in ("western", "arabic"):
        obj["digits"] = "western"
    v = obj.get("voice") or {}
    if v.get("tts") and not VOICE_RE.match(str(v["tts"])):
        v["tts"] = None
    obj["voice"] = v
    return obj


def save(obj, work):
    text = json.dumps(obj, ensure_ascii=False, indent=2)
    atomic_write(PROFILE, text)
    paths = [str(PROFILE)]
    if work:
        wp = Path(work) / "profile.json"
        atomic_write(wp, text)
        paths.append(str(wp))
    return paths


def voice_sample(name, lang="fusha"):
    """عيّنة صوت edge-tts (مجانية، تحتاج نت) — تنحفظ كاش. lang: fusha (افتراضي، بلا غلط) أو dialect."""
    cache = HOME / "voice-samples"
    cache.mkdir(parents=True, exist_ok=True)
    lang = "dialect" if lang == "dialect" else "fusha"
    text = SAMPLE_TEXT if lang == "dialect" else SAMPLE_FUSHA
    out = cache / (name + "-" + lang + ".mp3")
    if out.exists() and out.stat().st_size > 1000:
        return out
    cmds = [[sys.executable, "-m", "edge_tts"]]
    if shutil.which("edge-tts"):
        cmds.append(["edge-tts"])
    err = ""
    for c in cmds:
        try:
            r = subprocess.run(c + ["--voice", name, "--text", text, "--write-media", str(out)],
                               capture_output=True, text=True, timeout=40)
            if r.returncode == 0 and out.exists() and out.stat().st_size > 1000:
                return out
            err = (r.stderr or r.stdout)[-300:]
        except Exception as e:  # noqa
            err = str(e)
    if out.exists():
        out.unlink()
    raise RuntimeError(err or "edge-tts ما اشتغل")


class Handler(BaseHTTPRequestHandler):
    server_version = "vae-onboard"

    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False)
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path in ("/", "/index.html"):
            return self._send(200, PAGE.read_bytes(), "text/html; charset=utf-8")
        if u.path == "/favicon.ico":
            return self._send(204, b"", "image/x-icon")
        if u.path == "/api/ping":
            return self._send(200, {"ok": True})
        if u.path == "/api/profile":
            p = load_profile()
            return self._send(200, p or {})
        if u.path == "/api/logo":
            p = (load_profile() or {}).get("identity", {}) or {}
            lg = p.get("logo")
            if isinstance(lg, str) and Path(lg).exists():
                ext = Path(lg).suffix.lower()
                ct = {v: k for k, v in LOGO_EXT.items()}.get(ext, "application/octet-stream")
                return self._send(200, Path(lg).read_bytes(), ct)
            return self._send(404, {"ok": False})
        if u.path == "/api/voice":
            name = (parse_qs(u.query).get("v") or [""])[0]
            lang = (parse_qs(u.query).get("lang") or ["fusha"])[0]
            if not VOICE_RE.match(name):
                return self._send(400, "اسم صوت غير صالح", "text/plain; charset=utf-8")
            try:
                return self._send(200, voice_sample(name, lang).read_bytes(), "audio/mpeg")
            except Exception as e:
                log("⚠️ عيّنة الصوت فشلت:", str(e)[-200:])
                return self._send(503, "voice sample failed", "text/plain; charset=utf-8")
        return self._send(404, {"ok": False})

    def do_POST(self):
        if urlparse(self.path).path != "/api/submit":
            return self._send(404, {"ok": False})
        # صفحة ثانية مفتوحة بالمتصفح ما تقدر ترسل لنا: لازم JSON (يجبر المتصفح على فحص مسبق)
        # والأصل (Origin) لو موجود لازم يكون نفس السيرفر
        ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        origin = self.headers.get("Origin")
        host = self.headers.get("Host") or ""
        if ctype != "application/json" or (origin and origin != "http://" + host):
            return self._send(403, {"ok": False, "error": "forbidden"})
        try:
            n = int(self.headers.get("Content-Length") or 0)
            if n > 12 * 1024 * 1024:
                raise ValueError("الإرسال كبير")
            obj = clean(json.loads(self.rfile.read(n).decode("utf-8")))
            paths = save(obj, self.server.work)
        except Exception as e:
            log("⚠️ ما انحفظ:", e)
            return self._send(400, {"ok": False, "error": str(e)})
        self._send(200, {"ok": True})
        self.server.result = (obj, paths)
        threading.Thread(target=self.server.shutdown, daemon=True).start()


def serve(args):
    work = None
    port = 0
    do_open = True
    timeout = 1800
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--work":
            work = args[i + 1]; i += 1
        elif a == "--port":
            port = int(args[i + 1]); i += 1
        elif a == "--no-open":
            do_open = False
        elif a == "--timeout":
            timeout = int(args[i + 1]); i += 1
        i += 1
    if not PAGE.exists():
        log("⛔ ما لقيت الصفحة:", PAGE)
        return 1
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    srv.work, srv.result = work, None
    url = "http://127.0.0.1:%d/" % srv.server_address[1]
    print("URL: " + url, flush=True)
    if do_open:
        try:
            webbrowser.open(url)
        except Exception:
            pass
    timer = threading.Timer(timeout, srv.shutdown)
    timer.daemon = True
    timer.start()
    try:
        srv.serve_forever(poll_interval=0.3)
    except KeyboardInterrupt:
        pass
    timer.cancel()
    srv.server_close()
    if not srv.result:
        log("⏱️ خلص الوقت وما وصل شي — المستخدم ما ضغط حفظ.")
        return 2
    obj, paths = srv.result
    log("✅ انحفظ: " + " · ".join(paths))
    print(json.dumps(obj, ensure_ascii=False, indent=2), flush=True)
    return 0


def set_on_acc(t):
    """يكتب theme.onAcc (لون النص فوق التمييز) — المحرّك بدونه يختار أبيض/INK بقاعدة تطلع أبيض على ليموني."""
    if not all(HEX.match(str(t.get(k, ""))) for k in ("bg", "ink", "acc")):
        return None
    t["onAcc"] = on_accent(t["acc"].upper(), t["ink"].upper(), t["bg"].upper())
    c = contrast(t["onAcc"], t["acc"].upper())
    if c < 3:
        log("⚠️ لون التمييز %s ما يطلع عليه نص واضح (تباين %.1f) — قل له واقترح لون تمييز أغمق أو أفتح" % (t["acc"], c))
    cb = contrast(t["acc"].upper(), t["bg"].upper())
    if cb < 1.8:   # نفس حد تحذير الصفحة (cwarn)
        log("⚠️ لون التمييز %s قريب من الخلفية %s (تباين %.1f) — الخط تحت الكلمة والتظليل ما راح يبانون: قل له" % (t["acc"], t["bg"], cb))
    return t["onAcc"]


def fix_on_acc(args):
    """بعد ما تكتب الألوان بيدك (رابط/سؤال): يحسب onAcc ويكتبه بـ<work>/theme.json."""
    if not args:
        log("الاستخدام: 00_onboard.py onacc <work>")
        return 1
    tp = Path(args[0]) / "theme.json"
    try:
        t = json.loads(tp.read_text(encoding="utf-8"))
    except Exception:
        log("⛔ ما قدرت أقرا " + str(tp))
        return 1
    if not set_on_acc(t):
        log("⛔ theme.json ناقصه bg/ink/acc بصيغة #RRGGBB")
        return 1
    atomic_write(tp, json.dumps(t, ensure_ascii=False, indent=2))
    print(t["onAcc"])
    return 0


def to_theme(args):
    """profile.json → theme.json (المحرّك يقرا theme.json بس)."""
    if not args:
        log("الاستخدام: 00_onboard.py theme <work> [--force]")
        return 1
    work = Path(args[0])
    force = "--force" in args
    p = load_profile()
    if not p or p.get("skip"):
        log("ما فيه اختيارات محفوظة (أو تخطّى) — اسأل عن الألوان سؤالاً واحداً بدلها.")
        return 3
    tp = work / "theme.json"
    if tp.exists() and not force:
        log("⛔ فيه theme.json من قبل — ما لمسته (القاعدة: لا تغيّر ثيماً سابقاً إلا بطلبه). --force لو طلب.")
        return 4
    t = {}
    if tp.exists():
        try:
            t = json.loads(tp.read_text(encoding="utf-8"))
        except Exception:
            t = {}
    idn = p.get("identity") or {}
    cols = idn.get("colors")
    if cols:
        for k in ("bg", "ink", "acc", "clay", "mut"):
            if cols.get(k):
                t[k] = cols[k]
    missing_colors = not cols
    if p.get("font") and p["font"] != "auto":
        t["font"] = p["font"]
    if p.get("capStyle") in CAP_STYLES:
        t["capStyle"] = p["capStyle"]
    if p.get("pace") == "calm":
        t["pace"] = "calm"
    elif "pace" in t and p.get("pace") in ("fast", "hyper"):
        t.pop("pace")
    ec = p.get("endCard") or {}
    if ec.get("handle"):
        h = ec["handle"].strip()
        t["handle"] = h if h.startswith("@") else "@" + h
    if ec.get("on"):
        # ⛔ كرت الختام الافتراضي بالمحرّك = إعلان السكل نفسه («علّق بكلمة فيديو»). نكتب الكرت كامل
        #    (كل الحقول) حتى ما يتسرّب منه سطر. شكل الكرت: l1 سطر رمادي صغير فوق · cta السطر الكبير ·
        #    word داخل القرص الملوّن · الحساب سطر تحت (theme.handle) — المحرّك يرسمها كذا (compose: outro()).
        mine = " ".join((ec.get("cta") or "").split())
        word, h = (ec.get("word") or "").strip(), t.get("handle", "")
        short = mine if (mine and len(mine) <= CTA_MAX) else ""
        # جملته الطويلة ما تنضغط بالسطر الكبير — تنزل للسطرين الرماديين فوق (l1/l2)
        l1, l2 = split_small(mine) if (mine and not short) else ("", "")
        if word:
            o = dict(l1=l1, l2=l2, chips=[], cta=short or "علّق بكلمة", word=word, sub="")
        elif h:
            # الحساب داخل القرص: محاط بعلامة LRM وإلا المحرّك (نص عربي) يقلبه my.brand@
            o = dict(l1=l1, l2=l2, chips=[], cta=short or "تابعني", word=LRM + h + LRM, sub="")
        else:
            o = dict(l1=l1, l2=l2, chips=[], cta=short or "تابعني", word="", sub="")
            log("⚠️ كرت النهاية بلا كلمة ولا حساب — القرص الملوّن بيطلع فاضي: اسأله عن حسابه أو اكتب outro.word بنفسك")
        t["outro"] = o
    else:
        log("ℹ️ ما يبي كرت نهاية ← حط \"outro\": 0 بـsfx.json")
    set_on_acc(t)
    cp = work / "compose.html"
    if cp.exists() and "ONACC" not in cp.read_text(encoding="utf-8", errors="ignore"):
        log("⚠️ compose.html بالمجلد نسخة قديمة ما تعرف onAcc — انسخ scripts/compose.REFERENCE.html من جديد (لو ما صمّمت فيه مشاهد بعد)")
    lg = idn.get("logo")
    if isinstance(lg, str) and Path(lg).exists():
        work.mkdir(parents=True, exist_ok=True)
        dst = work / ("logo" + Path(lg).suffix.lower())
        shutil.copyfile(lg, dst)
        t["logo"] = dst.name
    t.setdefault("grade", False)
    t.setdefault("badgeUntil", 0)
    t.setdefault("faceAnchor", 0.30)
    atomic_write(tp, json.dumps(t, ensure_ascii=False, indent=2))
    log("✅ كتبت " + str(tp) + ("" if not missing_colors else "  ⚠️ بلا ألوان — ناقص bg/ink/acc (رابط أو تلقائي): طلّعها قبل الرسم"))
    print(json.dumps(t, ensure_ascii=False, indent=2))
    return 0


def main():
    a = sys.argv[1:]
    cmd = a[0] if a and not a[0].startswith("--") else "serve"
    rest = a[1:] if a and not a[0].startswith("--") else a
    if cmd == "serve":
        return serve(rest)
    if cmd == "show":
        print(json.dumps(load_profile() or {}, ensure_ascii=False, indent=2))
        return 0
    if cmd == "path":
        print(PROFILE)
        return 0
    if cmd == "theme":
        return to_theme(rest)
    if cmd == "onacc":
        return fix_on_acc(rest)
    log(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main())
