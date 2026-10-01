// يصوّر موقع إلكتروني كمواد لفيديو شرح (موشن أو كلام + R_OFF):
//   node 27_web_capture.js <url> <outDir> [--desktop] [--scroll 7] [--wait 2500]
// يطلّع بـ<outDir>:
//   mobile_full.png      الصفحة كاملة بعرض آيفون (393 نقطة × 3 = 1179 بكسل)
//   mobile_01.png …      الصفحة مقسومة شاشات بطول شاشة الجوال (كل وحدة = لقطة جاهزة داخل إطار جوال)
//   scroll_mobile.mp4    تمرير ناعم من فوق لتحت (--scroll ثواني، 30 فريم) — بي-رول جاهز
//   desktop_full.png / desktop_hero.png   (مع --desktop) نسخة الكمبيوتر 1440×900 ×2
//   site.json            العنوان، الوصف، العناوين h1/h2/h3، الأزرار، ألوان الخلفية والنص والتمييز، الشعار — للسكربت والثيم
// نوافذ الكوكيز والدردشة تنخفى بـCSS (ما نضغط «قبول» بالنيابة عن أحد).
const puppeteer = require('puppeteer-core');
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const CHROME = process.env.CHROME || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
const a = process.argv.slice(2);
const url = a[0], OUT = path.resolve(a[1] || 'web');
const opt = (n, d) => { const i = a.indexOf(n); return i >= 0 ? (a[i + 1] && !a[i + 1].startsWith('--') ? +a[i + 1] : true) : d; };
if (!url || !/^https?:\/\//.test(url)) { console.log('الاستخدام: node 27_web_capture.js https://example.com <مجلد> [--desktop] [--scroll 7]'); process.exit(1); }
const WAIT = opt('--wait', 2500), SCROLL = opt('--scroll', 7), DESK = !!opt('--desktop', false);
const HIDE = `[id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i],[class*="gdpr" i],
  [id*="onetrust" i],[class*="onetrust" i],[id*="intercom" i],[class*="intercom" i],[id*="crisp" i],[class*="chat-widget" i],
  iframe[src*="chat" i]{display:none!important;visibility:hidden!important}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function open(page, w, h, dpr, mobile) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
  if (mobile) await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 }).catch(() => {});
  await page.addStyleTag({ content: HIDE }).catch(() => {});
  // تمرير كامل مرة عشان الصور الكسولة (lazy) تتحمّل، ثم رجوع لفوق
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += innerHeight * 0.8) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } scrollTo(0, 0); });
  await sleep(WAIT);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars', '--lang=ar'] });
  const page = await browser.newPage();
  await open(page, 393, 852, 3, true);
  const H = await page.evaluate(() => Math.min(document.documentElement.scrollHeight, 852 * 14));
  await page.screenshot({ path: path.join(OUT, 'mobile_full.png'), clip: { x: 0, y: 0, width: 393, height: H }, captureBeyondViewport: true });
  const n = Math.min(10, Math.ceil(H / 852));
  for (let i = 0; i < n; i++) {
    await page.evaluate(y => scrollTo(0, y), i * 852); await sleep(250);
    await page.screenshot({ path: path.join(OUT, `mobile_${String(i + 1).padStart(2, '0')}.png`) });
  }
  // معلومات الموقع للسكربت والثيم
  const info = await page.evaluate(() => {
    const t = s => [...document.querySelectorAll(s)].map(e => e.innerText.trim().replace(/\s+/g, ' ')).filter(x => x && x.length < 140);
    const css = (el, p) => el ? getComputedStyle(el)[p] : null;
    const btn = document.querySelector('a[class*="btn" i],button,[class*="cta" i]');
    const icon = document.querySelector('link[rel*="apple-touch-icon"],link[rel="icon"],link[rel="shortcut icon"]');
    return { title: document.title, description: (document.querySelector('meta[name="description"],meta[property="og:description"]') || {}).content || '',
      h1: t('h1').slice(0, 3), h2: t('h2').slice(0, 10), h3: t('h3').slice(0, 12), buttons: t('a[class*="btn" i],button').slice(0, 10),
      lang: document.documentElement.lang, dir: document.documentElement.dir || css(document.body, 'direction'),
      colors: { bg: css(document.body, 'backgroundColor'), ink: css(document.querySelector('h1') || document.body, 'color'), acc: css(btn, 'backgroundColor') },
      logo: (document.querySelector('meta[property="og:image"]') || {}).content || (icon && icon.href) || '' };
  });
  info.url = url; info.mobileScreens = n; info.pageHeight = H;
  // تمرير ناعم كفيديو (ease-in-out) — فريمات بالأنبوب لـffmpeg
  if (SCROLL) {
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
      '-vf', 'scale=1080:-2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', path.join(OUT, 'scroll_mobile.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
    const N = Math.round(SCROLL * 30), maxY = Math.max(0, Math.min(H, 852 * 6) - 852);
    for (let f = 0; f < N; f++) {
      const k = f / (N - 1), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      await page.evaluate(y => scrollTo(0, y), Math.round(e * maxY));
      const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
  }
  if (DESK) {
    await open(page, 1440, 900, 2, false);
    await page.screenshot({ path: path.join(OUT, 'desktop_hero.png') });
    const DH = await page.evaluate(() => Math.min(document.documentElement.scrollHeight, 900 * 10));
    await page.screenshot({ path: path.join(OUT, 'desktop_full.png'), clip: { x: 0, y: 0, width: 1440, height: DH }, captureBeyondViewport: true });
  }
  fs.writeFileSync(path.join(OUT, 'site.json'), JSON.stringify(info, null, 1));
  await browser.close();
  console.log(`→ ${OUT} · ${n} شاشة جوال${SCROLL ? ' + تمرير ' + SCROLL + 'ث' : ''}${DESK ? ' + نسخة كمبيوتر' : ''} · «${info.title.slice(0, 60)}»`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
