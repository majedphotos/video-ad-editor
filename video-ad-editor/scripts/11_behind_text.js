/* ═══ الكلام يمرّ ورا الشخص (كشيدة عربية) ═══
   node 11_behind_text.js <work> plan            → يرشّح الجُمل المناسبة
   node 11_behind_text.js <work> build 1 9       → يجهّز قصّ الشخص لهالجُمل ويكتب behind.json
   node 11_behind_text.js <work> build 2:6-8     → كلمات بعينها داخل جملة
   node 11_behind_text.js <work> stack 1         → «طبقات»: كلمة فوق الراس بعرض الشاشة ← كلمة/ثنتين ورا الراس ← الباقي قدّام جسمه
   node 11_behind_text.js <work> stack 3:1-5     → «طبقات» لكلمات بعينها
   node 11_behind_text.js <work> cutout 23.8-26.6 → «واقف قدام اللوحة»: بلا كرت، أنت العنصر
   node 11_behind_text.js <work> headout 23.8-26.6 → «راسك برّا المستطيل»: الفيديو بكرت وراسك يطلع فوق حافته
   node 11_behind_text.js <work> drop 9          → يشيل جملة وحدة (أو أكثر: drop 1 9) ويخلّي الباقي
   node 11_behind_text.js <work> off             → يلغي التأثير كله (الجُمل + cutout + headout)

   كل أمر build/stack = **القائمة الكاملة لنوعه**: build 1 9 ثم build 1 → يبقى 1 بس (جُمل «طبقات» ما تنلمس، والعكس).
   cutout/headout يتجمّعون (نفس المدى مرتين = مرة وحدة). ranges تنحسب من جديد كل مرة (بلا تكرار).

   شلون يشتغل: ماك فيه فصل الأشخاص مدمج بالنظام (Vision). نقصّ جسم المتحدث بكل فريم،
   نرسم الكلمة ممدودة بالكشيدة تحته، ثم نرجّع جسمه فوقها — فالكشيدة وحدها تمرّ ورا الراس
   والحروف تبقى بارزة على الجانبين.  يحتاج: ماك + swiftc (مجاني مع أدوات Xcode) + ffmpeg. */
const path=require('path'), fs=require('fs'), cp=require('child_process');
const W=path.resolve(process.argv[2])+path.sep, MODE=process.argv[3]||'plan';
const SC=path.dirname(path.resolve(process.argv[1]))+path.sep;
const caps=JSON.parse(fs.readFileSync(W+'caps.json','utf8'));
const FPS=30, MAXW=4, MINDUR=0.85;

const words=c=>c.w.map(w=>w.t).join(' ');
if(MODE==='off'){ try{fs.unlinkSync(W+'behind.json');}catch(e){} console.log('انلغى التأثير.'); process.exit(0); }
/* ranges (مدى الفريمات اللي يحمّل لها 04 صورة الشخص) تنحسب من الجُمل والمشاهد الموجودة — مو تتراكم مع كل تشغيل */
function rebuildRanges(o){
  let nv=1e9; try{ nv=fs.readdirSync(W+'vfr').filter(f=>f.endsWith('.jpg')).length||1e9; }catch(e){}
  const fr=(a,b)=>[Math.max(1,Math.floor(a*FPS)+1), Math.min(nv,Math.ceil(b*FPS)+1)], rs=[];
  (o.lines||[]).forEach(l=>rs.push(fr(l.s,l.e)));
  (o.cutouts||[]).concat(o.headouts||[]).forEach(c=>rs.push(fr(c[0],c[1])));
  rs.sort((p,q)=>p[0]-q[0]); const out=[];
  for(const r of rs){ const z=out[out.length-1]; if(z&&r[0]<=z[1]+1) z[1]=Math.max(z[1],r[1]); else out.push(r.slice()); }
  o.ranges=out; return o; }
