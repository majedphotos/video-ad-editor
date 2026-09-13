/* يرسم فريمات ريل البودكاست من كاميرات متعددة.
   node 16_render_pod.js <work> all [--force] | range 10 14 | preview 2 8 15 */
const path=require('path'), fs=require('fs'); const {pathToFileURL}=require('url');
const W=path.resolve(process.argv[2])+path.sep, FPS=30, SC=path.dirname(path.resolve(process.argv[1]))+path.sep;
const caps=JSON.parse(fs.readFileSync(W+'caps.json','utf8'));
const plan=JSON.parse(fs.readFileSync(W+'plan.json','utf8'));
const cams=JSON.parse(fs.readFileSync(W+'cams.json','utf8'));
const theme=fs.existsSync(W+'theme.json')?JSON.parse(fs.readFileSync(W+'theme.json','utf8')):{};
const behind=fs.existsSync(W+'behind.json')?JSON.parse(fs.readFileSync(W+'behind.json','utf8')):{};
const OUTRO=plan.outro||1.8, dur=caps.total+OUTRO;
const url=p=>pathToFileURL(p).href;
const faces={}; for(const c of cams.cams) faces[c.id]=c.faces;
/* الخطوط المحلية والشعار → روابط ملفات */
if(theme.fontFiles) theme.fontFiles=theme.fontFiles.map(f=>({...f,src:url(path.resolve(W,f.src))}));
if(theme.logo) theme.logo=url(path.resolve(W,theme.logo));
function findChrome(){ if(process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for(const c of ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium']) if(fs.existsSync(c)) return c; throw new Error('ما لقيت كروم — حدّد CHROME_PATH'); }
function pupp(){ for(const p of [process.env.PUPPETEER_PATH,'puppeteer-core','puppeteer',path.join(process.cwd(),'node_modules/puppeteer-core'),SC+'../node_modules/puppeteer-core']){ if(!p) continue; try{return require(p);}catch(e){} } throw new Error('ما لقيت puppeteer-core'); }
(async()=>{
  const puppeteer=pupp(); const mode=process.argv[3]||'all';
  const b=await puppeteer.launch({executablePath:findChrome(),headless:'new',args:['--no-sandbox','--allow-file-access-from-files','--font-render-hinting=none','--force-color-profile=srgb']});
  const p=await b.newPage(); p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.setViewport({width:1080,height:1920,deviceScaleFactor:1}); await p.setCacheEnabled(false);
  await p.goto(url(SC+'compose.PODCAST.html'),{waitUntil:'networkidle0'});
  await p.evaluate((c,s,o,t,h,f)=>window.init({caps:c,scenes:s,outro:o,theme:t,headbox:h,faces:f}),caps,plan.scenes,OUTRO,theme,behind.headbox||{},faces);
  const FF=theme.font||'Cairo';
  const ok=await p.evaluate(async f=>{ await Promise.all(['400','700'].map(w=>document.fonts.load(w+' 60px '+f))); await document.fonts.ready; return document.fonts.check('700 60px '+f); },FF);
  if(!ok) console.log('⚠️ الخط '+FF+' ما اكتمل تحميله — الرسم بخط بديل');
  const nB=id=>fs.readdirSync(W+'cam'+id).filter(f=>f.endsWith('.jpg')).length;
  const NF={}; for(const c of cams.cams) NF[c.id]=nB(c.id);
  const grab=async(t,file,q)=>{ const i=Math.max(1,Math.round(t*FPS)+1); const id=String(i).padStart(5,'0');
    const map={}; for(const c of cams.cams){ const j=String(Math.min(NF[c.id],i)).padStart(5,'0'); map[c.id]=url(W+'cam'+c.id+'/'+j+'.jpg'); }
    const sc=plan.scenes.find(s=>t>=s.s&&t<s.e); let pp=null;
    if(sc&&sc.m==='HEAD'){ const pf=W+'bt/p'+sc.cam+'/'+id+'.png'; if(fs.existsSync(pf)) pp=url(pf); }
    await p.evaluate((m,c)=>window.setFrames(m,c),map,pp);
    const d=await p.evaluate((t,q)=>{window.draw(t);return window.shot(q);},t,q);
    fs.writeFileSync(file,Buffer.from(d.split(',')[1],'base64')); };
  if(mode==='preview'){ fs.mkdirSync(W+'prev',{recursive:true});
    for(const ts of process.argv.slice(4)){ const t=parseFloat(ts); await grab(t,W+'prev/'+ts.replace('.','_')+'.jpg',0.85); } console.log('✓ معاينة',process.argv.slice(4).length,'لقطة'); }
  else { const force=process.argv.includes('--force'); let f0=0,f1=Math.round(dur*FPS)-1;
    if(mode==='range'){ f0=Math.round(parseFloat(process.argv[4])*FPS); f1=Math.round(parseFloat(process.argv[5])*FPS); }
    fs.mkdirSync(W+'out',{recursive:true}); let n=0; const t0=Date.now();
    for(let f=f0;f<=f1;f++){ const file=W+'out/'+String(f+1).padStart(5,'0')+'.jpg'; if(!force&&mode!=='range'&&fs.existsSync(file)) continue; await grab(f/FPS,file,0.92); n++; }
    console.log('رسمت',n,'فريم بـ'+((Date.now()-t0)/1000).toFixed(0)+'ث'); }
  await Promise.race([b.close(),new Promise(r=>setTimeout(r,8000))]);   /* كروم أحياناً ما يسكّر — ما ننتظره */
  process.exit(0);
})();
