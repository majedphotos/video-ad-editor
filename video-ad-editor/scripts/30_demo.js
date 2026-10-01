// ديمو سينمائي لتسجيل شاشة أو لقطات موقع: إطار جهاز + خلفية + زوم ناعم على نقطة + ميلان كاميرا ثلاثي الأبعاد
//   node 30_demo.js <demo.json> [preview 1.2 4.5 …]      ← بلا preview = الفيديو الكامل
// demo.json (المسارات نسبة لمكانه):
// {
//   "src": "screen.mov" | "web/scroll_mobile.mp4" | ["web/mobile_01.png","web/mobile_02.png"],   // فيديو، أو صور (كل وحدة hold ثانية)
//   "hold": 2.5,  "holds": [2.5,3,3],   // للصور: كم ثانية لكل صورة (holds = لكل صورة لحالها)
//   "size": [1080,1920],               // أو [1920,1080] لليوتيوب
//   "device": "phone" | "laptop" | "browser" | "none",  "url": "example.com",      // شريط العنوان بالمتصفح
//   "bg": ["#1B1530","#3A1F5C"],       // لون أو تدرّج (من theme.json لو موجود: bg + acc)
//   "tilt": 8,                         // ميلان خفيف دايم (درجات) — 0 = مسطّح
//   "zooms": [ {"s":2.0,"e":4.2,"x":0.5,"y":0.3,"scale":2.2,"tilt":0} ],   // x,y = نقطة الاهتمام بنسبة الشاشة المصوّرة (0-1)
//   "taps":  [ {"t":3.1,"x":0.62,"y":0.71} ],                              // علامة ضغط تنبض
//   "title": [ {"s":0.3,"e":2.0,"text":"افتح الإعدادات"} ],                // نص فوق الجهاز (اختياري)
//   "moves": [ {"t":0,"ry":-28,"rx":12,"s":0.85}, {"t":1.5,"ry":0,"rx":4,"s":1}, {"t":3,"s":2.1,"fx":0.5,"fy":0.22} ],  // كاميرا على الجهاز: لفّة + زوم على نقطة (fx,fy) من الشاشة
//   "float": 1,                       // تنفّس خفيف للجهاز مع moves (0 = ثابت)
//   "fps": 30, "font": "Tajawal", "ink": "#FFFFFF", "acc": "#F2B33D", "out": "demo.mp4"
// }
// القواعد: النسبة الأصلية مقدّسة (contain داخل الإطار)، الزوم يدخل ويطلع بنعومة 0.45 ث، والإيقاع من الكلام.
const puppeteer = require('puppeteer-core');
const fs = require('fs'), path = require('path'), { spawn, execFileSync } = require('child_process');
const CHROME = process.env.CHROME || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
const cfgPath = path.resolve(process.argv[2] || ''); if (!fs.existsSync(cfgPath)) { console.log('الاستخدام: node 30_demo.js demo.json [preview 1 3 5]'); process.exit(1); }
const D = JSON.parse(fs.readFileSync(cfgPath, 'utf8')), BASE = path.dirname(cfgPath);
const mode = process.argv[3] === 'preview' ? 'preview' : 'all', times = process.argv.slice(4).map(Number);
const [OW, OH] = D.size || [1080, 1920], FPS = D.fps || 30, WORK = path.join(BASE, '.demo'); fs.mkdirSync(WORK, { recursive: true });
let theme = {}; try { theme = JSON.parse(fs.readFileSync(path.join(BASE, 'theme.json'), 'utf8')); } catch (_) {}
const BG = D.bg || [theme.bg || '#141821', theme.acc ? theme.acc + '55' : '#2b3550'];
const INK = D.ink || theme.ink || '#FFFFFF', ACC = D.acc || theme.acc || '#F2B33D', FONT = D.font || theme.font || 'Tajawal';

