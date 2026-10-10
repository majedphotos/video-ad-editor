# -*- coding: utf-8 -*-
"""مونتاج داخل كاب كت — بدل MP4 يكتب مشروع كاب كت قابل للتعديل:
لقطات + زوم كيفريمات + نصوص/كابشن كاب كت + فويس منظّف + مؤثرات + خلفية صوتية + طبقات موشن ProRes 4444 شفافة.
الشرح الكامل والصيغة ← references/capcut.md

  python3 40_capcut.py projects                         ← مشاريع كاب كت الموجودة (اسم المجلد = --draft)
  python3 40_capcut.py skeleton <work> <plan.json>      ← خطة أولية من cut.json + تفريغ وِسبر (a.json) — عدّلها بعدين
  python3 40_capcut.py check  <plan.json>               ← يحسب الخط الزمني ويطبع اللقطات (بلا رسم ولا كتابة)
  python3 40_capcut.py stills <plan.json> [اسم]          ← لقطتين PNG من كل موشن عشان تعرضها قبل الرسم
  python3 40_capcut.py render <plan.json> [اسم]          ← يرسم الموشن ProRes 4444 بشفافية
  python3 40_capcut.py sfx    <plan.json>               ← لوحة المؤثرات (ملف لكل مؤثر = مقطع مستقل بكاب كت)
  python3 40_capcut.py write  <plan.json> [--draft-dir D] ← يكتب المشروع (كاب كت لازم يكون مسكّر)
  python3 40_capcut.py all    <plan.json>               ← sfx + render + write

كاب كت ماك بساندبوكس: يقرا ~/Movies بس → كل الأصول المولّدة والمنسوخة تنحط بـ~/Movies/capcut-<name>/.
القالب (حقول كاب كت نسخة 183) والموشن HTML وراسمه مدمجين هني عشان البلقن يبقى تحت حد الملفات.
"""
import sys as _sys, builtins as _bi
try:
    _sys.stdout.reconfigure(encoding="utf-8", errors="replace"); _sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass
_real_open = _bi.open
def _utf8_open(f, mode="r", *a, **k):
    if "b" not in mode: k.setdefault("encoding", "utf-8")
    return _real_open(f, mode, *a, **k)
_bi.open = _utf8_open
import json, os, re, sys, copy, uuid, shutil, subprocess, base64, zlib, time, glob, platform
from pathlib import Path

HERE = Path(__file__).resolve().parent            # scripts/
SKILL = HERE.parent
FONTS_DIR = SKILL / "motion" / "fonts"
FPS = 30
IS_MAC = platform.system() == "Darwin"
PHOTO_EXT = (".jpg", ".jpeg", ".png", ".heic", ".webp", ".tif", ".tiff")

def die(m): print("⛔ " + m); sys.exit(1)

# ════════════════════════ 1) الخطة → خط زمني بالثواني ════════════════════════
def load_plan(p):
    p = Path(p).resolve(); P = json.load(open(p)); P["_dir"] = str(p.parent)
    if not P.get("name"): die("الخطة ناقصها name")
    return P

def work_dir(P):
    base = Path.home() / "Movies"
    if not base.exists(): base = Path(P["_dir"])
    w = base / ("capcut-" + P["name"]); w.mkdir(parents=True, exist_ok=True); return w

def absp(P, f):
    f = os.path.expanduser(str(f)); return f if os.path.isabs(f) else os.path.join(P["_dir"], f)

def sandbox_copy(P, f):
    """كاب كت ماك ما يقرا برّا ~/Movies → ننسخ الوسائط لمجلد الشغل (مرة وحدة)."""
    f = absp(P, f)
    if not os.path.exists(f): die("الملف مو موجود: " + f)
    if not IS_MAC or str(Path(f).resolve()).startswith(str((Path.home() / "Movies").resolve())): return f
    dst = work_dir(P) / "media" / os.path.basename(f); dst.parent.mkdir(exist_ok=True)
    if not dst.exists() or dst.stat().st_size != os.path.getsize(f): shutil.copy2(f, dst)
    return str(dst)

def silence_bounds(f, a, b):
    """أول وآخر لحظة كلام فعلي داخل [a,b] — وِسبر يقدّم ويأخّر، كاشف السكتات أدق."""
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-ss", str(a), "-t", str(b - a), "-i", f, "-af",
                          "silencedetect=noise=-35dB:d=0.08", "-f", "null", "-"], capture_output=True, text=True).stderr
    ev = [(m.group(1), float(m.group(2))) for m in re.finditer(r"silence_(start|end): ([0-9.]+)", out)]
    on, end = 0.0, b - a
    if ev and ev[0][0] == "end" and ev[0][1] < 0.6: on = ev[0][1]
    elif len(ev) > 1 and ev[0][0] == "start" and ev[0][1] < 0.02 and ev[1][0] == "end" and ev[1][1] < 0.6: on = ev[1][1]
    if ev and ev[-1][0] == "start" and (b - a) - ev[-1][1] < 0.6: end = ev[-1][1]
    return a + on, a + end

def group_words(words, max_w=3, max_c=18, pause=0.35):
    g, out = [], []
    for w in words:
        if g and (len(g) >= max_w or len(" ".join(x[0] for x in g + [w])) > max_c or w[1] - g[-1][2] > pause):
            out.append(g); g = []
        g.append(w)
    if g: out.append(g)
    return out

