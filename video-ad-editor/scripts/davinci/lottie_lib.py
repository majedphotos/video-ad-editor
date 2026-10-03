"""مكتبة صغيرة تبني رسومات لوتي بالكود: نص عربي مشكّل صح (هارف باز + خط كايرو)، أيقونات بخطوط ترتسم،
حبوب، أختام صح، شعار، وعدّاد يلف. كل الأوقات بالثواني على زمن الفيديو، والإطار 1080×1920 شفاف.
"""
import json, base64, math, os, tempfile
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.basePen import BasePen
import uharfbuzz as hb

FPS, W, H = 30, 1080, 1920
def _find_font():
    """خط كايرو المتغيّر: MK_FONT_FILE أو مجلدات الخطوط المعتادة (ماك/لينكس/ويندوز)."""
    env = os.environ.get("MK_FONT_FILE")
    if env and os.path.exists(env):
        return env
    dirs = [os.path.expanduser("~/Library/Fonts"), "/Library/Fonts", os.path.expanduser("~/.local/share/fonts"),
            os.path.expandvars("%LOCALAPPDATA%/Microsoft/Windows/Fonts"), "C:/Windows/Fonts"]
    for d in dirs:
        for f in ("Cairo.ttf", "Cairo[slnt,wght].ttf", "Cairo-VariableFont_slnt,wght.ttf"):
            if os.path.exists(os.path.join(d, f)):
                return os.path.join(d, f)
    raise SystemExit("ناقص خط كايرو — نزّله من fonts.google.com/specimen/Cairo وحطه بمجلد الخطوط، أو حدد MK_FONT_FILE")


CAIRO = _find_font()


def load_theme(path="theme.json"):
    """ألوان صاحب الحساب من theme.json (bg · ink · acc · mut) — لا لون ثابت بالكود."""
    t = json.load(open(path)) if os.path.exists(path) else {}
    return {"bg": t.get("bg", "#F0EEE6"), "ink": t.get("ink", "#1F1F1D"), "acc": t.get("acc", "#D97757"),
            "mut": t.get("mut", "#7A7A75"), "sand": t.get("sand", "#E6DDD1"), "handle": t.get("handle", "")}


def hexc(h):
    h = h.lstrip("#"); return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)] + [1]


def F(t):
    return int(round(t * FPS))


def static(v):
    return {"a": 0, "k": v}


def keys(pairs, ease=(0.3, 0.0, 0.2, 1.0)):
    """pairs = [(ثانية, قيمة)] — القيمة رقم أو قائمة."""
    ks = []
    for i, (t, v) in enumerate(pairs):
        v = v if isinstance(v, list) else [v]
        k = {"t": F(t), "s": v}
        if i < len(pairs) - 1:
            k["o"] = {"x": [ease[0]], "y": [ease[1]]}; k["i"] = {"x": [ease[2]], "y": [ease[3]]}
        ks.append(k)
    return {"a": 1, "k": ks}


def tr(p=(0, 0), s=(100, 100), o=100, r=0):
    return {"ty": "tr", "p": static(list(p)), "a": static([0, 0]), "s": static(list(s)), "r": static(r), "o": static(o),
            "sk": static(0), "sa": static(0)}


# ---------- الخط ----------
class _Pen(BasePen):
    def __init__(self, gs, sc, dx, dy):
        super().__init__(gs); self.sc, self.dx, self.dy = sc, dx, dy; self.paths = []; self.cur = None

    def _pt(self, p):
        return [self.dx + p[0] * self.sc, self.dy - p[1] * self.sc]

    def _moveTo(self, p):
        self.cur = {"v": [self._pt(p)], "i": [[0, 0]], "o": [[0, 0]]}

    def _lineTo(self, p):
        self.cur["v"].append(self._pt(p)); self.cur["i"].append([0, 0]); self.cur["o"].append([0, 0])

    def _curveToOne(self, p1, p2, p3):
        a, b, c = self._pt(p1), self._pt(p2), self._pt(p3); last = self.cur["v"][-1]
        self.cur["o"][-1] = [a[0] - last[0], a[1] - last[1]]
        self.cur["v"].append(c); self.cur["i"].append([b[0] - c[0], b[1] - c[1]]); self.cur["o"].append([0, 0])

    def _closePath(self):
        c = self.cur
        if len(c["v"]) > 1 and c["v"][0] == c["v"][-1]:
            c["i"][0] = c["i"][-1]; c["v"].pop(); c["i"].pop(); c["o"].pop()
        self.paths.append({"c": True, **c}); self.cur = None

    _endPath = _closePath


