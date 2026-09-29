/* 🥁 23_beatfx_render.js — يركّب مؤثرات النبضة (beat-fx.js) على أي فيديو جاهز: مونتاج أو ريل.
   node scripts/23_beatfx_render.js <work> <in.mp4> [خيارات]
     --beats <beats.json>     النبضات (من beat.py). الافتراضي <work>/beats.json
     --audio <ملف|none>       الصوت اللي ينحط بالمخرَج (الأغنية). الافتراضي: صوت <in.mp4> لو فيه، وإلا صامت
     --cuts <montage.json>    قطعات المونتاج (12_montage.py plan --beats يكتبها) — الانتقالات تنحط عليها.
                              الافتراضي <work>/montage.json لو فيه cuts
     --density low|mid|high   كثافة المؤثرات (mid)       --style hype|clean   (hype للمونتاج، clean للكلام)
     --words "كلمة،كلمة"      كلمات تضرب على الضربات القوية (textSlam) — بالترتيب
     --theme <theme.json>     ألوان صاحب الفيديو (الافتراضي <work>/theme.json) — ⛔ لا تحط ألوان غيره.
                              بدونه: وضع محايد (مسح أسود، كلمة بيضاء، تسريب بلون اللقطة) — ولا لون من هوية أحد
     --unsafe                 يسمح بالستروب ويشيل سقف الومضات (⛔ خطر على الحساسين للوميض — بس بطلب صريح)
     --replan                 يعيد التصميم الآلي حتى لو فيه <work>/beatfx.json (عدّلته يدوياً؟ لا تحطه)
     --out <out.mp4>          الافتراضي <work>/beatfx.mp4
     --preview 1.2 3.4        يرسم فريمات معيّنة بس (سريع) إلى <work>/beatfx-prev/
     --sheet                  ورقة فحص: لكل ضربة 4 فريمات (قبلها بفريم · عليها · +1 · +3) مع اسم المؤثر → <work>/beatfx-sheet.jpg
   التصميم الآلي يتكتب بـ<work>/beatfx.json — عدّله (غيّر fx/k/t) وأعد التشغيل بلا --replan.

   🗣️ فيديو الكلام (المؤثرات ترتسم داخل compose.html بـBFX.attach) — نفس الخطة ونفس الورقة:
     node 23_beatfx_render.js <work> - --plan-only --style clean --density low [--avoid 0:3.2] [--loop] [--words …]
          ← يكتب <work>/beatfx.json بس (الطول من <work>/caps.json أو --dur). --loop = الملف الصوتي يتكرر (06b_master يكرره)
          وبـcompose.html:  BFX.attach({events:'beatfx.json'})
     node 23_beatfx_render.js <work> <الفيديو_النهائي.mp4> --check
          ← ما يرسم شي: يطلع ورقة الفحص من الفيديو الجاهز على نفس <work>/beatfx.json → <work>/beatfx-sheet.jpg */
const path = require('path'), fs = require('fs'), { execFileSync, spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const fileURL = p => pathToFileURL(p).href;
const A = process.argv.slice(2);
if (A.length < 2) { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]); process.exit(1); }
const W = path.resolve(A[0]) + path.sep, IN = A[1] === '-' ? null : path.resolve(A[1]);
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && i + 1 < A.length ? A[i + 1] : d; };
const has = n => A.includes(n);
const FPS = 30;
fs.mkdirSync(W, { recursive: true });
const PLAN_ONLY = has('--plan-only'), CHECK = has('--check');
if (!IN && !PLAN_ONLY) { console.error('❌ حدد الفيديو (بدل -)'); process.exit(2); }
if (IN && !fs.existsSync(IN)) { console.error('❌ الفيديو مو موجود: ' + IN); process.exit(2); }

