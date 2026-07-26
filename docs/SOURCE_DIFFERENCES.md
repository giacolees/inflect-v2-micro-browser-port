# Browser runtime vs. upstream Python behavior

The renderer preserves the model architecture and public synthesis controls but
changes runtime mechanics for Electron/Obsidian.

<!-- markdownlint-disable MD013 -->
| Area | Upstream Python | Electron/browser runtime | Consequence |
| --- | --- | --- | --- |
| Text frontend | Native `phonemizer` / eSpeak-NG | `ephone` eSpeak-NG WASM | Six exact frontend fixtures pass; other input classes can differ. |
| Duration | PyTorch inference | Dynamic FP32 ONNX through WASM | Dynamic lengths and speed control are retained. |
| Decoder | FP32 PyTorch | Official FP32 ONNX through WebGPU or WASM | One graph supports both providers; WebGPU reduces latency. |
| Randomness | PyTorch RNG | JS Mulberry32 plus Box–Muller noise | A browser seed repeats in the same runtime, but does not match PyTorch RNG. |
| Controls | `speed`, `variation`, `seed` | Same ranges and defaults | Speed maps to inverse length scale; variation scales seeded noise. |
| Long text | Punctuation-aware chunks joined in Python | Chunks stream through Web Audio and are also joined into a WAV | First audio begins before all chunks complete. |
| Electron | Not applicable | Renderer-exposed Node `process` is hidden during ORT backend selection | Prevents ORT from choosing an unavailable Node worker path. |
<!-- markdownlint-enable MD013 -->

## Validated boundaries

- Browser frontend: 6/6 exact fixture matches.
- First-chunk benchmark: hybrid FP32 WASM/WebGPU median `198 ms`, all-WebGPU
  `187 ms`, and all-WASM `2874 ms` in the recorded environment.
- Controls execute with dynamic speed, variation, and deterministic browser
  seeds.

## Not yet validated

- Seed equality with the Python runtime (the RNG algorithms differ).
- Every Electron/device WebGPU implementation.
- Offline behavior and cancellation in a downstream Obsidian plugin.
