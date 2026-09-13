# -*- coding: utf-8 -*-
"""وضع البودكاست — كاميرتان أو أكثر لنفس الجلسة → ريل 9:16 واحد.
   python3 15_podcast.py prep <work> <مجلد_الكاميرات | ملف1 ملف2 …>   ← مزامنة · فحص عطب · وجوه وفم · من يتكلم · تفريغ · فريمات
   python3 15_podcast.py make <work>                   ← كابشن · خطة مشاهد · قصّ الراس · رسم · تجميع · معايرة · ورقة
   python3 15_podcast.py plan <work>                   ← إعادة الخطة فقط (بعد تعديل النص أو الثيم)
   بين prep و make: اكتب fixes.json (تصحيح التفريغ) — أو خلّه يمشي بالنص كما هو.
   ماك فقط (Vision للوجوه وقصّ الشخص)."""
import sys as _sys, builtins as _bi
try:
    _sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True); _sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception: pass
_real_open=_bi.open
def _u(f,mode="r",*a,**k):
    if "b" not in mode: k.setdefault("encoding","utf-8")
    return _real_open(f,mode,*a,**k)
_bi.open=_u
import json, os, sys, subprocess, glob, shutil, math, statistics, wave, struct
import numpy as np
SC=os.path.dirname(os.path.abspath(__file__))
PY=sys.executable
FPS=30; LOFPS=10; LOW=270; LOH=480
VID_EXT=('.mp4','.mov','.m4v','.mkv','.MP4','.MOV')

def sh(cmd,quiet=True):
    r=subprocess.run(cmd,capture_output=True)          # بايتات: بعض المخرجات صور خام مو نصاً
    if r.returncode!=0 and not quiet: print(r.stderr.decode("utf-8","replace")[-800:])
    return r
def probe(f):
    r=sh(["ffprobe","-v","error","-show_entries","format=duration:stream=codec_type,width,height","-of","json",f])
    d=json.loads(r.stdout.decode()); vs=[s for s in d["streams"] if s["codec_type"]=="video"]
    return {"dur":float(d["format"]["duration"]),"w":vs[0]["width"],"h":vs[0]["height"],"audio":any(s["codec_type"]=="audio" for s in d["streams"])}
def wav16(src,dst):
    sh(["ffmpeg","-v","error","-y","-i",src,"-vn","-ac","1","-ar","16000",dst])
def readwav(p):
    w=wave.open(p); n=w.getnframes(); d=np.frombuffer(w.readframes(n),dtype=np.int16).astype(np.float32)/32768; w.close(); return d
def envelope(x,sr=16000,hop=16):     # مغلّف بـ1000 عينة/ثانية
    n=len(x)//hop; e=np.abs(x[:n*hop]).reshape(n,hop).mean(1); e=e-e.mean(); return e
def xcorr_offset(a,b):               # كم ثانية تتأخر b عن a (موجب = b تبدأ بعد a)
    n=1<<int(math.ceil(math.log2(len(a)+len(b))))
    A=np.fft.rfft(a,n); B=np.fft.rfft(b,n); c=np.fft.irfft(A*np.conj(B),n)
    lag=int(np.argmax(c));
    if lag>n//2: lag-=n
    peak=c[lag if lag>=0 else n+lag]/ (np.sqrt((a*a).sum()*(b*b).sum())+1e-9)
    return lag/1000.0, float(peak)

