/* مستطيلات عرض الفيديو والانتقال بينها.
   الجدول يجي من project.json ← stage: [{s,e,m:"FULL"|"DOWN"|"LOWER"|"STAGE"|"SIDE"}] */
import {eio, lerp} from './util';
import {STAGE} from './theme';

export type Rect = {x:number;y:number;w:number;h:number;r:number};
export const R_FULL:  Rect = {x:0,   y:0,   w:1080, h:1920, r:0};
export const R_STAGE: Rect = {x:190, y:660, w:700,  h:700,  r:44};
export const R_SIDE:  Rect = {x:120, y:700, w:840,  h:620,  r:44};
export const R_LOWER: Rect = {x:350, y:1370, w:380, h:520,  r:32};
export const R_DOWN:  Rect = {x:0,   y:770, w:1080, h:1150, r:0};    // الافتراضي للحظات الرسم: رسم فوق ← كابشن ← وجه تحت بعرض كامل
const M: Record<string,Rect> = {FULL:R_FULL, STAGE:R_STAGE, SIDE:R_SIDE, LOWER:R_LOWER, DOWN:R_DOWN};

const S = (STAGE as {s:number;e:number;m:string}[]).map(x => ({s:x.s, e:x.e, m:M[x.m] || R_FULL}));
const TR = 0.42;                                   // مدة الانتقال بين مستطيلين

export const vrect = (t:number):Rect => {
  let i = S.findIndex(x => t >= x.s && t < x.e); if (i < 0) i = S.length-1;
  let a = S[i].m, b = a, k = 1;
  if (t < S[i].s + TR && i > 0) { a = S[i-1].m; b = S[i].m; k = eio((t - S[i].s)/TR); }
  return {x:lerp(a.x,b.x,k), y:lerp(a.y,b.y,k), w:lerp(a.w,b.w,k), h:lerp(a.h,b.h,k), r:lerp(a.r,b.r,k)};
};
