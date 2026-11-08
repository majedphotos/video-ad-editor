# -*- coding: utf-8 -*-
"""يبني توقيتات الكابشن على التايم-لاين الجديد.  python3 02_captions.py <workdir> [--no-snap] [--lead 0.10]
--no-snap  = خلّ توقيت وِسبر كما هو (الافتراضي من 6.5: بداية كل كلمة تنضبط على أول ارتفاع بموجة الصوت)
--onsets   = يطبع كم تحرّكت كل كلمة بس (فحص)
--lead S   = كرت الكابشن يطلع قبل أول كلمة بـS ثانية (الافتراضي 0.10 مثل قبل — 0 = مع الصوت بالضبط)
يقرأ: cut.json · a.json (وِسبر) · fixes.json  ← {"fix":[[كلمات الجملة 0],...], "hot":[كلمات تُظلَّل]}
عدد كلمات كل جملة في fix لازم يساوي عدد كلمات وِسبر لنفس الجملة (عشان التوقيتات تبقى مضبوطة)."""
# ── توافق ويندوز/UTF-8 (مضاف) ─────────────────────────────────────
import sys as _sys, builtins as _bi
try:
    _sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    _sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass
_real_open = _bi.open
def _utf8_open(f, mode="r", *a, **k):
    if "b" not in mode:
        k.setdefault("encoding", "utf-8")
    return _real_open(f, mode, *a, **k)
_bi.open = _utf8_open
# ──────────────────────────────────────────────────────────────────
import json, sys, os
W=os.path.abspath(sys.argv[1])
keep=json.load(open(os.path.join(W,"cut.json")))["keep"]
tr=json.load(open(os.path.join(W,"a.json")))
LEAD=float(sys.argv[sys.argv.index("--lead")+1]) if "--lead" in sys.argv else 0.10
# ═══ 🆕 6.5 توقيت الكلمة على الموجة (دليل «captions reel»): وِسبر يبدأ الكلمة قبل نطقها بحوالي 0.1 ث (وأحياناً بعده).
#     ندوّر بنافذة صغيرة حول توقيت وِسبر على أول ارتفاع بالصوت (نهاية السكتة/الحرف الهادي ← بداية الكلمة) ونحط البداية عليه.
#     الكلمة بلا ارتفاع واضح (كلام متصل) تبقى على وِسبر. --onsets = يطبع الإزاحات بس (بلا كتابة caps.json).
import subprocess
import numpy as np

SR = 16000
HOP = 80            # 5ms
WIN = 320           # 20ms
SOURCES = ["src_sdr.mov", "src_fixed.mov", "src.mov", "src.mp4"]


def find_source(W):
    for c in SOURCES:
        p = os.path.join(W, c)
        if os.path.exists(p): return p
    return ""