if(MODE==='drop'){
  if(!fs.existsSync(W+'behind.json')){ console.log('ما فيه behind.json — ما فيه شي أشيله'); process.exit(0); }
  const o=JSON.parse(fs.readFileSync(W+'behind.json','utf8'));
  const ids=new Set(process.argv.slice(4).map(x=>parseInt(x,10)-1).filter(x=>x>=0));
  if(!ids.size){ console.log('عطني رقم الجملة: drop 9'); process.exit(2); }
  const before=(o.lines||[]).length; o.lines=(o.lines||[]).filter(l=>!ids.has(l.card));
  fs.writeFileSync(W+'behind.json',JSON.stringify(rebuildRanges(o),null,1));
  console.log('✅ شلت',before-o.lines.length,'جملة — الباقي:',o.lines.map(l=>(l.card+1)+(l.style==='stack'?'(طبقات)':'')).join(' ')||'ولا شي');
  process.exit(0);
}

/* ── ماك فقط (مضاف): القصّ يعتمد على Vision عبر swiftc ── */
if(['build','stack','cutout','headout'].indexOf(MODE)>=0){
  let hasSwift=false;
  if(process.platform==='darwin'){
    try{ hasSwift = cp.spawnSync('swiftc',['--version'],{stdio:'ignore'}).status===0; }catch(e){ hasSwift=false; }
  }
  if(!hasSwift){
    console.log('⛔ «الكلام ورا الشخص» يحتاج ماك + swiftc — نظامك: '+process.platform);
    console.log('   بقية السكل يشتغل عادي: الكابشن والموشن قرافكس والمؤثرات والختام.');
    process.exit(20);
  }
}

if(MODE==='plan'){
  console.log('الجُمل اللي تنفع يمرّ كلامها ورا الشخص (قصيرة وواضحة):');
  let n=0;
  caps.cards.forEach((c,i)=>{
    const dur=c.w[c.w.length-1].e-c.w[0].s;
    if(c.w.length>MAXW||dur<MINDUR) return;
    n++;
    console.log(`  ${i+1}  [${c.s.toFixed(2)}]  ${words(c)}   (${c.w.length} كلمات · ${dur.toFixed(2)}ث)${i===0?'  ← الهوك، أقواها':''}`);
  });
  if(!n) console.log('  ما فيه جملة قصيرة — اختر كلمات بعينها: build 2:6-8 (الكلمات 6→8 من الجملة 2)');
  /* «طبقات»: جملة 2-8 كلمات (فوق الراس + ورا + قدّام) — الهوك أول مرشّح */
  const st=[]; caps.cards.forEach((c,i)=>{ const dur=c.w[c.w.length-1].e-c.w[0].s;
    if(c.w.length>=2&&c.w.length<=8&&dur>=1.2) st.push(`  ${i+1}  [${c.s.toFixed(2)}]  ${words(c)}   (${c.w.length} كلمات)${i===0?'  ← الهوك':''}`); });
  if(st.length){ console.log('\nتنفع «طبقات» (كلمة فوق الراس ← ورا الراس ← الباقي قدّامه):'); st.slice(0,8).forEach(x=>console.log(x));
    console.log('   node 11_behind_text.js <work> stack <رقم>   — والجملة الطويلة: stack 2:1-6'); }
  console.log('\n⚠️ اختر وحدة أو ثنتين بالكثير — لو تكرر بكل جملة يفقد أثره.');
  console.log('ثم: node 11_behind_text.js <work> build <أرقام الجُمل>   أو   stack <رقم>');
  process.exit(0);
}

