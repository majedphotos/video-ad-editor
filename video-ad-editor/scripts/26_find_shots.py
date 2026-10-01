# -*- coding: utf-8 -*-
"""🔎 دوّر لقطة بالمعنى داخل المقاطع — «قهوة تنصب»، «لقطة قريبة للمنتج» (30 سبتمبر، مأخوذة من فكرة Palmier).

  python3 26_find_shots.py <work> index <مجلد_أو_ملفات…> [--every 1.0]
  python3 26_find_shots.py <work> find "a close-up of coffee being poured" [--top 8] [--sheet]
  python3 26_find_shots.py <work> find --like صورة.jpg [--top 8] [--sheet]
  python3 26_find_shots.py <work> where "…"      ← نفس find بس يطبع أرقام مقاطع المونتاج (montage.json)

موديل SigLIP2 من قوقل يشتغل على الجهاز (بلا إنترنت بعد أول تنزيل ~1.5 قيقا، بلا رصيد):
  يحوّل كل لقطة ووصفك لنفس «المعنى» ويقارن. **اكتب الوصف مثل تعليق صورة بالإنقليزي**
  («a wide shot of a harbor at sunset») مو كلمات مفتاحية — كلود يترجم كلام المستخدم.

الفهرس يُحفظ <work>/shots/ ويتحدّث بس للملفات الجديدة أو المتغيّرة.
يحتاج: torch (موجود مع وِسبر) + transformers — `00_setup.sh --extras` ينزّلها.
"""
import json, os, subprocess, sys

VID_EXT = (".mov", ".mp4", ".m4v", ".avi", ".mkv", ".webm", ".mts", ".m2ts")
MODEL = os.environ.get("SIGLIP_MODEL", "google/siglip2-base-patch16-256")
PX = 256


def die(m):
    print("❌ " + m)
    sys.exit(2)


def flag(args, name, default, cast=str):
    if name in args:
        i = args.index(name)
        if i + 1 < len(args):
            try:
                return cast(args[i + 1])
            except Exception:
                pass
    return default


def positional(args, valued=("--every", "--top", "--like")):
    """الكلمات اللي مو خيارات ولا قيم خيارات."""
    out, skip = [], False
    for a in args:
        if skip:
            skip = False
        elif a in valued:
            skip = True
        elif not a.startswith("--"):
            out.append(a)
    return out


def natkey(s):
    import re
    return [int(x) if x.isdigit() else x.lower() for x in re.split(r"(\d+)", s)]


def duration(p):
    o = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p],
                       capture_output=True, text=True).stdout.strip()
    try:
        return float(o)
    except ValueError:
        return 0.0


# ───────────────────────── الموديل ─────────────────────────
class Embedder:
    def __init__(self):
        try:
            import torch
            from transformers import AutoModel, AutoProcessor
        except ImportError:
            die("أدوات البحث بالمعنى مو منصّبة — شغّل: bash scripts/00_setup.sh --extras")
        self.torch = torch
        self.dev = "mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu")
        print(f"🧠 أحمّل موديل الرؤية ({MODEL.split('/')[-1]})…", flush=True)
        self.model = AutoModel.from_pretrained(MODEL).eval().to(self.dev)
        self.proc = AutoProcessor.from_pretrained(MODEL)

    @staticmethod
    def _t(x):
        # نسخ transformers الجديدة ترجّع كائناً بدل مصفوفة
        return x if hasattr(x, "norm") else getattr(x, "pooler_output", x[0])

    def _norm(self, e):
        e = self._t(e).float()
        return (e / e.norm(dim=-1, keepdim=True)).cpu().numpy()

    def images(self, pil):
        with self.torch.no_grad():
            x = self.proc(images=pil, return_tensors="pt").to(self.dev)
            return self._norm(self.model.get_image_features(**x))

    def text(self, q):
        with self.torch.no_grad():
            x = self.proc(text=[q.lower()], padding="max_length", max_length=64,
                          truncation=True, return_tensors="pt").to(self.dev)
            return self._norm(self.model.get_text_features(**x))[0]


