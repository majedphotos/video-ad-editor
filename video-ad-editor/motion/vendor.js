/* ملف البلقن (رفع تطبيق كلود، حد 200 ملف) يحمل three.js ملف vendor.zip واحد، والأمثلة examples.zip — نفكّهم أول مرة جنبهم.
   بالمستودع المجلدات موجودة أصلاً فما يسوي شي. من الطرفية: node motion/vendor.js */
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
function unzip(name, mark) {
  const dir = __dirname, zip = path.join(dir, name); mark = path.join(dir, mark);
  if (fs.existsSync(mark) || !fs.existsSync(zip)) return;
  for (const [cmd, args] of [['python3', ['-m', 'zipfile', '-e', zip, dir]], ['python', ['-m', 'zipfile', '-e', zip, dir]], ['tar', ['-xf', zip, '-C', dir]]]) {
    if (spawnSync(cmd, args, { stdio: 'ignore' }).status === 0 && fs.existsSync(mark)) return;
  }
  throw new Error('ما قدرت أفك motion/' + name + ' — فكّه يدوياً بنفس المجلد');
}
module.exports = function ensureVendor() {
  unzip('vendor.zip', 'vendor/three/build/three.module.js');
  unzip('examples.zip', 'examples/devices-3d/project.json');
};
if (require.main === module) { module.exports(); console.log('✅ motion/vendor و motion/examples جاهزين'); }
