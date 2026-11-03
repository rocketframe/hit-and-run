"""Original trailer score + synced SFX for the Hit and Run trailer. Pure numpy synthesis."""
import json, sys, wave
import numpy as np

SP = sys.argv[1]
data = json.load(open(f"{SP}/tlog.json"))
FPS, SR = 30, 44100
N_FR = data["frames"]
DUR = N_FR / FPS + 0.2
N = int(DUR * SR)
rng = np.random.default_rng(7)
cues = {c["k"]: [] for c in data["cues"]}
for c in data["cues"]:
    cues[c["k"]].append(c["f"] / FPS)
T_PUNCH = cues["punch"][0]
T_BOOM = cues.get("bigboom", [None])[0]
T_END = cues["end"][0]
cuts = cues.get("cut", [])

music = np.zeros((N, 2)); sfx = np.zeros((N, 2)); send = np.zeros((N, 2))

def place(buf, t, sig, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N or i < 0: return
    s = sig[: N - i] * gain
    if s.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        buf[i:i + len(s), 0] += s * l * 1.414; buf[i:i + len(s), 1] += s * r * 1.414
    else:
        buf[i:i + len(s)] += s

def env_adsr(n, a, d, s_lvl, r):
    e = np.ones(n) * s_lvl
    ia, idd, ir = int(a * SR), int(d * SR), int(r * SR)
    ia = min(ia, n); e[:ia] = np.linspace(0, 1, ia)
    idd = min(idd, n - ia); e[ia:ia + idd] = np.linspace(1, s_lvl, idd)
    if ir > 0 and ir < n: e[-ir:] *= np.linspace(1, 0, ir)
    return e

def saw(freq, dur, harm=14, bright=1.0, detune=0.0):
    t = np.arange(int(dur * SR)) / SR
    out = np.zeros_like(t)
    for k in range(1, harm + 1):
        if freq * k > 9000: break
        out += np.sin(2 * np.pi * freq * k * (1 + detune) * t + k) / k * (bright ** (k - 1))
    return out

def bandnoise(dur, lo, hi):
    n = int(dur * SR); x = rng.standard_normal(n)
    X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    y = np.fft.irfft(X, n); return y / (np.abs(y).max() + 1e-9)

def midi(m): return 440 * 2 ** ((m - 69) / 12)

# ---------------- music ----------------
BPM = 120; beat = 60 / BPM; s16 = beat / 4; bar = beat * 4
# i - VI - iv - V in D minor; ostinato roots
prog = [(38, [50, 53, 57]), (34, [46, 50, 53]), (31, [43, 46, 50]), (33, [45, 49, 52])]

def intensity(t):
    # 0 quiet build, 1 driving, 0.4 tense drop (sniper), 1.2 full, end
    if t < T_PUNCH - 2.2: return 0.35 + 0.35 * t / max(1, T_PUNCH - 2.2)
    if t < T_PUNCH: return 0.0          # riser over silence
    sn = cuts[1] if len(cuts) > 1 else T_PUNCH + 8   # sniper shot start
    bs = cuts[2] if len(cuts) > 2 else sn + 3        # base shot start
    if t < sn: return 1.0
    if t < bs: return 0.45
    if t < T_END: return 1.15
    return 0.0

# string ostinato (16ths)
t = 0.0; step = 0
while t < T_END:
    I = intensity(t)
    if I > 0:
        root, chord = prog[int(t / bar) % 4]
        pat = [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 0, 12, 7, 12]
        m = root + 12 + pat[step % 16]
        acc = 1.0 if step % 4 == 0 else 0.7
        n = saw(midi(m), s16 * 1.3, harm=12, bright=0.62 + 0.15 * min(I, 1), detune=0.0)
        n *= env_adsr(len(n), 0.004, 0.09, 0.25, 0.04)
        place(music, t, n, 0.16 * I * acc, pan=-0.25 if step % 2 else 0.25)
    t += s16; step += 1

# sustained pad (low strings) for each bar while intensity
t = 0.0
while t < T_END:
    I = intensity(t)
    root, chord = prog[int(t / bar + 1e-6) % 4]
    if I > 0:
        for i, m in enumerate(chord):
            p = saw(midi(m), bar + 0.3, harm=8, bright=0.5, detune=0.002 * (i - 1))
            p *= env_adsr(len(p), 0.4, 0.5, 0.8, 0.5)
            place(music, t, p, 0.05 * I, pan=(i - 1) * 0.5)
        sub = np.sin(2 * np.pi * midi(root) * np.arange(int(bar * SR)) / SR) * env_adsr(int(bar * SR), 0.05, 0.3, 0.7, 0.3)
        place(music, t, sub, 0.22 * min(I, 1))
    t += bar

# drums: taiko-like hits
def taiko(gain=1.0, pitch=58):
    n = int(0.6 * SR); tt = np.arange(n) / SR
    f = pitch * (1 + 1.6 * np.exp(-tt * 30))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 7)
    slap = bandnoise(0.6, 200, 3000) * np.exp(-tt * 45) * 0.5
    return (body + slap) * gain