class Face:
    def __init__(self, wght):
        src = TTFont(CAIRO)
        axes = {a.axisTag for a in src["fvar"].axes} if "fvar" in src else set()
        tt = instantiateVariableFont(src, {k: v for k, v in (("wght", wght), ("slnt", 0)) if k in axes}) if axes else src
        path = os.path.join(tempfile.gettempdir(), f"cairo_{wght}.ttf"); tt.save(path)
        self.tt = TTFont(path); self.gs = self.tt.getGlyphSet(); self.upm = self.tt["head"].unitsPerEm
        self.hbf = hb.Font(hb.Face(hb.Blob.from_file_path(path)))

    def shape(self, text):
        buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties(); hb.shape(self.hbf, buf, {})
        x, out = 0, []
        for info, p in zip(buf.glyph_infos, buf.glyph_positions):
            out.append((info.codepoint, x + p.x_offset, p.y_offset)); x += p.x_advance
        return out, x

    def paths(self, text, px, cx, base, align="c"):
        """يرجع مسارات النص بالبكسل. cx = المنتصف (أو الحافة اليمنى لو align='r')، base = خط القاعدة."""
        sc = px / self.upm; glyphs, adv = self.shape(text); wpx = adv * sc
        x0 = cx - wpx / 2 if align == "c" else cx - wpx if align == "r" else cx
        out = []
        for gid, gx, gy in glyphs:
            pen = _Pen(self.gs, sc, x0 + gx * sc, base - gy * sc)
            self.gs[self.tt.getGlyphName(gid)].draw(pen); out += pen.paths
        return out, wpx


BLACK, BOLD = Face(900), Face(700)