def resolve(P):
    """يحسب كل الأوقات: مقاطع الكلام ورا بعض، الكابشن، اللقطات، الموشن، المؤثرات."""
    gap0 = P.get("gap", 0.22); emph = set(P.get("emph", []))
    R = {"speech": [], "captions": [], "visuals": [], "overlays": [], "sfx": [], "titles": []}
    t = 0.0; starts = {}; segs = {}
    last_gap = 0.0
    for s in P["speech"]:
        key = s["key"]
        if "pause" in s:
            starts[key] = t; segs[key] = dict(at=t, dur=s["pause"], words={}); t += s["pause"]; last_gap = 0.0; continue
        f = sandbox_copy(P, s["file"]); off = s.get("off", 0.0); a, b = s["a"], s["b"]; dur = b - a
        words = [tuple(w) for w in s["words"]]
        if s.get("text"):
            fx = s["text"].split()
            if len(fx) != len(words): die(f"{key}: عدد كلمات التصحيح {len(fx)} ≠ كلمات وِسبر {len(words)}")
            words = [(x, w[1], w[2]) for x, w in zip(fx, words)]
        if "on" in s: on, end = s["on"], s["end"]
        elif s.get("tighten", True): on, end = silence_bounds(f, a - off, b - off); on += off; end += off
        else: on, end = words[0][1], words[-1][2]
        ws, we = words[0][1], words[-1][2]
        wm = (lambda x: on + (x - ws) * (end - on) / (we - ws)) if we > ws else (lambda x: x)
        tw = [(w, wm(x) - a + t, wm(y) - a + t) for w, x, y in words]
        starts[key] = t; segs[key] = dict(at=t, dur=dur, a=a, words=tw)
        R["speech"].append(dict(key=key, file=f, src=a - off, dur=dur, at=t))
        if s.get("groups"):
            gl = s["groups"]
            if sum(gl) != len(tw): die(f"{key}: مجموع groups {sum(gl)} ≠ عدد الكلمات {len(tw)}")
            grp, i = [], 0
            for n in gl: grp.append(tw[i:i + n]); i += n
        else:
            grp = group_words(tw)
        for gi, g in enumerate(grp):
            st = max(t, g[0][1] - 0.06)
            if gi + 1 < len(grp):
                en = grp[gi + 1][0][1] - 0.06
                if grp[gi + 1][0][1] - g[-1][2] > 0.45: en = g[-1][2] + 0.25
            else: en = min(t + dur, g[-1][2] + 0.25)
            R["captions"].append(dict(words=[w for w, _, _ in g], emph=[w in emph for w, _, _ in g], start=st, end=max(en, st + 0.3)))
        last_gap = s.get("gap", gap0)
        t += dur + last_gap
    total = t - last_gap + P.get("tail", 0.25)
    R["total"] = total

    def T(ref):
        """وقت من مرجع: رقم · "end" · "KEY" · "KEY>" (نهايته) · "KEY:كلمة" · "KEY:كلمة#2" · "KEY:كلمة>" (نهاية الكلمة) + إزاحة "+0.2"/"-0.05"."""
        if isinstance(ref, (int, float)): return float(ref)
        m = re.match(r"^(.*?)([+-]\d+(?:\.\d+)?)?$", ref.strip()); base, d = m.group(1), float(m.group(2) or 0)
        if base == "end": return total + d
        endw = base.endswith(">"); base = base.rstrip(">")
        if ":" not in base:
            if base not in segs: die("مرجع مو معروف: " + ref)
            return segs[base]["at"] + (segs[base]["dur"] if endw else 0) + d
        k, w = base.split(":", 1); n = 1
        if "#" in w: w, n = w.rsplit("#", 1); n = int(n)
        hits = [x for x in segs.get(k, {}).get("words", []) if x[0] == w]
        if len(hits) < n: die(f"الكلمة «{w}» مو بالمقطع {k} (مرجع {ref})")
        return hits[n - 1][2 if endw else 1] + d
    R["T"] = T

    # اللقطات ورا بعض: كل وحدة لين «to» (مرجع) أو «dur»، والأخيرة لين النهاية
    cur = 0.0; vis = P["visuals"]
    for i, v in enumerate(vis):
        end = T(v["to"]) if "to" in v else (cur + v["dur"] if "dur" in v else total)
        if i == len(vis) - 1 and "to" not in v and "dur" not in v: end = total
        d = end - cur
        if d <= 0.04: die(f"اللقطة {i+1} ({v.get('label', v['file'])}) مدتها {d:.2f} — راجع to")
        f = sandbox_copy(P, v["file"]); src = float(v.get("src", 0.0))
        if v.get("sync"):   # فيديو الكلام نفسه: المصدر يمشي مع الصوت
            sp = next((s for s in R["speech"] if s["at"] - 1e-6 <= cur < s["at"] + s["dur"]), None)
            if not sp: die(f"اللقطة {i+1} sync بس ما تبدأ داخل مقطع كلام")
            src = sp["src"] + (cur - sp["at"]) + float(v.get("src", 0.0))
        speed = (v["span"] / d) if v.get("span") else float(v.get("speed", 1.0))
        kind = "photo" if f.lower().endswith(PHOTO_EXT) else "video"
        R["visuals"].append(dict(file=f, at=cur, src=src, dur=d, speed=speed, kind=kind, zoom=v.get("zoom", "in" if i % 2 == 0 else "out"),
                                 fit=v.get("fit", "fill"), mute=v.get("mute", True), label=v.get("label", "")))
        cur = end
    if abs(cur - total) > 0.05: print(f"⚠️ اللقطات تخلص عند {cur:.2f} والمشروع {total:.2f} — آخر لقطة بلا to تعبّي الباقي")

    for o in P.get("overlays", []):
        at = T(o["at"]); dur = (T(o["to"]) - at) if "to" in o else o.get("dur", 2.2)
        q = {k: v for k, v in o.items() if k not in ("at", "to", "dur", "marks")}
        q.update(at=at, dur=dur, name=o.get("name") or f'{o["type"]}{len(R["overlays"]) + 1}')
        mk = o.get("marks", {})
        q["marks"] = {k: ([T(x) - at for x in v] if isinstance(v, list) else T(v) - at) for k, v in mk.items()}
        if o.get("html"): q["html"] = absp(P, o["html"])
        R["overlays"].append(q)
    if len({o["name"] for o in R["overlays"]}) != len(R["overlays"]): die("أسماء الموشن (name) لازم تكون مختلفة")

    for ti in P.get("titles", []):
        st = T(ti.get("at", 0.0)); R["titles"].append(dict(text=ti["text"], emph=ti.get("emph", []), start=st, end=T(ti["to"]),
                                                          y=ti.get("y", 0.60), size=ti.get("size", 17)))
    sw = work_dir(P) / "sfx"
    add = lambda n, at, v: R["sfx"].append(dict(file=str(sw / (n + ".wav")), name=n, at=round(max(0.0, at), 3), vol=v))
    if P.get("auto_sfx", True):
        if R["titles"]: add("whoosh_up", R["titles"][0]["start"] + 0.05, 0.55); add("pop", R["titles"][0]["start"] + 0.25, 0.5)
        for o in R["overlays"]:
            if o["type"] in ("badge", "card"): add("whoosh_up", o["at"] - 0.05, 0.5); add("pop", o["at"] + 0.18, 0.45)
    for s in P.get("sfx", []):
        if s["s"] not in SFX_NAMES: die(f"مؤثر مو معروف {s['s']} — المتاح: {' '.join(SFX_NAMES)}")
        add(s["s"], T(s["at"]), s.get("vol", 0.5))
    R["sfx"].sort(key=lambda x: x["at"])
    R["bg"] = dict(file=sandbox_copy(P, P["bg"]["file"]), vol=P["bg"].get("vol", 0.13)) if P.get("bg") else None
    R["starts"] = starts
    return R

