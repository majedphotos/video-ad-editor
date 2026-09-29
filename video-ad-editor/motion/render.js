#!/usr/bin/env node
/* ═══ render.js — يرسم مشروع «شرح بالموشن» بكروم بلا واجهة (GPU حقيقي) ═══
   node render.js <proj> preview <t1> <t2> ...   → renders/preview/*.png + contact.png
   node render.js <proj> range <a> <b>           → فريمات a..b (ثواني) + renders/range-a-b.mp4
   node render.js <proj> all                     → كل الفريمات JPEG q95 (استئناف) + renders/video.mp4
   node render.js <proj> bench [n]               → قياس: وقت رسم المشهد مقابل ترميز JPEG (بلا كتابة ملفات)
   node render.js <proj> serve                   → مشغّل للمعاينة بالمتصفح (سحب/تشغيل)
   خيارات: --scale 0.5 (مسودة سريعة) · --safe (تراكب المنطقة الآمنة بالمعاينة) · --workers N (صفحات متوازية، افتراضي 2)
           --fps N (تجاوز) · --crf 16 · --no-encode · --q 0.95 · --fresh (يمسح الفريمات القديمة — لازم بعد أي تعديل بالمشاهد)
   ⚠ الاستئناف يتخطّى أي فريم موجود: عدّلت مشهد؟ استخدم --fresh أو range على المقطع المعدّل بعد حذف فريماته. */
const fs = require('fs'), path = require('path'), http = require('http'), { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');                        // video-ad-editor (serves /motion, /scripts)
const LOGOS = path.resolve(__dirname, '../../hook-assets/logos');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
let puppeteer; try { puppeteer = require('puppeteer-core'); } catch (e) { puppeteer = require(path.resolve(__dirname, '../../node_modules/puppeteer-core')); }

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); if (i < 0) return d; const v = argv[i + 1]; return v === undefined || v.startsWith('--') ? true : v; };
const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && !['--safe', '--no-encode', '--fresh'].includes(argv[i - 1])));
const [projArg, mode = 'preview', ...rest] = pos;
if (!projArg) { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 9).join('\n')); process.exit(1); }
const PROJ = path.resolve(projArg);
if (!fs.existsSync(path.join(PROJ, 'project.json'))) { console.error('❌ ما لقيت project.json في ' + PROJ); process.exit(2); }
const SCALE = parseFloat(flag('scale', '1')), SAFE = !!flag('safe', false), WORKERS = parseInt(flag('workers', mode === 'all' || mode === 'range' ? '2' : '1'));
const Q = parseFloat(flag('q', '0.95')), CRF = String(flag('crf', '16')), NOENC = !!flag('no-encode', false), FRESH = !!flag('fresh', false);
const proj = JSON.parse(fs.readFileSync(path.join(PROJ, 'project.json'), 'utf8'));

/* ── static server: /proj/* → project, /@logos/* → hook-assets/logos, else → video-ad-editor ── */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.css': 'text/css' };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let u = decodeURIComponent(req.url.split('?')[0]), file;
      if (u.startsWith('/proj/')) file = path.join(PROJ, u.slice(6));
      else if (u.startsWith('/@logos/')) file = path.join(LOGOS, u.slice(8));
      else file = path.join(ROOT, u);
      if (u === '/' || u === '') { rsp.writeHead(302, { Location: '/motion/engine.html?proj=/proj/' }); return rsp.end(); }
      fs.readFile(file, (err, data) => {
        if (err) { rsp.writeHead(404); return rsp.end('404 ' + u); }
        rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); rsp.end(data);
      });
    });
    srv.listen(parseInt(flag('port', '0')), '127.0.0.1', () => res(srv));
  });
}

