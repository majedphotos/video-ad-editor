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
VEND=_c["total"]; OUTRO=_s["outro"]; DUR=VEND+OUTRO
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
buf=np.clip(buf,-0.95,0.95)
pcm=(buf*32767).astype('<i2')
st=np.repeat(pcm[:,None],2,axis=1).ravel()
w=wave.open(S+"sfx.wav","wb");w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR)
w.writeframes(st.tobytes());w.close()
print("sfx ok peak",round(float(np.max(np.abs(buf))),3),"dur",round(len(pcm)/SR,2))