def cmd_check(P, R=None, quiet=False):
    R = R or resolve(P)
    w = work_dir(P); out = {k: v for k, v in R.items() if k != "T"}
    json.dump(out, open(w / "plan.resolved.json", "w"), ensure_ascii=False, indent=1)
    if quiet: return R
    print(f"المدة {R['total']:.2f}ث · لقطات {len(R['visuals'])} · كابشن {len(R['captions'])} · موشن {len(R['overlays'])} · مؤثرات {len(R['sfx'])}")
    for v in R["visuals"]:
        print(f"  {v['at']:6.2f}  {v['dur']:5.2f}ث  سرعة {v['speed']:.2f}  {v['zoom'] or '-':>3}  {os.path.basename(v['file'])}  {v['label']}")
    for o in R["overlays"]: print(f"  موشن {o['name']:<10} {o['at']:6.2f} → {o['at'] + o['dur']:6.2f}")
    print("✓ كتبت", w / "plan.resolved.json")
    return R

# ════════════════════════ 2) الهوية من ثيم المستخدم ════════════════════════
def theme(P):
    t = P.get("theme") or {}
    tdir = P["_dir"]
    if isinstance(t, str):
        tp = absp(P, t); tdir = os.path.dirname(tp); t = json.load(open(tp))
    t = dict(t); t.setdefault("acc", "#F2B33D"); t.setdefault("ink", "#1B1B22"); t.setdefault("bg", "#FFFFFF"); t.setdefault("mut", "#6C718A")
    t.setdefault("font", "Tajawal")
    if t.get("logo"):
        lg = t["logo"] if os.path.isabs(os.path.expanduser(t["logo"])) else os.path.join(tdir, t["logo"])
        t["logo"] = os.path.expanduser(lg) if os.path.exists(os.path.expanduser(lg)) else None
    return t

def font_files(name):
    """(عريض، أعرض) من خطوط السكل: Bold/Black، أو الملف المتغيّر VF للثنتين."""
    fs = {Path(f).stem.lower(): f for f in glob.glob(str(FONTS_DIR / "*.ttf"))}
    n = name.replace(" ", "").lower()
    pick = lambda *sfx: next((fs[n + s] for s in sfx if n + s in fs), None)
    bold = pick("-bold", "-vf", "-black", "-regular"); black = pick("-black", "-vf", "-bold", "-regular")
    if not bold:
        print(f"⚠️ الخط {name} مو بخطوط السكل — بستخدم Tajawal"); return font_files("Tajawal")
    return bold, black

def hex2rgb(h):
    h = h.lstrip("#"); return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]

def prepare_assets(P):
    """ينسخ الخط والشعار لمجلد الشغل (كاب كت والراسم يقرونهم من هني)."""
    w = work_dir(P); th = theme(P); (w / "fonts").mkdir(exist_ok=True)
    b, k = font_files(th["font"]); fb, fk = w / "fonts" / os.path.basename(b), w / "fonts" / os.path.basename(k)
    for s, d in ((b, fb), (k, fk)):
        if not d.exists(): shutil.copy2(s, d)
    lg = None
    if th.get("logo"):
        lg = w / ("logo" + Path(th["logo"]).suffix.lower()); shutil.copy2(th["logo"], lg)
    return th, str(fb), str(fk), (lg.name if lg else None)