async function openPage(browser, port, safe) {
  const page = await browser.newPage();
  const W = Math.round((proj.width || 1080) * SCALE), H = Math.round((proj.height || 1920) * SCALE);
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', m => { const t = m.text(); if ((m.type() === 'error' || m.type() === 'warning') && !/Failed to load resource/.test(t)) { logs.push(t); console.log('  [page ' + m.type() + '] ' + t); } });
  page.on('pageerror', e => console.log('  [page error] ' + e.message));
  page.on('response', r => { const u = r.url(); if (r.status() >= 400 && !/favicon|timeline\.json/.test(u)) console.log('  [404] ' + u); });
  await page.goto(`http://127.0.0.1:${port}/motion/engine.html?proj=/proj/&render=1&scale=${SCALE}${safe ? '&safe=1' : ''}`, { waitUntil: 'load' });
  await page.waitForFunction('window.MOTION && (MOTION.ready || MOTION.error)', { timeout: 60000 });
  const err = await page.evaluate('MOTION.error');
  if (err) throw new Error('engine boot failed:\n' + err);
  return page;
}
const b64 = d => Buffer.from(d.slice(d.indexOf(',') + 1), 'base64');
const ffmpeg = args => { const r = spawnSync('ffmpeg', args, { stdio: ['ignore', 'inherit', 'inherit'] }); if (r.status !== 0) throw new Error('ffmpeg failed'); };

