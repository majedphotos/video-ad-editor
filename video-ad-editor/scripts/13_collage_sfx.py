# -*- coding: utf-8 -*-
"""مؤثرات أسلوب الكولاج — مولّدة بالرياضيات من sfx.json (يكتبه 13_collage.js).  python3 13_collage_sfx.py <sfx.json> <out.wav> <duration>"""
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
import numpy as np, wave, sys, json
SR=48000; DUR=float(sys.argv[3]); out=np.zeros(int(SR*DUR))
def put(sig,t0,g=1.0):
    i=int(t0*SR); n=min(len(sig),len(out)-i)
    if n>0: out[i:i+n]+=sig[:n]*g
def env(n,a,d):
    e=np.ones(n); A=int(a*SR); Dd=int(d*SR); e[:A]=np.linspace(0,1,A); e[-Dd:]*=np.linspace(1,0,Dd); return e
def bn(n,f1,f2):
    x=np.random.randn(n); Fq=np.fft.rfft(x); f=np.fft.rfftfreq(n,1/SR); Fq[(f<f1)|(f>f2)]=0; y=np.fft.irfft(Fq,n); return y/np.max(np.abs(y)+1e-9)
def whoosh(d=0.4,up=True):
    n=int(d*SR); bands=[(250,900),(600,2000),(1400,4500)]; bands=bands if up else bands[::-1]; seg=n//3
    y=np.concatenate([bn(seg,a,b) for a,b in bands]); y=y[:n] if len(y)>=n else np.pad(y,(0,n-len(y))); return y*env(n,0.08,0.18)*np.hanning(n)**0.5
def thud(d=0.3,f0=85,f1=42):
    n=int(d*SR); t=np.arange(n)/SR; f=np.linspace(f0,f1,n); y=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*11); c=bn(int(0.008*SR),1500,6000)*0.4; y[:len(c)]+=c; return y
def tap(d=0.06):
    n=int(d*SR); t=np.arange(n)/SR; return (np.sin(2*np.pi*1800*t)*0.5+bn(n,2500,8000)*0.6)*np.exp(-t*90)
def paper(d=0.12):
    n=int(d*SR); return bn(n,3000,12000)*env(n,0.01,0.06)*0.8
def tick():
    n=int(0.03*SR); t=np.arange(n)/SR; return bn(n,3000,9000)*np.exp(-t*160)
def ding():
    n=int(0.5*SR); t=np.arange(n)/SR; return (np.sin(2*np.pi*1320*t)+0.5*np.sin(2*np.pi*2640*t))*np.exp(-t*7)*0.5
def typ():
    y=np.zeros(int(1.2*SR))
    for k in range(16): s=tap(0.03); i=int(k*0.068*SR); y[i:i+len(s)]+=s*0.6
    return y
G={'whoosh':(lambda:whoosh(),0.55),'whoosh_d':(lambda:whoosh(0.35,False),0.6),'thud':(lambda:thud(),0.85),'thud2':(lambda:thud(0.4,120,45),1.0),'tap':(lambda:tap(),0.5),'paper':(lambda:paper(),0.8),'tick':(lambda:np.concatenate([np.pad(tick(),(0,int(0.083*SR)-int(0.03*SR))) for _ in range(12)]),0.35),'ding':(lambda:ding(),0.5),'type':(lambda:typ(),0.8)}
for e in json.load(open(sys.argv[1])):
    f,g=G[e['k']]; put(f(),e['t'],g)
out=out/np.max(np.abs(out))*0.5
with wave.open(sys.argv[2],'w') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out*32767).astype('<i2').tobytes())
print('sfx ok')
