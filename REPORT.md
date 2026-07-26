# Browser implementation notes

This repository implements Inflect Micro v2 for Chromium renderers such as
Electron and Obsidian. It combines eSpeak-compatible WASM phonemization,
dynamic FP32 ONNX inference, Web Audio chunk scheduling, and WAV encoding
without a server-side inference service.

## Runtime flow

1. `browser/frontend.mjs` normalizes input, splits long text, phonemizes each
   chunk with `ephone`, and creates blank-interspersed model IDs.
2. `browser/inference.mjs` runs the dynamic FP32 duration graph through WASM and
   prefers WebGPU for the official FP32 waveform decoder.
3. The duration graph applies `length_scale = 1 / speed`. Seeded normal noise
   and `noise_scale = variation` feed the decoder. Each long-text chunk uses
   `seed + chunkIndex`.
4. If WebGPU initialization fails, the same FP32 decoder runs through WASM with
   up to four threads when cross-origin isolation permits.
5. `browser/app.mjs` schedules every completed waveform through Web Audio and
   builds a final 24 kHz float WAV with `browser/runtime.mjs`.

Electron exposes Node's `process` in its renderer. The implementation hides it
only while ORT selects its backend so ONNX Runtime does not enter an unavailable
Node worker path in Obsidian/Electron.

## Performance

For a 175-token first chunk in headless Chromium, three warm runs measured:

| Runtime | Median first decoded chunk |
| --- | ---: |
| FP32 duration and decoder through WASM | `2874 ms` |
| FP32 duration and decoder through WebGPU | **`187 ms`** |
| FP32 WASM duration + FP32 WebGPU decoder | `198 ms` |

The Electron runtime uses the hybrid path to keep dynamic duration on WASM and
accelerate the dominant waveform decoder on WebGPU. Results are device-specific
and exclude model download/session initialization.

## Integration considerations

Obsidian plugins must allow model downloads from Hugging Face in their content
security policy, or package/cache `duration.onnx` and `decode-fp32.onnx`
locally. WebGPU support depends on the Electron version and device; the same
FP32 graphs provide the WASM fallback. Packaging owners remain responsible for
offline asset delivery, cancellation, memory budgets, listening evaluation,
and GPL/provenance obligations for the `ephone` frontend.