# ---------- الطبقات ----------
class Doc:
    def __init__(self, dur):
        self.op = F(dur); self.layers = []; self.assets = []; self.n = 0; self.group = "main"

    def _layer(self, name, t0, t1, shapes, anchor, pop=True, fade=True, extra_ks=None, ty=4, ref=None):
        self.n += 1
        ip, op = F(t0), F(t1)
        s = keys([(t0, [0, 0]), (t0 + 0.2, [112, 112]), (t0 + 0.33, [100, 100])]) if pop else static([100, 100])
        o = keys([(t0, 0), (t0 + 0.12, 100), (t1 - 0.2, 100), (t1, 0)]) if fade else static(100)
        ks = {"o": o, "r": static(0), "p": static(list(anchor)), "a": static(list(anchor)), "s": s}
        if extra_ks: ks.update(extra_ks)
        L = {"ddd": 0, "ind": self.n, "ty": ty, "nm": name, "sr": 1, "ip": ip, "op": op, "st": 0, "bm": 0, "ks": ks, "_g": self.group}
        if ty == 4: L["shapes"] = shapes
        if ty == 2: L["refId"] = ref
        self.layers.insert(0, L)            # أول طبقة بالقائمة = فوق
        return L

    # نص عربي
    def text(self, txt, t0, t1, cx, base, px, color, face=BLACK, align="c", pop=True):
        paths, w = face.paths(txt, px, cx, base, align)
        items = [{"ty": "sh", "ks": static(p)} for p in paths] + [{"ty": "fl", "c": static(hexc(color)), "o": static(100), "r": 1}, tr()]
        ax = cx if align == "c" else cx - w / 2 if align == "r" else cx + w / 2
        self._layer("txt " + txt, t0, t1, [{"ty": "gr", "it": items}], (ax, base - px * 0.35), pop=pop)
        return w

    # حبّة ملوّنة فيها نص
    def pill(self, txt, t0, t1, cx, cy, px, fill, ink, face=BLACK, padx=46, pady=26):
        paths, w = face.paths(txt, px, cx, cy + px * 0.36)
        bw, bh = w + padx * 2, px * 1.25 + pady
        box = {"ty": "gr", "it": [{"ty": "rc", "p": static([cx, cy]), "s": static([bw, bh]), "r": static(bh / 2)},
                                  {"ty": "fl", "c": static(hexc(fill)), "o": static(100), "r": 1}, tr()]}
        t = {"ty": "gr", "it": [{"ty": "sh", "ks": static(p)} for p in paths] + [{"ty": "fl", "c": static(hexc(ink)), "o": static(100), "r": 1}, tr()]}
        self._layer("pill " + txt, t0, t1, [t, box], (cx, cy))
        return bw

    # أيقونة من خطوط ترتسم (ترِم)
    def strokes(self, name, t0, t1, cx, cy, paths, color, width=14, draw=0.45, pop=False, closed=None):
        items = []
        for i, p in enumerate(paths):
            items.append({"ty": "sh", "ks": static(p)})
        items += [{"ty": "tm", "s": static(0), "e": keys([(t0, 0), (t0 + draw, 100)]), "o": static(0), "m": 1},
                  {"ty": "st", "c": static(hexc(color)), "o": static(100), "w": static(width), "lc": 2, "lj": 2, "ml": 4}, tr()]
        self._layer(name, t0, t1, [{"ty": "gr", "it": items}], (cx, cy), pop=pop)

    def circle(self, t0, t1, cx, cy, r, fill=None, stroke=None, width=10):
        it = [{"ty": "el", "p": static([cx, cy]), "s": static([r * 2, r * 2])}]
        if fill: it.append({"ty": "fl", "c": static(hexc(fill)), "o": static(100), "r": 1})
        if stroke: it.append({"ty": "st", "c": static(hexc(stroke)), "o": static(100), "w": static(width), "lc": 2, "lj": 2, "ml": 4})
        it.append(tr())
        self._layer("circle", t0, t1, [{"ty": "gr", "it": it}], (cx, cy))

    def image(self, png, t0, t1, cx, cy, size, spin=True):
        data = base64.b64encode(open(png, "rb").read()).decode()
        aid = f"img{len(self.assets)}"
        self.assets.append({"id": aid, "w": 640, "h": 640, "u": "", "p": "data:image/png;base64," + data, "e": 1})
        sc = size / 640 * 100
        ex = {"p": static([cx, cy]), "a": static([320, 320]),
              "s": keys([(t0, [0, 0]), (t0 + 0.25, [sc * 1.12] * 2), (t0 + 0.4, [sc, sc])]),
              "r": keys([(t0, -90), (t0 + 0.45, 0)]) if spin else static(0)}
        self._layer("logo", t0, t1, None, (cx, cy), extra_ks=ex, ty=2, ref=aid)

    def counter(self, target, t0, t1, cx, base, px, color):
        digs = {d: BLACK.paths(d, px, 0, 0, align="l") for d in "0123456789"}
        adv = max(w for _, w in digs.values()); pitch = px * 1.5
        x0 = cx - adv * len(target) / 2
        lands = [0.55, 0.75, 0.95, 1.45]
        for col, d in enumerate(target):
            n = 10 + col * 4
            seq = [str((int(d) - n + i) % 10) for i in range(n + 1)]
            groups = []
            for i, ch in enumerate(seq):
                paths, w = digs[ch]
                groups.append({"ty": "gr", "it": [{"ty": "sh", "ks": static(p)} for p in paths] +
                               [{"ty": "fl", "c": static(hexc(color)), "o": static(100), "r": 1}, tr(p=((adv - w) / 2, i * pitch))]})
            end = t0 + lands[min(col, 3)] + max(0, col - 3) * 0.2
            roll = {"a": 1, "k": [{"t": F(t0), "s": [0, 0], "o": {"x": [0.35], "y": [0]}, "i": {"x": [0.2], "y": [1]}},
                                  {"t": F(end), "s": [0, -n * pitch - 14], "o": {"x": [0.3], "y": [0]}, "i": {"x": [0.4], "y": [1]}},
                                  {"t": F(end) + 6, "s": [0, -n * pitch]}]}
            groups.append({"ty": "tr", "p": roll, "a": static([0, 0]), "s": static([100, 100]), "r": static(0), "o": static(100), "sk": static(0), "sa": static(0)})
            left = x0 + col * adv; top, bot = -px * 1.0, px * 0.32
            rect = {"c": True, "v": [[-20, top], [adv + 20, top], [adv + 20, bot], [-20, bot]], "i": [[0, 0]] * 4, "o": [[0, 0]] * 4}
            self.n += 1
            self.layers.insert(0, {"_g": self.group, "ddd": 0, "ind": self.n, "ty": 4, "nm": f"digit{col}", "sr": 1, "ip": F(t0), "op": F(t1), "st": 0, "bm": 0,
                                   "ks": {"o": keys([(t1 - 0.2, 100), (t1, 0)]), "r": static(0), "p": static([left, base]), "a": static([0, 0]), "s": static([100, 100])},
                                   "hasMask": True, "masksProperties": [{"inv": False, "mode": "a", "pt": static(rect), "o": static(100), "x": static(0), "nm": "win"}],
                                   "shapes": [{"ty": "gr", "it": groups}]})
        # خط تحت يكبر
        tb = t0 + lands[-1] + 0.15; bw = adv * len(target) * 0.72
        bar = {"ty": "gr", "it": [{"ty": "rc", "p": static([cx, base + px * 0.36]), "s": static([bw, 20]), "r": static(10)},
                                  {"ty": "fl", "c": static(hexc(color)), "o": static(100), "r": 1}, tr()]}
        self._layer("bar", tb, t1, [bar], (cx, base + px * 0.36), pop=False,
                    extra_ks={"s": keys([(tb, [0, 100]), (tb + 0.33, [100, 100])])})

    def save_groups(self, prefix):
        """ملف لوتي لكل مجموعة (مشهد) — كل واحد يصير عقدة مستقلة بفيوجن يتكبّر/يتحرّك لحاله."""
        out = {}
        for g in dict.fromkeys(L["_g"] for L in self.layers):
            ls = [{k: v for k, v in L.items() if k != "_g"} for L in self.layers if L["_g"] == g]
            used = {L.get("refId") for L in ls}
            doc = {"v": "5.7.4", "fr": FPS, "ip": 0, "op": self.op, "w": W, "h": H, "nm": g, "ddd": 0,
                   "assets": [a for a in self.assets if a["id"] in used], "layers": ls}
            path = f"{prefix}{g}.json"; json.dump(doc, open(path, "w"), separators=(",", ":")); out[g] = path
        return out

    def save(self, path):
        doc = {"v": "5.7.4", "fr": FPS, "ip": 0, "op": self.op, "w": W, "h": H, "nm": "graphics", "ddd": 0,
               "assets": self.assets, "layers": self.layers}
        json.dump(doc, open(path, "w"), separators=(",", ":"))
        return os.path.getsize(path)


