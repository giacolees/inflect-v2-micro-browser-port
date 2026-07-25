#!/usr/bin/env python3
"""Compare native ONNX and Chromium ORT-Web for identical IDs and zero noise."""
import json
from pathlib import Path
from typing import cast

import numpy as np
import onnxruntime as ort

ROOT = Path(__file__).resolve().parents[1]
MAX_TOKENS, MAX_FRAMES = 512, 4000
try:
    fixture = json.loads((ROOT / "fixtures" / "vits-frontend-fixture.json").read_text())[0]
except (OSError, IndexError, json.JSONDecodeError) as exc:
    raise RuntimeError("could not load VITS frontend fixture") from exc
tokens = np.zeros((1, MAX_TOKENS), dtype=np.int64)
tokens[0, : len(fixture["ids"])] = fixture["ids"]
core = ort.InferenceSession(ROOT / "artifacts" / "inflect-core.onnx", providers=["CPUExecutionProvider"])
decoder = ort.InferenceSession(ROOT / "artifacts" / "inflect-decoder.onnx", providers=["CPUExecutionProvider"])
raw_latent, raw_lengths = core.run(None, {"tokens": tokens, "lengths": np.array([len(fixture["ids"])], dtype=np.int64), "latent_noise": np.zeros((1, 192, MAX_FRAMES), dtype=np.float32)})
latent, lengths = cast(np.ndarray, raw_latent), cast(np.ndarray, raw_lengths)
try:
    frames = int(lengths[0])
except (IndexError, TypeError, ValueError) as exc:
    raise RuntimeError("native ONNX returned invalid frame length") from exc
native = cast(np.ndarray, decoder.run(None, {"latent": latent[:, :, :frames]})[0]).reshape(-1).astype(np.float32)
browser = np.fromfile(ROOT / "artifacts" / "browser-zero-noise.f32", dtype=np.float32)
latent.astype(np.float32).tofile(ROOT / "artifacts" / "native-zero-noise-latent.f32")
browser_latent = np.fromfile(ROOT / "artifacts" / "browser-zero-noise-latent.f32", dtype=np.float32)
latent_prefix = latent[:, :, :frames].reshape(-1)
if latent_prefix.shape != browser_latent.shape:
    raise RuntimeError(f"latent shape mismatch: native={latent_prefix.shape} browser={browser_latent.shape}")
if native.shape != browser.shape:
    raise RuntimeError(f"shape mismatch: native={native.shape} browser={browser.shape}")
delta = native.astype(np.float64) - browser.astype(np.float64)
try:
    summary = {"samples": int(native.size), "frames": frames, "max_abs_error": float(np.abs(delta).max()), "rmse": float(np.sqrt(np.mean(delta ** 2))), "correlation": float(np.corrcoef(native, browser)[0, 1]), "latent_max_abs_error": float(np.abs(latent_prefix - browser_latent).max()), "latent_correlation": float(np.corrcoef(latent_prefix, browser_latent)[0, 1]), "native_range": [float(native.min()), float(native.max())], "browser_range": [float(browser.min()), float(browser.max())]}
except (FloatingPointError, TypeError, ValueError) as exc:
    raise RuntimeError("could not compute browser/native metrics") from exc
(ROOT / "fixtures" / "browser-native-zero-noise-comparison.json").write_text(json.dumps(summary, indent=2) + "\n")
print(f"BROWSER_NATIVE_COMPARISON_OK {json.dumps(summary)}")
