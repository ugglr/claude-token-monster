#!/usr/bin/env python3
"""Synthesize Token Monster's one sound into sounds/: the call.

A soft two-note chime, played once when Claude starts waiting on you. Original,
made from scratch here out of sine partials that ring and fade like a small
bell. Python standard library only.

    python3 scripts/make-sounds.py            # writes sounds/call.wav
    python3 scripts/make-sounds.py --check    # prints duration, peak, DC offset, tail
    python3 scripts/make-sounds.py --png DIR  # also draws its waveform strip

The file is 16-bit mono at 22050 Hz, peaks at -3 dBFS and fades to silence.
"""

import math
import os
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


def bell(freq, dur):
    """One soft strike: a sine with a quiet octave and twelfth, each fading on its own."""
    partials = [(1, 1.0, 0.45), (2, 0.18, 0.2), (3, 0.06, 0.12)]
    out = []
    for i in range(int(dur * RATE)):
        t = i / RATE
        attack = min(1.0, t / 0.012)
        out.append(attack * sum(a * math.exp(-t / decay) * math.sin(2 * math.pi * freq * k * t) for k, a, decay in partials))
    return out


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
    k = 1 - math.exp(-2 * math.pi * 5000 / RATE)
    for x in out:
        y += k * (x - y)
        lp.append(y)
    mean = sum(lp) / len(lp)
    lp = [s - mean for s in lp]
    peak = max(abs(s) for s in lp) or 1.0
    lp = [s * PEAK / peak for s in lp]
    fade_in, fade_out = int(0.002 * RATE), int(0.05 * RATE)
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


def call():
    """Ding, dong: a high note, then a lower one that rings out a little longer."""
    return mix(1.1, (0, bell(n('E6'), 0.5)), (0.16, [s * 0.9 for s in bell(n('C6'), 0.94)]))


SOUNDS = {'call': call}


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