def load_audio(path, sr=SR):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def envelope(y):
    """طاقة بالديسبل كل 5ms (نافذة 20ms) بعد قص التردد الواطي (طنين الغرفة) — منعّمة 15ms."""
    if len(y) < WIN: return np.zeros(1)
    # هاي باس بسيط ~120Hz عشان طنين المكيف ما يغطي على بداية الكلمة
    a = np.exp(-2 * np.pi * 120 / SR); hp = np.empty_like(y); z = 0.0; px = 0.0
    for i in range(0, len(y)):                       # حلقة بايثون على 16k/ث مقبولة (ريل 60 ث ≈ ثانيتين)
        z = a * (z + y[i] - px); px = y[i]; hp[i] = z
    n = 1 + (len(hp) - WIN) // HOP
    idx = np.arange(WIN)[None, :] + HOP * np.arange(n)[:, None]
    e = np.sqrt(np.mean(hp[idx] ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(e + 1e-9)
    k = np.ones(3) / 3
    return np.convolve(db, k, mode="same")


def snap_words(words, db, back=0.08, fwd=0.20, pre=0.02, rise_min=6.0):
    """words = [[start,end],...] بثواني الصوت. يرجّع قائمة البدايات الجديدة + الإزاحات.
       back/fwd = النافذة حول توقيت وِسبر · pre = نطلّع الكلمة قبل الصوت بـ20ms (العين تحس التأخير أكثر من التبكير)
       rise_min = أقل ارتفاع (ديسبل) نعتبره «بداية كلمة» — أقل منه = كلام متصل، نخلي وِسبر."""
    fps = SR / HOP
    T = lambda t: int(round(t * fps))
    out = []; prev = -1.0
    for (s, e) in words:
        lo = max(0, T(s - back)); hi = min(len(db) - 1, T(min(s + fwd, max(s + 0.06, e - 0.04))))
        new = s
        if hi - lo >= 4:
            seg = db[lo:hi + 1]
            # الوادي: أهدى نقطة بالنص الأول من النافذة (الفاصل بين الكلمتين)
            vh = lo + max(2, int((hi - lo) * 0.7))
            v = lo + int(np.argmin(db[lo:vh]))
            peak = float(np.max(db[v:min(len(db), v + T(0.25))]))
            rise = peak - float(db[v])
            if rise >= rise_min:
                thr = db[v] + max(rise_min * 0.6, 0.30 * rise)
                j = v
                while j < hi and db[j] < thr: j += 1
                if j < hi or db[j] >= thr:
                    new = j / fps - pre
        new = max(new, prev + 0.05)                    # ترتيب الكلمات ما ينقلب
        new = min(new, e - 0.05) if e - 0.05 > prev + 0.05 else new
        out.append(round(new, 3)); prev = new
    return out


def snap_segments(segments, audio_path, **kw):
    """يعدّل a.json (segments→words→start) بمكانه ويرجّع قائمة الإزاحات (ث)."""
    db = envelope(load_audio(audio_path))
    flat = [w for s in segments for w in s.get("words", [])]
    if not flat: return []
    news = snap_words([[w["start"], w["end"]] for w in flat], db, **kw)
    sh = []
    for w, n in zip(flat, news):
        sh.append(round(n - w["start"], 3)); w["start"] = n
        if w["end"] <= n: w["end"] = round(n + 0.12, 3)
    return sh


def report(sh):
    if not sh: return "ما فيه كلمات"
    a = np.array(sh); moved = a[np.abs(a) >= 0.02]
    return (f"توقيت الموجة: {len(moved)}/{len(a)} كلمة تعدّلت · متوسط {np.mean(a)*1000:+.0f}ms · "
            f"أكبر تأخير {np.max(a)*1000:+.0f}ms · أكبر تبكير {np.min(a)*1000:+.0f}ms")


if "--no-snap" not in sys.argv:
    try:
        _src=find_source(W)
        if _src:
            _old=[(w["start"],w.get("word","")) for s in tr["segments"] for w in s.get("words",[])]
            _sh=snap_segments(tr["segments"], _src); print(report(_sh))
            if "--onsets" in sys.argv:
                for (s0,tx),d in zip(_old,_sh):
                    if abs(d)>=0.02: print(f"  {s0:7.2f} → {s0+d:7.2f}  ({d*1000:+4.0f}ms) {tx.strip()}")
                sys.exit(0)
        else: print("⚠️ توقيت الموجة: ما لقيت src.mov — باقي على توقيت وِسبر")
    except SystemExit: raise
    except Exception as _e: print("⚠️ توقيت الموجة ما اشتغل (", _e, ") — باقي على توقيت وِسبر")
fx=json.load(open(os.path.join(W,"fixes.json")))
FIX, HOT = fx["fix"], set(fx.get("hot",[]))
FXMAP = fx.get("fx", {})   # 🎬 حركات الكلمة العربية (v3.1): {"خلاص":"drop","متصلة":"type",…} — drop · shake · crack · type · pulse · stretch · slam

def seg_of(t):
    best,bd=0,1e9
    for i,(a,b) in enumerate(keep):
        if a<=t<=b: return i
        d=min(abs(t-a),abs(t-b))
        if d<bd: bd,best=d,i
    return best
off=[];acc=0.0
for a,b in keep: off.append(acc); acc+=b-a
def newt(t,si):
    a,b=keep[si]; return off[si]+(max(a,min(b,t))-a)

cards=[]
for i,seg in enumerate(tr["segments"]):
    ws=seg.get("words",[]); f=FIX[i]
    if not ws: continue
    # 🆕 v3.5 (حلقة ← ريلات): "seg" = رقم القطعة بـcut.json — لازم لما الهوك مأخوذ من وسط الجواب (القطع متداخلة بالوقت
    #    وأقرب قطعة تطلع غلط، فكابشن الجواب ينحط فوق الهوك). 20_episode_cuts.py يكتبه لحاله.
    pin=isinstance(seg.get("seg"),int)
    si=seg["seg"] if pin else seg_of((ws[0]["start"]+ws[-1]["end"])/2)
    if isinstance(f,str):
        # نص بدل قائمة = وِسبر هلوس بهالجملة (كلماته غلط وعددها ما يفيد) → الكلمات الصحيحة تتوزّع على مدة الجملة بنسبة طولها
        toks=f.split(); s0,e0=ws[0]["start"],ws[-1]["end"]; tot=sum(len(t) for t in toks) or 1; c=0; pairs=[]
        for t in toks: a0=s0+(e0-s0)*c/tot; c+=len(t); pairs.append((t,a0,s0+(e0-s0)*c/tot))
    else:
        if len(ws)!=len(f):
            sys.exit(f"❌ الجملة {i}: وِسبر {len(ws)} كلمة، fixes.json {len(f)} — لازم يتساوون (أو اكتبها نص وحدة إذا وِسبر هلوس)")
        pairs=[(txt,w["start"],w["end"]) for w,txt in zip(ws,f) if txt]   # "" = الكلمة تنشال من الكابشن (الصوت يبقى)
    if not pairs: continue
    o=[]
    for txt,ws0,we0 in pairs:
        if pin: s1,e1=newt(ws0,si),newt(we0,si)
        else:
            # 🐛 v4.0.1: كل كلمة بقطعتها هي — القص الضيّق يقسم الجملة على عدة قطع، وربطها كلها بقطعة الوسط
            #    يلصق الكلمات اللي برّاها على طرفها فالكابشن يتأخر لين ~1.5 ث
            sw=seg_of(ws0); s1,e1=newt(ws0,sw),newt(we0,max(sw,seg_of(we0)))
        if e1<=s1: e1=s1+0.12
        _w={"t":txt,"s":round(s1,3),"e":round(e1,3),"hot":txt in HOT or txt in FXMAP}
        if txt in FXMAP: _w["fx"]=FXMAP[txt]
        o.append(_w)
    a,b=keep[si]; lo,hi=(off[si],off[si]+(b-a)) if pin else (0.0,acc)
    cs=max(o[0]["s"]-LEAD, lo)   # التبكير اختيار (--lead) — الافتراضي 0.10 مثل قبل
    ce=min(max(x["e"] for x in o)+0.45, hi)   # 6.1 (ماجد 20 أكتوبر): الكابشن يقعد 0.45 ث بعد آخر كلمة لو بعده سكتة (كان 0.28) — والجاي يقصّه تحت
    cards.append({"s":round(cs,3),"e":round(ce,3),"w":o})
cards.sort(key=lambda c:c["s"])
for i in range(len(cards)-1):
    if cards[i]["e"]>cards[i+1]["s"]: cards[i]["e"]=round(cards[i+1]["s"]-0.02,3)
_tail=float(json.load(open(os.path.join(W,"cut.json"))).get("tail",0) or 0)
json.dump({"total":round(acc+_tail,3),"cards":cards},open(os.path.join(W,"caps.json"),"w"),ensure_ascii=False,indent=1)
print("كروت:",len(cards)," المدة:",round(acc,2))
for c in cards: print(f"{c['s']:6.2f}-{c['e']:6.2f}  "+" ".join(x['t'] for x in c['w']))
