#!/usr/bin/env python3
"""Synthesize Token Monster's 8-bit sound effects into sounds/.

Original sounds, made from scratch here: pulse and triangle waves and noise,
the way an old console's sound chip makes them. Python standard library only.

    python3 scripts/make-sounds.py            # writes sounds/*.wav
    python3 scripts/make-sounds.py --check    # prints duration, peak, DC offset, tail
    python3 scripts/make-sounds.py --png DIR  # also draws a waveform strip per sound

Every file is 16-bit mono at 22050 Hz, peaks at -3 dBFS and fades to silence.
"""

import math
import os
import random
import struct
import subprocess
import sys
import wave

RATE = 22050
PEAK = 10 ** (-3 / 20)  # -3 dBFS
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'sounds')

# Equal temperament from note names: n('C5') is 523.25 Hz.
NOTES = {'C': -9, 'C#': -8, 'D': -7, 'D#': -6, 'E': -5, 'F': -4, 'F#': -3, 'G': -2, 'G#': -1, 'A': 0, 'A#': 1, 'B': 2}


def n(name):
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((NOTES[pitch] + 12 * (octave - 4)) / 12)


# --- oscillators -----------------------------------------------------------


def blep(t, dt):
    """The polyBLEP correction that takes the alias hiss off a hard edge."""
    if t < dt:
        t /= dt
        return t + t - t * t - 1
    if t > 1 - dt:
        t = (t - 1) / dt
        return t * t + t + t + 1
    return 0.0


def pulse(phase, dt, duty):
    v = 1.0 if phase < duty else -1.0
    v += blep(phase, dt)
    v -= blep((phase - duty) % 1.0, dt)
    return v - (2 * duty - 1)  # a narrow pulse sits off center; put it back on zero


def triangle(phase, dt, _duty):
    # Sixteen steps, as the old chips had it: the slight grit is the point.
    v = 4 * abs(phase - 0.5) - 1
    return round(v * 7.5) / 7.5


class Noise:
    """Sample-and-hold noise, its pitch set by how often it changes value."""

    def __init__(self, seed):
        self.rng = random.Random(seed)
        self.value = 0.0

    def __call__(self, phase_wrapped):
        if phase_wrapped:
            self.value = self.rng.uniform(-1, 1)
        return self.value


def voice(dur, freq, amp, wave='pulse', duty=0.5, seed=1):
    """One voice for `dur` seconds: `freq` and `amp` are functions of time."""
    count = int(dur * RATE)
    out = [0.0] * count
    phase = 0.0
    noise = Noise(seed)
    for i in range(count):
        t = i / RATE
        f = max(1.0, freq(t))
        dt = min(0.5, f / RATE)
        if wave == 'noise':
            phase += dt
            wrapped = phase >= 1.0
            phase %= 1.0
            out[i] = noise(wrapped) * amp(t)
            continue
        if wave == 'pulse':
            d = duty(t) if callable(duty) else duty
            out[i] = pulse(phase, dt, d) * amp(t)
        else:
            out[i] = triangle(phase, dt, 0) * amp(t)
        phase = (phase + dt) % 1.0
    return out


# --- envelopes and pitch curves ---------------------------------------------


def env(dur, attack=0.004, release=0.03, sustain=1.0, decay=0.0):
    """Attack, an optional decay to `sustain`, then a release that ends at zero."""

    def amp(t):
        if t < 0 or t >= dur:
            return 0.0
        a = min(1.0, t / attack) if attack > 0 else 1.0
        if decay > 0:
            a *= sustain + (1 - sustain) * math.exp(-(t - attack) / decay) if t > attack else 1.0
        left = dur - t
        if left < release:
            a *= left / release
        return a

    return amp


def glide(f0, f1, dur, curve=1.0):
    """From f0 to f1 over dur, exponentially (as the ear hears pitch)."""
    return lambda t: f0 * (f1 / f0) ** (min(1.0, max(0.0, t / dur)) ** curve)


def vibrato(base, rate, depth):
    """`depth` in semitones either way."""
    return lambda t: base(t) * 2 ** (depth * math.sin(2 * math.pi * rate * t) / 12)


def const(v):
    return lambda t: v


def times(samples, k):
    return [s * k for s in samples]


# --- mixing ----------------------------------------------------------------


def mix(length, *parts):
    """Lay voices on one track: each part is (start seconds, samples)."""
    track = [0.0] * int(length * RATE)
    for start, samples in parts:
        at = int(start * RATE)
        for i, s in enumerate(samples):
            if at + i < len(track):
                track[at + i] += s
    return track