# ───────────────────────── الفهرس ─────────────────────────
def paths(W):
    d = os.path.join(W, "shots")
    os.makedirs(d, exist_ok=True)
    return d, os.path.join(d, "index.json"), os.path.join(d, "emb.npy")


def load_index(W):
    import numpy as np
    d, ij, ej = paths(W)
    if os.path.exists(ij) and os.path.exists(ej):
        return json.load(open(ij)), np.load(ej)
    return {"files": {}, "rows": []}, np.zeros((0, 0), np.float32)


def grab(path, every):
    """فريم كل `every` ثانية بمقاس صغير — كلها بتمريرة ffmpeg وحدة."""
    from PIL import Image
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf",
                        f"fps=1/{every},scale={PX}:{PX}:force_original_aspect_ratio=decrease,"
                        f"pad={PX}:{PX}:(ow-iw)/2:(oh-ih)/2,format=rgb24",
                        "-f", "rawvideo", "-"], capture_output=True)
    n = PX * PX * 3
    out = []
    for k in range(len(r.stdout) // n):
        out.append((k * every + every / 2,
                    Image.frombytes("RGB", (PX, PX), r.stdout[k * n:(k + 1) * n])))
    return out


def cmd_index(W, args):
    import numpy as np
    every = flag(args, "--every", 1.0, float)
    targets = positional(args)
    files = []
    for t in targets:
        if os.path.isdir(t):
            files += [os.path.join(t, f) for f in sorted(os.listdir(t), key=natkey)
                      if f.lower().endswith(VID_EXT) and not f.startswith(".")]
        elif os.path.isfile(t):
            files.append(t)
    if not files:
        die("ما لقيت فيديوهات — عطني مجلد المقاطع أو ملفات.")
    idx, emb = load_index(W)
    todo = []
    for f in files:
        f = os.path.abspath(f)
        st = os.stat(f)
        sig = f"{st.st_size}:{int(st.st_mtime)}:{every}"
        if idx["files"].get(f) != sig:
            todo.append((f, sig))
    if not todo:
        print(f"✅ الفهرس جاهز — {len(files)} مقطع، ما فيه جديد.")
        return
    tot = sum(duration(f) for f, _ in todo)
    print(f"🔎 أفهرس {len(todo)} مقطع ({tot:.0f} ث · لقطة كل {every:g} ث)…", flush=True)
    E = Embedder()
    keep = [i for i, r in enumerate(idx["rows"]) if r["file"] not in {f for f, _ in todo}]
    rows = [idx["rows"][i] for i in keep]
    embs = [emb[keep]] if len(keep) else []
    for n, (f, sig) in enumerate(todo, 1):
        fr = grab(f, every)
        for b in range(0, len(fr), 32):
            chunk = fr[b:b + 32]
            embs.append(E.images([im for _, im in chunk]))
            rows += [{"file": f, "t": round(t, 2)} for t, _ in chunk]
        idx["files"][f] = sig
        print(f"   {n}/{len(todo)} {os.path.basename(f)} — {len(fr)} لقطة", flush=True)
    idx["rows"] = rows
    d, ij, ej = paths(W)
    np.save(ej, np.concatenate([e for e in embs if len(e)]).astype(np.float32))
    json.dump(idx, open(ij, "w"), ensure_ascii=False)
    print(f"✅ الفهرس: {len(rows)} لقطة من {len(idx['files'])} مقطع → {d}")


# ───────────────────────── البحث ─────────────────────────
def search(W, args):
    import numpy as np
    idx, emb = load_index(W)
    if not len(emb):
        die("ما فيه فهرس — شغّل `index <مجلد_المقاطع>` أولاً.")
    top = flag(args, "--top", 8, int)
    E = Embedder()
    like = flag(args, "--like", None)
    if like:
        from PIL import Image
        q = E.images([Image.open(like).convert("RGB")])[0]
        label = "مثل " + os.path.basename(like)
    else:
        words = positional(args)
        if not words:
            die('عطني وصفاً: find "a close-up of coffee being poured"')
        label = " ".join(words)
        q = E.text(label)
    sims = emb @ q
    order = np.argsort(-sims)
    hits, taken = [], {}
    for i in order:
        r = idx["rows"][i]
        # لقطات متلاصقة من نفس المقطع = لقطة وحدة (نوسّع مداها بدل ما نكرّرها)
        near = [h for h in taken.get(r["file"], []) if abs(h["t"] - r["t"]) <= 2.0]
        if near:
            h = near[0]
            h["a"], h["b"] = min(h["a"], r["t"]), max(h["b"], r["t"])
            continue
        h = {"file": r["file"], "t": r["t"], "a": r["t"], "b": r["t"], "score": float(sims[i])}
        taken.setdefault(r["file"], []).append(h)
        hits.append(h)
        if len(hits) >= top:
            break
    return label, hits


def montage_numbers(W):
    p = os.path.join(W, "montage.json")
    if not os.path.exists(p):
        return {}
    return {os.path.abspath(c["file"]): c["i"] for c in json.load(open(p)).get("clips", [])}


def sheet(W, hits):
    """ورقة وحدة للنتائج بالترتيب (3 أعمدة) — كل لقطة من وسط مداها."""
    import shutil, tempfile
    tmp = tempfile.mkdtemp()
    for k, h in enumerate(hits):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{(h['a'] + h['b']) / 2:.2f}", "-i", h["file"],
                        "-frames:v", "1", "-vf", "scale=360:360:force_original_aspect_ratio=decrease,"
                        "pad=360:360:(ow-iw)/2:(oh-ih)/2", os.path.join(tmp, f"{k:03d}.jpg")])
    rows = (len(hits) + 2) // 3
    out = os.path.join(W, "shots", "hits.jpg")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", "1", "-i", os.path.join(tmp, "%03d.jpg"),
                    "-vf", f"tile=3x{rows}:padding=6:color=white", "-frames:v", "1", "-q:v", "3", out])
    shutil.rmtree(tmp, ignore_errors=True)
    return out