// 1) المصدر ← فريمات + مدة
let frames = [], srcW, srcH, DUR;
const srcs = Array.isArray(D.src) ? D.src : [D.src];
if (srcs.length === 1 && /\.(mp4|mov|m4v|webm|mkv)$/i.test(srcs[0])) {
  const v = path.resolve(BASE, srcs[0]); const fd = path.join(WORK, 'src'); fs.mkdirSync(fd, { recursive: true });
  if (!fs.existsSync(path.join(fd, 'done'))) {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', v, '-vf', `fps=${FPS}`, '-q:v', '2', path.join(fd, '%05d.jpg')]); fs.writeFileSync(path.join(fd, 'done'), '');
  }
  frames = fs.readdirSync(fd).filter(f => f.endsWith('.jpg')).sort().map(f => path.join(fd, f)); DUR = frames.length / FPS;
} else {
  const hs = D.holds || srcs.map(() => D.hold || 2.5); frames = srcs.map(s => path.resolve(BASE, s)); DUR = hs.reduce((a, b) => a + b, 0);
  frames.holds = hs;
}
const probe = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', frames[0]]).toString().trim().split(',');
srcW = +probe[0]; srcH = +probe[1];
if (D.duration) DUR = Math.min(DUR, D.duration);
const frameAt = t => {
  if (frames.holds) { let acc = 0; for (let i = 0; i < frames.length; i++) { acc += frames.holds[i]; if (t < acc) return frames[i]; } return frames[frames.length - 1]; }
  return frames[Math.min(frames.length - 1, Math.floor(t * FPS))];
};

