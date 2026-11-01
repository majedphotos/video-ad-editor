// مايكرويف مقصوص (بلا سقف ولا باب): ماقنترون بزعانف تبريد ← دليل موجات فوق ← غرفة طبخ بجدران معدن ← صحن يلف عليه كوب.
// الموجات وحركة الصحن والكوب والبخار يرسمها المحرّك.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { k, collector, finish } from "./lib.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const WIDTH = 1000, HEIGHT = 760;

const PLATE = { x: -130, y: -66, w: 250, d: 132, r: 8 };
const CAV = { x: -104, y: -52, w: 124, d: 104 }, WALL = 5, CAV_TOP = 82, FLOOR = 6;
const TURN = { c: [-42, 0], r: 36, z: FLOOR + 3 };
const MAG = { x: 40, y: -36, w: 28, d: 28 }, MAG_Z = [28, 58];
const GUIDE = { x: -2, y: -33, w: 70, d: 22 }, GUIDE_Z = 62;

const P = k.fitProjection([...k.boxCorners(PLATE, -17, 0), [CAV.x, CAV.y, CAV_TOP + 4], [GUIDE.x + GUIDE.w, GUIDE.y, GUIDE_Z + 12]], WIDTH, HEIGHT, { pad: 30, azimuth: 40, elevation: 30 });
const c = collector(P), { at } = c;

c.base(PLATE);
// غرفة الطبخ: أرضية، جدار خلفي، جدار يسار (عالية)، والجدار اليمين والأمامي مقصوصين واطيين
const box = { ...CAV, r: 3 };
c.solid(k.slabOf(box, 0, FLOOR, P, 6, 1), { tone: "mid" });
c.solid(k.slabOf({ x: CAV.x, y: CAV.y, w: CAV.w, d: WALL, r: 1 }, FLOOR, CAV_TOP - FLOOR, P, 3, 0.6), { tone: "mid" });
c.solid(k.slabOf({ x: CAV.x, y: CAV.y, w: WALL, d: CAV.d, r: 1 }, FLOOR, CAV_TOP - FLOOR, P, 3, 0.6), { tone: "mid" });
c.line([24, 44, 64].map((z) => k.segment([CAV.x + WALL, CAV.y + WALL, z], [CAV.x + CAV.w - 4, CAV.y + WALL, z], P) + k.segment([CAV.x + WALL, CAV.y + WALL, z], [CAV.x + WALL, CAV.y + CAV.d - 4, z], P)).join(""), "faint");
c.dots([[CAV.x + 30, CAV.y + WALL, CAV_TOP - 6], [CAV.x + 90, CAV.y + WALL, CAV_TOP - 6], [CAV.x + WALL, CAV.y + 30, CAV_TOP - 6], [CAV.x + WALL, CAV.y + 80, CAV_TOP - 6]].map(at), 1.1, "mid");
// الصحن: بكرات تحت + زجاج
for (const a of [0.3, 2.4, 4.5]) c.solid(k.cylinder(TURN.c[0] + 24 * Math.cos(a), TURN.c[1] + 24 * Math.sin(a), 3, FLOOR, 3, P, 14), { tone: "lo" });
c.solid(k.cylinder(TURN.c[0], TURN.c[1], TURN.r, TURN.z, 2.4, P, 64, 0.6), { tone: "hi" });
c.line(k.ring(TURN.c[0], TURN.c[1], TURN.r - 5, TURN.z + 2.4, P, 56), "faint");
// المقصورة: محوّل + ماقنترون بزعانف
const tr = { x: 40, y: 8, w: 30, d: 32, r: 2 };
c.solid(k.slabOf(tr, FLOOR, 30, P, 4, 0.8), { tone: "lo" });
c.line([12, 18, 24, 30].map((z) => k.sideSeam(tr, z, P)).join(""), "faint");
c.solid(k.slabOf({ ...MAG, r: 2 }, FLOOR, MAG_Z[0] - FLOOR, P, 4, 0.8), { tone: "lo" });               // قاعدة
for (let z = MAG_Z[0]; z < MAG_Z[1] - 2; z += 4) c.solid(k.slabOf({ x: MAG.x - 3, y: MAG.y - 3, w: MAG.w + 6, d: MAG.d + 6, r: 1 }, z, 1.2, P, 3), { tone: "mid" });
c.solid(k.cylinder(MAG.x + MAG.w / 2, MAG.y + MAG.d / 2, 9, MAG_Z[0], MAG_Z[1] - MAG_Z[0], P, 32, 0.8), { tone: "hi" });
c.solid(k.cylinder(MAG.x + MAG.w / 2, MAG.y + MAG.d / 2, 3.2, MAG_Z[1], GUIDE_Z - MAG_Z[1], P, 16), { tone: "mid" });   // الهوائي
c.line(k.pathOf([[MAG.x, MAG.y + MAG.d, 20], [MAG.x + 4, tr.y + 4, 20]].map(at)), "mid");               // سلك للمحوّل
// دليل الموجات (قناة مفتوحة من فوق): قعر وجنب خلفي
c.solid(k.slabOf({ ...GUIDE, r: 1.5 }, GUIDE_Z, 11, P, 3, 0.6), { tone: "mid" });
c.line(k.sideSeam(GUIDE, GUIDE_Z + 5.5, P), "faint");
c.screws({ x: GUIDE.x + 30, y: GUIDE.y, w: 36, d: GUIDE.d }, 3, GUIDE_Z + 11);

// ── مكان الكوب والموجات (المحرّك) ──
c.use("front");
// الجدار اليمين الواطي (بين الغرفة والمقصورة) والشفة الأمامية
c.solid(k.slabOf({ x: CAV.x + CAV.w - WALL, y: CAV.y, w: WALL, d: CAV.d, r: 1 }, FLOOR, 26, P, 3, 0.6), { tone: "mid" });
c.solid(k.slabOf({ x: CAV.x, y: CAV.y + CAV.d - WALL, w: CAV.w, d: WALL, r: 1 }, FLOOR, 12, P, 3, 0.6), { tone: "mid" });
{ const t = k.sideTicks(CAV.x + 6, CAV.x + CAV.w - 6, 5, 5, CAV.y + CAV.d, FLOOR + 10, [2, 4], P, "x"); c.line(t.minor, "lo"); c.line(t.major, "mid"); }
// لوحة التحكم: شاشة + قرص
const panel = { x: 80, y: 44, w: 34, d: 6, r: 1 };
c.solid(k.slabOf(panel, FLOOR, 38, P, 3, 0.6), { tone: "mid" });
c.solid(k.slabOf({ x: 85, y: 50, w: 24, d: 0.8, r: 0.4 }, 32, 7, P, 2), { tone: "hi", tag: "display" });
for (const r of [6.5, 5]) c.line(k.sideRing([97, 50.4, 18], r, "y", P, 40), r === 6.5 ? "hi" : "lo");
c.dots([at([97, 50.4, 22.5])], 1.4, "hi");

const mug = c.tmpl(() => { c.solid(k.cylinder(0, 0, 9, 0, 20, P, 36, 0.6), { tone: "hi" }); c.line(k.ring(0, 0, 7.4, 20, P, 36), "mid"); });
finish({ P, c, file: join(HERE, "../assets/micro"), width: WIDTH, height: HEIGHT, templates: { mug },
  world: { CAV, CAV_TOP, FLOOR, TURN, MAG, MAG_Z, GUIDE, GUIDE_Z, WALL } });
