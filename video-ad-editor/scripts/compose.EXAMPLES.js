/* ═══ compose.EXAMPLES.js — مشاهد المثال القديم (إعلان «مونتاج بلا مونتير») — للمرجع فقط ═══
   ⛔ ما يتحمّل تلقائياً. هذي المشاهد مربوطة بتوقيتات فيديو قديم ثابتة (stamp عند 2.45ث، fileToCloud عند 8.9ث…)
   فلو اشتغلت على فيديو ثاني تطلع رسوم غريبة فوقه — هذا اللي كان يصير قبل v3.3.
   اقرأه عشان تتعلّم شلون تنكتب مشاهد الرسم (لوحة فوق + كرت الفيديو تحت، دخول بسبرنق، ربط بلحظة الكلمة).

   لو تبي تشغّله للمعاينة (نسخة المثال نفسها بس): حط الملف جنب compose.html وأضف تحت سكربت المحرّك:
     <script src="compose.EXAMPLES.js"></script>
     <script>SCENES=EXAMPLE_LAYOUT.map(s=>({...s})); SCENE_LIST.push(...EXAMPLE_SCENES);</script>
   أو خذ دالة وحدة بس: انسخها لـcompose.html مشروعك وعدّل توقيتها، ثم SCENE_LIST.push(['اسمها',اسمها]).

   يعتمد على دوال المحرّك (X · T · card · rr · sh · nsh · pr · ease · eio · back · lerp · cl · iCheck · iCloud · iFile…)
   والمتغيرات (ACC · INK · BG · MUT · CLAY · FONT · LOGO · VF · W · H · wordsOf · vrect) — كلها عامة بالمحرّك. */

/* تخطيط الكرت بالمثال القديم (كان الافتراضي بالمحرّك — صار هني) */
const EXAMPLE_LAYOUT=[
 {s:0.00,e:3.32,m:R_FULL},{s:3.32,e:8.00,m:R_DOWN},{s:8.00,e:11.45,m:R_FULL},
 {s:11.45,e:15.36,m:R_DOWN},{s:15.36,e:18.56,m:R_DOWN},{s:18.56,e:20.42,m:R_FULL},
 {s:20.42,e:25.76,m:R_FULL},{s:25.76,e:28.35,m:R_DOWN},{s:28.35,e:30.75,m:R_FULL},
 {s:30.75,e:34.90,m:R_DOWN},{s:34.90,e:38.38,m:R_DOWN},{s:38.38,e:39.76,m:R_FULL},
 {s:39.76,e:42.82,m:R_DOWN},{s:42.82,e:99,m:R_FULL}];

