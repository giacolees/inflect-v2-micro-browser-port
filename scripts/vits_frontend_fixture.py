#!/usr/bin/env python3
# pyright: reportMissingImports=false
"""Record the exact upstream VITS frontend string and IDs for G2P evaluation."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "source" / "runtime"), str(ROOT / "source")]
import commons  # noqa: E402
from inflect_vits_frontend import run_vits_frontend  # noqa: E402
from text import cleaned_text_to_sequence  # noqa: E402

try:
    prompts = json.loads((ROOT / "fixtures" / "prompts.json").read_text())
except (OSError, json.JSONDecodeError) as exc:
    raise RuntimeError("could not load prompt fixture") from exc
rows = []
for prompt in prompts:
    output = run_vits_frontend(prompt["text"])
    ids = commons.intersperse(cleaned_text_to_sequence(output.phoneme_text), 0)
    rows.append({"id": prompt["id"], "normalized_text": output.normalized_text, "phoneme_text": output.phoneme_text, "ids": ids})
(ROOT / "fixtures" / "vits-frontend-fixture.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n")
print(f"VITS_FRONTEND_FIXTURE_OK cases={len(rows)}")