# ════════════════════════ 3) الموشن: HTML شفاف → ProRes 4444 ════════════════════════
OVERLAY_HTML = r"""<!doctype html>
<html dir="rtl"><head><meta charset="utf-8">
<style>
@font-face{font-family:Brand;src:url("../fonts/__FB__");font-weight:700}
@font-face{font-family:Brand;src:url("../fonts/__FK__");font-weight:900}
:root{--acc:__ACC__;--ink:__INK__;--mut:__MUT__;--card:__CARD__}
html,body{margin:0;width:1080px;height:1920px;background:transparent;overflow:hidden;font-family:Brand;font-weight:700}
.l{position:absolute;inset:0;display:none}
.card{position:absolute;background:var(--card);border-radius:44px;box-shadow:0 24px 60px rgba(0,0,0,.28)}
#badge .card{top:250px;left:50%;height:150px;display:flex;align-items:center;gap:28px;padding:0 54px 0 22px;border-radius:80px}
#badge .num{width:112px;height:112px;border-radius:50%;background:var(--acc);color:__ONACC__;font-weight:900;font-size:80px;display:flex;align-items:center;justify-content:center;line-height:1;padding-top:8px;box-sizing:border-box}
#badge .lab{color:var(--mut);font-size:34px;line-height:1}
#badge .tit{color:var(--ink);font-size:50px;font-weight:900;line-height:1.15;white-space:nowrap}
#roll .card{top:230px;left:50%;width:560px;height:300px;margin-left:-280px;text-align:center;overflow:hidden}
#roll .lab{color:var(--mut);font-size:40px;margin-top:34px}
#roll .win{position:relative;height:170px;overflow:hidden;margin-top:6px}
#roll .it{position:absolute;left:0;right:0;font-size:150px;font-weight:900;color:var(--acc);line-height:170px;direction:ltr}
#card .card{top:380px;left:90px;width:900px;height:920px;text-align:center;transform-origin:50% 40%}
#card .logo{position:absolute;top:60px;left:50%;width:420px;max-height:150px;object-fit:contain;margin-left:-210px}
#card .big{position:absolute;top:215px;left:0;right:0;font-size:290px;font-weight:900;color:var(--acc);direction:ltr;line-height:1}
#card .line{position:absolute;top:525px;left:0;right:0;font-size:66px;font-weight:900;color:var(--ink)}
#card .chips{position:absolute;top:640px;left:0;right:0;display:flex;justify-content:center;gap:28px}
#card .chip{background:color-mix(in srgb,var(--acc) 12%,var(--card));color:var(--acc);border:4px solid var(--acc);border-radius:60px;font-size:50px;font-weight:900;padding:14px 46px 8px}
#card .foot{position:absolute;bottom:52px;left:0;right:0;font-size:52px;color:var(--ink)}
.tit,.lab,.line,.chip,.foot,.txt,.it{unicode-bidi:plaintext}
#endcard .card{top:250px;left:50%;height:130px;padding:0 44px;display:flex;align-items:center;gap:30px;border-radius:70px;direction:ltr}
#endcard img{height:56px;max-width:300px;object-fit:contain}
#endcard .sep{width:4px;height:60px;background:color-mix(in srgb,var(--ink) 15%,transparent);border-radius:2px}
#endcard .txt{white-space:nowrap;font-size:46px;font-weight:900;color:var(--acc);direction:rtl}
</style></head><body>
<div class="l" id="badge"><div class="card"><div class="num">1</div><div><div class="lab"></div><div class="tit"></div></div></div></div>
<div class="l" id="roll"><div class="card"><div class="lab"></div><div class="win"></div></div></div>
<div class="l" id="card"><div class="card"><img class="logo"><div class="big"><span class="n"></span><span class="s"></span></div>
 <div class="line"></div><div class="chips"></div><div class="foot"></div></div></div>
<div class="l" id="endcard"><div class="card"><img><div class="sep"></div><div class="txt"></div></div></div>
<script>
const LOGO=__LOGO__;
const cl=(x,a=0,b=1)=>Math.min(b,Math.max(a,x)), eo=x=>1-Math.pow(1-cl(x),3);
const back=x=>{x=cl(x);const c=1.9;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)};
const prog=(t,a,d)=>cl((t-a)/d), $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function show(id){$$('.l').forEach(e=>e.style.display=e.id===id?'block':'none')}
function io(el,t,dur,{inD=.38,outD=.28,base=''}={}){const pi=back(prog(t,0,inD)),po=eo(prog(t,dur-outD,outD));
  el.style.opacity=cl(prog(t,0,inD*.6))*(1-po);el.style.transform=`${base} translateY(${-60*po}px) scale(${(.55+.45*pi)*(1-.08*po)})`;}
window.setup=o=>{window.O=o;show(o.type);const m=o.marks||{};
  if(o.type==='badge'){$('#badge .num').textContent=o.n||'';$('#badge .lab').textContent=o.label||'';$('#badge .tit').textContent=o.title||'';
    if(!o.n)$('#badge .num').style.display='none';}
  if(o.type==='roll'){$('#roll .lab').textContent=o.label||'';$('#roll .win').innerHTML=(o.items||[]).map(x=>`<div class="it">${x}</div>`).join('');}
  if(o.type==='card'){const lg=$('#card .logo');if(LOGO&&o.logo!==false)lg.src=LOGO;else lg.style.display='none';
    const mm=String(o.big||'').match(/^([^0-9]*)([0-9]+)(.*)$/);window.BIG=mm?{p:mm[1],n:+mm[2],s:mm[3]}:null;
    $('#card .big .n').textContent=mm?'':(o.big||'');$('#card .line').textContent=o.line||'';$('#card .foot').textContent=o.foot||'';
    $('#card .chips').innerHTML=(o.chips||[]).map(c=>`<div class="chip">${c}</div>`).join('');}
  if(o.type==='endcard'){const im=$('#endcard img');if(LOGO&&o.logo!==false)im.src=LOGO;else{im.style.display='none';$('#endcard .sep').style.display='none'}
    $('#endcard .txt').textContent=o.text||'';}
};
window.render=t=>{const o=window.O,d=o.dur,m=o.marks||{};
  if(o.type==='badge'){io($('#badge .card'),t,d,{base:'translateX(-50%)'});$('#badge .num').style.transform=`rotate(${(1-eo(prog(t,.1,.5)))*-120}deg)`;}
  if(o.type==='roll'){io($('#roll .card'),t,d);const k=[0,...(m.items||[])],E=$$('#roll .it');
    E.forEach((e,i)=>{const pin=i===0?1:eo(prog(t,k[i]??1e9,.32)),pout=i===E.length-1?0:eo(prog(t,k[i+1]??1e9,.32));
      e.style.transform=`translateY(${(1-pin)*170-pout*170}px)`;e.style.opacity=(i===0?1:pin)*(1-pout);});}
  if(o.type==='card'){const c=$('#card .card'),a=m.in??0,pi=back(prog(t,a,.45)),po=eo(prog(t,d-.3,.3));
    c.style.opacity=cl(prog(t,a,.2))*(1-po);c.style.transform=`scale(${(.7+.3*pi)*(1-.06*po)}) translateY(${-50*po}px)`;
    $('#card .logo').style.transform=`scale(${.4+.6*back(prog(t,a+.2,.4))})`;
    const b0=m.big??a+.3,b1=m.big_end??b0+.8,pp=prog(t,b0,Math.max(.2,b1-b0)),B=$('#card .big');B.style.opacity=cl(pp*4);
    if(window.BIG){$('#card .big .n').textContent=window.BIG.p+Math.round(window.BIG.n*eo(pp));$('#card .big .s').textContent=window.BIG.s;}
    B.style.transform=`scale(${1+.12*Math.sin(Math.PI*prog(t,b1,.4))})`;
    const L=$('#card .line'),q=eo(prog(t,m.line??b1,.35));L.style.opacity=q;L.style.transform=`translateY(${(1-q)*30}px)`;
    $$('#card .chip').forEach((e,i)=>{const s=(m.chips||[])[i]??(b1+.3+.3*i),bb=back(prog(t,s,.38));e.style.opacity=cl(prog(t,s,.15));e.style.transform=`scale(${.3+.7*bb})`});
    const F=$('#card .foot'),r=eo(prog(t,m.foot??(d-1.4),.4));F.style.opacity=r;F.style.transform=`translateY(${(1-r)*40}px)`;}
  if(o.type==='endcard'){io($('#endcard .card'),t-.15,d-.15,{base:'translateX(-50%)'});}
};
</script></body></html>"""

