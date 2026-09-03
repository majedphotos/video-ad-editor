import {staticFile, Img} from 'remotion';
import {T, VEND} from './theme';
import {p, rgba} from './util';

const card = (a=0.96) => ({
  background: rgba(T.bg, a),
  border: `2.5px solid ${rgba(T.ink,0.09)}`,
  boxShadow: `0 20px 48px ${rgba(T.ink,0.30)}`,
});

/** شارة الحساب — فوق، داخل المنطقة الآمنة.
    تختفي بعد BADGE_UNTIL ثانية (theme.json ← badgeUntil · افتراضي 3 · ‎-1 = تبقى طول الفيديو):
    اسمه مكتوب بالمنصة نفسها وبكرت النهاية، وبقاؤها ياكل أعلى الشاشة اللي يحتاجه الرسم. */
export const Badge: React.FC<{t:number}> = ({t}) => {
  const bu = T.badgeUntil;
  if (!bu) return null;                       /* 0 = مطفية نهائياً */
  const a = p(t,0.25,0.7)
    * (bu > 0 ? 1-p(t,bu,bu+0.4) : 1)
    * (t > VEND-0.3 ? 1-p(t,VEND-0.3,VEND) : 1);
  if (a <= 0 || !T.handle) return null;
  return (
    <div style={{position:'absolute', top:190, left:0, right:0, display:'flex', justifyContent:'center', opacity:a}}>
      <div style={{...card(0.94), display:'flex', alignItems:'center', gap:15, borderRadius:999,
        padding:'0 30px', height:76, boxShadow:`0 10px 26px ${rgba(T.ink,0.16)}`}}>
        <span dir="ltr" style={{fontWeight:700, fontSize:30, color:T.ink}}>{T.handle}</span>
        <Img src={staticFile('logo.png')} style={{width:42, height:42}} />
      </div>
    </div>
  );
};

/** شريط التقدّم — أعلى من حافة الشاشة لأن انستقرام يغطي الأسفل */
export const Bar: React.FC<{t:number}> = ({t}) => {
  const a = t > VEND-0.3 ? 1-p(t,VEND-0.3,VEND) : 1;
  if (a <= 0) return null;
  return (
    <div style={{position:'absolute', left:60, right:60, top:1492, height:7, opacity:a,
      background:rgba(T.ink,0.13), borderRadius:4}}>
      <div style={{height:'100%', width:`${Math.min(1,t/VEND)*100}%`, background:T.acc, borderRadius:4}} />
    </div>
  );
};

export const Card: React.FC<React.PropsWithChildren<{style?:React.CSSProperties; radius?:number}>> =
  ({children, style, radius=20}) => (
  <div style={{...card(), borderRadius:radius, ...style}}>{children}</div>
);