if(MODE==='cutout'||MODE==='headout'){
  /* «واقف قدام اللوحة»: نقصّ المتحدث بمدى زمني كامل، ونرسمه فوق التصميم بلا كرت */
  const m=String(process.argv[4]||'').match(/^([\d.]+)-([\d.]+)$/);
  if(!m){ console.log('عطني مدى بالثواني: cutout 23.8-26.6'); process.exit(2); }
  const a=Math.max(0,parseFloat(m[1])), b=Math.min(caps.total,parseFloat(m[2]));
  if(!(b>a)){ console.log('مدى غير صالح'); process.exit(2); }
  if(!fs.existsSync(W+'vfr')){ console.log('❌ ما فيه مجلد vfr'); process.exit(3); }
  const NVF2=fs.readdirSync(W+'vfr').filter(f=>f.endsWith('.jpg')).length;
  const f0=Math.max(1,Math.floor(a*FPS)+1), f1=Math.min(NVF2,Math.ceil(b*FPS)+1);
  fs.mkdirSync(W+'bt/src',{recursive:true}); fs.mkdirSync(W+'bt/mask',{recursive:true}); fs.mkdirSync(W+'bt/person',{recursive:true});
  const BIN2=W+'bt/personmask';
  if(!fs.existsSync(BIN2)){
    try{ cp.execSync('swiftc -O -o '+JSON.stringify(BIN2)+' '+JSON.stringify(SC+'personmask.swift'),{stdio:'pipe'}); }
    catch(e){ console.log('❌ تحتاج أدوات Xcode: xcode-select --install'); process.exit(4); }
  }
  let n=0;
  for(let f=f0;f<=f1;f++){ const id=String(f).padStart(5,'0');
    if(fs.existsSync(W+'vfr/'+id+'.jpg')){ fs.copyFileSync(W+'vfr/'+id+'.jpg', W+'bt/src/'+id+'.jpg'); n++; } }
  console.log('فريمات القصّ:',n,'— أقصّك من الخلفية…');
  cp.execSync(JSON.stringify(BIN2)+' '+JSON.stringify(W+'bt/src')+' '+JSON.stringify(W+'bt/mask')+' accurate 2.5',{stdio:'inherit'});
  cp.execSync('ffmpeg -v error -start_number '+f0+' -i '+JSON.stringify(W+'bt/src/%05d.jpg')+
    ' -start_number '+f0+' -i '+JSON.stringify(W+'bt/mask/%05d.png')+' -frames:v '+(f1-f0+1)+
    ' -filter_complex "[1:v]format=gray,scale=1080:1920[a];[0:v][a]alphamerge,format=rgba"'+
    ' -start_number '+f0+' -y '+JSON.stringify(W+'bt/person/%05d.png'),{stdio:'pipe'});
  const prev=fs.existsSync(W+'behind.json')?JSON.parse(fs.readFileSync(W+'behind.json','utf8')):{lines:[],ranges:[],faces:{}};
  const key=MODE==='headout'?'headouts':'cutouts';
  prev[key]=(prev[key]||[]).filter(c=>!(c[0]===a&&c[1]===b)).concat([[a,b]]);   /* نفس المدى مرتين = مرة وحدة */
  rebuildRanges(prev);
  const meta=JSON.parse(fs.readFileSync(W+'bt/mask/meta.json','utf8'));
  prev.faces=prev.faces||{};
  for(const mm of meta) if(mm.face) prev.faces[parseInt(mm.f,10)]=mm.face;
  /* 8 سبتمبر: حدود ثابتة للمشهد كله (وسيط حدود الجسم عبر فريماته) — بدونها الكرت الصغير كان يتبع الجسم بكل فريم
     فتهتز الخلفية (بلاغ المستخدم). المحرّك يقرأ headbox[بداية المدى] ويثبّت التأطير، والحركة الوحيدة حركة المتحدث نفسه */
  if(MODE==='headout'){
    try{
      const py='import json,os,statistics\nfrom PIL import Image\nW='+JSON.stringify(W)+';f0='+f0+';f1='+f1+'\nxs0=[];xs1=[];ys0=[];ys1=[]\n'+
        'for n in range(f0,f1+1,3):\n p=W+"bt/mask/%05d.png"%n\n if not os.path.exists(p): continue\n bb=Image.open(p).convert("L").point(lambda v:255 if v>140 else 0).getbbox()\n if not bb: continue\n xs0.append(bb[0]);ys0.append(bb[1]);xs1.append(bb[2]);ys1.append(bb[3])\n'+
        'print(json.dumps({"x0":statistics.median(xs0),"x1":statistics.median(xs1),"y0":statistics.median(ys0),"y1":statistics.median(ys1),"n":len(xs0)}) if xs0 else "null")';
      const hb=JSON.parse(cp.execSync('python3 -c '+JSON.stringify(py),{stdio:'pipe'}).toString().trim());
      if(hb){ prev.headbox=prev.headbox||{}; prev.headbox[String(a)]=hb; }
    }catch(e){ console.log('⚠️ ما قدرت أحسب الحدود الثابتة (يحتاج PIL) — الكرت بيتبع الجسم بكل فريم'); }
  }
  fs.writeFileSync(W+'behind.json',JSON.stringify(prev,null,1));
  console.log('✅ '+(MODE==='headout'?'«راسك برّا المستطيل»':'«واقف قدام اللوحة»')+' جاهز من',a,'إلى',b,'ثانية.');
  console.log('   ارسم: node 04_render_frames.js '+W+' range '+a+' '+b);
  process.exit(0);
}
if(MODE!=='build'&&MODE!=='stack'){ console.log('الأوامر: plan · build · stack · cutout · headout · drop · off'); process.exit(2); }
/* «2» = الجملة كاملة · «2:6-8» = الكلمات 6→8 داخل الجملة 2 */
const pick=process.argv.slice(4).map(a=>{
  const m=String(a).match(/^(\d+)(?::(\d+)-(\d+))?$/); if(!m) return null;
  const i=parseInt(m[1],10)-1; if(i<0||i>=caps.cards.length) return null;
  const n=caps.cards[i].w.length;
  return {i, from:m[2]?Math.max(0,parseInt(m[2],10)-1):0, to:m[3]?Math.min(n-1,parseInt(m[3],10)-1):n-1};
}).filter(Boolean);
if(!pick.length){ console.log('عطني أرقام الجُمل: '+MODE+' 1 9   أو   '+MODE+' 2:6-8'); process.exit(2); }
if(!fs.existsSync(W+'vfr')){ console.log('❌ ما فيه مجلد vfr — استخرج الفريمات أول'); process.exit(3); }

