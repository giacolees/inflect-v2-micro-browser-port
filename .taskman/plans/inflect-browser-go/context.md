# Context

## Intent

- Turn the proven two-graph ORT-Web smoke path into a browser-only Inflect feasibility result.
- Close remaining gates: exact/equivalent frontend, seeded noise, corpus parity, WAV/playback, offline cache, performance/memory, notices.

## Decisions

- Keep upstream Inflect Micro v2; no Python sidecar, native ORT, hosted inference, or substitute model.
- Retain fixed 512-token padded core plus dynamic decoder. The current parity test supports this architecture.
- User authorizes GPL-3.0-or-later distribution for this plugin. eSpeak-NG WASM is now the preferred frontend because it is closest to the Python runtime.
- Keep the permissive G2P evaluation as documented evidence only; it did not meet parity expectations.
- Split work into frontend, browser pipeline, then evidence/report because each depends on the preceding layer.

## Constraints

- Browser proof must use Chromium/Electron renderer and onnxruntime-web WASM.
- Large model/ONNX assets remain ignored and locally cached.
- Fixed token window requires upstream-compatible chunking/rejection policy.
- Third-party eSpeak-NG code/data notices must ship with any carried assets.

## Open questions

- Which eSpeak-NG WASM package/revision/data bundle reproduces the Python eSpeakBackend configuration (`en-us`, stress, punctuation, language-switch removal) on the corpus.
- Exact GPL source, notice, and build-artifact obligations for the chosen WASM package.
- Whether renderer performance/memory is practical with 512-token core on normal note chunks.
- Whether deterministic browser normal noise can be made reproducible against a documented JS seed contract; PyTorch bit-for-bit equality is not assumed.

## Discarded options

- Keep the original dynamic legacy ONNX graph: invalid because its attention reshape constants capture the trace token length.
- Decode all 4,000 frames then trim waveform: works but produces an impractical 1,024,000-sample output and ~25s browser synthesis.
- Use a different phonemizer without validation: rejected because the MIT `phonemize` screen produced 0/6 exact corpus strings and substantial systematic differences.
