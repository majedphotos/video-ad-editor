// فحص لوتي بالعين بلا دافنشي: يرسم ملف لوتي بلحظات معيّنة فوق خلفية رمادية ويجمعها بورقة وحدة
//   node lottie_shot.js <ملف.json> <ورقة.jpg> 2.0 41.5 43.0
// دافنشي يرسمه بنفس مكتبة لوتي-ويب (OGrafLoader)، فاللي تشوفه هني هو اللي يطلع هناك تقريباً.
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const [, , J, OUT, ...TS] = process.argv;
if (!J || !OUT || !TS.length) { console.error('الاستخدام: node lottie_shot.js <ملف.json> <ورقة.jpg> <ثانية> …'); process.exit(2); }
function pup() {
  for (const p of [process.env.PUPPETEER_PATH, 'puppeteer-core', 'puppeteer', path.join(process.cwd(), 'node_modules/puppeteer-core')]) {
    if (!p) continue; try { return require(p); } catch (e) {}
  }
  throw new Error('ما لقيت puppeteer-core — شغّل bash scripts/00_setup.sh --install');
}
const CHROME = process.env.CHROME_PATH || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(f => fs.existsSync(f));
(async () => {
  const b = await pup().launch({ executablePath: CHROME, headless: 'new' });
  const p = await b.newPage(); await p.setViewport({ width: 1080, height: 1920 });
  const lib = fs.readFileSync(path.join(__dirname, 'lottie_svg.min.js'), 'utf8');
  await p.setContent(`<body style="margin:0;background:#556"><div id=a style="width:1080px;height:1920px"></div><script>${lib}</script>`);
  await p.evaluate(d => { window.A = lottie.loadAnimation({ container: document.getElementById('a'), renderer: 'svg', loop: false, autoplay: false, animationData: JSON.parse(d) }); },
    fs.readFileSync(J, 'utf8'));
  const fr = await p.evaluate(() => A.frameRate || 30), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lshot')), shots = [];
  for (const t of TS) { await p.evaluate(f => A.goToAndStop(f, true), Math.round(+t * fr)); const f = path.join(tmp, `${shots.length}.png`); await p.screenshot({ path: f }); shots.push(f); }
  await b.close();
  const n = shots.length, inp = shots.flatMap(f => ['-i', f]);
  const vf = n > 1 ? ['-filter_complex', `${shots.map((_, i) => `[${i}]`).join('')}hstack=${n},scale=${Math.min(300 * n, 1200)}:-1`]
                   : ['-vf', 'scale=400:-1'];
  execFileSync('ffmpeg', ['-v', 'error', ...inp, ...vf, '-y', OUT]);
  console.log(`✅ ${OUT} — ${n} لقطة`);
})();
