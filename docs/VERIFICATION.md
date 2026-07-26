# Verification evidence

All timing values are host-specific measurements, not performance guarantees.

## Automated checks

<!-- markdownlint-disable MD013 -->
| Command | Evidence |
| --- | --- |
| `npm run verify-browser-port` | Legacy export checks, WAV validation, frontend fixtures, and Chromium synthesis smoke run. |
| `npm run benchmark-browser` | Real UI timing from synthesis click to first queued audio and completion. |
| `npm run benchmark-first-audio` | Official FP32 WASM/WebGPU versus custom FP16 WebGPU first-chunk latency. |
| `node scripts/frontend_parity.mjs` | Six exact normalized-text, phoneme, and token-ID fixtures. |
<!-- markdownlint-enable MD013 -->

## Recorded results

For a 175-token first chunk, three warm Chromium runs measured:

- Official dynamic FP32 ONNX through WASM: median `2819 ms`.
- Official dynamic FP32 ONNX through WebGPU: median `187 ms`.
- WASM duration plus custom FP16 WebGPU decoder: median `160 ms`.

A default five-chunk UI run scheduled first audio at `427 ms` and completed
586,880 samples in `1013 ms` after model download/session initialization.

Native ORT comparison between official FP32 and custom FP16 measured
correlation `0.9998344` and RMSE `0.0011444`. Direct WebGPU comparison measured
RMSE `0.04685` and maximum absolute difference `0.51394`; listening acceptance
is therefore required.

## Runtime checks

The Chromium smoke test downloads the same model files as the application,
creates the selected ONNX Runtime Web backend, synthesizes finite audio, and
validates the RIFF/WAVE container. The UI badge reports whether WebGPU/FP16 or
the WASM fallback was selected.

For an Obsidian integration, repeat these checks inside the exact supported
Electron version. Confirm that WebGPU is enabled, Hugging Face assets are
allowed by content security policy, and packaged/offline model caching behaves
as intended.

## Remaining acceptance work

1. Complete listening and intelligibility review of the FP16 decoder.
2. Define memory and cancellation requirements for the target Obsidian plugin.
3. Validate WebGPU and WASM fallback behavior across supported devices.
4. Validate offline asset packaging and cache updates.
