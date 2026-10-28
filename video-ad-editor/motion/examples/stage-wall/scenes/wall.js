/* الافتتاحية: جدار شرائح 3D (ctx.slideWall). كل كرت لمحة من البلقن، وكرت البطل = أول فريم من مشهد «ريل» (قطع مطابق). */
const FACES = [
  ['ريل', 'acc'], ['3D', 'ink'], ['بودكاست', 'dark'], ['60', 'num'], ['مونتاج', 'dark'],
  ['كابشن', 'dark'], ['كفر', 'acc'], ['9:16', 'num'], ['ستايل', 'dark'],
  ['موشن', 'ink'], ['A / B', 'num'], ['ثمبنيل', 'dark'], ['إيقاع', 'acc'], ['100', 'num'],
  ['سكتات', 'dark'], ['16:9', 'num'], ['حركة', 'dark'], ['هوك', 'ink'], ['17', 'num'],
];
MOTION.scene({
  id: 'wall', blur: [[0.15, 3.2]],
  setup(ctx) {
    const { P, WIN } = { P: ctx.P, WIN: DEMO.WIN };
    this.wall = ctx.slideWall({
      cols: 6, rows: 5, hero: 14, win: WIN, texW: 720,
      times: { pop: [-0.45, 0.75], fly: [0, 2.2], land: [2.05, 3.2] },
      from: { cam: [-11, 6.5, 17.5], look: [1.6, -1.6, 0], roll: -.24 },
      via: { cam: [6.2, -3.4, 14.5], look: [-2.6, 1.2, 0], roll: .1 },
      card: (X, w, h, i, hero) => {
        const s = w / WIN.w;
        if (hero) { X.scale(s, s); X.translate(-WIN.x, -WIN.y); DEMO.reel(X, ctx, 0); return; }
        const [word, kind] = FACES[(i > 14 ? i - 1 : i) % FACES.length];
        const bg = kind === 'acc' ? P.acc : kind === 'ink' ? P.ink : '#151515';
        const fg = kind === 'acc' ? '#0A0A0A' : kind === 'ink' ? '#0A0A0A' : P.ink;
        const r = WIN.r * s;
        X.fillStyle = bg; X.beginPath(); X.roundRect(0, 0, w, h, r); X.fill();
        if (kind === 'dark') { X.strokeStyle = 'rgba(243,238,231,.12)'; X.lineWidth = 3; X.beginPath(); X.roundRect(1.5, 1.5, w - 3, h - 3, r); X.stroke(); }
        // تفاصيل صغيرة: رقم الكرت فوق ونقطة برتقالية — عشان الجدار يبين «شرائح» مو مربعات
        ctx.text(X, String(i + 1).padStart(2, '0'), w * .09, h * .1, { family: 'num', weight: 600, size: w * .05, color: kind === 'dark' ? P.mut : 'rgba(10,10,10,.55)', dir: 'ltr', align: 'left' });
        X.fillStyle = kind === 'acc' ? '#0A0A0A' : P.acc; X.beginPath(); X.arc(w * .9, h * .085, w * .018, 0, 6.283); X.fill();
        const num = kind === 'num';
        ctx.text(X, word, w / 2, h * .56, { family: num ? 'num' : 'display', weight: 900, size: w * (num ? .26 : .2), color: num ? P.acc : fg, maxWidth: w * .82, dir: num ? 'ltr' : undefined });
        X.fillStyle = kind === 'dark' || num ? 'rgba(243,238,231,.18)' : 'rgba(10,10,10,.25)';
        X.fillRect(w * .3, h * .66, w * .4, h * .008);
      },
    });
  },
  draw(t, lt, ctx) {
    const { X, P } = ctx;
    X.fillStyle = P.bg; X.fillRect(0, 0, 1080, 1920);
    this.wall.draw(X, lt);
  },
});
