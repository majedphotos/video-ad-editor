/* ═══ فحص المنطقة الآمنة + الهوك ═══
   node 08_safe_check.js <workdir>            → يفحص ويطبع النتيجة
   node 08_safe_check.js <workdir> --shot     → يطلّع كمان safe.jpg (اللقطة الأسوأ وفوقها المناطق بالأحمر)

   ليش: انستقرام يغطي أسفل الريل بالكابشن والصوت وأزرار الحساب، ويمينه بأزرار اللايك والمشاركة.
   أي نص يدخل هالمناطق ينختفي على المشاهد وأنت ما تشوفه بالمعاينة.

   شلون: نرسم الشريحة نفسها بس نبدّل صورة الفيديو بلون مسطّح — فكل ما تبقّى = رسمك أنت.
   نعدّ بكسلات رسمك داخل كل منطقة خطرة.
   الحدود تتعدّل بملف <work>/safe.json إذا احتجت.                                             */
const path=require('path'), fs=require('fs');
const W=path.resolve(process.argv[2])+path.sep;
const SHOT=process.argv.includes('--shot');
const CFG=JSON.parse(fs.readFileSync(W+'sfx.json','utf8'));
const THEME=fs.existsSync(W+'theme.json')?JSON.parse(fs.readFileSync(W+'theme.json','utf8')):{};
const caps=JSON.parse(fs.readFileSync(W+'caps.json','utf8'));
const FPS=30, OUT_D=CFG.outro, DUR=caps.total+OUT_D;

/* المناطق الخطرة — نسبة الحبر المسموحة داخل كل وحدة */
const DEF={
  zones:[
    {k:'أعلى الشاشة (اسم الحساب وزر المتابعة)', x:0,   y:0,    w:1080, h:150, hard:true,  max:0.004},
    {k:'أسفل الشاشة (كابشن انستقرام والصوت)',   x:0,   y:1620, w:1080, h:300, hard:true,  max:0.002},
    {k:'حزام الأسفل الحذر',                     x:0,   y:1500, w:1080, h:120, hard:false, max:0.010},
    {k:'يمين الشاشة (لايك · تعليق · مشاركة)',   x:950, y:1100, w:130,  h:650, hard:true,  max:0.010}   /* 1٪: أقل من كذا = حافة كرت لا نص */
  ],
  hook_max:0.5            // أول كابشن لازم يظهر بأول نصف ثانية
};
const SAFE=fs.existsSync(W+'safe.json')?{...DEF,...JSON.parse(fs.readFileSync(W+'safe.json','utf8'))}:DEF;

function resolvePuppeteer(){
  for(const p of [process.env.PUPPETEER_PATH,'puppeteer-core','puppeteer',
      path.join(process.cwd(),'node_modules/puppeteer-core')]) {
    if(!p) continue; try{ return require(p); }catch(e){}
  }
  throw new Error('ما لقيت puppeteer-core — ثبّته: npm i puppeteer-core');
}
const CHROME=process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
/* بكسلان مصمتان (أحمر وأخضر) يحلّان محل صورة الفيديو.
   نرسم كل لحظة مرتين: البكسل اللي يتغيّر بينهما = مكان الفيديو، واللي يثبت = رسمك أنت.
   بهالطريقة الفحص ما يعتمد على ألوان الثيم إطلاقاً. */
const FLAT_A='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAF0lEQVR4nGP4z8BAEiJN9aiGUQ1DSgMAkPn/Afnh+ngAAAAASUVORK5CYII=';
const FLAT_B='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFUlEQVR4nGNg+M9AGhrVMKph+GoAAJHq/wEkpOWMAAAAAElFTkSuQmCC';

