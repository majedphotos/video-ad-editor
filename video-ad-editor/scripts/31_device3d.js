// أجهزة ثلاثية الأبعاد حقيقية للشرح: آيفون أو ماك بوك بمعدن يعكس وزجاج وظل (three.js) — نفس demo.json حق 30_demo.js
//   node 31_device3d.js <demo.json> [preview 1.2 4.5 …]      ← بلا preview = الفيديو الكامل
// demo.json: { "src": "screen.mov" | ["a.png","b.png"], "holds":[…], "size":[1080,1920], "device":"phone"|"laptop",
//   "moves":[{"t":0,"rx":10,"ry":-30,"s":0.9},{"t":2,"s":2.2,"fx":0.4,"fy":0.2}], "taps":[{"t":3,"x":.4,"y":.2}],
//   "title":[{"s":0,"e":2,"text":"…"}], "bg":["#0B0A12","#3B2A6B"], "acc":"#D97757", "ink":"#F0EBE0", "metal":"#8f9196", "fit":"contain"|"cover", "reflect":0.25 }   // reflect: 0 = بلا انعكاس · 1 = لمعة كاملة
// (rx,ry,rz بالدرجات = لفّة الجهاز · s = قرب الكاميرا · fx,fy = النقطة اللي تقرّب عليها من الشاشة 0-1)
const puppeteer = require('puppeteer-core');
const fs = require('fs'), path = require('path'), http = require('http'), { spawn, execFileSync } = require('child_process');
const CHROME = process.env.CHROME || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
const cfgPath = path.resolve(process.argv[2] || ''); if (!fs.existsSync(cfgPath)) { console.log('الاستخدام: node 31_device3d.js demo.json [preview 1 3 5]'); process.exit(1); }
const D = JSON.parse(fs.readFileSync(cfgPath, 'utf8')), BASE = path.dirname(cfgPath), SKILL = path.resolve(__dirname, '..');
const mode = process.argv[3] === 'preview' ? 'preview' : 'all', times = process.argv.slice(4).map(Number);
const [OW, OH] = D.size || [1080, 1920], FPS = D.fps || 30, WORK = path.join(BASE, '.device3d'); fs.mkdirSync(WORK, { recursive: true });
let theme = {}; try { theme = JSON.parse(fs.readFileSync(path.join(BASE, 'theme.json'), 'utf8')); } catch (_) {}

// المصدر ← فريمات (نفس منطق 30_demo.js)
let frames = [], DUR, holds = null;
const srcs = Array.isArray(D.src) ? D.src : [D.src];
const isVid = srcs.length === 1 && /\.(mp4|mov|m4v|webm|mkv)$/i.test(srcs[0]);
if (isVid) {
  const fd = path.join(WORK, 'src'); fs.mkdirSync(fd, { recursive: true });
  if (!fs.existsSync(path.join(fd, 'done'))) { execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.resolve(BASE, srcs[0]), '-vf', `fps=${FPS}`, '-q:v', '2', path.join(fd, '%05d.jpg')]); fs.writeFileSync(path.join(fd, 'done'), ''); }
  frames = fs.readdirSync(fd).filter(f => f.endsWith('.jpg')).sort().map(f => path.join(fd, f)); DUR = frames.length / FPS;
} else { frames = srcs.map(s => path.resolve(BASE, s)); holds = D.holds || srcs.map(() => D.hold || 2.5); DUR = holds.reduce((a, b) => a + b, 0); }
if (D.duration) DUR = Math.min(DUR, D.duration);
const frameAt = t => { if (holds) { let a = 0; for (let i = 0; i < frames.length; i++) { a += holds[i]; if (t < a) return frames[i]; } return frames[frames.length - 1]; }
  return frames[Math.min(frames.length - 1, Math.floor(t * FPS))]; };

