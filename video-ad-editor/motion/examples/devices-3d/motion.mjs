// خطة حركة المشروع: نفس الأرقام للمشهد (يستوردها) ولسكربت الصوت (node scripts/46_motion_sfx.mjs <المشروع>)
// ما تستورد شي: دوال الحركة (track, throwOut) تنعطى من motion/kit3d.mjs — فتشتغل بالمتصفح وبالطرفية.
const TAU = Math.PI * 2;

// ── خطط الحركة لكل جهاز: نفس الأرقام للمشهد ولسكربت الصوت. W(line,i) = بداية الكلمة بالثواني، S(id) = بداية المشهد
export function plans(W, S, { track, throwOut }) {
  const P = {};
  // ─ مشهد 1: الآيفون (خفيف: f عالي) — v2: يبدأ من ظهره (لقطة ماكرو على العدسات) ويلف لقدام
  const tWire = W('l3', 0) - 0.22, tDraw = W('l3', 1), tPut = W('l3', 2), tLink = W('l4', 5) + 0.02;
  const tSpin = W('l5', 2) - 0.2, tSwap = W('l5', 4) - 0.25;
  P.tWire = tWire; P.tDraw = tDraw; P.tPut = tPut;
  P.phoneRY = track(Math.PI + 0.42, [
    { at: 0.5, to: 2 * TAU - 0.32, f: 0.5, z: 0.74 },                    // من ظهره: لفة ونص ثقيلة لين يواجهك
    { at: W('l2', 0), to: 2 * TAU - 0.12, f: 0.35, z: 1 },               // طفو هادي وقت «ولا»
    { at: tWire, to: 2 * TAU - 0.78, f: 0.55, z: 0.82 },                 // «كلود»: ثلاثة أرباع عشان الخطوط تبين مجسّمة
    { at: tPut, to: 2 * TAU, f: 0.8, z: 0.8 },                           // «وحط»: يواجهك واللقطة تدخل
    { at: tLink, to: 3 * TAU, f: 1.0, z: 0.66, antic: 0.14 },            // «أو رابط موقعك»: لفة كاملة مع رجوع الكاميرا
    { at: tSpin, to: 3 * TAU + 0.45, f: 0.9, z: 0.72 },
  ]);
  P.phoneRX = track(0.32, [{ at: 0.5, to: 0.06, f: 0.6, z: 0.85 }, { at: tWire, to: 0.16, f: 0.6, z: 0.9 }, { at: tPut, to: 0.0, f: 0.7, z: 0.9 }]);
  P.phoneRZ = track(0.1, [{ at: 0.5, to: -0.04, f: 0.6, z: 0.8 }, { at: tPut, to: 0, f: 0.7, z: 0.9 }]);
  P.phoneY = t => 0.03;
  P.phoneZ = t => 0;
  P.tSwap = tSwap;
  P.phoneX = t => throwOut(t, tSwap, 0.55, 0, -2.8);
  P.phoneRYexit = t => throwOut(t, tSwap, 0.55, 0, 1.6);
  // ─ الماك بوك (ثقيل: f أقل، تخميد أعلى، تخطّي أصغر)
  const tMac = tSwap + 0.02, tTurn = W('l5', 7), t60 = W('l6', 3);
  P.tMac = tMac; P.t60 = t60;
  P.macX = track(2.6, [{ at: tMac, to: 0, f: 0.9, z: 0.76 }]);
  P.macRY = track(-1.9, [{ at: tMac, to: -0.42, f: 0.7, z: 0.74 }, { at: tTurn - 0.1, to: 0.42, f: 0.42, z: 0.85 }, { at: t60 + 1.0, to: 0.16, f: 0.35, z: 1 }]);
  P.macZ = track(-0.8, [{ at: tMac, to: -0.95, f: 0.6, z: 0.9 }, { at: t60 - 0.9, to: -1.3, f: 0.5, z: 0.9 }]);
  P.macY = track(-0.62, [{ at: t60 - 0.9, to: -0.56, f: 0.5, z: 0.9 }]);
  // ─ مشهد 3: بلاطة الشعار (وزن متوسط)
  const s3 = S('s3'), tM = W('l9', 3), tS = W('l9', 4), tL = W('l9', 5);
  P.tileRY = track(-TAU * 1.2, [{ at: s3 - 0.15, to: -0.32, f: 0.62, z: 0.62 }, { at: tS - 0.05, to: 1.15, f: 0.85, z: 0.7, antic: 0.08 }, { at: tL + 0.05, to: 0.28, f: 0.8, z: 0.7 }, { at: W('l9', 6) + 0.5, to: 0.42, f: 0.3, z: 1 }]);
  P.tileRX = track(0.9, [{ at: s3 - 0.15, to: 0.14, f: 0.7, z: 0.75 }, { at: tS, to: 0.22, f: 0.7, z: 0.8 }, { at: tL, to: 0.1, f: 0.7, z: 0.8 }]);
  P.tileY = track(-2.4, [{ at: s3 - 0.15, to: 0.42, f: 0.8, z: 0.72 }]);
  // ─ مشهد 4: الآيفون يرجع + لفة «ومجاني»
  const s4 = S('s4'), tF = W('l10', 9);
  P.phone4RY = track(2.2, [{ at: s4 - 0.2, to: 0.42, f: 0.8, z: 0.64 }, { at: tF - 0.18, to: 0.42 - TAU - 0.15, f: 1.1, z: 0.64, antic: 0.14 }, { at: tF + 1.2, to: -TAU - 0.3, f: 0.3, z: 1 }]);
  P.phone4Z = track(-0.8, [{ at: s4 - 0.2, to: 0, f: 0.8, z: 0.8 }]);
  return P;
}

