// استشوار شفاف على حامل: قشرة الأسطوانة خطوط بس (حلقات + حدود)، وداخلها: موتور ← مروحة ← سلك نيكروم ملفوف على عوازل مايكا ← فوهة.
// المروحة والهوا وتوهّج السلك يرسمهم المحرّك.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { k, collector, finish } from "./lib.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const WIDTH = 1000, HEIGHT = 760;

const PLATE = { x: -122, y: -52, w: 250, d: 104, r: 8 };
const AX = { z: 78, r: 24, from: -96, to: 56 }, NOZ = { to: 96, r: 14 };
const FAN = { x: -50, r: 19 }, COIL = { from: -30, to: 48, r: 13, turns: 16 };

const P = k.fitProjection([...k.boxCorners(PLATE, -17, 0), [AX.from, 0, AX.z + AX.r + 2], [NOZ.to + 50, 0, AX.z + 30], [AX.from, -AX.r, AX.z + AX.r]], WIDTH, HEIGHT, { pad: 30, azimuth: 34, elevation: 28 });
const c = collector(P), { at } = c;
const { sinA, cosA } = k.cameraOf(P);

// حلقة حول محور x (مستوى yz) مقسومة لنص خلفي ونص أمامي
function ringX(x, r, z = AX.z, steps = 48) {
  const back = [], front = []; let run = [], near = null;
  for (let i = 0; i <= steps; i++) { const a = (i / steps) * Math.PI * 2, n = [0, Math.cos(a), Math.sin(a)];
    const f = k.depthOf(n, P) > 0, p = at([x, r * Math.cos(a), z + r * Math.sin(a)]);
    if (near === null) near = f;
    if (f !== near) { run.push(p); (near ? front : back).push(k.pathOf(run)); run = [p]; near = f; continue; }
    run.push(p); }
  if (run.length > 1) (near ? front : back).push(k.pathOf(run));
  return { back: back.join(""), front: front.join("") };
}
// حدود الأسطوانة (أبعد نقطتين عن المحور على الشاشة)
function edgePts(x, r) {
  const u = k.axisVector(P, [1, 0, 0]), L = Math.hypot(u[0], u[1]), n = [-u[1] / L, u[0] / L];
  let lo = null, hi = null;
  for (let i = 0; i < 96; i++) { const a = (i / 96) * Math.PI * 2, p = at([x, r * Math.cos(a), AX.z + r * Math.sin(a)]), d = p[0] * n[0] + p[1] * n[1];
    if (!lo || d < lo[0]) lo = [d, p]; if (!hi || d > hi[0]) hi = [d, p]; }
  return [lo[1], hi[1]];
}

c.base(PLATE);
// الحامل والمقبض + السلك
const pad = { x: -52, y: -24, w: 48, d: 48, r: 6 };
c.solid(k.slabOf(pad, 0, 4, P, 6, 1), { tone: "lo" });
c.screws(pad, 5, 4);
const grip = { x: -40, y: -10, w: 24, d: 20, r: 6 };
c.solid(k.slabOf(grip, 4, AX.z - AX.r - 2, P, 8, 0.8), { tone: "mid" });
c.line([16, 24, 32].map((z) => k.sideSeam(grip, z, P)).join(""), "faint");
c.solid(k.slabOf({ x: -34, y: 10, w: 10, d: 2.4, r: 1 }, 30, 10, P, 3, 0.4), { tone: "mid" });          // زر
c.line(k.pathOf([[-28, 0, 4.2], [-28, 30, 0.6], [-90, 38, 0.6], [-112, 38, 0.6]].map(at)), "mid");     // السلك
c.dots([at([-112, 38, 0.6])], 1.6, "hi");

// القشرة — الحلقات الخلفية
const rings = [];
for (let i = 0; i <= 6; i++) rings.push([AX.from + (AX.to - AX.from) * (i / 6), AX.r]);
for (let i = 1; i <= 3; i++) rings.push([AX.to + (NOZ.to - AX.to) * (i / 3), AX.r + (NOZ.r - AX.r) * (i / 3)]);
for (const [x, r] of rings) c.line(ringX(x, r).back, "faint");
// شبك السحب الخلفي
c.line([6, 12, 18].map((r) => ringX(AX.from - 1, r).back + ringX(AX.from - 1, r).front).join(""), "lo");
// الموتور (صندوق) + العمود
const motor = { x: AX.from + 6, y: -10, w: 26, d: 20, r: 6 };
c.solid(k.slabOf(motor, AX.z - 10, 20, P, 10, 1), { tone: "mid" });
c.line(k.sideSeam(motor, AX.z - 2, P), "faint");
c.line(k.segment([motor.x + motor.w, 0, AX.z], [FAN.x, 0, AX.z], P), "hi");
c.dots([at([FAN.x, 0, AX.z])], 1.4, "hi");

// ── مكان المروحة (المحرّك) ثم العنصر ──
c.use("mid");
const cl = k.coil(COIL.from, COIL.to, [0, AX.z], COIL.r, COIL.turns, "x", P, 18);
c.line(cl.back, "mid", "coil");
c.solid(k.slabOf({ x: COIL.from - 3, y: -16, w: COIL.to - COIL.from + 6, d: 32, r: 0.5 }, AX.z - 0.8, 1.6, P, 2), { tone: "lo", flat: true });
c.solid(k.slabOf({ x: COIL.from - 3, y: -0.8, w: COIL.to - COIL.from + 6, d: 1.6, r: 0.3 }, AX.z - 16, 32, P, 2), { tone: "lo" });
c.solid(k.slabOf({ x: COIL.to - 4, y: -5, w: 8, d: 10, r: 1 }, AX.z + 16, 3, P, 3, 0.4), { tone: "mid" });      // قاطع حرارة
c.line(cl.front, "mid", "coil");

// ── قدّام: الحلقات الأمامية والحدود ──
c.use("front");
for (const [x, r] of rings) c.line(ringX(x, r).front, "mid");
const e = rings.map(([x, r]) => edgePts(x, r));
c.line(k.pathOf(e.map((p) => p[0])) + k.pathOf(e.map((p) => p[1])), "hi");
c.line(ringX(NOZ.to, NOZ.r).back + ringX(NOZ.to, NOZ.r).front, "hi");

finish({ P, c, file: join(HERE, "../assets/dryer"), width: WIDTH, height: HEIGHT, world: { AX, NOZ, FAN, COIL } });
