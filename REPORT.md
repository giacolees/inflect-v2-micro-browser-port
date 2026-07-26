# Browser implementation notes

This repository implements Inflect Micro v2 for Chromium renderers such as
Electron and Obsidian. It combines eSpeak-compatible WASM phonemization,
dynamic ONNX inference, Web Audio chunk scheduling, and WAV encoding without a
server-side inference service.

## Runtime flow

1. `browser/frontend.mjs` normalizes input, splits long text, phonemizes each
   chunk with `ephone`, and creates blank-interspersed model IDs.
2. `browser/inference.mjs` runs the dynamic FP32 duration graph through WASM and
   prefers WebGPU for the custom FP16-internal decoder. This preserves stable
   duration outputs while accelerating waveform generation.
3. The duration graph applies `length_scale = 1 / speed`. Seeded normal noise
   and `noise_scale = variation` feed the decoder. Each long-text chunk uses
   `seed + chunkIndex`.
4. If WebGPU initialization fails, the runtime loads the official FP32 decoder
   and uses WASM with up to four threads when cross-origin isolation permits.
5. `browser/app.mjs` schedules every completed waveform through Web Audio and
   builds a final 24 kHz float WAV with `browser/runtime.mjs`.

Electron exposes Node's `process` in its renderer. The implementation hides it
only while ORT selects its backend so ONNX Runtime does not enter an unavailable
Node worker path in Obsidian/Electron.

## Performance

For a 175-token first chunk in headless Chromium, three warm runs measured:

| Runtime | Median first decoded chunk |
| --- | ---: |
| Official FP32 ONNX, WASM | `2819 ms` |
| Official FP32 ONNX, WebGPU | `187 ms` |
| WASM duration + custom FP16 WebGPU decoder | **`160 ms`** |

A five-chunk browser UI run scheduled first audio at `427 ms` and completed in
`1013 ms` after model/session initialization. Results are device-specific.

## Numerical comparison

Native ORT comparison against the official FP32 decoder measured correlation
`0.9998344`, RMSE `0.0011444`, and maximum absolute difference `0.031019`.
Direct FP16-versus-FP32 WebGPU comparison measured RMSE `0.04685` and maximum
absolute difference `0.51394`. FP16 still needs listening and intelligibility
acceptance for a target application.

## Integration considerations

Obsidian plugins must allow model downloads from Hugging Face in their content
security policy, or package/cache the two WebGPU assets locally. WebGPU support
depends on the Electron version and device; the official FP32 WASM fallback is
retained for compatibility. Packaging owners remain responsible for offline
asset delivery, cancellation, memory budgets, listening evaluation, and
GPL/provenance obligations for the `ephone` frontend.
