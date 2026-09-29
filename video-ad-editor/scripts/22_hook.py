# -*- coding: utf-8 -*-
"""🪝 الهوك المكتوب لريلات البودكاست/المقابلة (v3.8.1) — كل ريل يبدأ بجملة هوك مكتوبة على الشاشة (1.5-3 ث) ثم يكمل المقطع.
القواعد وصيغ الكتابة: references/podcast-hook.md

  python3 22_hook.py suggest <work> [--words f.json]              ← يرتّب أقوى سطور المقطع (رقم/تناقض/سؤال/قصة) عشان تكتب منها الهوك
  python3 22_hook.py check   <work> "<الهوك>" [...] [--words f.json] ← فاحص القواعد: 3-8 كلمات · أداة شد · لهجة كويتية · الرقم من كلامه · مو أول جملة
  python3 22_hook.py apply   <work> "<الهوك>" [--dur 2.4] [--pos auto|top|mid|low] [--style bold|card] [--kicker "اسم برنامجك"]
                                                [--em "10 دقايق"] [--keep-caps] [--force]
        ← يكتب theme.json ← hook + ينسخ hook-card.js للمجلد ويركّبه بـcompose.html (04/16 يركّبونه وحدهم لو ناقص)
  python3 22_hook.py preview <work>                              ← 4 لقطات للهوك (بداية · 0.3 · آخره · بعده) بورقة وحدة hook_sheet.jpg
  python3 22_hook.py off     <work>                              ← يشيل الهوك
  python3 22_hook.py overlay <out> "<الهوك>" --theme theme.json --words reel.json [--video reel.mp4] [--pos mid] [...]
        ← لريل **مو** من محرّكاتنا (خط المقابلة بدافنشي/لوتي، أو mp4 جاهز): طبقة شفافة hook.mov (ProRes 4444 بألفا — حطها
          بأعلى تراك بدافنشي عند 0) ولو أعطيته --video يطلّع <اسم>_hook.mp4 محروق فوقه + hook_sheet.jpg

<work> لازم يكون فيه caps.json أو a.json (أو --words ملف وِسبر/caps) — بدونها الفاحص ما يقدر يتأكد إن الأرقام من كلامه فيوقف
(--no-words يتخطّى هالفحص عمداً).
بعد apply على ريل مرسوم من قبل: لا تعيد الرسم كامل — `node 04_render_frames.js <work> range 0 <dur+0.5>` ثم 06_encode/06b كالعادة
(وضع الكاميرات: `node 16_render_pod.js <work> range 0 <dur+0.5>` ثم أعد التجميع من `15_podcast.py make`)."""
import sys as _sys, builtins as _bi
try:
    _sys.stdout.reconfigure(encoding="utf-8", errors="replace"); _sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception: pass
_real_open = _bi.open
def _utf8_open(f, mode="r", *a, **k):
    if "b" not in mode: k.setdefault("encoding", "utf-8")
    return _real_open(f, mode, *a, **k)
_bi.open = _utf8_open
import json, os, re, sys, shutil, subprocess, argparse

SC = os.path.dirname(os.path.abspath(__file__))
HIND = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
PUNCT = "…؟?!.,،:«»\"'*|"
def norm(w):
    w = w.translate(HIND).strip(PUNCT)
    w = re.sub("[ً-ْـ]", "", w)                     # تشكيل وكشيدة
    return w.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ة", "ه").replace("ى", "ي")
def toks(s): return [t for t in (norm(x) for x in re.split(r"[\s|…]+", s.translate(HIND))) if t]

# ── أرقام مكتوبة بالحروف (عشان «الرقم موجود بالكلام» ما يفشل لأن وِسبر كتبه كلمة) ──
NUMW = {"واحد": 1, "وحده": 1, "اثنين": 2, "ثنين": 2, "ثنتين": 2, "اثنتين": 2, "ثلاث": 3, "ثلاثه": 3, "اربع": 4, "اربعه": 4,
        "خمس": 5, "خمسه": 5, "ست": 6, "سته": 6, "سبع": 7, "سبعه": 7, "ثمان": 8, "ثمانيه": 8, "ثمن": 8, "تسع": 9, "تسعه": 9,
        "عشر": 10, "عشره": 10, "عشرين": 20, "ثلاثين": 30, "اربعين": 40, "خمسين": 50, "ستين": 60, "سبعين": 70, "ثمانين": 80,
        "تسعين": 90, "ميه": 100, "مئه": 100, "ميتين": 200, "الف": 1000, "الفين": 2000, "مليون": 1000000,
        "ساعتين": 2, "دقيقتين": 2, "سنتين": 2, "يومين": 2, "مرتين": 2, "شهرين": 2, "اسبوعين": 2}
