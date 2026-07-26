---
language:
- en
license: apache-2.0
library_name: onnxruntime
pipeline_tag: text-to-speech
tags:
- onnx
- onnxruntime-web
- webgpu
- electron
- obsidian
- text-to-speech
base_model:
- owensong/Inflect-Micro-v2-ONNX
- owensong/Inflect-Micro-v2
---

# Inflect Micro v2 — Electron/WebGPU ONNX

An Electron-oriented ONNX export of
[Inflect-Micro-v2](https://huggingface.co/owensong/Inflect-Micro-v2). It is
based on the
[official dynamic ONNX export](https://huggingface.co/owensong/Inflect-Micro-v2-ONNX)
and retains its speed, variation, and deterministic seed controls.

This repository optimizes the expensive flow/waveform decoder for WebGPU with
FP16 internal weights while retaining FP32 graph inputs and waveform output.
It is intended for local Chromium renderers such as Electron and Obsidian.

## Files

- `duration.onnx`: official dynamic FP32 text-to-acoustic graph, 7 MB.
- `decode-webgpu-fp16.onnx`: FP16-internal WebGPU flow and waveform decoder,
  15 MB.

Both files are needed for the WebGPU path. The companion implementation falls
back to the official FP32 decoder through WASM when WebGPU is unavailable.

## Controls

| Control | Default | Range |
| --- | ---: | ---: |
| `speed` | `1.0` | `0.5–2.0` |
| `variation` | `0.667` | `0.0–1.0` |
| `seed` | `0` | integer |

Lower speed is slower; lower variation is steadier. Seed repeats the stochastic
sample on the same runtime stack.

The duration graph receives `length_scale = 1 / speed`. The decoder receives
`noise_scale = variation`, and the browser creates seeded normal noise with
`seed + chunkIndex` for repeatable long-text synthesis.

## Electron benchmark

Recorded in headless Chromium with ONNX Runtime Web 1.23.2, one 175-token first
chunk, and three warm runs:

| Runtime | Median first decoded chunk |
| --- | ---: |
| Official FP32, WASM | `2819 ms` |
| Official FP32, WebGPU | `187 ms` |
| WASM duration + this FP16 WebGPU decoder | **`160 ms`** |

The Electron hybrid was about 14% faster than the official all-WebGPU graph and
about 94% faster than the official WASM path for this measured first chunk.
Timings are device-specific and exclude model download/session initialization.
Run `npm run benchmark-first-audio` in the companion repository to reproduce
the comparison.

## Numerical comparison

Native ORT comparison with the official FP32 decoder for one seeded waveform
measured correlation `0.9998344`, RMSE `0.0011444`, and maximum absolute
difference `0.031019`. Direct WebGPU FP16-versus-FP32 comparison measured RMSE
`0.04685` and maximum absolute difference `0.51394`.

FP16 and execution-provider arithmetic change numerical output. Complete
listening and intelligibility acceptance is required before relying on this
export in a product.

## Browser implementation

The complete Electron/browser runtime, control wiring, chunk streaming, seeded
noise, Web Audio scheduling, and WASM fallback are in
[`browser/inference.mjs`](https://github.com/giacolees/inflect-v2-micro-browser-port/blob/master/browser/inference.mjs)
and the surrounding
[browser implementation](https://github.com/giacolees/inflect-v2-micro-browser-port).

The runtime executes dynamic duration in FP32/WASM and prefers WebGPU for the
FP16 decoder. If WebGPU initialization fails, it uses the official FP32 decoder
with WASM. Electron's exposed Node `process` is hidden only during ORT backend
selection so ORT does not choose its Node worker path inside the renderer.

## Limitations and responsible use

This export inherits the parent model's scope: English only, one fixed
synthetic voice, and no zero-shot voice cloning. Numbers, abbreviations,
unusual names, and long-text transitions remain frontend-sensitive. Do not use
generated speech to impersonate a real person, deceive listeners, or create
fraudulent content; disclose synthetic audio where appropriate.

## License and attribution

The graphs derive from
[Inflect-Micro-v2](https://huggingface.co/owensong/Inflect-Micro-v2) and its
[official ONNX export](https://huggingface.co/owensong/Inflect-Micro-v2-ONNX),
released under Apache-2.0. Consult those parent repositories for complete
notices and provenance. The companion browser project uses `ephone` for WASM
phonemization; its GPL-3.0-or-later obligations apply when distributing that
frontend, not to these graphs alone.

## Citation

```bibtex
@software{song2026inflectmicrov2,
  author = {Owen Song},
  title = {Inflect-Micro-v2: Complete Local Text-to-Waveform TTS Under 10M Parameters},
  year = {2026},
  url = {https://huggingface.co/owensong/Inflect-Micro-v2}
}
```
