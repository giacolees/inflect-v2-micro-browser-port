# Verification evidence

All timing values are host-specific measurements, not performance guarantees.

## Automated checks

<!-- markdownlint-disable MD013 -->
| Command | Evidence |
| --- | --- |
| `npm run verify-browser-port` | Legacy export checks, WAV validation, frontend fixtures, and Chromium synthesis smoke run. |
| `npm run benchmark-browser` | Real UI timing from synthesis click to first queued audio and completion. |
| `npm run benchmark-first-audio` | FP32 WASM, FP32 WebGPU, and Electron hybrid first-chunk latency. |
| `node scripts/frontend_parity.mjs` | Six exact normalized-text, phoneme, and token-ID fixtures. |
<!-- markdownlint-enable MD013 -->

## Recorded results

For a 175-token first chunk, three warm Chromium runs measured:

- FP32 duration and decoder through WASM: median `2874 ms`.
- FP32 duration and decoder through WebGPU: median `187 ms`.
- FP32 WASM duration plus FP32 WebGPU decoder: median `198 ms`.

The graph files remain FP32. The runtime uses the hybrid configuration in
Electron and falls back to FP32/WASM when WebGPU is unavailable.

## Runtime checks

The Chromium smoke test downloads the same model files as the application,
creates the selected ONNX Runtime Web backend, synthesizes finite audio, and
validates the RIFF/WAVE container. The UI badge reports whether WebGPU or the
WASM fallback was selected.

For an Obsidian integration, repeat these checks inside the exact supported
Electron version. Confirm that WebGPU is enabled, Hugging Face assets are
allowed by content security policy, and packaged/offline model caching behaves
as intended.

## Remaining acceptance work

1. Complete listening review across representative short and long text.
2. Define memory and cancellation requirements for the target Obsidian plugin.
3. Validate WebGPU and WASM fallback behavior across supported devices.
4. Validate offline asset packaging and cache updates.