(async()=>{
  /* ── 1) الهوك: متى يبان أول كابشن ── */
  const first=caps.cards[0];
  const hook=first?first.s:99;
  const hookOK=hook<=SAFE.hook_max;

  if(!fs.existsSync(W+'compose.html')){
    console.log('— الهوك —');
    console.log(hookOK?`✅ أول كابشن عند ${hook.toFixed(2)} ثانية`
      :`❌ أول كابشن عند ${hook.toFixed(2)} ثانية — لازم قبل ${SAFE.hook_max}`);
    console.log('ℹ️  ما فيه compose.html — فحص البكسل للمحرّك الخفيف بس.');
    console.log('   بريموشن: خلّ "guides": true بـsafe.json ثم 04b_remotion.sh <work> studio — تشوف المناطق الحمراء حيّة.');
    process.exit(hookOK?0:3);
  }

  /* ── 2) المنطقة الآمنة ── */
  const puppeteer=resolvePuppeteer();
  const b=await puppeteer.launch({executablePath:CHROME,headless:'new',
    args:['--no-sandbox','--allow-file-access-from-files','--font-render-hinting=none','--force-color-profile=srgb']});
  const p=await b.newPage();
  p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.setViewport({width:1080,height:1920,deviceScaleFactor:1});
  await p.setCacheEnabled(false);   // لا تقرأ نسخة مخبّأة من compose.html
  await p.goto('file://'+W+'compose.html',{waitUntil:'networkidle0'});
  const FF=THEME.font||'Cairo';
  await p.evaluate(()=>new Promise(r=>{const l=document.getElementById('LOGO');
    if(!l||l.complete)return r(); l.onload=r; l.onerror=r; setTimeout(r,3000);}));
  await p.evaluate((c,o,t)=>window.init({cards:c.cards,total:c.total,outro:o,theme:t}),caps,OUT_D,THEME);
  /* ⚠️ بعد init لا قبلها — الخط اللي مو Cairo يُحقن داخل init (نفس علّة 04) */
  await p.evaluate(async f=>{
    const W=['400','600','700','800','900'];
    await Promise.all(W.map(w=>document.fonts.load(w+' 60px '+f)));
    await document.fonts.ready;
  },FF);

  /* أوقات الفحص: كل 0.4 ثانية + بداية ومنتصف كل كابشن + كرت النهاية */
  const T=new Set();
  for(let t=0;t<DUR;t+=0.4) T.add(+t.toFixed(2));
  for(const c of caps.cards){T.add(+(c.s+0.25).toFixed(2));T.add(+((c.s+c.e)/2).toFixed(2));}
  for(let t=caps.total;t<DUR;t+=0.3) T.add(+t.toFixed(2));
  const times=[...T].filter(t=>t>=0&&t<DUR).sort((a,b)=>a-b);

  const res=await p.evaluate(async(times,zones,bg,FA,FB)=>{
    const cv=document.getElementById('cv'), X=cv.getContext('2d',{willReadFrequently:true});
    const hx=h=>{h=h.replace('#','');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];};
    const B=hx(bg||"#F3EFEA"), W=1080, H=1920, EDGE=24;   /* هامش حافة الكادر — تداخل حواف الصورة يعطي إنذاراً كاذباً */
    const out=zones.map(z=>({k:z.k,hard:z.hard,max:z.max,worst:0,at:0}));
    let skipped=0;
    const near=(v,a,d)=>Math.abs(v-a)<d;
    for(const t of times){
      await window.setFrame(FA); window.draw(t); const A=X.getImageData(0,0,W,H).data;
      await window.setFrame(FB); window.draw(t); const C=X.getImageData(0,0,W,H).data;
      // لقطة ما تغيّرت بين اللونين = القياس غير صالح (الفيديو ما انرسم) — نتخطّاها
      let moved=0;
      for(let i=0;i<A.length;i+=4){ if(Math.abs(A[i]-C[i])>25){moved++;} }
      if(moved/(W*H) < 0.05){ skipped++; continue; }
      // حدود كرت الفيديو (إطاره وظله) مو نصاً — نتجاهل شريطاً حولها
      let R=null; try{ R=window.vrect?window.vrect(t):null; }catch(e){}
      const onEdge=(x,y)=>{
        if(!R) return false;
        const inY = y>R.y-14 && y<R.y+R.h+14, inX = x>R.x-14 && x<R.x+R.w+14;
        return (inY && (near(x,R.x,14)||near(x,R.x+R.w,14))) || (inX && (near(y,R.y,14)||near(y,R.y+R.h,14)));
      };
      zones.forEach((z,zi)=>{
        let ink=0;
        const x1=Math.max(EDGE,z.x), x2=Math.min(W-EDGE,z.x+z.w);
        const y1=Math.max(EDGE,z.y), y2=Math.min(H-EDGE,z.y+z.h);
        for(let y=y1;y<y2;y++){
          const row=y*W*4;
          for(let x=x1;x<x2;x++){
            const i=row+x*4;
            if(onEdge(x,y)) continue;
            // تغيّر بين اللونين = الفيديو نفسه، مو رسمك
            if(Math.abs(A[i]-C[i])>25||Math.abs(A[i+1]-C[i+1])>25||Math.abs(A[i+2]-C[i+2])>25) continue;
            const r=A[i],g=A[i+1],b=A[i+2];
            // خلفية أو ظلّ خفيف فوقها (ظلال الكروت مو نصاً — لا تُحسب)
            if(Math.abs(r-B[0])<=50&&Math.abs(g-B[1])<=50&&Math.abs(b-B[2])<=50) continue;
            if(r<18&&g<18&&b<18) continue;                                                   // ظل أسود
            ink++;
          }
        }
        const f=ink/Math.max(1,(x2-x1)*(y2-y1));
        if(f>out[zi].worst){out[zi].worst=f;out[zi].at=t;}
      });
    }
    return {out, skipped};
  },times,SAFE.zones,THEME.bg||'#F3EFEA',FLAT_A,FLAT_B);
  const skipped=res.skipped||0; const zones=res.out||res;

  /* ── 3) التقرير ── */
  const pct=x=>(x*100).toFixed(2)+'٪';
  console.log('— الهوك —');
  console.log(hookOK?`✅ أول كابشن عند ${hook.toFixed(2)} ثانية`
    :`❌ أول كابشن عند ${hook.toFixed(2)} ثانية — متأخر. لازم قبل ${SAFE.hook_max} (نصف المشاهدين ينزلون بأول ثانية)`);
  console.log('— المنطقة الآمنة (عيّنة '+(times.length-skipped)+' لقطة'+(skipped?' · '+skipped+' متخطّاة':'')+') —');
  let bad=[];
  for(const z of zones){
    const ok=z.worst<=z.max;
    if(!ok&&z.hard) bad.push(z);
    console.log(`${ok?'✅':(z.hard?'❌':'⚠️ ')} ${z.k}: ${pct(z.worst)} من المساحة عند ${z.at.toFixed(2)}ث (المسموح ${pct(z.max)})`);
  }
  const worst=zones.slice().sort((a,b)=>(b.worst/b.max)-(a.worst/a.max))[0];

  if(SHOT&&worst){        /* لقطة حقيقية وفوقها المناطق بالأحمر */
    if(fs.existsSync(W+'vfr')){
      const NVF=fs.readdirSync(W+'vfr').filter(f=>f.endsWith('.jpg')).length;
      const i=Math.min(NVF,Math.max(1,Math.round(worst.at*FPS)+1));
      await p.evaluate(s=>window.setFrame(s),'file://'+W+'vfr/'+String(i).padStart(5,'0')+'.jpg');
    }else{ await p.evaluate(s=>window.setFrame(s),FLAT_A); }   // بلا فريمات: اللون المسطّح يكفي للمعاينة
    const d=await p.evaluate((t,zones)=>{
      window.draw(t);
      const X=document.getElementById('cv').getContext('2d');
      X.save();
      for(const z of zones){
        X.fillStyle='rgba(255,0,60,0.24)'; X.fillRect(z.x,z.y,z.w,z.h);
        X.strokeStyle='rgba(255,0,60,0.9)'; X.lineWidth=4; X.strokeRect(z.x,z.y,z.w,z.h);
      }
      X.restore();
      return document.getElementById('cv').toDataURL('image/jpeg',0.9);
    },worst.at,SAFE.zones);
    fs.writeFileSync(W+'safe.jpg',Buffer.from(d.split(',')[1],'base64'));
    console.log('🖼  '+W+'safe.jpg — اللقطة عند '+worst.at.toFixed(2)+'ث والمناطق الحمراء يغطيها انستقرام');
  }
  await b.close();

  if(bad.length||!hookOK){ console.log('\n❌ لا تسلّم قبل الإصلاح: ارفع العنصر فوق الحزام أو صغّره.'); process.exit(3); }
  console.log('\n✅ كل شي داخل المنطقة الآمنة.');
})();