function encode(frameDir, fps, out, startNumber = 0, count = null) {
  const args = ['-y', '-v', 'error', '-stats', '-framerate', String(fps), '-start_number', String(startNumber), '-i', path.join(frameDir, 'f_%06d.jpg')];
  if (count) args.push('-frames:v', String(count));
  args.push('-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF,
    '-profile:v', 'high', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-r', String(fps), '-movflags', '+faststart', out);
  ffmpeg(args);
}

(async () => {
  const srv = await serve(), port = srv.address().port;
  if (mode === 'serve') { console.log(`▶ افتح: http://127.0.0.1:${port}/motion/engine.html?proj=/proj/${SAFE ? '&safe=1' : ''}\n  (Ctrl+C للإيقاف)`); return; }
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--force-color-profile=srgb', '--hide-scrollbars', '--mute-audio', '--disable-features=CalculateNativeWinOcclusion'],
  });
  const R = path.join(PROJ, 'renders');
  try {
    const page = await openPage(browser, port, SAFE && mode === 'preview');
    const info = await page.evaluate('MOTION.info');
    const fps = parseInt(flag('fps', String(info.fps)));
    console.log(`🎬 ${proj.name || path.basename(PROJ)} · ${info.W}x${info.H} ×${SCALE} · ${fps}fps · ${info.duration.toFixed(3)}s · GPU: ${info.gpu || '(no 3D yet)'}`);
    if (mode === 'preview') {
      const times = rest.length ? rest.map(Number) : [0, info.duration * .25, info.duration * .5, info.duration * .75, info.duration - 1 / fps];
      const dir = path.join(R, 'preview'); fs.mkdirSync(dir, { recursive: true });
      for (const t of times) {
        const t0 = Date.now(); const d = await page.evaluate(t => MOTION.framePNG(t), t);
        const f = path.join(dir, `t${t.toFixed(3).padStart(8, '0')}.png`); fs.writeFileSync(f, b64(d)); console.log(`  ✓ ${path.relative(PROJ, f)}  (${Date.now() - t0} ms)`);
      }
      const gpu = await page.evaluate('MOTION.gpu'); if (gpu) console.log('  GPU: ' + gpu);
      const sheet = await page.evaluate((ts) => MOTION.contactSheet(ts, Math.min(ts.length, 5)), times);
      fs.writeFileSync(path.join(dir, 'contact.png'), b64(sheet)); console.log('  ✓ renders/preview/contact.png');
      return;
    }
    if (mode === 'bench') {                           // split cost: scene render vs JPEG encode (no disk writes)
      const r = await page.evaluate((fps, n, q) => { let R = 0, J = 0; for (let i = 0; i < n; i++) { const t = (i * 7 % Math.floor(MOTION.info.duration * fps)) / fps; let a = performance.now(); MOTION.renderFrame(t); R += performance.now() - a; a = performance.now(); document.getElementById('out').toDataURL('image/jpeg', q); J += performance.now() - a; } return [R / n, J / n]; }, fps, parseInt(rest[0] || '120'), Q);
      console.log(`⏱  bench ×${SCALE}: renderFrame ${r[0].toFixed(1)} ms · jpeg encode ${r[1].toFixed(1)} ms · total ${(r[0] + r[1]).toFixed(1)} ms/frame (1 page)`); return;
    }
    let a = 0, b = info.duration;
    if (mode === 'range') { a = parseFloat(rest[0]); b = parseFloat(rest[1]); if (!(b > a)) throw new Error('range needs <a> <b> with b > a'); }
    else if (mode !== 'all') throw new Error('unknown mode ' + mode);
    const total = Math.round(info.duration * fps), f0 = Math.max(0, Math.round(a * fps)), f1 = Math.min(total, Math.round(b * fps));   // [f0, f1)
    const frameDir = path.join(R, SCALE === 1 ? 'frames' : `frames_s${SCALE}`);
    if (FRESH && fs.existsSync(frameDir)) fs.rmSync(frameDir, { recursive: true });   // scenes changed → old frames are stale
    fs.mkdirSync(frameDir, { recursive: true });
    const todo = []; for (let f = f0; f < f1; f++) { const p = path.join(frameDir, `f_${String(f).padStart(6, '0')}.jpg`); if (!(fs.existsSync(p) && fs.statSync(p).size > 1000)) todo.push(f); }
    console.log(`  frames ${f0}..${f1 - 1} → ${todo.length} to render (${f1 - f0 - todo.length} resumed) · workers ${WORKERS}`);
    const pages = [page]; for (let i = 1; i < Math.min(WORKERS, todo.length); i++) pages.push(await openPage(browser, port, false));
    let done = 0, renderMs = 0; const T0 = Date.now(); let next = 0;
    await Promise.all(pages.map(async pg => {
      while (next < todo.length) {
        const f = todo[next++], t = f / fps, s = Date.now();
        const d = await pg.evaluate((t, q) => { const a = performance.now(); const u = MOTION.frameJPEG(t, q); return [u, performance.now() - a]; }, t, Q);
        const p = path.join(frameDir, `f_${String(f).padStart(6, '0')}.jpg`); fs.writeFileSync(p + '.tmp', b64(d[0])); fs.renameSync(p + '.tmp', p);
        renderMs += d[1]; done++;
        if (done % 30 === 0 || done === todo.length) {
          const wall = (Date.now() - T0) / done;
          process.stdout.write(`\r  ${done}/${todo.length}  in-page ${(renderMs / done).toFixed(1)} ms/frame · wall ${wall.toFixed(1)} ms/frame · ETA ${((todo.length - done) * wall / 1000).toFixed(0)}s   `);
        }
      }
    }));
    if (todo.length) { const wall = (Date.now() - T0) / todo.length; console.log(`\n⏱  in-page render+jpeg ${(renderMs / todo.length).toFixed(1)} ms/frame · wall ${wall.toFixed(1)} ms/frame (${WORKERS} workers) · ${(1000 / wall).toFixed(1)} fps`); }
    if (NOENC) return;
    const out = mode === 'all' ? path.join(R, SCALE === 1 ? 'video.mp4' : `video_s${SCALE}.mp4`) : path.join(R, `range-${a}-${b}${SCALE === 1 ? '' : '_s' + SCALE}.mp4`);
    console.log('🎞  encoding → ' + path.relative(PROJ, out));
    encode(frameDir, fps, out, f0, f1 - f0);
    const pr = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height,r_frame_rate,nb_frames,pix_fmt', '-of', 'csv=p=0', out]).stdout.toString().trim();
    console.log('✅ ' + out + '  [' + pr + ']');
  } finally { await browser.close(); srv.close(); }
})().catch(e => { console.error('❌ ' + (e.stack || e)); process.exit(1); });
