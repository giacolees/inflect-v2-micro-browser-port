#!/usr/bin/env python3
from collections import Counter
from pathlib import Path
import json
import onnx

root = Path(__file__).resolve().parents[1]
model = onnx.load(root / "artifacts" / "inflect-synthesis.onnx")
onnx.checker.check_model(model)
summary = {"nodes": len(model.graph.node), "operators": dict(sorted(Counter(n.op_type for n in model.graph.node).items())),
           "inputs": [i.name for i in model.graph.input], "outputs": [o.name for o in model.graph.output]}
(root / "fixtures" / "onnx-metadata.json").write_text(json.dumps(summary, indent=2) + "\n")
print(f"ONNX_CHECKER_OK nodes={summary['nodes']}")
