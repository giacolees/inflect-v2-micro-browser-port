# Inflect Micro v2 in the browser

A compact reference implementation of browser-only text-to-speech with
[`owensong/Inflect-Micro-v2`](https://huggingface.co/owensong/Inflect-Micro-v2),
eSpeak-compatible WASM phonemization, and ONNX Runtime Web. It prefers a custom
FP16 WebGPU decoder in Electron/Obsidian and falls back to the official FP32
WASM runtime. Each inference step remains visible: text normalization, phoneme
IDs, dynamic ONNX execution, Web Audio playback, and WAV export.

## How inference is assembled

```text
input text
  → normalize and split into model-safe chunks       browser/frontend.mjs
  → ephone WASM converts each chunk to IPA           browser/frontend.mjs
  → IPA symbols become blank-interspersed token IDs  browser/frontend.mjs
  → dynamic ONNX predicts durations                  browser/inference.mjs
  → WebGPU/WASM samples and decodes audio             browser/inference.mjs
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

The browser downloads its WebGPU graphs from the public
[Electron/WebGPU model repository](https://huggingface.co/giacolees/Inflect-Micro-v2-ONNX)
when it creates the ONNX Runtime sessions. If WebGPU is unavailable, it uses
the parent model's official dynamic FP32 ONNX decoder through WASM. No local
checkpoint or copied ONNX assets are needed to run the page.

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
| `browser/inference.mjs` | Selects WebGPU/WASM, applies controls, and streams dynamic ONNX inference. |
| `browser/runtime.mjs` | Deterministic noise, chunk pauses/fades, and float WAV encoding. |
| `scripts/` | Graph export, parity checks, browser proof, and benchmarks. |
| `source/` | Pinned upstream Python reference used for graph export and baselines. |
<!-- markdownlint-enable MD013 -->

The duration graph accepts dynamic token lengths and `length_scale`. Its dynamic
acoustic outputs feed the decoder without CPU readback on WebGPU. The decoder
accepts seeded noise and `noise_scale`, exposing the parent model's speed,
variation, and seed controls. Long text remains punctuation-aware chunks and
each completed waveform is queued immediately.

## Verify

```bash
npm run verify-browser-port
npm run benchmark-browser
npm run benchmark-first-audio
npm run benchmark-python-onnx
```

`npm run benchmark-first-audio` compares the official FP32 WASM and WebGPU paths
with this repository's FP16 WebGPU decoder. The recorded 175-token first chunk
was `2819 ms` on official WASM, `187 ms` on official WebGPU, and `160 ms` with
the Electron hybrid; timings exclude model/session initialization.
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
