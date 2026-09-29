#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""audio.py — صوت «شرح بالموشن»: خلفية صوتية مركّبة على الإيقاع + مؤثرات + الصوت + معايرة ‎-14 LUFS + دمج بالفيديو.

  python3 audio.py <proj>            → renders/final.mp4        (صوت + خلفية + مؤثرات)
  python3 audio.py <proj> --no-bed   → renders/final-nobed.mp4  (صوت + مؤثرات بس)
  خيارات: --video <mp4> (افتراضي renders/video.mp4) · --lufs -14 · --tp -1.5 · --seed 7 · --audition (يطلع كل مؤثر بملف لحاله)

كل شي مركّب رياضياً (numpy/scipy) — بلا عينات خارجية = بلا حقوق.
project.json → music: { key:'A', scale:'minor'|'major'|'dorian', progression:[0,5,2,6], level:-10 (dB تحت الصوت),
                         duck:-9 (dB إضافي وقت الكلام), style:'pulse' }
                         top: طبقة الجوال (هاي هات 5–10k + بلك 0.4–3k) — رقم dB للاثنين أو {hat:dB, pluck:dB}؛ بدونها تنطفي
                         ملاحظة: الصوت يدخل st(vo) = ‎-3 dB لكل قناة، فالفرق الفعلي بالمكس أقل من level بـ3 dB
              sections (من timeline.json): intro · build · drop · break · outro · stop
                (break = باد + آرب + ساب + كيك وهاي هات وشيكر بمستوى الدروب تقريباً (بلا كلاب ولا باص الدروب، كيك مفلتر ينفتح) — ما ينكتم أبداً · stop = سكتة حقيقية وترجع بقوة، خلّها ≤ بار وحدة)
<proj>/sfx.json → [{ type, at, gain, dur, pan, pitch }]
   type: whoosh · reverse-whoosh · riser · impact · boom · sub-drop · glitch · tick · typing · shimmer · pop · swoosh-pass · scratch · slide
   at:   ثواني | 'scene:s2' | 'line:l2' | 'line-end:l2' | 'word:l2:3' (‎-1 = آخر كلمة) | 'beat:8' | 'bar:2'  (+/-إزاحة: 'scene:s2-0.1')
   المرساة: riser و reverse-whoosh ينتهون عند at · whoosh و swoosh-pass ذروتهم عند at · الباقي يبدأ عند at
   لو sfx.json مو موجود: swoosh-pass تلقائي عند كل انتقال مشهد.