/* 1) بناء أداة القصّ مرة وحدة */
const BIN=W+'bt/personmask';
fs.mkdirSync(W+'bt/src',{recursive:true}); fs.mkdirSync(W+'bt/mask',{recursive:true}); fs.mkdirSync(W+'bt/person',{recursive:true});
if(!fs.existsSync(BIN)){
  try{ cp.execSync('swiftc -O -o '+JSON.stringify(BIN)+' '+JSON.stringify(SC+'personmask.swift'),{stdio:'pipe'}); }
  catch(e){ console.log('❌ ما قدرت أبني أداة القصّ — تحتاج أدوات Xcode: xcode-select --install'); process.exit(4); }
}

/* 2) الفريمات المطلوبة فقط (مو الفيديو كله) */
const NVF=fs.readdirSync(W+'vfr').filter(f=>f.endsWith('.jpg')).length;
const lines=[], ranges=[];
for(const sel of pick){
  const c=caps.cards[sel.i];
  const ws=c.w.slice(sel.from, sel.to+1);
  const a=Math.max(0,ws[0].s-0.20), b=Math.min(caps.total,ws[ws.length-1].e+0.45);
  const f0=Math.max(1,Math.floor(a*FPS)+1), f1=Math.min(NVF,Math.ceil(b*FPS)+1);
  ranges.push([f0,f1]);
  const ln={card:sel.i, s:a, e:b, words:ws.map(w=>({t:w.t,s:w.s,e:w.e}))};
  if(MODE==='stack'){ ln.style='stack'; ln.umask='bt/umask_'+(sel.i+1)+'.png'; }
  lines.push(ln);
}
let copied=0;
for(const [f0,f1] of ranges) for(let f=f0;f<=f1;f++){
  const id=String(f).padStart(5,'0');
  if(fs.existsSync(W+'vfr/'+id+'.jpg')){ fs.copyFileSync(W+'vfr/'+id+'.jpg', W+'bt/src/'+id+'.jpg'); copied++; }
}
console.log('فريمات التأثير:',copied,'— أقصّ الشخص فيها…');

