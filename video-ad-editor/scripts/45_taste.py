# -*- coding: utf-8 -*-
"""ملف الذوق (6.5) — أي ملاحظة من المستخدم تنجح (عدّلتها وبعدها اعتمد) تصير قاعدة دايمة يقراها السكل أول كل شغل.
   الملف برّا البلقن (~/.video-ad-editor/taste.md) فالتحديث ما يمسحه، ويكبر مع كل فيديو.

   python3 45_taste.py show                                   ← اقرأه أول كل شغل (SKILL.md الخطوة 0)
   python3 45_taste.py add "<القاعدة>" --why "<ليش/وين صارت>" [--tag كابشن|موشن|صوت|قص|ألوان|عام] [--t 12.4]
   python3 45_taste.py drop <رقم>                             ← قاعدة طلع إنها غلط أو تغيّر رايه
   python3 45_taste.py path                                   ← وين الملف

   ⛔ اكتب القاعدة عامة تنفع الفيديو الجاي («المربع على الكتابة نفسها، مو بالعين»)، مو وصف تعديل واحد («حرّك المربع 20px»).
   ⛔ بس الملاحظة اللي نجحت: نفّذتها ← اعتمد أو قال «زين/تمام». الملاحظة اللي ما انحلت ما تصير قاعدة.
   ⛔ ما تتعارض مع قاعدة أقدم بدون ما تشيلها (drop) — الأحدث يغلب، وقله إنك شلت القديمة."""
import os, sys, re, datetime, difflib

P = os.environ.get("TASTE_FILE") or os.path.join(os.path.expanduser("~"), ".video-ad-editor", "taste.md")
HEAD = ("# ملف الذوق — قواعد المونتاج اللي تعلّمناها منك\n"
        "<!-- يكتبه scripts/45_taste.py — كل قاعدة من ملاحظة نجحت. السكل يقراه أول كل شغل ويطبّقه قبل قواعده العامة. -->\n\n")
RX = re.compile(r"^(\d+)\. \[(.+?)\] (.+?)(?:\n   ↳ (.+))?$", re.M)

def load():
    if not os.path.exists(P): return []
    s = open(P, encoding="utf-8").read()
    return [dict(n=int(m.group(1)), tag=m.group(2), rule=m.group(3).strip(), why=(m.group(4) or "").strip()) for m in RX.finditer(s)]

def save(R):
    os.makedirs(os.path.dirname(P), exist_ok=True)
    body = "".join(f"{r['n']}. [{r['tag']}] {r['rule']}\n" + (f"   ↳ {r['why']}\n" if r['why'] else "") for r in R)
    open(P, "w", encoding="utf-8").write(HEAD + body)

def arg(k, d=None):
    return sys.argv[sys.argv.index(k) + 1] if k in sys.argv and sys.argv.index(k) + 1 < len(sys.argv) else d

cmd = sys.argv[1] if len(sys.argv) > 1 else "show"
R = load()
if cmd == "path": print(P)
elif cmd == "show":
    if not R: print("ملف الذوق فاضي لسا — أول ملاحظة تنجح تنحفظ هني (45_taste.py add)"); sys.exit(0)
    print(f"🎯 ملف الذوق ({len(R)} قاعدة) — طبّقها قبل القواعد العامة:")
    for r in R: print(f"  {r['n']}. [{r['tag']}] {r['rule']}" + (f"  ← {r['why']}" if r['why'] else ""))
elif cmd == "add":
    if len(sys.argv) < 3 or sys.argv[2].startswith("--"): print(__doc__); sys.exit(1)
    rule = sys.argv[2].strip(); tag = arg("--tag", "عام"); why = arg("--why", "")
    t = arg("--t")
    if t: why = (why + f" (عند {float(t):.1f} ث)").strip()
    why = (why + " · " if why else "") + datetime.date.today().isoformat()
    near = [r for r in R if difflib.SequenceMatcher(None, r["rule"], rule).ratio() > 0.72]
    if near:
        print("⚠️ قريبة من قاعدة موجودة — ما أضفتها (عدّل القديمة بـdrop ثم add لو تبي تبدّلها):")
        for r in near: print(f"   {r['n']}. {r['rule']}")
        sys.exit(3)
    R.append(dict(n=(max([r["n"] for r in R]) + 1) if R else 1, tag=tag, rule=rule, why=why)); save(R)
    print(f"✅ قاعدة {R[-1]['n']} انحفظت بملف الذوق ({len(R)} قاعدة) — {P}")
elif cmd == "drop":
    n = int(sys.argv[2]); R2 = [r for r in R if r["n"] != n]
    if len(R2) == len(R): print("ما فيه قاعدة بهالرقم"); sys.exit(2)
    save(R2); print(f"🗑️ شلت القاعدة {n} — الباقي {len(R2)}")
else: print(__doc__); sys.exit(1)
