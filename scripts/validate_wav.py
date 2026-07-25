#!/usr/bin/env python3
import json
from pathlib import Path
import numpy as np
import soundfile as sf

root = Path(__file__).resolve().parents[1]
rows = []
for path in sorted((root / "artifacts" / "python-baseline").glob("*.wav")):
    waveform, rate = sf.read(path, dtype="float32", always_2d=False)
    valid = rate == 24000 and waveform.ndim == 1 and waveform.size > 0 and np.isfinite(waveform).all() and np.abs(waveform).max() <= 1.00001
    if not valid: raise RuntimeError(f"invalid WAV: {path}")
    try:
        minimum, maximum = float(waveform.min()), float(waveform.max())
    except (TypeError, ValueError) as exc:
        raise RuntimeError(f"could not summarize WAV: {path}") from exc
    try:
        rows.append({"file": path.name, "sample_rate": rate, "samples": int(waveform.size), "min": minimum, "max": maximum})
    except (MemoryError, TypeError) as exc:
        raise RuntimeError(f"could not record WAV summary: {path}") from exc
(root / "fixtures" / "wav-validation.json").write_text(json.dumps(rows, indent=2) + "\n")
print(f"WAV_VALIDATION_OK cases={len(rows)} rate=24000 mono=float32")
