/* ═══════ المشاهد — هني شغلك أنت ═══════
   ⛔ هذا الملف مكتبة أنماط، مو قالباً يُنسخ. اخترع مشاهد جديدة لكل فيديو:
      كل مشهد استعارة بصرية لما يقوله المتحدث بتلك اللحظة، لا زينة.
   • توقيت كل مشهد من كلمات caps.json — W(i) ترجّع كلمات الجملة i بتوقيتها.
   • VideoOverlay = ما يُرسم فوق الفيديو نفسه (داخل الكرت) — مثل القليتش.
   • Scenes      = ما يُرسم فوق كل شي (بطاقات، عدّادات، لوحات).
   • بعد أي تعديل: node scripts/08_safe_check.js <work> (المنطقة الآمنة + الهوك). */
import {T} from './theme';
import {p, ease, back, rgba, onACC, lerp} from './util';
import caps from './caps.json';

const CARDS = (caps as any).cards;
/** كلمات الجملة رقم i — {t,s,e} */
export const W = (i:number) => CARDS[i].w as {t:string;s:number;e:number}[];
const abs = (s:React.CSSProperties):React.CSSProperties => ({position:'absolute', ...s});
export const CARD: React.CSSProperties = {
  background: rgba(T.bg,0.97), border:`2.5px solid ${rgba(T.ink,0.09)}`,
  boxShadow:`0 18px 44px ${rgba(T.ink,0.20)}`, borderRadius:20,
};

/* ── مثال 1 · ختم يهبط مع كلمة ── */
const Stamp = ({t, at=[2.45,3.30], text='مثال'}:{t:number; at?:number[]; text?:string}) => {
  if (t < at[0] || t > at[1]) return null;
  const k = p(t,at[0],at[0]+0.30), a = t > at[1]-0.20 ? 1-p(t,at[1]-0.20,at[1]) : 1;
  return (
    <div style={abs({top:300, left:0, right:0, display:'flex', justifyContent:'center', opacity:a})}>
      <div style={{transform:`rotate(-7deg) scale(${lerp(1.6,1,back(k))})`, background:T.acc,
        color:onACC(T.acc), borderRadius:26, padding:'26px 42px', fontWeight:900, fontSize:52,
        boxShadow:`0 16px 40px ${rgba(T.ink,0.26)}`}}>{text}</div>
    </div>
  );
};

/* ── مثال 2 · بطاقات تدخل وحدة مع كل كلمة ── */
const Chips = ({t, seg=1, labels=[] as string[], from=0, to=0}:
  {t:number; seg?:number; labels?:string[]; from?:number; to?:number}) => {
  if (!labels.length || t < from || t > to) return null;
  const ws = W(seg), out = p(t, to-0.20, to);
  const pos = [[770,380],[310,380],[770,548],[310,548]];
  return (<>{labels.slice(0,4).map((l,i) => {
    const w = ws[i]; if (!w || t < w.s) return null;
    const k = p(t, w.s, w.s+0.30);
    return (
      <div key={i} style={abs({left:pos[i][0]-209, top:pos[i][1]-62, width:418, height:124,
        opacity:(1-out)*ease(k), transform:`scale(${lerp(0.7,1,back(k))})`})}>
        <div style={{...CARD, borderRadius:34, width:'100%', height:'100%',
          display:'flex', alignItems:'center', justifyContent:'center'}}>
          <span style={{fontWeight:800, fontSize:46, color:T.ink}}>{l}</span>
        </div>
      </div>);
  })}</>);
};

/** فوق الفيديو نفسه (داخل الكرت) */
export const VideoOverlay = ({t}:{t:number}) => (<></>);

/** فوق كل شي */
export const Scenes = ({t}:{t:number}) => (<>
  <Stamp t={t}/>
  {/* <Chips t={t} seg={1} labels={['أ','ب','ج','د']} from={3.3} to={8.0}/> */}
</>);
