/* إعدادات كروم لرسم 3D (WebGL) — نفس النتيجة على الماك والسحابة والجوال.
   الماك: كرت الشاشة عبر ANGLE-Metal (سريع).
   غيره (لينكس السحابة / جلسة الجوال / ويندوز بلا كرت): SwiftShader = رسم 3D بالمعالج — أبطأ بس ما يطلع فاضي.
   تجاوز يدوي: GL=metal|swiftshader|gpu (gpu = كرت الشاشة الافتراضي بلينكس/ويندوز لو موجود). */
module.exports = function glArgs() {
  const want = (process.env.GL || '').toLowerCase();
  const mode = want || (process.platform === 'darwin' ? 'metal' : 'swiftshader');
  if (mode === 'metal') return ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'];
  if (mode === 'gpu') return ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'];
  return ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'];
};
