#!/usr/bin/env python3
"""Warm CPU throughput comparison for the Python and native ONNX paths."""
import statistics
import sys
import time
from pathlib import Path
from typing import cast

import numpy as np
import onnxruntime as ort

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "source"), str(ROOT / "source" / "runtime")]
from inference import InflectTTS  # noqa: E402

TEXT = "The quick brown fox jumps over the lazy dog."
RUNS = 3
MAX_TOKENS = 512
MAX_FRAMES = 4000
CHANNELS = 192


def median_ms(samples: list[float]) -> float:
    return statistics.median(samples) * 1000


def frame_count(frame_lengths: np.ndarray) -> int:
    try:
        return int(frame_lengths.reshape(-1)[0])
    except (IndexError, TypeError, ValueError) as exc:
        raise RuntimeError("ONNX core returned no valid frame length") from exc


def main() -> None:
    engine = InflectTTS(ROOT / "source")
    tokens, lengths = engine._tokens(TEXT)
    ids = np.zeros((1, MAX_TOKENS), dtype=np.int64)
    ids[0, : lengths.item()] = tokens.cpu().numpy()[0]
    core = ort.InferenceSession(ROOT / "artifacts" / "inflect-core.onnx", providers=["CPUExecutionProvider"])
    decoder = ort.InferenceSession(ROOT / "artifacts" / "inflect-decoder.onnx", providers=["CPUExecutionProvider"])

    # Warm both paths outside the measured runs.
    engine.synthesize(TEXT, seed=0)
    noise = np.zeros((1, CHANNELS, MAX_FRAMES), dtype=np.float32)
    latent, frame_lengths = cast(tuple[np.ndarray, np.ndarray], core.run(None, {"tokens": ids, "lengths": np.array([lengths.item()], dtype=np.int64), "latent_noise": noise}))
    frames = frame_count(frame_lengths)
    decoder.run(None, {"latent": latent[:, :, :frames]})

    python_times, onnx_times = [], []
    python_samples = onnx_samples = 0
    for _ in range(RUNS):
        started = time.perf_counter()
        _, waveform = engine.synthesize(TEXT, seed=0)
        python_times.append(time.perf_counter() - started)
        python_samples = waveform.size
        started = time.perf_counter()
        latent, frame_lengths = cast(tuple[np.ndarray, np.ndarray], core.run(None, {"tokens": ids, "lengths": np.array([lengths.item()], dtype=np.int64), "latent_noise": noise}))
        frames = frame_count(frame_lengths)
        waveform = cast(np.ndarray, decoder.run(None, {"latent": latent[:, :, :frames]})[0])
        onnx_times.append(time.perf_counter() - started)
        onnx_samples = waveform.size
    python_ms, onnx_ms = median_ms(python_times), median_ms(onnx_times)
    print("PYTHON_ONNX_BENCHMARK", {"runs": RUNS, "text": TEXT, "python_median_ms": round(python_ms, 2), "onnx_median_ms": round(onnx_ms, 2), "onnx_speedup": round(python_ms / onnx_ms, 2), "python_samples": python_samples, "onnx_samples": onnx_samples})


if __name__ == "__main__":
    main()