function resolvePuppeteer() {
  for (const p of [process.env.PUPPETEER_PATH, 'puppeteer-core', 'puppeteer', path.join(process.cwd(), 'node_modules/puppeteer-core'),
    path.join(__dirname, '../../node_modules/puppeteer-core')]) { if (!p) continue; try { return require(p); } catch (e) { } }
  throw new Error('ما لقيت puppeteer-core — ثبّته: npm i puppeteer-core');
}
function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const LA = process.env.LOCALAPPDATA || '', PF = process.env.ProgramFiles || 'C:/Program Files', P86 = process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)';
  for (const c of ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', PF + '/Google/Chrome/Application/chrome.exe', P86 + '/Google/Chrome/Application/chrome.exe',
    LA + '/Google/Chrome/Application/chrome.exe', PF + '/Microsoft/Edge/Application/msedge.exe', P86 + '/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) { try { if (c && fs.existsSync(c)) return c; } catch (e) { } }
  throw new Error('ما لقيت كروم — حدّد CHROME_PATH');
}
const probe = f => { try { return JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', f]).toString()); } catch (e) { return null; } };

(async () => {
  const BFX = require(path.join(__dirname, 'beat-fx.js'));
  let VW = 1080, VH = 1920, dur = 0, hasA = false;
  if (IN) {
    const pi = probe(IN); if (!pi) { console.error('❌ ما قدرت أقرأ الفيديو'); process.exit(2); }
    const vs = pi.streams.find(s => s.codec_type === 'video'); hasA = pi.streams.some(s => s.codec_type === 'audio');
    if (!vs) { console.error('❌ الملف ما فيه صورة: ' + IN); process.exit(2); }
    VW = vs.width; VH = vs.height; dur = +pi.format.duration;
  }
  if (opt('--dur')) dur = +opt('--dur');
  else if (!IN && fs.existsSync(W + 'caps.json')) { try {   /* طول فيديو الكلام = الكلام + كرت الختام (outro بـsfx.json مثل 04_render_frames) */
    const c = JSON.parse(fs.readFileSync(W + 'caps.json', 'utf8')), sx = fs.existsSync(W + 'sfx.json') ? JSON.parse(fs.readFileSync(W + 'sfx.json', 'utf8')) : {};
    dur = (+c.total || 0) + (+(c.outro || sx.outro) || 0); } catch (e) { } }

  /* 1) النبضات والقطعات */
  const bp = path.resolve(opt('--beats', W + 'beats.json'));
  if (!fs.existsSync(bp)) { console.error('❌ ما فيه ' + bp + ' — شغّل أول: python3 scripts/beat.py <الأغنية> --out ' + bp); process.exit(2); }
  const B = JSON.parse(fs.readFileSync(bp, 'utf8'));
  let cuts = [];
  const cp = opt('--cuts', fs.existsSync(W + 'montage.json') ? W + 'montage.json' : null);
  if (cp) { try { const m = JSON.parse(fs.readFileSync(cp, 'utf8')); cuts = m.cuts || []; } catch (e) { } }
  const words = (opt('--words', '') || '').split(/[،,]/).map(s => s.trim()).filter(Boolean);
  const TH = fs.existsSync(path.resolve(opt('--theme', W + 'theme.json'))) ? JSON.parse(fs.readFileSync(path.resolve(opt('--theme', W + 'theme.json')), 'utf8')) : {};
  if (TH.acc) BFX.theme = { acc: TH.acc, clay: TH.clay, ink: TH.ink, bg: TH.bg, font: TH.font };
  else if (!CHECK) console.log('ℹ️  ما فيه theme.json — وضع محايد: المسح أسود، الكلمة بيضاء بحد أسود، والتسريب بلون اللقطة (وما ينختار آلياً). ' +
    'لو صاحب الفيديو عنده ألوان: <work>/theme.json {acc, clay, ink, bg, font}');
  const avoid = (opt('--avoid', '') || '').split(',').filter(Boolean).map(x => x.split(/[:-]/).map(Number)).filter(a => a.length === 2 && a.every(isFinite));

  /* 2) التصميم الآلي (أو خطة معدّلة يدوياً) */
  const PF = W + 'beatfx.json';
  let events;
  if (fs.existsSync(PF) && (CHECK || !has('--replan'))) { events = JSON.parse(fs.readFileSync(PF, 'utf8')).events; console.log('📋 أستخدم الخطة الموجودة ' + PF + (CHECK ? '' : ' (--replan يعيدها)')); }
  else if (CHECK) { console.error('❌ ما فيه ' + PF + ' — الفحص يحتاج الخطة اللي انرسمت (--plan-only أول)'); process.exit(2); }
  else {
    const loop = has('--loop') && dur > (+B.duration || 1e9) + 0.05 ? dur : 0;
    events = BFX.plan(B, { density: opt('--density', 'mid'), style: opt('--style', cuts.length ? 'hype' : 'clean'), cuts, words, avoid,
      safe: !has('--unsafe'), end: dur ? dur - 0.5 / FPS : undefined, themed: !!TH.acc, loop });
    if (events.unusedWords && events.unusedWords.length)
      console.log('⚠️  ' + events.unusedWords.length + ' من ' + words.length + ' كلمة ما لقت ضربة (' + events.unusedWords.join('، ') + ') — المقطع أقصر من إنها تنفرد كل وحدة ~1 ث. قلّلها أو طوّل المقطع');
    else if (words.length) console.log('🔠 الكلمات: ' + events.filter(e => e.fx === 'textSlam').map(e => e.text + '@' + e.t.toFixed(2)).join(' · '));
    if (loop) console.log('🔁 الأغنية ' + (+B.duration).toFixed(1) + ' ث والفيديو ' + dur.toFixed(1) + ' ث — كررت النبضات مع تكرار الملف الصوتي');
    fs.writeFileSync(PF, JSON.stringify({ beats: path.basename(bp), cuts, events }, null, 1));
  }
  const cnt = {}; events.forEach(e => cnt[e.fx] = (cnt[e.fx] || 0) + 1);
  console.log('🥁 ' + events.length + ' مؤثر على ' + B.beats.length + ' نبضة (' + (B.bpm || '?') + ' BPM)' + (cuts.length ? ' · ' + cuts.length + ' قطعة' : '') + ' — ' +
    Object.entries(cnt).map(([k, v]) => k + '×' + v).join(' · '));
  if (PLAN_ONLY) { console.log('✅ ' + PF + (dur ? ' (' + dur.toFixed(1) + ' ث)' : '') + " — بـcompose.html: BFX.attach({events:'beatfx.json'})"); process.exit(0); }

  /* 3) فريمات المصدر */
  const SRC = W + 'bfx_src/';
  const need = Math.round(dur * FPS);
  const nOld = fs.existsSync(SRC) ? fs.readdirSync(SRC).filter(f => f.endsWith('.jpg')).length : 0;
  const stamp = W + 'bfx_src/.src';
  const sig = IN + '|' + fs.statSync(IN).mtimeMs;
  if (Math.abs(nOld - need) > 2 || !fs.existsSync(stamp) || fs.readFileSync(stamp, 'utf8') !== sig) {
    fs.rmSync(SRC, { recursive: true, force: true }); fs.mkdirSync(SRC, { recursive: true });
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', IN, '-vf', 'fps=' + FPS, '-q:v', '2', SRC + '%05d.jpg'], { stdio: 'inherit' });
    if (r.status) { console.error('❌ فشل استخراج الفريمات'); process.exit(2); }
    fs.writeFileSync(stamp, sig);
  }
  const NF = fs.readdirSync(SRC).filter(f => f.endsWith('.jpg')).length;

  /* 4) المتصفح */
  const puppeteer = resolvePuppeteer();
  const b = await puppeteer.launch({ executablePath: findChrome(), headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files', '--force-color-profile=srgb', '--font-render-hinting=none'] });
  const p = await b.newPage();
  p.on('pageerror', e => process.stderr.write('[beatfx] ' + e.message + '\n'));
  p.on('console', m => { if (m.type() === 'error') process.stderr.write('[beatfx] ' + m.text() + '\n'); });
  await p.setViewport({ width: VW, height: VH, deviceScaleFactor: 1 });
  const FONT = TH.font || 'Cairo';
  const html = W + '.beatfx.html';
  fs.writeFileSync(html, `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(FONT)}:wght@900&display=swap" rel="stylesheet">
<style>html,body{margin:0;background:#000}</style></head><body><canvas id="cv" width="${VW}" height="${VH}"></canvas>
<script src="${fileURL(path.join(__dirname, 'beat-fx.js'))}"></script>
<script>
const C=document.getElementById('cv'), X=C.getContext('2d');
const IM=[0,1,2,3].map(()=>new Image());
async function load(im,src){ im.src=src; try{ await im.decode(); }catch(e){} return im; }
window.frame=async(t,cur,hist,evs,q)=>{
  await load(IM[0],cur); X.globalCompositeOperation='source-over'; X.globalAlpha=1; X.drawImage(IM[0],0,0,C.width,C.height);
  BFX.history=null;
  if(hist&&hist.length){ const hs=[]; for(let j=0;j<hist.length;j++) hs.push(await load(IM[j+1],hist[j])); BFX.history=hs; }
  BFX.apply(X,t,evs);
  return C.toDataURL('image/jpeg',q);
};
window.sheet=async(items,cols,cw)=>{   /* ورقة فحص: صور + تسميتين (السطر الأول المؤثر، الثاني الفريم) مقصوصة بعرض الخانة */
  const LH=46, ch=Math.round(cw*C.height/C.width), rows=Math.ceil(items.length/cols), S=document.createElement('canvas');
  S.width=cols*cw; S.height=rows*(ch+LH); const x=S.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,S.width,S.height);
  for(let i=0;i<items.length;i++){ const it=items[i], im=await load(new Image(),it.src), cx=(i%cols)*cw, cy=Math.floor(i/cols)*(ch+LH);
    x.drawImage(im,cx,cy+LH,cw,ch);
    x.save(); x.beginPath(); x.rect(cx+2,cy,cw-4,LH); x.clip(); x.fillStyle=it.hit?'#c00':'#000';
    x.font='bold 15px sans-serif'; x.fillText(it.l1,cx+4,cy+18); x.font='13px sans-serif'; x.fillText(it.l2,cx+4,cy+38); x.restore();
    x.strokeStyle='#fff'; x.lineWidth=2; x.strokeRect(cx,cy+LH,cw,ch); }
  return S.toDataURL('image/jpeg',0.86);
};
</script></body></html>`);
  await p.goto(fileURL(html), { waitUntil: 'networkidle0' });
  await p.evaluate((th, f) => { BFX.theme = th; BFX.FPS = 30; return Promise.all([document.fonts.load('900 80px ' + f), document.fonts.ready]); },
    TH.acc ? { acc: TH.acc, clay: TH.clay, ink: TH.ink, bg: TH.bg, font: FONT } : { font: FONT }, FONT);

  const fid = i => String(Math.min(NF, Math.max(1, i + 1))).padStart(5, '0');
  const echoOn = t => events.some(e => e.fx === 'echo' && t >= e.t - 0.02 && t <= e.t + (e.dur || 0.42));
  /* ⛔ الإيكو ياخذ فريمات من نفس اللقطة بس: فريم قبل القطع (اللقطة القديمة) فوق فريم القطع يأخّر القطع بصرياً.
     بلا فريمات من نفس اللقطة → إيكو زوم شعاعي من الفريم الحالي */
  const cutF = cuts.map(c => Math.round(c * FPS)).sort((a, b) => a - b);
  const shotStart = i => { let s0 = 0; for (const c of cutF) if (c <= i) s0 = c; return s0; };
  const render = async (i, q) => {
    const t = i / FPS;
    let hist = null;
    if (echoOn(t)) { const s0 = shotStart(i); hist = [2, 4, 6].filter(k => i - k >= s0).map(k => fileURL(SRC + fid(i - k) + '.jpg')); if (!hist.length) hist = null; }
    const d = await p.evaluate(window_frame, t, fileURL(SRC + fid(i) + '.jpg'), hist, events, q);
    return Buffer.from(d.split(',')[1], 'base64');
  };
  function window_frame(t, cur, hist, evs, q) { return window.frame(t, cur, hist, evs, q); }

  if (has('--preview')) {
    const ts = A.slice(A.indexOf('--preview') + 1).filter(x => !x.startsWith('--')).map(Number);
    fs.mkdirSync(W + 'beatfx-prev', { recursive: true });
    for (const t of ts) { const i = Math.round(t * FPS); fs.writeFileSync(W + 'beatfx-prev/f' + String(i).padStart(5, '0') + '.jpg', await render(i, 0.9)); console.log('معاينة', t.toFixed(2), '← فريم', i); }
    await b.close(); setTimeout(() => process.exit(0), 200); return;
  }

  /* ورقة الفحص: من مجلد فريمات (مرسومة أو من الفيديو الجاهز بـ--check) */
  async function makeSheet(dir) {
    const items = [];
    const big = events.filter(e => !(e.fx === 'shake' && e.k < 0.4) && !(e.fx === 'zoomPunch' && e.k < 0.4));
    const seen = new Set();
    for (const e of big) {
      const hf = Math.round(e.t * FPS); if (seen.has(hf) || hf >= NF) continue; seen.add(hf);
      const same = big.filter(x => Math.round(x.t * FPS) === hf).map(x => x.fx + (x.text ? '«' + x.text + '»' : '')).join('+');
      for (const d of [-1, 0, 1, 3]) { const i = hf + d; if (i < 0 || i >= NF) continue;
        items.push({ src: fileURL(dir + String(i + 1).padStart(5, '0') + '.jpg'), hit: d === 0,
          l1: d === 0 ? '● ' + same : (d > 0 ? '+' : '') + d + 'f', l2: '#' + i + ' · ' + (i / FPS).toFixed(2) + ' ث' }); }
      if (items.length >= 96) break;
    }
    const d = await p.evaluate((it, c, w) => window.sheet(it, c, w), items, 8, 200);
    fs.writeFileSync(W + 'beatfx-sheet.jpg', Buffer.from(d.split(',')[1], 'base64'));
    console.log('🧾 ' + W + 'beatfx-sheet.jpg — الأحمر = فريم الضربة نفسها (لازم المؤثر يبين عليه بالذروة، والقبله نظيف)');
  }
  if (CHECK) { await makeSheet(SRC); await b.close(); setTimeout(() => process.exit(0), 200); return; }

  /* 5) الرسم */
  const OUT = W + 'bfx_out/';
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const t0 = Date.now();
  for (let i = 0; i < NF; i++) {
    fs.writeFileSync(OUT + String(i + 1).padStart(5, '0') + '.jpg', await render(i, 0.93));
    if (i % 150 === 0) console.log('فريم', i, '/', NF);
  }
  console.log('رسمت', NF, 'فريم بـ' + ((Date.now() - t0) / 1000).toFixed(1) + ' ث');

  /* 6) ورقة الفحص */
  if (has('--sheet')) await makeSheet(OUT);
  await b.close();

  /* 7) الترميز + الصوت */
  const out = path.resolve(opt('--out', W + 'beatfx.mp4'));
  const au = opt('--audio', hasA ? IN : 'none');
  const args = ['-v', 'error', '-y', '-framerate', String(FPS), '-i', OUT + '%05d.jpg'];
  if (au !== 'none') args.push('-i', path.resolve(au)); else args.push('-f', 'lavfi', '-t', String(NF / FPS), '-i', 'anullsrc=r=48000:cl=stereo');
  args.push('-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', (NF / FPS).toFixed(3), '-movflags', '+faststart', out);
  const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (r.status) { console.error('❌ فشل الترميز'); process.exit(2); }
  console.log('✅ ' + out + ' — ' + (NF / FPS).toFixed(2) + ' ث' + (au === 'none' ? ' (صامت — حط --audio)' : ''));
  setTimeout(() => process.exit(0), 200);
})();