function stamp(t){ if(t<2.45||t>3.30)return;
  const k=pr(t,2.45,2.75), a=t>3.10?1-pr(t,3.10,3.30):1;
  X.save();X.globalAlpha=a;X.translate(540,300);X.rotate(-7*Math.PI/180);
  const sc=lerp(1.6,1,back(k));X.scale(sc,sc);
  const ar='مونتاج يدوي';
  X.font='900 58px '+FONT;const nw=X.measureText('0%').width;
  X.font='900 52px '+FONT;const aw=X.measureText(ar).width;
  const w=nw+26+aw+84,h=112;
  sh(40,16,0.26);X.fillStyle=ACC;rr(-w/2,-h/2,w,h,26);X.fill();nsh();
  T('0%',w/2-42-nw/2,4,'900 58px '+FONT,onACC(),'center','ltr');
  T(ar,-w/2+42+aw/2,4,'900 52px '+FONT,onACC());
  X.restore();
  const rk=pr(t,2.45,1.05); if(rk<1){X.save();X.globalAlpha=(1-rk)*0.45;X.strokeStyle=ACC;X.lineWidth=6;
    X.beginPath();X.arc(540,300,60+rk*300,0,7);X.stroke();X.restore();}
}
const CH=[{l:'الكابشن',i:iCaption},{l:'الزوم',i:iZoom},{l:'الكت',i:iCut},{l:'المؤثرات',i:iSpark}];
function chips(t){ if(t<3.30||t>8.00)return;
  const ws=wordsOf(1), pos=[[770,300],[310,300],[770,468],[310,468]];
  const flip=7.09, out=pr(t,7.80,8.00);
  for(let i=0;i<4;i++){
    const st=ws[i].s; if(t<st)continue;
    const k=pr(t,st,st+0.30), fk=pr(t,flip+i*0.07,flip+i*0.07+0.30);
    const [cx,cy]=pos[i], w=418,h=124;
    X.save();X.globalAlpha=1-out;
    X.translate(cx,cy);X.scale(lerp(0.7,1,back(k)),lerp(0.7,1,back(k)));
    X.rotate(lerp(-0.06*(i%2?-1:1),0,ease(k)));X.translate(-cx,-cy);
    card(cx-w/2,cy-h/2,w,h,34,ease(k));
    if(fk>0){X.save();X.globalAlpha*=fk;sh(34,14,0.22);X.fillStyle=ACC;rr(cx-w/2,cy-h/2,w,h,34);X.fill();nsh();X.restore();}
    const col=fk>0.55?onACC():INK;
    T(CH[i].l,cx-16,cy+3,'800 46px '+FONT,col,'center');
    CH[i].i(cx+w/2-62,cy,58,fk>0.55?onACC():ACC);
    if(fk>0.15)iCheck(cx-w/2+58,cy,46,fk>0.55?onACC():ACC,cl((fk-0.15)/0.5,0,1));
    X.restore();}
}
function fileToCloud(t){ if(t<8.9||t>11.45)return;
  const ck=pr(t,8.9,9.3), out=pr(t,11.2,11.45);
  X.save();X.globalAlpha=(1-out)*ease(ck);
  iCloud(540,300,230,ACC);
  T('درايف',540,478,'700 40px '+FONT,MUT);
  const pk=pr(t,10.9,11.25);
  if(pk>0&&pk<1){X.save();X.globalAlpha=(1-pk)*0.5*(1-out);X.strokeStyle=ACC;X.lineWidth=7;
    X.beginPath();X.arc(540,300,80+pk*180,0,7);X.stroke();X.restore();}
  X.restore();
  const k=pr(t,9.35,10.9); if(k<=0)return;
  const e=eio(k), y=lerp(1660,320,e), x=540+Math.sin(e*Math.PI)*150, sc=lerp(1,0.25,e*e);
  X.save();X.globalAlpha=(1-Math.pow(k,4))*(1-out);
  X.translate(x,y);X.scale(sc,sc);X.rotate(Math.sin(e*Math.PI*2)*0.05);
  const w=420,h=118;card(-w/2,-h/2,w,h,28,1);
  iFile(w/2-62,0,58,ACC);
  X.save();X.direction='ltr';T('IMG_0396.mov',-w/2+40,4,'700 36px '+FONT,INK,'left');X.restore();
  X.restore();}
function transcript(t){ if(t<11.55||t>15.36)return;
  const a=ease(pr(t,11.55,11.9))*(1-pr(t,15.15,15.36));
  const px=150,py=196,pw=780,ph=404;
  X.save();X.globalAlpha=a;card(px,py,pw,ph,32,1);
  X.fillStyle=cINK(0.22);
  [0,1,2].forEach(i=>{X.beginPath();X.arc(px+pw-46-i*36,py+44,10,0,7);X.fill();});
  T('تفريغ تلقائي — كلمة كلمة',px+pw-160,py+46,'700 34px '+FONT,MUT,'right');
  X.strokeStyle=cINK(0.10);X.lineWidth=2;
  X.beginPath();X.moveTo(px+28,py+86);X.lineTo(px+pw-28,py+86);X.stroke();
  const ws=wordsOf(3), shown=ws.filter(w=>t>=w.s);
  const RH=62, maxR=4, off=Math.max(0,shown.length-maxR);
  X.save();X.beginPath();X.rect(px+18,py+96,pw-36,ph-112);X.clip();
  shown.forEach((w,i)=>{
    const k=pr(t,w.s,w.s+0.22), y=py+120+(i-off)*RH+ (1-ease(k))*16;
    if(y<py+90||y>py+ph-10)return;
    X.save();X.globalAlpha=ease(k)*(i<off?0.35:1);
    T(w.t,px+pw-46,y,'800 44px '+FONT,i===shown.length-1?ACC:INK,'right');
    X.save();X.direction='ltr';
    const mm=String(Math.floor(w.s/60)).padStart(2,'0'),ss=(w.s%60).toFixed(2).padStart(5,'0');
    T(mm+':'+ss,px+46,y,'600 30px '+FONT,MUT,'left');X.restore();
    X.restore();});
  X.restore();X.restore();}
