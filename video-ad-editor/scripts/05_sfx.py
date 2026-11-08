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
import wave,numpy as np
import sys, os
S=os.path.abspath(sys.argv[1])+"/"
import json
SR=48000
_c=json.load(open(S+"caps.json"))
_s=json.load(open(S+"sfx.json"))
VEND=_c["total"]; OUTRO=float(_s.get("outro",0) or 0); DUR=VEND+OUTRO
n=int(DUR*SR)+SR
buf=np.zeros(n)
rng=np.random.RandomState(11)
def add(sig,t0,g=1.0):
    i=max(0,int(t0*SR)); j=min(n,i+len(sig)); buf[i:j]+=sig[:j-i]*g
def lp(x,a0,a1):
    y=np.empty_like(x); z=0.0
    for i in range(len(x)):
        a=a0+(a1-a0)*(i/len(x)); z+=a*(x[i]-z); y[i]=z
    return y
def whoosh(dur=0.34,up=True):
    L=int(dur*SR); t=np.arange(L)/SR
    x=rng.randn(L)
    y=lp(x,0.03,0.30) if up else lp(x,0.30,0.03)
    y/= (np.max(np.abs(y))+1e-9)
    env=np.sin(np.pi*np.clip(t/dur,0,1))**1.6
    return y*env
def thud(f0=135,f1=58,dur=0.30):
    L=int(dur*SR); t=np.arange(L)/SR
    f=f0*np.exp(np.log(f1/f0)*t/dur)
    ph=2*np.pi*np.cumsum(f)/SR
    s=np.sin(ph)*np.exp(-t/0.085)
    s+=lp(rng.randn(L),0.35,0.05)*np.exp(-t/0.006)*0.35
    return s/ (np.max(np.abs(s))+1e-9)
def tap(dur=0.09):
    L=int(dur*SR); t=np.arange(L)/SR
    s=lp(rng.randn(L),0.22,0.05)*np.exp(-t/0.013)
    s*=np.minimum(1.0,t/0.0012)
    return s/(np.max(np.abs(s))+1e-9)

def tick(f=2400,dur=0.03):
    L=int(dur*SR); t=np.arange(L)/SR
    s=np.sin(2*np.pi*f*t)*np.exp(-t/0.006)
    return s/(np.max(np.abs(s))+1e-9)
W1=whoosh(0.34,True); W2=whoosh(0.30,False); TH=thud(); TP=tap()
# 🎚️ لوحة أصوات موسّعة (v3.7 — طلب ماجد «ابيك تبدع بالمؤثرات الصوتية»): كل صوت لحدث بصري معيّن، مو رشّ
def riser(dur=1.2):              # صعود قبل الكشف (ينتهي على لحظة الكشف)
    L=int(dur*SR); t=np.arange(L)/SR; y=lp(rng.randn(L),0.02,0.45); y/=np.max(np.abs(y))+1e-9
    tone=np.sin(2*np.pi*np.cumsum(180+900*(t/dur)**2)/SR)*0.35
    return (y*0.8+tone)*(t/dur)**2.2
def pop(f0=900,f1=420,dur=0.12):  # فقاعة/بطاقة تطلع
    L=int(dur*SR); t=np.arange(L)/SR; f=f0*np.exp(np.log(f1/f0)*t/dur)
    s=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t/0.035); return s/(np.max(np.abs(s))+1e-9)
def click(dur=0.025):             # زر واجهة / اختيار
    L=int(dur*SR); t=np.arange(L)/SR; s=(np.sin(2*np.pi*3400*t)+0.6*rng.randn(L)*np.exp(-t/0.002))*np.exp(-t/0.004)
    return s/(np.max(np.abs(s))+1e-9)
def typing(dur=0.8,cps=12):      # كتابة حرف حرف
    L=int(dur*SR); o=np.zeros(L); k=click(0.02)
    for i in range(int(dur*cps)):
        j=int((i/cps+rng.uniform(-0.01,0.01))*SR); j=max(0,min(L-len(k),j)); o[j:j+len(k)]+=k*rng.uniform(0.5,1.0)
    return o/(np.max(np.abs(o))+1e-9)
def shimmer(dur=0.9):            # لمعة/تظليل كلمة مهمة
    L=int(dur*SR); t=np.arange(L)/SR; s=sum(np.sin(2*np.pi*f*t)*np.exp(-t/(0.25+0.1*i)) for i,f in enumerate([1760,2217,2637,3520]))
    return s/(np.max(np.abs(s))+1e-9)
