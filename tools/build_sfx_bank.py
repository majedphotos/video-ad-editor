# -*- coding: utf-8 -*-
"""يبني بنك المؤثرات (video-ad-editor/sfx/bank.npz) من حزم CC0 — أداة مطوّر، مو جزء من البلقن.
   python3 tools/build_sfx_bank.py <مجلد الحزم المفكوكة> 
   الحزم (كلها CC0 — ملكية عامة، بلا شرط نسب):
     a = https://opengameart.org/content/100-cc0-sfx          (100-CC0-SFX_0.zip)
     b = https://opengameart.org/content/100-cc0-sfx-2        (sfx_100_v2.zip)
     c = https://opengameart.org/content/swishes-sound-pack   (swishes.zip)"""
import sys, os, json, subprocess, numpy as np
SR = 48000
PICK = {   # النوع ← الملفات (اخترتها بالمدة والحدّة: tick قصير وحاد، hit مكتوم، impact أثقل)
 "tick":   ["a/switch_01.ogg", "a/switch_02.ogg", "b/sfx100v2_switch_01.ogg", "b/sfx100v2_switch_02.ogg", "b/sfx100v2_misc_30.ogg", "b/sfx100v2_misc_31.ogg", "b/sfx100v2_wood_04.ogg"],
 "hit":    ["a/hit_03.ogg", "a/hit_04.ogg", "b/sfx100v2_wood_hit_01.ogg", "b/sfx100v2_wood_hit_02.ogg", "b/sfx100v2_footstep_wood_01.ogg", "a/wooden_01.ogg"],
 "impact": ["a/door_close_03.ogg", "a/door_close_04.ogg", "a/slam_03.ogg", "a/metal_10.ogg", "a/pot_01.ogg"],
 "air":    ["b/sfx100v2_air_03.ogg", "b/sfx100v2_air_02.ogg", "a/noise_01.ogg"],
 "swish":  [f"c/swishes/swish-{i}.wav" for i in range(1, 14)],
 "paper":  ["a/paper_01.ogg", "a/paper_02.ogg", "a/paper_03.ogg", "a/paper_04.ogg"],
 "pop":    ["a/plop_01.ogg", "a/plop_02.ogg"],
 "ding":   ["a/bell_02.ogg", "a/glass_01.ogg", "a/glass_03.ogg"],
 "clink":  ["a/metal_02.ogg", "a/metal_11.ogg", "b/sfx100v2_metal_06.ogg"],
}
SRC = {"a": "https://opengameart.org/content/100-cc0-sfx", "b": "https://opengameart.org/content/100-cc0-sfx-2",
       "c": "https://opengameart.org/content/swishes-sound-pack"}
MAXLEN = {"air": 0.8, "paper": 0.6}

def load(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)

def trim(y, maxlen):
    a = np.abs(y); pk = a.max() + 1e-12
    on = np.where(a > pk * 0.02)[0]; i0 = max(0, on[0] - int(0.003 * SR))
    env = np.convolve(a, np.ones(480) / 480, mode="same"); off = np.where(env > pk * 0.004)[0]
    i1 = min(len(y), off[-1] + int(0.01 * SR), i0 + int(maxlen * SR))
    z = y[i0:i1].copy(); f = min(len(z), int(0.012 * SR)); z[-f:] *= np.linspace(1, 0, f)
    return z / (np.abs(z).max() + 1e-12) * 0.95

root = os.path.abspath(sys.argv[1]); out = os.path.join(os.path.dirname(__file__), "..", "video-ad-editor", "sfx")
os.makedirs(out, exist_ok=True)
arrs, index = {}, {}
for k, files in PICK.items():
    index[k] = []
    for j, f in enumerate(files):
        z = trim(load(os.path.join(root, f)), MAXLEN.get(k, 0.9))
        name = f"{k}_{j+1}"; arrs[name] = (z * 32767).astype(np.int16)
        index[k].append({"n": name, "src": SRC[f[0]], "file": os.path.basename(f), "dur": round(len(z) / SR, 3)})
arrs["_index"] = np.frombuffer(json.dumps(index, ensure_ascii=False).encode("utf-8"), dtype=np.uint8)
np.savez_compressed(os.path.join(out, "bank.npz"), **arrs)
tot = sum(len(v) for n, v in arrs.items() if n != "_index") / SR
print("بنك:", sum(len(v) for v in index.values()), "صوت ·", round(tot, 1), "ث ·",
      round(os.path.getsize(os.path.join(out, "bank.npz")) / 1e6, 2), "ميقا")
for k, v in index.items(): print(f"  {k:7s} {len(v)}")
