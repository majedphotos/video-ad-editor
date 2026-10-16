#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
معرض الحركات — المستخدم يشوف الحركات المرقّمة (motion/moves) ويختار: «أبي» أو «لا» (references/moves.md).

  python3 scripts/35_moves.py [serve] [--port N] [--no-open] [--timeout SEC]
      يفتح صفحة المعرض، ينتظر «احفظ»، يكتب الاختيار بـ~/.video-ad-editor/profile.json تحت "moves"
      (ما يلمس باقي الملف) ويطبعه. سطر «URL: …» ينطبع أول شي — لو المتصفح ما انفتح عطه للمستخدم.
      الرمز: 0 = انحفظ · 2 = خلص الوقت بلا حفظ · 1 = خطأ.
  python3 scripts/35_moves.py show             يطبع الاختيار: {"on":[…], "off":[…]} بالـid + الأرقام
  python3 scripts/35_moves.py set "3 7 12" [--off "5"]
      يحفظ اختياراً من الشات مباشرة (أرقام المعرض) — لما يرد المستخدم «أبي 3 و7، 5 لا» بدل الصفحة.
  python3 scripts/35_moves.py list             يطبع الكتالوج (رقم · id · الاسم · الحالة)
  python3 scripts/35_moves.py plan --title "عنوان الفيديو" [--family calm|punch|onetake|editorial|auto] [--cues number,list,price,cta,contrast,emphasis,reveal,tech,hit] [--dry]
      لوحة حركات الفيديو: 3 حركات أساسية (كلمات + انتقال + كاميرا/كرت) من عائلة وحدة يدور حولها الفيديو كله،
      + لهجات (accents) للحظات الخاصة حسب cues، + القواعد اللي تمشي دايماً. يتجنب أساسيات آخر 3 فيديوهات و"off".
      ينحفظ بسجل moves-history.json (إلا مع --dry) عشان الفيديو الجاي يطلع غير.

  VAE_HOME=<مجلد> يغيّر مكان الحفظ (للتجربة) بدل ~/.video-ad-editor — مكتبات بايثون القياسية بس.