const ease = x => x < 0 ? 0 : x > 1 ? 1 : (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
function cam(t) {
  const M = D.moves && D.moves.length ? D.moves : [{ t: 0, rx: 8, ry: -18, s: 1 }, { t: DUR, rx: 6, ry: 18, s: 1 }];
  let a = M[0], b = M[M.length - 1], k = 0;
  if (t <= M[0].t) { a = b = M[0]; } else if (t >= M[M.length - 1].t) { a = b = M[M.length - 1]; }
  else for (let i = 0; i < M.length - 1; i++) if (t >= M[i].t && t <= M[i + 1].t) { a = M[i]; b = M[i + 1]; k = ease((t - a.t) / Math.max(.001, b.t - a.t)); break; }
  const L = (n, d) => (a[n] ?? d) + ((b[n] ?? d) - (a[n] ?? d)) * k, fl = D.float ?? 1;
  return { rx: L('rx', 0) + fl * 1.2 * Math.sin(t * .9), ry: L('ry', 0) + fl * 1.6 * Math.cos(t * .7), rz: L('rz', 0), s: L('s', 1), fx: L('fx', .5), fy: L('fy', .5), lift: fl * 0.015 * Math.sin(t * 1.1) };
}
function tapAt(t) { for (const p of D.taps || []) { const d = t - p.t; if (d >= -.05 && d < .7) { const k = Math.max(0, d) / .7; return { x: p.x, y: p.y, o: 1 - k, k: .6 + k * 1.2 }; } } return null; }
function titleAt(t) { for (const q of D.title || []) if (t >= q.s && t <= q.e) return { text: q.text, o: Math.min(1, (t - q.s) / .3, (q.e - t) / .3) }; return null; }

// خادم محلي صغير: /skill/… = مجلد السكل (three.js والخطوط) · /work/… = مجلد demo.json (اللقطات)
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ttf': 'font/ttf' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = u.startsWith('/skill/') ? path.join(SKILL, u.slice(7)) : u.startsWith('/work/') ? path.join('/', u.slice(6)) : null;
  if (!f || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); const port = srv.address().port;
  const CFG = { size: [OW, OH], device: D.device || 'phone', bg: D.bg || [theme.bg || '#0B0A12', theme.acc ? theme.acc + '66' : '#3B2A6B'],
    acc: D.acc || theme.acc || '#D97757', ink: D.ink || theme.ink || '#F0EBE0', font: D.font || theme.font || 'Cairo', metal: D.metal, fit: D.fit || 'contain', reflect: D.reflect ?? 0.25 };
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--force-device-scale-factor=1'] });
  const p = await b.newPage(); await p.setViewport({ width: OW, height: OH });
  p.on('pageerror', e => console.log('ERR', String(e).slice(0, 200)));
  await p.evaluateOnNewDocument(c => { window.CFG = c; }, CFG);
  await p.goto(`http://127.0.0.1:${port}/skill/motion/device3d.html`, { waitUntil: 'networkidle0' });
  await p.addStyleTag({ content: `@font-face{font-family:Cairo;src:url(/skill/motion/fonts/Cairo-VF.ttf);font-weight:200 1000}@font-face{font-family:Tajawal;src:url(/skill/motion/fonts/Tajawal-Black.ttf);font-weight:900}` });
  await p.waitForFunction('window.READY===true', { timeout: 30000 }); await p.evaluate(() => document.fonts.ready);
  const step = async t => { await p.evaluate(s => window.setFrame(s), `http://127.0.0.1:${port}/work${frameAt(t)}`); await p.evaluate((c, tp, ti) => window.pose(c, tp, ti), cam(t), tapAt(t), titleAt(t)); };
  if (mode === 'preview') {
    for (const t of times) { await step(t); await p.screenshot({ path: path.join(BASE, `d3_${t.toFixed(2)}.jpg`), type: 'jpeg', quality: 90 }); }
    console.log('معاينة:', times.map(t => `d3_${t.toFixed(2)}.jpg`).join(' '));
  } else {
    const out = path.resolve(BASE, D.out || 'device3d.mp4'), N = Math.round(DUR * FPS);
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let i = 0; i < N; i++) { await step(i / FPS); const buf = await p.screenshot({ type: 'jpeg', quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); if (i % 150 === 0) process.stdout.write(`\r${i}/${N}`); }
    ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log(`\r→ ${out} · ${DUR.toFixed(1)} ث`);
  }
  await b.close(); srv.close();
})().catch(e => { console.error('❌', e.message); srv.close(); process.exit(1); });
