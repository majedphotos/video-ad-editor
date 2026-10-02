# -*- coding: utf-8 -*-
"""فحص قبل التصدير: لقطة من **نص كل مشهد** (مو 6 لقطات عشوائية) — يكشف الغلط قبل ما يشوفه المستخدم
   python3 32_midframes.py <work> [--video ad-final.mp4]
   - المشاهد من studio.json ← scenes (وإلا من بطاقات الكابشن caps.json — لقطة لكل جملة).
   - بلا --video: يرسم اللقطات بالمحرّك نفسه (04_render_frames.js preview) — ما يحتاج الرسم الكامل.
   - يطلع أوراق mid_1.jpg، mid_2.jpg… (6 لقطات بكل ورقة، عليها التوقيت) — اقرأها كلها وافحص بكل لقطة:
     نص مقصوص · عناصر فوق بعض · رقم أو اسم مو من facts.md · حواف القص (هالة حول الشخص) · ترتيب «ورا الشخص».
   - صلّح، ثم أعد التشغيل على المشاهد اللي تعدّلت بس، وبعدها صدّر."""
import sys, os, json, subprocess
SC = os.path.dirname(os.path.abspath(__file__))
if len(sys.argv) < 2: print(__doc__); sys.exit(1)
W = os.path.abspath(sys.argv[1]); vid = sys.argv[sys.argv.index('--video') + 1] if '--video' in sys.argv else ''
def jl(n, d):
    p = os.path.join(W, n)
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else d
caps = jl('caps.json', {}); total = caps.get('total') or 0
scenes = (jl('studio.json', {}) or {}).get('scenes') or []
segs = [(float(s['s']), float(min(s['e'], total or s['e']))) for s in scenes if s.get('e', 0) > s.get('s', 0)] if scenes else \
       [(float(c['s']), float(c['e'])) for c in caps.get('cards', [])]
times = sorted({round((a + b) / 2, 2) for a, b in segs if b - a > 0.2})
if not times: sys.exit('❌ ما لقيت مشاهد ولا كابشن — شغّل الخطوات 5-7 أول')
print(f'{len(times)} مشهد → {(len(times) + 5) // 6} ورقة')
env = dict(os.environ)
if vid: env['SRC'] = vid if os.path.isabs(vid) else os.path.join(W, vid)
else:
    subprocess.run(['node', os.path.join(SC, '04_render_frames.js'), W, 'preview'] + [str(t) for t in times], check=True)
for i in range(0, len(times), 6):
    out = os.path.join(W, f'mid_{i // 6 + 1}.jpg')
    subprocess.run(['bash', os.path.join(SC, '07_contact_sheet.sh'), W, out] + [str(t) for t in times[i:i + 6]], check=True, env=env)
    print('→', out)
