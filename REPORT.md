# Inflect Micro v2 browser-port feasibility report

## Decision: **NO-GO**

Do not integrate Inflect Micro v2 into the Obsidian plugin. A deterministic, single-graph ONNX export passes `onnx.checker` and a fixed four-token smoke case now executes in actual Chromium through ONNX Runtime Web/WASM. However, the legacy export captures the traced token length, so it fails for a different token count; it also decodes all 4,000 frames. It is not a practical variable-length TTS graph. The exact upstream frontend also relies on Python plus native eSpeak-NG and has no validated browser-equivalent. Either production gap fails the acceptance gates.

## Reproducibility

| Item | Value |
| --- | --- |
| Upstream | `owensong/Inflect-Micro-v2` tag `v2.0.0`, commit `9598ed6d37166d05df6260322012f6938ffe9141` (annotated tag object `ff40219f68ccacb8fba4a24fa77ccb53614bf107`) |
| Weights | `model.pth`, 37,529,995 bytes, SHA-256 `3eede065c9ccfa88ade0a5a9a5c23de34afcbbb32213e59aad44d5cf100fdee8` |
| Host | macOS 26.3 (25D125), MacBookPro18,3, Apple M1 Pro, 16 GB |
| Python / PyTorch | CPython 3.11 / torch 2.10.0 |
| ONNX / ORT diagnostic | onnx 1.19.1 / onnxruntime 1.23.2 |
| Renderer | Google Chrome 150.0.7871.184 headless via Playwright Core 1.55.0 |
| Browser runtime | `onnxruntime-web` 1.23.2, `wasm` execution provider, one thread |
| Export | `PYTHONPATH=source:source/runtime .venv/bin/python scripts/export_onnx.py`; legacy `torch.onnx.export`, opset 18 |

All large inputs and generated artifacts are ignored. `README.md` documents their local-cache locations and checksum. `npm run verify-browser-port` is the one-command evidence check once those assets are present.

## Architecture and deterministic export

The upstream public API normalizes text, eSpeak-NG phonemizes it, maps symbols to IDs, inserts blank ID `0`, predicts durations, expands the prior, samples a 192-channel latent, reverses a four-flow residual coupling block, then invokes a HiFi-GAN/VITS-family decoder. The model is one fixed English male voice and emits 24,000 Hz mono float32.

`scripts/export_onnx.py` wraps that path as one graph:

| Input/output | Type and shape |
| --- | --- |
| `tokens` | `int64`, nominally `[1, token_count]`, but only the traced length of 4 works |
| `lengths` | `int64`, `[batch]` |
| `latent_noise` | `float32`, `[1, 192, 4000]` |
| `waveform` | `float32`, `[1, 1, samples]` |

The maximum frame length is explicit (`4000`), as is the latent noise input. This removes runtime-hidden random sampling; a caller can generate a seeded normal tensor outside the graph. Speed is fixed at 1.0 and variation is represented by the scale of `latent_noise`. The graph contains 2,169 nodes; relevant dynamic operators include `Shape`, `Range`, `CumSum`, `Ceil`, `Less`, `Where`, `Gather`, `Reshape`, and `Slice`, as well as `LayerNormalization`, `ConvTranspose`, and attention matmuls. `onnx.checker` succeeds; machine-readable graph metadata is `fixtures/onnx-metadata.json`. The TorchScript tracer captured attention reshape constants for the four-token dummy input: an eight-token input fails even in native ORT with a requested reshape `[1,2,128]` for an input `[1,2,8,4]`. The decoder also produces the full 1,024,000 samples for its 4,000-frame input rather than trimming at the predicted duration.

## Frontend and licensing

The source frontend is `source/inflect_nano_v2_frontend.py`: regex/`num2words` normalization followed by `phonemizer`'s `EspeakBackend` and native eSpeak-NG library/data. The corpus in `fixtures/prompts.json` covers prose, punctuation, numbers, abbreviations, non-ASCII names, and long text. Python frontend records and corresponding ID vectors are retained in `fixtures/python-baseline-metadata.json` and `fixtures/python-token-ids.json`.

These vectors are **test fixtures only**, not a browser frontend. No browser-safe exact/equivalent eSpeak-NG implementation was carried or validated, so frontend parity is blocked. The upstream package is Apache-2.0; this workspace preserves `LICENSE`, `THIRD_PARTY_NOTICES.md`, `source/runtime/text/LICENSE`, and the upstream third-party notices. A future proposal would need to carry and audit an eSpeak-NG WASM implementation and its data/license before reconsideration.

## Python baseline and audio checks

With fixed seed `0` and variation `0.667`, Python generated six deterministic baseline WAVs. They validate as finite mono 24 kHz data; all peaks are within `[-1, 1]`. Sample counts range from 68,096 (simple prose) to 439,104 (long text); details are in `fixtures/wav-validation.json`. Generated WAVs are local artifacts, not committed blobs.

The four-token, zero-noise smoke output is finite in both native ORT and Chrome and its extrema agree to float32 precision (native `[-0.13023455, 0.21601336]`; Chrome `[-0.13023455, 0.21601340]`). This only establishes a static graph smoke run. Python-to-ONNX waveform error/correlation for real frontend inputs, spectral comparison, encoded ONNX WAVs, and a listening comparison remain unperformed because the graph cannot accept real variable token lengths and emits an impractically long untrimmed tail.

## Actual Chromium ORT Web/WASM result

`browser/index.html` loads the local 36 MB ONNX asset and invokes only `onnxruntime-web` WASM. `scripts/browser_proof.mjs` serves it with cross-origin isolation and launches the installed Chrome binary; it does not use Node ORT, a server inference path, CDN inference, or a remote TTS call.

The initial numeric `BROWSER_ORT_FAILED` was diagnosed as an invalid eight-token input to a graph traced at four tokens, not an unsupported Web/WASM operation. With the traced four-token input, Chrome executes the graph and produces a finite 1,024,000-sample tensor: model/session setup was 379.9 ms and synthesis was 25,015.3 ms on the stated host. The harness initially obscured this success with a JavaScript spread-based `Math.min(...data)` stack overflow; it now scans samples iteratively. This is actual Chromium ORT Web/WASM evidence, but the 42.67-second untrimmed output for a smoke input and fixed token shape fail the practical renderer requirements. `npm run verify-browser-port` now checks the successful static renderer smoke test and still prints `GO_NO_GO_SUMMARY NO-GO`.

## Caveats and required next work

The renderer operation-compatibility stop condition is no longer supported by evidence, but this cannot be presented as a browser port merely because a static smoke graph runs. A new feasibility effort must (1) avoid trace-captured attention shapes, likely by exporting fixed padded token windows or separate encoder/duration/flow/decoder graphs with valid dynamic dimensions; (2) crop decoder input/output at the predicted frame length; (3) implement and license-audit a browser frontend with normalized text, phonemes, and IDs matching this corpus; and (4) only after all three, collect browser latency/memory/offline data, numerical audio parity, and blind listening results. Do not use a Python sidecar, native ORT, or substitute model as a workaround under this decision.
