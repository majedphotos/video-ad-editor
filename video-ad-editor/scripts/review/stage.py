# -*- coding: utf-8 -*-
"""خلفية مسرح: أشعة ضوء فوق طاولة خشب، بلون الهوية.
   python3 stage.py <out.png> [#لون] [بذرة]"""
import sys
import numpy as np, cv2
from PIL import Image
OUT = sys.argv[1]; HEX = (sys.argv[2] if len(sys.argv) > 2 else "#2E9BE8").lstrip("#"); SEED = int(sys.argv[3]) if len(sys.argv) > 3 else 11
ac = np.array([int(HEX[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)
W, H = 1440, 1920; rng = np.random.default_rng(SEED)
HZ=974
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
cx,cy=W/2,690
ang=np.arctan2(yy-cy,xx-cx); r=np.hypot(xx-cx,yy-cy)
img=np.zeros((H,W,3),np.float32)
# base night stage
base=np.exp(-((r)/620)**2)[...,None]*(ac*.5)+ac*.13
img+=base
# laser fan
cols=[ac*.8,np.clip(ac*1.2+.15,0,1),np.clip(ac[::-1]*.9+.1,0,1),ac*.55,np.clip(ac*.7+.3,0,1)]
for i in range(34):
    a=rng.uniform(-np.pi,np.pi); w=rng.uniform(.006,.03); s=rng.uniform(.45,1.25); L=rng.uniform(450,1000)
    d=np.angle(np.exp(1j*(ang-a))).astype(np.float32)
    ray=np.exp(-(d/(w*(1+120/(r+80))))**2)*np.exp(-(r/L)**2)*np.clip(r/70,0,1)
    img+=ray[...,None]*np.array(cols[i%5],np.float32)*s
img=cv2.GaussianBlur(img,(0,0),2.2)
# bokeh lights
bk=np.zeros((H,W,3),np.float32)
for i in range(26):
    x,y=int(rng.uniform(0,W)),int(rng.uniform(240,560)); R=int(rng.uniform(16,38)); c=[(1,.8,.6),(.6,.7,1),(.8,.6,1)][i%3]
    cv2.circle(bk,(x,y),R,tuple(float(v)*rng.uniform(.25,.6) for v in c),-1,cv2.LINE_AA)
img+=cv2.GaussianBlur(bk,(0,0),5)
# haze + crowd silhouettes in front of lights
haze=np.clip((yy-560)/420,0,1)[...,None]*np.array([.20,.17,.34],np.float32)
img=img*(1-.55*np.clip((yy-620)/360,0,1))[...,None]+haze
sil=np.zeros((H,W),np.float32)
for i in range(13):
    x=int(40+i*W/12+rng.uniform(-50,50)); s=rng.uniform(.8,1.3); y=int(rng.uniform(770,860))
    cv2.ellipse(sil,(x,y),(int(82*s),int(104*s)),0,0,360,1.,-1,cv2.LINE_AA)
    cv2.ellipse(sil,(x,y+int(240*s)),(int(170*s),int(170*s)),0,0,360,1.,-1,cv2.LINE_AA)
sil=cv2.GaussianBlur(sil,(0,0),15)
img=img*(1-.86*sil)[...,None]
# a few rays passing in front of the crowd
for i in range(9):
    a=rng.choice([.25,.55,2.6,2.9,.1,3.05,.8,2.3,1.6])+rng.uniform(-.05,.05); w=rng.uniform(.008,.016)
    d=np.angle(np.exp(1j*(ang-a))).astype(np.float32)
    ray=np.exp(-(d/w)**2)*np.exp(-(r/780)**2)*np.clip((r-60)/120,0,1)
    img+=cv2.GaussianBlur(ray,(0,0),2)[...,None]*np.array(cols[i%5],np.float32)*.8
# wood
def noise(sx,sy,seed):
    g=np.random.default_rng(seed).random((max(2,H//sy+2),max(2,W//sx+2)),dtype=np.float32)
    return cv2.resize(g,(W,H),interpolation=cv2.INTER_CUBIC)
g=.5*noise(260,5,1)+.3*noise(90,3,2)+.2*noise(420,14,3)
wy=yy+noise(300,120,4)*34
rings=.5+.5*np.sin(wy*.055+noise(420,70,5)*7)
g=.62*g+.38*rings
pl=(np.sin((wy-HZ)/250*np.pi*1.0))**40
c0,c1=np.array([.27,.135,.085],np.float32),np.array([.62,.40,.28],np.float32)
wood=c0+(c1-c0)*np.clip(g*1.15-.1,0,1)[...,None]
wood=wood*(1-.28*pl[...,None])
wood=wood*(.72+.5*np.clip((yy-HZ)/300,0,1)[...,None]*(1-.42*np.clip((yy-1400)/520,0,1)[...,None]))
wood=cv2.GaussianBlur(wood,(0,0),1.1)
m=np.clip((yy-HZ)/3,0,1)[...,None]
img=img*(1-m)+wood*m
img=np.clip(img,0,1)**(1/1.12)
Image.fromarray((img*255).astype(np.uint8)).save(OUT)