def finish(track):
    """DC blocker, a soft low-pass, -3 dBFS, then a fade at each end so nothing clicks."""
    out, x1, y1 = [], 0.0, 0.0
    for x in track:
        y1 = x - x1 + 0.995 * y1
        x1 = x
        out.append(y1)
    lp, y = [], 0.0
    k = 1 - math.exp(-2 * math.pi * 7000 / RATE)
    for x in out:
        y += k * (x - y)
        lp.append(y)
    mean = sum(lp) / len(lp)
    lp = [s - mean for s in lp]
    peak = max(abs(s) for s in lp) or 1.0
    lp = [s * PEAK / peak for s in lp]
    fade_in, fade_out = int(0.002 * RATE), int(0.012 * RATE)
    for i in range(fade_in):
        lp[i] *= i / fade_in
    for i in range(fade_out):
        lp[-1 - i] *= i / fade_out
    return lp


def write(name, track):
    path = os.path.join(OUT, name + '.wav')
    data = b''.join(struct.pack('<h', max(-32767, min(32767, int(round(s * 32767))))) for s in finish(track))
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(data)
    return path


# --- the sounds -------------------------------------------------------------


def chomp(variant):
    """A bite: a crunch of noise over a pulse that drops, 'nom'."""
    top, bottom, dur = [(520, 140, 0.085), (440, 120, 0.095), (600, 170, 0.075)][variant]
    bite = voice(dur, glide(top, bottom, dur), env(dur, 0.002, 0.03, 0.4, 0.03), 'pulse', 0.25)
    crunch = voice(0.035, const(5200 + 900 * variant), env(0.035, 0.001, 0.025), 'noise', seed=10 + variant)
    return mix(dur + 0.01, (0, bite), (0, times(crunch, 0.55)))


def gulp():
    """A big swallow: a throat drop, then a bubble rising back up."""
    down = voice(0.17, glide(700, 170, 0.17, 0.7), env(0.17, 0.004, 0.04), 'triangle')
    pulse_down = voice(0.17, glide(700, 170, 0.17, 0.7), env(0.17, 0.004, 0.05, 0.3, 0.05), 'pulse', 0.125)
    bubble = voice(0.11, glide(260, 900, 0.11, 1.6), env(0.11, 0.004, 0.05), 'pulse', 0.25)
    return mix(0.32, (0, down), (0, times(pulse_down, 0.35)), (0.19, times(bubble, 0.6)))


def burp():
    """A comical burp: a low, wobbling buzz that sags, with some air in it."""
    dur = 0.6
    shape = lambda t: (1 - math.exp(-t / 0.02)) * (0.7 + 0.3 * math.sin(2 * math.pi * 9 * t)) * env(dur, 0.01, 0.15)(t)
    base = vibrato(glide(140, 82, dur, 0.8), 17, 1.4)
    buzz = voice(dur, base, shape, 'pulse', lambda t: 0.35 + 0.1 * math.sin(2 * math.pi * 3 * t))
    body = voice(dur, base, shape, 'triangle')
    air = voice(dur, const(1800), env(dur, 0.01, 0.2, 0.25, 0.08), 'noise', seed=3)
    return mix(dur, (0, times(buzz, 0.7)), (0, times(body, 0.6)), (0, times(air, 0.1)))


COMBO_ROOTS = ['C5', 'D5', 'E5', 'G5', 'C6']


def combo(step):
    """A hit: a quick upward flick and a punch of noise, a step higher each time."""
    root = n(COMBO_ROOTS[step])
    dur = 0.13
    flick = voice(dur, glide(root * 0.75, root, 0.03), env(dur, 0.002, 0.06, 0.5, 0.04), 'pulse', 0.25)
    fifth = voice(0.07, const(root * 1.5), env(0.07, 0.002, 0.04), 'pulse', 0.125)
    punch = voice(0.04, const(3000), env(0.04, 0.001, 0.03), 'noise', seed=20 + step)
    return mix(0.15, (0, flick), (0.05, times(fifth, 0.45)), (0, times(punch, 0.5)))


