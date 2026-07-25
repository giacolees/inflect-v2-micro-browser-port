#!/usr/bin/env python3
"""Diagnostic: execute padded core and dynamic decoder at two real lengths."""
from pathlib import Path
from typing import cast

import numpy as np
import onnxruntime as ort

MAX_TOKENS = 512
MAX_FRAMES = 4000
ROOT = Path(__file__).resolve().parents[1]
core = ort.InferenceSession(ROOT / "artifacts" / "inflect-core.onnx", providers=["CPUExecutionProvider"])
decoder = ort.InferenceSession(ROOT / "artifacts" / "inflect-decoder.onnx", providers=["CPUExecutionProvider"])
for length in (4, 8):
    tokens = np.zeros((1, MAX_TOKENS), dtype=np.int64)
    tokens[0, :length] = np.arange(length, dtype=np.int64)
    latent, frame_lengths = core.run(None, {"tokens": tokens, "lengths": np.array([length], dtype=np.int64), "latent_noise": np.zeros((1, 192, MAX_FRAMES), dtype=np.float32)})
    frames = int(cast(np.ndarray, frame_lengths)[0])
    waveform = cast(np.ndarray, decoder.run(None, {"latent": cast(np.ndarray, latent)[:, :, :frames]})[0])
    if not np.isfinite(waveform).all() or waveform.shape[2] != frames * 256:
        raise RuntimeError(f"invalid output for token length {length}")
    print(f"NATIVE_TWO_GRAPH_OK tokens={length} frames={frames} samples={waveform.shape[2]}")