# ───────────────────────── prep ─────────────────────────
def prep(W,args):
    os.makedirs(W,exist_ok=True)
    folder=args[0] if len(args)==1 and os.path.isdir(args[0]) else os.path.dirname(os.path.abspath(args[0]))
    files=sorted([f for f in glob.glob(os.path.join(folder,"*")) if f.endswith(VID_EXT)]) if len(args)==1 and os.path.isdir(args[0]) else [os.path.abspath(a) for a in args]
    if len(files)<2: sys.exit("❌ أحتاج كاميرتين على الأقل بالمجلد")
    cams=[]
    for i,f in enumerate(files):
        p=probe(f); cams.append({"id":i+1,"file":os.path.abspath(f),"name":os.path.basename(f),**p,"offset":0.0})
        wav16(f,os.path.join(W,f"a{i+1}.wav"))
    print("الكاميرات:"," · ".join(f"{c['name']} ({c['w']}×{c['h']}, {c['dur']:.1f}ث)" for c in cams))
    # 1) المزامنة بالصوت: الكل نسبة للكاميرا الأولى
    e1=envelope(readwav(os.path.join(W,"a1.wav")))
    same_audio=True
    for c in cams[1:]:
        e=envelope(readwav(os.path.join(W,f"a{c['id']}.wav")))
        off,peak=xcorr_offset(e1,e); c["offset"]=round(off,3); c["sync_peak"]=round(peak,3)
        if peak<0.98: same_audio=False
    # المدى المشترك على خط الكاميرا الأولى
    start=max(0.0, max(c["offset"] for c in cams)); end=min(c["offset"]+c["dur"] for c in cams)
    total=round(end-start,3)
    print("المزامنة:"," · ".join(f"كام{c['id']} تتأخر {c['offset']:+.2f}ث" for c in cams[1:]),f"→ المدى المشترك {total:.1f}ث")
    # 2) الصوت الرئيسي: الأعلى طاقة (بالمدى المشترك)
    best=None
    for c in cams:
        x=readwav(os.path.join(W,f"a{c['id']}.wav")); s0=int((start-c["offset"])*16000); seg=x[s0:s0+int(total*16000)]
        c["rms"]=float(np.sqrt((seg*seg).mean()))
        if best is None or c["rms"]>best["rms"]: best=c
    for c in cams: c["master_audio"]= c is best
    sh(["ffmpeg","-v","error","-y","-ss",f"{start-best['offset']:.3f}","-t",f"{total:.3f}","-i",best["file"],"-vn","-ac","1","-ar","16000",os.path.join(W,"a.wav")])
    sh(["ffmpeg","-v","error","-y","-ss",f"{start-best['offset']:.3f}","-t",f"{total:.3f}","-i",best["file"],"-vn","-c:a","aac","-b:a","192k","-ar","48000",os.path.join(W,"master.m4a")])
    # 3) فريمات منخفضة (10/ث) لكل كاميرا + فحص العطب + الوجوه
    ft=os.path.join(W,"bt","facetrack"); os.makedirs(os.path.dirname(ft),exist_ok=True)
    if not os.path.exists(ft):
        r=sh(["swiftc","-O","-o",ft,os.path.join(SC,"facetrack.swift")])
        if r.returncode!=0: sys.exit("❌ راصد الوجه يحتاج أدوات Xcode: xcode-select --install")
    procs=[]
    for c in cams:
        lo=os.path.join(W,"lo",f"cam{c['id']}"); os.makedirs(lo,exist_ok=True)
        procs.append(subprocess.Popen(["ffmpeg","-v","error","-y","-ss",f"{start-c['offset']:.3f}","-t",f"{total:.3f}","-i",c["file"],
            "-vf",f"fps={LOFPS},scale={LOW}:{LOH}:force_original_aspect_ratio=increase,crop={LOW}:{LOH}","-q:v","4",os.path.join(lo,"%05d.jpg")]))
        hi=os.path.join(W,f"cam{c['id']}"); os.makedirs(hi,exist_ok=True)
        procs.append(subprocess.Popen(["ffmpeg","-v","error","-y","-ss",f"{start-c['offset']:.3f}","-t",f"{total:.3f}","-i",c["file"],"-vf",f"fps={FPS}","-q:v","3",os.path.join(hi,"%05d.jpg")]))
    # التفريغ بالتوازي مع الفريمات
    wh=subprocess.Popen([PY,"-m","whisper",os.path.join(W,"a.wav"),"--language","ar","--model","medium","--word_timestamps","True","--output_format","json","--output_dir",W,"--fp16","False"],stdout=open(os.path.join(W,"whisper.log"),"w"),stderr=subprocess.STDOUT)
    for p in procs: p.wait()
    for c in cams:
        lo=os.path.join(W,"lo",f"cam{c['id']}")
        c["defects"]=defects(lo,total)
        r=sh([ft,lo,os.path.join(W,"bt",f"face{c['id']}.json")])
        c["faces"]=face_stats(os.path.join(W,"bt",f"face{c['id']}.json"),c)
    # 4) من يتكلم — حركة الفم (والطاقة لو لكل كاميرا مايكها)
    speak=speaker_timeline(W,[c for c in cams if c["faces"]["ok"]] or cams,start,total,same_audio)
    same_person=speak["same_person"]
    for c in cams: c.pop("faces_raw",None)
    json.dump({"start":start,"total":total,"same_audio":same_audio,"same_person":same_person,"cams":cams},open(os.path.join(W,"cams.json"),"w"),ensure_ascii=False,indent=1)
    json.dump({"keep":[[0,total]],"total":total,"src_dur":total},open(os.path.join(W,"cut.json"),"w"))
    if not os.path.exists(os.path.join(W,"sfx.json")): json.dump({"outro":1.8},open(os.path.join(W,"sfx.json"),"w"))
    tf=os.path.join(folder,"theme.json")
    if not os.path.exists(os.path.join(W,"theme.json")) and os.path.exists(tf): shutil.copy(tf,os.path.join(W,"theme.json")); print("الثيم: من مجلد الكاميرات")
    for c in cams: c["kind"]="screen" if (not c["faces"]["ok"] or c["faces"].get("rate",0)<0.15) else "person"
    for c in cams:
        d=c["defects"]; print(f"كام{c['id']}: {'تسجيل شاشة' if c['kind']=='screen' else 'شخص'} · وجه {'✓' if c['faces']['ok'] else '✗'} حجم {c['faces']['h']:.2f}"+(f" · ⚠️ عطب {', '.join(f'{a:.1f}-{b:.1f}' for a,b in d)}" if d else " · سليمة"))
    print("الأشخاص:","نفس الشخص بزاويتين" if same_person else f"{len(cams)} أشخاص — الكلام موزّع: "+" · ".join(f"كام{k} {v:.0f}٪" for k,v in speak['share'].items()),"·",speak["diag"])
    print("التفريغ يشتغل… (a.json) — لما يخلص: صحّحه بـfixes.json ثم make")
    wh.wait()
    tr=json.load(open(os.path.join(W,"a.json")))
    for i,s in enumerate(tr["segments"]): print(f"{i:2d} {s['start']:6.2f}-{s['end']:6.2f} [{len(s.get('words',[]))}] {s['text'].strip()}")
    print("✅ prep خلص —",len(tr["segments"]),"جملة")