RENDER_JS = r"""// يرسم كل موشن فريم فريم بخلفية شفافة ثم ProRes 4444 بقناة شفافية — كاب كت يقبلها طبقة فوق
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process'),{pathToFileURL}=require('url');
const [W,SKILL,only,mode]=process.argv.slice(2), FPS=30;
function pup(){for(const p of [process.env.PUPPETEER_PATH,path.join(SKILL,'node_modules/puppeteer-core'),'puppeteer-core','puppeteer',path.join(process.cwd(),'node_modules/puppeteer-core')]){
  if(!p)continue;try{return require(p)}catch(e){}}throw new Error('ما لقيت puppeteer-core — ثبّته بمجلد السكل: npm i puppeteer-core');}
function chrome(){if(process.env.CHROME_PATH)return process.env.CHROME_PATH;const LA=process.env.LOCALAPPDATA||'',PF=process.env.ProgramFiles||'C:/Program Files';
  for(const c of ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',PF+'/Google/Chrome/Application/chrome.exe',LA+'/Google/Chrome/Application/chrome.exe',
    PF+'/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'])if(c&&fs.existsSync(c))return c;
  throw new Error('ما لقيت كروم — حدّد CHROME_PATH');}
const plan=JSON.parse(fs.readFileSync(path.join(W,'plan.resolved.json'),'utf8'));
(async()=>{
  const br=await pup().launch({executablePath:chrome(),headless:'new',args:['--no-sandbox','--allow-file-access-from-files','--font-render-hinting=none','--force-color-profile=srgb']});
  const pg=await br.newPage();pg.on('pageerror',e=>console.error('[موشن] '+e.message));
  await pg.setViewport({width:1080,height:1920,deviceScaleFactor:1});let cur='';
  fs.mkdirSync(path.join(W,'overlays'),{recursive:true});fs.mkdirSync(path.join(W,'stills'),{recursive:true});
  for(const o of plan.overlays){
    if(only&&only!=='all'&&o.name!==only)continue;
    const page=o.html||path.join(W,'_capcut','overlay.html');
    if(page!==cur){await pg.goto(pathToFileURL(page).href,{waitUntil:'networkidle0'});await pg.evaluate(()=>document.fonts.ready);cur=page;}
    await pg.evaluate(o=>window.setup(o),o);
    const N=Math.round(o.dur*FPS),dir=path.join(W,'_capcut','frames',o.name);
    if(mode==='stills'){for(const f of [0.5,0.9]){await pg.evaluate(t=>window.render(t),Math.round(N*f)/FPS);
      await pg.screenshot({path:path.join(W,'stills',`${o.name}_${Math.round(f*100)}.png`),omitBackground:true});}console.log('✓',o.name,'لقطتين');continue;}
    fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});
    for(let i=0;i<N;i++){await pg.evaluate(t=>window.render(t),i/FPS);await pg.screenshot({path:path.join(dir,String(i).padStart(4,'0')+'.png'),omitBackground:true});}
    execFileSync('ffmpeg',['-v','error','-y','-framerate',String(FPS),'-i',path.join(dir,'%04d.png'),'-c:v','prores_ks','-profile:v','4444',
      '-pix_fmt','yuva444p10le','-vendor','apl0',path.join(W,'overlays',o.name+'.mov')]);
    fs.rmSync(dir,{recursive:true,force:true});console.log('✓',o.name,N,'فريم');
  }
  await br.close();
})().catch(e=>{console.error('⛔',e.message);process.exit(1)});
"""

def write_renderer(P):
    w = work_dir(P); th, fb, fk, logo = prepare_assets(P); (w / "_capcut").mkdir(exist_ok=True)
    acc = th["acc"]; on_acc = th.get("onAcc") or "#FFFFFF"
    card = th.get("card") or ("#FFFFFF" if sum(hex2rgb(th["bg"])) > 1.5 else th["bg"])
    ink = th["ink"] if card != "#FFFFFF" or sum(hex2rgb(th["ink"])) < 1.5 else "#1B1B22"
    html = (OVERLAY_HTML.replace("__FB__", os.path.basename(fb)).replace("__FK__", os.path.basename(fk))
            .replace("__ACC__", acc).replace("__INK__", ink).replace("__MUT__", th["mut"]).replace("__CARD__", card)
            .replace("__ONACC__", on_acc).replace("__LOGO__", json.dumps("../" + logo if logo else None)))
    (w / "_capcut" / "overlay.html").write_text(html, encoding="utf-8")
    (w / "_capcut" / "render.js").write_text(RENDER_JS, encoding="utf-8")
    return w

def cmd_render(P, only="all", mode="video"):
    R = cmd_check(P, quiet=True); w = write_renderer(P)
    if not R["overlays"]: print("ما فيه موشن بالخطة"); return
    if mode != "stills" and "prores_ks" not in subprocess.run(["ffmpeg", "-hide_banner", "-encoders"], capture_output=True, text=True).stdout:
        die("ffmpeg هذا ما فيه prores_ks — الموشن الشفاف يحتاجه")
    env = dict(os.environ, NODE_PATH=os.pathsep.join([str(SKILL / "node_modules"), os.environ.get("NODE_PATH", "")]))
    r = subprocess.run(["node", str(w / "_capcut" / "render.js"), str(w), str(SKILL), only, mode], env=env)
    if r.returncode: die("الرسم فشل — شوف الرسالة فوق (لا تعيده قبل ما تعرف السبب)")
    if mode == "stills": print("🖼  اللقطات بـ", w / "stills")

# ════════════════════════ 4) المؤثرات: من لوحة 05_sfx.py ════════════════════════
SFX_NAMES = ["whoosh_up", "whoosh_down", "pop", "thud", "tap", "click", "shimmer", "sub", "riser", "glitch", "shutter", "counter"]

