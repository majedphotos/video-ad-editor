<!-- مرجع لسكل video-ad-editor — يُقرأ عند الحاجة فقط -->

# تسجيل الشاشة داخل إطار جوال — قواعد وشيفرة جاهزة (v2.9)

## القواعد (معتمدة من المستخدم 13 سبتمبر 2026)
1. **النسبة مقدّسة:** التسجيل يُعرض كاملاً بنسبته الأصلية — `sc = Math.min(R.w/sw, R.h/shh)` ويُوسَّط. لا `Math.max` (يقصّ) ولا تمديد. اختبارك: أي دائرة بالتسجيل (صورة بروفايل) لازم تبقى دائرة.
2. **الإطار بنسبة التسجيل:** `PH_W = PH_H / (shh/sw)`. لو التسجيل 1080×2346 فالنسبة 2.172. الإطار مرسوم بالكود (حاد بأي حجم)، وممنوع تمديد صورة إطار PNG صغيرة.
3. **داخل المنطقة الآمنة:** y من 150 إلى 1480، والخلفية بالشبكة وراه. المتحدث `R_OFF` والكابشن مخفي أثناءها.
4. **كت مباشر** بين اللقطات — بلا دخول/خروج ولا زوم. الإيقاع من الكلام: كل خطوة ينطقها = لقطة.
5. **علامة الضغط** بإحداثيات **بكسل المصدر** (اقرأها من فريم مكبّر بـPIL)، تُحوَّل بنفس `sc/dx/dy` اللي رُسم بها التسجيل. خط تحت كلمة: `underline()`.
6. **شريط التقدّم** ينزل لـy=1846 أثناء التسجيل (سطر بلا نص) — اسمح له بـ`safe.json`: `أسفل الشاشة max: 0.006`.

## استخراج اللقطات
```bash
ffmpeg -v error -y -ss <من> -t <مدة> -i screen.MP4 -vf "fps=30,scale=1080:-2" broll/<اسم>_%04d.jpg
```
وعرّفها بـ`BR_NEED={<اسم>:[1,<عدد>]}`.

## الشيفرة (من compose.html لفيديو إيديتس — انسخها كما هي)
```js
const PH_H=1320, PH_W=Math.round(PH_H/2.172);                      /* نسبة تسجيل الشاشة نفسه 1080×2346 — بلا أي ضغط، تصغير نسبي فقط (ماجد 13 سبتمبر) */
const PH={x:Math.round(540-PH_W/2),y:150,w:PH_W,h:PH_H,r:Math.round(PH_W*0.16)};
function fullShot(k,dt,crop,tap){
  const im=brFrame(k,dt,1); if(!im) return;
  const [sx,sy,sw,shh]=crop; const bz=Math.round(PH.w*0.032); const R={x:PH.x+bz,y:PH.y+bz,w:PH.w-2*bz,h:PH.h-2*bz,r:PH.r-bz};
  X.save(); sh(70,28,0.30); X.fillStyle='#111'; rr(PH.x,PH.y,PH.w,PH.h,PH.r); X.fill(); nsh();
  X.strokeStyle='rgba(255,255,255,0.35)'; X.lineWidth=3; rr(PH.x+4,PH.y+4,PH.w-8,PH.h-8,PH.r-4); X.stroke();
  X.save(); rr(R.x,R.y,R.w,R.h,R.r); X.clip();
  /* التسجيل كاملاً بنسبته: نحسب مقياساً واحداً للعرض والطول (contain) ونوسّطه داخل الشاشة */
  const sc=Math.min(R.w/sw,R.h/shh); const dw=sw*sc, dh=shh*sc; const dx=R.x+(R.w-dw)/2, dy=R.y+(R.h-dh)/2;
  X.fillStyle='#000'; X.fillRect(R.x,R.y,R.w,R.h); X.drawImage(im,sx,sy,sw,shh,dx,dy,dw,dh); X.restore();
  window._SHOTMAP={sc,dx,dy,sx,sy};
  X.fillStyle='#111'; rr(540-PH.w*0.17,PH.y+bz+10,PH.w*0.34,PH.w*0.055,PH.w*0.03); X.fill();   /* الجزيرة الديناميكية */
  X.restore();
  if(tap){ const M=window._SHOTMAP; const px=M.dx+(tap[0]-M.sx)*M.sc, py=M.dy+(tap[1]-M.sy)*M.sc; const ph=(dt-(tap[2]||0.4)); if(ph<0||ph>1.2) return;
    if(px<R.x||px>R.x+R.w||py<R.y||py>R.y+R.h) return;
    X.save(); X.strokeStyle=ACC; X.lineWidth=8; X.globalAlpha=1-pr(ph,0.8,1.2); X.beginPath(); X.arc(px,py,44,0,7); X.stroke();
    X.globalAlpha=0.7*(1-pr(ph,0.2,0.9)); X.lineWidth=5; X.beginPath(); X.arc(px,py,44+ph*110,0,7); X.stroke();
    X.globalAlpha=0.45*(1-pr(ph,0,0.6)); X.fillStyle=ACC; X.beginPath(); X.arc(px,py,30,0,7); X.fill(); X.restore(); }
}
const SCR=[0,0,1080,2346];
/* خط برتقالي ينكتب تحت كلمة بالشاشة: pos=[x,y,عرض] ببكسل المصدر */
function underline(k,dt,at,pos,crop){ if(dt<at) return; const [sx,sy,sw,shh]=crop; const bz=Math.round(PH.w*0.032); const R={x:PH.x+bz,y:PH.y+bz,w:PH.w-2*bz,h:PH.h-2*bz};
  const M=window._SHOTMAP; if(!M) return; const x=M.dx+(pos[0]-M.sx)*M.sc, y=M.dy+(pos[1]-M.sy)*M.sc, w=pos[2]*M.sc*sm(pr(dt,at,at+0.35));
  X.save(); X.strokeStyle=ACC; X.lineWidth=7; X.lineCap='round'; X.beginPath(); X.moveTo(x,y); X.lineTo(x+w,y); X.stroke(); X.restore(); }

```
وبـ`bar(t)` أضف أول سطر: `if(t>=<بداية>&&t<<نهاية>){ X.save(); X.globalAlpha=a; X.fillStyle=ACC; X.fillRect(0,1846,W*(t/DUR),6); X.restore(); return; }`
وبـ`caption(t)`: `if(t>=<بداية>&&t<<نهاية>) return;`
