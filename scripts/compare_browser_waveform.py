#!/usr/bin/env python3
"""Compare native ORT and Chromium WebGPU for the custom zero-variation export."""
import json
from pathlib import Path
from typing import cast

import numpy as np
import onnxruntime as ort

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "artifacts" / "webgpu"
try:
    fixture = json.loads(
        (ROOT / "fixtures" / "vits-frontend-fixture.json").read_text()
    )[0]
except (OSError, IndexError, json.JSONDecodeError) as exc:
    raise RuntimeError("could not load VITS frontend fixture") from exc

if not (MODEL_DIR / "duration.onnx").exists():
    raise RuntimeError("run scripts/export_onnx_webgpu.py before comparison")

tokens = np.asarray(fixture["ids"], dtype=np.int64)[None, :]
duration = ort.InferenceSession(
    MODEL_DIR / "duration.onnx", providers=["CPUExecutionProvider"]
)
decoder = ort.InferenceSession(
    MODEL_DIR / "decode.onnx", providers=["CPUExecutionProvider"]
)
means, logs, mask = cast(
    tuple[np.ndarray, np.ndarray, np.ndarray],
    duration.run(
        None,
        {
            "tokens": tokens,
            "lengths": np.asarray([tokens.shape[1]], dtype=np.int64),
            "length_scale": np.asarray(1, dtype=np.float32),
        },
    ),
)
native = cast(
    np.ndarray,
    decoder.run(
        None,
        {
            "m_p_exp": means,
            "logs_p_exp": logs,
            "y_mask": mask,
            "zp_noise": np.zeros_like(means),
            "noise_scale": np.asarray(0, dtype=np.float32),
        },
    )[0],
).reshape(-1)
browser = np.fromfile(
    ROOT / "artifacts" / "browser-zero-noise.f32", dtype=np.float32
)
if native.shape != browser.shape:
    raise RuntimeError(f"shape mismatch: native={native.shape} browser={browser.shape}")
delta = native.astype(np.float64) - browser.astype(np.float64)
try:
    summary = {
        "samples": int(native.size),
        "max_abs_error": float(np.abs(delta).max()),
        "rmse": float(np.sqrt(np.mean(delta**2))),
        "correlation": float(np.corrcoef(native, browser)[0, 1]),
    }
except (FloatingPointError, TypeError, ValueError) as exc:
    raise RuntimeError("could not compute WebGPU/native metrics") from exc
print(f"WEBGPU_NATIVE_COMPARISON_OK {json.dumps(summary)}")
