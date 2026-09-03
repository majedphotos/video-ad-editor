import {interpolate, Easing} from 'remotion';
import {FPS} from './theme';

/** تقدّم من 0 إلى 1 بين ثانيتين */
export const p = (t: number, a: number, b: number) =>
  interpolate(t, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

export const ease = (k: number) => Easing.out(Easing.cubic)(k);
export const eio  = (k: number) => Easing.inOut(Easing.cubic)(k);
export const back = (k: number) => Easing.out(Easing.back(1.9))(k);
export const sec  = (f: number) => f / FPS;
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export const hx = (h: string) => {
  const s = h.replace('#','');
  return [parseInt(s.slice(0,2),16), parseInt(s.slice(2,4),16), parseInt(s.slice(4,6),16)];
};
export const rgba = (h: string, a: number) => { const c = hx(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
export const lum = (h: string) => {
  const c = hx(h).map(v => { const x = v/255; return x <= 0.03928 ? x/12.92 : Math.pow((x+0.055)/1.055, 2.4); });
  return 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2];
};
/** لون النص فوق لون التمييز — يُحسب من إضاءته، لا يُكتب يدوياً */
export const onACC = (acc: string) => (lum(acc) > 0.45 ? '#111' : '#FFF');
