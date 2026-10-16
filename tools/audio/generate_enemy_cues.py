"""Generate original, restrained Block 13 enemy cue masters (48 kHz mono PCM)."""
from __future__ import annotations

import math
import random
import struct
import wave
from pathlib import Path

RATE = 48_000
ROOT = Path(__file__).resolve().parents[2]
MASTER = ROOT / "docs/audio/masters/enemies"


def synth(name: str, duration: float, seed: int, layers, peak: float = 0.38):
    count = round(duration * RATE)
    rng = random.Random(seed)
    noise = [rng.uniform(-1, 1) for _ in range(count)]
    # A lightly smoothed noise bed makes the noises feel textured rather than static.
    filtered = [0.0] * count
    prev = 0.0
    for i, sample in enumerate(noise):
        prev = prev * 0.82 + sample * 0.18
        filtered[i] = prev
    data = []
    for i in range(count):
        t = i / RATE
        value = 0.0
        for layer in layers:
            kind = layer[0]
            if kind == "tone":
                _, freq, amp, decay, bend, phase = layer
                f = freq + bend * t
                env = math.exp(-decay * t)
                value += amp * env * math.sin(2 * math.pi * f * t + phase)
            elif kind == "noise":
                _, amp, decay, start, end, filtered_noise = layer
                x = (t - start) / max(0.0001, end - start)
                env = max(0.0, min(1.0, x))
                env = math.sin(env * math.pi) ** 1.5
                env *= math.exp(-decay * max(0.0, t - start))
                value += amp * env * (filtered[i] if filtered_noise else noise[i])
            elif kind == "pulse":
                _, freq, amp, decay, rate, phase = layer
                env = math.exp(-decay * t) * (0.5 + 0.5 * math.sin(2 * math.pi * rate * t + phase))
                value += amp * env * math.sin(2 * math.pi * freq * t)
        # Attack/release shaping avoids clicks and leaves a little clean headroom.
        fade_in = min(1.0, t / 0.008)
        fade_out = min(1.0, max(0.0, (duration - t) / 0.045))
        data.append(value * fade_in * fade_out)
    absolute_peak = max(abs(v) for v in data) or 1.0
    scale = peak / absolute_peak
    path = MASTER / f"{name}.wav"
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(3)
        out.setframerate(RATE)
        raw = bytearray()
        for sample in data:
            integer = max(-8_388_608, min(8_388_607, round(sample * scale * 8_388_607)))
            raw.extend(struct.pack("<i", integer)[:3])
        out.writeframes(raw)
    print(f"{path.relative_to(ROOT)} {duration:.3f}s peak={peak:.2f}")


def main():
    synth("sfx_watcher_presence", 0.78, 1301, [
        ("tone", 734, 0.35, 3.5, -170, 0.2), ("tone", 1101, 0.15, 5, -260, 1.1),
        ("noise", 0.08, 3, 0.04, 0.68, True), ("pulse", 196, 0.12, 5, 7.2, 0.6),
    ], 0.21)
    synth("sfx_watcher_vanish", 0.46, 1302, [
        ("tone", 520, 0.24, 5.8, -680, 0.0), ("tone", 780, 0.12, 7, -900, 0.4),
        ("noise", 0.08, 9, 0.02, 0.4, True),
    ], 0.18)
    synth("sfx_watcher_gaze", 0.38, 1303, [
        ("tone", 1420, 0.18, 13, -480, 0.1), ("tone", 2130, 0.08, 17, -720, 0.7),
        ("noise", 0.045, 17, 0.02, 0.32, True),
    ], 0.12)
    for suffix, seed, shift in [("1", 2201, 0), ("2", 2202, 1)]:
        synth(f"sfx_crawler_skitter_{suffix}", 0.34, seed, [
            ("noise", 0.30, 14, 0.015, 0.32, False),
            ("tone", 760 + shift * 90, 0.18, 14, -220, 0.3 + shift),
            ("pulse", 120, 0.12, 8, 15 + shift * 2, 0.4),
        ], 0.28)
    synth("sfx_mimic_reveal", 0.63, 3301, [
        ("tone", 288, 0.25, 3.4, 410, 2.2), ("tone", 431, 0.17, 4.8, -230, 0.8),
        ("tone", 73, 0.12, 11, 90, 0.2), ("noise", 0.17, 4, 0.05, 0.56, True),
    ], 0.30)
    # Quiet two-part anticipatory metal resonance; materially softer than the impact sting.
    synth("sfx_ambusher_warning", 0.72, 4401, [
        ("tone", 612, 0.22, 2.1, -28, 0.0), ("tone", 617, 0.19, 2.8, -50, 0.25),
        ("tone", 923, 0.10, 3.7, -80, 0.7), ("noise", 0.045, 8, 0.22, 0.7, True),
    ], 0.15)
    synth("sfx_stalker_presence", 0.82, 5501, [
        ("tone", 118, 0.24, 1.7, -36, 0.1), ("tone", 177, 0.14, 2.4, -68, 1.2),
        ("noise", 0.12, 3.5, 0.08, 0.74, True), ("pulse", 246, 0.08, 2.7, 3.1, 0.0),
    ], 0.24)


if __name__ == "__main__":
    main()
