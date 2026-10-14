/* ملف البلقن (رفع تطبيق كلود، حد 200 ملف) يحمل three.js ملف vendor.zip واحد — نفكّه أول مرة جنبه.
   بالمستودع المجلد موجود أصلاً فما يسوي شي. */
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
module.exports = function ensureVendor() {
  const dir = __dirname, mark = path.join(dir, 'vendor/three/build/three.module.js'), zip = path.join(dir, 'vendor.zip');
  if (fs.existsSync(mark) || !fs.existsSync(zip)) return;
  for (const [cmd, args] of [['python3', ['-m', 'zipfile', '-e', zip, dir]], ['python', ['-m', 'zipfile', '-e', zip, dir]], ['tar', ['-xf', zip, '-C', dir]]]) {
    if (spawnSync(cmd, args, { stdio: 'ignore' }).status === 0 && fs.existsSync(mark)) return;
  }
  throw new Error('ما قدرت أفك motion/vendor.zip — فكّه يدوياً بنفس المجلد');
};