def snare_hit():
    n = int(0.25 * SR); tt = np.arange(n) / SR
    return bandnoise(0.25, 900, 8000) * np.exp(-tt * 22) * 0.6 + np.sin(2 * np.pi * 190 * tt) * np.exp(-tt * 30) * 0.4

TAIKO = taiko(); TAIKO_HI = taiko(0.8, 95); SN = snare_hit()
t = 0.0; b8 = 0
while t < T_END:
    I = intensity(t)
    pos = b8 % 16
    if I >= 0.9:
        if pos in (0, 3, 6, 8, 11, 14): place(music, t, TAIKO, 0.55, pan=0)
        if pos in (4, 12): place(music, t, SN, 0.32, pan=0.1)
        if pos in (7, 15): place(music, t, TAIKO_HI, 0.3, pan=-0.3)
    elif I >= 0.4 and I < 0.9 and t > T_PUNCH:
        if pos in (0, 8): place(music, t, TAIKO, 0.4)       # sparse heartbeat
    elif 0 < I < 0.9 and t < T_PUNCH and pos == 0:
        place(music, t, TAIKO, 0.35 * I + 0.1)
    t += beat / 2; b8 += 1
# tom fills into each cut
for c in cuts + [T_END]:
    for k in range(6):
        place(music, c - 0.75 + k * 0.125, taiko(0.5 + k * 0.08, 70 + k * 9), 0.45, pan=(k - 3) * 0.15)

# braam: huge low brass chord with opening filter
def braam(dur=2.6, root=26):
    n = int(dur * SR); tt = np.arange(n) / SR; out = np.zeros(n)
    for m, g in [(root, 1.0), (root + 12, 0.8), (root + 19, 0.5), (root + 24, 0.35)]:
        f0 = midi(m)
        for d in (-0.004, 0.0, 0.004):
            for k in range(1, 26):
                if f0 * k > 6000: break
                opening = np.clip((tt * 6) / (k ** 0.55), 0, 1) * np.exp(-tt * (0.6 + k * 0.05))
                out += np.sin(2 * np.pi * f0 * (1 + d) * k * tt + k * 1.3) / k * opening * g
    out *= env_adsr(n, 0.03, 0.3, 0.85, 0.9)
    return out / np.abs(out).max()

BRAAM = braam(); BRAAM_END = braam(4.0, 26)
for tb in cues.get("braam", []): place(music, tb, BRAAM, 0.55); place(send, tb, BRAAM, 0.25)
place(music, T_PUNCH, BRAAM, 0.75); place(send, T_PUNCH, BRAAM, 0.35)
place(music, T_END, BRAAM_END, 0.85); place(send, T_END, BRAAM_END, 0.5)
place(music, T_END, taiko(1.3, 45), 0.9)

# riser into the contact punch
rd = 2.2; n = int(rd * SR); tt = np.arange(n) / SR
riser = bandnoise(rd, 300, 9000) * (tt / rd) ** 2 * 0.5
riser += np.sin(2 * np.pi * np.cumsum(200 + 1400 * (tt / rd) ** 2) / SR) * (tt / rd) ** 3 * 0.35
place(music, T_PUNCH - rd - 0.12, riser, 0.5)
# whooshes on cuts
for c in cuts:
    wd = 0.5; n = int(wd * SR); tt = np.arange(n) / SR
    w = bandnoise(wd, 400, 5000) * np.sin(np.pi * tt / wd) ** 2
    place(sfx, c - 0.25, w, 0.25, pan=0)

# ---------------- SFX from the game log ----------------
def gunshot(deep=1.0):
    d = 0.18; n = int(d * SR); tt = np.arange(n) / SR
    crack = bandnoise(d, 1200, 9000) * np.exp(-tt * 60)
    body = bandnoise(d, 80 * deep, 900) * np.exp(-tt * 28) * 0.8
    thump = np.sin(2 * np.pi * 70 * deep * tt) * np.exp(-tt * 35) * 0.6
    return crack + body + thump

