#!/usr/bin/env python3
# pyright: reportMissingImports=false
"""Generate deterministic Python baseline audio and frontend records."""
import json
import sys
from dataclasses import asdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "source"))
from inference import InflectTTS  # noqa: E402
from inflect_nano_v2_frontend import run_frontend  # noqa: E402

out = ROOT / "artifacts" / "python-baseline"
out.mkdir(parents=True, exist_ok=True)
engine = InflectTTS(ROOT / "source")
records = []
try:
    prompts = json.loads((ROOT / "fixtures" / "prompts.json").read_text())
except (OSError, json.JSONDecodeError) as exc:
    raise RuntimeError("could not load prompt fixture") from exc
for prompt in prompts:
    frontend = asdict(run_frontend(prompt["text"]))
    rate, waveform = engine.synthesize(prompt["text"], seed=0, variation=0.667)
    wav = out / f'{prompt["id"]}.wav'
    engine.save(prompt["text"], wav, seed=0, variation=0.667)
    try:
        minimum, maximum = float(waveform.min()), float(waveform.max())
    except (TypeError, ValueError) as exc:
        raise RuntimeError(f'could not summarize {prompt["id"]}') from exc
    try:
        records.append({"id": prompt["id"], "sample_rate": rate, "samples": int(waveform.size),
                        "minimum": minimum, "maximum": maximum, "frontend": frontend})
    except (MemoryError, TypeError) as exc:
        raise RuntimeError(f'could not record {prompt["id"]}') from exc
(out / "metadata.json").write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n")
print(f"PYTHON_BASELINE_OK cases={len(records)} rate={engine.sample_rate}")