def defects(lo,total):
    """أي منطقة سوداء كبيرة داخل كادر مضيء = عطب (نصف الكادر أسود مثلاً). يرجّع مدى بالثواني."""
    files=sorted(glob.glob(os.path.join(lo,"*.jpg"))); bad=[]
    for i,f in enumerate(files):
        if i%5: continue    # مرتين بالثانية تكفي
        d=sh(["ffmpeg","-v","error","-i",f,"-vf","scale=27:48,format=gray","-f","rawvideo","-"]); a=np.frombuffer(d.stdout,np.uint8)
        if len(a)!=27*48: continue
        blk=(a<10).mean(); rest=a[a>=10].mean() if (a>=10).any() else 0
        bad.append((i/LOFPS, blk>0.22 and rest>50))
    rng=[]; cur=None
    for t,b in bad:
        if b and cur is None: cur=t
        if not b and cur is not None: rng.append([round(cur,1),round(t,1)]); cur=None
    if cur is not None: rng.append([round(cur,1),round(total,1)])
    return [r for r in rng if r[1]-r[0]>=1.0]

def face_stats(js,c):
    rows=json.load(open(js)); fs=[r["face"] for r in rows if "face" in r]
    if len(fs)<len(rows)*0.3: return {"ok":False,"cx":0.5,"cy":0.35,"h":0.15}
    med=lambda k: statistics.median(f[k] for f in fs)
    return {"ok":True,"cx":round(med("x")+med("w")/2,3),"cy":round(med("y")+med("h")/2,3),"h":round(med("h"),3),"rate":round(len(fs)/len(rows),2)}

def speaker_timeline(W,cams,start,total,same_audio):
    WIN=0.5; nwin=int(total/WIN)+1
    mo={}; valid={}   # حركة الفم لكل كاميرا لكل نافذة + هل فيه وجه
    for c in cams:
        rows=json.load(open(os.path.join(W,"bt",f"face{c['id']}.json")))
        m=np.array([r.get("mouth",np.nan) for r in rows],dtype=float)
        sc=np.zeros(nwin); vd=np.zeros(nwin,dtype=bool)
        for k in range(nwin):
            seg=m[int(k*WIN*LOFPS):int((k+1)*WIN*LOFPS)]; seg=seg[~np.isnan(seg)]
            if len(seg)>=3: sc[k]=seg.std(); vd[k]=True
        thr=np.percentile(sc[vd],35) if vd.any() else 0
        mo[c["id"]]=sc/(thr+1e-6); valid[c["id"]]=vd
    ids=[c["id"] for c in cams]
    # نفس الشخص؟ حركة الفم متطابقة زمنياً بين الكاميرتين — نقارن بس النوافذ اللي فيها وجه بالكاميرتين
    same=False; diag=""
    if len(ids)>=2:
        a,b=mo[ids[0]],mo[ids[1]]; va,vb=valid[ids[0]],valid[ids[1]]; ok=va&vb
        if ok.sum()>=8 and a[ok].std()>0 and b[ok].std()>0:
            r=float(np.corrcoef(a[ok],b[ok])[0,1]); A=a[ok]>0.8; B=b[ok]>0.8
            jac=float((A&B).sum()/max(1,(A|B).sum())); same=(r>0.55) or (jac>0.65 and r>0.3)
            diag=f"تطابق الفم r={r:.2f} تداخل={jac:.2f} على {int(ok.sum())} نافذة"
    # الطاقة لو لكل كاميرا مايك
    en={}
    if not same_audio:
        for c in cams:
            x=readwav(os.path.join(W,f"a{c['id']}.wav")); s0=int((start-c["offset"])*16000); x=x[s0:s0+int(total*16000)]
            e=np.zeros(nwin)
            for k in range(nwin):
                seg=x[int(k*WIN*16000):int((k+1)*WIN*16000)]; e[k]=np.sqrt((seg*seg).mean()) if len(seg) else 0
            en[c["id"]]=e/(np.percentile(e,60)+1e-9)
    tl=[]
    for k in range(nwin):
        score={i:mo[i][k]+(en[i][k] if en else 0) for i in ids}
        best=max(score,key=score.get)
        tl.append(best if score[best]>0.8 else 0)
    # تنعيم: نافذة وحيدة مختلفة بين نافذتين متفقتين تُصحّح
    for k in range(1,len(tl)-1):
        if tl[k-1]==tl[k+1] and tl[k]!=tl[k-1]: tl[k]=tl[k-1]
    share={i:100*sum(1 for v in tl if v==i)/max(1,sum(1 for v in tl if v)) for i in ids}
    out={"win":WIN,"tl":[int(v) for v in tl],"same_person":bool(same),"share":share,"diag":diag}
    json.dump(out,open(os.path.join(W,"speak.json"),"w"),indent=0)
    return out