def sub(dur=0.7):                # ضربة عميقة للحظة الكبيرة
    L=int(dur*SR); t=np.arange(L)/SR; f=60*np.exp(np.log(34/60)*t/dur); s=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t/0.22)
    return s/(np.max(np.abs(s))+1e-9)
def glitch(dur=0.28):            # خلل/خطأ/انكسار
    L=int(dur*SR); s=np.zeros(L)
    for _ in range(7):
        a=rng.randint(0,L-800); b=a+rng.randint(300,1600); b=min(b,L); s[a:b]+=np.round(rng.randn(b-a)*3)/3*rng.uniform(.4,1)
    return s/(np.max(np.abs(s))+1e-9)
for te,d0 in _s.get("riser",[]):  r=riser(d0); add(r,te-d0,0.07)
for t0 in _s.get("pop",[]):       add(pop(),t0,0.09)
for t0 in _s.get("click",[]):     add(click(),t0,0.08)
for t0,d0 in _s.get("type",[]):   add(typing(d0),t0,0.06)
for t0 in _s.get("shimmer",[]):   add(shimmer(),t0,0.05)
for t0 in _s.get("sub",[]):       add(sub(),t0,0.22)
for t0 in _s.get("glitch",[]):    add(glitch(),t0,0.07)
# 🔢 تكات العدّاد (motion-kit): "counter":[[بداية, مدة]] — تكات كثيفة بالبداية وتتباعد مثل MK.odometer (eExpo)
for c0,d0 in _s.get("counter",[]):
    for i in range(1,24):
        q=i/24.0; k=np.log2(1/(1-q))/10.0
        add(tick(2200+i*40),c0+k*d0,0.09)
for t0 in _s.get("whoosh_up",[]):   add(W1,t0,0.085)
for t0 in _s.get("whoosh_down",[]): add(W2,t0,0.075)
for t0 in _s.get("thud",[]):        add(TH,t0,0.115)
for t0 in _s.get("tap",[]):         add(TP,t0,0.075)
for t0,g in _s.get("soft",[]):      add(W1,t0,g)          # ووش بقوة تختارها: [[ثانية, قوة]] — العادي 0.085، الخفيف جداً 0.035
# ═══ 🆕 6.5 بنك أصوات حقيقية (CC0) + قلم وسوط وهواء + cues.json ═══════════════════════════════
# كل صوت هني مربوط بحركة صارت على الشاشة: المشهد يسجّلها بـMV.cue(نوع, ثانية, {d,g}) وقت رسمه،
# و`node 04_render_frames.js <work> cues` يجمعها بـcues.json — أو تكتبها يدوي بـsfx.json ← "fx":[[ثانية,"نوع",مدة,قوة]]
# الأنواع: tick تكّة · hit ضربة كلمة · impact ارتطام · air هواء · swish سحبة · whip سوط · pen قلم يرسم · paper ورق
#          pop · ding · clink — والطبقة كلها تنخفض تحت صوتك (دكنق) فما تغطي الكلام أبداً.
HERE=os.path.dirname(os.path.abspath(__file__)); BANK={}
try:
    _z=np.load(os.path.join(HERE,"..","sfx","bank.npz")); _ix=json.loads(bytes(_z["_index"]).decode("utf-8"))
    BANK={k:[_z[x["n"]].astype(np.float64)/32767.0 for x in v] for k,v in _ix.items()}
except Exception as _e:
    print("⚠️ بنك المؤثرات (sfx/bank.npz) ما انقرى —",_e,"— الأنواع المولّدة بس")
_last={}
def pick(k):
    """نسخة مختلفة كل مرة (ما يتكرر نفس الصوت ورا بعض) + طبقة تتغيّر ±4٪ — عشان 60 صوت ما تطلع آلة"""
    v=BANK.get(k)
    if not v: return None
    i=rng.randint(len(v))
    if len(v)>1 and i==_last.get(k): i=(i+1)%len(v)
    _last[k]=i; x=v[i]; r=rng.uniform(0.96,1.04)
    return np.interp(np.arange(0,len(x)-1,r),np.arange(len(x)),x)
def pen(dur=0.4):                 # قلم يرسم: خشخشة رفيعة بطول الخط نفسه، بنبض ضربات القلم
    dur=max(0.1,min(2.5,float(dur))); L=int(dur*SR); t=np.arange(L)/SR; n=rng.randn(L)
    y=lp(n,0.50,0.50)-lp(n,0.10,0.10)
    g=0.55+0.45*np.abs(np.sin(2*np.pi*rng.uniform(7,11)*t+rng.uniform(0,6)))
    env=np.clip(t/0.025,0,1)*np.clip((dur-t)/0.05,0,1)
    y=y*g*env; return y/(np.max(np.abs(y))+1e-9)
