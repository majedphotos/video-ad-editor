"""مؤثرات صوتية مولّدة بالكود لوضع دافنشي — ملف WAV بطول الفيديو يتحط على مسار صوت ثاني.
الأنواع: whoosh_up · whoosh_down · thud · tap (نفس سكل الفيديو) + coin (رنّة عملة) + pop (فقعة خفيفة).
التشغيل: python3 davinci_sfx.py events.json out.wav <المدة بالثواني>
events.json = {"whoosh_up":[..], "thud":[..], "tap":[..], "coin":[..], "pop":[..]}
⛔ قاعدة السكل: 15 حدثاً بالدقيقة بالكثير، بلحظة لها معنى — مو على كل كلمة.
"""
import sys, json, wave
import numpy as np

EV, OUT, DUR = json.load(open(sys.argv[1])), sys.argv[2], float(sys.argv[3])
SR = 48000
n = int(DUR * SR) + SR
buf = np.zeros(n)
rng = np.random.RandomState(11)


def add(sig, t0, g=1.0):
    i = max(0, int(t0 * SR)); j = min(n, i + len(sig)); buf[i:j] += sig[:j - i] * g


def lp(x, a0, a1):
    y = np.empty_like(x); z = 0.0
    for i in range(len(x)):
        a = a0 + (a1 - a0) * (i / len(x)); z += a * (x[i] - z); y[i] = z
    return y


def norm(s):
    return s / (np.max(np.abs(s)) + 1e-9)


def whoosh(dur=0.34, up=True):
    L = int(dur * SR); t = np.arange(L) / SR
    y = lp(rng.randn(L), 0.03, 0.30) if up else lp(rng.randn(L), 0.30, 0.03)
    return norm(y) * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.6


def thud(f0=135, f1=58, dur=0.30):
    L = int(dur * SR); t = np.arange(L) / SR
    f = f0 * np.exp(np.log(f1 / f0) * t / dur)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.085)
    s += lp(rng.randn(L), 0.35, 0.05) * np.exp(-t / 0.006) * 0.35
    return norm(s)


def tap(dur=0.09):
    L = int(dur * SR); t = np.arange(L) / SR
    s = lp(rng.randn(L), 0.22, 0.05) * np.exp(-t / 0.013) * np.minimum(1.0, t / 0.0012)
    return norm(s)


def coin(dur=0.55):
    """رنّة عملة: جزئيات معدنية غير متناسقة تخفت بسرعة، مع رنّة ثانية قصيرة."""
    L = int(dur * SR); t = np.arange(L) / SR
    s = np.zeros(L)
    for f, a, d in [(2637, 1.0, 0.16), (3951, 0.6, 0.10), (5274, 0.35, 0.07), (1976, 0.4, 0.22)]:
        s += a * np.sin(2 * np.pi * f * t) * np.exp(-t / d)
    s *= np.minimum(1.0, t / 0.002)
    s2 = np.zeros(L); k = int(0.07 * SR)
    s2[k:] = s[:L - k] * 0.55
    return norm(s + s2)


def pop(dur=0.12):
    L = int(dur * SR); t = np.arange(L) / SR
    f = 900 * np.exp(-t / 0.03) + 380
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.035) * np.minimum(1.0, t / 0.001)
    return norm(s)


SIG = {"whoosh_up": (whoosh(0.34, True), 0.085), "whoosh_down": (whoosh(0.30, False), 0.075),
       "thud": (thud(), 0.115), "tap": (tap(), 0.075), "coin": (coin(), 0.07), "pop": (pop(), 0.06)}
count = 0
for kind, (sig, g) in SIG.items():
    for t0 in EV.get(kind, []):
        add(sig, t0, g); count += 1
buf = np.clip(buf, -0.95, 0.95)
pcm = (buf * 32767).astype("<i2")
w = wave.open(OUT, "wb"); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes(np.repeat(pcm[:, None], 2, axis=1).ravel().tobytes()); w.close()
peak = 20 * np.log10(np.max(np.abs(buf)) + 1e-9)
print(f"✅ {OUT} — {count} حدث · الذروة {peak:.1f} dBFS · {count / (DUR / 60):.0f} حدث/دقيقة")