# ───────────────────────── plan ─────────────────────────
def face_window(W,cam,s,e):
    """وسيط مستطيل الوجه (نسب) بكاميرا خلال مدى — من راصد الوجه (10 فريم/ث)"""
    rows=json.load(open(os.path.join(W,"bt",f"face{cam}.json")))[int(s*LOFPS):int(e*LOFPS)+1]
    fs=[r["face"] for r in rows if "face" in r]
    if len(fs)<3: return None
    med=lambda k: statistics.median(f[k] for f in fs)
    return {"x":med("x"),"y":med("y"),"w":med("w"),"h":med("h")}
def caption_spot(W,cam,s,e,zoom,cinfo):
    """وين يقعد الكابشن بمشهد ملء الشاشة: فوق الراس لو فيه فراغ هادي (≥ 300 بكسل ومنطقة قليلة التفاصيل)، وإلا تحت (1440).
       يرجّع {"y":..,"why":..}"""
    f=face_window(W,cam,s,e)
    if not f: return {"y":1440,"why":"بلا وجه"}
    iw,ih=cinfo["w"],cinfo["h"]; sc=max(1080/iw,1920/ih)*(zoom or 1); dh=ih*sc
    fy=f["y"]+f["h"]/2; dy=1920*0.42-fy*dh; dy=min(0,max(1920-dh,dy))
    top_px=dy+f["y"]*dh                     # أعلى الراس بالبكسل على الشاشة
    room=top_px-150
    if room<420: return {"y":1440,"why":f"فوق الراس {int(room)}px بس (نحتاج 420)"}
    # هدوء المنطقة فوق الراس: انحراف الرمادي بفريمات منخفضة
    lo=os.path.join(W,"lo",f"cam{cam}"); stds=[]
    for k in range(int(s*LOFPS)+1,int(e*LOFPS),max(1,int((e-s)*LOFPS/4))):
        fp=os.path.join(lo,f"{k:05d}.jpg")
        if not os.path.exists(fp): continue
        d=sh(["ffmpeg","-v","error","-i",fp,"-vf","format=gray,scale=54:96","-f","rawvideo","-"]); a=np.frombuffer(d.stdout,np.uint8)
        if len(a)!=54*96: continue
        a=a.reshape(96,54); y0=int(150/1920*96); y1=max(y0+2,int(top_px/1920*96)); stds.append(float(a[y0:y1,8:46].std()))
    calm=statistics.median(stds) if stds else 99
    if calm>48: return {"y":1440,"why":f"فوق الراس مزدحم ({calm:.0f})"}
    band_lo,band_hi=230,top_px-200                        # الحزام المتاح: تحت المنطقة الآمنة وفوق الراس بـ200 بكسل على الأقل
    return {"y":int(min(band_hi,(band_lo+band_hi)/2)),"why":f"فراغ هادي فوق الراس ({int(room)}px, هدوء {calm:.0f})"}

def speaker_of(spk,s,e):
    WIN=spk["win"]; tl=spk["tl"]; ks=range(max(0,int(s/WIN)),min(len(tl),int(e/WIN)+1))
    cnt={}
    for k in ks:
        if tl[k]: cnt[tl[k]]=cnt.get(tl[k],0)+1
    return max(cnt,key=cnt.get) if cnt else 0

