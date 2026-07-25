#!/usr/bin/env python3
"""Diagnostic only: establish whether exported graph runs outside browser."""
from pathlib import Path
from typing import cast
import numpy as np
import onnxruntime as ort

root = Path(__file__).resolve().parents[1]
session = ort.InferenceSession(root / "artifacts" / "inflect-synthesis.onnx", providers=["CPUExecutionProvider"])
raw_result = session.run(None, {"tokens": np.array([[0, 1, 2, 3]], dtype=np.int64), "lengths": np.array([4], dtype=np.int64), "latent_noise": np.zeros((1, 192, 4000), dtype=np.float32)})[0]
result = cast(np.ndarray, raw_result)
print(result.shape, np.isfinite(result).all(), result.min(), result.max())