# ---------- أيقونات (مسارات بسيطة حول مركز) ----------
def P(pts, closed=False):
    return {"c": closed, "v": [list(p) for p in pts], "i": [[0, 0]] * len(pts), "o": [[0, 0]] * len(pts)}


def arc(cx, cy, r, a0, a1, n=24):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


def rrect(cx, cy, w, h, r):
    pts = arc(cx + w / 2 - r, cy - h / 2 + r, r, -90, 0, 6) + arc(cx + w / 2 - r, cy + h / 2 - r, r, 0, 90, 6) + \
          arc(cx - w / 2 + r, cy + h / 2 - r, r, 90, 180, 6) + arc(cx - w / 2 + r, cy - h / 2 + r, r, 180, 270, 6)
    return P(pts, True)


def icon_phone(cx, cy, s):
    return [rrect(cx, cy, s * 0.56, s, s * 0.12), P([(cx - s * 0.08, cy + s * 0.38), (cx + s * 0.08, cy + s * 0.38)])]


def icon_globe(cx, cy, s):
    r = s / 2
    return [P(arc(cx, cy, r, 0, 360, 40), True), P(arc(cx, cy, r, -90, 90, 20)), P([(cx - r, cy), (cx + r, cy)]),
            P([(cx + r * 0.42 * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))) for a in range(-90, 91, 9)])]


def icon_face(cx, cy, s):
    return [P(arc(cx, cy - s * 0.16, s * 0.22, 0, 360, 30), True), P(arc(cx, cy + s * 0.5, s * 0.42, 200, 340, 20))]


def icon_mic(cx, cy, s):
    return [rrect(cx, cy - s * 0.14, s * 0.3, s * 0.52, s * 0.15), P(arc(cx, cy - s * 0.02, s * 0.3, 20, 160, 16)),
            P([(cx, cy + s * 0.28), (cx, cy + s * 0.44)]), P([(cx - s * 0.16, cy + s * 0.44), (cx + s * 0.16, cy + s * 0.44)])]