def nums_in(text):
    out = set(int(n) for n in re.findall(r"\d+", text.translate(HIND)))
    for t in toks(text):
        for pre in ("", "و", "ب", "ل", "ال", "وال", "بال"):
            if pre and t.startswith(pre) and t[len(pre):] in NUMW: out.add(NUMW[t[len(pre):]])
        if t in NUMW: out.add(NUMW[t])
    return out

# ── لهجة: كلمة ← بديلها الكويتي (⛔ = غلط أكيد · ⚠️ = الأفضل غيرها) ──
DIALECT = {"وش": ("شنو", 1), "ايش": ("شنو", 1), "كيف": ("شلون", 1), "فقط": ("بس", 1), "لماذا": ("ليش", 1), "ماذا": ("شنو", 1),
           "الان": ("الحين", 1), "جدا": ("وايد", 1), "سوف": ("راح", 1), "لن": ("ما راح", 1), "ليس": ("مو", 1), "هكذا": ("جذي", 1),
           "اريد": ("أبي", 1), "تريد": ("تبي", 1), "يريد": ("يبي", 1), "نريد": ("نبي", 1), "ليه": ("ليش", 1), "عايز": ("تبي", 1),
           "بدك": ("تبي", 1), "هيك": ("جذي", 1), "كتير": ("وايد", 1), "هلا": (None, 0), "ده": ("هذا", 1), "دي": ("هذي", 1),
           "الذي": ("اللي", 1), "التي": ("اللي", 1), "هذه": ("هذي", 2), "لكن": ("بس", 2), "لقد": ("(احذفها)", 1), "إن": (None, 0)}
DEV = {  # أدوات الشد — كل هوك يحتاج وحدة على الأقل، والأقوى اثنتين (رقم + تناقض)
    "رقم":    lambda s, T: bool(re.search(r"\d", s.translate(HIND))) or any(t in NUMW and NUMW[t] > 1 for t in T),   # «واحد» غالباً = شخص
    "تناقض":  lambda s, T: "…" in s or any(t in ("بس", "وما", "ولا", "مو", "بدل", "عكس", "رغم", "حتى", "لكن", "وانا", "وانت", "مب") for t in T),
    "سؤال":   lambda s, T: "؟" in s or "?" in s or any(t in ("شلون", "ليش", "شنو", "منو", "وين", "متى", "كم", "شكثر") for t in T),
    # فضول = كلمة تفتح فجوة (سر/سبب/غلطة/محد يدري) — لا «هذا/اللي/الشي/قبل»: موجودة بأي جملة عادية فتنجّح هوك فاضي («هذا الشي مهم وايد»)
    "فضول":   lambda s, T: any(t in ("السر", "سر", "السبب", "الغلطه", "غلطه", "محد", "ماحد", "الحقيقه", "الوحيد", "الفرق", "المشكله", "الخطا") for t in T),
    "أمر":    lambda s, T: bool(T) and (T[0] in ("لا", "جرب", "خذ", "افتح", "اسمع", "وقف", "انتبه", "اترك") or T[0].startswith("لات")),
    "قصة":    lambda s, T: any(t in ("كنت", "قال", "قالي", "يوم", "مره", "سويت", "خسرت", "فزت", "تعلمت", "ندمت", "صار", "رفضت", "طردوني") for t in T),
}
HOT = ("اول", "اكثر", "اكبر", "اصعب", "احسن", "ابدا", "كل", "محد", "اغلب", "دايما", "غلط", "مستحيل", "سر", "مليون", "خيالي", "فلس", "بلاش")
EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿\U0001F000-\U0001F2FF]")

NO_WORDS = False
WORDS = None   # --words <ملف> (caps.json أو مخرج وِسبر) — يغلب ملفات المجلد
def read_words(p):
    c = json.load(open(p))
    if "cards" in c: return [(x["s"], " ".join(w["t"] for w in x["w"])) for x in c["cards"]]
    if "segments" in c: return [((s.get("words") or [{}])[0].get("start", s.get("start", 0)), s["text"].strip()) for s in c["segments"] if s.get("text", "").strip()]
    return []
