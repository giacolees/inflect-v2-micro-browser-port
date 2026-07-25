#!/usr/bin/env python3
"""Run the browser's documented seed-0 noise contract through native ONNX."""
import json
import math
from pathlib import Path
from typing import cast

import numpy as np
import onnxruntime as ort

ROOT = Path(__file__).resolve().parents[1]
MAX_TOKENS, MAX_FRAMES, CHANNELS = 512, 4000, 192

def mulberry32(seed: int):
    state = seed & 0xFFFFFFFF
    while True:
        state = (state + 0x6D2B79F5) & 0xFFFFFFFF
        value = state
        value = ((value ^ (value >> 15)) * (value | 1)) & 0xFFFFFFFF
        value ^= (value + (((value ^ (value >> 7)) * (value | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        yield ((value ^ (value >> 14)) & 0xFFFFFFFF) / 4294967296

def noise(seed: int) -> np.ndarray:
    random = mulberry32(seed)
    output = np.empty(CHANNELS * MAX_FRAMES, dtype=np.float32)
    for index in range(0, output.size, 2):
        radius = math.sqrt(-2 * math.log(max(next(random), float.fromhex("0x1.0p-1022"))))
        angle = 2 * math.pi * next(random)
        output[index] = radius * math.cos(angle)
        if index + 1 < output.size:
            output[index + 1] = radius * math.sin(angle)
    return output.reshape(1, CHANNELS, MAX_FRAMES)

try:
    fixture = json.loads((ROOT / "fixtures" / "vits-frontend-fixture.json").read_text())
except (OSError, json.JSONDecodeError) as exc:
    raise RuntimeError("could not load VITS fixture") from exc
ids = np.zeros((1, MAX_TOKENS), dtype=np.int64)
ids[0, : len(fixture[0]["ids"])] = fixture[0]["ids"]
core = ort.InferenceSession(ROOT / "artifacts" / "inflect-core.onnx", providers=["CPUExecutionProvider"])
decoder = ort.InferenceSession(ROOT / "artifacts" / "inflect-decoder.onnx", providers=["CPUExecutionProvider"])
raw_latent, raw_frame_lengths = core.run(None, {"tokens": ids, "lengths": np.array([len(fixture[0]["ids"])], dtype=np.int64), "latent_noise": noise(0)})
latent = cast(np.ndarray, raw_latent)
frame_lengths = cast(np.ndarray, raw_frame_lengths)
try:
    frames = int(frame_lengths[0])
    raw_waveform = decoder.run(None, {"latent": latent[:, :, :frames]})[0]
    waveform = cast(np.ndarray, raw_waveform).reshape(-1)
except (IndexError, TypeError, ValueError) as exc:
    raise RuntimeError("native ONNX produced invalid shared-noise output") from exc
try:
    summary = {"frames": frames, "samples": int(waveform.size), "min": float(waveform.min()), "max": float(waveform.max()), "sum": float(waveform.sum(dtype=np.float64)), "sumSquares": float(np.square(waveform, dtype=np.float32).sum(dtype=np.float64))}
except (FloatingPointError, TypeError, ValueError) as exc:
    raise RuntimeError("could not summarize native shared-noise output") from exc
(ROOT / "fixtures" / "shared-noise-native.json").write_text(json.dumps(summary, indent=2) + "\n")
print(f"SHARED_NOISE_NATIVE_OK {json.dumps(summary)}")