def cmd_sfx(P):
    import numpy as np, wave
    src = open(HERE / "05_sfx.py").read()
    a, b = src.index("def lp("), src.index('for te,d0 in _s.get("riser"')
    g = {"np": np, "SR": 48000, "rng": np.random.RandomState(11)}
    exec(src[a:b].replace("W1=whoosh(0.34,True); W2=whoosh(0.30,False); TH=thud(); TP=tap()", ""), g)
    SR = 48000; out = work_dir(P) / "sfx"; out.mkdir(exist_ok=True)
    def save(n, s, peak=0.7):
        s = np.asarray(s, float); s = s / (np.max(np.abs(s)) + 1e-9) * peak; s = np.concatenate([s, np.zeros(int(0.05 * SR))])
        with wave.open(str(out / f"{n}.wav"), "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((s * 32767).astype(np.int16).tobytes())
    def mix(parts, dur):
        o = np.zeros(int(dur * SR))
        for sig, t, k in parts:
            i = int(t * SR); j = min(len(o), i + len(sig)); o[i:j] += sig[:j - i] * k
        return o
    G = g
    save("whoosh_up", G["whoosh"](0.34, True)); save("whoosh_down", G["whoosh"](0.30, False)); save("pop", G["pop"]())
    save("thud", G["thud"]()); save("tap", G["tap"]()); save("click", G["click"]()); save("shimmer", G["shimmer"]())
    save("sub", G["sub"](), 0.9); save("riser", G["riser"](1.2)); save("glitch", G["glitch"]())
    save("shutter", mix([(G["click"](0.03), 0, 1.0), (G["tap"](0.07), 0.002, 0.7), (G["click"](0.03), 0.075, 0.8), (G["tap"](0.06), 0.077, 0.5)], 0.2))
    tk = [(G["tick"](2200 + i * 50), np.log2(1 / (1 - i / 16.0)) / 8.0 * 1.4, 1.0) for i in range(1, 16)]
    save("counter", mix(tk, 1.6), 0.5)
    print("✓ المؤثرات بـ", out, "—", " ".join(SFX_NAMES))

# ════════════════════════ 5) كاتب مشروع كاب كت ════════════════════════
# حقول كاب كت (draft نسخة 183.0.0، كاب كت 9.x) من مشروع حقيقي فيه نص + كيفريمات + صوت — بلا أي مسار أو محتوى شخصي.
# لفكّه وتشوفه:  python3 40_capcut.py dump-template
TEMPLATE = "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"
REF = json.loads(zlib.decompress(base64.b64decode(TEMPLATE)).decode())

def capcut_roots():
    h = Path.home(); r = []
    if IS_MAC:
        r += [h / "Library/Containers/com.lemon.lvoverseas/Data/Movies/CapCut/User Data/Projects/com.lveditor.draft",
              h / "Movies/CapCut/User Data/Projects/com.lveditor.draft"]
    if os.environ.get("LOCALAPPDATA"): r.append(Path(os.environ["LOCALAPPDATA"]) / "CapCut/User Data/Projects/com.lveditor.draft")
    return [x for x in r if x.exists()]

def capcut_running():
    try:
        if platform.system() == "Windows":
            return "CapCut.exe" in subprocess.run(["tasklist"], capture_output=True, text=True).stdout
        return subprocess.run(["pgrep", "-x", "CapCut"], capture_output=True).returncode == 0
    except Exception:
        return False

def cmd_projects():
    roots = capcut_roots()
    if not roots: print("ما لقيت مجلد مشاريع كاب كت — افتح كاب كت مرة وسوّ مشروع فاضي"); return
    for r in roots:
        print("📁", r)
        for d in sorted(r.iterdir(), key=lambda x: -x.stat().st_mtime)[:20]:
            if (d / "draft_info.json").exists():
                try: v = json.load(open(d / "draft_info.json")).get("new_version", "?")
                except Exception: v = "؟"
                print(f"   {d.name:<30} نسخة {v}")

us = lambda s: int(round(s * 1_000_000))
uid = lambda: str(uuid.uuid4()).upper()

def probe(path):
    if path.lower().endswith(PHOTO_EXT):
        w = h = None
        if IS_MAC:
            o = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", "-g", "orientation", path], capture_output=True, text=True).stdout
            m = dict(re.findall(r"(pixelWidth|pixelHeight|orientation): (\S+)", o))
            if "pixelWidth" in m:
                w, h = int(m["pixelWidth"]), int(m["pixelHeight"])
                if m.get("orientation") in ("5", "6", "7", "8"): w, h = h, w
        if not w:
            try:
                from PIL import Image, ImageOps
                im = ImageOps.exif_transpose(Image.open(path)); w, h = im.size
            except Exception:
                w, h = 1080, 1920
        return w, h, 10_800_000_000, False
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                   "stream=width,height:stream_side_data=rotation:stream_tags=rotate:format=duration", "-of", "json", path],
                                  capture_output=True, text=True).stdout)
    s = j["streams"][0]; w, h = s["width"], s["height"]
    rot = [abs(int(float(sd.get("rotation", 0)))) for sd in s.get("side_data_list", [])] + [abs(int(s.get("tags", {}).get("rotate", 0)))]
    if 90 in rot or 270 in rot: w, h = h, w
    ha = bool(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", path],
                             capture_output=True, text=True).stdout.strip())
    return w, h, us(float(j["format"]["duration"])), ha

def adur(path):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True).stdout)

