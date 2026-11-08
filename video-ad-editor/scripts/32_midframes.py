# -*- coding: utf-8 -*-
"""فحص قبل التصدير: لقطة من **نص كل مشهد** (مو 6 لقطات عشوائية) — يكشف الغلط قبل ما يشوفه المستخدم
   python3 32_midframes.py <work> [--video ad-final.mp4]
   python3 32_midframes.py <work> --story [--lines 3 7]   ← 🆕 6.5 ستوري بورد: لقطة لكل سطر يعتمدها قبل الرسم الكامل (STORY_DOC تحت)
   - المشاهد من studio.json ← scenes (وإلا من بطاقات الكابشن caps.json — لقطة لكل جملة).
   - بلا --video: يرسم اللقطات بالمحرّك نفسه (04_render_frames.js preview) — ما يحتاج الرسم الكامل.
   - يطلع أوراق mid_1.jpg، mid_2.jpg… (6 لقطات بكل ورقة، عليها التوقيت) — اقرأها كلها وافحص بكل لقطة:
     نص مقصوص · عناصر فوق بعض · رقم أو اسم مو من facts.md · حواف القص (هالة حول الشخص) · ترتيب «ورا الشخص».
   - صلّح، ثم أعد التشغيل على المشاهد اللي تعدّلت بس، وبعدها صدّر."""
import sys, os, json, subprocess
SC = os.path.dirname(os.path.abspath(__file__))
if len(sys.argv) < 2: print(__doc__); sys.exit(1)
W = os.path.abspath(sys.argv[1]); vid = sys.argv[sys.argv.index('--video') + 1] if '--video' in sys.argv else ''