def arpeggio(names, step, length, duty=0.25, bass=True, slide=1.0):
    """Notes one after another, each `step` seconds, with a triangle bass an octave down."""
    parts = []
    for i, name in enumerate(names):
        f = n(name)
        lead = voice(step + 0.02, glide(f, f * slide, step), env(step + 0.02, 0.003, 0.02), 'pulse', duty)
        parts.append((i * step, lead))
        if bass:
            parts.append((i * step, times(voice(step + 0.02, const(f / 2), env(step + 0.02, 0.003, 0.02), 'triangle'), 0.6)))
    return mix(length, *parts)


def power_up():
    return arpeggio(['C4', 'E4', 'G4', 'C5', 'E5', 'G5', 'C6', 'E6'], 0.045, 0.40)


def power_down():
    return arpeggio(['G5', 'E5', 'C5', 'G4', 'E4', 'C4'], 0.065, 0.42, duty=0.5, slide=0.94)


def cheer():
    """A tiny 'ta-da': two quick notes and a sparkle."""
    a = voice(0.08, const(n('E6')), env(0.08, 0.002, 0.04, 0.6, 0.03), 'pulse', 0.125)
    b = voice(0.17, const(n('A6')), env(0.17, 0.002, 0.11, 0.5, 0.05), 'pulse', 0.125)
    b2 = voice(0.17, const(n('A5')), env(0.17, 0.002, 0.11), 'triangle')
    return mix(0.26, (0, a), (0.075, b), (0.075, times(b2, 0.7)))


def whimper():
    """Two little sobs, the second longer and lower: hungry and sad."""
    sob1 = voice(0.16, vibrato(glide(n('A5'), n('E5'), 0.16), 7, 0.4), env(0.16, 0.02, 0.06), 'triangle')
    sob2 = voice(0.36, vibrato(glide(n('G5'), n('C5'), 0.36, 0.7), 6, 0.6), env(0.36, 0.03, 0.18), 'triangle')
    thin = voice(0.36, vibrato(glide(n('G5'), n('C5'), 0.36, 0.7), 6, 0.6), env(0.36, 0.03, 0.18), 'pulse', 0.125)
    return mix(0.6, (0, sob1), (0.22, sob2), (0.22, times(thin, 0.18)))


def error():
    """COUNTER: two harsh, detuned buzzes."""
    parts = []
    for start in (0, 0.13):
        for f in (98, 104):
            parts.append((start, voice(0.1, const(f), env(0.1, 0.003, 0.03), 'pulse', 0.5)))
        parts.append((start, times(voice(0.1, const(900), env(0.1, 0.002, 0.05), 'noise', seed=5), 0.3)))
    return mix(0.24, *parts)


def snore():
    """A soft snore: a breath in through the nose, a rattling rumble out, a tiny whistle."""
    breath_in = voice(0.25, const(1500), lambda t: math.sin(math.pi * t / 0.25) ** 2, 'noise', seed=7)
    swell = lambda t: math.sin(math.pi * t / 0.3) ** 1.5
    rattle = vibrato(glide(95, 78, 0.3), 26, 0.9)
    rumble = voice(0.3, rattle, swell, 'pulse', 0.3)
    body = voice(0.3, rattle, swell, 'triangle')
    whistle = voice(0.3, glide(n('E5'), n('C5'), 0.3), lambda t: math.sin(math.pi * t / 0.3) ** 2, 'triangle')
    return mix(0.62, (0, times(breath_in, 0.3)), (0.3, times(rumble, 0.35)), (0.3, body), (0.3, times(whistle, 0.15)))


def hello():
    """Hatching: a crack, then two rising chirps."""
    crack = voice(0.03, const(6000), env(0.03, 0.001, 0.02), 'noise', seed=9)
    chirp1 = voice(0.08, glide(1100, 1900, 0.08, 0.6), env(0.08, 0.003, 0.03), 'pulse', 0.25)
    chirp2 = voice(0.12, glide(1300, 2400, 0.12, 0.6), env(0.12, 0.003, 0.05), 'pulse', 0.25)
    under = voice(0.12, glide(650, 1200, 0.12, 0.6), env(0.12, 0.003, 0.05), 'triangle')
    return mix(0.34, (0, times(crack, 0.6)), (0.06, chirp1), (0.2, chirp2), (0.2, times(under, 0.5)))


SOUNDS = {
    'chomp-1': lambda: chomp(0),
    'chomp-2': lambda: chomp(1),
    'chomp-3': lambda: chomp(2),
    'gulp': gulp,
    'burp': burp,
    **{f'combo-{i + 1}': (lambda i=i: combo(i)) for i in range(len(COMBO_ROOTS))},
    'ko': lambda: ko(),
    'power-up': power_up,
    'power-down': power_down,
    'cheer': cheer,
    'whimper': whimper,
    'error': error,
    'snore': snore,
    'hello': hello,
}