// 2) حالة الكاميرا بأي لحظة: زوم + تحريك للنقطة + ميلان
const ease = x => x < 0 ? 0 : x > 1 ? 1 : (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
function cam(t) {
  let s = 1, x = .5, y = .5, rx = 0, ry = 0, base = D.tilt ?? 8;
  for (const z of D.zooms || []) {
    const ramp = Math.min(.45, (z.e - z.s) / 3);
    const k = t < z.s ? 0 : t < z.s + ramp ? ease((t - z.s) / ramp) : t < z.e - ramp ? 1 : t < z.e ? 1 - ease((t - (z.e - ramp)) / ramp) : 0;
    if (k > 0) { s = 1 + ((z.scale || 2) - 1) * k; x = .5 + (z.x - .5) * k; y = .5 + (z.y - .5) * k; base = (z.tilt ?? 0) * k + base * (1 - k); }
  }
  ry = base * Math.sin(t * 0.35) * 0.9; rx = base * 0.55 + base * 0.25 * Math.cos(t * 0.27);
  let rz = 0, ds = 1, fx = .5, fy = .5;
  const M = D.moves || [];
  if (M.length) {   // كاميرا على الجهاز نفسه: لفّة + زوم على نقطة من الشاشة (fx,fy) — بين كل نقطتين انتقال ناعم
    let a = M[0], b = M[M.length - 1];
    for (let i = 0; i < M.length - 1; i++) if (t >= M[i].t && t <= M[i + 1].t) { a = M[i]; b = M[i + 1]; break; }
    const k = t <= M[0].t ? 0 : t >= M[M.length - 1].t ? 1 : ease((t - a.t) / Math.max(.001, b.t - a.t));
    const L = (n, d) => (a[n] ?? d) + ((b[n] ?? d) - (a[n] ?? d)) * (t <= M[0].t ? 0 : k);
    if (t <= M[0].t) { a = b = M[0]; }
    rx = L('rx', rx); ry = L('ry', ry); rz = L('rz', 0); ds = L('s', 1); fx = L('fx', .5); fy = L('fy', .5);
    const fl = D.float ?? 1; rx += fl * 1.2 * Math.sin(t * .9); ry += fl * 1.6 * Math.cos(t * .7);   // تنفّس خفيف حتى وهو ثابت
  }
  return { s, x, y, rx, ry, rz, ds, fx, fy };
}

const PAGE = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=${FONT.replace(/ /g, '+')}:wght@700;900&display=swap');
*{margin:0;box-sizing:border-box}html,body{width:${OW}px;height:${OH}px;overflow:hidden}
body{background:${Array.isArray(BG) ? `radial-gradient(120% 90% at 80% 10%, ${BG[1]} 0%, ${BG[0]} 62%)` : BG};font-family:'${FONT}',sans-serif}
#stage{position:absolute;inset:0;perspective:2200px}
#dev{position:absolute;left:50%;top:50%;transform-style:preserve-3d;will-change:transform}
#scr{position:absolute;overflow:hidden;background:#000}
#scr img{position:absolute;left:0;top:0;transform-origin:0 0}
.phone{background:#0b0b0d;box-shadow:0 60px 120px rgba(0,0,0,.55),inset 0 0 0 3px rgba(255,255,255,.18)}
.browser{background:#f4f4f6;box-shadow:0 50px 110px rgba(0,0,0,.5)}
#bar{position:absolute;left:0;right:0;top:0;height:64px;display:flex;align-items:center;gap:12px;padding:0 24px;direction:ltr}
#bar i{width:16px;height:16px;border-radius:50%;display:inline-block}
#bar b{flex:1;margin-left:18px;height:38px;border-radius:10px;background:#fff;color:#555;font:600 22px system-ui;display:flex;align-items:center;padding:0 16px}
#tap{position:absolute;width:90px;height:90px;margin:-45px 0 0 -45px;border-radius:50%;border:6px solid ${ACC};opacity:0}
#title{position:absolute;left:60px;right:60px;top:${OH > OW ? 170 : 34}px;text-align:center;color:${INK};font-weight:900;font-size:${OH > OW ? 72 : 52}px;opacity:0;z-index:20}
#title span{display:inline-block;background:rgba(8,8,16,.78);padding:10px 34px 16px;border-radius:26px;box-shadow:0 10px 40px rgba(0,0,0,.35);backdrop-filter:blur(8px)}
</style></head><body><div id="stage"><div id="dev"><div id="scr"><img id="im"></div><div id="bar"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i><b></b></div><div id="tap"></div></div></div><div id="title"></div>
<script>
const OW=${OW},OH=${OH},SW=${srcW},SH=${srcH},DEV=${JSON.stringify(D.device || 'phone')},URL_=${JSON.stringify(D.url || '')};
// حجم الجهاز: يملأ 72% من الارتفاع (طولي) أو 70% من العرض (عرضي) بنسبة المصدر بالضبط
const barH = DEV==='browser'?64:0, bez = DEV==='phone'?Math.round(Math.min(OW,OH)*0.022):DEV==='laptop'?Math.round(Math.min(OW,OH)*0.018):0;
let sh = OH>OW ? OH*0.70 : OH*0.68, sw = sh*SW/SH; const maxW = OW*(OH>OW?(DEV==='laptop'?0.86:0.84):(DEV==='laptop'?0.62:0.80));
if (sw>maxW){ sw=maxW; sh=sw*SH/SW; }
const dw=sw+2*bez, dh=sh+2*bez+barH, dev=document.getElementById('dev'), scr=document.getElementById('scr'), im=document.getElementById('im');
dev.className=DEV==='phone'?'phone':DEV==='browser'?'browser':''; dev.style.width=dw+'px'; dev.style.height=dh+'px';
dev.style.borderRadius=(DEV==='phone'?Math.round(dw*0.13):DEV==='browser'?22:DEV==='laptop'?Math.round(dw*0.025):18)+'px';
scr.style.left=bez+'px'; scr.style.top=(bez+barH)+'px'; scr.style.width=sw+'px'; scr.style.height=sh+'px';
scr.style.borderRadius=DEV==='phone'?(Math.round(dw*0.13)-bez)+'px':DEV==='browser'?'0 0 22px 22px':DEV==='laptop'?'6px':'18px';
if(DEV==='phone'){
  const R=Math.round(dw*0.13), T=Math.max(10,Math.round(dw*0.03));          // سماكة الجوال
  for(let i=1;i<=T;i++){ const e=document.createElement('div'); e.style.cssText='position:absolute;inset:0;border-radius:'+R+'px;transform:translateZ(-'+i+'px);background:'+(i===T?'#1a1a1d':'linear-gradient(90deg,#8d8f94,#d9dade 18%,#9a9ca1 50%,#e2e3e6 82%,#7f8186)'); dev.appendChild(e); }
  const btn=(side,top,h)=>{ const b=document.createElement('div'); b.style.cssText='position:absolute;'+side+':-5px;top:'+top+'px;width:6px;height:'+h+'px;border-radius:3px;background:linear-gradient(90deg,#77797e,#d4d5d8,#77797e);transform:translateZ(-'+Math.round(T/2)+'px)'; dev.appendChild(b); };
  btn('left',dh*0.20,dh*0.05); btn('left',dh*0.28,dh*0.09); btn('left',dh*0.39,dh*0.09); btn('right',dh*0.30,dh*0.14);
  const isl=document.createElement('div'); isl.style.cssText='position:absolute;left:50%;top:'+(bez+sh*0.014)+'px;width:'+(sw*0.30)+'px;height:'+(sw*0.088)+'px;margin-left:-'+(sw*0.15)+'px;border-radius:999px;background:#000;z-index:5'; dev.appendChild(isl);
  const g=document.createElement('div'); g.id='glare'; g.style.cssText='position:absolute;left:'+bez+'px;top:'+bez+'px;width:'+sw+'px;height:'+sh+'px;border-radius:'+(R-bez)+'px;pointer-events:none;z-index:6;mix-blend-mode:screen'; dev.appendChild(g); window.glare=g;
  dev.style.background='#050506';
}
if(DEV==='laptop'){
  // ماك بوك: غطاء الشاشة (إطار أسود + نوتش) والقاعدة الألمنيوم ممدودة لقدّام بزاوية
  dev.style.background='#0c0c0e'; dev.style.boxShadow='0 0 0 2px #9a9ca1, 0 40px 90px rgba(0,0,0,.45)';
  const notch=document.createElement('div'); notch.style.cssText='position:absolute;left:50%;top:0;width:'+(dw*0.11)+'px;height:'+(bez*0.9)+'px;margin-left:-'+(dw*0.055)+'px;background:#0c0c0e;border-radius:0 0 10px 10px;z-index:5'; dev.appendChild(notch);
  const base=document.createElement('div'); const bd=dh*0.66;
  base.style.cssText='position:absolute;left:-'+(dw*0.06)+'px;width:'+(dw*1.12)+'px;top:'+(dh-2)+'px;height:'+bd+'px;transform-origin:50% 0;transform:rotateX(84deg);border-radius:0 0 '+(dw*0.03)+'px '+(dw*0.03)+'px;'+
    'background:linear-gradient(180deg,#d9dbdf,#c4c6cb 60%,#b3b5ba);box-shadow:inset 0 0 0 2px #a8aaaf';
  const kb=document.createElement('div'); kb.style.cssText='position:absolute;left:12%;right:12%;top:8%;height:48%;border-radius:10px;background:repeating-linear-gradient(90deg,#2a2b2f 0 7.2%,#c8cace 7.2% 7.8%),#2a2b2f;opacity:.88';
  const tp=document.createElement('div'); tp.style.cssText='position:absolute;left:34%;right:34%;top:62%;height:30%;border-radius:12px;background:#cfd1d5;box-shadow:inset 0 0 0 2px #b9bbc0';
  base.appendChild(kb); base.appendChild(tp); dev.appendChild(base);
}
document.getElementById('bar').style.display=DEV==='browser'?'flex':'none'; document.querySelector('#bar b').textContent=URL_;
im.style.width=sw+'px'; im.style.height=sh+'px';
window.setFrame=src=>new Promise(r=>{ if(im.dataset.s===src) return r(); im.onload=()=>r(); im.dataset.s=src; im.src=src; });
window.pose=(c,tap,title)=>{
  // الزوم داخل الشاشة نفسها (المحتوى يكبر حول النقطة) + الجهاز يتقدّم شوي للكاميرا
  const s=c.s, tx=-(c.x*sw*s - sw/2) , ty=-(c.y*sh*s - sh/2);
  const clampX=Math.min(0,Math.max(sw-sw*s,tx)), clampY=Math.min(0,Math.max(sh-sh*s,ty));
  im.style.transform='translate('+clampX+'px,'+clampY+'px) scale('+s+')';
  const lift=(1+(s-1)*0.03)*(c.ds||1);
  // زوم الجهاز على نقطة: نحرّك الجهاز بحيث (fx,fy) من الشاشة يجي بنص الكادر
  const ox=-((c.fx??.5)-.5)*dw*lift, oy=-((c.fy??.5)-.5)*dh*lift;
  dev.style.transform='translate(-50%,-50%) translate('+ox+'px,'+(oy+(OH>OW?40:62)-(DEV==='laptop'?dh*0.16*lift:0))+'px) rotateX('+c.rx+'deg) rotateY('+c.ry+'deg) rotateZ('+(c.rz||0)+'deg) scale('+lift+')';
  if(window.glare) glare.style.background='linear-gradient('+(115+c.ry*2)+'deg, rgba(255,255,255,0) 30%, rgba(255,255,255,'+(0.10+Math.abs(c.ry)/250)+') 48%, rgba(255,255,255,0) 62%)';
  const tp=document.getElementById('tap');
  if(tap){ const px=bez+(tap.x*sw*s+clampX), py=bez+barH+(tap.y*sh*s+clampY); tp.style.left=px+'px'; tp.style.top=py+'px'; tp.style.opacity=tap.o; tp.style.transform='scale('+tap.k+')'; } else tp.style.opacity=0;
  const T=document.getElementById('title'); if(title){ T.innerHTML='<span></span>'; T.firstChild.textContent=title.text; T.style.opacity=title.o; T.style.transform='translateY('+(1-title.o)*30+'px)'; } else T.style.opacity=0;
};
</script></body></html>`;
fs.writeFileSync(path.join(WORK, 'page.html'), PAGE);

function tapAt(t) { for (const p of D.taps || []) { const d = t - p.t; if (d >= -.05 && d < .7) { const k = d < 0 ? 0 : d / .7; return { x: p.x, y: p.y, o: 1 - k, k: .6 + k * .9 }; } } return null; }
function titleAt(t) { for (const q of D.title || []) if (t >= q.s && t <= q.e) { const o = Math.min(1, (t - q.s) / .3, (q.e - t) / .3); return { text: q.text, o }; } return null; }

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files', '--force-device-scale-factor=1'] });
  const p = await b.newPage(); await p.setViewport({ width: OW, height: OH });
  await p.goto('file://' + path.join(WORK, 'page.html'), { waitUntil: 'networkidle0' }); await p.evaluate(() => document.fonts.ready);
  const step = async t => { await p.evaluate(s => window.setFrame(s), 'file://' + frameAt(t)); await p.evaluate((c, tp, ti) => window.pose(c, tp, ti), cam(t), tapAt(t), titleAt(t)); };
  if (mode === 'preview') {
    for (const t of times) { await step(t); await p.screenshot({ path: path.join(BASE, `demo_${t.toFixed(2)}.jpg`), type: 'jpeg', quality: 88 }); }
    console.log('معاينة:', times.map(t => `demo_${t.toFixed(2)}.jpg`).join(' '));
  } else {
    const out = path.resolve(BASE, D.out || 'demo.mp4'); const N = Math.round(DUR * FPS);
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let i = 0; i < N; i++) {
      await step(i / FPS); const buf = await p.screenshot({ type: 'jpeg', quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 150 === 0) process.stdout.write(`\r${i}/${N}`);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log(`\r→ ${out} · ${DUR.toFixed(1)} ث`);
  }
  await b.close();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
