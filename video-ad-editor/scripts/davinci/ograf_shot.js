// فحص رسم OGraf بالمتصفح بنفس دورة حياة دافنشي: load ← goToTime(ms) — ورقة لقطات فوق خلفية رمادية
//   node ograf_shot.js <مجلد_الرسم> <ورقة.jpg> 1.0 2.5 4.0
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os'), { execFileSync } = require('child_process');
const [, , DIR, OUT, ...TS] = process.argv;
function pup() {
  for (const p of [process.env.PUPPETEER_PATH, 'puppeteer-core', 'puppeteer', path.join(process.cwd(), 'node_modules/puppeteer-core')]) {
    if (!p) continue; try { return require(p); } catch (e) {}
  }
  throw new Error('ما لقيت puppeteer-core — شغّل bash scripts/00_setup.sh --install');
}
const CHROME = process.env.CHROME_PATH || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(f => fs.existsSync(f));
const HOST = `<html><body style="margin:0;background:#556"><div id="ograf-content" style="width:1920px;height:1080px"></div>
<script type="module">const m=await import('./main.js');customElements.define('mk-s',m.default);const el=document.createElement('mk-s');
document.getElementById('ograf-content').appendChild(el);await el.load({data:{},renderType:'non-realtime'});await el.playAction();window.el=el;window.ready=true;</script></body></html>`;
const srv = http.createServer((q, s) => {        // موديولات ES ما تنفتح من file:// — سيرفر محلي مؤقت
  const f = q.url === '/' ? null : path.join(DIR, decodeURIComponent(q.url.split('?')[0]));
  if (!f) { s.writeHead(200, { 'content-type': 'text/html' }); return s.end(HOST); }
  fs.readFile(f, (e, b) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'application/json' }); s.end(b); });
}).listen(0, async () => {
  const b = await pup().launch({ executablePath: CHROME, headless: 'new' });
  const p = await b.newPage(); await p.setViewport({ width: 1080, height: 1920 });
  p.on('pageerror', e => console.error('⚠️ خطأ بالمشهد:', e.message));
  await p.goto(`http://localhost:${srv.address().port}/`); await p.waitForFunction('window.ready', { timeout: 15000 });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ograf')), shots = [];
  for (const t of TS) { await p.evaluate(ms => el.goToTime({ timestamp: ms }), +t * 1000); const f = path.join(tmp, `${shots.length}.png`); await p.screenshot({ path: f }); shots.push(f); }
  await b.close(); srv.close();
  const n = shots.length, vf = n > 1 ? ['-filter_complex', `${shots.map((_, i) => `[${i}]`).join('')}hstack=${n},scale=${Math.min(300 * n, 1200)}:-1`] : ['-vf', 'scale=400:-1'];
  execFileSync('ffmpeg', ['-v', 'error', ...shots.flatMap(f => ['-i', f]), ...vf, '-y', OUT]);
  console.log(`✅ ${OUT} — ${n} لقطة`);
});