def ko():
    """K.O.: a fast fanfare up to a held, shimmering top note."""
    run = arpeggio(['G4', 'C5', 'E5', 'G5'], 0.055, 0.24, duty=0.25)
    hold = 0.38
    top = voice(hold, vibrato(const(n('C6')), 7, 0.25), env(hold, 0.004, 0.16, 0.7, 0.1), 'pulse', 0.25)
    third = voice(hold, vibrato(const(n('E5')), 7, 0.25), env(hold, 0.004, 0.16, 0.7, 0.1), 'pulse', 0.5)
    bass = voice(hold, const(n('C4')), env(hold, 0.004, 0.16), 'triangle')
    return mix(0.62, (0, run), (0.22, top), (0.22, times(third, 0.35)), (0.22, times(bass, 0.8)))


# --- checking ---------------------------------------------------------------


def read(path):
    with wave.open(path, 'rb') as w:
        frames = w.readframes(w.getnframes())
        return [s[0] / 32768 for s in struct.iter_unpack('<h', frames)], w.getframerate()


def check(path):
    samples, rate = read(path)
    peak = max(abs(s) for s in samples)
    dc = sum(samples) / len(samples)
    tail = samples[-int(0.005 * rate):]
    tail_rms = math.sqrt(sum(s * s for s in tail) / len(tail))
    rms = math.sqrt(sum(s * s for s in samples) / len(samples))
    return {
        'rms_dbfs': 20 * math.log10(rms),
        'seconds': len(samples) / rate,
        'bytes': os.path.getsize(path),
        'peak_dbfs': 20 * math.log10(peak) if peak > 0 else -math.inf,
        'dc_percent': 100 * dc,
        'first': samples[0],
        'last': samples[-1],
        'tail_dbfs': 20 * math.log10(tail_rms) if tail_rms > 0 else -math.inf,
    }


def png(path, folder, width=600, height=120):
    """A waveform strip: min and max of each column, with a zero line."""
    samples, _ = read(path)
    rows = [[(18, 18, 24)] * width for _ in range(height)]
    mid = height // 2
    for x in range(width):
        rows[mid][x] = (70, 70, 90)
    per = max(1, len(samples) // width)
    for x in range(width):
        chunk = samples[x * per:(x + 1) * per] or [0.0]
        lo, hi = min(chunk), max(chunk)
        y0, y1 = int(mid - hi * (mid - 2)), int(mid - lo * (mid - 2))
        for y in range(max(0, y0), min(height, y1 + 1)):
            rows[y][x] = (120, 220, 140)
    # -3 dBFS guides
    for y in (int(mid - PEAK * (mid - 2)), int(mid + PEAK * (mid - 2))):
        for x in range(0, width, 4):
            rows[y][x] = (200, 90, 90)
    name = os.path.splitext(os.path.basename(path))[0]
    ppm = os.path.join(folder, name + '.ppm')
    with open(ppm, 'wb') as f:
        f.write(b'P6 %d %d 255\n' % (width, height))
        f.write(bytes(c for row in rows for px in row for c in px))
    out = os.path.join(folder, name + '.png')
    subprocess.run(['sips', '-s', 'format', 'png', ppm, '--out', out], check=True, capture_output=True)
    os.remove(ppm)
    return out


def main(argv):
    os.makedirs(OUT, exist_ok=True)
    if '--check' not in argv:
        for name, make in SOUNDS.items():
            write(name, make())
    folder = argv[argv.index('--png') + 1] if '--png' in argv else None
    print(f"{'sound':<12}{'secs':>6}{'bytes':>8}{'peak dBFS':>11}{'DC %':>8}{'tail dBFS':>11}{'RMS dBFS':>10}")
    for name in SOUNDS:
        path = os.path.join(OUT, name + '.wav')
        c = check(path)
        print(f"{name:<12}{c['seconds']:>6.2f}{c['bytes']:>8}{c['peak_dbfs']:>11.2f}{c['dc_percent']:>8.3f}{c['tail_dbfs']:>11.1f}{c['rms_dbfs']:>10.1f}")
        if folder:
            os.makedirs(folder, exist_ok=True)
            png(path, folder)


if __name__ == '__main__':
    main(sys.argv[1:])
