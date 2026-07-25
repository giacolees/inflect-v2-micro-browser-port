# Inflect Micro v2 browser-port feasibility proof

This is an isolated feasibility workspace, not an Obsidian plugin integration. It evaluates the `v2.0.0` Hugging Face release of `owensong/Inflect-Micro-v2` in a real Chromium renderer using ONNX Runtime Web/WASM.

**Result: NO-GO.** See [REPORT.md](REPORT.md). The exported graph passes ONNX validation but fails in Chromium's ORT Web/WASM runtime. The source frontend also depends on native eSpeak-NG and was not reproduced/validated in a browser.

## Reproduce

1. Use Python 3.11 and install `source/requirements-tested.txt`, plus `onnx==1.19.1` and `onnxruntime==1.23.2`.
2. Download the tagged `model.pth` into both `artifacts/model.pth` and `source/model.pth` (SHA-256 `3eede065c9ccfa88ade0a5a9a5c23de34afcbbb32213e59aad44d5cf100fdee8`). It is intentionally ignored.
3. Run `PYTHONPATH=source:source/runtime .venv/bin/python scripts/baseline.py`, `scripts/tokens.py`, and `scripts/export_onnx.py`; copy `artifacts/inflect-synthesis.onnx` to `browser/inflect-synthesis.onnx`.
4. Run `npm ci` and then `npm run verify-browser-port`.

The verification intentionally exits successfully only when it confirms the recorded **NO-GO** evidence. It runs ONNX checker and WAV validation, then confirms that real headless Google Chrome cannot execute the model through `onnxruntime-web` WASM. It never uses `onnxruntime-node` as evidence.

## Assets and notices

Large model and ONNX artifacts are excluded by `.gitignore`; retain them in a local cache or publish them separately with checksums. This workspace carries upstream `LICENSE`, `THIRD_PARTY_NOTICES.md`, and the relevant notices under `source/third_party/` and `source/runtime/text/LICENSE`.