def load_sentences(W):
    if WORDS: return read_words(WORDS)
    for fn in ("caps.json", "a.json"):
        p = os.path.join(W, fn)
        if os.path.exists(p): return read_words(p)
    return []

def devices(s): T = toks(s); return [k for k, f in DEV.items() if f(s, T)]

def check(W, hook, quiet=False):
    """يرجّع (أخطاء، تنبيهات، أدوات)"""
    errs, warns = [], []
    words = [w for w in re.split(r"[\s|]+", hook.replace("…", " ").replace("*", "")) if w.strip(PUNCT)]
    n = len(words)
    if n < 3: errs.append(f"{n} كلمات بس — الهوك 3-8 كلمات (أقل من 3 ما يوصّل فكرة)")
    if n > 8: errs.append(f"{n} كلمات — الهوك 3-8 بالكثير (المشاهد عنده ثانيتين يقرا). شيل الحشو: يعني/ترى/والله/أنا")
    if re.search("[٠-٩۰-۹]", hook): errs.append("أرقام هندية — الأرقام غربية دائماً (1 2 3). apply يحوّلها وحده")
    if EMOJI.search(hook): errs.append("إيموجي بالهوك — شيله (والشعلة ممنوعة نهائياً)")
    for t in toks(hook):
        if t in DIALECT and DIALECT[t][0]:
            (errs if DIALECT[t][1] == 1 else warns).append(f"«{t}» مو كويتي — قل «{DIALECT[t][0]}»")
    dv = devices(hook)
    if not dv: errs.append("ما فيه أداة شد: حط رقم، أو تناقض (… وما / بس)، أو سؤال (شلون/ليش)، أو فضول (السبب/الغلطة/محد)")
    elif len(dv) == 1: warns.append(f"أداة وحدة ({dv[0]}) — الأقوى اثنتين: رقم + تناقض، أو سؤال + رقم")
    if len(hook.replace("*", "")) > 46: warns.append(f"{len(hook)} حرف — طويل، بيصغر الخط. قصّره تحت 40")
    sents = load_sentences(W) if (W and (WORDS or os.path.isdir(W))) else []
    if sents:
        body = " ".join(s for _, s in sents)
        miss = sorted(nums_in(hook) - nums_in(body))
        if miss: errs.append(f"الرقم {', '.join(map(str, miss))} مو بكلام المقطع — ⛔ لا تخترع رقماً ما قاله")
        first = set(toks(" ".join(s for _, s in sents[:2]))); H = set(toks(hook))
        if H and len(H & first) / len(H) >= 0.75:
            errs.append("هذا تقريباً أول كلامه بالمقطع — الهوك المكتوب لازم يضيف شي: خذه من أقوى سطر (suggest) لا من أول سطر")
    elif NO_WORDS: warns.append("--no-words: ما تأكدت إن الأرقام من كلامه — تأكد بنفسك")
    else: errs.append(f"ما لقيت كلامه (caps.json/a.json) بـ{W} — ما أقدر أتأكد إن الأرقام من كلامه. عط المجلد الصح أو --words <ملف> (أو --no-words عمداً)")
    if not quiet:
        print(f"🪝 «{hook}» — {n} كلمات · أدوات: {' + '.join(dv) if dv else 'لا شي'}")
        for e in errs: print("  ❌", e)
        for w in warns: print("  ⚠️", w)
        if not errs: print("  ✅ يمشي" + (" — والأفضل تصلّح التنبيهات" if warns else ""))
    return errs, warns, dv