def icon_code(cx, cy, s):
    return [P([(cx - s * 0.2, cy - s * 0.3), (cx - s * 0.48, cy), (cx - s * 0.2, cy + s * 0.3)]),
            P([(cx + s * 0.2, cy - s * 0.3), (cx + s * 0.48, cy), (cx + s * 0.2, cy + s * 0.3)]),
            P([(cx + s * 0.1, cy - s * 0.4), (cx - s * 0.1, cy + s * 0.4)])]


def icon_cup(cx, cy, s):
    return [P([(cx - s * 0.34, cy - s * 0.18), (cx - s * 0.26, cy + s * 0.36), (cx + s * 0.26, cy + s * 0.36), (cx + s * 0.34, cy - s * 0.18)], True),
            P(arc(cx + s * 0.42, cy + s * 0.04, s * 0.14, -90, 90, 12)),
            P([(cx - s * 0.46, cy + s * 0.48), (cx + s * 0.46, cy + s * 0.48)])]


def steam(cx, cy, s):
    out = []
    for dx in (-0.16, 0, 0.16):
        out.append(P([(cx + s * dx + s * 0.05 * math.sin(i / 3), cy - s * 0.3 - s * 0.05 * i) for i in range(8)]))
    return out


def icon_check(cx, cy, s):
    return [P([(cx - s * 0.3, cy), (cx - s * 0.08, cy + s * 0.22), (cx + s * 0.34, cy - s * 0.24)])]


def icon_slash(cx, cy, r):
    k = r * 0.72
    return [P([(cx - k, cy - k), (cx + k, cy + k)])]


def icon_arrow_down(cx, cy, s):
    return [P([(cx, cy - s / 2), (cx, cy + s / 2)]), P([(cx - s * 0.25, cy + s * 0.25), (cx, cy + s / 2), (cx + s * 0.25, cy + s * 0.25)])]


# ---------- الكابشن (نص عربي + فقاعة على الكلمة المنطوقة بمكانها الحقيقي) ----------
def caption(doc, words, s, e, cy, card, px=66, maxw=900, ink="#1F1F1D", acc="#D97757", cardc="#F0EEE6"):
    """words = [[كلمة, بداية, نهاية], ...] بترتيب النطق. card=True يحط بطاقة كريمية وراه (ملء الشاشة)."""
    face = BOLD; sp = px * 0.30; LH = px * 1.5
    ws = [(w, face.shape(w)[1] * px / face.upm) for w, _, _ in words]
    lines, cur = [[]], 0
    for i, (_, wpx) in enumerate(ws):
        add = wpx + (sp if lines[-1] else 0)
        if lines[-1] and cur + add > maxw:
            lines.append([]); cur, add = 0, wpx
        lines[-1].append(i); cur += add
    n = len(lines)
    boxes = {}
    text_items = []
    widest = 0
    for li, line in enumerate(lines):
        lw = sum(ws[i][1] for i in line) + sp * (len(line) - 1); widest = max(widest, lw)
        xr = 540 + lw / 2
        base = cy - (n - 1) * LH / 2 + li * LH + px * 0.36
        for i in line:
            wpx = ws[i][1]; x = xr - wpx
            paths, _ = face.paths(ws[i][0], px, x, base, align="l")
            text_items += [{"ty": "sh", "ks": static(p)} for p in paths]
            boxes[i] = (x + wpx / 2, base - px * 0.36, wpx)
            xr = x - sp
    pop = lambda t: keys([(t, [92, 92]), (t + 0.12, [100, 100])])
    fade = lambda a, b: keys([(a, 0), (a + 0.08, 100), (b - 0.06, 100), (b, 0)])
    # البطاقة (تحت)
    if card:
        cw, ch = widest + 90, n * LH + 44
        doc._layer("capcard", s, e, [{"ty": "gr", "it": [{"ty": "rc", "p": static([540, cy]), "s": static([cw, ch]), "r": static(34)},
                                                            {"ty": "fl", "c": static(hexc(cardc)), "o": static(96), "r": 1}, tr()]}],
                   (540, cy), pop=False, extra_ks={"s": pop(s), "o": fade(s, e)})
    # الفقاعات (وسط)
    for i, (w, t0, t1) in enumerate(words):
        nxt = words[i + 1][1] if i + 1 < len(words) else e
        a, b = max(s, t0), max(nxt, t0 + 0.12)
        bx, by, bw = boxes[i]
        doc._layer("bub", a, min(b, e), [{"ty": "gr", "it": [{"ty": "rc", "p": static([bx, by]), "s": static([bw + 30, px * 1.32]), "r": static(px * 0.36)},
                                                              {"ty": "fl", "c": static(hexc(acc)), "o": static(100), "r": 1}, tr()]}],
                   (bx, by), pop=False, fade=False,
                   extra_ks={"s": keys([(a, [80, 80]), (a + 0.08, [104, 104]), (a + 0.14, [100, 100])])})
    # النص (فوق)
    text_items += [{"ty": "fl", "c": static(hexc(ink)), "o": static(100), "r": 1}, tr()]
    doc._layer("captext", s, e, [{"ty": "gr", "it": text_items}], (540, cy), pop=False, extra_ks={"s": pop(s), "o": fade(s, e)})


