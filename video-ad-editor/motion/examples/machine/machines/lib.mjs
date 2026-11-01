// أدوات مشتركة لبناء آلات Anatomy كبيانات يرسمها محرّك الموشن (طبقات + قوالب متحركة + SVG للفحص)
import { writeFileSync } from "node:fs";
import * as k from "./iso-kit.mjs";
export { k };

export function collector(P) {
  const layers = { back: [], mid: [], front: [] };
  let L = layers.back;
  const split = (d) => (d || "").split(/(?=M)/).filter((s) => s.length > 3);
  const at = (p) => k.iso(p, P);
  const c = {
    at, split, layers,
    use(name) { L = layers[name]; },
    solid(paths, o = {}) { L.push({ k: "s", fill: paths.fill, shades: paths.shades, top: paths.top, crease: split(paths.crease), bevel: split(paths.bevel), edge: split(paths.outline), tone: o.tone || "hi", lit: !!o.lit, flat: !!o.flat, tag: o.tag }); },
    line(d, tone = "lo", tag) { if (split(d).length) L.push({ k: "l", d: split(d), tone, tag }); },
    dots(pts, size = 1.1, tone = "mid") { L.push({ k: "d", pts: pts.map((p) => p.map((v) => +v.toFixed(1))), size, tone }); },
    halo(plan, z, h) { L.push({ k: "h", fill: k.haloOf(plan, z, h, P) }); },
    byDepth(pts) { return [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P)); },
    screws(plan, inset, z) { const cs = k.corners(plan, inset); c.line(cs.map(([x, y]) => k.ring(x, y, 2.2, z, P, 16)).join(""), "lo"); c.dots(cs.map(([x, y]) => at([x, y, z])), 1); },
    base(PLATE, H = 12, FOOT = 5) {
      c.halo(PLATE, -H - FOOT, H);
      for (const [x, y] of c.byDepth(k.corners(PLATE, 24))) { c.solid(k.cylinder(x, y, 8, -H - FOOT, 1.6, P, 28), { tone: "lo" }); c.solid(k.cylinder(x, y, 6, -H - FOOT + 1.6, FOOT - 1.6, P, 28), { tone: "mid" }); }
      c.solid(k.slabOf(PLATE, -H, H, P, 8, 1.6), { tone: "mid" });
      c.line(k.planOutline(k.insetPlan(PLATE, 5), 0, P), "faint");
      c.screws(PLATE, 11, 0);
      const strip = { x: PLATE.x + 40, y: PLATE.y + PLATE.d - 14, w: PLATE.w - 80, d: 7, r: 1 };
      c.solid(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", flat: true });
      const t = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 5, 5, strip.y + 0.8, 0.6, [2, 3.8], P); c.line(t.minor, "lo"); c.line(t.major, "mid");
    },
    tmpl(fn) { const keep = L; L = []; fn(); const out = L; L = keep; return out; },
  };
  return c;
}

export function finish({ P, c, world, templates = {}, file, width, height, extra = {} }) {
  const ax = (v) => k.axisVector(P, v).map((n) => +n.toFixed(4));
  const json = { size: [width, height], P: { origin: P.origin, scale: P.scale, azimuth: P.azimuth, elevation: P.elevation }, axes: { x: ax([1, 0, 0]), y: ax([0, 1, 0]), z: ax([0, 0, 1]) }, world, layers: c.layers, templates, ...extra };
  writeFileSync(file + ".json", JSON.stringify(json));
  const TONE = { hi: "#2B2925", mid: "#8A847A", lo: "#B9B1A4", faint: "#D8D0C2", lit: "#C15F3C" };
  const FILL = { paper: "#FBF8F2", top: "#FFFDF9", shade: ["#DDD5C6", "#E6DFD2", "#EEE8DD", "#F5F1E9"], litTop: "#F6C9B4", litShade: "#E8A283" };
  const svgItem = (it) => {
    if (it.k === "h") return `<path d="${it.fill}" fill="#6b604f" opacity=".25" filter="url(#b)"/>`;
    if (it.k === "l") return `<path d="${it.d.join("")}" fill="none" stroke="${TONE[it.tone]}" stroke-width="1.6" stroke-linecap="round"/>`;
    if (it.k === "d") return it.pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${it.size}" fill="${TONE[it.tone]}"/>`).join("");
    const sh = it.flat ? "" : it.shades.map((d, i) => d && `<path d="${d}" fill="${it.lit ? FILL.litShade : FILL.shade[i]}"/>`).join("") + `<path d="${it.top}" fill="${it.lit ? FILL.litTop : FILL.top}"/>`;
    return `<path d="${it.fill}" fill="${FILL.paper}"/>${sh}<path d="${[...it.crease, ...it.bevel].join("")}" fill="none" stroke="${TONE.faint}" stroke-width="1.2"/><path d="${it.edge.join("")}" fill="none" stroke="${it.lit ? TONE.lit : TONE[it.tone]}" stroke-width="1.8" stroke-linejoin="round"/>`;
  };
  const all = [...c.layers.back, ...c.layers.mid, ...c.layers.front];
  writeFileSync(file + ".svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><defs><filter id="b"><feGaussianBlur stdDeviation="9"/></filter></defs><rect width="100%" height="100%" fill="#F0EBE0"/>${all.map(svgItem).join("")}</svg>`);
  console.log(file.split("/").pop(), "solids:", all.filter((i) => i.k === "s").length, "strokes:", all.reduce((n, it) => n + (it.edge ? it.edge.length : it.d ? it.d.length : 0), 0));
}
