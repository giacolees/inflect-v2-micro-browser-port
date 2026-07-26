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

Electron-oriented packaging of the official FP32 dynamic ONNX export for
[Inflect-Micro-v2](https://huggingface.co/owensong/Inflect-Micro-v2). It is
based on and linked to the
[official ONNX repository](https://huggingface.co/owensong/Inflect-Micro-v2-ONNX)
and retains its speed, variation, and deterministic seed controls.

The graphs remain FP32. The companion implementation accelerates the expensive
waveform decoder with WebGPU in Chromium/Electron and uses the same decoder
through WASM when WebGPU is unavailable.

## Files

- `duration.onnx`: dynamic FP32 text-to-acoustic graph, 7 MB.
- `decode-fp32.onnx`: dynamic FP32 flow and waveform decoder, 29 MB.

Both graph files are required because the neural model is split at the acoustic
representation. There is no separate WebGPU model: `decode-fp32.onnx` runs with
both WebGPU and WASM in ONNX Runtime Web.

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

Recorded with one 175-token first chunk and three warm runs.

### Benchmark environment

- MacBook Pro 14-inch (`MacBookPro18,3`)
- Apple M1 Pro: 8-core CPU (6 performance, 2 efficiency), 14-core GPU
- 16 GB unified memory
- macOS 26.3 (`25D125`)
- Google Chrome 150.0.7871.184, headless
- ONNX Runtime Web 1.23.2
- WASM comparisons use one thread; WebGPU uses the M1 Pro GPU through Metal
- Model download and session initialization are excluded

| Runtime | Median first decoded chunk |
| --- | ---: |
| FP32 duration + decoder, WASM | `2874 ms` |
| FP32 duration + decoder, WebGPU | **`187 ms`** |
| FP32 WASM duration + FP32 WebGPU decoder | `198 ms` |

The companion Electron runtime uses the hybrid path: duration through WASM for
stable dynamic alignment and waveform decoding through WebGPU. If WebGPU is
unavailable, both graphs run through WASM. Timings are device-specific. Run
`npm run benchmark-first-audio` in the companion repository to reproduce the
comparison.

## Browser implementation

The complete Electron/browser runtime, control wiring, chunk streaming, seeded
noise, Web Audio scheduling, and provider fallback are in
[`browser/inference.mjs`](https://github.com/giacolees/inflect-v2-micro-browser-port/blob/master/browser/inference.mjs)
and the surrounding
[browser implementation](https://github.com/giacolees/inflect-v2-micro-browser-port).

Electron's exposed Node `process` is hidden only during ORT backend selection so
ORT does not choose its Node worker path inside an Obsidian/Electron renderer.
The application downloads the two model files once and relies on the browser or
application cache thereafter.

## Limitations and responsible use

This export inherits the parent model's scope: English only, one fixed
synthetic voice, and no zero-shot voice cloning. Numbers, abbreviations,
unusual names, and long-text transitions remain frontend-sensitive. WebGPU and
WASM arithmetic can differ slightly even with the same FP32 graph. Do not use
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
