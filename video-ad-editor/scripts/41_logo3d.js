// شعارات 3D حقيقية لريل الكلام (three.js): بلاطة بسماكة وإضاءة وانعكاس، تطلع فريمات PNG شفافة
// وتنرسم فوق المونتاج بـMV.overlay('<name>', X, t, R). يشتغل على الماك والسحابة والجوال (_chrome_flags.js).
//   node 41_logo3d.js <work> <spec.json> [preview 0.2 1.5 …]
// spec.json: { "name":"logos", "from":0, "to":6.5, "size":[1080,900], "fps":30, "rim":"#D97757", "shadow":true,
//   "tiles":[ { "img":"assets/capcut.png", "face":"#FFFFFF", "side":"#E3DED4", "size":330, "x":760, "y":420, "logoScale":0.6,
//               "keys":[ {"t":0,"s":0.6,"ry":-70,"o":0}, {"t":0.6,"s":1,"ry":0,"o":1}, {"t":3,"x":540,"ease":"inout"} ], "float":1, "phase":0 } ] }
// keys: t (ثواني من from) · x,y (بكسل داخل size) · s (حجم نسبي) · rx,ry,rz (درجات) · o (شفافية) · ease: out|inout|back|lin
const puppeteer = require('puppeteer-core');
require('../motion/vendor.js')();
const glArgs = require('./_chrome_flags.js');
const fs = require('fs'), path = require('path'), http = require('http');
const CHROME = process.env.CHROME || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
const W = path.resolve(process.argv[2] || ''), specPath = path.resolve(W, process.argv[3] || '');
if (!fs.existsSync(specPath)) { console.log('الاستخدام: node 41_logo3d.js <work> <spec.json> [preview 0.5 2]'); process.exit(1); }
const S = JSON.parse(fs.readFileSync(specPath, 'utf8')), SKILL = path.resolve(__dirname, '..');
const name = S.name || path.basename(specPath, '.json'), FPS = S.fps || 30, from = S.from || 0, to = S.to ?? (from + 3);
const mode = process.argv[4] === 'preview' ? 'preview' : 'all', times = process.argv.slice(5).map(Number);
const OUT = path.join(W, 'three', name); fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = u.startsWith('/skill/') ? path.join(SKILL, u.slice(7)) : u.startsWith('/work/') ? path.join(W, u.slice(6)) : null;
  if (!f || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); const port = srv.address().port;
  const [OW, OH] = S.size || [1080, 1080];
  const CFG = Object.assign({}, S, { size: [OW, OH], tiles: (S.tiles || []).map(t => Object.assign({}, t, { img: t.img ? `http://127.0.0.1:${port}/work/${t.img}` : null })) });
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--force-device-scale-factor=1', ...glArgs()] });
  const p = await b.newPage(); await p.setViewport({ width: OW, height: OH });
  p.on('pageerror', e => console.log('ERR', String(e).slice(0, 200)));
  await p.evaluateOnNewDocument(c => { window.CFG = c; }, CFG);
  await p.goto(`http://127.0.0.1:${port}/skill/motion/logo3d.html`, { waitUntil: 'networkidle0' });
  await p.waitForFunction('window.READY===true', { timeout: 60000 });
  const gl = await p.evaluate(() => { const g = document.querySelector('canvas').getContext('webgl2'); const d = g && g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : '?'; });
  const shot = async (lt, file) => { await p.evaluate(x => window.pose(x), lt); await p.screenshot({ path: file, omitBackground: true }); };
  if (mode === 'preview') {
    for (const t of times) await shot(t - from, path.join(OUT, `preview_${t.toFixed(2)}.png`));
    console.log(`معاينة (${gl}): three/${name}/preview_*.png`);
  } else {
    const N = Math.max(1, Math.round((to - from) * FPS)), t0 = Date.now();
    for (const f of fs.readdirSync(OUT)) if (/^\d{5}\.png$/.test(f)) fs.unlinkSync(path.join(OUT, f));
    for (let i = 0; i < N; i++) { await shot(i / FPS, path.join(OUT, String(i + 1).padStart(5, '0') + '.png')); if (i % 30 === 0) process.stdout.write(`\r${i}/${N}`); }
    fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({ name, from, to, fps: FPS, n: N, size: [OW, OH] }));
    console.log(`\r✅ three/${name}: ${N} فريم · ${((Date.now() - t0) / N).toFixed(0)} ms/فريم · ${gl}`);
  }
  await b.close(); srv.close();
})().catch(e => { console.error('❌', e.message); srv.close(); process.exit(1); });