def suggest(W):
    S = load_sentences(W)
    if not S: sys.exit("ما لقيت caps.json ولا a.json بالمجلد — شغّل 02_captions.py (أو 20_episode_cuts.py) أول")
    rows = []
    for i, (t, s) in enumerate(S):
        T = toks(s); dv = devices(s); sc = 0.0
        sc += 3 * ("رقم" in dv) + 2 * ("تناقض" in dv) + 2 * ("سؤال" in dv) + 1.5 * ("قصة" in dv) + 1 * ("فضول" in dv) + 1 * ("أمر" in dv)
        sc += 1.2 * sum(t2 in HOT for t2 in T)
        sc -= 0.6 * sum(t2 in ("يعني", "اه", "طيب", "اوكي", "والله", "هم") for t2 in T)
        if len(T) < 3: sc -= 1.5
        if i + 1 < len(S) and nums_in(S[i + 1][1]) and not nums_in(s): sc += 0.5      # سطر قبل رقم = إعداد
        rows.append((sc, i, t, s, dv))
    print(f"أول كلامه (لا تنسخه كهوك): «{S[0][1]}»\n\nأقوى السطور للهوك (الدرجة · الوقت · الأدوات):")
    seen = {}                                   # السطر المكرر (الهوك الصوتي يعيد جملة من الوسط) يطلع مرة وحدة بأوقاته كلها
    for sc, i, t, s, dv in sorted(rows, reverse=True):
        k = " ".join(toks(s))
        if k in seen: seen[k]["ts"].append(t); continue
        seen[k] = {"sc": sc, "i": i, "ts": [t], "s": s, "dv": dv}
    for r in sorted(seen.values(), key=lambda r: -r["sc"])[:8]:
        i = r["i"]; ctx = (S[i + 1][1] if i + 1 < len(S) else "")
        ts = " و".join(f"{x:.2f}" for x in sorted(r["ts"]))
        print(f"  {r['sc']:4.1f}  {ts}ث  [{' + '.join(r['dv']) or '—'}]  «{r['s']}»" + (f"  ← بعدها «{ctx}»" if ctx else ""))
    nums = sorted(nums_in(" ".join(s for _, s in S)))
    print(f"\nالأرقام اللي قالها (مسموح تستخدمها بس هذي): {', '.join(map(str, nums)) or 'ولا رقم'}")
    print("\nاكتب 3 هوكات بالصيغ (references/podcast-hook.md) — رقم + مفارقة · سؤال يحرج · فضول · أمر معاكس · قصة بنص جملة — ثم:\n"
          f"  python3 {os.path.basename(__file__)} check {W} \"هوك 1\" \"هوك 2\" \"هوك 3\"")

def inject(W):
    shutil.copy(os.path.join(SC, "hook-card.js"), os.path.join(W, "hook-card.js"))
    ch = os.path.join(W, "compose.html")
    if os.path.exists(ch):
        h = open(ch).read()
        if 'src="hook-card.js"' not in h:
            i = h.rfind("</body>")
            h = (h[:i] + '<script src="hook-card.js"></script>\n' + h[i:]) if i >= 0 else h + '\n<script src="hook-card.js"></script>\n'
            open(ch, "w").write(h)
        return "compose.html"
    if os.path.exists(os.path.join(W, "cams.json")): return "كاميرات (16_render_pod.js يركّبه وحده)"
    return None

def theme_rw(W, fn):
    p = os.path.join(W, "theme.json"); th = json.load(open(p)) if os.path.exists(p) else {}
    fn(th); json.dump(th, open(p, "w"), ensure_ascii=False, indent=1); return th

def hook_cfg(a, hook):
    n = len([w for w in re.split(r"[\s|]+", hook.replace("…", " ").replace("*", "")) if w.strip(PUNCT)])
    dur = a.dur or round(min(3.0, max(1.6, 0.9 + 0.28 * n)), 2)
    cfg = {"text": hook, "dur": dur, "pos": a.pos, "style": a.style}
    if a.kicker: cfg["kicker"] = a.kicker.translate(HIND)
    if a.em: cfg["em"] = [e.translate(HIND) for e in a.em]
    if getattr(a, "keep_caps", False): cfg["keepCaps"] = True
    return cfg

def apply(W, a):
    hook = a.hook.translate(HIND).strip()
    errs, warns, dv = check(W, hook)
    if errs and not a.force: sys.exit("⛔ ما طبّقته — صلّح الأخطاء فوق (أو --force لو متأكد)")
    cfg = hook_cfg(a, hook); dur = cfg["dur"]
    theme_rw(W, lambda th: th.__setitem__("hook", cfg))
    where = inject(W)
    print(f"✓ الهوك مركّب ({dur} ث · {a.pos} · {a.style}) — " + (where or "ما لقيت compose.html بعد — عادي: 04_render_frames.js يركّبه وحده وقت الرسم"))
    pj = os.path.join(W, "plan.json")
    if os.path.exists(pj):
        q = [x for x in json.load(open(pj)).get("scenes", []) if x.get("m") == "QUOTE" and x["s"] < dur + 0.3]
        if q: print(f"  ⚠️ «السؤال الكبير» يبدأ {q[0]['s']:.1f}ث — تحت الهوك (ينطفي وقته، فكلماته الأولى تضيع). "
                    "أعد `15_podcast.py plan` — الحين يختار سؤالاً بعد الهوك")
    print(f"  معاينة: python3 {os.path.basename(__file__)} preview {W}")
    rj = "16_render_pod.js" if os.path.exists(os.path.join(W, "cams.json")) else "04_render_frames.js"
    print(f"  ريل مرسوم من قبل؟ ارسم نافذة الهوك بس: node {rj} {W} range 0 {dur + 0.5:.1f}  ثم التجميع كالعادة")