def coin_rain(doc, t0, t1, n=16, seed=7, gold="#E9B949", rim="#B8862B"):
    import random
    rnd = random.Random(seed)
    for k in range(n):
        x = 80 + rnd.random() * 920; r = 34 + rnd.random() * 22
        a = t0 + rnd.random() * 0.7; dur = 0.8 + rnd.random() * 0.4
        b = min(a + dur, t1)
        coin = {"ty": "gr", "it": [
            {"ty": "el", "p": static([0, 0]), "s": static([r * 2, r * 2])},
            {"ty": "fl", "c": static(hexc(gold)), "o": static(100), "r": 1},
            {"ty": "st", "c": static(hexc(rim)), "o": static(100), "w": static(r * 0.16), "lc": 2, "lj": 2, "ml": 4}, tr()]}
        inner = {"ty": "gr", "it": [{"ty": "el", "p": static([0, 0]), "s": static([r * 1.2, r * 1.2])},
                                    {"ty": "st", "c": static(hexc(rim)), "o": static(100), "w": static(r * 0.1), "lc": 2, "lj": 2, "ml": 4}, tr()]}
        ex = {"p": keys([(a, [x, -80]), (b, [x + rnd.uniform(-60, 60), 1150])], ease=(0.45, 0.0, 0.9, 0.6)),
              "a": static([0, 0]), "r": keys([(a, rnd.uniform(-40, 40)), (b, rnd.uniform(-220, 220))]),
              "s": keys([(a, [100, rnd.uniform(35, 100)]), (b, [100, 100])])}
        doc._layer("coin", a, b, [inner, coin], (0, 0), pop=False, fade=False, extra_ks=ex)


def paper_card(doc, t0, t1, cx, cy, w, h, title, rows, face_t=None, ink="#1F1F1D", acc="#D97757", paper="#FFFDF8"):
    """بطاقة ورقة (قائمة مهام): عنوان وصفوف تتعلّم بصح. rows = [(وقت, نص)]."""
    face_t = face_t or BLACK
    doc._layer("paper", t0, t1, [{"ty": "gr", "it": [
        {"ty": "rc", "p": static([cx, cy - h / 2 + 14]), "s": static([w, 28]), "r": static(14)},
        {"ty": "fl", "c": static(hexc(acc)), "o": static(100), "r": 1}, tr()]},
        {"ty": "gr", "it": [{"ty": "rc", "p": static([cx, cy]), "s": static([w, h]), "r": static(30)},
                            {"ty": "fl", "c": static(hexc(paper)), "o": static(100), "r": 1},
                            {"ty": "st", "c": static(hexc("#E3DACB")), "o": static(100), "w": static(4), "lc": 2, "lj": 2, "ml": 4}, tr()]}],
        (cx, cy))
    doc.text(title, t0 + 0.05, t1, cx, cy - h / 2 + 105, 58, ink, BLACK, pop=False)
    for i, (t, lb) in enumerate(rows):
        y = cy - h / 2 + 190 + i * 88
        doc.circle(t, t1, cx + w / 2 - 70, y, 28, stroke=acc, width=6)
        doc.strokes("pc", t + 0.05, t1, cx + w / 2 - 70, y, icon_check(cx + w / 2 - 70, y, 36), acc, 8, draw=0.2)
        doc.text(lb, t, t1, cx + w / 2 - 120, y + 20, 50, ink, BOLD, align="r", pop=False)



