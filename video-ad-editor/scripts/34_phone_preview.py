# -*- coding: utf-8 -*-
"""معاينة الكفر/الثمبنيل بحجمه الحقيقي على شاشة الجوال — قبل ما ينشر.
   python3 34_phone_preview.py cover.jpg            ← كفر ريل 9:16: تبويب الريلز (9:16) + البروفايل (3:4) + من بعيد
   python3 34_phone_preview.py thumb.jpg --youtube  ← ثمبنيل يوتيوب 16:9: الصفحة الرئيسية بالجوال + الجانبي الصغير + المدة
   يطلّع <الاسم>_phone.jpg — افتحه بحجمه (100٪) على شاشة ريتينا = نفس اللي يشوفه المتابع.

المقاسات مقاسة من لقطة شاشة ماجد (آيفون 1320 بكسل عرض، 3 أضعاف — 3 أكتوبر 2026):
   مربّع تبويب الريلز 438×782 بكسل شاشة = 146 نقطة عرض ← كل بكسل بكفر 1080 = 0.135 نقطة.
   ⇒ نص 11 نقطة (أصغر خط مقروء بالآيفون) يحتاج ≈ 81 بكسل بالكفر. والعنوان المريح «من بعيد» ≈ 16-18 نقطة ≈ 120-135 بكسل.
"""
import sys, os
from PIL import Image, ImageDraw, ImageFilter

SCREEN_W = 1320            # عرض شاشة الآيفون بالبكسل (3x)
TILE_W, TILE_H_REEL, TILE_H_GRID = 438, 782, 584   # تبويب الريلز 9:16 · شبكة البروفايل 3:4 (قص من النص)
GAP = 3
src = sys.argv[1]; youtube = "--youtube" in sys.argv
im = Image.open(src).convert("RGB")
out = os.path.splitext(src)[0] + "_phone.jpg"
BG, GRAY = (255, 255, 255), (228, 228, 230)


def fit_cover(img, w, h):
    """قص من النص (مثل انستقرام) لنسبة w:h ثم تصغير."""
    r = w / h; iw, ih = img.size
    if iw / ih > r: nw = int(ih * r); box = ((iw - nw) // 2, 0, (iw - nw) // 2 + nw, ih)
    else: nh = int(iw / r); box = (0, (ih - nh) // 2, iw, (ih - nh) // 2 + nh)
    return img.crop(box).resize((w, h), Image.LANCZOS)


def row(img, w, h, n=3):
    canvas = Image.new("RGB", (SCREEN_W, h), BG)
    for i in range(n):
        x = i * (w + GAP)
        if i == 1: canvas.paste(fit_cover(img, w, h), (x, 0))
        else: canvas.paste(Image.new("RGB", (w, h), GRAY), (x, 0))
    return canvas


if not youtube:
    a = row(im, TILE_W, TILE_H_REEL)                 # تبويب الريلز: الكفر كامل 9:16
    b = row(im, TILE_W, TILE_H_GRID)                 # شبكة المنشورات: قص 3:4 من النص
    far = fit_cover(im, TILE_W, TILE_H_REEL).resize((TILE_W // 2, TILE_H_REEL // 2), Image.LANCZOS)   # «من بعيد» ≈ نص الحجم
    c = Image.new("RGB", (SCREEN_W, far.size[1]), BG); c.paste(far, ((SCREEN_W - far.size[0]) // 2, 0))
    parts = [("Reels tab 9:16", a), ("Profile grid 3:4", b), ("From a distance (50%)", c)]
else:
    feed = im.resize((SCREEN_W - 2 * 48, int((SCREEN_W - 2 * 48) * 9 / 16)), Image.LANCZOS)   # الرئيسية بالجوال: بعرض الشاشة تقريباً
    side = im.resize((168 * 3, 94 * 3), Image.LANCZOS)                                          # الجانبي/المقترح 168×94 نقطة
    d = ImageDraw.Draw(side); w, h = side.size
    d.rounded_rectangle((w - 120, h - 52, w - 12, h - 12), 8, fill=(0, 0, 0))                 # مكان المدة (يغطي تحت يمين)
    a = Image.new("RGB", (SCREEN_W, feed.size[1]), BG); a.paste(feed, (48, 0))
    b = Image.new("RGB", (SCREEN_W, side.size[1]), BG); b.paste(side, (48, 0))
    parts = [("YouTube home feed (phone)", a), ("Suggested 168x94 + duration badge", b)]

H = sum(p.size[1] + 70 for _, p in parts)
sheet = Image.new("RGB", (SCREEN_W, H), BG); y = 0
dr = ImageDraw.Draw(sheet)
for label, p in parts:
    dr.text((40, y + 20), label, fill=(120, 120, 120))   # تسمية إنقليزي: خط PIL الافتراضي ما يشكّل العربي
    y += 60; sheet.paste(p, (0, y)); y += p.size[1] + 10
sheet.save(out, quality=88)
print(f"✅ {out} — افتحه بحجمه الحقيقي (100٪) على الجوال أو شاشة ريتينا")
