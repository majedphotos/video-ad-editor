/* أسلوب «كولاج» — خط كامل بأمر واحد:
   node 13_collage.js <work> [collage|accents] [all|range <من> <إلى>|preview <ث> <ث>…] [--logos <مجلد>]
   المدخلات: <work>/cutz.mp4 + caps.json + theme.json (من الخطوات 3-6). المخرج: <work>/ad-collage.mp4 + collage_sheet.jpg
   الخطوات: فريمات → قصّ المتحدث (مكتبة ماك المدمجة) → المخطِّط يبني الخط الزمني من الجمل → رسم → مؤثرات → دمج مع صوته.
   يكمّل من وين وقف: الفريمات والأقنعة الموجودة ما تُعاد. */
const path=require('path'),fs=require('fs'),cp=require('child_process');
const W=path.resolve(process.argv[2])+path.sep, SC=__dirname+path.sep;
const args=process.argv.slice(3);const li=args.indexOf('--logos');const LOGOS=li>=0?path.resolve(args[li+1])+path.sep:null;if(li>=0)args.splice(li,2);
const STYLE=(args[0]==='accents')?'accents':'collage';const MODE=args[1]||'all';
const CHROME=process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
function resolvePuppeteer(){for(const p of [process.env.PUPPETEER_PATH,'puppeteer-core','puppeteer',path.join(process.cwd(),'node_modules/puppeteer-core')]){if(!p)continue;try{return require(p);}catch(e){}}throw new Error('ما لقيت puppeteer-core — ثبّته: npm i puppeteer-core');}
const sh=(c,opt={})=>cp.execSync(c,{stdio:['ignore','pipe','pipe'],...opt}).toString();
for(const f of ['cutz.mp4','caps.json','theme.json'])if(!fs.existsSync(W+f)){console.error('ناقص: '+W+f+' — شغّل الخطوات 3-6 أول');process.exit(2);}
const CAPS=JSON.parse(fs.readFileSync(W+'caps.json','utf8'));const DUR=CAPS.total||CAPS.cards[CAPS.cards.length-1].e;const FPS=30;let N=Math.ceil(DUR*FPS);
/* 1) فريمات */
const FR=W+'cframes/';fs.mkdirSync(FR,{recursive:true});
if(fs.readdirSync(FR).filter(f=>f.endsWith('.jpg')).length<N-2){console.log('🎞️ فريمات: '+N);sh(`ffmpeg -v error -i ${JSON.stringify(W+'cutz.mp4')} -vf fps=${FPS} -q:v 2 -y ${JSON.stringify(FR+'f_%04d.jpg')}`);}
N=Math.min(N,fs.readdirSync(FR).filter(f=>f.endsWith('.jpg')).length);   // آخر فريم فعلي (ffmpeg يقرّب المدة)
/* 2) قصّ المتحدث */
const MK=W+'cmask/';fs.mkdirSync(MK,{recursive:true});
if(fs.readdirSync(MK).filter(f=>f.endsWith('.png')).length<N-2){
  const BIN=W+'bt/personmask';fs.mkdirSync(W+'bt',{recursive:true});
  if(!fs.existsSync(BIN)){try{cp.execSync('swiftc -O -o '+JSON.stringify(BIN)+' '+JSON.stringify(SC+'personmask.swift'),{stdio:'pipe'});}catch(e){console.error('⛔ القصّ يحتاج ماك + أدوات Xcode (xcode-select --install). أسلوب الكولاج ما يشتغل بدونه.');process.exit(3);}}
  console.log('✂️ قصّ المتحدث من '+N+' فريم (دقيقتان تقريباً)…');cp.execSync(JSON.stringify(BIN)+' '+JSON.stringify(FR)+' '+JSON.stringify(MK)+' accurate 2.5',{stdio:'pipe'});}
