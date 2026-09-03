import {Img, staticFile} from 'remotion';
import {T, VEND, OUTRO_COPY} from './theme';
import {p, ease, eio, back, rgba, onACC} from './util';

/* النصوص من project.json ← outro_copy — لا تكتب نصاً ثابتاً هني */
export const Outro: React.FC<{t:number}> = ({t}) => {
  if (t < VEND) return null;
  const s = VEND;
  const C: any = OUTRO_COPY || {};
  const RECAP: string[] = C.recap || [];
  const wipe = eio(p(t, s, s+0.45));
  const ap = (d:number) => p(t, s+d, s+d+0.42);
  const Chk = ({c}:{c:string}) => (
    <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.6}
      strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5 11-11"/></svg>);

  return (
    <div style={{position:'absolute', left:0, right:0, top:1920*(1-wipe), height:1920,
      background:T.bg, overflow:'hidden'}}>
      <div style={{opacity:ap(0.30), textAlign:'center', paddingTop:196+Math.sin((t-s)*1.6)*5-(1-ease(ap(0.30)))*18}}>
        <Img src={staticFile('logo.png')} style={{width:180, height:180}} />
      </div>
      {C.line && (
        <div style={{opacity:ap(0.42), textAlign:'center', marginTop:80,
          transform:`translateY(${(1-ease(ap(0.42)))*14}px)`}}>
          <div style={{fontWeight:700, fontSize:40, color:T.mut, lineHeight:1.55}}>{C.line}</div>
        </div>)}
      {RECAP.length > 0 && (
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, padding:'46px 120px 0', direction:'rtl'}}>
          {RECAP.map((r,i) => {
            const k = ap(0.62+i*0.11);
            return (
              <div key={i} style={{opacity:k, transform:`translateY(${(1-ease(k))*16}px)`,
                background:rgba(T.ink,0.055), border:`2px solid ${rgba(T.ink,0.08)}`, borderRadius:42,
                height:84, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 30px'}}>
                <Chk c={T.acc} />
                <span style={{fontWeight:700, fontSize:38, color:T.ink}}>{r}</span>
              </div>);
          })}
        </div>)}
      <div style={{opacity:ap(1.15), textAlign:'center', marginTop:70,
        transform:`scale(${(0.94+0.06*back(Math.min(1,ap(1.15))))*(1+0.014*Math.sin((t-s-1.15)*2.4))})`}}>
        <div style={{fontWeight:900, fontSize:88, color:T.ink}}>{C.cta_top || ''}</div>
        {C.cta_word && (
          <div style={{marginTop:22, display:'inline-block', background:T.acc, color:onACC(T.acc),
            borderRadius:44, padding:'22px 48px', fontWeight:900, fontSize:100,
            boxShadow:`0 16px 40px ${rgba(T.ink,0.22)}`}}>{C.cta_word}</div>)}
      </div>
      {C.tail && (
        <div style={{opacity:ap(1.42), textAlign:'center', marginTop:58,
          fontWeight:700, fontSize:42, color:T.mut}}>{C.tail}</div>)}
      <div style={{opacity:ap(1.6), display:'flex', alignItems:'center', justifyContent:'center',
        gap:18, marginTop:104}}>
        <Img src={staticFile('logo.png')} style={{width:54, height:54}} />
        <span dir="ltr" style={{fontWeight:700, fontSize:40, color:T.ink}}>{T.handle}</span>
      </div>
    </div>
  );
};