// الأصوات: ووش من كل حركة سريعة (نفس النوابض) + حركات الكاميرا والرسم
export function cues({ M, W, S, scene, whooshes, add }) {
  const list = [
    ...whooshes(M.phoneRY, { from: 0, to: M.tSwap - 0.05, r: 0.17, thr: 0.9, pitch: 1.05 }),
    ...whooshes(t => M.phoneX(t), { from: M.tSwap - 0.1, to: M.tSwap + 0.8, r: 1, thr: 2.0, pitch: 1.0, pan: -0.5, type: 'swoosh-pass' }),
    ...whooshes(M.macX, { from: M.tMac - 0.1, to: M.tMac + 1.5, r: 1, thr: 1.6, pitch: 0.78, pan: 0.4 }),
    ...whooshes(M.macRY, { from: M.tMac, to: scene('s1').end, r: 0.5, thr: 0.9, pitch: 0.75 }),
    ...whooshes(M.tileRY, { from: S('s3') - 0.3, to: scene('s3').end, r: 0.55, thr: 0.9, pitch: 0.9 }),
    ...whooshes(M.phone4RY, { from: S('s4') - 0.3, to: scene('s4').end, r: 0.17, thr: 0.9, pitch: 1.05 }),
  ];
  for (const i of [0, 4, 6]) add('whoosh', W('l2', i) - 0.02, 0.42, { dur: 0.34, pitch: 1.2 });
  add('shimmer', M.tWire, 0.3); add('shimmer', M.tDraw, 0.36);
  add('whoosh', W('l4', 1) - 0.08, 0.4, { dur: 0.5, pitch: 0.9 }); add('whoosh', W('l4', 4) - 0.05, 0.38, { dur: 0.45, pitch: 0.95 });
  add('whoosh', W('l5', 6) - 0.12, 0.4, { dur: 0.5, pitch: 0.85 }); add('whoosh', W('l10', 8) - 0.1, 0.4, { dur: 0.5, pitch: 0.95 });
  for (const i of [5, 6, 7]) add('whoosh', W('l8', i) - 0.12, 0.36, { dur: 0.45, pitch: 1.05 + 0.05 * (i - 5) });
  add('whoosh', W('l12', 1) - 0.12, 0.5, { dur: 0.6, pitch: 0.95 });
  return list;
}
