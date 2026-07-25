# Browser port vs. upstream Python behavior

This harness is not a byte-for-byte API port of `source/inference.py`. It preserves the model family and validates selected boundaries, but deliberately changes runtime mechanics for a renderer-only path.

| Area | Upstream Python reference | Browser/WASM harness | Consequence |
| --- | --- | --- | --- |
| Text frontend | Native `phonemizer` / eSpeak-NG | `ephone` eSpeak-NG WASM | Exact normalized text, phonemes, and IDs pass six fixtures; untested input classes may differ. |
| Core model | PyTorch `model.infer` | ONNX core with fixed `[1, 512]` token input | Inputs are zero-padded and masked; text over 512 IDs is rejected per chunk. |
| Decoder | Part of PyTorch model invocation | Separate dynamic-frame ONNX decoder | The browser trims each channel of padded latent output before decoder invocation. |
| Randomness | PyTorch seed and `noise_scale=variation` | JS mulberry32 + Box–Muller standard-normal noise | Seeded noise algorithms and default variation are not equivalent. Cross-runtime waveform parity is established only with explicit zero noise. |
| Speed/variation controls | `speed`, `variation`, and duration-noise controls | No public browser control surface; fixed speed and seeded latent noise | Do not assume Python `synthesize(..., variation=0.667)` matches browser audio. |
| Long text | Python creates all chunks then concatenates a waveform | Browser synthesizes sequential chunks and schedules each completed chunk via Web Audio | First audio can begin before total synthesis completes; final WAV is still assembled after all chunks. |
| Runtime | Native Python/PyTorch | `onnxruntime-web` WASM in a renderer | No Python/native ORT in the browser path; latency and memory characteristics differ. |
| Obsidian renderer | Not applicable | Temporarily hides renderer-exposed Node `process` while ORT creates WASM sessions | Prevents ORT-Web from selecting an unavailable Node worker path in the tested Obsidian renderer. |

## Assertions that are validated

- Padded Python core vs. unpadded Python reference: retained latent max error `1.91e-06`; waveform max error `5.05e-08` for the recorded zero-noise case.
- Browser frontend: 6/6 exact fixture matches.
- Native ORT vs. Chromium ORT-Web with identical IDs and zero noise: waveform correlation `0.9999999995`; evidence in `fixtures/browser-native-zero-noise-comparison.json`.

## Assertions that are not validated

- General frontend equivalence beyond the fixture corpus.
- Non-zero-noise waveform equality between Python and browser.
- Subjective speech quality or prosody equivalence.
- Offline behavior after installation as an Obsidian plugin.
