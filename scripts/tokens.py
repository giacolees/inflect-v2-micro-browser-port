#!/usr/bin/env python3
# pyright: reportMissingImports=false
"""Record Python frontend token IDs used by the graph harness."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "source" / "runtime"), str(ROOT / "source")]
import commons  # noqa: E402
from inflect_vits_frontend import run_vits_frontend  # noqa: E402
from text import cleaned_text_to_sequence  # noqa: E402

rows = []
try:
    prompts = json.loads((ROOT / "fixtures" / "prompts.json").read_text())
except (OSError, json.JSONDecodeError) as exc:
    raise RuntimeError("could not load prompt fixture") from exc
for prompt in prompts:
    phonemes = run_vits_frontend(prompt["text"]).phoneme_text
    ids = commons.intersperse(cleaned_text_to_sequence(phonemes), 0)
    rows.append({"id": prompt["id"], "tokens": ids})
(ROOT / "fixtures" / "python-token-ids.json").write_text(json.dumps(rows, indent=2) + "\n")
print(f"TOKEN_FIXTURE_OK cases={len(rows)}")
