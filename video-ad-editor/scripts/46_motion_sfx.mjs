// الصوت من الحركة نفسها: يقرا خطة حركة المشروع (<المشروع>/motion.mjs) ويطلع sfx.json — كل لفة سريعة لها ووش ذروته بلحظة أعلى سرعة.
//   node scripts/46_motion_sfx.mjs <المشروع>
// <المشروع>/motion.mjs يصدّر:
//   export function plans(W, S)  → {اسم: track(...)} — نفس الدوال اللي يستخدمها المشهد (W(line,i) = بداية الكلمة، S(id) = بداية المشهد)
//   export function cues({M, W, S, scene, whooshes, add}) → يرجّع مصفوفة: whooshes(M.x, {from,to,r,thr,pitch,pan}) لكل حركة،
//        و add(type, at, gain, {dur,pitch,pan}) لحركات الكاميرا والزوم والرسم (مو من نوابض الأجهزة)
// بعدها: python3 motion/audio.py <المشروع> ← يركّب الأصوات بأوقاتها.
import fs from 'fs'; import path from 'path'; import { pathToFileURL, fileURLToPath } from 'url';
const KIT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'motion', 'kit3d.mjs');
const { whooshes, dedupeCues } = await import(pathToFileURL(KIT).href);

const P = path.resolve(process.argv[2] || '.');
const mod = path.join(P, 'motion.mjs');
if (!fs.existsSync(mod)) { console.error('❌ ما لقيت ' + mod + ' — شوف references/devices-3d.md (قسم الصوت)'); process.exit(1); }
const tl = JSON.parse(fs.readFileSync(path.join(P, 'timeline.json'), 'utf8'));
const L = Object.fromEntries(tl.vo.map(v => [v.id, v]));
const W = (l, i) => { const ws = L[l].words; return ws[i < 0 ? ws.length + i : i].s; };
const S = id => tl.scenes.find(s => s.id === id).start;
const scene = id => tl.scenes.find(s => s.id === id);
const { plans, cues } = await import(pathToFileURL(mod).href);
const kit = await import(pathToFileURL(KIT).href);
const M = plans(W, S, kit), extra = [];
const add = (type, at, gain, o = {}) => extra.push({ type, at: +at.toFixed(3), gain, dur: o.dur, pitch: o.pitch ?? 1, pan: o.pan ?? 0 });
let list = [...(cues({ M, W, S, scene, whooshes, add }) || []), ...extra];
// ووش ناعم لانتقال المشهد بس لو ما فيه صوت حركة قريب (±0.45 ث)
for (const s of tl.scenes.slice(1)) if (s.transition && !list.some(c => Math.abs(c.at - s.start) < 0.45))
  list.push({ type: 'swoosh-pass', at: +s.start.toFixed(3), gain: 0.45, pitch: 1 });
list = dedupeCues(list, 0.35).map(c => Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined)));
fs.writeFileSync(path.join(P, 'sfx.json'), JSON.stringify(list, null, 1));
for (const c of list) console.log(`${c.type.padEnd(12)} @ ${c.at.toFixed(2)}s  gain ${c.gain}  dur ${c.dur ?? '-'}  pitch ${c.pitch}`);
console.log(`✅ ${list.length} صوت → ${path.join(P, 'sfx.json')}`);
