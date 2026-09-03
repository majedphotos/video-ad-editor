/* كل القيم تجي من project.json — يبنيه 04b_remotion.sh من theme.json و caps.json.
   ⛔ لا تكتب لوناً ثابتاً هني. */
import P from './project.json';

export const T = {
  bg:  P.theme.bg  || '#101828',
  ink: P.theme.ink || '#F5F7FA',
  acc: P.theme.acc || '#F2B33D',
  clay:P.theme.clay|| P.theme.acc || '#C98B18',
  mut: P.theme.mut || '#98A2B3',
  font:P.theme.font|| 'Cairo',
  handle: P.theme.handle || '',
  badgeUntil: typeof P.theme.badgeUntil === 'number' ? P.theme.badgeUntil : 0,
};
export const FPS   = 30;
export const VEND  = P.total;              // نهاية كلام الفيديو
export const OUTRO = P.outro;              // مدة كرت النهاية
export const DUR_F = Math.round((VEND + OUTRO) * FPS);
export const HAS_SFX = !!P.sfx;
export const OUTRO_COPY = P.outro_copy || {recap:[]};
export const STAGE = P.stage || [{s:0,e:1e9,m:'FULL'}];
/* "guides": true بـproject.json → تظهر مناطق انستقرام الحمراء بالاستوديو (اطفيها قبل الرندر) */
export const GUIDES = !!(P as any).guides;
