#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""📱 استوديو الجوال/الويب — خادم صغير يفتح مجلد الشغل على الشبكة المحلية، وتعدّل من أي متصفح وتشوف النتيجة حيّة.
   python3 studio/studio.py <work> [port]      ← يطبع الرابط
   الصفحة: /m · الحالة: GET /api/state · الحفظ: POST /api/save · الرسم: POST /api/render · التقدّم: GET /api/progress
   القص: POST /api/recut {keep} · حذف جمل: POST /api/drop {cards} · ورا الراس: POST /api/behind {cards}
   قصّ الشخص لمدى: POST /api/cutout {from,to} · بي-رول: POST /api/broll (الملف بالجسم + X-Name) · تعليقات: /api/comments · صفحة العميل: /share
   ما فيه محرّك جديد: نفس compose.html ونفس الراسم — الاستوديو يكتب studio.json وcaps.json وtheme.json وsfx.json بس."""
import http.server, json, os, sys, subprocess, threading, socket, time, shutil, re, urllib.parse

W = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8792
HERE = os.path.dirname(os.path.abspath(__file__))           # مجلد الاستوديو (ملفاته)
S = os.path.join(os.path.dirname(HERE), 'scripts')            # سكربتات السكل الأساسية — الاستوديو يستدعيها ولا يعدّلها
PY = sys.executable
JOB = {"running": False, "kind": "", "log": "", "done": None, "err": None, "started": 0, "reload": False}

def P(*a): return os.path.join(W, *a)
def rd(name, default=None):
    p = P(name)
    if not os.path.exists(p): return default
    with open(p, encoding='utf-8') as f: return json.load(f)
def wr(name, obj):
    p = P(name); tmp = p + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f: json.dump(obj, f, ensure_ascii=False, indent=1)
    os.replace(tmp, p)
def log(s): JOB["log"] += s if s.endswith('\n') else s + '\n'
def sh(cmd, check=True):
    log('$ ' + ' '.join(os.path.basename(c) if os.sep in str(c) else str(c) for c in cmd))
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=W)
    out = (r.stdout or '') + (r.stderr or '')
    if out.strip(): log(out.strip()[-600:])
    if check and r.returncode: raise RuntimeError(' '.join(cmd[:2]) + ' فشل: ' + out.strip()[-300:])
    return r

def default_scenes(total):
    try:
        src = open(P('compose.html'), encoding='utf-8').read()
        i = src.index('SCENES=['); j = src.index('];', i); out = []
        for m in re.finditer(r"\{s:([\d.]+),e:([\d.]+),m:(R_[A-Z]+)([^}]*)\}", src[i:j]):
            d = {"s": float(m.group(1)), "e": min(float(m.group(2)), total + 5), "m": m.group(3)}
            if 'nocap:true' in m.group(4): d["nocap"] = True
            out.append(d)
        if out: return out
    except Exception: pass
    return [{"s": 0, "e": total + 5, "m": "R_FULL"}]

def state():
    caps = rd('caps.json', {"cards": [], "total": 0}); theme = rd('theme.json', {}); cut = rd('cut.json', {})
    sfx = rd('sfx.json', {"outro": 3.5}); behind = rd('behind.json'); studio = rd('studio.json') or {}
    if not studio.get('scenes'): studio['scenes'] = default_scenes(caps.get('total', 0))
    for k, v in (('stickers', []), ('behindOff', []), ('brollClips', []), ('brNeed', {})): studio.setdefault(k, v)
    studio['sfx'] = {k: v for k, v in sfx.items() if k != 'outro'}
    nvf = len(os.listdir(P('vfr'))) if os.path.isdir(P('vfr')) else 0
    final = [f for f in ('ad-master.mp4', 'ad-final.mp4') if os.path.exists(P(f))]
    src_dur = 0
    try: src_dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', P('src.mov')], capture_output=True, text=True).stdout.strip() or 0)
    except Exception: pass
    return {"caps": caps, "theme": theme, "cut": cut, "srcDur": src_dur, "outro": sfx.get('outro', 3.5), "behind": behind, "studio": studio,
            "nvf": nvf, "final": final[0] if final else None, "hasPerson": os.path.isdir(P('bt', 'person')),
            "hasRaw": os.path.exists(P('cutz.mp4')), "comments": rd('comments.json', [])}

# ---------- تحويل الأزمنة عند تغيير القص (زمن الإخراج القديم → المصدر → الإخراج الجديد) ----------
def out2src(t, keep):
    acc = 0
    for a, b in keep:
        L = b - a
        if t <= acc + L + 1e-6: return a + max(0, t - acc)
        acc += L
    return keep[-1][1] if keep else t
def src2out(ts, keep):
    acc = 0
    for a, b in keep:
        if ts <= b + 1e-6: return acc + max(0, ts - a)
        acc += b - a
    return acc
def shift_studio(old_keep, new_keep):
    st = rd('studio.json') or {}
    conv = lambda t: round(src2out(out2src(t, old_keep), new_keep), 3)
    total = sum(b - a for a, b in new_keep)
    for sc in st.get('scenes', []): sc['s'], sc['e'] = conv(sc['s']), conv(sc['e'])
    st['scenes'] = [sc for sc in st.get('scenes', []) if sc['e'] - sc['s'] > 0.15]
    old_total = sum(b - a for a, b in old_keep)
    if st.get('scenes'):
        st['scenes'][0]['s'] = 0
        if st['scenes'][-1]['e'] >= old_total - 0.05: st['scenes'][-1]['e'] = total + 5   # آخر مشهد يمتد للنهاية بس لو كان ممتداً أصلاً
    for arr in ('stickers', 'brollClips'):
        st[arr] = [x for x in (st.get(arr) or []) if conv(x['e']) - conv(x['s']) > 0.2]
        for x in st[arr]: x['s'], x['e'] = conv(x['s']), conv(x['e'])
    st['behindOff'] = []
    wr('studio.json', st)
    sfx = rd('sfx.json', {"outro": 3.5})
    for k in list(sfx.keys()):
        if isinstance(sfx[k], list): sfx[k] = [conv(t) for t in sfx[k] if conv(t) < total]
    wr('sfx.json', sfx)

def reapply_words(old_caps):
    """بعد إعادة التوقيت: أرجع الكلمات الساخنة ومؤثراتها بمطابقة النص وترتيبه (أفضل جهد)."""
    caps = rd('caps.json')
    old = {}
    for c in old_caps.get('cards', []):
        for w in c['w']:
            if w.get('hot') or w.get('fx'): old.setdefault(w['t'], []).append({"hot": w.get('hot', False), "fx": w.get('fx')})
    for c in caps['cards']:
        for w in c['w']:
            if w['t'] in old and old[w['t']]:
                o = old[w['t']].pop(0); w['hot'] = o['hot']
                if o['fx']: w['fx'] = o['fx']
    wr('caps.json', caps)

def rebuild_after_cut(old_keep):
    log("✂️ أقصّ وأزوّم من جديد…"); sh([PY, os.path.join(S, '03_cut_zoom.py'), W])
    log("🖼️ أطلّع الفريمات…"); shutil.rmtree(P('vfr'), ignore_errors=True); os.makedirs(P('vfr'))
    sh(['ffmpeg', '-v', 'error', '-i', P('cutz.mp4'), '-vf', 'fps=30', '-q:v', '3', '-y', P('vfr', '%05d.jpg')])
    new_keep = rd('cut.json')['keep']; shift_studio(old_keep, new_keep)
    for f in ('behind.json', 'sfx.wav'):
        try: os.remove(P(f))
        except FileNotFoundError: pass
    shutil.rmtree(P('bt'), ignore_errors=True); shutil.rmtree(P('out'), ignore_errors=True)
    log("ℹ️ الكلام ورا الراس انلغى لأن الفريمات تغيّرت — أعده من الاستوديو لو تبيه.")

def job(kind, fn):
    if JOB["running"]: return False
    JOB.update(running=True, kind=kind, log="", done=None, err=None, started=time.time(), reload=False)
    def run():
        try: fn(); log("✅ خلص")
        except Exception as e: JOB["err"] = str(e)[:400]; log("❌ " + str(e)[:400])
        finally: JOB["running"] = False
    threading.Thread(target=run, daemon=True).start(); return True

def do_render(rng):
    if rng: cmd = ['node', os.path.join(S, '04_render_frames.js'), W, 'range', str(rng[0]), str(rng[1])]
    else:   cmd = ['node', os.path.join(S, '04_render_frames.js'), W, 'all', '--force']
    log('$ ' + os.path.basename(cmd[1]) + ' ' + ' '.join(cmd[3:]))
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    for line in p.stdout:
        log(line)
        if 'فريم مرسوم من' in line: time.sleep(1.5); p.kill(); break
    p.wait()
    sh([PY, os.path.join(S, '05_sfx.py'), W], check=False)
    for f in ('ad-final.mp4', 'ad-master.mp4'):
        try: os.remove(P(f))
        except FileNotFoundError: pass
    log("🎞️ تجميع…"); sh(['bash', os.path.join(S, '06_encode.sh'), W, P('ad-final.mp4')])
    log("🔊 معايرة الصوت…"); sh(['bash', os.path.join(S, '06b_master.sh'), W, P('ad-final.mp4'), P('ad-master.mp4')])
    if not os.path.exists(P('ad-master.mp4')): raise RuntimeError('ما طلع الملف النهائي')
    JOB["done"] = 'ad-master.mp4'

def do_recut(keep):
    old = rd('cut.json'); old_caps = rd('caps.json'); os.makedirs(P('.studio_bak'), exist_ok=True)
    for f in ('cut.json', 'caps.json', 'studio.json', 'sfx.json'):
        if os.path.exists(P(f)): shutil.copy(P(f), P('.studio_bak', f))
    keep = [[round(float(a), 3), round(float(b), 3)] for a, b in keep if float(b) - float(a) > 0.15]
    wr('cut.json', {**old, "keep": keep})
    log("📝 أعيد توقيت الكابشن…"); sh([PY, os.path.join(S, '02_captions.py'), W]); reapply_words(old_caps)
    rebuild_after_cut(old['keep']); JOB["reload"] = True

def do_drop(cards):
    old = rd('cut.json'); old_caps = rd('caps.json'); os.makedirs(P('.studio_bak'), exist_ok=True)
    for f in ('cut.json', 'caps.json', 'studio.json', 'sfx.json'):
        if os.path.exists(P(f)): shutil.copy(P(f), P('.studio_bak', f))
    sh([PY, os.path.join(S, '10_script_edit.py'), W, 'drop'] + [str(c) for c in cards])
    reapply_words(old_caps); rebuild_after_cut(old['keep']); JOB["reload"] = True

def do_behind(cards):
    sh(['node', os.path.join(S, '11_behind_text.js'), W, 'build'] + [str(c) for c in cards]); JOB["reload"] = True
def do_cutout(a, b):
    sh(['node', os.path.join(S, '11_behind_text.js'), W, 'cutout', '%.2f-%.2f' % (a, b)]); JOB["reload"] = True

def do_undo_cut():
    """يرجّع ملفات ما قبل آخر قص/حذف (.studio_bak) ويعيد البناء"""
    bk = P('.studio_bak')
    if not os.path.exists(os.path.join(bk, 'cut.json')): raise RuntimeError('ما فيه قص سابق أرجع له')
    old = rd('cut.json')
    for f in ('cut.json', 'caps.json', 'studio.json', 'sfx.json'):
        if os.path.exists(os.path.join(bk, f)): shutil.copy(os.path.join(bk, f), P(f))
    log("↶ رجّعت ملفات ما قبل القص…")
    sh([PY, os.path.join(S, '03_cut_zoom.py'), W]); shutil.rmtree(P('vfr'), ignore_errors=True); os.makedirs(P('vfr'))
    sh(['ffmpeg', '-v', 'error', '-i', P('cutz.mp4'), '-vf', 'fps=30', '-q:v', '3', '-y', P('vfr', '%05d.jpg')])
    shutil.rmtree(P('out'), ignore_errors=True); JOB["reload"] = True

def do_broll(name, data):
    key = re.sub(r'[^a-z0-9]+', '', name.lower().rsplit('.', 1)[0])[:12] or 'clip'
    key = key + str(int(time.time()) % 1000)
    os.makedirs(P('broll_src'), exist_ok=True); os.makedirs(P('broll'), exist_ok=True)
    src = P('broll_src', key + '.mov'); open(src, 'wb').write(data)
    pr = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=color_transfer', '-show_entries', 'format=duration', '-of', 'csv=p=0', src], capture_output=True, text=True).stdout
    hdr = ('arib-std-b67' in pr) or ('smpte2084' in pr)
    use = src
    if hdr and os.path.exists(os.path.join(S, 'hdr2sdr')):
        log("🎨 لقطة HDR — أحوّلها بمحوّل أبل…"); use = P('broll_src', key + '_sdr.mov'); sh([os.path.join(S, 'hdr2sdr'), src, use], check=False)
        if not os.path.exists(use): use = src
    sh(['ffmpeg', '-v', 'error', '-i', use, '-vf', 'fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920', '-q:v', '3', '-y', P('broll', key + '_%04d.jpg')])
    n = len([f for f in os.listdir(P('broll')) if f.startswith(key + '_')])
    st = rd('studio.json') or {}; st.setdefault('brNeed', {})[key] = [1, n]; wr('studio.json', st)
    JOB["done"] = json.dumps({"key": key, "frames": n}); JOB["reload"] = True

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=W, **k)
    def log_message(self, *a): pass
    def _json(self, code, obj):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code); self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def _html(self, name):
        b = open(os.path.join(HERE, name), 'rb').read()
        self.send_response(200); self.send_header('Content-Type', 'text/html; charset=utf-8'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def end_headers(self): self.send_header('Cache-Control', 'no-store'); self.send_header('Accept-Ranges', 'bytes'); super().end_headers()
    def do_GET(self):
        p = self.path.split('?')[0]
        if p in ('/', '/m', '/m/'): return self._html('studio-mobile.html')
        if p == '/share': return self._html('studio-share.html')
        if p.startswith('/sfx_prev/'):
            f = os.path.join(HERE, 'sfx_prev', os.path.basename(p))
            if os.path.exists(f):
                b = open(f, 'rb').read(); self.send_response(200); self.send_header('Content-Type', 'audio/wav'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b); return
        if p.startswith('/api/state'): return self._json(200, state())
        if p.startswith('/api/comments'): return self._json(200, rd('comments.json', []))
        if p.startswith('/api/progress'):
            return self._json(200, {"running": JOB["running"], "kind": JOB["kind"], "log": JOB["log"][-1800:], "done": JOB["done"], "err": JOB["err"], "reload": JOB["reload"], "elapsed": round(time.time() - JOB["started"]) if JOB["started"] else 0})
        return self._ranged() if self._wants_range() else super().do_GET()
    def _wants_range(self): return bool(self.headers.get('Range'))
    def _ranged(self):
        """طلبات Range (206) — بدونها المتصفح ما يقدر يقفز داخل cutz.mp4 ويشغّل دايماً من البداية (سبب مشكلة المؤشر)."""
        path = self.translate_path(self.path.split('?')[0])
        if not os.path.isfile(path): return self.send_error(404)
        size = os.path.getsize(path); m = re.match(r'bytes=(\d*)-(\d*)', self.headers.get('Range', ''))
        a = int(m.group(1)) if m and m.group(1) else 0; b = int(m.group(2)) if m and m.group(2) else size - 1; b = min(b, size - 1)
        if a > b: return self.send_error(416)
        self.send_response(206); self.send_header('Content-Type', self.guess_type(path)); self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Range', f'bytes {a}-{b}/{size}'); self.send_header('Content-Length', str(b - a + 1)); self.end_headers()
        with open(path, 'rb') as f:
            f.seek(a); left = b - a + 1
            while left > 0:
                chunk = f.read(min(1 << 20, left))
                if not chunk: break
                try: self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError): break
                left -= len(chunk)
    def do_POST(self):
        p = self.path.split('?')[0]; n = int(self.headers.get('Content-Length') or 0); raw = self.rfile.read(n)
        if p.startswith('/api/broll'):
            name = urllib.parse.unquote(self.headers.get('X-Name') or 'clip.mov')
            ok = job('broll', lambda: do_broll(name, raw)); return self._json(200 if ok else 409, {"ok": ok})
        data = json.loads(raw or b'{}')
        if p.startswith('/api/save'):
            if data.get('caps'): wr('caps.json', data['caps'])
            if data.get('theme'): wr('theme.json', data['theme'])
            if data.get('studio') is not None:
                st = data['studio']; sfx = st.pop('sfx', None); wr('studio.json', st)
                if sfx is not None: cur = rd('sfx.json', {"outro": 3.5}); wr('sfx.json', {"outro": cur.get('outro', 3.5), **{k: v for k, v in sfx.items() if v}})
            return self._json(200, {"ok": True})
        if p.startswith('/api/comment'):
            cs = rd('comments.json', []); cs.append({"t": data.get('t'), "who": (data.get('who') or 'عميل')[:40], "text": (data.get('text') or '')[:500], "at": time.strftime('%Y-%m-%d %H:%M')}); wr('comments.json', cs); return self._json(200, {"ok": True})
        if p.startswith('/api/render'):  ok = job('render', lambda: do_render(data.get('range')))
        elif p.startswith('/api/recut'): ok = job('recut', lambda: do_recut(data['keep']))
        elif p.startswith('/api/drop'):  ok = job('drop', lambda: do_drop(data['cards']))
        elif p.startswith('/api/behind'): ok = job('behind', lambda: do_behind(data['cards']))
        elif p.startswith('/api/cutout'): ok = job('cutout', lambda: do_cutout(float(data['from']), float(data['to'])))
        elif p.startswith('/api/undo_cut'): ok = job('undo_cut', do_undo_cut)
        else: return self._json(404, {"ok": False})
        return self._json(200 if ok else 409, {"ok": ok, "msg": "" if ok else "فيه عملية شغالة"})

def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(('8.8.8.8', 80)); ip = s.getsockname()[0]; s.close(); return ip
    except Exception: return '127.0.0.1'

if __name__ == '__main__':
    if not os.path.exists(P('compose.html')): sys.exit('❌ ما فيه compose.html بمجلد الشغل')
    srv = http.server.ThreadingHTTPServer(('0.0.0.0', PORT), H)
    print(f"📱 الاستوديو شغّال — بالجوال (نفس الواي فاي): http://{lan_ip()}:{PORT}/m   · بالجهاز: http://127.0.0.1:{PORT}/m   · للعميل: /share")
    try: srv.serve_forever()
    except KeyboardInterrupt: pass