def build_draft(P, R, D):
    th, FONT, FONT_B, _ = prepare_assets(P); ACC = hex2rgb(th["acc"])
    base = json.load(open(D / "draft_info.json"))
    if base.get("new_version") not in (None, "183.0.0"):
        print(f"⚠️ المشروع نسخة {base.get('new_version')} والقالب من 183 — لو كاب كت ما فتحه، رجّع النسخة الاحتياطية وبلّغني")
    M = {k: [] for k in ["videos", "audios", "texts", "speeds", "canvases", "placeholder_infos", "sound_channel_mappings",
                         "vocal_separations", "material_colors", "material_animations", "beats", "audio_fades"]}
    for k, v in base.get("materials", {}).items():
        if k not in M: M[k] = v

    def mk(kind, **kw):
        o = copy.deepcopy(REF[kind]); o["id"] = uid(); o.update(kw); return o
    def add(kind, o): M[kind].append(o); return o["id"]
    def kf(prop, pts):
        return {"id": uid(), "keyframe_list": [{"curveType": "Line", "graphID": "", "id": uid(), "left_control": {"x": 0.0, "y": 0.0},
                 "right_control": {"x": 0.0, "y": 0.0}, "string_value": "", "time_offset": us(t), "values": [v]} for t, v in pts],
                "material_id": "", "property_type": prop}
    def vrefs():
        return [add(k, mk(k)) for k in ("speeds", "placeholder_infos", "canvases", "material_animations",
                                       "sound_channel_mappings", "material_colors", "vocal_separations")]

    def video_seg(path, at, dur, src, speed=1.0, fit="fill", zoom=None, mute=True, rindex=0, track_ri=0):
        w, h, d, ha = probe(path); photo = path.lower().endswith(PHOTO_EXT)
        if isinstance(fit, (int, float)): scale = float(fit)
        elif fit == "fill": scale = max(1080 / w, 1920 / h) / min(1080 / w, 1920 / h)   # 1.0 بكاب كت = داخل الإطار
        else: scale = 1.0
        mat = mk("video_mat", path=path, material_name=os.path.basename(path), width=w, height=h, duration=d,
                 type="photo" if photo else "video", has_audio=ha)
        mat["video_algorithm"]["time_range"] = {"duration": us(dur * speed), "start": us(src)}
        add("videos", mat); refs = vrefs(); M["speeds"][-1]["speed"] = speed
        seg = copy.deepcopy(REF["video_seg"])
        seg.update(id=uid(), material_id=mat["id"], extra_material_refs=refs,
                   source_timerange={"duration": us(dur * speed), "start": us(src)}, target_timerange={"duration": us(dur), "start": us(at)},
                   speed=speed, volume=0.0 if mute else 1.0, last_nonzero_volume=1.0, render_index=rindex, track_render_index=track_ri)
        seg["clip"]["scale"] = {"x": scale, "y": scale}; seg["clip"]["transform"] = {"x": 0.0, "y": 0.0}
        seg["common_keyframes"] = []
        if zoom in ("in", "out"):
            a, b = (1.0, 1.06) if zoom == "in" else (1.06, 1.0)
            seg["common_keyframes"] = [kf("KFTypeScaleX", [(0, scale * a), (dur, scale * b)])]
            seg["clip"]["scale"] = {"x": scale * a, "y": scale * a}
        return seg

    def audio_seg(path, at, dur, src, vol=1.0, fade=None, track_ri=0, name=None):
        mat = mk("audio_mat", path=path, name=name or os.path.basename(path), duration=us(adur(path)), type="extract_music", category_name="local")
        add("audios", mat)
        refs = [add(k, mk(k)) for k in ("speeds", "placeholder_infos", "beats", "sound_channel_mappings", "vocal_separations")]
        M["speeds"][-1]["speed"] = 1.0
        if fade: refs.append(add("audio_fades", mk("audio_fades", fade_in_duration=us(fade[0]), fade_out_duration=us(fade[1]))))
        seg = copy.deepcopy(REF["audio_track"]["segments"][0])
        seg.update(id=uid(), material_id=mat["id"], extra_material_refs=refs,
                   source_timerange={"duration": us(dur), "start": us(src)}, target_timerange={"duration": us(dur), "start": us(at)},
                   volume=vol, last_nonzero_volume=vol, track_render_index=track_ri)
        return seg

    def text_seg(text, at, dur, y, size, ranges=(), font=FONT, track_ri=0, pop=False):
        marks = [0] * len(text)
        for a, b in ranges:
            for i in range(a, min(b, len(text))): marks[i] = 1
        styles, i = [], 0
        while i < len(text):     # نطاقات: لون التمييز للكلمات المهمة، أبيض للباقي، بحد غامق يبان فوق أي لقطة
            j = i
            while j < len(text) and marks[j] == marks[i]: j += 1
            styles.append({"fill": {"content": {"solid": {"color": ACC if marks[i] else [1, 1, 1]}, "render_type": "solid"}},
                           "range": [i, j], "size": size, "bold": False, "useLetterColor": True,
                           "strokes": [{"width": 0.06, "content": {"solid": {"color": [0.1, 0.08, 0.1]}}}], "font": {"path": font, "id": ""}})
            i = j
        mat = mk("text_mat", content=json.dumps({"styles": styles, "text": text}, ensure_ascii=False), font_path=font, font_size=size,
                 text_color="#FFFFFF", border_color="#1A141A", border_width=0.06, alignment=1, line_max_width=0.86, type="text")
        add("texts", mat)
        seg = copy.deepcopy(REF["text_track"]["segments"][0])
        seg.update(id=uid(), material_id=mat["id"], extra_material_refs=[add("material_animations", mk("material_animations"))],
                   target_timerange={"duration": us(dur), "start": us(at)}, render_index=14000 + track_ri, track_render_index=track_ri)
        seg["clip"]["transform"] = {"x": 0.0, "y": y}
        seg["common_keyframes"] = [kf("KFTypeScaleX", [(0, 0.78), (0.12, 1.06), (0.2, 1.0)])] if pop else []
        return seg

    def track(kind, segs, name=""):
        return {"attribute": 0, "flag": 0, "id": uid(), "is_default_name": not name, "name": name, "segments": segs, "type": kind}

    tracks = []; ri = 0
    tracks.append(track("video", [video_seg(v["file"], v["at"], v["dur"], v["src"], v["speed"], v["fit"], v["zoom"], v["mute"], 0, 0)
                                  for v in R["visuals"]], "لقطات")); ri += 1
    if R["overlays"]:
        miss = [o["name"] for o in R["overlays"] if not (work_dir(P) / "overlays" / f"{o['name']}.mov").exists()]
        if miss: die("الموشن ما انرسم: " + " ".join(miss) + " — شغّل render أول")
        tracks.append(track("video", [video_seg(str(work_dir(P) / "overlays" / f"{o['name']}.mov"), o["at"], round(o["dur"] * FPS) / FPS - 0.001,
                                                0.0, 1.0, 1.0, None, True, 1, ri) for o in R["overlays"]], "موشن")); ri += 1
    for ti in R["titles"]:
        rng = [(m.start(), m.end()) for w in ti["emph"] for m in re.finditer(re.escape(w), ti["text"])]
        tracks.append(track("text", [text_seg(ti["text"], ti["start"], ti["end"] - ti["start"], ti["y"], ti["size"], rng, FONT_B, ri, pop=True)], "عنوان")); ri += 1
    C = []
    for c in R["captions"]:
        txt = " ".join(c["words"]); rng, p = [], 0
        for w, e in zip(c["words"], c["emph"]):
            if e: rng.append((p, p + len(w)))
            p += len(w) + 1
        C.append(text_seg(txt, c["start"], c["end"] - c["start"], P.get("caption_y", -0.56), P.get("caption_size", 13.0), rng, FONT_B, ri, pop=True))
    tracks.append(track("text", C, "كابشن")); ri += 1
    tracks.append(track("audio", [audio_seg(s["file"], s["at"], s["dur"], s["src"], 1.0, None, ri, name=s["key"]) for s in R["speech"]], "الفويس")); ri += 1
    lanes = []   # مسارات مؤثرات متناوبة عشان ما تتداخل
    for s in R["sfx"]:
        d = adur(s["file"]); lane = next((l for l in lanes if s["at"] >= l[0] + 0.01), None)
        if lane is None: lane = [0.0, []]; lanes.append(lane)
        lane[1].append(audio_seg(s["file"], s["at"], d, 0.0, s["vol"], None, ri + lanes.index(lane))); lane[0] = s["at"] + d
    for i, l in enumerate(lanes): tracks.append(track("audio", l[1], "مؤثرات" + (f" {i + 1}" if i else "")))
    ri += max(1, len(lanes))
    TOT = R["total"]
    if R["bg"]:   # الخلفية الصوتية: لو أقصر من الفيديو تتكرر بمقاطع متداخلة بفيد
        L = adur(R["bg"]["file"]); ov = 1.6; t0, n = 0.0, 0
        while t0 < TOT - 0.05:
            src = 0.0 if n == 0 else 2.0; d = min(L - src, TOT - t0)
            tracks.append(track("audio", [audio_seg(R["bg"]["file"], t0, d, src, R["bg"]["vol"], (0.6 if n == 0 else ov, ov if t0 + d < TOT - 0.05 else 1.4), ri)],
                                "خلفية صوتية" + (f" {n + 1}" if n else "")))
            ri += 1; n += 1
            if d <= ov + 0.2: break
            t0 = t0 + d - ov if t0 + d < TOT - 0.05 else TOT
    d = base; d["materials"] = M; d["tracks"] = tracks; d["duration"] = us(TOT); d["fps"] = float(FPS)
    d["canvas_config"] = {"background": None, "height": 1920, "ratio": "original", "width": 1080}
    return d, tracks, TOT

