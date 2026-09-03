/* ═══ الكلام يمرّ ورا الشخص (كشيدة عربية) ═══
   node 11_behind_text.js <work> plan            → يرشّح الجُمل المناسبة
   node 11_behind_text.js <work> build 1 9       → يجهّز قصّ الشخص لهالجُمل ويكتب behind.json
   node 11_behind_text.js <work> build 2:6-8     → كلمات بعينها داخل جملة
   node 11_behind_text.js <work> cutout 23.8-26.6 → «واقف قدام اللوحة»: بلا كرت، أنت العنصر
   node 11_behind_text.js <work> headout 23.8-26.6 → «راسك برّا المستطيل»: الفيديو بكرت وراسك يطلع فوق حافته
   node 11_behind_text.js <work> off             → يلغي التأثير

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
  console.log('\n⚠️ اختر وحدة أو ثنتين بالكثير — لو تكرر بكل جملة يفقد أثره.');
  console.log('ثم: node 11_behind_text.js <work> build <أرقام الجُمل>');
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
  prev[key]=(prev[key]||[]).concat([[a,b]]);
  prev.ranges=(prev.ranges||[]).concat([[f0,f1]]);
  const meta=JSON.parse(fs.readFileSync(W+'bt/mask/meta.json','utf8'));
  prev.faces=prev.faces||{};
  for(const mm of meta) if(mm.face) prev.faces[parseInt(mm.f,10)]=mm.face;
  fs.writeFileSync(W+'behind.json',JSON.stringify(prev,null,1));
  console.log('✅ '+(MODE==='headout'?'«راسك برّا المستطيل»':'«واقف قدام اللوحة»')+' جاهز من',a,'إلى',b,'ثانية.');
  console.log('   ارسم: node 04_render_frames.js '+W+' range '+a+' '+b);
  process.exit(0);
}
if(MODE!=='build'){ console.log('الأوامر: plan · build · cutout · headout · off'); process.exit(2); }
/* «2» = الجملة كاملة · «2:6-8» = الكلمات 6→8 داخل الجملة 2 */
const pick=process.argv.slice(4).map(a=>{
  const m=String(a).match(/^(\d+)(?::(\d+)-(\d+))?$/); if(!m) return null;
  const i=parseInt(m[1],10)-1; if(i<0||i>=caps.cards.length) return null;
  const n=caps.cards[i].w.length;
  return {i, from:m[2]?Math.max(0,parseInt(m[2],10)-1):0, to:m[3]?Math.min(n-1,parseInt(m[3],10)-1):n-1};
}).filter(Boolean);
if(!pick.length){ console.log('عطني أرقام الجُمل: build 1 9   أو   build 2:6-8'); process.exit(2); }
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
  lines.push({card:sel.i, s:a, e:b, words:ws.map(w=>({t:w.t,s:w.s,e:w.e}))});
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

const meta=JSON.parse(fs.readFileSync(W+'bt/mask/meta.json','utf8'));
const faces={};
for(const m of meta) if(m.face) faces[parseInt(m.f,10)]=m.face;
fs.writeFileSync(W+'behind.json',JSON.stringify({lines,ranges,faces},null,1));
console.log('✅ behind.json جاهز —',lines.length,'جملة يمرّ كلامها ورا الشخص.');
console.log('   الحين ارسم: node 04_render_frames.js '+W+' all --force');