def sheet(files, labels, out):
    """ورقة وحدة من اللقطات — بـPIL لو موجود (مع وسم الوقت)، وإلا ffmpeg (بلا وسم — الترتيب مطبوع بالطرفية)."""
    try:
        from PIL import Image, ImageDraw
        ims = []
        for f, lb in zip(files, labels):
            im = Image.open(f).convert("RGB").resize((360, 640)); d = ImageDraw.Draw(im)
            d.rectangle([0, 0, 92, 34], fill=(0, 0, 0)); d.text((8, 8), lb, fill=(255, 255, 255)); ims.append(im)
        sh = Image.new("RGB", (360 * len(ims) + 8 * (len(ims) - 1), 640), (17, 17, 17))
        for i, im in enumerate(ims): sh.paste(im, (i * 368, 0))
        sh.save(out, quality=88)
    except ImportError:
        cmd = ["ffmpeg", "-v", "error", "-y"]
        for f in files: cmd += ["-i", f]
        fl = ";".join(f"[{i}:v]scale=360:640,setsar=1" + (",pad=368:640:0:0:0x111111" if i < len(files) - 1 else "") + f"[v{i}]" for i in range(len(files)))
        fl += ";" + "".join(f"[v{i}]" for i in range(len(files))) + f"hstack={len(files)}"
        subprocess.run(cmd + ["-filter_complex", fl, "-q:v", "3", out], check=True)
        print("  (بلا Pillow ما فيه وسم وقت — الترتيب من اليسار: " + " · ".join(labels) + ")")
    print("✓", out)

def preview(W):
    th = json.load(open(os.path.join(W, "theme.json"))); h = th.get("hook")
    if not h: sys.exit("ما فيه هوك بـtheme.json — شغّل apply أول")
    d = float(h.get("dur", 2.4)); ts = [0.0, 0.3, round(d * 0.7, 2), round(d + 0.4, 2)]
    cams = os.path.exists(os.path.join(W, "cams.json"))
    js = os.path.join(SC, "16_render_pod.js" if cams else "04_render_frames.js")
    subprocess.run(["node", js, W, "preview"] + [f"{t:.2f}" if not cams else str(t) for t in ts], check=True, stdout=subprocess.DEVNULL)
    files = [os.path.join(W, "prev", (f"t{t:.2f}.jpg" if not cams else str(t).replace(".", "_") + ".jpg")) for t in ts]
    sheet(files, [f"{t:.2f}s" for t in ts], os.path.join(W, "hook_sheet.jpg"))

