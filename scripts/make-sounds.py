#!/usr/bin/env python3
"""Synthesize Token Monster's one sound into sounds/: the call.

A soft two-note chime, played once when Claude starts waiting on you. Original,
made from scratch here out of sine partials that ring and fade like a small
bell. Python standard library only.

    python3 scripts/make-sounds.py            # writes sounds/call.wav
    python3 scripts/make-sounds.py --check    # prints its duration, peak, DC offset, tail

The file is 16-bit mono at 22050 Hz, peaks at -3 dBFS and fades to silence.
"""

import math
import os
import struct
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


def call():
    """Ding, dong: a high note, then a lower one that rings out a little longer."""
    ding, dong = bell(n('E6'), 0.5), bell(n('C6'), 0.94)
    track = [0.0] * int(1.1 * RATE)
    at = int(0.16 * RATE)
    for i, s in enumerate(ding):
        track[i] += s
    for i, s in enumerate(dong):
        track[at + i] += 0.9 * s
    return finish(track)


def main(argv):
    path = os.path.join(OUT, 'call.wav')
    if '--check' not in argv:
        os.makedirs(OUT, exist_ok=True)
        data = b''.join(struct.pack('<h', max(-32767, min(32767, int(round(s * 32767))))) for s in call())
        with wave.open(path, 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(RATE)
            w.writeframes(data)
    with wave.open(path, 'rb') as w:
        rate = w.getframerate()
        samples = [s[0] / 32768 for s in struct.iter_unpack('<h', w.readframes(w.getnframes()))]
    peak = max(abs(s) for s in samples)
    tail = samples[-int(0.005 * rate):]
    tail_rms = math.sqrt(sum(s * s for s in tail) / len(tail))
    print(f'call.wav: {len(samples) / rate:.2f} s, peak {20 * math.log10(peak):.2f} dBFS, DC {100 * sum(samples) / len(samples):.3f} %, tail {20 * math.log10(max(tail_rms, 1e-9)):.1f} dBFS')


if __name__ == '__main__':
    main(sys.argv[1:])