def whip():                       # سوط: سحبة سريعة تنتهي بطقّة
    w=pick("swish"); w=whoosh(0.16,True) if w is None else w
    L=int(0.03*SR); t=np.arange(L)/SR; c=rng.randn(L)*np.exp(-t/0.0025)
    o=np.zeros(len(w)+L); o[:len(w)]+=w*0.8; j=max(0,len(w)-int(0.012*SR)); o[j:j+L]+=c
    return o/(np.max(np.abs(o))+1e-9)
def air(dur=0.5):                 # هواء: نَفَس ناعم (عنصر يطفو/يدخل بهدوء)
    w=pick("air")
    if w is not None and dur<=0.6: return w
    return whoosh(max(0.2,float(dur)),True)
GAIN={"tick":0.050,"hit":0.070,"impact":0.090,"air":0.040,"swish":0.050,"whip":0.060,"pen":0.030,
      "paper":0.040,"pop":0.050,"ding":0.040,"clink":0.040}
PRE={"swish":0.035,"whip":0.10,"air":0.06}     # السحبة ذروتها بعد بدايتها — نقدّمها شوي عشان الذروة تجي مع الحركة
FXL=[list(x) for x in _s.get("fx",[])]
_cp=S+"cues.json"
if os.path.exists(_cp) and _s.get("cues",True) is not False:
    _cs=json.load(open(_cp)); FXL+= [[c["t"],c["k"],c.get("d"),c.get("g")] for c in _cs]
    print("🔗 cues.json:",len(_cs),"صوت مربوط بحركة")
fxb=np.zeros(n); _cnt={}
for it in FXL:
    t0,k=float(it[0]),str(it[1]); d=it[2] if len(it)>2 else None; g=it[3] if len(it)>3 and it[3] is not None else GAIN.get(k,0.05)
    if k=="pen": sig=pen(d or 0.4)
    elif k=="whip": sig=whip()
    elif k=="air": sig=air(d or 0.5)
    else:
        sig=pick(k)
        if sig is None: print("⚠️ نوع صوت ما أعرفه:",k); continue
    i=max(0,int((t0-PRE.get(k,0.0))*SR)); j=min(n,i+len(sig)); fxb[i:j]+=sig[:j-i]*g; _cnt[k]=_cnt.get(k,0)+1
if FXL:
    # 🎚️ دكنق: الطبقة تنزل ~5 ديسبل وقت ما تتكلم (من صوت cutz.mp4) — المؤثر يبقى تحت الكلام دايماً
    try:
        import subprocess as _sp
        _raw=_sp.run(["ffmpeg","-v","error","-i",S+"cutz.mp4","-vn","-ac","1","-ar",str(SR),"-f","f32le","-"],capture_output=True).stdout
        v=np.abs(np.frombuffer(_raw,np.float32)).astype(np.float64)
        if len(v):
            hop=480; m=len(v)//hop; e=np.sqrt(np.mean(v[:m*hop].reshape(m,hop)**2,axis=1))
            act=np.clip((20*np.log10(e+1e-9)+45)/12,0,1)          # -45dBFS ← 0 · -33 ← 1
            act=np.convolve(act,np.ones(7)/7,mode="same")           # تنعيم 70ms
            gn=1-0.45*act; gs=np.repeat(gn,hop)[:n]; gs=np.pad(gs,(0,max(0,n-len(gs))),constant_values=1.0)
            fxb*=gs[:n]
    except Exception as _e: print("⚠️ الدكنق ما اشتغل:",_e)
    buf+=fxb
    print("🎛️ الطبقة الجديدة:"," · ".join(f"{k} {v}" for k,v in sorted(_cnt.items(),key=lambda x:-x[1])),"— المجموع",sum(_cnt.values()))
buf=np.clip(buf,-0.95,0.95)
pcm=(buf*32767).astype('<i2')
st=np.repeat(pcm[:,None],2,axis=1).ravel()
w=wave.open(S+"sfx.wav","wb");w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR)
w.writeframes(st.tobytes());w.close()
print("sfx ok peak",round(float(np.max(np.abs(buf))),3),"dur",round(len(pcm)/SR,2))