def plan(W):
    C=json.load(open(os.path.join(W,"cams.json"))); spk=json.load(open(os.path.join(W,"speak.json")))
    caps=json.load(open(os.path.join(W,"caps.json"))); cards=caps["cards"]; total=caps["total"]
    cams=C["cams"]; ids=[c["id"] for c in cams]; same=C["same_person"]
    theme=json.load(open(os.path.join(W,"theme.json"))) if os.path.exists(os.path.join(W,"theme.json")) else {}
    MIN=4.0; MAX=9.0
    def bad(cam,s,e):
        return any(a<e and b>s for a,b in next(c for c in cams if c["id"]==cam)["defects"])
    def alt(cam,s,e):
        for i in ids:
            if i!=cam and not bad(i,s,e): return i
        return cam
    # الوحدات: الجمل، ومع كل جملة المتكلم
    units=[]
    for i,c in enumerate(cards):
        s=c["s"] if i else 0.0; e=cards[i+1]["s"] if i+1<len(cards) else total
        units.append({"s":s,"e":e,"i":i,"spk":speaker_of(spk,c["s"],c["e"]),"hot":len(c.get("hot",[])),"num":any(any(ch.isdigit() for ch in w["t"]) for w in c["w"])})
    # الزوايا: القريبة (أكبر وجه) أولاً
    by_size=sorted(cams,key=lambda c:-c["faces"]["h"]); close=by_size[0]["id"]; wide=by_size[-1]["id"]
    scenes=[]
    def push(m,s,e,cam=None,**kw):
        if e-s<0.4: return
        if scenes and scenes[-1]["e"]>s: scenes[-1]["e"]=s
        d={"s":round(s,3),"e":round(e,3),"m":m};
        if cam: d["cam"]=cam
        d.update(kw); scenes.append(d)
    screens=[c["id"] for c in cams if c.get("kind")=="screen"]; persons=[c["id"] for c in cams if c.get("kind")!="screen"]
    if screens and persons:
        # قاعدة المستخدم (10 سبتمبر): كاميرا + تسجيل شاشة → الشاشة فوق والشخص تحت طول الفيديو، بلا تبديل
        per=persons[0]; scr=screens[0]
        scenes=[{"s":0.0,"e":total,"m":"SPLIT","cams":[scr,per],"screen":True}]
        P={"outro":json.load(open(os.path.join(W,"sfx.json"))).get("outro",1.8),"same_person":False,"screen":scr,"person":per,"scenes":scenes}
        json.dump(P,open(os.path.join(W,"plan.json"),"w"),ensure_ascii=False,indent=1)
        print("المشاهد: 1 — تسجيل الشاشة فوق والشخص تحت طول الفيديو"); return P
    QW=("هل","ليش","ليه","شنو","شلون","كيف","وش","متى","وين","لماذا","ماذا","من","كم","هو","هي")
    quote=None
    for u in units:
        ws=cards[u["i"]]["w"]; txt=" ".join(w["t"] for w in ws)
        qi=next((k for k,w in enumerate(ws) if w["t"] in QW),None)
        if qi is None and not txt.endswith("؟"): continue
        qi=qi or 0
        if qi>0 and (ws[qi]["s"]-ws[0]["s"])>=2.5 and (ws[-1]["e"]-ws[qi]["s"])<0.8: continue
        qws=ws[qi:qi+6]
        s_,e_=(qws[0]["s"] if qi else u["s"]), u["e"]
        if s_-u["s"]<2.0: s_=u["s"]                       # لا تترك ذيلاً قصيراً قبل السؤال
        if not (2.0<=e_-s_<=7.5): continue
        cam=(close if same else (u["spk"] or ids[0]))     # نفس الشخص: السؤال بالقريبة (نفس كاميرا الهوك، بلا قطعة)
        if bad(cam,s_,e_): cam=alt(cam,s_,e_)
        # مكان النص: تحت الوجه بمسافة مريحة (ولا ينزل عن 1360 حتى ما يدخل حزام انستقرام)
        f=face_window(W,cam,s_,e_); ci=next(c for c in cams if c["id"]==cam); qy=1180
        if f:
            iw,ih=ci["w"],ci["h"]; scz=max(1080/iw,1920/ih)*1.06; dh=ih*scz; fy=f["y"]+f["h"]/2
            dy=1920*0.42-fy*dh; dy=min(0,max(1920-dh,dy)); bottom=dy+(f["y"]+f["h"])*dh
            qy=int(max(900,min(1360,bottom+260)))
        quote={"s":round(s_,3),"e":round(e_,3),"m":"QUOTE","cam":cam,"y":qy,"words":[{"t":w["t"],"s":w["s"],"e":w["e"]} for w in qws],"nocap":True,"i":u["i"]}
        break
    # 1) مرشّحو «الراس برّا الكرت»: كتلة جمل متتالية 3.5-8.5 ثوانٍ فيها رقم (الأولوية) أو كلمة ساخنة،
    #    بعيدة عن أول 4 ثوانٍ وآخر 2.5، وبين كتلتين 8 ثوانٍ فراغ على الأقل، ومجموعها ≤ 35٪ من الفيديو
    cands=[]
    for a in range(len(units)):
        for b in range(a,len(units)):
            blk=units[a:b+1]; s_,e_=blk[0]["s"],blk[-1]["e"]; d=e_-s_
            if d>8.5: break
            if d<3.5 or s_<4 or e_>total-2.5: continue
            if not same and len({u["spk"] for u in blk if u["spk"]})>1: continue
            if quote and any(u["i"]==quote["i"] for u in blk): continue
            score=sum(3*u["num"]+u["hot"] for u in blk)/max(1.0,d/5)
            if score>0: cands.append((score,s_,e_,[u["i"] for u in blk]))
    cands.sort(key=lambda c:-c[0]); heads=[]; budget=0.35*total
    for sc_,s_,e_,ids_ in cands:
        if any(not (e_+8<=h["s"] or s_>=h["e"]+8) for h in heads): continue
        if any(i in h["ids"] for h in heads for i in ids_): continue
        if budget-(e_-s_)<0: continue
        heads.append({"s":s_,"e":e_,"ids":ids_,"i":ids_[0]}); budget-=(e_-s_)
        if len(heads)>=2: break
    head_ids={i for h in heads for i in h["ids"]}; head_by_first={h["ids"][0]:h for h in heads}
    # 2) بناء المشاهد
    t=0.0; k=0; last_full=None; changes=0
    pattern_same=["FULL_CLOSE","FULL_WIDE","FULL_CLOSE_Z","FULL_WIDE_Z"]   # نفس الشخص: بلا تقسيم (قرار المستخدم 10 سبتمبر — ما يتكلم بشاشتين بنفس الوقت)
    pi=0
    i=0
    while i<len(units):
        u=units[i]
        if u["i"] in head_ids:
            h=head_by_first.get(u["i"]);
            if not h: i+=1; continue
            cam=u["spk"] or (close if same else ids[0])
            if bad(cam,h["s"],h["e"]): cam=alt(cam,h["s"],h["e"])
            push("HEAD",h["s"],h["e"],cam,nocap=True); i+=len(h["ids"]); continue
        # اجمع جملاً لين المدة ≥MIN (وبنفس المتكلم بوضع الشخصين)
        j=i; e=u["e"]
        while j+1<len(units) and e-u["s"]<MIN and units[j+1]["i"] not in head_ids and (same or units[j+1]["spk"]==u["spk"] or units[j+1]["spk"]==0):
            j+=1; e=units[j]["e"]
        s=u["s"]
        if same:
            m=pattern_same[pi%len(pattern_same)]; pi+=1
            if s<4: m="FULL_CLOSE"          # الهوك ملء الشاشة بالقريبة
            if m=="SPLIT":
                if bad(close,s,e) or bad(wide,s,e): m="FULL_WIDE" if not bad(wide,s,e) else "FULL_CLOSE"
            if m.startswith("FULL"):
                cam=close if "CLOSE" in m else wide
                if bad(cam,s,e): cam=alt(cam,s,e)
                push("FULL",s,e,cam,zoom=1.10 if m.endswith("_Z") else 1.0)
            else: push("SPLIT",s,e,cams=[close,wide])
        else:
            cam=u["spk"] or (last_full or ids[0])
            quick=(e-s)<2.5 and last_full and cam!=last_full
            if quick or (changes%3==2 and s>=4):
                other=next((x for x in ids if x!=cam),cam)
                if not bad(cam,s,e) and not bad(other,s,e): push("SPLIT",s,e,cams=[cam,other]); changes+=1; i=j+1; continue
            if bad(cam,s,e): cam=alt(cam,s,e)
            push("FULL",s,e,cam,zoom=1.0 if cam!=last_full else 1.08)
            if cam!=last_full: changes+=1
            last_full=cam
        i=j+1
    if quote:
        cut=[]
        for sc in scenes:
            if sc["e"]<=quote["s"] or sc["s"]>=quote["e"]: cut.append(sc); continue
            if sc["s"]<quote["s"]-0.4: cut.append(dict(sc,e=quote["s"]))
            if sc["e"]>quote["e"]+0.4: cut.append(dict(sc,s=quote["e"]))
        cut.append(quote); scenes=sorted(cut,key=lambda x:x["s"])
    # 3) قصّ المشاهد على مدى العطب (لو بقي) + تقسيم الطويل
    fixed=[]
    for sc in scenes:
        camsIn=[sc.get("cam")] if sc.get("cam") else sc.get("cams",[])
        if sc["m"]=="QUOTE": fixed.append(sc); continue
        cuts=sorted({a for c in camsIn for a,b in next(x for x in cams if x["id"]==c)["defects"] if sc["s"]<a<sc["e"]})
        segs=[]; s=sc["s"]
        for a in cuts: segs.append((s,a)); s=a
        segs.append((s,sc["e"]))
        for a,b in segs:
            d=dict(sc,s=round(a,3),e=round(b,3))
            if any(bad(c,a,b) for c in camsIn):
                good=[c for c in ids if not bad(c,a,b)]
                d={"s":round(a,3),"e":round(b,3),"m":"FULL","cam":good[0] if good else ids[0],"zoom":1.06}
            if d["e"]-d["s"]>MAX and d["m"]=="FULL":
                mid=round((d["s"]+d["e"])/2,3); fixed.append(dict(d,e=mid)); fixed.append(dict(d,s=mid,zoom=1.10 if d.get("zoom",1)==1 else 1.0))
            else: fixed.append(d)
    scenes=[s for s in fixed if s["e"]-s["s"]>=0.4]
    # 4) مشهد أقصر من ثانيتين يندمج بجاره (السابق إن أمكن) — القطعة القصيرة تحسّ نقزة
    merged=[]
    for k,sc in enumerate(scenes):
        short=sc["e"]-sc["s"]<2.0 and sc["m"] not in ("HEAD","QUOTE")
        if short and merged and merged[-1]["m"] not in ("HEAD","QUOTE"):
            camsIn=[merged[-1].get("cam")] if merged[-1].get("cam") else merged[-1].get("cams",[])
            if not any(bad(c,sc["s"],sc["e"]) for c in camsIn): merged[-1]["e"]=sc["e"]; continue
        nxt=scenes[k+1] if k+1<len(scenes) else None
        if short and nxt and nxt["m"]=="HEAD" and nxt.get("cam")==sc.get("cam") and not bad(nxt["cam"],sc["s"],sc["e"]): nxt["s"]=sc["s"]; continue
        if short and nxt and nxt["m"]=="FULL" and nxt.get("cam")==sc.get("cam"): nxt["s"]=sc["s"]; continue
        merged.append(sc)
    scenes=merged
    if scenes: scenes[-1]["e"]=total
    for sc in scenes:
        if sc["m"]=="FULL":
            sc["cap"]=caption_spot(W,sc["cam"],sc["s"],sc["e"],sc.get("zoom",1),next(c for c in cams if c["id"]==sc["cam"]))
    P={"outro":json.load(open(os.path.join(W,"sfx.json"))).get("outro",1.8),"same_person":same,"close":close,"wide":wide,"scenes":scenes}
    json.dump(P,open(os.path.join(W,"plan.json"),"w"),ensure_ascii=False,indent=1)
    print("المشاهد:",len(scenes)," · ".join(f"{s['m']}{'('+str(s.get('cam') or s.get('cams'))+')'} {s['s']:.1f}-{s['e']:.1f}"+(" كابشن فوق" if s.get('cap',{}).get('y',1440)<1000 else "") for s in scenes))
    return P