function cardStack(t){ if(t<15.45||t>18.56)return;
  const a=ease(pr(t,15.45,15.75))*(1-pr(t,18.35,18.56));
  X.save();X.globalAlpha=a;
  const N=6;
  for(let i=0;i<N;i++){const st=15.55+i*0.14,k=pr(t,st,st+0.30);if(k<=0)continue;
    X.save();X.globalAlpha=ease(k);
    X.translate(540+(i-2.5)*40,306+Math.abs(i-2.5)*9);X.rotate(((i-2.5)*5.6)*Math.PI/180*ease(k));
    X.scale(lerp(0.8,1,back(k)),lerp(0.8,1,back(k)));
    card(-170,-42,340,84,20,1);
    X.fillStyle=cINK(0.16);rr(-130,-14,220,12,6);X.fill();
    X.fillStyle=ACC;rr(-130,10,120,12,6);X.fill();
    X.restore();}
  const ck=pr(t,16.6,17.9), n=Math.round(lerp(1,15,eio(ck)));
  X.save();X.direction='ltr';T(String(n),540,505,'900 104px '+FONT,ACC);X.restore();
  T('كرت متحرك',540,585,'700 40px '+FONT,MUT);
  X.restore();}
function suspense(t){ if(t<18.6||t>20.42)return;
  [0,0.55].forEach(d=>{const k=pr(t,18.7+d,18.7+d+1.1);
    if(k>0&&k<1){X.save();X.globalAlpha=(1-k)*0.14;X.strokeStyle=ACC;X.lineWidth=5;
      X.beginPath();X.arc(540,760,80+k*520,0,7);X.stroke();X.restore();}});}
function syncViz(t){ if(t<20.5||t>25.76)return;
  const a=ease(pr(t,20.5,20.9))*(1-pr(t,25.5,25.76));
  const x0=110,x1=970,yb=1215,k=pr(t,20.6,25.5);
  X.save();X.globalAlpha=a;
  const chw=520;card(540-chw/2,1058,chw,84,42,1);
  T('مزامنة على مستوى الكلمة',540,1102,'800 38px '+FONT,INK);
  const N=68;
  for(let i=0;i<N;i++){const px=x0+(x1-x0)*(i/(N-1));
    const hgt=18+Math.abs(Math.sin(i*1.7)*Math.cos(i*0.53))*74;
    const done=px<=x0+(x1-x0)*k;
    X.fillStyle=done?ACC:cINK(0.20);
    rr(px-4,yb-hgt/2,8,hgt,4);X.fill();}
  [23.08,24.06,25.40].forEach(m=>{
    const mx=x0+(x1-x0)*pr(m,20.6,25.5);
    X.save();X.strokeStyle=cINK(0.25);X.lineWidth=2;X.setLineDash([6,8]);
    X.beginPath();X.moveTo(mx,yb-72);X.lineTo(mx,yb+72);X.stroke();X.restore();
    const hit=pr(t,m,m+0.42);
    if(hit>0&&hit<1){X.save();X.globalAlpha=(1-hit)*0.9;X.strokeStyle=ACC;X.lineWidth=6;
      X.beginPath();X.arc(mx,yb,14+hit*54,0,7);X.stroke();X.restore();
      X.fillStyle=ACC;X.beginPath();X.arc(mx,yb,13,0,7);X.fill();}
    else if(t>m){X.fillStyle=ACC;X.beginPath();X.arc(mx,yb,10,0,7);X.fill();}});
  const px=x0+(x1-x0)*k;
  X.strokeStyle=INK;X.lineWidth=4;X.beginPath();X.moveTo(px,yb-92);X.lineTo(px,yb+92);X.stroke();
  X.fillStyle=INK;X.beginPath();X.arc(px,yb-100,11,0,7);X.fill();
  X.restore();}
