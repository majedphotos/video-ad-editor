# -*- coding: utf-8 -*-
"""يبني توقيتات الكابشن على التايم-لاين الجديد.  python3 02_captions.py <workdir>
يقرأ: cut.json · a.json (وِسبر) · fixes.json  ← {"fix":[[كلمات الجملة 0],...], "hot":[كلمات تُظلَّل]}
عدد كلمات كل جملة في fix لازم يساوي عدد كلمات وِسبر لنفس الجملة (عشان التوقيتات تبقى مضبوطة)."""
import json, sys, os
W=os.path.abspath(sys.argv[1])
keep=json.load(open(os.path.join(W,"cut.json")))["keep"]
tr=json.load(open(os.path.join(W,"a.json")))
fx=json.load(open(os.path.join(W,"fixes.json")))
FIX, HOT = fx["fix"], set(fx.get("hot",[]))

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
    if len(ws)!=len(f):
        sys.exit(f"❌ الجملة {i}: وِسبر {len(ws)} كلمة، fixes.json {len(f)} — لازم يتساوون")
    si=seg_of((ws[0]["start"]+ws[-1]["end"])/2)
    o=[]
    for w,txt in zip(ws,f):
        s,e=newt(w["start"],si),newt(w["end"],si)
        if e<=s: e=s+0.12
        o.append({"t":txt,"s":round(s,3),"e":round(e,3),"hot":txt in HOT})
    a,b=keep[si]
    cs=max(o[0]["s"]-0.10, off[si])
    ce=min(max(x["e"] for x in o)+0.28, off[si]+(b-a))
    cards.append({"s":round(cs,3),"e":round(ce,3),"w":o})
for i in range(len(cards)-1):
    if cards[i]["e"]>cards[i+1]["s"]: cards[i]["e"]=round(cards[i+1]["s"]-0.02,3)
json.dump({"total":round(acc,3),"cards":cards},open(os.path.join(W,"caps.json"),"w"),ensure_ascii=False,indent=1)
print("كروت:",len(cards)," المدة:",round(acc,2))
for c in cards: print(f"{c['s']:6.2f}-{c['e']:6.2f}  "+" ".join(x['t'] for x in c['w']))