# ── overlay: ريل مو من محرّكاتنا (خط المقابلة بدافنشي/لوتي · mp4 جاهز) ──
OVERLAY_JS = r"""
const [,, SC, OUT, CFGF, FPS] = process.argv; const fs=require('fs'), path=require('path'), {pathToFileURL}=require('url');
const C=JSON.parse(fs.readFileSync(CFGF,'utf8'));
function pupp(){ for(const p of [process.env.PUPPETEER_PATH,'puppeteer-core','puppeteer',path.join(process.cwd(),'node_modules/puppeteer-core'),path.join(SC,'..','node_modules','puppeteer-core'),path.join(SC,'..','..','node_modules','puppeteer-core')]){ if(!p) continue; try{return require(p);}catch(e){} } throw new Error('ما لقيت puppeteer-core — شغّل 00_setup.sh'); }
function chrome(){ if(process.env.CHROME_PATH) return process.env.CHROME_PATH; const LA=process.env.LOCALAPPDATA||'', PF=process.env.ProgramFiles||'C:/Program Files', P86=process.env['ProgramFiles(x86)']||'C:/Program Files (x86)';
  for(const c of ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',PF+'/Google/Chrome/Application/chrome.exe',P86+'/Google/Chrome/Application/chrome.exe',LA+'/Google/Chrome/Application/chrome.exe',PF+'/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium']) if(fs.existsSync(c)) return c; throw new Error('ما لقيت كروم — حدّد CHROME_PATH'); }
(async()=>{ const b=await pupp().launch({executablePath:chrome(),headless:'new',args:['--no-sandbox','--allow-file-access-from-files','--font-render-hinting=none','--force-color-profile=srgb']});
  const p=await b.newPage(); p.on('pageerror',e=>console.log('PAGEERR',e.message)); p.on('console',m=>{ if(m.type()==='error') console.log(m.text()); });
  await p.setViewport({width:1080,height:1920,deviceScaleFactor:1});
  const th=C.theme, font=th.font||'Cairo';
  let ff=''; if(th.fontFiles) ff='<style>'+th.fontFiles.map(f=>"@font-face{font-family:'"+font+"';src:url('"+pathToFileURL(f.src).href+"');font-weight:"+(f.weight||400)+"}").join('')+'</style>';
  else ff='<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family='+encodeURIComponent(font)+':wght@400;700;800;900&display=swap">';
  const html='<!doctype html><html dir="rtl"><head><meta charset="utf-8">'+ff+'<style>html,body{margin:0;background:transparent}</style></head><body><canvas id="cv" width="1080" height="1920"></canvas></body></html>';
  fs.writeFileSync(path.join(OUT,'.hook_overlay.html'),html);
  await p.goto(pathToFileURL(path.join(OUT,'.hook_overlay.html')).href,{waitUntil:'networkidle0'});
  await p.addScriptTag({path:path.join(SC,'hook-card.js')});
  await p.evaluate(async (h,t)=>{ HookCard.setup(h,t); await HookCard.ready(); },C.hook,th);
  const fps=+FPS, n=Math.ceil(C.hook.dur*fps), dir=path.join(OUT,'hook_frames'); fs.mkdirSync(dir,{recursive:true});
  for(const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir,f));
  for(let i=0;i<n;i++){ const d=await p.evaluate(t=>{ const c=document.getElementById('cv'), x=c.getContext('2d'); x.setTransform(1,0,0,1,0,0); x.clearRect(0,0,1080,1920); HookCard.draw(t); return c.toDataURL('image/png'); }, i/fps);
    fs.writeFileSync(path.join(dir,String(i).padStart(5,'0')+'.png'),Buffer.from(d.split(',')[1],'base64')); }
  console.log('frames',n); await Promise.race([b.close(),new Promise(r=>setTimeout(r,8000))]); process.exit(0); })();
"""

def probe(v):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate",
                        "-of", "json", v], capture_output=True, text=True, check=True)
    st = json.loads(r.stdout)["streams"][0]; a, b = st["r_frame_rate"].split("/")
    return st["width"], st["height"], float(a) / float(b)