def hearts(doc, t0, t1, n=9, seed=5, reds=("#ED4956", "#D97757")):
    """قلوب لايك صغيرة تطلع لفوق وتختفي."""
    import random
    rnd = random.Random(seed)
    for k in range(n):
        x = 160 + rnd.random() * 760; s = 44 + rnd.random() * 34
        a = t0 + rnd.random() * 0.8; b = min(a + 1.1 + rnd.random() * 0.5, t1)
        c = hexc(reds[k % len(reds)])
        heart = {"ty": "gr", "it": [
            {"ty": "el", "p": static([-0.22 * s, -0.08 * s]), "s": static([0.52 * s, 0.52 * s])},
            {"ty": "el", "p": static([0.22 * s, -0.08 * s]), "s": static([0.52 * s, 0.52 * s])},
            {"ty": "sh", "ks": static({"c": True, "v": [[-0.47 * s, 0.0], [0.47 * s, 0.0], [0, 0.52 * s]], "i": [[0, 0]] * 3, "o": [[0, 0]] * 3})},
            {"ty": "fl", "c": static(c), "o": static(100), "r": 1}, tr()]}
        y0 = 820 + rnd.random() * 60
        ex = {"p": keys([(a, [x, y0]), (b, [x + rnd.uniform(-70, 70), y0 - 420 - rnd.random() * 160])], ease=(0.2, 0.0, 0.4, 1.0)),
              "a": static([0, 0]), "s": keys([(a, [0, 0]), (a + 0.18, [115, 115]), (a + 0.3, [100, 100])]),
              "o": keys([(a, 100), (b - 0.35, 100), (b, 0)]), "r": keys([(a, rnd.uniform(-15, 15)), (b, rnd.uniform(-25, 25))])}
        doc._layer("heart", a, b, [heart], (0, 0), pop=False, fade=False, extra_ks=ex)


def grid(doc, t0, t1, step=60, color="#1F1F1D", opacity=5, width=2):
    """شبكة خفيفة على الخلفية (تنحط تحت الفيديو)."""
    paths = [P([(x, 0), (x, H)]) for x in range(step, W, step)] + [P([(0, y), (W, y)]) for y in range(step, H, step)]
    items = [{"ty": "sh", "ks": static(p)} for p in paths] + [
        {"ty": "st", "c": static(hexc(color)), "o": static(opacity), "w": static(width), "lc": 1, "lj": 1, "ml": 4}, tr()]
    doc._layer("grid", t0, t1, [{"ty": "gr", "it": items}], (0, 0), pop=False, fade=False)


def end_card(doc, t0, t1, T, title, lines, cta="تابعني عشان ما يفوتك الجاي"):
    """بطاقة الختام بعد آخر كلمة (مجرّبة بريلات المقابلة v2): خلفية الثيم + العنوان + ملخص سطرين + خط + طلب متابعة + الحساب.
    T = load_theme(...) · lines = [سطر1, سطر2] — جمل قصيرة (≤ 34 حرف) من كلامه نفسه، لا تخترع.
    مدتها (t1 - t0) تنمرّر لـdavinci_reels.py كـ"extra" عشان مسار الرسم يطول بعد آخر قطعة."""
    doc._layer("endbg", t0, t1, [{"ty": "gr", "it": [{"ty": "rc", "p": static([W / 2, H / 2]), "s": static([W, H]), "r": static(0)},
                                                   {"ty": "fl", "c": static(hexc(T["bg"])), "o": static(100), "r": 1}, tr()]}],
               (W / 2, H / 2), pop=False, extra_ks={"o": keys([(t0, 0), (t0 + 0.25, 100)])}, fade=False)
    if title:
        doc.pill(title, t0 + 0.15, t1, 540, 520, 58, T["acc"], T["bg"], BLACK)
    for i, ln in enumerate(lines[:2]):
        doc.text(ln, t0 + 0.35 + 0.15 * i, t1, 540, 780 + 100 * i, 60, T["ink"], BOLD, pop=False)
    doc._layer("bar", t0 + 0.65, t1, [{"ty": "gr", "it": [{"ty": "rc", "p": static([540, 980]), "s": static([220, 14]), "r": static(7)},
                                                       {"ty": "fl", "c": static(hexc(T["acc"])), "o": static(100), "r": 1}, tr()]}],
               (540, 980), pop=False, extra_ks={"s": keys([(t0 + 0.65, [0, 100]), (t0 + 0.95, [100, 100])])})
    doc.text(cta, t0 + 0.8, t1, 540, 1150, 70, T["acc"], BLACK)
    if T.get("handle"):
        doc.pill(T["handle"], t0 + 1.0, t1, 540, 1290, 50, T["ink"], T["bg"], BOLD)
