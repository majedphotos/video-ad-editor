/* أدلّة المنطقة الآمنة — تظهر بالاستوديو بس لما تكون "guides": true بـproject.json.
   مناطق انستقرام اللي تغطي الشاشة، نفس أرقام 08_safe_check.js. */
export const ZONES = [
  {k:'أعلى',  x:0,   y:0,    w:1080, h:150},
  {k:'أسفل',  x:0,   y:1620, w:1080, h:300},
  {k:'حذر',   x:0,   y:1500, w:1080, h:120},
  {k:'يمين',  x:900, y:1100, w:180,  h:650},
];
export const Guides: React.FC = () => (
  <>{ZONES.map((z,i) => (
    <div key={i} style={{position:'absolute', left:z.x, top:z.y, width:z.w, height:z.h,
      background:'rgba(255,0,60,0.22)', outline:'3px solid rgba(255,0,60,0.85)', pointerEvents:'none'}} />
  ))}</>
);
