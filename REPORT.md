# Feasibility report

## Decision: conditional **NO-GO**

The renderer-only technical path is feasible: eSpeak-compatible WASM phonemization, ONNX Runtime Web/WASM inference, WAV generation, chunk streaming, and an Obsidian Electron smoke run all work locally. This repository is **not** yet a production-ready Obsidian plugin. Do not claim listening quality, full Python behavioral equivalence, or offline plugin readiness.

## What is verified

- `ephone@1.0.2` browser frontend matches all six corpus fixtures for normalized text, phonemes, and blank-interspersed IDs.
- Fixed-width ONNX core (`[1,512]` IDs, `[1,192,4000]` latent noise) and dynamic decoder execute in Chromium ORT-Web/WASM.
- Padded Python core agrees with the unpadded reference for the recorded zero-noise case: latent max error `1.91e-06`, waveform max error `5.05e-08`.
- Native ORT and Chromium ORT-Web agree with identical frontend IDs and explicit zero noise: 68,096 samples, latent max error `3.34e-06`, waveform max error `1.19e-04`, RMSE `1.99e-06`, correlation `0.9999999995`.
- Completed chunks stream through Web Audio while later chunks synthesize. In the recorded Obsidian test, five chunks/361,600 samples produced first audio at `3.04 s` and completed at `11.54 s`.
- Obsidian `1.8.10` / Electron `34.2.0` completed the one-chunk renderer smoke test using ORT-Web/WASM. The renderer exposes Node `process`; the harness temporarily hides it while creating ORT sessions so ORT does not select an unavailable Node worker backend.
- Warm CPU comparison for the simple prompt: Python/PyTorch median `1082 ms`; native ONNX median `327 ms`. This is not a browser-performance claim.

## Deliberate browser-port differences

The browser path is not a drop-in implementation of `source/inference.py`. It uses eSpeak WASM rather than native eSpeak, a padded ONNX core plus separate decoder, JS seeded noise rather than PyTorch RNG, no public speed/variation controls, and Web Audio chunk scheduling. The only cross-runtime waveform claim is for explicit zero noise. See [docs/SOURCE_DIFFERENCES.md](docs/SOURCE_DIFFERENCES.md).

## Reproducibility and provenance

- Upstream: `owensong/Inflect-Micro-v2` `v2.0.0`, commit `9598ed6d37166d05df6260322012f6938ffe9141`.
- Weights: `model.pth`, SHA-256 `3eede065c9ccfa88ade0a5a9a5c23de34afcbbb32213e59aad44d5cf100fdee8`.
- Export: `PYTHONPATH=source:source/runtime .venv/bin/python scripts/export_onnx.py`, legacy TorchScript exporter, opset 18.
- Browser runtime: `onnxruntime-web@1.23.2`, WASM execution provider, one thread.

Large assets are intentionally ignored. The exact asset layout and verification commands are in [README.md](README.md); evidence details are in [docs/VERIFICATION.md](docs/VERIFICATION.md).

## Required for GO

1. Package all model/WASM/frontend assets inside a real plugin and prove network-disabled restart/replay.
2. Complete listening review for short, non-ASCII, punctuation-heavy, and long streamed text.
3. Define acceptance targets for latency, memory, cancellation, and supported Obsidian/Electron versions.
4. Preserve GPL-3.0-or-later compatibility, ephone/eSpeak notices, and corresponding-source/provenance obligations in any distribution.
