# Inflect Micro v2 in the browser

A compact reference implementation of browser-only text-to-speech with
[`owensong/Inflect-Micro-v2`](https://huggingface.co/owensong/Inflect-Micro-v2),
eSpeak-compatible WASM phonemization, and ONNX Runtime Web/WASM. It is organized
to make each inference step visible: text normalization, phoneme IDs, ONNX graph
execution, Web Audio playback, and WAV export.

## How inference is assembled

```text
input text
  → normalize and split into model-safe chunks       browser/frontend.mjs
  → ephone WASM converts each chunk to IPA           browser/frontend.mjs
  → IPA symbols become blank-interspersed token IDs  browser/frontend.mjs
  → ORT-Web/WASM runs the core ONNX graph            browser/inference.mjs
  → ORT-Web/WASM decodes the latent to audio         browser/inference.mjs
  → Web Audio queues chunks; JS writes a WAV         browser/app.mjs + browser/runtime.mjs
```

The page at `browser/index.html` presents this pipeline and runs it locally.
Models, phonemizer, and inference stay in the renderer: there is no Python
sidecar, hosted endpoint, native ONNX Runtime, or substitute browser model.

## Run it

### Prerequisites

- Node/npm.
- Google Chrome for browser checks.

### Start the browser implementation

The browser downloads its two required graphs from the public
[Inflect-Micro-v2-ONNX model repository](https://huggingface.co/giacolees/Inflect-Micro-v2-ONNX)
when it creates the ONNX Runtime sessions. No local checkpoint or copied ONNX
assets are needed to run the page.

```bash
npm ci
npm run dev
```

To re-export the graphs or run the Python-backed verification commands, also
install Python 3.11 with `source/requirements-tested.txt`, `onnx==1.19.1`, and
`onnxruntime==1.23.2`; the upstream checkpoint must be present at both
`source/model.pth` and `artifacts/model.pth`.

Open <http://127.0.0.1:4173/browser/index.html>, enter text, and choose
**Run browser inference**. Each finished chunk is scheduled through Web Audio
while the next one is inferred; the combined audio can then be downloaded as a
24 kHz float WAV.

## Code guide

<!-- markdownlint-disable MD013 -->
| Path | Responsibility |
| --- | --- |
| `browser/index.html` | Explains the pipeline and provides the local inference UI. |
| `browser/app.mjs` | Coordinates UI state, streaming Web Audio, test mode, and WAV download. |
| `browser/frontend.mjs` | Text normalization, chunking, ephone WASM integration, and model token IDs. |
| `browser/inference.mjs` | Downloads the ONNX graphs, creates ORT-Web/WASM sessions, and runs inference. |
| `browser/runtime.mjs` | Deterministic noise, chunk pauses/fades, and float WAV encoding. |
| `scripts/` | Graph export, parity checks, browser proof, and benchmarks. |
| `source/` | Pinned upstream Python reference used for graph export and baselines. |
<!-- markdownlint-enable MD013 -->

The browser core has fixed inputs: token IDs `[1, 512]` and latent noise
`[1, 192, 4000]`. `browser/inference.mjs` pads input IDs, supplies noise, reads
the predicted frame count, trims the latent, and passes it to the dynamic
decoder graph.

## Verify

```bash
npm run verify-browser-port
node scripts/export_browser_waveform.mjs
.venv/bin/python scripts/compare_browser_waveform.py
npm run benchmark-browser
npm run benchmark-first-audio
npm run benchmark-python-onnx
```

`npm run benchmark-first-audio` compares time to the first decoded browser
chunk for this repository's fixed graphs and the official dynamic ONNX pair.
See [docs/VERIFICATION.md](docs/VERIFICATION.md) for commands and recorded
cross-runtime results. [docs/SOURCE_DIFFERENCES.md](docs/SOURCE_DIFFERENCES.md)
documents intentional differences from upstream Python, including phonemizer,
noise, and playback behavior.

## License and provenance

The upstream model/source license is retained in [`LICENSE`](LICENSE). The
browser phonemizer is `ephone@1.0.2`, GPL-3.0-or-later; its notice and copying
text are in [the third-party notices](./THIRD_PARTY_NOTICES.md) and
`third_party/EPHONE_COPYING.txt`. Downstream distribution must remain
GPL-3.0-or-later-compatible and provide corresponding source as required.

Large checkpoints, ONNX graphs, WAVs, and transient comparison buffers are
intentionally ignored. Confirm the upstream distribution terms before
publishing model files.
