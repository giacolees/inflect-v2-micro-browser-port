#!/usr/bin/env python3
"""Validate both ONNX graphs and save their public interfaces."""
from collections import Counter
import json
from pathlib import Path

import onnx

root = Path(__file__).resolve().parents[1]
summaries = {}
for name in ("core", "decoder"):
    model = onnx.load(root / "artifacts" / f"inflect-{name}.onnx")
    onnx.checker.check_model(model)
    summaries[name] = {
        "nodes": len(model.graph.node),
        "operators": dict(sorted(Counter(node.op_type for node in model.graph.node).items())),
        "inputs": [value.name for value in model.graph.input],
        "outputs": [value.name for value in model.graph.output],
    }
(root / "fixtures" / "onnx-metadata.json").write_text(
    json.dumps(summaries, indent=2) + "\n"
)
print(f"ONNX_CHECKER_OK core={summaries['core']['nodes']} decoder={summaries['decoder']['nodes']}")
