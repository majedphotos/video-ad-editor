/* يركّب الفيديو + الموشن قرافيكس ويطلع فريمات.
   node 04_render_frames.js <workdir> all                       ← يكمّل من وين وقف (يتخطّى الموجود)
   node 04_render_frames.js <workdir> all --force               ← يعيد الرسم من الصفر
   node 04_render_frames.js <workdir> range 12.0 18.5           ← يعيد رسم نافذة وحدة بس (بعد تعديل مشهد)
   node 04_render_frames.js <workdir> preview 4.6 12.3 31.0     */
const path=require('path'), fs=require('fs');
const W=path.resolve(process.argv[2])+path.sep;
const CFG=JSON.parse(fs.readFileSync(W+'sfx.json','utf8'));       // فيه outro
const THEME=fs.existsSync(W+'theme.json')?JSON.parse(fs.readFileSync(W+'theme.json','utf8')):{};
const BEHIND=fs.existsSync(W+'behind.json')?JSON.parse(fs.readFileSync(W+'behind.json','utf8')):null;  // الكلام ورا الشخص
const HASCOVER=fs.existsSync(W+'cover');   // خلفية باهتة: cover/NNNNN.png لكل فريم (يبنيها 14_backdrop.py) — اختيارية
const OUT_D=CFG.outro, FPS=30;
function resolvePuppeteer(){
  for(const p of [process.env.PUPPETEER_PATH,'puppeteer-core','puppeteer',
      path.join(process.cwd(),'node_modules/puppeteer-core')]) {
    if(!p) continue; try{ return require(p); }catch(e){}
  }
  throw new Error('ما لقيت puppeteer-core — ثبّته: npm i puppeteer-core');
}
/* ── كروم: يلقاه على ويندوز وماك ولينكس (مضاف) ── */
const {pathToFileURL}=require('url');
const fileURL=p=>pathToFileURL(p).href;
function findChrome(){
  if(process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const LA=process.env.LOCALAPPDATA||'';
  const PF=process.env.ProgramFiles||'C:/Program Files';
  const P86=process.env['ProgramFiles(x86)']||'C:/Program Files (x86)';
  const cands=[
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    PF+'/Google/Chrome/Application/chrome.exe',
    P86+'/Google/Chrome/Application/chrome.exe',
    LA+'/Google/Chrome/Application/chrome.exe',
    PF+'/Microsoft/Edge/Application/msedge.exe',
    P86+'/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'];
  for(const c of cands){ try{ if(c && fs.existsSync(c)) return c; }catch(e){} }
  throw new Error('ما لقيت كروم — حدّد CHROME_PATH');
}
const CHROME=findChrome();
(async()=>{
  const puppeteer=resolvePuppeteer();
  const mode=process.argv[3]||'all';
  const caps=JSON.parse(fs.readFileSync(W+'caps.json','utf8'));
  const NVF=fs.readdirSync(W+'vfr').filter(f=>f.endsWith('.jpg')).length;
  const dur=caps.total+OUT_D;
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
    args:['--no-sandbox','--allow-file-access-from-files','--font-render-hinting=none','--force-color-profile=srgb']});
  const p=await b.newPage();
  /* أخطاء الصفحة تطلع بالطرفية (stderr) — بدونها المشهد اللي يسقط يتخطّى بصمت وما تدري ليش ما طلع */
  const _seen=new Set(), perr=m=>{ if(_seen.has(m)) return; _seen.add(m); process.stderr.write('[compose] '+m+'\n'); };
  p.on('pageerror',e=>perr('PAGEERR '+e.message));
  p.on('console',m=>{ if(m.type()==='error') perr(m.text()); });
  await p.setViewport({width:1080,height:1920,deviceScaleFactor:1});
  await p.setCacheEnabled(false);   // لا تقرأ نسخة مخبّأة من compose.html
  await p.goto(fileURL(W+'compose.html'),{waitUntil:'networkidle0'});
  const FF=THEME.font||'Cairo';
  await p.evaluate(()=>new Promise(r=>{const l=document.getElementById('LOGO');l.complete?r():l.onload=r;}));
  /* 🪝 v3.8.1: الهوك المكتوب (theme.json ← hook) — لو compose.html ما فيه hook-card.js (انسخ من المرجع من جديد / apply قبل وجوده)
     نركّبه هني بدل ما يختفي الهوك بصمت. hook-card.js يمنع التركيب المزدوج وحده. */
  if(THEME.hook&&!(await p.evaluate(()=>!!window.HookCard))){
    const hc=[path.join(__dirname,'hook-card.js'),W+'hook-card.js'].find(f=>fs.existsSync(f));
    if(hc){ await p.addScriptTag({path:hc}); console.log('🪝 الهوك: compose.html ما فيه hook-card.js — ركّبته من '+(hc.startsWith(W)?'مجلد الشغل':'السكل')+' (عشان ما يختفي بصمت)'); }
    else console.log('⚠️ الهوك بـtheme.json بس ما لقيت hook-card.js — الهوك ما راح ينرسم');
  }
  const STUDIO=fs.existsSync(W+'studio.json')?JSON.parse(fs.readFileSync(W+'studio.json','utf8')):null;   // 📱 تعديلات استوديو الجوال
  await p.evaluate((c,o,t,b,st)=>window.init({cards:c.cards,total:c.total,outro:o,theme:t,behind:b,studio:st}),caps,OUT_D,THEME,BEHIND,STUDIO);
  /* ⚠️ انتظار الخط لازم يجي **بعد** init: الخط اللي مو Cairo يُحقن داخل init نفسها،
     فانتظاره قبلها = انتظار لا شي، والنتيجة أول الفيديو بخط بديل ثم ينقلب بالنص.
     وكل الأوزان تُحمّل — الوزن 600 كان ناقصاً فيطلع بخط بديل لحاله. */
  const fontOK=await p.evaluate(async f=>{
    const W=['400','600','700','800','900'];
    /* 28 سبتمبر (صفحة التعارف): ستايل الخط المحقون داخل init لازم يخلص تحميله أول — قبلها المتصفح ما يعرف الخط
       فـfonts.load يرجع صفر وcheck يقول «تمام» (ما فيه خط = ما فيه شي ناقص) والمعاينة تطلع بخط بديل بلا تحذير */
    await Promise.all([...document.querySelectorAll('link[rel=stylesheet]')].map(l=>l.sheet?0:new Promise(r=>{l.onload=l.onerror=r;setTimeout(r,10000);})));
    /* 28 سبتمبر: نص عربي إلزامي — بدونه ينزل الجزء اللاتيني من خط قوقل بس، والعربي ينزل متأخر فأول الفريمات بخط بديل */
    await Promise.all(W.map(w=>document.fonts.load(w+' 60px '+f,'عربي ـ 123')));
    await document.fonts.ready;
    const faces=(await document.fonts.load('400 60px '+f,'عربي')).length;   /* صفر = الخط ما انعرف أصلاً (ولا check يكشفه) */
    return faces>0 && W.every(w=>document.fonts.check(w+' 60px '+f,'عربي'));
  },FF);
  if(!fontOK) console.log('⚠️ الخط '+FF+' ما اكتمل تحميله — الرسم بيكمل بخط بديل');
  const grab=async(t,file,q)=>{
    const i=Math.min(NVF,Math.max(1,Math.round(t*FPS)+1));
    const id=String(i).padStart(5,'0');
    await p.evaluate(s=>window.setFrame(s),fileURL(W+'vfr/'+id+'.jpg'));
    if(BEHIND){                                   // صورة الشخص المقصوص لهالفريم (إن وُجدت)
      const inR=BEHIND.ranges.some(r=>i>=r[0]&&i<=r[1]);
      const pf=W+'bt/person/'+id+'.png';
      const ok=inR&&fs.existsSync(pf);
      await p.evaluate((s,f)=>window.setPerson(s,f), ok?fileURL(pf):null, (BEHIND.faces&&BEHIND.faces[i])||null);
    }
    if(HASCOVER){const cf=W+'cover/'+id+'.png';await p.evaluate(s=>window.setCover?window.setCover(s):0, fs.existsSync(cf)?('file://'+cf):null);}
    const d=await p.evaluate((t,q)=>{window.draw(t);return window.shot(q);},t,q);
    fs.writeFileSync(file,Buffer.from(d.split(',')[1],'base64'));
  };
  if(mode==='preview'){
    fs.mkdirSync(W+'prev',{recursive:true});
    for(const t of process.argv.slice(4).map(Number)){await grab(t,W+'prev/t'+t.toFixed(2)+'.jpg',0.9);console.log('معاينة',t);}
  }else{
    fs.mkdirSync(W+'out',{recursive:true});
    const n=Math.round(dur*FPS);
    let force=process.argv.includes('--force');
    /* 🧷 v3.5 (27 سبتمبر): رسم كامل طاح بنصه (خطأ شبكة) خلّى الفريمات بعد نقطة الطيحة من التصميم القديم، والاستئناف حسبها «جاهزة»
       فطلع الريل خليط. الحين: بصمة لملفات التصميم بمجلد الشغل — لو تغيّرت من آخر رسم، أو انطلب --force، تنمسح الفريمات القديمة أول،
       فأي استئناف بعد طيحة يكمّل الناقص بس. نافذة range ما تمسح شي (تعدّل مشهد وتجمّع) وتحدّث البصمة. */
    const crypto=require('crypto'), FPF=W+'out/.design.sha1';
    const fpNow=(()=>{ const h=crypto.createHash('sha1');
      for(const f of fs.readdirSync(W).sort()) if(/\.(html|js|json)$/.test(f)&&!['shots.json','sfx.json','fixes.json','a.json','words.json','safe.json'].includes(f)) h.update(f).update(fs.readFileSync(W+f));
      const ext=(fs.readFileSync(W+'compose.html','utf8').match(/src="(\.\.\/[^"]+\.js)"/g)||[]).map(m=>m.slice(5,-1));
      for(const e of ext){ try{ h.update(e).update(fs.readFileSync(W+e)); }catch(_){} }
      return h.digest('hex'); })();
    let fpOld=''; try{ fpOld=fs.readFileSync(FPF,'utf8').trim(); }catch(_){}
    if(mode==='all'){
      if(!force&&fpOld&&fpOld!==fpNow){ console.log('🧷 التصميم تغيّر من آخر رسم — أعيد الرسم كامل (الفريمات القديمة ما تصلح)'); force=true; }
      if(force){ let k=0; for(const f of fs.readdirSync(W+'out')) if(f.endsWith('.jpg')){ fs.unlinkSync(W+'out/'+f); k++; }
        if(k) console.log('🧹 مسحت',k,'فريماً قديماً — لو طاح الرسم بنصه، أعد التشغيل بلا --force ويكمّل الناقص بس'); force=false; }
    }
    fs.writeFileSync(FPF,fpNow);
    let i0=0,i1=n;                       // نافذة زمنية اختيارية — تُعاد كتابتها دائماً
    if(mode==='range'){
      const a=Number(process.argv[4]), b=Number(process.argv[5]);
      if(!isFinite(a)||!isFinite(b)) throw new Error('range يحتاج وقتين: <من> <إلى>');
      i0=Math.max(0,Math.floor(a*FPS)); i1=Math.min(n,Math.ceil(b*FPS)+1);
    }
    const done=f=>{try{return fs.statSync(f).size>2000;}catch(e){return false;}};
    let skipped=0,drawn=0;
    for(let i=i0;i<i1;i++){
      const f=W+'out/'+String(i).padStart(5,'0')+'.jpg';
      if(mode==='all'&&!force&&done(f)){skipped++;continue;}
      await grab(i/FPS,f,0.95); drawn++;
      if(drawn%150===1)console.log('فريم',i,'/',i1);
    }
    if(skipped)console.log('تخطّى',skipped,'فريماً جاهزاً (استئناف) — --force يعيد الكل');
    console.log('تم',drawn,'فريم مرسوم من',n,'— المدة',dur.toFixed(3));
    if(mode!=='range'){                  // ناقص فريم = تجميع مكسور، لازم ينكشف الحين
      let miss=0; for(let i=0;i<n;i++) if(!done(W+'out/'+String(i).padStart(5,'0')+'.jpg')) miss++;
      if(miss)console.log('⚠️ ناقص',miss,'فريماً — أعد التشغيل قبل 06_encode.sh');
    }
  }
  await b.close();
  setTimeout(()=>process.exit(0),300);   // (16 سبتمبر) كروم أحياناً ما يقفل فيتعلّق السكربت بعد ما يخلص الرسم — نخرج بأنفسنا
})();
