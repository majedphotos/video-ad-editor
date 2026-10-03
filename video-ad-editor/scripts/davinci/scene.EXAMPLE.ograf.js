// مثال مشهد OGraf (مكتبة أنماط، مو قالب): t بالثواني من بداية الرسم، والإحداثيات على 1080×1920
// المكوّنات وصناديقها: references/motion-kit.md — والألوان تجي من theme.json تلقائياً (BG/INK/ACC…)
export function draw(t, X, W, H, MK) {
  MK.kinetic(t, { s: 0.2, box: { x: 90, y: 300, w: 900, h: 300 }, words: ['متابعينك', 'زادوا'], hot: [1], size: 120, times: [0.2, 0.7] });
  MK.odometer(t, { s: 1.2, dur: 1.8, val: 1000, cx: 540, cy: 900, size: 220, prefix: '+' });
  MK.stamp(t, { s: 3.4, cx: 540, cy: 1180, text: 'بيوم واحد', rot: -8 });
}
