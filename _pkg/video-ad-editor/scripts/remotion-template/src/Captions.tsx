import {T} from './theme';
import {p, rgba, ease, back} from './util';
import caps from './caps.json';

type W = {t:string; s:number; e:number; hot:boolean};
type C = {s:number; e:number; w:W[]};
const CARDS = (caps as any).cards as C[];

/* ⚠️ الأسفل: 1920-1500 = الكرت ينتهي عند y=1460، فوق منطقة أزرار انستقرام.
   لا تنزّله تحت ذلك — شغّل 08_safe_check.js بعد أي تعديل. */
export const Captions: React.FC<{t:number}> = ({t}) => {
  const c = CARDS.find(c => t >= c.s && t < c.e);
  if (!c) return null;
  const lt = t - c.s, rt = c.e - t;
  let a = 1, dy = 0, sc = 1;
  if (lt < 0.20) { const k = lt/0.20; a = ease(k); dy = (1-ease(k))*28; sc = 0.93 + 0.07*back(k); }
  if (rt < 0.13) { const k = rt/0.13; a = k; dy = -(1-k)*10; }

  return (
    <div style={{position:'absolute', left:0, right:0, bottom:1920-1460, display:'flex', justifyContent:'center',
      opacity:a, transform:`translateY(${dy}px) scale(${sc})`}}>
      <div dir="rtl" style={{
        maxWidth:918, background:rgba(T.bg,0.96), border:`2.5px solid ${rgba(T.ink,0.09)}`,
        borderRadius:38, padding:'30px 44px', boxShadow:`0 20px 48px ${rgba(T.ink,0.30)}`,
        fontFamily:T.font, fontWeight:800, fontSize:55, lineHeight:1.44, textAlign:'center', color:T.ink}}>
        {c.w.map((w,i) => {
          const active = t >= w.s && t < w.e;
          const spoken = t >= w.s;
          const lift = active ? -5*Math.sin(Math.min(1,(t-w.s)/0.10)*Math.PI) : 0;
          const hot = w.hot && spoken;
          const grow = hot ? Math.min(1,(t-w.s)/0.16) : 0;
          return (
            <span key={i} style={{display:'inline-block', margin:'0 8px', position:'relative',
              transform:`translateY(${lift}px)`,
              color: hot ? '#FFF' : (active ? T.acc : T.ink)}}>
              {hot && (
                <span style={{position:'absolute', inset:'-11px -14px', background:T.acc, borderRadius:15,
                  transform:`scaleX(${ease(grow)})`, transformOrigin:'right center', zIndex:-1}} />
              )}
              {w.t}
            </span>
          );
        })}
      </div>
    </div>
  );
};