function price(t){ if(t<25.9||t>28.35)return;
  const a=ease(pr(t,25.9,26.2))*(1-pr(t,28.1,28.35));
  X.save();X.globalAlpha=a;
  T('تكلفة المونتاج',540,262,'700 44px '+FONT,MUT);
  let s='$0.00',sc=1,sy=0;
  if(t<27.27){const fi=Math.floor(t*30);const r=(Math.sin(fi*12.9898)*43758.5453);
    const v=Math.abs(r-Math.floor(r))*90+2; s='$'+v.toFixed(2);}
  else{const k=pr(t,27.27,27.52);sc=lerp(1.55,1,back(k));sy=Math.sin(k*Math.PI*3)*(1-k)*10;}
  X.save();X.direction='ltr';X.translate(540,412+sy);X.scale(sc,sc);
  T(s,0,0,'900 150px '+FONT,t<27.27?cINK(0.35):ACC);X.restore();
  if(t>27.27){const uk=ease(pr(t,27.4,27.9));X.fillStyle=ACC;
    rr(540-230*uk,502,460*uk,10,5);X.fill();
    const rk=pr(t,27.27,27.85);
    if(rk<1){X.save();X.globalAlpha=(1-rk)*0.4;X.strokeStyle=ACC;X.lineWidth=7;
      X.beginPath();X.arc(540,412,120+rk*300,0,7);X.stroke();X.restore();}}
  X.restore();}
function glitch(t){
  const g=pr(t,29.47,29.92);
  if(g>0&&g<1){const amp=(1-g)*70;
    for(let i=0;i<18;i++){const sy=i*(H/18),hh=H/18;
      const r=Math.sin(i*7.3+Math.floor(t*30)*1.7),dx=r*amp;
      X.drawImage(VF,0,sy,W,hh,dx,sy,W,hh);}
    X.save();X.globalAlpha=(1-g)*0.15;X.fillStyle=ACC;X.fillRect(0,0,W,H);X.restore();}
  const ck=pr(t,29.47,30.05), fo=1-pr(t,30.25,30.7);
  if(ck>0&&fo>0){X.save();X.globalAlpha=fo*0.8;X.strokeStyle=ACC;X.lineWidth=5;X.lineCap='round';X.lineJoin='round';
    const seeds=[[0,-1,0.9],[1,0.6,0.75],[-1,0.75,0.8]];
    seeds.forEach((sd,si)=>{let x=540,y=820;X.beginPath();X.moveTo(x,y);
      const steps=9;
      for(let i=1;i<=steps;i++){const kk=cl(ck*steps-(i-1),0,1);if(kk<=0)break;
        const nx=x+sd[0]*95*kk+Math.sin(i*3.1+si)*46*kk, ny=y+sd[1]*115*kk;
        X.lineTo(nx,ny);x=nx;y=ny;}
      X.stroke();});
    X.restore();}}
function titleChip(s,y,a,col){X.save();X.globalAlpha*=a;X.font='800 40px '+FONT;
  const w=X.measureText(s).width+72,h=80;
  X.fillStyle=col||cINK(0.07);rr(540-w/2,y-h/2,w,h,h/2);X.fill();
  T(s,540,y+2,'800 40px '+FONT,col?onACC():INK);X.restore();}
function rtlBug(t){ if(t<30.85||t>34.90)return;
  const a=ease(pr(t,30.85,31.25))*(1-pr(t,34.72,34.90));
  X.save();X.globalAlpha=a;
  titleChip('المشكلة',202,1,ACC);
  const bx=250,by=330,bw=580,bh=170;
  card(bx,by,bw,bh,30,1);
  const flip=t>=32.90;
  const s=flip?'ايبرعلا':'العربية';
  X.save();X.direction=flip?'ltr':'rtl';
  T(s,540,by+bh/2+4,'800 60px '+FONT,flip?ACC:INK);X.restore();
  const ak=pr(t,32.10,32.45), dir=flip?-1:1;
  if(ak>0){X.save();X.globalAlpha=ak;X.strokeStyle=flip?ACC:MUT;X.lineWidth=7;X.lineCap='round';X.lineJoin='round';
    const ay=by-56,x1=540-dir*130,x2=540+dir*130;
    X.beginPath();X.moveTo(x1,ay);X.lineTo(x2,ay);X.moveTo(x2,ay);X.lineTo(x2-dir*34,ay-22);X.moveTo(x2,ay);X.lineTo(x2-dir*34,ay+22);X.stroke();X.restore();}
  X.restore();
  const bk=pr(t,33.76,34.15);
  if(bk>0){const R=vrect(t);X.save();X.globalAlpha=bk*a;X.fillStyle='#0B0B0A';
    rr(R.x,R.y,R.w,R.h,R.r);X.fill();
    const wk=pr(t,34.10,34.45);
    if(wk>0){X.globalAlpha=wk*a;X.strokeStyle=ACC;X.lineWidth=8;X.lineCap='round';
      const cx=R.x+R.w/2,cy=R.y+R.h/2;
      X.beginPath();X.arc(cx,cy-16,54,0,7);X.stroke();
      X.beginPath();X.moveTo(cx,cy-42);X.lineTo(cx,cy-4);X.stroke();
      X.beginPath();X.arc(cx,cy+16,6,0,7);X.fillStyle=ACC;X.fill();
      T('الفيديو يطلع أسود',cx,cy+120,'800 44px '+FONT,'#F3EFEA');}
    X.restore();}}