"""
import json, os, re, sys, threading, webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, unquote

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

SKILL = Path(__file__).resolve().parent.parent
MOVES = SKILL / "motion" / "moves"
CATALOG = MOVES / "catalog.json"
HOME = Path(os.environ.get("VAE_HOME") or (Path.home() / ".video-ad-editor"))
PROFILE = HOME / "profile.json"
TYPES = {".html": "text/html; charset=utf-8", ".json": "application/json; charset=utf-8", ".mp4": "video/mp4", ".png": "image/png"}


def ensure_previews(moves_dir):
    """ملف البلقن (رفع تطبيق كلود، حد 200 ملف) يحمل المعاينات zip واحد — نفكّه أول مرة."""
    import zipfile
    d, z = moves_dir / "previews", moves_dir / "previews.zip"
    if z.exists():                                        # يفك الناقص بس (تحديث البنك يضيف معاينات جديدة لمجلد مفكوك من قبل)
        d.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(z) as f:
            for n in f.namelist():
                if n.endswith(".mp4") and "/" not in n.strip("/").replace("previews/", "", 1) and not (d / Path(n).name).exists():
                    (d / Path(n).name).write_bytes(f.read(n))


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def catalog():
    return json.loads(CATALOG.read_text(encoding="utf-8"))["moves"]


def load_profile():
    try:
        return json.loads(PROFILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_moves(on, off):
    """يدمج "moves" بالبروفايل بلا ما يلمس باقي المفاتيح."""
    ids = {m["id"] for m in catalog()}
    on = [i for i in dict.fromkeys(on) if i in ids]
    off = [i for i in dict.fromkeys(off) if i in ids and i not in on]
    p = load_profile()
    p["moves"] = {"on": on, "off": off}
    PROFILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = PROFILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(p, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, PROFILE)
    return p["moves"]


def described(mv):
    by = {m["id"]: m for m in catalog()}
    f = lambda xs: [{"n": by[i]["n"], "id": i, "name": by[i]["name"]} for i in xs if i in by]
    return {"on": f(mv.get("on", [])), "off": f(mv.get("off", []))}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        if not isinstance(body, (bytes, bytearray)):
            body = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = unquote(urlparse(self.path).path)
        if u in ("/", "/index.html"):
            return self._send(200, (MOVES / "index.html").read_bytes(), TYPES[".html"])
        if u == "/api/state":
            p = load_profile()
            cols = ((p.get("identity") or {}).get("colors")) or {}
            return self._send(200, {"moves": p.get("moves") or {"on": [], "off": []}, "colors": cols})
        f = (MOVES / u.lstrip("/")).resolve()
        if MOVES.resolve() in f.parents and f.is_file() and f.suffix in TYPES:
            return self._send(200, f.read_bytes(), TYPES[f.suffix])
        return self._send(404, {"ok": False})

    def do_POST(self):
        if urlparse(self.path).path != "/api/save":
            return self._send(404, {"ok": False})
        ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        origin, host = self.headers.get("Origin"), self.headers.get("Host") or ""
        if ctype != "application/json" or (origin and origin != "http://" + host):
            return self._send(403, {"ok": False, "error": "forbidden"})
        try:
            n = int(self.headers.get("Content-Length") or 0)
            obj = json.loads(self.rfile.read(min(n, 65536)).decode("utf-8"))
            mv = save_moves(obj.get("on") or [], obj.get("off") or [])
        except Exception as e:
            return self._send(400, {"ok": False, "error": str(e)})
        self._send(200, {"ok": True})
        self.server.result = mv
        threading.Thread(target=self.server.shutdown, daemon=True).start()


def serve(args):
    ensure_previews(MOVES)
    port, do_open, timeout, i = 0, True, 1800, 0
    while i < len(args):
        a = args[i]
        if a == "--port":
            port = int(args[i + 1]); i += 1
        elif a == "--no-open":
            do_open = False
        elif a == "--timeout":
            timeout = int(args[i + 1]); i += 1
        i += 1
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    srv.result = None
    url = "http://127.0.0.1:%d/" % srv.server_address[1]
    print("URL: " + url, flush=True)
    if do_open:
        try:
            webbrowser.open(url)
        except Exception:
            pass
    timer = threading.Timer(timeout, srv.shutdown); timer.daemon = True; timer.start()
    try:
        srv.serve_forever(poll_interval=0.3)
    except KeyboardInterrupt:
        pass
    timer.cancel(); srv.server_close()
    if not srv.result:
        log("⏱️ خلص الوقت وما انحفظ شي.")
        return 2
    log("✅ انحفظ بـ" + str(PROFILE))
    print(json.dumps(described(srv.result), ensure_ascii=False, indent=2), flush=True)
    return 0


HISTORY = HOME / "moves-history.json"
SLOTS = [("text", ("text",)), ("transition", ("transition",)), ("camera", ("camera", "card"))]


def history():
    try:
        return json.loads(HISTORY.read_text(encoding="utf-8"))
    except Exception:
        return []


def _h(*a):
    import hashlib
    return int(hashlib.sha1("|".join(map(str, a)).encode("utf-8")).hexdigest()[:8], 16) / 0xFFFFFFFF


def plan(title, family="auto", cues=(), dry=False):
    cat = catalog()
    off = set((load_profile().get("moves") or {}).get("off", []))
    if sys.platform != "darwin":                           # حركات القصّ (mac: true) تحتاج Vision بالماك — برّاه ما تنختار
        off |= {m["id"] for m in cat if m.get("mac")}
    pref = set((load_profile().get("moves") or {}).get("on", []))
    hist = history()
    fams = list(json.loads(CATALOG.read_text(encoding="utf-8")).get("families", {}))
    if family == "auto":                                   # العائلة اللي ما انستخدمت من زمان (قرعة ثابتة بالعنوان عند التعادل)
        last = {h.get("family"): i for i, h in enumerate(hist)}
        family = min(fams, key=lambda f: (last.get(f, -1), _h(title, f)))
    recent = [i for h in hist[-3:] for i in h.get("core", [])]
    used = [i for h in hist for i in h.get("core", []) + h.get("accents", [])]
    def score(m):                                          # الأقل = الأحسن
        return (recent.count(m["id"]) * 10 + used.count(m["id"]) - (3 if m["id"] in pref else 0) + _h(title, m["id"]))
    pool = [m for m in cat if family in m.get("families", []) and m["id"] not in off]
    core, why = [], []
    for slot, roles in SLOTS:
        cands = sorted([m for m in pool if m["role"] in roles], key=score)
        if cands:
            core.append(cands[0]["id"]); why.append("%s: %d %s" % (slot, cands[0]["n"], cands[0]["name"]))
    accents = []
    for cue in cues:                                       # لهجة لكل لحظة خاصة — من أي عائلة، بلا تكرار الأساسيات
        cands = sorted([m for m in cat if cue in m.get("cues", []) and m["id"] not in off and m["id"] not in core + accents], key=score)
        if cands:
            accents.append(cands[0]["id"]); why.append("لهجة %s: %d %s" % (cue, cands[0]["n"], cands[0]["name"]))
    rules = [m["id"] for m in cat if m["role"] == "rule" and family in m.get("families", []) and m["id"] not in off and m["id"] not in accents]
    caption = [m["id"] for m in cat if m["role"] == "caption" and m["id"] not in off]
    out = {"title": title, "family": family, "core": core, "accents": accents[:2], "rules": rules, "caption": caption, "why": why}
    if not dry:
        import datetime
        hist.append({"date": datetime.date.today().isoformat(), "title": title, "family": family, "core": core, "accents": accents[:2]})
        HISTORY.parent.mkdir(parents=True, exist_ok=True)
        HISTORY.write_text(json.dumps(hist[-50:], ensure_ascii=False, indent=1), encoding="utf-8")
    return out


def nums(s):
    by = {m["n"]: m["id"] for m in catalog()}
    return [by[int(x)] for x in re.findall(r"\d+", s or "") if int(x) in by]


def main(argv):
    cmd = argv[0] if argv and not argv[0].startswith("--") else "serve"
    rest = argv[1:] if argv and not argv[0].startswith("--") else argv
    if cmd == "serve":
        return serve(rest)
    if cmd == "show":
        print(json.dumps(described(load_profile().get("moves") or {}), ensure_ascii=False, indent=2))
        return 0
    if cmd == "set":
        on = nums(rest[0] if rest else "")
        off = nums(rest[rest.index("--off") + 1]) if "--off" in rest else []
        print(json.dumps(described(save_moves(on, off)), ensure_ascii=False, indent=2))
        return 0
    if cmd == "list":
        mv = load_profile().get("moves") or {}
        for m in catalog():
            st = "✓" if m["id"] in mv.get("on", []) else "✗" if m["id"] in mv.get("off", []) else "·"
            print("%s %2d  %-11s %s" % (st, m["n"], m["id"], m["name"]))
        return 0
    if cmd == "plan":
        opt = lambda k, d=None: rest[rest.index(k) + 1] if k in rest else d
        cues = [c.strip() for c in (opt("--cues", "") or "").split(",") if c.strip()]
        print(json.dumps(plan(opt("--title", "بلا عنوان"), opt("--family", "auto"), cues, "--dry" in rest), ensure_ascii=False, indent=2))
        return 0
    log(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
