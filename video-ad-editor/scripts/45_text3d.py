#!/usr/bin/env python3
"""كلمات مجسّمة بخط حقيقي: يشكّل النص العربي بـharfbuzz (الحروف متصلة صح) ويطلع مسار SVG لكل كلمة.
المشهد يحوّلها مجسّم بحافة مشطوفة بـword3D من motion/kit3d.mjs.

  python3 scripts/45_text3d.py <المشروع>/assets/words3d.json "كلمة" "كلمة ثانية" ...
     [--font motion/fonts/Cairo-VF.ttf] [--wght 900]

يضيف للملف لو موجود (ما يمسح الكلمات القديمة).
"""
import sys, json, subprocess, argparse
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent


def need():
    try:
        import uharfbuzz, fontTools  # noqa: F401
    except ImportError:
        print("… أنزّل uharfbuzz و fonttools (مرة وحدة)", file=sys.stderr)
        r = subprocess.run([sys.executable, "-m", "pip", "install", "-q", "--user", "uharfbuzz", "fonttools"])
        if r.returncode:
            sys.exit("❌ ما قدرت أنزّلهم — شغّل: python3 -m pip install --user uharfbuzz fonttools")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out"); ap.add_argument("words", nargs="+")
    ap.add_argument("--font", default=str(SKILL / "motion" / "fonts" / "Cairo-VF.ttf"))
    ap.add_argument("--wght", type=float, default=900)
    a = ap.parse_args()
    need()
    import uharfbuzz as hb
    from fontTools.ttLib import TTFont
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen
    font = hb.Font(hb.Face(hb.Blob.from_file_path(a.font)))
    tt = TTFont(a.font)
    if "fvar" in tt:
        from fontTools.varLib.instancer import instantiateVariableFont
        font.set_variations({"wght": a.wght}); tt = instantiateVariableFont(tt, {"wght": a.wght})
    gs, upem = tt.getGlyphSet(), tt["head"].unitsPerEm
    out = Path(a.out); res = json.loads(out.read_text(encoding="utf-8")) if out.exists() else {}
    for w in a.words:
        buf = hb.Buffer(); buf.add_str(w); buf.guess_segment_properties(); hb.shape(font, buf, {})
        pen, x = SVGPathPen(gs), 0
        for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
            gs[tt.getGlyphName(info.codepoint)].draw(TransformPen(pen, (1, 0, 0, 1, x + pos.x_offset, pos.y_offset))); x += pos.x_advance
        res[w] = {"d": pen.getCommands(), "adv": x, "upem": upem}
        print(f"✅ {w}  (عرض {x} من {upem})")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(res, ensure_ascii=False), encoding="utf-8")
    print(f"→ {out}")


if __name__ == "__main__":
    main()
