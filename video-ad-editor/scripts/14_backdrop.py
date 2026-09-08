#!/usr/bin/env python3
"""خلفية باهتة — «كأنه وضع سينماتيك»: المتحدث واضح والخلفية ورا لون كريمي (لون الثيم).
   python3 14_backdrop.py <work> [قوة 0..1 = 0.62]

   يبني <work>/cover/NNNNN.png لكل فريم من vfr/: صورة تغطية بلون الخلفية وألفا = (1 − قناع الشخص) × القوة،
   بنصف الدقة (حواف أنعم وحجم أصغر). المحرّك يرسمها فوق الفيديو بنفس قصّه — بكل الأوضاع، فالانتقالات سلسة.
   القناع من personmask.swift (Vision المدمج بماك) أو من مجلد cmask/ إن كان موجوداً.
   للإلغاء: امسح مجلد cover/ وأعد الرسم."""
import sys, os, json, subprocess, shutil
import numpy as np
from PIL import Image, ImageFilter

W = os.path.abspath(sys.argv[1]) + '/'
K = float(sys.argv[2]) if len(sys.argv) > 2 else 0.62
th = json.load(open(W + 'theme.json')) if os.path.exists(W + 'theme.json') else {}
bg = th.get('bg', '#F0EEE6').lstrip('#')
rgb = tuple(int(bg[i:i + 2], 16) for i in (0, 2, 4))
frames = sorted(f for f in os.listdir(W + 'vfr') if f.endswith('.jpg'))
os.makedirs(W + 'cover', exist_ok=True)

def ensure_masks():
    """قناع الشخص لكل فريم: cmask/ (من محرّك الكولاج) أو bt/mask/ — وإلا نبنيها كلها مرة وحدة بالبرنامج المترجَم (Vision)."""
    if os.path.isdir(W + 'cmask') and len(os.listdir(W + 'cmask')) >= len(frames) - 5:
        return 'cmask'
    mdir = W + 'bt/mask/'
    if os.path.isdir(mdir) and len([f for f in os.listdir(mdir) if f.endswith('.png')]) >= len(frames) - 5:
        return 'bt'
    sw = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'personmask.swift')
    binp = W + 'bt/personmask'
    os.makedirs(W + 'bt', exist_ok=True); os.makedirs(mdir, exist_ok=True)
    if not os.path.exists(binp):
        r = subprocess.run(['swiftc', '-O', '-o', binp, sw], capture_output=True)
        if r.returncode != 0:
            print('❌ تحتاج أدوات Xcode: xcode-select --install'); sys.exit(4)
    print('أقصّ الشخص من', len(frames), 'فريم بـVision — دقايق…')
    r = subprocess.run([binp, W + 'vfr', mdir, 'accurate', '2.5'])
    if r.returncode != 0:
        print('❌ فشل بناء الأقنعة'); sys.exit(5)
    return 'bt'

def mask_of(idx, name, src):
    p = (W + 'cmask/f_%04d.png' % idx) if src == 'cmask' else (W + 'bt/mask/%05d.png' % idx)
    return Image.open(p).convert('L') if os.path.exists(p) else None

MSRC = ensure_masks()
n = 0
for i, f in enumerate(frames, 1):
    dst = W + 'cover/%05d.png' % i
    if os.path.exists(dst):
        n += 1; continue
    mk = mask_of(i, f, MSRC)
    if mk is None:
        print('⚠️ ما لقيت قناعاً للفريم', i); continue
    mk = mk.resize((540, 960), Image.BILINEAR).filter(ImageFilter.GaussianBlur(1.2))
    a = (255 - np.asarray(mk, dtype=np.float32)) * K
    im = Image.new('RGBA', (540, 960), rgb + (0,))
    im.putalpha(Image.fromarray(a.astype(np.uint8)))
    im.save(dst, compress_level=3); n += 1
    if n % 300 == 0: print('غطاء', n, '/', len(frames))
print('✅ خلفية باهتة جاهزة:', n, 'فريم — أعد الرسم: node 04_render_frames.js <work> all --force')
