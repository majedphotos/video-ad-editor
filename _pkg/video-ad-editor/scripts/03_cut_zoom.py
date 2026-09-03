# -*- coding: utf-8 -*-
"""قص السكتات + زوم مختلف لكل مقطع + تدرّج دافئ.  python3 03_cut_zoom.py <workdir>"""
import json, subprocess, sys, os
W=os.path.abspath(sys.argv[1]); SRC=os.path.join(W,"src.mov")
k=json.load(open(os.path.join(W,"cut.json")))["keep"]
_tp=os.path.join(W,"theme.json")
_th=json.load(open(_tp)) if os.path.exists(_tp) else {}
GRADE=_th.get("grade",False)
# 🆕 v2.5 إيقاع «هادي» (theme.json ← "pace":"calm"): زوم أخف وأقل، وما يتغيّر قبل ما تمر 4 ثوانٍ
#    على نفس اللقطة — القطعات الكثيرة كانت تزعج (بلاغ المستخدم ٣ سبتمبر). الافتراضي زي ما هو.
CALM=str(_th.get("pace","")).lower()=="calm"
Z=([1.00,1.00,1.04,1.00,1.00,1.06,1.00,1.03] if CALM
   else [1.00,1.08,1.00,1.06,1.00,1.12,1.04,1.14,1.00,1.08,1.00,1.05,1.10,1.00]); ANCH=0.30
MINHOLD=4.0 if CALM else 0.0
print("الإيقاع:", "هادي (زوم أخف · لا تغيير قبل 4 ثوانٍ)" if CALM else "عادي")
p=subprocess.run(["ffprobe","-v","error","-select_streams","v:0","-show_entries",
   "stream=width,height","-of","csv=p=0:s=x",SRC],capture_output=True,text=True).stdout.strip()
SW,SH=[int(x) for x in p.split("x")[:2]]
fc=[];v=[];a=[]
zi=0; held=0.0
for i,(s,e) in enumerate(k):
    # بالوضع الهادي: نفس الزوم يستمر لين تتجمّع 4 ثوانٍ، ثم ينتقل للي بعده
    if i and (not CALM or held>=MINHOLD): zi+=1; held=0.0
    held+=(e-s)
    z=Z[zi%len(Z)]; cw=int(SW/z)//2*2; ch=int(SH/z)//2*2
    x=(SW-cw)//2; y=int((SH-ch)*ANCH)
    fc.append(f"[0:v]trim=start={s:.4f}:end={e:.4f},setpts=PTS-STARTPTS,crop={cw}:{ch}:{x}:{y},"
              f"scale=1080:1920:flags=lanczos,setsar=1[v{i}]")
    fc.append(f"[0:a]atrim=start={s:.4f}:end={e:.4f},asetpts=PTS-STARTPTS[a{i}]")
    v.append(f"[v{i}]"); a.append(f"[a{i}]")
fc.append("".join(v)+f"concat=n={len(k)}:v=1:a=0[vc]")
fc.append("".join(a)+f"concat=n={len(k)}:v=0:a=1[ac]")
# التدرّج اللوني اختياري تماماً — الافتراضي مطفي (الفيديو يطلع بألوانه الأصلية)
_g = ("eq=brightness=0.015:saturation=0.96:contrast=1.05,"
      "colorbalance=rs=0.02:gs=0.005:bs=-0.02,") if GRADE else ""
# ⚠️ مصدر آيفون HDR يجي موسوماً bt2020/HLG — أي متصفح يحترم الوسم ويطلّع صورة برتقالية.
# setparams يعيد الوسم لـbt709 فتطلع الألوان طبيعية بكل مكان.
fc.append("[vc]fps=30," + _g +
          "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,format=yuv420p[vo]")
print("التدرّج اللوني:", "مفعّل" if GRADE else "مطفي (ألوان أصلية)")
fc.append("[ac]afade=t=in:st=0:d=0.06,dynaudnorm=f=200:g=5:p=0.9[ao]")
sys.exit(subprocess.call(["ffmpeg","-v","error","-stats","-i",SRC,"-filter_complex",";".join(fc),
 "-map","[vo]","-map","[ao]","-c:v","libx264","-preset","medium","-crf","16",
 "-c:a","aac","-b:a","192k","-movflags","+faststart","-y",os.path.join(W,"cutz.mp4")]))
