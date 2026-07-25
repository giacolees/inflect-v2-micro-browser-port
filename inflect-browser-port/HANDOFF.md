# Inflect Micro v2 browser-port handoff

## Goal

Produce a **go/no-go feasibility result** for running `owensong/Inflect-Micro-v2` fully in a desktop Obsidian/Electron renderer through ONNX Runtime Web/WASM. This work is a dependency for a separate standalone TTS plugin; do **not** modify the current `obsidian-math-convert` plugin unless a minimal isolated Electron/WASM check is required.

The eventual product is: Obsidian command gets selected editor text, synthesizes a 24 kHz mono waveform locally, and immediately plays it. No hosted inference provider. Model downloads on first use are acceptable; fully offline first-run is not required.

## Known source facts

- Hugging Face model: `owensong/Inflect-Micro-v2`, release tag `v2.0.0`; canonical release is PyTorch FP32 (`model.pth`), 37.53 MB of weights.
- The package has custom Python inference, its own English normalization/phonemization frontend, and a VITS-family text-to-waveform model.
- The public model card explicitly says ONNX is not released because dynamic text length, stochastic latent sampling, and custom operations need a dedicated export/runtime path.
- Output contract: 24,000 Hz, mono, `float32`, values clipped to `[-1, 1]`; one fixed English male voice. It is non-streaming.
- Existing plugin’s `@huggingface/transformers` loader and its `src/inference.ts` are unsuitable: it is a FormulaNet vision encoder-decoder implementation, not a generic TTS runtime.
- The existing project build contains Electron-specific ONNX Runtime Web workarounds in `esbuild.config.mjs`; do not rely on them as evidence that Inflect will work. Any eventual integration must preserve them.
- Inflect code/weights use Apache-2.0, but preserve its third-party notices when carrying any frontend/assets forward.

## Required output

Create a new, self-contained `inflect-browser-port/` workspace (outside or alongside this plugin; do not add generated model blobs to this repository). Commit/source-control its conversion scripts, lockfiles, test prompts, expected metadata, documentation, and small test artifacts. Large source/downloaded models and generated ONNX files must be ignored or released through a documented artifact location.

Deliver `REPORT.md` containing:

1. exact Inflect revision, Python/PyTorch/ONNX/ORT Web versions, OS/browser/Electron version, hardware, and export command;
2. architecture mapping: frontend inputs, each exported graph, graph inputs/outputs/shapes/dtypes, custom/dynamic operations encountered, and how stochastic noise/seed is represented;
3. browser frontend approach, license/notices, and parity results against Python for a corpus covering simple prose, punctuation, numbers, abbreviations, non-ASCII names, and long text;
4. actual Chromium/Electron ORT Web/WASM evidence—not Node-only ORT—with model load time, first/warm synthesis latency, peak memory if measurable, and generated WAV samples;
5. Python-versus-ONNX comparison methodology and numeric results (length/sample rate, finite/range checks, waveform error/correlation or spectral metrics) plus a manual listening conclusion;
6. explicit **GO** or **NO-GO** recommendation for the Obsidian plugin, all caveats, and next work required.

## Acceptance gates

A GO requires every item below:

- A deterministic export path: fixed latent noise is an explicit ONNX input or an equivalently documented reproducible method; do not hide randomness in runtime-only behavior.
- The exported graph(s) execute in a real Chromium/Electron renderer with `onnxruntime-web` WASM, with no Python, server, native ORT, CDN inference endpoint, or remote TTS call at synthesis time.
- A browser-safe implementation of the exact/validated equivalent text frontend produces documented parity for the corpus. Do not pass raw text to a graph expecting phoneme IDs without demonstrating the transformation.
- Browser output is a valid finite 24 kHz mono waveform and can be encoded into/playable as WAV using browser APIs.
- Output is not materially degraded versus Python according to disclosed numerical checks and a small human listening comparison.
- Model assets are downloadable/cached locally and the runtime remains functional after network access is disabled.
- Licensing and all carried third-party notices are documented.

## Stop conditions / NO-GO

Stop attempting plugin integration and report NO-GO if any of these holds:

- The necessary PyTorch model/runtime source cannot be obtained under terms permitting the intended Apache-2.0-compatible port.
- Export needs unsupported ORT Web operations with no practical standards-based rewrite, or depends on custom native kernels.
- The frontend cannot be reproduced in the browser with acceptable output parity/licensing.
- It only works in Python or `onnxruntime-node`, not in a Chromium/Electron renderer.
- The model crashes/exhausts practical desktop-renderer memory, consistently fails on normal selected-note text, or has audible degradation that cannot be resolved.

Do not substitute another model or fall back to a local Python companion. Either is a separate product decision requiring approval.

## Suggested execution order

1. Download the tagged model package and inspect its actual `inference.py`, frontend, `runtime/`, `config.json`, checkpoint layout, and notices. Reproduce a Python baseline with a fixed prompt corpus and fixed seeds; save WAVs and input/intermediate tensors where useful.
2. Map synthesis into exportable components. Prefer separate ONNX graphs for stable model subgraphs over a single opaque scriptable wrapper. Make every dynamic value explicit, especially text lengths, masks, and latent noise.
3. Export at a documented opset; use ONNX checker and shape inference where possible. Test first with Python ONNX Runtime solely as a diagnostic, then immediately test with `onnxruntime-web` in Chromium/Electron.
4. Implement/prove the frontend. Verify normalized text and phoneme/symbol IDs against Python before judging audio. Include punctuation and segmentation behavior; the model’s long-text splitter and pauses must be considered.
5. Build a minimal static browser harness that accepts text, logs graph inputs/outputs/timings, produces a WAV Blob/URL, and plays it. Run it in Chromium or Electron (not merely Node). Disable network after assets are cached and re-run.
6. Write `REPORT.md` with GO/NO-GO and attach or link the reproducible artifacts.

## Verification gate

Run the workspace’s documented one-command verification (for example `npm run verify-browser-port`) in a clean environment with cached local assets. Expected success output must show: frontend parity cases passed; ONNX checker passed; ORT Web/WASM Chromium/Electron synthesis passed for the prompt corpus; output WAV validation passed; and a printed GO/NO-GO evidence summary. STOP and publish a NO-GO report if any gate fails; do not begin Obsidian plugin integration.
