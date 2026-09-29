/* ═══ 🪝 كرت الهوك المكتوب — أول 1.5-3 ثوانٍ من كل ريل بودكاست/مقابلة (v3.8.1) ═══
   جملة هوك مكتوبة (3-8 كلمات) فوق الفيديو وهو يشتغل، تنقرا من أول فريم، ثم تطلع ويكمل المقطع بكابشنه.
   ما يلمس المحرّك: يركب على compose.html (وضع الكلام/الحلقة) وعلى compose.PODCAST.html (الكاميرات) من برّا،
   ويشتغل بروحه بصفحة شفافة (22_hook.py overlay ← طبقة شفافة لدافنشي أو فوق ريل جاهز).

   الإعداد كله بـ theme.json ← "hook" (يكتبه 22_hook.py apply — لا تكتبه باليد):
     { "text": "6 ساعات بتلفونك… وما عندك 10 دقايق؟",   ← «…» أو «|» = كسر السطر (نص الفكرة يمين، اللفّة تحت)
       "dur": 2.6,          ← ثواني (افتراضاً من عدد الكلمات: 1.6-3.0)
       "pos": "auto",       ← auto · top · mid · low  (auto: يبعد عن الوجه حسب الوضع — شوف place تحت)
       "style": "bold",     ← bold (نص ضخم — فوق الفيديو: أبيض على ظل غامق · فوق الورقة: بلون الحبر بلا ظل) · card (كرت بألوان الثيم)
       "kicker": "",        ← سطر صغير فوق (اسم البرنامج/الضيف) — اختياري
       "em": ["10 دقايق"],  ← الكلمات اللي تاخذ لون التمييز (افتراضاً: الرقم وكلمته · أو *كلمة* بالنص)
       "keepCaps": false }  ← الكابشن (والسؤال الكبير وكولاج الكلام) يختفي وقت الهوك — نصّان مع بعض = المشاهد ما يقرا ولا واحد
   الألوان كلها من الثيم (acc للتمييز) — وإن نقص الثيم: ألوان المحرّك نفسه، وإلا أبيض/أسود محايد. لا لون هوية ثابت هني.   */
