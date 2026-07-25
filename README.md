# Inflect Micro v2 browser-port feasibility proof

This is an isolated feasibility workspace, not an Obsidian plugin integration. It evaluates the `v2.0.0` Hugging Face release of `owensong/Inflect-Micro-v2` in a real Chromium renderer using ONNX Runtime Web/WASM.

**Result: NO-GO.** See [REPORT.md](REPORT.md). A fixed 512-token padded core plus a dynamic, duration-trimmed decoder run in Chromium's ORT Web/WASM runtime. The source frontend still depends on native eSpeak-NG and has not been reproduced/validated in a browser.

## Reproduce

1. Use Python 3.11 and install `source/requirements-tested.txt`, plus `onnx==1.19.1` and `onnxruntime==1.23.2`.
2. Download the tagged `model.pth` into both `artifacts/model.pth` and `source/model.pth` (SHA-256 `3eede065c9ccfa88ade0a5a9a5c23de34afcbbb32213e59aad44d5cf100fdee8`). It is intentionally ignored.
3. Run `PYTHONPATH=source:source/runtime .venv/bin/python scripts/baseline.py`, `scripts/tokens.py`, and `scripts/export_onnx.py`; copy `artifacts/inflect-core.onnx` and `artifacts/inflect-decoder.onnx` to `browser/`.
4. Run `npm ci` and then `npm run verify-browser-port`.

The verification runs ONNX checker, WAV validation, native four/eight-token two-graph tests, padding parity, and a real headless Google Chrome ORT-Web/WASM smoke run. It remains a **NO-GO** until the browser text frontend and corpus-level parity are validated. It never uses `onnxruntime-node` as browser evidence.

## Assets and notices

Large model and ONNX artifacts are excluded by `.gitignore`; retain them in a local cache or publish them separately with checksums. This workspace carries upstream `LICENSE`, `THIRD_PARTY_NOTICES.md`, and the relevant notices under `source/third_party/` and `source/runtime/text/LICENSE`.