STORY_DOC = """🆕 6.5 ستوري بورد قبل الرسم الكامل — python3 32_midframes.py <work> --story [--lines 3 7 | --at 12.6 17.9]
"""
if "--story" in sys.argv:
    import html

    caps = json.load(open(os.path.join(W, "caps.json"), encoding="utf-8"))
    cards = caps.get("cards", [])
    def args(flag):
        if flag not in sys.argv: return None
        out = []
        for a in sys.argv[sys.argv.index(flag) + 1:]:
            if a.startswith("--"): break
            out.append(a)
        return out
    sel = args("--lines"); at = args("--at")
    items = []
    if at:
        for k, t in enumerate(at): items.append((k + 1, float(t), ""))
    else:
        for i, c in enumerate(cards):
            if sel and str(i + 1) not in sel: continue
            ws = c.get("w", [])
            if not ws: continue
            t = min(c["e"] - 0.30, ws[-1]["s"] + 0.25)     # آخر كلمة طلعت توها = السطر كامل وقبل ما يبدأ يختفي
            items.append((i + 1, round(max(c["s"] + 0.05, t), 2), " ".join(w["t"] for w in ws)))
    if not items: sys.exit("❌ ما فيه أسطر — شغّل 02_captions.py أول")
    times = [f"{t:.2f}" for _, t, _ in items]
    print(f"ستوري بورد: {len(items)} سطر — أرسم لقطة لكل واحد…")
    subprocess.run(["node", os.path.join(SC, "04_render_frames.js"), W, "preview"] + times, check=True, stdout=subprocess.DEVNULL)

    out = os.path.join(W, "storyboard"); os.makedirs(out, exist_ok=True)
    theme = {}
    try: theme = json.load(open(os.path.join(W, "theme.json"), encoding="utf-8"))
    except Exception: pass
    acc = theme.get("acc", "#D97757")
    fmt = lambda t: f"{int(t // 60)}:{t % 60:04.1f}"
    tiles = []
    for n, t, txt in items:
        img = os.path.relpath(os.path.join(W, "prev", f"t{t:.2f}.jpg"), out)
        tiles.append(f'<figure data-n="{n}" data-t="{t}"><img src="{html.escape(img)}" alt="سطر {n}"><figcaption><b>{n}</b><span class="tm">{fmt(t)}</span>'
                     f'<span class="tx">{html.escape(txt)}</span><label><input type="checkbox" class="ok"> تمام</label>'
                     f'<textarea placeholder="ملاحظة على هالسطر (اختياري)"></textarea></figcaption></figure>')
    page = f"""<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>ستوري بورد</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@500;700&display=swap">
    <style>:root{{--acc:{acc}}} body{{margin:0;background:#111214;color:#F2F2F2;font-family:"IBM Plex Sans Arabic",system-ui,sans-serif}}
    .wrap{{max-width:1180px;margin:0 auto;padding:20px 16px 40px}} h1{{font-size:22px;margin:0 0 4px}} p{{margin:0 0 16px;color:#A7ABB2;font-size:14px}}
    .grid{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}} @media(max-width:720px){{.grid{{grid-template-columns:repeat(2,minmax(0,1fr))}}}}
    figure{{margin:0;background:#1B1D21;border-radius:14px;overflow:hidden;border:1px solid #2A2D33}} img{{display:block;width:100%;height:auto;aspect-ratio:9/16;object-fit:cover}}
    figcaption{{display:grid;grid-template-columns:auto auto 1fr;gap:4px 8px;align-items:center;padding:10px 12px;font-size:14px}}
    figcaption b{{background:var(--acc);color:#111;border-radius:99px;padding:0 9px;font-size:13px}} .tm{{color:#A7ABB2;font-variant-numeric:tabular-nums;font-size:12.5px}}
    .tx{{grid-column:1/-1;line-height:1.6}} label{{grid-column:1/-1;font-size:13px;color:#C9CCD1}} textarea{{grid-column:1/-1;background:#121316;color:#F2F2F2;border:1px solid #2A2D33;border-radius:8px;padding:6px 8px;font:inherit;font-size:13px;min-height:44px}}
    .shot textarea,.shot label{{display:none}} button{{font:inherit;font-weight:700;padding:8px 18px;border-radius:99px;border:0;background:var(--acc);color:#111;cursor:pointer;margin:16px 0 0}}</style></head>
    <body><div class="wrap"><h1>ستوري بورد — لقطة لكل سطر</h1><p>علّم «تمام» أو اكتب ملاحظة على السطر، واضغط «انسخ ملاحظاتي» وألصقها بالمحادثة.</p>
    <div class="grid">{''.join(tiles)}</div><button id="cp" type="button">انسخ ملاحظاتي</button><span id="fl"></span></div>
    <script>document.getElementById('cp').onclick=()=>{{const L=[...document.querySelectorAll('figure')].map(f=>({{سطر:+f.dataset.n,وقت:+f.dataset.t,تمام:f.querySelector('.ok').checked,ملاحظة:f.querySelector('textarea').value.trim()}})).filter(x=>x.تمام||x.ملاحظة);
    const s='ستوري بورد:\\n'+L.map(x=>x.سطر+' ('+x.وقت+'ث): '+(x.ملاحظة||'تمام')).join('\\n');try{{navigator.clipboard.writeText(s).then(()=>document.getElementById('fl').textContent=' انسخت ✓',()=>prompt('انسخ:',s));}}catch(_){{prompt('انسخ:',s);}}}};</script></body></html>"""
    open(os.path.join(out, "index.html"), "w", encoding="utf-8").write(page)

    # أوراق للمحادثة: نفس الصفحة بوضع اللقطة (بلا خانات)، 9 أسطر بالورقة
    JS = r"""
    const path=require('path'),fs=require('fs');let pp;for(const p of [process.env.PUPPETEER_PATH,'puppeteer-core','puppeteer']){if(!p)continue;try{pp=require(p);break;}catch(e){}}
    const C=process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    (async()=>{const [page,outp,n]=process.argv.slice(1);const b=await pp.launch({executablePath:C,headless:'new',args:['--allow-file-access-from-files']});
    const p=await b.newPage();await p.setViewport({width:1180,height:900,deviceScaleFactor:1});await p.goto('file://'+page,{waitUntil:'networkidle0'});
    await p.evaluate(()=>{document.body.classList.add('shot');document.querySelector('p').remove();document.getElementById('cp').remove();});
    const figs=await p.$$('figure');const per=9,k=Math.ceil(figs.length/per);
    for(let i=0;i<k;i++){await p.evaluate((a,b)=>{document.querySelectorAll('figure').forEach((f,j)=>f.style.display=(j>=a&&j<b)?'':'none');},i*per,(i+1)*per);
     const el=await p.$('.wrap');await el.screenshot({path:outp.replace('%d',i+1),type:'jpeg',quality:82});}
    console.log(k);await b.close();})();"""
    r = subprocess.run(["node", "-e", JS, os.path.join(out, "index.html"), os.path.join(W, "storyboard_%d.jpg")], cwd=SC, capture_output=True, text=True)
    if r.returncode != 0: print("⚠️ الأوراق ما انرسمت:", r.stderr.strip()[-300:]); sys.exit(4)
    k = int((r.stdout or "1").strip().splitlines()[-1])
    print(f"✅ {out}/index.html + {k} ورقة: " + " ".join(f"storyboard_{i+1}.jpg" for i in range(k)))

    sys.exit(0)
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