(function(){
  if(window.HookCard&&window.HookCard.loaded) return;               /* مركّب مرتين (compose.html + المحرّك)؟ مرة وحدة تكفي */
  const CV=document.getElementById('cv'), CX=CV.getContext('2d'), W=1080, H=1920;
  let CFG=null, FONTF='Cairo', ACCC='#FFFFFF', BGC='#FFFFFF', INKC='#111111';
  const cl=(v,a,b)=>Math.max(a,Math.min(b,v)), pr=(t,a,b)=>cl((t-a)/(b-a),0,1), eo=k=>1-Math.pow(1-k,3);
  const hx=h=>{h=String(h).replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));};
  const rgba=(h,a)=>{const c=hx(h);return 'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')';};
  const lum=h=>{const c=hx(h).map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];};
  const onAcc=()=>lum(ACCC)>0.45?(lum(INKC)<0.3?INKC:'#111111'):'#FFFFFF';
  const toWestern=s=>String(s).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const hasNum=s=>/[0-9]/.test(s);
  function rr(x,y,w,h,r){r=Math.min(r,w/2,h/2);CX.beginPath();CX.moveTo(x+r,y);CX.arcTo(x+w,y,x+w,y+h,r);CX.arcTo(x+w,y+h,x,y+h,r);CX.arcTo(x,y+h,x,y,r);CX.arcTo(x,y,x+w,y,r);CX.closePath();}
  const words=s=>s.split(/\s+/).filter(Boolean);
  const nWords=s=>words(s.replace(/[|*…؟?!.,،]/g,' ')).length;
  /* ألوان المحرّك الحيّة (let BG/INK/ACC/FONT بالصفحة) — تُقرأ بعد init حتى تطابق الكابشن */
  const eng=n=>{ try{ switch(n){ case 'acc': return typeof ACC!=='undefined'?ACC:null; case 'bg': return typeof BG!=='undefined'?BG:null;
      case 'ink': return typeof INK!=='undefined'?INK:null; case 'font': return typeof FONT!=='undefined'?FONT:null; } }catch(e){} return null; };
  const ENGINE=(typeof vtarget==='function'&&typeof SCENE_LIST!=='undefined')?'talk'
              :(typeof sceneAt==='function'&&typeof drawQuote==='function')?'pod':'solo';

  function setup(hook,theme){
    CFG=null; if(!hook) return;
    if(typeof hook==='string') hook={text:hook};
    if(!hook.text||!String(hook.text).trim()) return;
    const TH=theme||{};
    FONTF=TH.font||eng('font')||'Cairo'; ACCC=TH.acc||eng('acc')||'#FFFFFF'; BGC=TH.bg||eng('bg')||'#FFFFFF'; INKC=TH.ink||eng('ink')||'#111111';
    if(!TH.acc) console.error('⚠️ الهوك: theme.json ما فيه acc — لون التمييز من المحرّك/محايد. حط acc بـtheme.json عشان ألوان هويتك');
    const text=toWestern(hook.text).trim(), n=nWords(text);
    CFG={text, n, from:+hook.from||0, dur:+hook.dur||cl(0.9+0.28*n,1.6,3.0), pos:hook.pos||'auto', style:hook.style||'bold',
         kicker:hook.kicker?toWestern(hook.kicker):'', em:hook.em||null, keepCaps:!!hook.keepCaps,
         surface:hook.surface||null, pad:(typeof hook.pad==='number')?hook.pad:null};
  }
  const active=t=>!!CFG&&t>=CFG.from&&t<CFG.from+CFG.dur;
  const hideCap=t=>active(t)&&!CFG.keepCaps&&t<CFG.from+CFG.dur-0.2;   /* الكابشن يرجع مع طلعة الهوك — بلا فراغ بينهما */
  /* الخط لازم يكون محمّل بحروف الهوك نفسها قبل أول فريم: خطوط قوقل مقسومة (عربي/لاتيني) والعربي ينحمّل أول ما ينطلب،
     فأول فريم كان ينرسم بخط بديل بعرض ثاني (ينكسر السطر غلط). المحرّكان ينتظران init — فننتظر هني. */
  async function fontReady(){ if(!CFG) return; const txt=CFG.text.replace(/[*|]/g,'')+(CFG.kicker||'');
    for(let i=0;i<40;i++){ try{ await document.fonts.ready; const a=await document.fonts.load('900 100px "'+FONTF+'"',txt);
        await document.fonts.load('800 40px "'+FONTF+'"',txt); if(a.length) return; }catch(e){}
      await new Promise(r=>setTimeout(r,100)); }
    console.error('⚠️ الهوك: الخط '+FONTF+' ما انحمّل — أول فريم بخط بديل'); }

  /* الأسطر: «…»/«|» تكسر السطر (الفكرة ثم اللفّة) */
  function tokens(){
    const raw=CFG.text; const parts=raw.split(/\s*\|\s*|(?<=…)\s*/).filter(p=>p.trim());
    const emList=Array.isArray(CFG.em)?CFG.em.map(toWestern):null;
    const marked=/\*[^*]+\*/.test(raw), strip=x=>x.replace(/[…؟?!.,،]/g,'');
    return parts.map(p=>{ const ws=words(p); const out=[]; let inStar=false;
      for(const w of ws){ const st=w.startsWith('*'), en=/\*[…؟?!.,،]*$/.test(w);
        let em=false; if(marked){ if(st) inStar=true; em=inStar; if(en) inStar=false; }
        out.push({t:w.replace(/\*/g,''),em}); }
      if(!marked){
        if(emList){ for(const e of emList){ const ew=words(e); for(let i=0;i+ew.length<=out.length;i++){
            if(ew.every((x,k)=>strip(out[i+k].t)===strip(x))) for(let k=0;k<ew.length;k++) out[i+k].em=true; } } }
        else for(let i=0;i<out.length;i++) if(hasNum(out[i].t)){ out[i].em=true; if(i+1<out.length&&!hasNum(out[i+1].t)) out[i+1].em=true; }   /* الرقم ووحدته */
      }
      return out; });
  }
  /* تقسيم جزء على سطور بتوازن (مو جشع): أقل عدد سطور يدخل بالعرض، وبينها الأعدل — ولا كلمة يتيمة بسطر لحالها */
  function split(g,fs,MAXW,gap){
    const n=g.length, lw=(a,b)=>{let s=0;for(let i=a;i<b;i++) s+=g[i].w+(i>a?gap:0);return s;};
    const mk=cuts=>{ const b=[0,...cuts,n], L=[]; for(let i=0;i+1<b.length;i++) L.push({items:g.slice(b[i],b[i+1]),w:lw(b[i],b[i+1])}); return L; };
    const cost=L=>{ const mx=Math.max(...L.map(l=>l.w)); if(mx>MAXW) return Infinity;
      const orphan=L.length>1&&n>=3&&L.some(l=>l.items.length===1); return mx+(orphan?MAXW*0.4:0); };
    const cands=[[[]]];
    const two=[]; for(let i=1;i<n;i++) two.push([i]); cands.push(two);
    const three=[]; for(let i=1;i<n;i++) for(let j=i+1;j<n;j++) three.push([i,j]); cands.push(three);
    for(const set of cands){ let best=null,bc=Infinity; for(const c of set){ const L=mk(c), k=cost(L); if(k<bc){bc=k;best=L;} } if(best) return best; }
    /* ما دخل ولا بثلاثة — جشع (يطلع أعرض، والمنادي يصغّر الخط) */
    const L=[]; let cur=[],cw=0; for(const w of g){ const add=cur.length?w.w+gap:w.w;
      if(cw+add>MAXW&&cur.length){ L.push({items:cur,w:cw}); cur=[w]; cw=w.w; } else { cur.push(w); cw+=add; } }
    if(cur.length) L.push({items:cur,w:cw}); return L;
  }
  function layout(){
    /* يُقاس كل فريم (كم كلمة بس) — كاش القياس كان يعلق بعرض خط ما اكتمل تحميله فتلتصق الكلمات */
    const groups=tokens(), MAXW=CFG.style==='card'?680:780, GAP=0.34;   /* card: الكرت = النص+120 ← يبقى داخل x 140..940 (عمود الأزرار يمين 950+) */
    const wrap=fs=>{ CX.font='900 '+fs+'px '+FONTF; const gap=fs*GAP, lines=[];
      for(const g of groups){ const m=g.map(w=>({...w,w:CX.measureText(w.t).width})); lines.push(...split(m,fs,MAXW,gap)); }
      return lines; };
    /* الأفضل: كل جزء (قبل «…» وبعدها) بسطر واحد — نصغّر الخط لين 68 عشانه، وبعدها بس نكسر (بتوازن، 3 أسطر بالكثير) */
    let fs=CFG.style==='card'?96:112, lines=wrap(fs);
    while(lines.length>groups.length&&fs>68){ fs=Math.max(68,Math.round(fs*0.95)); lines=wrap(fs); }
    if(lines.length>groups.length){ fs=CFG.style==='card'?80:92; lines=wrap(fs); }   /* لازم ينكسر؟ خط أكبر بسطور متوازنة أوضح من 68 */
    while((lines.length>3||lines.some(l=>l.w>MAXW))&&fs>60){ fs=Math.round(fs*0.93); lines=wrap(fs); }
    return {fs,lines,lh:Math.round(fs*1.30),gap:fs*GAP};
  }
  /* وين ينحط وشنو وراه (surface: video = لقطة ← نص أبيض على ظل · paper = خلفية الثيم ← نص بلون الحبر بلا ظل).
     كله داخل المنطقة الآمنة للهوك: x 140..940 · y 230..1480 (فوق حزام انستقرام التحتي 1500+ وتحت الشريط الفوقي).
       compose.html  : ملء الشاشة → بعيد عن الوجه (faceAnchor) · كرت تحت (R_DOWN/R_LOWER) → فوق الكرت على الورقة · R_OFF → بالنص على الورقة
       الكاميرات     : FULL/QUOTE → عند الصدر (الوجه عند 42٪ = y≈806) · SPLIT → على الفاصل بين الكاميرتين (y≈975، مكان كابشنها)
                       HEAD → فوق على الورقة (مكان كولاج الكلام، فوق راسه)                                                */
  const TOP=bh=>cl(470,230+bh/2,1480-bh/2), MID=bh=>cl(900,230+bh/2,1480-bh/2), LOW=bh=>cl(Math.max(1180,1000+bh/2),230+bh/2,1480-bh/2);
  function place(bh){
    const P=CFG.pos; let cy=null, surface='video', pad=230, R=null;
    try{
      if(ENGINE==='talk'){ R=vtarget(CFG.from+0.01); const fa=(typeof FACE_ANCH==='number')?FACE_ANCH:0.30;
        if(R&&R.off) cy=MID(bh);
        else if(R&&R.y>700) cy=cl((230+R.y-50)/2,230+bh/2,Math.max(230+bh/2,R.y-50-bh/2));
        else cy=fa<=0.45?LOW(bh):TOP(bh); }
      else if(ENGINE==='pod'){ const sc=sceneAt(CFG.from+0.01)||{};
        if(sc.m==='HEAD'){ cy=cl(640,330+bh/2,Math.max(330+bh/2,960-bh/2)); surface='paper'; }
        else if(sc.m==='SPLIT'){ cy=975; pad=130; }
        else cy=LOW(bh); }
      else cy=LOW(bh);
    }catch(e){ cy=LOW(bh); }
    if(P==='top') cy=TOP(bh); else if(P==='mid') cy=MID(bh); else if(P==='low') cy=LOW(bh);
    if(ENGINE==='talk'&&R){ const a=cy-bh/2-30, b=cy+bh/2+30;          /* ورقة لو الكتلة كلها برّا مستطيل الفيديو */
      surface=(!R.off&&b>R.y&&a<R.y+R.h)?'video':'paper'; }
    if(CFG.surface) surface=CFG.surface; if(CFG.pad!=null) pad=CFG.pad;
    return {cy,surface,pad};
  }
  function draw(t){
    if(!active(t)) return;
    const lt=t-CFG.from, rt=CFG.from+CFG.dur-t, L=layout(), fs=L.fs, lh=L.lh;
    const kh=CFG.kicker?Math.round(fs*0.62):0, blockH=L.lines.length*lh+kh, PL=place(blockH), cy=PL.cy, top=cy-blockH/2;
    const paper=PL.surface==='paper', card=CFG.style==='card';
    const out=pr(rt,0.24,0);                           /* 0..1 بآخر ربع ثانية */
    const alphaAll=1-eo(out), lift=-34*eo(out);
    CX.save(); CX.direction='rtl'; CX.textBaseline='middle'; CX.textAlign='right';
    /* الخلفية: card = كرت بألوان الثيم · bold فوق الفيديو = ظل غامق محايد بعرض الشاشة · bold فوق الورقة = لا شي (الورقة نفسها الخلفية) */
    if(card){
      const bw=Math.max(...L.lines.map(l=>l.w))+120, bh=blockH+90, bx=540-bw/2, by=top-45+lift;
      CX.globalAlpha=alphaAll; CX.shadowColor='rgba(0,0,0,'+(paper?0.14:0.28)+')'; CX.shadowBlur=50; CX.shadowOffsetY=20;
      CX.fillStyle=rgba(BGC,0.97); rr(bx,by,bw,bh,44); CX.fill(); CX.shadowColor='transparent';
      if(paper){ CX.strokeStyle=rgba(INKC,0.10); CX.lineWidth=3; rr(bx,by,bw,bh,44); CX.stroke(); }
      CX.fillStyle=ACCC; rr(bx+bw-18-10,by+34,10,bh-68,5); CX.fill();   /* خط التمييز على يمين الكرت (بداية القراءة) */
    } else if(!paper){
      const p=PL.pad, g=CX.createLinearGradient(0,top-p,0,top+blockH+p);
      g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(0.28,'rgba(0,0,0,0.58)'); g.addColorStop(0.72,'rgba(0,0,0,0.58)'); g.addColorStop(1,'rgba(0,0,0,0)');
      CX.globalAlpha=alphaAll; CX.fillStyle=g; CX.fillRect(0,top-p,W,blockH+2*p);
    }
    const txtC=(card||paper)?INKC:'#FFFFFF', glow=!card&&!paper;
    if(CFG.kicker){ CX.globalAlpha=alphaAll; const kf=Math.round(fs*0.42);
      CX.font='800 '+kf+'px '+FONTF; const kw=CX.measureText(CFG.kicker).width, ky=top+kh*0.35+lift;
      CX.fillStyle=ACCC; CX.beginPath(); CX.arc(540+kw/2+kf*0.55,ky,kf*0.22,0,7); CX.fill();
      CX.fillStyle=glow?'rgba(255,255,255,0.85)':rgba(INKC,0.7); CX.textAlign='center'; CX.fillText(CFG.kicker,540,ky+2); CX.textAlign='right'; }
    /* الكلمات: كلها ظاهرة من أول فريم (تنقرا فوراً + تصلح غلاف) — وكل كلمة «تستقر» بتتابع سريع، والتمييز يمسح من اليمين */
    let idx=0; const total=L.lines.reduce((s,l)=>s+l.items.length,0);
    L.lines.forEach((ln,li)=>{ let x=540+ln.w/2; const y=top+kh+lh*li+lh/2+lift;
      const pos=ln.items.map(w=>{ const p={w,xr:x,i:idx++}; x-=w.w+L.gap; return p; });
      /* شريط التمييز: كلمات التمييز المتجاورة (الرقم ووحدته) تحت شريط واحد يمسح من اليمين لليسار */
      const runs=[]; for(const p of pos){ if(!p.w.em) continue; const r=runs[runs.length-1];
        if(r&&r.last===p.i-1){ r.xl=p.xr-p.w.w; r.last=p.i; } else runs.push({xr:p.xr,xl:p.xr-p.w.w,first:p.i,last:p.i}); }
      for(const r of runs){ const d=r.first*0.045, ks=eo(pr(lt,0.08+d,0.34+d)), ko=eo(pr(rt,0.24,0)), pad=fs*0.13;
        const full=r.xr-r.xl+pad*2, pw=full*ks, ph=fs*1.14; r.ks=ks; if(ks<0.03) continue;
        CX.save(); CX.globalAlpha=alphaAll; CX.fillStyle=ACCC; rr(r.xr+pad-pw,y-ph/2-18*ko,pw,ph,fs*0.22); CX.fill(); CX.restore(); }
      for(const p of pos){ const w=p.w, d=p.i*0.045, k=eo(pr(lt,d,d+0.26)), ko=eo(pr(rt,0.24-(total-p.i)*0.012,0));
        const sc=1.04-0.04*k, dy=10*(1-k)-18*ko, cxw=p.xr-w.w/2;
        CX.save(); CX.globalAlpha=alphaAll; CX.translate(cxw,y+dy); CX.scale(sc,sc); CX.translate(-cxw,-(y+dy));
        CX.font='900 '+fs+'px '+FONTF;
        const run=w.em&&runs.find(r=>p.i>=r.first&&p.i<=r.last), lit=run&&run.ks>0.55;
        CX.fillStyle=lit?onAcc():txtC;
        if(glow&&!lit){ CX.shadowColor='rgba(0,0,0,0.65)'; CX.shadowBlur=24; CX.shadowOffsetY=5; }
        CX.fillText(w.t,p.xr,y+dy+fs*0.04); CX.restore(); } });
    CX.restore();
  }
  window.HookCard={loaded:true,setup,draw,active,hideCap,ready:fontReady,place,engine:ENGINE,get cfg(){return CFG;}};

  /* ── الربط بالمحرّكين (بلا تعديلهما) ── */
  const addScene=()=>{ if(CFG&&typeof SCENE_LIST!=='undefined'&&Array.isArray(SCENE_LIST)&&!SCENE_LIST.some(x=>x[0]==='hookCard')) SCENE_LIST.push(['hookCard',t=>draw(t)]); };
  if(typeof window.init==='function'){ const i0=window.init;
    window.init=function(d){ const r=i0.apply(this,arguments);                /* init أول: يحط ألوان/خط المحرّك، ويمكن يفرّغ SCENE_LIST */
      const th=(d&&d.theme)||{}; setup(th.hook,th);
      if(ENGINE==='talk') addScene();                                          /* studio.json ← sceneFx:false يفرّغ القائمة — الهوك مو «مؤثر مشهد»، يرجع */
      return Promise.all([r,fontReady()]).then(x=>x[0]); }; }
  if(ENGINE==='talk'){                                                         /* compose.html (وضع الكلام / حلقة ← ريل) */
    if(typeof window.caption==='function'){ const c0=window.caption; window.caption=function(t){ if(hideCap(t)) return; return c0(t); }; }
  } else if(ENGINE==='pod'){                                                   /* compose.PODCAST.html (كاميرتان+) */
    const c0=window.drawCaption; window.drawCaption=function(t,y){ if(hideCap(t)) return; return c0(t,y); };
    /* «السؤال الكبير» (QUOTE) وكولاج الكلام (HEAD) نصوص ضخمة بعد — تنطفي وقت الهوك (15_podcast plan أحياناً يحط السؤال بأول ثواني) */
    if(typeof window.drawQuote==='function'){ const q0=window.drawQuote; window.drawQuote=function(sc,t){ if(hideCap(t)){ drawFull(sc.cam,1.06); return; } return q0(sc,t); }; }
    if(typeof window.drawCollage==='function'){ const k0=window.drawCollage; window.drawCollage=function(t,sc){ if(hideCap(t)) return; return k0(t,sc); }; }
    const d0=window.draw; window.draw=function(t){ d0(t); if(active(t)){ CX.save(); CX.setTransform(1,0,0,1,0,0); draw(t); CX.restore(); } };
  }
})();