"""
import sys, os, json, math, wave, re, argparse, subprocess
import numpy as np
from scipy import signal

SR = 48000
TAU = 2 * np.pi


# ───────────────────────── io ─────────────────────────
def read_wav(path):
    with wave.open(path, 'rb') as w:
        n, ch, sw, sr = w.getnframes(), w.getnchannels(), w.getsampwidth(), w.getframerate(); raw = w.readframes(n)
    x = np.frombuffer(raw, dtype='<i2').astype(np.float32) / 32768.0 if sw == 2 else np.frombuffer(raw, dtype='<i4').astype(np.float32) / 2147483648.0
    x = x.reshape(-1, ch)
    if sr != SR: raise RuntimeError(f'{path}: {sr} Hz (expected {SR})')
    return x.mean(axis=1) if ch > 1 else x[:, 0]


def write_wav(path, x):                       # stereo float → 24-bit PCM
    x = np.clip(np.asarray(x, dtype=np.float64), -1, 1)
    if x.ndim == 1: x = np.stack([x, x], axis=1)
    i = np.ascontiguousarray((x * 8388607).astype('<i4')); b = i.astype('<u4').view(np.uint8).reshape(-1, 4)[:, :3].tobytes()
    with wave.open(path, 'wb') as w:
        w.setnchannels(x.shape[1]); w.setsampwidth(3); w.setframerate(SR); w.writeframes(b)


def read_wav_ch(path, ch):
    with wave.open(path, 'rb') as w:
        n, nc, sw = w.getnframes(), w.getnchannels(), w.getsampwidth(); raw = w.readframes(n)
    if sw == 3:
        b = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3); v = (b[:, 0].astype(np.int32) | (b[:, 1].astype(np.int32) << 8) | (b[:, 2].astype(np.int32) << 16))
        v = np.where(v >= 1 << 23, v - (1 << 24), v).astype(np.float64) / 8388608.0
    else: v = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    return v.reshape(-1, nc)[:, min(ch, nc - 1)]


def run(cmd, capture=False):
    r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if r.returncode != 0: raise RuntimeError(' '.join(cmd) + '\n' + r.stderr.decode('utf-8', 'replace')[-1500:])
    return (r.stdout + r.stderr).decode('utf-8', 'replace')


# ───────────────────────── dsp helpers ─────────────────────────
def db(x): return 10 ** (x / 20.0)
def tvec(dur): return np.arange(int(round(dur * SR))) / SR
def st(x, pan=0.0):                            # mono → stereo, constant-power pan (-1 L .. 1 R); pan may be an array
    a = (np.asarray(pan) + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1)
def norm(x, peak=1.0):
    m = np.max(np.abs(x)) + 1e-12; return x * (peak / m)
def sos(kind, f, order=2):
    f = np.clip(np.asarray(f, dtype=float), 20, SR / 2 * 0.95)
    return signal.butter(order, f, btype=kind, fs=SR, output='sos')
def filt(x, kind, f, order=2): return signal.sosfilt(sos(kind, f, order), x, axis=0)
def sweep(x, kind, f_of_t, block=256, order=2, q_bw=None):
    """time-varying filter: block-wise with carried state (smooth enough at 256 samples)"""
    n = len(x); out = np.zeros_like(x); zi = None; prev = None
    for i in range(0, n, block):
        tt = (i + block / 2) / SR; f = f_of_t(tt)
        if kind == 'bandpass': lo = max(25, f / (q_bw or 1.6)); hi = min(SR / 2 * .95, f * (q_bw or 1.6)); s = sos('bandpass', [lo, hi], order)
        else: s = sos(kind, f, order)
        if zi is None or s.shape != prev: zi = np.zeros((s.shape[0], 2) + x.shape[1:])
        seg = x[i:i + block]; y, zi = signal.sosfilt(s, seg, axis=0, zi=zi); out[i:i + block] = y; prev = s.shape
    return out
def env_ad(n, a, d, curve=4.0):
    t = np.arange(n) / SR; e = np.where(t < a, t / max(a, 1e-6), np.exp(-curve * (t - a) / max(d, 1e-6)))
    return e
def polyblep_saw(freq, n, phase0=0.0):
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,)); dt = f / SR
    p = (phase0 + np.cumsum(dt)) % 1.0
    y = 2 * p - 1
    m1 = p < dt; t1 = p[m1] / dt[m1]; y[m1] -= t1 + t1 - t1 * t1 - 1
    m2 = p > 1 - dt; t2 = (p[m2] - 1) / dt[m2]; y[m2] -= t2 * t2 + t2 + t2 + 1
    return y
def sine(freq, n, phase0=0.0):
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,)); return np.sin(TAU * (np.cumsum(f) / SR) + phase0)
def soft(x, drive=1.0): return np.tanh(x * drive) / np.tanh(drive)
_IR = {}
def reverb(x, rt=1.6, mix=0.25, pre=0.012, bright=6000, seed=3):
    """stereo convolution reverb from a decorrelated exponentially-decaying noise IR"""
    key = (rt, pre, bright, seed)
    if key not in _IR:
        r = np.random.RandomState(seed); n = int((rt + pre) * SR); t = np.arange(n) / SR
        ir = r.randn(n, 2) * np.exp(-6.91 * t / rt)[:, None]; ir[:int(pre * SR)] = 0
        ir = filt(ir, 'lowpass', bright, 2); ir = filt(ir, 'highpass', 180, 2); ir /= np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True)) + 1e-9
        _IR[key] = ir
    ir = _IR[key]
    if x.ndim == 1: x = st(x)
    wet = np.stack([signal.fftconvolve(x[:, 0], ir[:, 0])[:len(x) + len(ir) - 1], signal.fftconvolve(x[:, 1], ir[:, 1])[:len(x) + len(ir) - 1]], axis=1)
    out = np.zeros_like(wet); out[:len(x)] += x * (1 - mix * 0.5); out += wet * mix
    return out


# ───────────────────────── SFX (each returns stereo, anchor seconds) ─────────────────────────
class SFX:
    def __init__(self, seed=7): self.r = np.random.RandomState(seed)
    def noise(self, n, ch=1): return self.r.randn(n) if ch == 1 else self.r.randn(n, ch)

    def whoosh(self, dur=0.55, pitch=1.0, **k):
        n = int(dur * SR); t = np.arange(n) / SR; pk = 0.45 * dur
        x = self.noise(n, 2)
        fc = lambda tt: 350 * pitch * (1 + 7 * np.exp(-((tt - pk) / (dur * .28)) ** 2))
        y = sweep(x, 'bandpass', fc, q_bw=1.9)
        e = np.exp(-((t - pk) / (dur * 0.26)) ** 2) * np.minimum(1, t / 0.02)
        pan = np.clip((t - pk) / (dur * 0.5), -1, 1) * 0.6
        y = y * e[:, None]; y = np.stack([y[:, 0] * np.cos((pan + 1) * np.pi / 4) * 1.4, y[:, 1] * np.sin((pan + 1) * np.pi / 4) * 1.4], axis=1)
        return norm(reverb(y, 0.6, 0.12), 0.9), pk

    def reverse_whoosh(self, dur=0.8, pitch=1.0, **k):
        s, _ = self.whoosh(dur * 0.7, pitch); s = reverb(s, 1.2, 0.5)[::-1]
        n = len(s); t = np.arange(n) / SR; s = s * (np.minimum(1, (t / (n / SR)) ** 2.5))[:, None]
        s = filt(s, 'highpass', 250); return norm(s, 0.9), n / SR

    def riser(self, dur=1.5, pitch=1.0, **k):
        n = int(dur * SR); t = np.arange(n) / SR; u = t / dur
        nz = sweep(self.noise(n, 2), 'bandpass', lambda tt: 300 * pitch * 2 ** (4.5 * (tt / dur) ** 1.6), q_bw=1.5)
        f = 180 * pitch * 2 ** (3.2 * u ** 1.8) * (1 + 0.012 * np.sin(TAU * 6 * t))
        tone = sum(polyblep_saw(f * m, n, i * .31) * a for i, (m, a) in enumerate([(1, .5), (1.005, .5), (2, .25)]))
        tone = sweep(tone, 'lowpass', lambda tt: 400 + 5000 * (tt / dur) ** 2)
        shep = sum(sine(f * 2 ** o, n) * np.exp(-((np.log2(f * 2 ** o / 800)) ** 2) / 2) for o in range(-1, 3))
        y = nz * 0.9 + st(tone, 0) * 0.35 + st(shep, 0) * 0.25
        e = u ** 2.2; y = y * e[:, None]
        cut = int(0.006 * SR); y[-cut:] *= np.linspace(1, 0, cut)[:, None]
        return norm(y, 0.85), dur

    def impact(self, dur=1.8, pitch=1.0, **k):
        n = int(dur * SR); t = np.arange(n) / SR
        sub = sine(70 * pitch * np.exp(-t / 0.35) + 34 * pitch, n) * np.exp(-t / 0.45)
        thump = sine(140 * pitch * np.exp(-t / 0.05) + 60, n) * np.exp(-t / 0.09)
        crack = filt(self.noise(n), 'bandpass', [900, 7000]) * np.exp(-t / 0.018)
        body = filt(self.noise(n), 'lowpass', 1200) * np.exp(-t / 0.12) * 0.5
        dry = soft(sub * 1.0 + thump * 0.7 + crack * 0.6 + body * 0.4, 1.6)
        y = reverb(st(dry), 2.2, 0.35, bright=4500)[:n]
        return norm(y, 0.95), 0.0

    def boom(self, **k): return self.impact(dur=k.get('dur', 2.4), pitch=k.get('pitch', 0.8))

    def sub_drop(self, dur=1.4, pitch=1.0, **k):
        n = int(dur * SR); t = np.arange(n) / SR
        f = 28 * pitch + 70 * pitch * np.exp(-t / (dur * 0.35))
        y = soft(sine(f, n) * np.exp(-t / (dur * 0.55)) * np.minimum(1, t / 0.005), 1.8)
        y += sine(f * 2, n) * np.exp(-t / (dur * 0.3)) * 0.15
        return norm(st(y), 0.95), 0.0

    def glitch(self, dur=0.4, **k):
        n = int(dur * SR); y = np.zeros((n, 2)); i = 0
        while i < n:
            L = int(self.r.uniform(0.012, 0.045) * SR); L = min(L, n - i); kind = self.r.randint(0, 4); tt = np.arange(L) / SR
            if kind == 0: s = np.sign(np.sin(TAU * self.r.uniform(200, 2400) * tt)) * 0.6
            elif kind == 1: s = self.noise(L) * 0.7
            elif kind == 2:                           # sample-and-hold "bitcrush"
                hold = self.r.randint(8, 60); s = np.repeat(self.noise(L // hold + 1), hold)[:L]; s = np.round(s * 4) / 4 * 0.7
            else: s = np.zeros(L)
            e = np.ones(L); f = min(48, L // 2); e[:f] = np.linspace(0, 1, f); e[-f:] = np.linspace(1, 0, f)
            y[i:i + L] = st(s * e, self.r.uniform(-.8, .8)); i += L
        y = filt(y, 'highpass', 120); return norm(y, 0.8), 0.0

    def tick(self, pitch=1.0, **k):
        n = int(0.06 * SR); t = np.arange(n) / SR
        y = sine(3200 * pitch, n) * np.exp(-t / 0.004) + filt(self.noise(n), 'highpass', 5000) * np.exp(-t / 0.0015) * 0.8
        y += sine(900 * pitch, n) * np.exp(-t / 0.01) * 0.3
        return norm(st(y, k.get('pan', 0)), 0.8), 0.0

    def typing(self, dur=1.0, cps=13, **k):
        n = int(dur * SR); y = np.zeros((n, 2)); m = int(dur * cps)
        for j in range(m):
            at = int((j / cps + self.r.uniform(-0.015, 0.015)) * SR); at = max(0, min(n - 1, at))
            L = int(0.05 * SR); t = np.arange(L) / SR
            c = filt(self.noise(L), 'bandpass', [1500 * self.r.uniform(.8, 1.3), 6000]) * np.exp(-t / 0.006)
            c += sine(180 * self.r.uniform(.9, 1.2), L) * np.exp(-t / 0.012) * 0.5
            c *= self.r.uniform(0.5, 1.0); e = min(L, n - at); y[at:at + e] += st(c[:e], self.r.uniform(-.25, .25))
        return norm(reverb(y, 0.35, 0.1), 0.8), 0.0

    def shimmer(self, dur=1.6, pitch=1.0, **k):
        n = int(dur * SR); t = np.arange(n) / SR; base = 880 * pitch; y = np.zeros((n, 2))
        for i, (ratio, a, d) in enumerate([(1, 1, .9), (2.76, .5, .6), (5.40, .3, .4), (8.93, .18, .25), (2.0, .4, .8), (3.0, .2, .5)]):
            for ch, det in ((0, 1 - .002 * (i + 1)), (1, 1 + .002 * (i + 1))):
                y[:, ch] += sine(base * ratio * det, n, i) * np.exp(-t / d) * a * np.minimum(1, t / 0.004)
        sp = filt(self.noise(n, 2), 'highpass', 7000) * (np.exp(-t / 0.5) * (0.5 + 0.5 * np.sin(TAU * 17 * t)))[:, None] * 0.12
        y = reverb(y + sp, 2.0, 0.4, bright=9000)[:n]
        return norm(y, 0.7), 0.0

    def pop(self, pitch=1.0, **k):
        n = int(0.14 * SR); t = np.arange(n) / SR
        f = 320 * pitch + 900 * pitch * np.exp(-t / 0.018)
        y = sine(f, n) * np.exp(-t / 0.035) * np.minimum(1, t / 0.001) + filt(self.noise(n), 'highpass', 3000) * np.exp(-t / 0.002) * 0.3
        return norm(reverb(st(y, k.get('pan', 0)), 0.3, 0.1)[:n], 0.8), 0.0

    def swoosh_pass(self, dur=0.7, pitch=1.0, **k):
        n = int(dur * SR); t = np.arange(n) / SR; c = dur * 0.5
        v, dmin = 60.0, 0.8                          # speed / closest distance → doppler + distance gain
        x = (t - c) * v; dist = np.sqrt(x ** 2 + dmin ** 2); vr = x / dist * v
        dop = 343 / (343 + vr)
        nz = sweep(self.noise(n, 2), 'bandpass', lambda tt: 900 * pitch * float(343 / (343 + ((tt - c) * v) / np.sqrt(((tt - c) * v) ** 2 + dmin ** 2) * v)), q_bw=2.2)
        tone = polyblep_saw(220 * pitch * dop, n) * 0.25 + sine(440 * pitch * dop, n) * 0.2
        tone = filt(tone, 'lowpass', 2500)
        g = (dmin / dist) ** 1.3
        pan = np.clip(x / 6.0, -1, 1)
        y = (nz * g[:, None]) + st(tone * g, pan)
        y = np.stack([y[:, 0] * np.cos((pan + 1) * np.pi / 4) * 1.4, y[:, 1] * np.sin((pan + 1) * np.pi / 4) * 1.4], axis=1)
        return norm(reverb(y, 0.5, 0.12)[:n], 0.9), c

    def scratch(self, dur=0.095, pitch=1.0, **k):
        """pen/nib scratch: noise band-passed ~2–7 kHz, 80–110 ms, amplitude jittered ~35–45 Hz (paper fibres). pitch<1 = lower."""
        dur = min(0.11, max(0.08, dur)); n = int(dur * SR); t = np.arange(n) / SR
        y = filt(self.noise(n), 'bandpass', [2000 * pitch, min(SR / 2 * .95, 7000 * pitch)], order=3)
        fj = self.r.uniform(35, 45); jit = 0.55 + 0.45 * np.abs(np.sin(np.pi * fj * t + self.r.uniform(0, 3)))
        jit *= 1 + 0.25 * np.repeat(self.r.randn(n // 64 + 1), 64)[:n]              # uneven pressure
        e = np.minimum(1, t / 0.006) * np.minimum(1, (dur - t) / 0.025) * (1 - 0.3 * t / dur)
        y = y * jit * e + filt(self.noise(n), 'bandpass', [600 * pitch, 1400 * pitch]) * e * 0.18   # a little body from the paper
        return norm(reverb(st(y, k.get('pan', 0)), 0.25, 0.08)[:n], 0.8), 0.0

    def slide(self, dur=0.24, pitch=1.0, **k):
        """soft plastic slide: short band-passed noise, centre gliding down ~2.6→1.4 kHz, smooth swell (starts at `at`)."""
        n = int(dur * SR); t = np.arange(n) / SR
        y = sweep(self.noise(n, 2), 'bandpass', lambda tt: 2600 * pitch * (1 - 0.45 * tt / dur), q_bw=1.35)
        e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.4
        pan = np.linspace(0.35, -0.35, n)                                            # right → left, like the drag
        y = y * e[:, None]; y = np.stack([y[:, 0] * np.cos((pan + 1) * np.pi / 4) * 1.4, y[:, 1] * np.sin((pan + 1) * np.pi / 4) * 1.4], axis=1)
        return norm(reverb(y, 0.3, 0.1)[:n], 0.8), 0.0

    def make(self, kind, **k):
        fn = getattr(self, kind.replace('-', '_'), None)
        if not fn: raise SystemExit(f'❌ نوع مؤثر مو معروف: {kind}')
        kk = {a: b for a, b in k.items() if a in ('dur', 'pitch', 'pan', 'cps') and b is not None}
        return fn(**kk)


# ───────────────────────── bed (beat-synced background) ─────────────────────────
SCALES = {'minor': [0, 2, 3, 5, 7, 8, 10], 'major': [0, 2, 4, 5, 7, 9, 11], 'dorian': [0, 2, 3, 5, 7, 9, 10], 'phrygian': [0, 1, 3, 5, 7, 8, 10]}
KEYS = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
def mfreq(semi_from_c0): return 16.3516 * 2 ** (semi_from_c0 / 12)

def section_at(secs, t):
    for s in secs:
        if s['start'] <= t < s['end']: return s['name']
    return secs[-1]['name'] if secs else 'drop'

def build_bed(tl, music, dur, seed=5):
    r = np.random.RandomState(seed); N = int(math.ceil((dur + 2.5) * SR))
    bpm = tl['bpm']; spb = 60 / bpm; bpb = tl.get('beatsPerBar', 4); off = tl.get('beatOffset', 0)
    secs = tl.get('sections') or [{'name': 'drop', 'start': 0, 'end': dur}]
    key = KEYS.get(music.get('key', 'A'), 9); scale = SCALES.get(music.get('scale', 'minor'), SCALES['minor']); prog = music.get('progression', [0, 5, 2, 6])
    def deg(d, octv):                                  # scale degree → semitone from C0
        o, i = divmod(d, 7); return 12 * (octv + o) + key + scale[i]
    bus = {k: np.zeros((N, 2)) for k in ('kick', 'clap', 'hat', 'bass', 'pad', 'arp', 'fx', 'bkick', 'bhat', 'top', 'ptop')}
    kicks = []
    def put(b, x, at):
        i = int(round(at * SR));
        if i >= N or i + len(x) <= 0: return
        if i < 0: x = x[-i:]; i = 0
        j = min(N, i + len(x)); bus[b][i:j] += x[:j - i]
    # one-shots
    tK = tvec(0.45); kick = soft(sine(46 + 110 * np.exp(-tK / 0.035), len(tK)) * np.exp(-tK / 0.16) * 1.2, 1.4) + filt(r.randn(len(tK)), 'highpass', 2500) * np.exp(-tK / 0.003) * 0.25
    tC = tvec(0.35); cl = np.zeros(len(tC))
    for d in (0, 0.011, 0.023): i = int(d * SR); cl[i:] += np.exp(-tC[:len(tC) - i] / (0.009 if d < .02 else 0.09))
    clap = filt(r.randn(len(tC)) * cl, 'bandpass', [800, 4200]); clap = reverb(st(clap), 0.9, 0.3)[:len(tC)]
    tH = tvec(0.12); hat_c = filt(r.randn(len(tH)), 'highpass', 7500) * np.exp(-tH / 0.022)
    tO = tvec(0.45); hat_o = filt(r.randn(len(tO)), 'highpass', 6500) * np.exp(-tO / 0.14)
    tS = tvec(0.2); snare = filt(r.randn(len(tS)), 'bandpass', [1200, 6000]) * np.exp(-tS / 0.05) + sine(190, len(tS)) * np.exp(-tS / 0.04) * .5
    # step through 16ths
    n16 = int(math.ceil((dur + spb) / (spb / 4)))
    for s16 in range(n16):
        t = off + s16 * spb / 4
        if t < 0 or t >= dur: continue
        sec = section_at(secs, t); beat, sub = divmod(s16, 4); inbar = beat % bpb
        nxt = next((s for s in secs if s['start'] > t), None)
        bars_left = ((nxt['start'] - t) / (spb * bpb)) if nxt else 99
        if sub == 0:
            if sec in ('drop', 'outro') or (sec == 'build') or (sec == 'intro' and inbar == 0 and len(secs) > 1 and t > 0):
                g = 1.0 if sec != 'intro' else 0.55
                put('kick', st(kick * g), t); kicks.append(t)
            if sec == 'drop' and inbar in (1, 3): put('clap', clap, t)
            if sec == 'break': put('bkick', st(kick), t); kicks.append(t)      # break keeps the pulse: low-passed, near drop level (never mute)
        if sec == 'break' and sub == 2: put('bhat', st(hat_c * 0.8, 0.35), t)
        if sec == 'break' and sub in (1, 3): put('bhat', st(hat_c * 0.3, -0.3), t)      # 16th shaker keeps the motion alive under the VO
        if sec in ('drop', 'build', 'intro', 'outro') and sub == 2: put('hat', st(hat_c * (0.8 if sec != 'intro' else .5), 0.35), t)
        if sec == 'build' and sub in (1, 3) and bars_left < 1: put('hat', st(hat_c * .45, -0.35), t)
        if sec == 'drop' and sub == 2 and inbar == bpb - 1: put('hat', st(hat_o * .5, -.2), t)
        if sec == 'build' and bars_left <= 1:          # snare roll into the next section
            rate = 1 if bars_left > .5 else 2
            if rate == 2 or sub % 2 == 0: put('fx', st(snare * (0.25 + 0.6 * (1 - bars_left))), t)
    # tonal parts per bar
    nbars = int(math.ceil(dur / (spb * bpb))) + 1
    for b in range(nbars):
        t0 = off + b * spb * bpb; blen = spb * bpb
        if t0 >= dur: break
        sec = section_at(secs, max(0, t0 + 1e-3)); ch = prog[b % len(prog)]
        if sec == 'stop':                               # a stop that ends inside this bar → play the next section's bar; the gate below keeps the silence
            nx = next((s for s in secs if t0 + 1e-3 < s['start'] < t0 + blen and s['name'] != 'stop'), None)
            if not nx: continue
            sec = nx['name']
        notes = [deg(ch, 3), deg(ch + 2, 3), deg(ch + 4, 3), deg(ch + 7, 3)]
        # pad
        n = int((blen + 1.2) * SR); tt = np.arange(n) / SR; pad = np.zeros((n, 2))
        for q, m in enumerate(notes):
            f = mfreq(m)
            for chn, det in ((0, -1), (1, 1)):
                for dv in (-7, 0, 7):
                    pad[:, chn] += polyblep_saw(f * 2 ** ((dv + det * 3) / 1200), n, r.rand()) * (0.6 if dv else 0.8)
        cut = {'intro': 900, 'build': 1400, 'drop': 2600, 'break': 1600, 'outro': 1000}.get(sec, 1800)
        if sec == 'build': pad = sweep(pad, 'lowpass', lambda x: 900 + 3200 * min(1, x / blen))
        else: pad = filt(pad, 'lowpass', cut)
        eP = np.minimum(1, tt / 0.25) * np.where(tt > blen, np.exp(-(tt - blen) / 0.35), 1)
        put('pad', pad * eP[:, None] * (0.05 if sec != 'break' else 0.09), t0)
        # break: a sub pulse on the root (two half-bar notes) so the low end never vanishes
        if sec == 'break':
            root = mfreq(deg(ch, 1)); hb = blen / 2
            for k2 in range(2):
                tb = t0 + k2 * hb
                if tb >= dur: break
                L = int(hb * 0.95 * SR); tl_ = np.arange(L) / SR
                sb = filt(soft(sine(root, L) * 0.9 + polyblep_saw(root, L) * 0.25, 1.3), 'lowpass', 220)
                sb *= np.minimum(1, tl_ / 0.01) * np.exp(-tl_ / (hb * 0.8)); put('bass', st(sb * 0.55), tb)
        # bass
        if sec in ('drop', 'build', 'outro'):
            root = mfreq(deg(ch, 1)); step = spb / 2
            for k8 in range(int(bpb * 2)):
                tb = t0 + k8 * step
                if tb >= dur: break
                if sec == 'build' and k8 % 2: continue
                f = root * (2 if (k8 % 4 == 3 and sec == 'drop') else 1); L = int(step * 0.92 * SR); tl_ = np.arange(L) / SR
                bs = soft(polyblep_saw(f, L) * 0.6 + sine(f, L) * 0.8, 1.5); bs = filt(bs, 'lowpass', 420 if sec == 'drop' else 260)
                bs *= np.minimum(1, tl_ / 0.004) * np.exp(-tl_ / (step * 0.9)); put('bass', st(bs * 0.5), tb)
        # arp
        if sec in ('drop', 'break', 'build'):
            div = 4 if sec != 'build' else 2; step = spb / div; seq = [0, 1, 2, 3, 2, 1]
            for k16 in range(int(bpb * div)):
                ta = t0 + k16 * step
                if ta >= dur: break
                m = notes[seq[k16 % len(seq)] % 4] + 12; f = mfreq(m); L = int(0.35 * SR); ta_ = np.arange(L) / SR
                pl = polyblep_saw(f, L) * 0.5 + sine(f * 2, L) * 0.3
                pl = sweep(pl, 'lowpass', lambda x: 600 + 5000 * math.exp(-x / 0.05))
                pl *= np.exp(-ta_ / 0.09) * np.minimum(1, ta_ / 0.002)
                put('arp', st(pl * (0.16 if sec != 'break' else 0.13), 0.45 if k16 % 2 else -0.45), ta)
    # phone layer (music.top): the kick/bass/pad live below 150 Hz and vanish on a phone speaker, so this carries
    # the pulse in the bands a phone plays — a bright pluck (400 Hz–3 kHz) + a tight hat/snap (5–10 kHz).
    top = music.get('top')
    if top not in (None, False, 0):
        tP = tvec(0.22); tHt = tvec(0.07); tN = tvec(0.16)
        hat_t = filt(filt(r.randn(len(tHt)), 'highpass', 5200, 4), 'lowpass', 10000, 2) * np.exp(-tHt / 0.012) * np.minimum(1, tHt / 0.0008)
        snap = np.zeros(len(tN))
        for d in (0, 0.007, 0.015): i = int(d * SR); snap[i:] += np.exp(-tN[:len(tN) - i] / (0.006 if d < .012 else 0.045))
        snap = filt(filt(r.randn(len(tN)) * snap, 'highpass', 2600, 4), 'lowpass', 9500, 2)
        def pluck(f):                                    # FM-ish pluck: bright attack, fast decay, energy 400 Hz–3 kHz
            ph = TAU * f * tP + 1.6 * np.exp(-tP / 0.03) * np.sin(TAU * f * 2 * tP)
            x = (np.sin(ph) + 0.35 * np.sign(np.sin(ph)) * np.exp(-tP / 0.02)) * np.exp(-tP / 0.065) * np.minimum(1, tP / 0.0015)
            return filt(filt(x, 'highpass', 420, 2), 'lowpass', 3200, 2)
        pat = [0, 2, 1, 3, 2, 0, 3, 1]                   # chord-tone walk, different shape from the arp
        acc16 = [0.55, 0.3, 1.0, 0.35]                   # hat velocity per 16th (accent on the off-beat 8th)
        for s16 in range(n16):
            t = off + s16 * spb / 4
            if t < 0 or t >= dur: continue
            sec = section_at(secs, t); beat, sub = divmod(s16, 4); inbar = beat % bpb
            if sec == 'stop': continue
            nxt = next((s for s in secs if s['start'] > t), None)
            bars_left = ((nxt['start'] - t) / (spb * bpb)) if nxt else 99
            soft_ = 0.55 if sec in ('break', 'intro') else 1.0
            # hats: 16ths in drop, 8ths elsewhere (16ths in the last bar of a build)
            if sec == 'drop' or (sec == 'build' and bars_left < 1) or sub % 2 == 0:
                put('top', st(hat_t * acc16[sub] * soft_ * (0.8 if sec in ('outro',) else 1), 0.25 if sub % 2 else -0.15), t)
            # snap on 2 & 4 (not in intro/break — those keep the space)
            if sub == 0 and inbar in (1, 3) and sec in ('drop', 'build', 'outro'): put('top', st(snap * 0.9, 0.1), t)
            # pluck: 8ths (16ths in drop), chord from the progression bar
            if sec == 'drop' or sub % 2 == 0:
                b = int((t - off) // (spb * bpb)); ch = prog[b % len(prog)]
                m = [deg(ch, 5), deg(ch + 2, 5), deg(ch + 4, 5), deg(ch + 7, 5)][pat[(s16 // (1 if sec == 'drop' else 2)) % len(pat)]]
                v = (1.0 if sub == 0 else 0.7) * soft_
                put('ptop', st(pluck(mfreq(m)) * v, 0.3 if (s16 // 2) % 2 else -0.3), t)
    # section-change accents
    for s in secs:
        if s['name'] == 'drop' and s['start'] > 0.05:
            n = int(1.6 * SR); tt = np.arange(n) / SR
            metal = sum(np.sign(np.sin(TAU * f * tt + r.rand() * 6)) for f in (3120, 4260, 5350, 6980, 8470)) / 5.0   # inharmonic partials
            body = filt(r.randn(n, 2), 'bandpass', [4000, 11000]) * 0.8 + st(filt(metal, 'bandpass', [3000, 10000]) * 0.5)
            crash = body * (np.exp(-tt / 0.38) * np.minimum(1, tt / 0.002))[:, None] * 0.2
            put('fx', crash, s['start'])
    # break drums: low-pass that opens across each break (muffled → bright into the next section)
    brks = [s for s in secs if s['name'] == 'break']
    if brks:
        def fb(lo, hi):
            def f(x):
                s = next((s for s in brks if s['start'] <= x < s['end']), None)
                return hi if s is None else lo + (hi - lo) * ((x - s['start']) / max(1e-3, s['end'] - s['start'])) ** 2
            return f
        bus['bkick'] = sweep(bus['bkick'], 'lowpass', fb(1500, 5000)); bus['bhat'] = sweep(bus['bhat'], 'lowpass', fb(8000, 16000))
    # 'stop' sections: a true hard silence, then a hard restart (gate the dry buses so nothing leaks through tails)
    gate = np.ones(N)
    for s in secs:
        if s['name'] != 'stop': continue
        a, b_ = int(s['start'] * SR), min(N, int(s['end'] * SR)); ro, ri = int(0.004 * SR), int(0.002 * SR)
        gate[a:b_] = 0; gate[max(0, a - ro):a] = np.linspace(1, 0, min(ro, a)); gate[max(0, b_ - ri):b_] = np.linspace(0, 1, min(ri, b_))
    for k in bus: bus[k] *= gate[:, None]
    # sidechain pump from kicks (pad/bass/arp)
    tt = np.arange(N) / SR; ks = np.array(sorted(kicks)) if kicks else np.array([-10.0])
    idx = np.searchsorted(ks, tt, side='right') - 1; since = np.where(idx >= 0, tt - ks[np.maximum(idx, 0)], 10)
    pump = 1 - 0.55 * np.exp(-since / 0.11)
    for b in ('pad', 'bass', 'arp'): bus[b] *= pump[:, None]
    bus['ptop'] *= (1 - 0.4 * np.exp(-since / 0.11))[:, None]   # lighter pump on the phone pluck (keeps its transient)
    # delays / space
    arp = bus['arp']; d = int(spb * 0.75 * SR); dl = np.zeros_like(arp); dl[d:, 0] += arp[:-d, 1] * 0.35; dl[2 * d:, 1] += arp[:-2 * d, 0] * 0.25; bus['arp'] = arp + dl
    bus['pad'] = reverb(bus['pad'], 2.6, 0.35)[:N]; bus['arp'] = reverb(bus['arp'], 1.4, 0.2)[:N]; bus['ptop'] = reverb(bus['ptop'], 0.9, 0.15)[:N]
    lv = {'kick': db(-4), 'clap': db(-10), 'hat': db(-17), 'bass': db(-8), 'pad': db(-9), 'arp': db(-12), 'fx': db(-10), 'bkick': db(-4), 'bhat': db(-15)}
    tp = music.get('top')                               # phone layer trim (dB): a number trims both, or {"hat": dB, "pluck": dB}
    th, tpl = (tp.get('hat', 0), tp.get('pluck', 0)) if isinstance(tp, dict) else ((0, 0) if tp in (None, False, True, 0) else (float(tp), float(tp)))
    lv['top'] = db(-14 + th); lv['ptop'] = db(-15 + tpl)   # hats/snap 5–10 kHz sit above speech; the pluck (0.4–3 kHz) shares its band → trim it separately
    mix = sum(bus[k] * lv[k] for k in bus)
    mix = filt(mix, 'highpass', 28, 2); mix = filt(mix, 'lowpass', 15500, 2)
    mix = soft(mix * 0.9, 1.3)
    mix = mix * gate[:, None]                           # reverb/delay tails die at the stop too
    return mix[:int(math.ceil(dur * SR))]


# ───────────────────────── mixing ─────────────────────────
def rms_db(x):
    x = x if x.ndim == 1 else x.mean(axis=1); return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)

def vo_envelope(vo, look=0.04, att=0.008, rel=0.32):
    hop = int(0.005 * SR); n = len(vo) // hop + 1; pad = np.zeros(n * hop); pad[:len(vo)] = np.abs(vo)
    fr = np.sqrt(np.mean(pad.reshape(n, hop) ** 2, axis=1)); thr = np.max(fr) * 0.06 + 1e-9
    g = np.clip(fr / thr, 0, 1); e = np.zeros(n); a = math.exp(-hop / SR / att); rr = math.exp(-hop / SR / rel); z = 0
    for i in range(n): z = (a if g[i] > z else rr) * z + (1 - (a if g[i] > z else rr)) * g[i]; e[i] = z
    sh = int(look / 0.005); e = np.concatenate([e[sh:], np.zeros(sh)])
    return np.interp(np.arange(len(vo)), np.arange(n) * hop, e)

def resolve_at(at, tl):
    if isinstance(at, (int, float)): return float(at)
    m = re.match(r'^([a-z\-]+):([^+\-]+?)(?::(-?\d+))?([+\-]\d*\.?\d+)?$', str(at).strip())
    if not m: return float(at)
    kind, ref, idx, offs = m.group(1), m.group(2), m.group(3), float(m.group(4) or 0)
    vo = {L['id']: L for L in tl.get('vo', [])}
    if kind == 'scene': base = next(s['start'] for s in tl['scenes'] if s['id'] == ref)
    elif kind == 'scene-end': base = next(s['end'] for s in tl['scenes'] if s['id'] == ref)
    elif kind == 'line': base = vo[ref]['start']
    elif kind == 'line-end': base = vo[ref]['end']
    elif kind == 'word': w = vo[ref]['words'][int(idx or 0)]; base = w['s']
    elif kind == 'beat': base = tl.get('beatOffset', 0) + int(ref) * 60 / tl['bpm']
    elif kind == 'bar': base = tl.get('beatOffset', 0) + int(ref) * tl.get('beatsPerBar', 4) * 60 / tl['bpm']
    else: raise SystemExit('❌ at غير مفهوم: ' + str(at))
    return base + offs

def limiter(x, thr, look=0.005, rel=0.08):
    """lookahead peak limiter (stereo-linked): keeps |x| <= thr (linear) without clipping distortion"""
    from scipy.ndimage import maximum_filter1d, minimum_filter1d
    a = np.max(np.abs(x), axis=1); L = int(look * SR)
    need = np.minimum(1.0, thr / (maximum_filter1d(a, size=2 * L + 1) + 1e-12))
    g = minimum_filter1d(need, size=2 * L + 1)                       # attack spread over the lookahead window
    hop = 48; n = len(g) // hop + 1; gp = np.ones(n * hop); gp[:len(g)] = g; gf = gp.reshape(n, hop).min(axis=1)
    rr = math.exp(-hop / SR / rel); z = 1.0; out = np.empty(n)
    for i in range(n): z = gf[i] if gf[i] < z else rr * z + (1 - rr) * gf[i]; out[i] = z
    gs = np.interp(np.arange(len(g)), np.arange(n) * hop + hop / 2, out)
    return x * np.minimum(gs, need)[:, None]

def loudnorm(src, dst, I=-14.0, TP=-1.5, LRA=11):
    measure1 = lambda f: json.loads((lambda o: o[o.rindex('{'):o.rindex('}') + 1])(run(['ffmpeg', '-hide_banner', '-nostats', '-i', f, '-af', f'loudnorm=I={I}:TP={TP}:LRA={LRA}:print_format=json', '-f', 'null', '-'])))
    js = measure1(src); orig = src; margin = 0.8
    for attempt in range(4):                                           # peaks would pass the ceiling → limit first so loudnorm stays LINEAR
        gain = I - float(js['input_i'])
        if float(js['input_tp']) + gain <= TP - 0.3: break
        x = np.stack([read_wav_ch(orig, 0), read_wav_ch(orig, 1)], axis=1)
        x = limiter(x, db(TP - margin - gain)); src = orig.replace('.wav', '.lim.wav'); write_wav(src, x)
        js = measure1(src); margin += 0.8
    af = (f'loudnorm=I={I}:TP={TP}:LRA={LRA}:measured_I={js["input_i"]}:measured_TP={js["input_tp"]}:measured_LRA={js["input_lra"]}'
          f':measured_thresh={js["input_thresh"]}:offset={js["target_offset"]}:linear=true:print_format=json')
    out2 = run(['ffmpeg', '-hide_banner', '-nostats', '-y', '-i', src, '-af', af, '-ar', str(SR), '-c:a', 'pcm_s24le', dst])
    js2 = json.loads(out2[out2.rindex('{'):out2.rindex('}') + 1])
    return js, js2

def measure(path):
    out = run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'])
    I = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', out)[-1]); TPk = float(re.findall(r'Peak:\s+(-?[\d.]+|-inf) dBFS', out)[-1])
    return I, TPk


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('proj'); ap.add_argument('--no-bed', action='store_true'); ap.add_argument('--video')
    ap.add_argument('--lufs', type=float, default=-14.0); ap.add_argument('--tp', type=float, default=-1.5); ap.add_argument('--seed', type=int, default=7)
    ap.add_argument('--audition', action='store_true')
    a = ap.parse_args()
    P = os.path.abspath(a.proj); proj = json.load(open(os.path.join(P, 'project.json'), encoding='utf-8'))
    tl = json.load(open(os.path.join(P, 'timeline.json'), encoding='utf-8')); dur = float(tl['duration']); N = int(math.ceil(dur * SR))
    music = proj.get('music', {}) or {}
    A = os.path.join(P, 'renders', 'audio'); os.makedirs(A, exist_ok=True)
    sfxgen = SFX(a.seed)
    if a.audition:
        for k in ('whoosh', 'reverse-whoosh', 'riser', 'impact', 'boom', 'sub-drop', 'glitch', 'tick', 'typing', 'shimmer', 'pop', 'swoosh-pass', 'scratch', 'slide'):
            s, anc = sfxgen.make(k); write_wav(os.path.join(A, f'sfx_{k}.wav'), s * db(-3)); print(f'  🔊 sfx_{k}.wav  {len(s)/SR:.2f}s  anchor {anc:.2f}s')
        return
    # VO
    vf = os.path.join(P, 'vo', 'vo_full.wav')
    vo = read_wav(vf)[:N] if os.path.exists(vf) else np.zeros(N)
    if len(vo) < N: vo = np.concatenate([vo, np.zeros(N - len(vo))])
    has_vo = np.max(np.abs(vo)) > 1e-4
    vo_ref = rms_db(vo[np.abs(vo) > 0.01]) if has_vo else -20.0          # speech-active RMS
    print(f'🗣  VO: {"موجود" if has_vo else "ما في"} · RMS الكلام {vo_ref:.1f} dBFS')
    # SFX
    sj = os.path.join(P, 'sfx.json')
    cues = json.load(open(sj, encoding='utf-8')) if os.path.exists(sj) else [{'type': 'swoosh-pass', 'at': f'scene:{s["id"]}', 'gain': 0.7} for s in tl['scenes'][1:] if s.get('transition')]
    sfx = np.zeros((N + SR * 3, 2))
    for c in cues:
        s, anc = sfxgen.make(c['type'], dur=c.get('dur'), pitch=c.get('pitch'), pan=c.get('pan'), cps=c.get('cps'))
        t = resolve_at(c['at'], tl) - anc; i = int(round(t * SR)); g = float(c.get('gain', 1.0))
        if i < 0: s = s[-i:]; i = 0
        j = min(len(sfx), i + len(s)); sfx[i:j] += s[:j - i] * g * db(vo_ref + 4)   # SFX peak sits ~4 dB above speech RMS at gain 1
        print(f'  🔊 {c["type"]:<14} @ {t + anc:6.3f}s  (anchor {anc:.2f}s, gain {g})')
    sfx = sfx[:N]
    # bed
    parts = {'vo': st(vo)}
    if not a.no_bed:
        bed = build_bed(tl, music, dur, seed=a.seed)
        bed = bed * db((vo_ref + music.get('level', -10)) - rms_db(bed))              # bed level relative to speech
        if has_vo:
            e = vo_envelope(vo); bed = bed * (1 - (1 - db(music.get('duck', -9))) * e)[:, None]
        fo = int(0.35 * SR); bed[-fo:] *= np.linspace(1, 0, fo)[:, None]
        parts['bed'] = bed; write_wav(os.path.join(A, 'bed.wav'), bed * 0.9 / (np.max(np.abs(bed)) + 1e-9))
    mix = parts['vo'] + sfx + parts.get('bed', 0)
    pk = np.max(np.abs(mix)); mix = mix * (0.7 / pk) if pk > 0.7 else mix                 # headroom before loudnorm
    tag = '-nobed' if a.no_bed else ''
    mw = os.path.join(A, f'mix{tag}.wav'); write_wav(mw, mix); write_wav(os.path.join(A, 'sfx.wav'), sfx)
    mst = os.path.join(A, f'master{tag}.wav')
    m1, m2 = loudnorm(mw, mst, a.lufs, a.tp)
    I, TPk = measure(mst)
    print(f'📏 loudnorm: {float(m1["input_i"]):.1f} → {I:.1f} LUFS · true peak {TPk:.1f} dBTP · mode {m2.get("normalization_type")}')
    video = a.video or os.path.join(P, 'renders', 'video.mp4')
    if not os.path.exists(video): print('⚠ ما لقيت الفيديو (' + video + ') — الصوت جاهز بس: ' + mst); return
    out = os.path.join(P, 'renders', f'final{tag}.mp4')
    run(['ffmpeg', '-y', '-v', 'error', '-i', video, '-i', mst, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', str(SR), '-t', f'{dur:.3f}', '-movflags', '+faststart', out])
    I2, TP2 = measure(out)
    print(f'✅ {out}  ·  بعد AAC: {I2:.1f} LUFS · {TP2:.1f} dBTP')


if __name__ == '__main__':
    main()