function rtlFix(t){
  const bk=(t>=34.90&&t<37.55)?1-pr(t,37.20,37.55):0;
  if(bk>0){const R=vrect(t);X.save();X.globalAlpha=bk;X.fillStyle='#0B0B0A';rr(R.x,R.y,R.w,R.h,R.r);X.fill();
    const cx=R.x+R.w/2,cy=R.y+R.h/2, pw=420, pk=pr(t,34.95,37.5);
    T('جاري الإصلاح…',cx,cy-46,'800 44px '+FONT,'#F3EFEA');
    X.fillStyle=cBG(0.18);rr(cx-pw/2,cy+16,pw,14,7);X.fill();
    X.fillStyle=ACC;rr(cx-pw/2,cy+16,pw*eio(pk),14,7);X.fill();
    X.save();X.direction='ltr';T(Math.round(eio(pk)*100)+'%',cx,cy+80,'700 34px '+FONT,cBG(0.65));X.restore();
    X.restore();}
  const hk=pr(t,37.30,37.95);
  if(hk>0&&hk<1){const R=vrect(t);X.save();X.globalAlpha=(1-hk)*0.85;X.strokeStyle=ACC;X.lineWidth=9;
    rr(R.x-hk*40,R.y-hk*40,R.w+hk*80,R.h+hk*80,R.r+hk*20);X.stroke();X.restore();}
  if(t<34.95||t>38.38)return;
  const a=ease(pr(t,34.95,35.3))*(1-pr(t,38.20,38.38));
  X.save();X.globalAlpha=a;
  titleChip('الإصلاح',202,1,null);
  const rows=[['تشخيص',36.17],['تعديل',37.09],['اختبار',37.91]];
  rows.forEach((r,i)=>{
    const y=360+i*100, k=pr(t,r[1],r[1]+0.34);
    X.save();X.globalAlpha=lerp(0.32,1,ease(k));
    card(250,y-40,580,80,24,1);
    T(r[0],790,y+2,'800 42px '+FONT,k>0.3?INK:MUT,'right');
    if(k>0.1)iCheck(310,y,46,ACC,cl((k-0.1)/0.6,0,1));
    X.restore();});
  X.restore();}
function solved(t){ if(t<38.45||t>39.76)return;
  const k=pr(t,38.45,38.85), a=1-pr(t,39.55,39.76);
  X.save();X.globalAlpha=a;
  X.translate(540,320);X.scale(lerp(0.5,1,back(k)),lerp(0.5,1,back(k)));X.translate(-540,-320);
  sh(36,14,0.24);X.fillStyle=ACC;X.beginPath();X.arc(540,320,86,0,7);X.fill();nsh();
  iCheck(540,320,110,onACC(),cl(pr(t,38.60,39.05),0,1));
  X.restore();
  const rk=pr(t,38.5,39.2);
  if(rk<1){X.save();X.globalAlpha=(1-rk)*0.4*a;X.strokeStyle=ACC;X.lineWidth=7;
    X.beginPath();X.arc(540,320,90+rk*250,0,7);X.stroke();X.restore();}}