def cmd_find(W, args, where=False):
    label, hits = search(W, args)
    nums = montage_numbers(W)
    print(f"🔎 «{label}» — أقرب {len(hits)} لقطة:")
    for k, h in enumerate(hits, 1):
        rng = f"{h['a']:.1f}→{h['b']:.1f}" if h["b"] > h["a"] else f"{h['t']:.1f}"
        mn = nums.get(h["file"])
        tag = f"  [مقطع المونتاج {mn}]" if (where or nums) and mn else ""
        print(f"  {k:2d}. {h['score']:.3f}  {os.path.basename(h['file'])} @ {rng}ث{tag}")
    if hits and hits[0]["score"] < 0.05:
        print("ℹ️  التطابق ضعيف — يمكن اللقطة مو موجودة، أو جرّب وصفاً أوضح بالإنقليزي.")
    json.dump({"query": label, "hits": hits}, open(os.path.join(W, "shots", "hits.json"), "w"),
              ensure_ascii=False, indent=1)
    if "--sheet" in args and hits:
        print(f"🖼️  الورقة (بنفس الترتيب، 3 أعمدة): {sheet(W, hits)} — اقرأها وحدة.")


def main(a):
    if len(a) < 2 or a[0] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0)
    W = os.path.abspath(a[0])
    os.makedirs(W, exist_ok=True)
    cmd, rest = a[1], a[2:]
    if cmd == "index":
        cmd_index(W, rest)
    elif cmd in ("find", "where"):
        cmd_find(W, rest, where=cmd == "where")
    else:
        die("الأوامر: index · find · where")


if __name__ == "__main__":
    main(sys.argv[1:])