def explosion(d=1.0, size=1.0):
    n = int(d * SR); tt = np.arange(n) / SR
    rumble = bandnoise(d, 30, 600 + 600 * size) * np.exp(-tt * (5 / size))
    crack = bandnoise(d, 800, 7000) * np.exp(-tt * 18) * 0.6
    sub = np.sin(2 * np.pi * np.cumsum(55 + 60 * np.exp(-tt * 6)) / SR) * np.exp(-tt * (3.5 / size)) * 0.9
    return rumble + crack + sub

def stretch(sig, factor):  # factor > 1 = slower and lower
    idx = np.arange(0, len(sig), 1 / factor); return np.interp(idx, np.arange(len(sig)), sig)

GUN = [gunshot() for _ in range(6)]; GGUN = [gunshot(0.6) * 1.2 for _ in range(3)]
EXP_S = [explosion(0.9, 0.8) for _ in range(4)]; EXP_G = explosion(2.0, 1.6)
BEEP = np.concatenate([np.sin(2 * np.pi * 1320 * np.arange(int(0.05 * SR)) / SR), np.zeros(int(0.03 * SR)), np.sin(2 * np.pi * 1760 * np.arange(int(0.06 * SR)) / SR)]) * 0.5

for ev in data["log"]:
    t0 = ev["f"] / FPS
    slow = ev.get("slow", 0)
    zoom = min(1.6, max(0.6, ev.get("z", 1.5) / 2.0))  # closer camera = louder
    sf = 2.4 if slow else 1.0
    ns = min(ev["shots"], 4)
    for k in range(ns):
        g = GUN[rng.integers(len(GUN))]
        if slow: g = stretch(g, sf)
        place(sfx, t0 + rng.random() / FPS, g * (rng.random() * 0.4 + 0.6), 0.22 * zoom / (1 + 0.25 * ns), pan=rng.uniform(-0.7, 0.7))
    for k in range(min(ev["gshots"], 2)):
        g = GGUN[rng.integers(len(GGUN))]
        if slow: g = stretch(g, sf)
        place(sfx, t0, g, 0.42 * zoom, pan=rng.uniform(-0.3, 0.3)); place(send, t0, g, 0.12)
    if ev["turret"]: place(sfx, t0, stretch(GGUN[0], 1.4), 0.3 * zoom)
    for k in range(min(ev["deaths"], 3)):
        e = EXP_S[rng.integers(len(EXP_S))]
        if slow: e = stretch(e, 1.8)
        place(sfx, t0, e, 0.28 * zoom, pan=rng.uniform(-0.6, 0.6)); place(send, t0, e, 0.06)
    if ev["gdeaths"]: place(sfx, t0, EXP_G, 0.5); place(send, t0, EXP_G, 0.2)
    if ev["pings"]: place(sfx, t0, BEEP, 0.12 * ev["pings"])

if T_BOOM is not None:
    big = stretch(explosion(3.5, 3.0), 1.5)
    place(sfx, T_BOOM, big, 1.0); place(send, T_BOOM, big, 0.5)
    place(music, T_BOOM, BRAAM, 0.6)

# ---------------- reverb, ducking, master ----------------
ir_n = int(2.6 * SR); tt = np.arange(ir_n) / SR
ir = np.stack([rng.standard_normal(ir_n), rng.standard_normal(ir_n)], 1) * np.exp(-tt * 2.4)[:, None]
ir[: int(0.012 * SR)] = 0
L = N + ir_n; nfft = 1 << (L - 1).bit_length()
wet = np.zeros((N, 2))
src = send + music * 0.18
for ch in range(2):
    y = np.fft.irfft(np.fft.rfft(src[:, ch], nfft) * np.fft.rfft(ir[:, ch], nfft), nfft)[:N]
    wet[:, ch] = y
wet *= 0.9 / (np.abs(wet).max() + 1e-9) * 0.35

# duck music under big sfx
env = np.abs(sfx).max(1)
win = int(0.08 * SR); kern = np.ones(win) / win
envs = np.convolve(env, kern, mode="same")
duck = 1 / (1 + 2.0 * envs)
mix = music * duck[:, None] * 0.9 + sfx + wet
# fade out tail, soft clip, normalise
fo = int(0.6 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = np.tanh(mix * 1.4)
mix *= 0.89 / np.abs(mix).max()
pcm = (mix * 32767).astype(np.int16)
with wave.open(f"{SP}/trailer.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote", DUR, "s; punch", T_PUNCH, "boom", T_BOOM, "end", T_END, "cuts", cuts)