def overlay(OUT, a):
    os.makedirs(OUT, exist_ok=True)
    tp = a.theme or os.path.join(OUT, "theme.json")
    if not os.path.exists(tp): sys.exit(f"ما لقيت الثيم ({tp}) — عط --theme <theme.json> (ألوان هويته وخطه)")
    th = json.load(open(tp)); th.pop("hook", None); tdir = os.path.dirname(os.path.abspath(tp))
    if th.get("fontFiles"): th["fontFiles"] = [dict(f, src=os.path.join(tdir, f["src"])) for f in th["fontFiles"]]
    hook = a.hook.translate(HIND).strip()
    errs, warns, dv = check(OUT, hook)
    if errs and not a.force: sys.exit("⛔ ما سوّيته — صلّح الأخطاء فوق (أو --force لو متأكد)")
    cfg = hook_cfg(a, hook); cfg["pad"] = a.pad; cfg["surface"] = "video"
    vw = vh = None; fps = a.fps
    if a.video:
        vw, vh, vf = probe(a.video); fps = fps or vf
        if abs(vw / vh - 1080 / 1920) > 0.01: sys.exit(f"الفيديو {vw}×{vh} مو 9:16 — الهوك مصمم لـ1080×1920")
    fps = fps or 30
    json.dump({"theme": th, "hook": cfg}, open(os.path.join(OUT, ".hook_overlay.json"), "w"), ensure_ascii=False)
    jsf = os.path.join(OUT, ".hook_overlay.js"); open(jsf, "w").write(OVERLAY_JS)
    subprocess.run(["node", jsf, SC, OUT, os.path.join(OUT, ".hook_overlay.json"), str(fps)], check=True)
    fr = os.path.join(OUT, "hook_frames", "%05d.png"); mov = os.path.join(OUT, "hook.mov")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", f"{fps:g}", "-i", fr, "-c:v", "prores_ks", "-profile:v", "4444",
                    "-pix_fmt", "yuva444p10le", mov], check=True)
    print(f"✓ {mov} — طبقة شفافة {cfg['dur']} ث بـ{fps:g} فريم: حطها بأعلى تراك بدافنشي عند 0، وأخّر أول كابشن لين {cfg['dur'] - 0.2:.1f}ث (نصّان مع بعض ما ينقرون)")
    if a.video:
        base = os.path.splitext(os.path.basename(a.video))[0]; outv = os.path.join(OUT, base + "_hook.mp4")
        fl = f"[1:v]scale={vw}:{vh},format=rgba[o];[0:v][o]overlay=0:0:eof_action=pass:format=auto,format=yuv420p[v]"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a.video, "-framerate", f"{fps:g}", "-i", fr, "-filter_complex", fl,
                        "-map", "[v]", "-map", "0:a?", "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-c:a", "copy",
                        "-movflags", "+faststart", outv], check=True)
        print(f"✓ {outv} — ⚠️ الكابشن المحروق بالريل الأصلي يبقى تحت الهوك (ما أقدر أشيله من mp4 جاهز) — لذلك الافتراضي mid بين الوجه والكابشن")
        d = cfg["dur"]; ts = [0.0, 0.3, round(d * 0.7, 2), round(d + 0.4, 2)]; files = []
        for t in ts:
            f = os.path.join(OUT, f".sh_{t:.2f}.jpg"); files.append(f)
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t}", "-i", outv, "-frames:v", "1", f], check=True)
        sheet(files, [f"{t:.2f}s" for t in ts], os.path.join(OUT, "hook_sheet.jpg"))
        for f in files: os.remove(f)

def args_for(kind, argv):
    ap = argparse.ArgumentParser(prog=f"22_hook.py {kind}"); ap.add_argument("hook"); ap.add_argument("--dur", type=float)
    ap.add_argument("--pos", default="mid" if kind == "overlay" else "auto", choices=["auto", "top", "mid", "low"])
    ap.add_argument("--style", default="bold", choices=["bold", "card"]); ap.add_argument("--kicker"); ap.add_argument("--em", action="append")
    ap.add_argument("--force", action="store_true")
    if kind == "apply": ap.add_argument("--keep-caps", action="store_true")
    else:
        ap.add_argument("--theme"); ap.add_argument("--video"); ap.add_argument("--fps", type=float)
        ap.add_argument("--pad", type=int, default=150, help="ارتفاع تلاشي الظل فوق وتحت النص (px)")
    return ap.parse_args(argv)

if __name__ == "__main__":
    argv = sys.argv[1:]
    if "--no-words" in argv: argv.remove("--no-words"); NO_WORDS = True
    if "--words" in argv:
        k = argv.index("--words"); WORDS = os.path.abspath(argv[k + 1]); del argv[k:k + 2]
        if not os.path.exists(WORDS): sys.exit(f"⛔ ملف الكلام {WORDS} مو موجود")
    if len(argv) < 2: sys.exit(__doc__)
    cmd, W = argv[0], os.path.abspath(argv[1])
    if cmd != "overlay" and not os.path.isdir(W): sys.exit(f"⛔ المجلد {W} مو موجود — عط مجلد شغل الريل (فيه caps.json)")
    if cmd == "suggest": suggest(W)
    elif cmd == "check":
        if len(argv) < 3: sys.exit("عط هوك واحد على الأقل بين علامتي تنصيص")
        bad = 0
        for h in argv[2:]: bad += bool(check(W, h)[0]); print()
        sys.exit(1 if bad else 0)
    elif cmd == "apply": apply(W, args_for("apply", argv[2:]))
    elif cmd == "overlay": overlay(W, args_for("overlay", argv[2:]))
    elif cmd == "preview": preview(W)
    elif cmd == "off": theme_rw(W, lambda th: th.pop("hook", None)); print("✓ الهوك انشال (hook-card.js يبقى بس ما يرسم شي)")
    else: sys.exit(__doc__)