function oneFile(t){ if(t<39.85||t>42.82)return;
  const a=ease(pr(t,39.85,40.2))*(1-pr(t,42.62,42.82));
  const px=170,py=200,pw=740,ph=400;
  X.save();X.globalAlpha=a;
  card(px,py,pw,ph,34,1);
  iFile(px+pw-78,py+80,74,ACC);
  T('ملف واحد',px+pw-150,py+82,'900 58px '+FONT,INK,'right');
  X.strokeStyle=cINK(0.10);X.lineWidth=2;
  X.beginPath();X.moveTo(px+34,py+142);X.lineTo(px+pw-34,py+142);X.stroke();
  T('كل الخطوات من التصوير لين التصدير',540,py+205,'700 40px '+FONT,MUT);
  const chips=[['الكت',40.44],['الكابشن',41.02],['الحل',41.52]];
  chips.forEach((c,i)=>{
    const k=pr(t,c[1],c[1]+0.5);if(k<=0)return;
    const e=eio(k);
    const sx=[210,540,880][i], sy=1180;
    const x=lerp(sx,540,e), y=lerp(sy,py+310,e), sc=lerp(1,0.82,e);
    X.save();X.globalAlpha=k<0.85?1:1-(k-0.85)/0.15;
    X.translate(x,y);X.scale(sc,sc);
    X.font='800 40px '+FONT;const w=X.measureText(c[0]).width+64,h=78;
    sh(26,10,0.2);X.fillStyle=ACC;rr(-w/2,-h/2,w,h,h/2);X.fill();nsh();
    T(c[0],0,3,'800 40px '+FONT,onACC());X.restore();});
  const lk=pr(t,42.10,42.45);
  if(lk>0){X.save();X.globalAlpha=a*ease(lk);
    const y=py+312;X.font='800 44px '+FONT;const s='جاهز للتحميل',w=X.measureText(s).width+80;
    X.fillStyle=rgba(ACC,0.14);rr(540-w/2,y-42,w,84,42);X.fill();
    T(s,540,y+2,'800 44px '+FONT,CLAY);X.restore();}
  X.restore();}
function commentBox(t){ if(t<43.1||t>46.08)return;
  const a=ease(pr(t,43.1,43.45))*(1-pr(t,45.92,46.08));
  const bx=140,by=1120,bw=800,bh=124;
  X.save();X.globalAlpha=a;
  card(bx,by,bw,bh,62,1);
  X.fillStyle=cINK(0.07);X.beginPath();X.arc(bx+bw-66,by+bh/2,42,0,7);X.fill();
  X.drawImage(LOGO,bx+bw-66-26,by+bh/2-26,52,52);
  const full='فيديو', tk=pr(t,43.88,44.55), n=Math.round(tk*full.length);
  const shown=full.slice(0,n);
  T(shown||'أضف تعليق…',bx+bw-130,by+bh/2+2,'700 46px '+FONT,shown?INK:cINK(0.30),'right');
  if(tk>0&&tk<1&&Math.floor(t*6)%2===0){X.font='700 46px '+FONT;
    const w=X.measureText(shown).width;X.fillStyle=ACC;X.fillRect(bx+bw-134-w,by+bh/2-26,4,52);}
  const sk=pr(t,44.60,44.95);
  if(sk>0){X.save();const sc=lerp(0.6,1,back(sk));X.translate(bx+72,by+bh/2);X.scale(sc,sc);
    sh(24,10,0.22);X.fillStyle=ACC;X.beginPath();X.arc(0,0,44,0,7);X.fill();nsh();
    X.strokeStyle=onACC();X.lineWidth=6;X.lineCap='round';X.lineJoin='round';
    X.beginPath();X.moveTo(14,0);X.lineTo(-14,0);X.moveTo(-14,0);X.lineTo(-2,-12);X.moveTo(-14,0);X.lineTo(-2,12);X.stroke();
    X.restore();}
  const fk=pr(t,45.10,45.85);
  if(fk>0&&fk<1){const e=eio(fk);
    X.save();X.globalAlpha=(1-fk*fk);
    const x=lerp(bx+72,930,e), y=lerp(by+bh/2,168,e), sc=lerp(1,0.55,e);
    X.translate(x,y);X.scale(sc,sc);
    sh(20,8,0.2);X.fillStyle=BG;rr(-52,-38,104,76,22);X.fill();nsh();
    X.strokeStyle=ACC;X.lineWidth=5;X.lineJoin='round';
    X.beginPath();X.moveTo(-38,-22);X.lineTo(0,8);X.lineTo(38,-22);X.stroke();
    X.strokeRect(-38,-22,76,44);X.restore();}
  X.restore();}

/* قائمة المشاهد بنفس ترتيب الرسم القديم. glitch يشرّح صورة الفيديو فمكانه طبقة الفيديو (العنصر الثالث 'video') */
glitch.layer='video';   /* لو تسجّل بالاسم من studio.json ← sceneFx:["glitch"] */
const EXAMPLE_SCENES=[
  ['glitch',glitch,'video'],
  ['stamp',stamp],['chips',chips],['fileToCloud',fileToCloud],['transcript',transcript],
  ['cardStack',cardStack],['suspense',suspense],['syncViz',syncViz],['price',price],
  ['rtlBug',rtlBug],['rtlFix',rtlFix],['solved',solved],['oneFile',oneFile],['commentBox',commentBox]];
