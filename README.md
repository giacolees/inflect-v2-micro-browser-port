# Inflect Micro v2 — browser/WASM feasibility harness

A transparent experiment for running the [`owensong/Inflect-Micro-v2`](https://huggingface.co/owensong/Inflect-Micro-v2) VITS-family TTS model entirely in an Electron/Chromium renderer.

> **Status: feasibility evidence, not a production package.** The browser frontend, ONNX inference, WAV generation, chunk streaming, and an Electron renderer smoke test work. Listening acceptance and target-environment integration remain outside this repository.

## What this proves

- Local eSpeak-NG-compatible phonemization through GPL-3.0-or-later `ephone` WASM.
- Local ONNX Runtime Web/WASM inference; no Python sidecar, hosted inference, native ORT, or substitute model in the browser path.
- Browser frontend parity on six representative fixtures.
- Native ORT ↔ Chromium zero-noise waveform parity for the simple prompt.
- Chunked Web Audio playback: each completed chunk is queued while later chunks synthesize.
- A smoke run in Electron 34.2.0.

See [docs/VERIFICATION.md](docs/VERIFICATION.md) for measurements and [docs/SOURCE_DIFFERENCES.md](docs/SOURCE_DIFFERENCES.md) before treating the browser path as a replacement for upstream Python.

## Quick start

### Prerequisites

- Python 3.11 with the dependencies in `source/requirements-tested.txt`, plus `onnx==1.19.1` and `onnxruntime==1.23.2`.
- Node/npm (`npm ci`).
- Google Chrome for the Chromium checks.

### Obtain non-committed assets

Download upstream `model.pth` into both `source/model.pth` and `artifacts/model.pth`.

| Asset | SHA-256 |
| --- | --- |
| `model.pth` | `3eede065c9ccfa88ade0a5a9a5c23de34afcbbb32213e59aad44d5cf100fdee8` |

Generate browser graphs:

```bash
PYTHONPATH=source:source/runtime .venv/bin/python scripts/export_onnx.py
cp artifacts/inflect-core.onnx artifacts/inflect-decoder.onnx browser/
npm ci
```

### Run locally

```bash
npm run dev
# Open http://127.0.0.1:4173/browser/index.html
```

Click **Start streaming synthesis**. The first completed chunk is scheduled through Web Audio immediately; the final WAV is available for download when all chunks finish.

## Verify

```bash
npm run verify-browser-port
node scripts/export_browser_waveform.mjs
.venv/bin/python scripts/compare_browser_waveform.py
npm run benchmark-browser
npm run benchmark-python-onnx
```

The main verification suite covers ONNX validity, native ONNX execution, padded-core parity, WAV validity, real Chromium WASM synthesis, and browser frontend fixtures. It does **not** establish listening quality, application integration, or a production GO.

## Repository map

| Path | Purpose |
| --- | --- |
| `browser/` | Renderer harness, eSpeak frontend, Web Audio streaming, generated ONNX placement |
| `scripts/` | Export, parity, renderer proof, and benchmark commands |
| `fixtures/` | Small checked-in evidence and test expectations |
| `source/` | Pinned upstream Python reference snapshot used for export/baselines |
| `upstream/` | Upstream release/provenance snapshot |
| `THIRD_PARTY_NOTICES.md` | Browser-port third-party notices and provenance |
| `docs/` | Verification evidence and behavior differences |

Large checkpoints, ONNX graphs, WAVs, and transient comparison buffers are intentionally ignored. Do not publish model files without confirming their upstream distribution terms.

## License and provenance

The upstream model/source license is retained in [`LICENSE`](LICENSE). The browser phonemizer is `ephone@1.0.2`, GPL-3.0-or-later; its notice/copying text and provenance are retained in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and `third_party/EPHONE_COPYING.txt`. Any downstream distribution that ships this frontend must be GPL-3.0-or-later-compatible and provide corresponding-source obligations as required.

## Current non-GO items

- Listening review across punctuation, non-ASCII text, and long streamed notes.
- Define target-device latency/memory limits and test cancellation/stop behavior.
- Validate the method in each downstream application's supported Electron/runtime environment.
- Confirm asset packaging and offline behavior in each downstream application.