/* 3) صفحة الرسم */
const logos={};if(LOGOS&&fs.existsSync(LOGOS))for(const f of fs.readdirSync(LOGOS))if(/\.(png|jpg|svg)$/i.test(f))logos[f.replace(/\.[^.]+$/,'').toLowerCase()]='file://'+LOGOS+f;
const cfg={style:STYLE,logos,assets:'file://'+SC+'collage-assets/'};
const tpl=fs.readFileSync(SC+'collage.TEMPLATE.html','utf8');
fs.writeFileSync(W+'collage.html',tpl.replace('<script>','<script>window.CFG='+JSON.stringify(cfg)+';</script>\n<script>'));
/* 4) الرسم */
(async()=>{
  const puppeteer=resolvePuppeteer();const OUT=W+'cout/';fs.mkdirSync(OUT,{recursive:true});
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--allow-file-access-from-files']});
  const p=await b.newPage();await p.setViewport({width:1080,height:1920});p.on('pageerror',e=>console.log('⚠️ صفحة:',String(e).slice(0,140)));
  await p.goto('file://'+W+'collage.html',{waitUntil:'networkidle0'});await p.evaluate(()=>window.ready);
  const plan=await p.evaluate(()=>({beats:PLAN.BEATS.map(b=>({t0:+b.t0.toFixed(2),t1:+b.t1.toFixed(2),p:b.main.p,h:b.main.h,page:!!b.page})),person:PLAN.PERSON.map(x=>[+x.a.toFixed(1),+x.b.toFixed(1)])}));
  fs.writeFileSync(W+'collage_plan.json',JSON.stringify(plan,null,1));fs.writeFileSync(W+'collage_sfx.json',JSON.stringify(await p.evaluate(()=>window.SFX)));
  console.log('🧩 الخطة: '+plan.beats.length+' ضربة · ظهور المتحدث: '+plan.person.map(x=>x[0]+'-'+x[1]).join(' · '));
  let list=[];if(MODE==='range'){const a=parseFloat(args[2]),z=parseFloat(args[3]);for(let i=Math.floor(a*FPS);i<=Math.min(N-1,Math.ceil(z*FPS));i++)list.push(i);}
  else if(MODE==='preview'){list=args.slice(2).map(x=>Math.min(N-1,Math.round(parseFloat(x)*FPS)));}
  else{for(let i=0;i<N;i++)list.push(i);}
  const t0=Date.now();let done=0;
  for(const i of list){const n=String(i+1).padStart(4,'0');const outf=OUT+'f_'+n+'.jpg';if(MODE==='all'&&fs.existsSync(outf)&&!args.includes('--force'))continue;
    const d=await p.evaluate(async(n,t)=>{const ld=src=>new Promise((r,j)=>{const im=new Image();im.onload=()=>r(im);im.onerror=()=>j(new Error('load '+src));im.src=src;});const [f,m]=await Promise.all([ld('cframes/f_'+n+'.jpg'),ld('cmask/f_'+n+'.png')]);setPerson(f,m);draw(t);return document.getElementById('c').toDataURL('image/jpeg',0.93);},n,i/FPS);
    fs.writeFileSync(MODE==='preview'?OUT+'preview_'+n+'.jpg':outf,Buffer.from(d.split(',')[1],'base64'));if(++done%300===0)console.log('🖌️ '+done+'/'+list.length+' ('+((Date.now()-t0)/1000|0)+'ث)');}
  await b.close();console.log('🖌️ رسم '+done+' فريم');
  if(MODE==='preview'){const pf=list.map(i=>OUT+'preview_'+String(i+1).padStart(4,'0')+'.jpg');sh(`ffmpeg -v error -y ${pf.map(f=>'-i '+JSON.stringify(f)).join(' ')} -filter_complex "${pf.map((_,k)=>`[${k}]scale=300:-1[s${k}]`).join(';')};${pf.map((_,k)=>`[s${k}]`).join('')}hstack=${pf.length}" ${JSON.stringify(W+'collage_preview.jpg')}`);console.log('👁️ '+W+'collage_preview.jpg');process.exit(0);}
  /* 5) الصوت والتجميع */
  sh(`python3 ${JSON.stringify(SC+'13_collage_sfx.py')} ${JSON.stringify(W+'collage_sfx.json')} ${JSON.stringify(W+'collage_sfx.wav')} ${DUR+0.2}`);
  sh(`ffmpeg -v error -y -i ${JSON.stringify(W+'cutz.mp4')} -vn -ac 1 -ar 48000 ${JSON.stringify(W+'collage_voice.wav')}`);
  sh(`ffmpeg -v error -y -i ${JSON.stringify(W+'collage_voice.wav')} -i ${JSON.stringify(W+'collage_sfx.wav')} -filter_complex "[0]volume=1.0[a];[1]volume=0.9[b];[a][b]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11" -ar 48000 ${JSON.stringify(W+'collage_mix.wav')}`);
  sh(`ffmpeg -v error -y -framerate ${FPS} -i ${JSON.stringify(OUT+'f_%04d.jpg')} -i ${JSON.stringify(W+'collage_mix.wav')} -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -c:a aac -b:a 160k -shortest -movflags +faststart ${JSON.stringify(W+'ad-collage.mp4')}`);
  sh(`ffmpeg -v error -y -i ${JSON.stringify(W+'ad-collage.mp4')} -vf "select='not(mod(n\\,${Math.max(30,Math.round(N/24))}))',scale=180:-1,tile=8x3" -frames:v 1 -vsync vfr ${JSON.stringify(W+'collage_sheet.jpg')}`);
  console.log('✅ '+W+'ad-collage.mp4  ·  ورقة اللقطات: collage_sheet.jpg');process.exit(0);
})().catch(e=>{console.error('⛔',e.message);process.exit(1);});
