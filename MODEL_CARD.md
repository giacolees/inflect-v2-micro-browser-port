---
language:
- en
license: apache-2.0
library_name: onnxruntime
pipeline_tag: text-to-speech
tags:
- onnx
- onnxruntime
- onnxruntime-web
- text-to-speech
- browser
base_model:
- owensong/Inflect-Micro-v2
---

# Inflect Micro v2 — ONNX

Browser-ready ONNX exports of
[**Inflect-Micro-v2**](https://huggingface.co/owensong/Inflect-Micro-v2), a
fixed-voice English text-to-speech model. This repository packages the two
graphs used by the browser implementation; it does not replace the parent
model's Python package, documentation, evaluation, or controls.

## Parent model

- **Parent model:**
  [owensong/Inflect-Micro-v2](https://huggingface.co/owensong/Inflect-Micro-v2)
- **Browser implementation:**
  [giacolees/inflect-v2-micro-browser-port](https://github.com/giacolees/inflect-v2-micro-browser-port)

Refer to the parent model card for architecture, evaluation, voice/data
information, limitations, responsible use, and the original Python runtime.
This export retains the parent model's 24 kHz mono waveform output and uses the
same 192 latent channels.

## Files

- `inflect-core.onnx`: fixed-width text-to-latent graph.
- `inflect-decoder.onnx`: dynamic latent-to-waveform decoder.

Both graphs are required. The core input is token IDs `[1, 512]`, a token
length, and latent noise `[1, 192, 4000]`. `inflect-core.onnx` produces a
predicted frame length; trim the latent to that length before passing it to
`inflect-decoder.onnx`.

## Browser usage

The companion browser implementation downloads these graphs directly with
ONNX Runtime Web/WASM:

```js
const modelBase =
  "https://huggingface.co/giacolees/Inflect-Micro-v2-ONNX/resolve/main";
const core = await ort.InferenceSession.create(
  await fetch(`${modelBase}/inflect-core.onnx`).then((response) =>
    response.arrayBuffer(),
  ),
  { executionProviders: ["wasm"] },
);
const decoder = await ort.InferenceSession.create(
  await fetch(`${modelBase}/inflect-decoder.onnx`).then((response) =>
    response.arrayBuffer(),
  ),
  { executionProviders: ["wasm"] },
);
```

See [`browser/inference.mjs`](https://github.com/giacolees/inflect-v2-micro-browser-port/blob/master/browser/inference.mjs)
for complete tensor construction and latent trimming. Text normalization,
phonemization, token mapping, noise generation, chunking, and WAV encoding are
intentionally outside these ONNX graphs.

## Limitations and responsible use

This export inherits the parent model's scope: English only, one fixed
synthetic voice, and no zero-shot voice cloning. Numbers, abbreviations,
unusual names, and long-text transitions remain frontend-sensitive. Do not use
generated speech to impersonate a real person, deceive listeners, or create
fraudulent content; disclose synthetic audio where appropriate.

## License and attribution

The ONNX graphs are exports of
[Inflect-Micro-v2](https://huggingface.co/owensong/Inflect-Micro-v2), which is
released under Apache-2.0. Consult the parent repository for its complete
notices and provenance. The companion browser project uses `ephone` for WASM
phonemization; its GPL-3.0-or-later obligations apply when distributing that
frontend, not to these graph files alone.

## Citation

```bibtex
@software{song2026inflectmicrov2,
  author = {Owen Song},
  title = {Inflect-Micro-v2: Complete Local Text-to-Waveform TTS Under 10M Parameters},
  year = {2026},
  url = {https://huggingface.co/owensong/Inflect-Micro-v2}
}
```