# ───────────────────────── make ─────────────────────────
def make(W):
    # 1) الكابشن (fixes.json تلقائي لو ما انكتب)
    if not os.path.exists(os.path.join(W,"fixes.json")):
        tr=json.load(open(os.path.join(W,"a.json")))
        json.dump({"fix":[[w["word"].strip() for w in s.get("words",[])] for s in tr["segments"]],"hot":[]},open(os.path.join(W,"fixes.json"),"w"),ensure_ascii=False)
        print("⚠️ fixes.json ما كان موجوداً — مشيت بنص وِسبر كما هو")
    r=subprocess.run([PY,os.path.join(SC,"02_captions.py"),W],capture_output=True,text=True)
    if r.returncode!=0: sys.exit(r.stdout+r.stderr)
    print(r.stdout.splitlines()[0])
    # الكلمات الفارغة (تصحيح حذف كلمة) تُشال، والكلمات الساخنة تنسجّل بالكرت
    caps=json.load(open(os.path.join(W,"caps.json")))
    for c in caps["cards"]:
        c["w"]=[w for w in c["w"] if w["t"].strip()]; c["hot"]=[w["t"] for w in c["w"] if w.get("hot")]
    caps["cards"]=[c for c in caps["cards"] if c["w"]]
    json.dump(caps,open(os.path.join(W,"caps.json"),"w"),ensure_ascii=False,indent=1)
    # 2) الخطة
    P=plan(W)
    # 3) قصّ الشخص لمشاهد «الراس برّا الكرت»
    pm=os.path.join(W,"bt","personmask")
    if not os.path.exists(pm): subprocess.run(["swiftc","-O","-o",pm,os.path.join(SC,"personmask.swift")],capture_output=True)
    hb={}; cams=json.load(open(os.path.join(W,"cams.json")))["cams"]
    for sc in [s for s in P["scenes"] if s["m"]=="HEAD"]:
        cam=sc["cam"]; f0=int(sc["s"]*FPS)+1; f1=int(sc["e"]*FPS)+1
        src=os.path.join(W,"bt",f"src{cam}"); msk=os.path.join(W,"bt",f"mask{cam}"); per=os.path.join(W,"bt",f"p{cam}")
        for d in (src,msk,per): os.makedirs(d,exist_ok=True)
        if all(os.path.exists(os.path.join(per,f"{f:05d}.png")) for f in range(f0,f1+1)) and os.path.exists(os.path.join(msk,f"{f0:05d}.png")):
            print(f"قصّ الراس: كام{cam} {sc['s']:.1f}-{sc['e']:.1f} (جاهز من قبل)"); 
        else:
          for f in range(f0,f1+1):
            a=os.path.join(W,f"cam{cam}",f"{f:05d}.jpg");
            if os.path.exists(a): shutil.copy(a,os.path.join(src,f"{f:05d}.jpg"))
          subprocess.run([pm,src,msk,"accurate","2.5"],capture_output=True)
          sh(["ffmpeg","-v","error","-y","-start_number",str(f0),"-i",os.path.join(src,"%05d.jpg"),"-start_number",str(f0),"-i",os.path.join(msk,"%05d.png"),
            "-frames:v",str(f1-f0+1),"-filter_complex","[1:v]format=gray,scale=iw:ih[a];[0:v][a]alphamerge,format=rgba","-start_number",str(f0),os.path.join(per,"%05d.png")])
          print(f"قصّ الراس: كام{cam} {sc['s']:.1f}-{sc['e']:.1f} ({f1-f0+1} فريم)")
        # حدود ثابتة للمشهد (وسيط) — بدونها الكرت يرقص
        bs=[]; cw=next(x for x in cams if x["id"]==cam); kx=cw["w"]/270; ky=cw["h"]/480
        for f in range(f0,f1+1,4):
            d=sh(["ffmpeg","-v","error","-i",os.path.join(msk,f"{f:05d}.png"),"-vf","format=gray,scale=270:480","-f","rawvideo","-"]); a=np.frombuffer(d.stdout,np.uint8)
            if len(a)!=270*480: continue
            a=a.reshape(480,270)>140; ys=np.where(a.any(1))[0]; xs=np.where(a.any(0))[0]
            if len(ys): bs.append((xs[0]*kx,xs[-1]*kx,ys[0]*ky,ys[-1]*ky))
        if bs: hb[str(sc["s"])]={k:int(statistics.median(b[i] for b in bs)) for i,k in enumerate(["x0","x1","y0","y1"])}
        shutil.rmtree(src,ignore_errors=True)
    json.dump({"headbox":hb},open(os.path.join(W,"behind.json"),"w"))
    # 4) الرسم
    r=subprocess.run(["node",os.path.join(SC,"16_render_pod.js"),W,"all","--force"],capture_output=True,text=True)
    print((r.stdout.strip().splitlines() or ["?"])[-1]);
    if r.returncode!=0: sys.exit(r.stderr[-600:])
    # 5) التجميع + المعايرة + الترجمة + الورقة
    dur=caps["total"]+P["outro"]
    sh(["ffmpeg","-v","error","-y","-framerate","30","-i",os.path.join(W,"out","%05d.jpg"),"-i",os.path.join(W,"master.m4a"),"-map","0:v","-map","1:a",
        "-af","apad","-t",f"{dur:.3f}","-c:v","libx264","-preset","medium","-crf","19","-pix_fmt","yuv420p","-colorspace","bt709","-color_primaries","bt709","-color_trc","bt709",
        "-c:a","aac","-b:a","192k","-movflags","+faststart",os.path.join(W,"pod-final.mp4")],quiet=False)
    m=subprocess.run(["bash",os.path.join(SC,"06b_master.sh"),W,os.path.join(W,"pod-final.mp4"),os.path.join(W,"pod-master.mp4")],capture_output=True,text=True)
    lufs=[l for l in m.stdout.splitlines() if "LUFS" in l]
    subprocess.run([PY,os.path.join(SC,"09_srt.py"),W,"pod-master"],capture_output=True)
    ts=[round(dur*k,1) for k in (0.05,0.25,0.45,0.6,0.78,0.95)]
    subprocess.run(["bash",os.path.join(SC,"07_contact_sheet.sh"),W,os.path.join(W,"sheet.jpg")]+[str(t) for t in ts],capture_output=True,env={**os.environ,"SRC":os.path.join(W,"pod-master.mp4")})
    sz=os.path.getsize(os.path.join(W,"pod-master.mp4"))/1e6
    print(f"✅ pod-master.mp4 — {dur:.1f}ث · {sz:.1f} ميقا · {len(P['scenes'])} مشهد · "+(lufs[-1].strip() if lufs else "")+" · الورقة: sheet.jpg")

if __name__=="__main__":
    if len(sys.argv)<3: sys.exit(__doc__)
    cmd=sys.argv[1]; W=os.path.abspath(sys.argv[2])
    if cmd=="prep": prep(W,sys.argv[3:])
    elif cmd=="plan": plan(W)
    elif cmd=="speak":
        C=json.load(open(os.path.join(W,"cams.json"))); sp=speaker_timeline(W,C["cams"],C["start"],C["total"],C["same_audio"])
        C["same_person"]=sp["same_person"]; json.dump(C,open(os.path.join(W,"cams.json"),"w"),ensure_ascii=False,indent=1)
        print("الأشخاص:","نفس الشخص بزاويتين" if sp["same_person"] else "أشخاص مختلفون","·",sp["diag"])
    elif cmd=="make": make(W)
    else: sys.exit(__doc__)