/* 3) القصّ + بيانات الوجه */
cp.execSync(JSON.stringify(BIN)+' '+JSON.stringify(W+'bt/src')+' '+JSON.stringify(W+'bt/mask')+' accurate 2.5',{stdio:'inherit'});

/* 4) دمج القناع كشفافية → صورة الشخص وحده (كل مدى على حدة) */
for(const [f0,f1] of ranges){
  cp.execSync('ffmpeg -v error -start_number '+f0+' -i '+JSON.stringify(W+'bt/src/%05d.jpg')+
    ' -start_number '+f0+' -i '+JSON.stringify(W+'bt/mask/%05d.png')+
    ' -frames:v '+(f1-f0+1)+
    ' -filter_complex "[1:v]format=gray,scale=1080:1920[a];[0:v][a]alphamerge,format=rgba"'+
    ' -start_number '+f0+' -y '+JSON.stringify(W+'bt/person/%05d.png'),{stdio:'pipe'});
}

/* 5) «طبقات»: قناع الجمع لكل جملة = متوسط أقنعة فريماتها (ربع الدقة). المحرّك يقرأ منه حدود الجسم صف صف
   فيثبّت التخطيط طول الجملة، والحروف ما تدخل مكاناً وقف فيه الشخص ولو بفريم (عتبة 5٪) */
if(MODE==='stack'){
  lines.forEach((ln,k)=>{ const [f0,f1]=ranges[k], n=Math.min(1024,f1-f0+1);
    cp.execSync('ffmpeg -v error -start_number '+f0+' -i '+JSON.stringify(W+'bt/mask/%05d.png')+' -frames:v '+n+
      ' -vf "scale=270:480,format=gray,tmix=frames='+n+'" -update 1 -y '+JSON.stringify(W+ln.umask),{stdio:'pipe'});
    if(!fs.existsSync(W+ln.umask)){ console.log('❌ ما انبنى قناع الجمع للجملة',ln.card+1); process.exit(5); } });
}

const meta=JSON.parse(fs.readFileSync(W+'bt/mask/meta.json','utf8'));
/* 28 سبتمبر: الأمر = القائمة الكاملة لنوعه. build يستبدل كل جُمل «ورا الراس» العادية، وstack يستبدل كل جُمل «طبقات»،
   والنوع الثاني + cutouts/headouts يبقون. الجملة اللي انبنت بالنوع الثاني تنتقل للجديد (جملة وحدة = نوع واحد).
   تشيل جملة وحدة؟ drop <رقم>. off يمسح الكل. */
const prev=fs.existsSync(W+'behind.json')?JSON.parse(fs.readFileSync(W+'behind.json','utf8')):{};
const newCards=new Set(lines.map(l=>l.card)), isStack=l=>l.style==='stack';
const kept=(Array.isArray(prev.lines)?prev.lines:[]).filter(l=>!newCards.has(l.card)&&isStack(l)!==(MODE==='stack'));
const gone=(Array.isArray(prev.lines)?prev.lines:[]).filter(l=>!newCards.has(l.card)&&isStack(l)===(MODE==='stack'));
if(gone.length) console.log('ℹ️  شلت الجُمل القديمة من نفس النوع:',gone.map(l=>l.card+1).join(' '),'— تبيها؟ أضفها لنفس الأمر');
prev.lines=kept.concat(lines).sort((p,q)=>p.s-q.s);
rebuildRanges(prev);
prev.faces=prev.faces||{};
for(const m of meta) if(m.face) prev.faces[parseInt(m.f,10)]=m.face;
fs.writeFileSync(W+'behind.json',JSON.stringify(prev,null,1));
console.log('✅ behind.json جاهز —',lines.length,MODE==='stack'?'جملة «طبقات» (فوق الراس ← ورا ← قدّام).':'جملة يمرّ كلامها ورا الشخص.');
console.log('   عاين: node 04_render_frames.js '+W+' preview '+lines.map(l=>(l.e-0.3).toFixed(2)).join(' '));
console.log('   ثم ارسم: node 04_render_frames.js '+W+' all --force');
