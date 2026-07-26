# Browser runtime vs. upstream Python behavior

The renderer preserves the model architecture and public synthesis controls but
changes runtime mechanics for Electron/Obsidian.

<!-- markdownlint-disable MD013 -->
| Area | Upstream Python | Electron/browser runtime | Consequence |
| --- | --- | --- | --- |
| Text frontend | Native `phonemizer` / eSpeak-NG | `ephone` eSpeak-NG WASM | Six exact frontend fixtures pass; other input classes can differ. |
| Duration | PyTorch inference | Official dynamic FP32 ONNX duration graph | Dynamic token/audio lengths and public speed control are retained. |
| Decoder | FP32 PyTorch | FP16-internal ONNX decoder on WebGPU | Lower latency and memory; output is numerically close but not identical. |
| Fallback | Not applicable | Official FP32 ONNX decoder through WASM | Supports devices where WebGPU initialization fails. |
| Randomness | PyTorch RNG | JS Mulberry32 plus Box–Muller noise | A browser seed repeats in the same runtime, but does not match PyTorch RNG. |
| Controls | `speed`, `variation`, `seed` | Same ranges and defaults | Speed maps to inverse length scale; variation scales seeded noise. |
| Long text | Punctuation-aware chunks joined in Python | Chunks stream through Web Audio and are also joined into a WAV | First audio begins before all chunks complete. |
| Electron | Not applicable | Renderer-exposed Node `process` is hidden during ORT backend selection | Prevents ORT from choosing an unavailable Node worker path. |
<!-- markdownlint-enable MD013 -->

## Validated boundaries

- Browser frontend: 6/6 exact fixture matches.
- First-chunk benchmark: hybrid FP32 WASM/FP16 WebGPU median `160 ms`, official
  FP32 WebGPU `187 ms`, and official FP32 WASM `2819 ms`.
- Native FP16/FP32 seeded waveform: correlation `0.9998344`; direct WebGPU
  comparison has RMSE `0.04685` and requires listening acceptance.

## Not yet validated

- Listening and intelligibility acceptance of FP16 across representative text.
- Seed equality with the Python runtime (the RNG algorithms differ).
- Every Electron/device WebGPU implementation.
- Offline behavior and cancellation in a downstream Obsidian plugin.
