import json
from lottie_lib import *
# ⛔ مثال من ريل ماجد (0509) للتعلّم فقط — المشاهد تنخترع من جديد لكل فيديو، والتوقيتات من caps.json.
_T = load_theme("theme.json")
ACC, INK, CREAM, SAND, MUT = _T["acc"], _T["ink"], _T["bg"], _T["sand"], _T["mut"]
LOGO = "logo.png"
d = Doc(62.7)
d.group = "grid"; grid(d, 0, 62.7)
d.group = "S1_2026"
# 1) 2026 + جوال وإنترنت + فلوس تطيح عند «مصدر دخل ثاني»
d.text("احنا الحين في", 4.55, 11.68, 540, 250, 62, MUT, BOLD, pop=False)
d.counter("2026", 4.55, 11.68, 540, 520, 280, ACC)
d.strokes("phone", 6.30, 11.68, 330, 720, icon_phone(330, 720, 130), INK, 12)
d.strokes("globe", 7.70, 11.68, 750, 720, icon_globe(750, 720, 130), INK, 12)
coin_rain(d, 10.30, 11.68, n=18)
d.group = "S2_MaYahtaj"
# 2) ما يحتاج
d.text("ما يحتاج", 12.62, 19.56, 540, 280, 76, INK)
for t0, x, ic, lb in [(14.40, 810, icon_face, "وجهك"), (15.14, 540, icon_mic, "صوتك"), (16.50, 270, icon_code, "برمجة")]:
    d.circle(t0, 19.56, x, 480, 110, stroke=INK, width=9)
    d.strokes("ic " + lb, t0, 19.56, x, 480, ic(x, 480, 120), INK, 12, draw=0.4)
    d.strokes("x " + lb, t0 + 0.35, 19.56, x, 480, icon_slash(x, 480, 110), ACC, 18, draw=0.25)
    d.text(lb, t0, 19.56, x, 670, 48, INK, BOLD)
d.group = "S3_Course"
# 3) احترف كلاود
d.image(LOGO, 23.20, 27.62, 540, 400, 280)
d.text("احترف كلاود", 23.45, 27.62, 540, 730, 130, ACC)
d.group = "S4_Flow"
# 4) تبني أنظمة ← تبيعها ← تدير حسابات غيرك
d.pill("تبني أنظمة", 29.42, 35.40, 540, 250, 60, INK, CREAM)
d.strokes("a1", 29.55, 35.40, 540, 360, icon_arrow_down(540, 360, 70), ACC, 10, draw=0.25)
d.pill("تبيعها لغيرك", 29.60, 35.40, 540, 470, 60, SAND, INK)
d.strokes("a2", 31.30, 35.40, 540, 580, icon_arrow_down(540, 580, 70), ACC, 10, draw=0.25)
d.pill("تدير حسابات غيرك", 31.45, 35.40, 540, 690, 60, ACC, CREAM)
d.group = "S5_Coffee"
# 5) قهوتك (شارة فنجان) ← بطاقة طلباتك ← قائمة تتعلّم
d.circle(36.80, 41.26, 880, 300, 95, fill=CREAM)
d.strokes("cup", 36.85, 41.26, 880, 300, icon_cup(880, 300, 120), INK, 9, draw=0.5)
d.strokes("steam", 37.30, 41.26, 880, 300, steam(880, 300, 120), ACC, 7, draw=0.7)
paper_card(d, 38.70, 41.26, 470, 480, 600, 430, "طلباتك", [(39.40, "سكربت"), (39.95, "تصميم"), (40.50, "منشور جاهز")])
d.group = "S6_Checklist"
hearts(d, 44.45, 46.88)
for i, (t0, lb) in enumerate([(41.30, "مرتّب"), (42.60, "منشور"), (44.00, "الناس تفاعلت"), (45.40, "دفعت لك فلوس")]):
    y = 300 + i * 115
    d.circle(t0, 46.88, 820, y, 38, fill=ACC)
    d.strokes("chk", t0 + 0.08, 46.88, 820, y, icon_check(820, y, 48), CREAM, 9, draw=0.25)
    d.text(lb, t0, 46.88, 765, y + 22, 60, ACC if i == 3 else INK, BLACK if i == 3 else BOLD, align="r")
coin_rain(d, 46.10, 46.88, n=10, seed=3)
d.group = "S7_Learn"
# 6) كل شي يخص كلاود
d.image(LOGO, 52.30, 58.12, 540, 330, 220)
d.text("كل شي يخص كلاود", 53.10, 58.12, 540, 600, 96, ACC)
d.circle(54.80, 58.12, 850, 710, 34, fill=ACC)
d.strokes("chk2", 54.88, 58.12, 850, 710, icon_check(850, 710, 44), CREAM, 9, draw=0.25)
d.text("أنظمتك الخاصة بنفسك", 54.80, 58.12, 800, 732, 56, INK, BOLD, align="r")
d.group = "S8_Outro"
# 7) الختام
d.image(LOGO, 60.40, 62.70, 540, 290, 180)
d.text("احترف كلاود", 60.55, 62.70, 540, 560, 120, ACC)
d.pill("ابدأ معانا", 60.90, 62.70, 540, 700, 64, ACC, CREAM)
d.group = "Captions"
# الكابشن كله (فوق كل شي)
for s, e, m, ws in json.load(open("caps_v2.json")):
    caption(d, ws, s, e, 950 if m == "D" else 1330, card=(m == "F"), ink=INK, acc=ACC, cardc=CREAM)
import os
os.makedirs("gfx_v4", exist_ok=True)
files = d.save_groups("gfx_v4/")
import json as _j
_j.dump(files, open("gfx_v4/index.json", "w"), ensure_ascii=False, indent=1)
for g, p in files.items(): print(g, os.path.getsize(p))