def cmd_write(P, draft_dir=None):
    R = cmd_check(P, quiet=True)
    for s in R["sfx"]:
        if not os.path.exists(s["file"]): cmd_sfx(P); break
    if draft_dir: D = Path(draft_dir).expanduser().resolve()
    else:
        name = P.get("capcut") or P["name"]; hits = [r / name for r in capcut_roots() if (r / name / "draft_info.json").exists()]
        if not hits: die(f"ما لقيت مشروع كاب كت باسم «{name}» — خلّه يسوي مشروع فاضي بهالاسم ويسكّره، أو شغّل projects")
        D = hits[0]
    if not (D / "draft_info.json").exists(): die(f"{D} مو مشروع كاب كت (ما فيه draft_info.json)")
    inside = any(str(D).startswith(str(r.resolve())) for r in capcut_roots())
    if inside and capcut_running(): die("كاب كت شغّال — سكّره كامل (Cmd+Q) قبل الكتابة، وإلا يكتب فوق شغلنا أو يخرّب المشروع")
    d, tracks, TOT = build_draft(P, R, D)
    out = json.dumps(d, ensure_ascii=False, separators=(",", ":")); json.loads(out)
    targets = [D / "draft_info.json", D / "draft_info.json.bak"]
    pj = D / "Timelines" / "project.json"
    if pj.exists():
        tl = json.load(open(pj)).get("main_timeline_id")
        if tl and (D / "Timelines" / tl).is_dir(): targets += [D / "Timelines" / tl / "draft_info.json", D / "Timelines" / tl / "draft_info.json.bak"]
    bk = work_dir(P) / "backup" / time.strftime("%Y%m%d-%H%M%S"); bk.mkdir(parents=True)
    for p in targets + [D / "draft_meta_info.json"]:
        if p.exists(): (bk / p.relative_to(D)).parent.mkdir(parents=True, exist_ok=True); shutil.copy2(p, bk / p.relative_to(D))
    for p in targets: p.write_text(out, encoding="utf-8")
    mp = D / "draft_meta_info.json"
    if mp.exists():
        mi = json.load(open(mp)); mi["tm_duration"] = us(TOT); mp.write_text(json.dumps(mi, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("✓ كتبت", D.name, f"{len(out) // 1024}KB —", {t["name"]: len(t["segments"]) for t in tracks}, f"المدة {TOT:.2f}ث")
    print("↩︎ النسخة الاحتياطية:", bk, "(للرجوع: انسخ ملفاتها فوق المشروع وكاب كت مسكّر)")

# ════════════════════════ 6) خطة أولية من فيديو الكلام ════════════════════════
def cmd_skeleton(work, out):
    W = Path(work).resolve(); cut = json.load(open(W / "cut.json"))["keep"]; wj = json.load(open(W / "a.json"))
    words = [(w["word"].strip(), w["start"], w["end"]) for s in wj["segments"] for w in s.get("words", []) if w["word"].strip()]
    src = next((W / n for n in ("src.mov", "src.mp4") if (W / n).exists()), None)
    if not src: die("ما لقيت src.mov بمجلد الشغل")
    voice = W / "voice48k.wav"
    if not voice.exists():
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vn", "-ac", "1", "-ar", "48000", str(voice)], check=True)
    sp, vis = [], []
    near = lambda w: min(range(len(cut)), key=lambda i: max(0, cut[i][0] - (w[1] + w[2]) / 2, (w[1] + w[2]) / 2 - cut[i][1]))
    own = [near(w) for w in words]          # كل كلمة لمقطع واحد بس (الأقرب) — بلا تكرار على حدود القص
    for i, (a, b) in enumerate(cut):
        ws = [list(w) for w, o in zip(words, own) if o == i]
        if not ws: continue
        k = f"S{len(sp) + 1}"; sp.append(dict(key=k, file=str(voice), a=round(a, 3), b=round(b, 3), words=ws))
        vis.append(dict(file=str(src), sync=True, to=k + ">", zoom="in" if len(vis) % 2 == 0 else "out", label=k))
    if vis: vis[-1].pop("to")
    th = W / "theme.json"
    plan = dict(name=W.name, capcut=W.name, theme=str(th) if th.exists() else {"acc": "#F2B33D"}, gap=0.0, emph=[],
                speech=sp, visuals=vis, titles=[], overlays=[], sfx=[], auto_sfx=True)
    json.dump(plan, open(out, "w"), ensure_ascii=False, indent=1)
    print(f"✓ {out} — {len(sp)} مقطع كلام. عدّل: emph، العنوان، البي-رول بين اللقطات، الموشن، الخلفية الصوتية (bg)")

if __name__ == "__main__":
    a = sys.argv[1:]
    if not a: print(__doc__); sys.exit(0)
    c = a[0]
    if c == "projects": cmd_projects()
    elif c == "dump-template": print(json.dumps(REF, ensure_ascii=False, indent=1))
    elif c == "skeleton": cmd_skeleton(a[1], a[2])
    else:
        P = load_plan(a[1])
        if c == "check": cmd_check(P)
        elif c == "stills": cmd_render(P, a[2] if len(a) > 2 else "all", "stills")
        elif c == "render": cmd_render(P, a[2] if len(a) > 2 else "all")
        elif c == "sfx": cmd_sfx(P)
        elif c == "write": cmd_write(P, a[a.index("--draft-dir") + 1] if "--draft-dir" in a else None)
        elif c == "all": cmd_sfx(P); cmd_render(P); cmd_write(P, a[a.index("--draft-dir") + 1] if "--draft-dir" in a else None)
        else: print(__doc__)
