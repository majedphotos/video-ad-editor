# -*- coding: utf-8 -*-
"""يبني توقيتات الكابشن على التايم-لاين الجديد.  python3 02_captions.py <workdir>
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
    si=seg["seg"] if isinstance(seg.get("seg"),int) else seg_of((ws[0]["start"]+ws[-1]["end"])/2)
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
        s1,e1=newt(ws0,si),newt(we0,si)
        if e1<=s1: e1=s1+0.12
        _w={"t":txt,"s":round(s1,3),"e":round(e1,3),"hot":txt in HOT or txt in FXMAP}
        if txt in FXMAP: _w["fx"]=FXMAP[txt]
        o.append(_w)
    a,b=keep[si]
    cs=max(o[0]["s"]-0.10, off[si])
    ce=min(max(x["e"] for x in o)+0.28, off[si]+(b-a))
    cards.append({"s":round(cs,3),"e":round(ce,3),"w":o})
cards.sort(key=lambda c:c["s"])
for i in range(len(cards)-1):
    if cards[i]["e"]>cards[i+1]["s"]: cards[i]["e"]=round(cards[i+1]["s"]-0.02,3)
json.dump({"total":round(acc,3),"cards":cards},open(os.path.join(W,"caps.json"),"w"),ensure_ascii=False,indent=1)
print("كروت:",len(cards)," المدة:",round(acc,2))
for c in cards: print(f"{c['s']:6.2f}-{c['e']:6.2f}  "+" ".join(x['t'] for x in c['w']))
