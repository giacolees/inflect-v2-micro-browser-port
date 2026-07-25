# Browser implementation notes

This repository documents a browser-only implementation of the Inflect Micro v2
inference path. The renderer combines eSpeak-compatible WASM phonemization,
ONNX Runtime Web/WASM execution, Web Audio chunk scheduling, and WAV encoding
without a server-side inference service.

## Runtime flow

1. `browser/frontend.mjs` normalizes input, splits long text, phonemizes each
   chunk with `ephone`, and converts supported IPA symbols to
   blank-interspersed model IDs.
2. `browser/inference.mjs` loads the fixed-width core and dynamic decoder ONNX
   graphs with the WASM execution provider. In Electron renderers it
   temporarily hides Node's `process` while sessions are created so ORT selects
   the browser backend.
3. The core receives `[1,512]` token IDs, a `[1,192,4000]` latent-noise tensor,
   and the real token length. Its predicted frame length trims the latent
   before the decoder runs.
4. `browser/app.mjs` receives each decoded waveform as it completes, schedules
   it through Web Audio, and builds a final 24 kHz float WAV with helpers in
   `browser/runtime.mjs`.

## Recorded verification

- `ephone@1.0.2` matches all six frontend fixtures for normalized text,
  phonemes, and blank-interspersed IDs.
- The two ONNX graphs run in Chromium through ORT-Web/WASM.
- For the recorded zero-noise input, native ORT and Chromium ORT-Web produce
  68,096 samples with latent max error `3.34e-06`, waveform max error
  `1.19e-04`, RMSE `1.99e-06`, and correlation `0.9999999995`.
- The recorded Electron streaming run scheduled its first of five chunks at
  `3.04 s` and completed 361,600 samples at `11.54 s`.

These measurements are reproducible evidence for the documented configuration,
not device-independent performance guarantees. See
[docs/VERIFICATION.md](docs/VERIFICATION.md) for commands and the complete
environment notes.

## Integration considerations

The browser path intentionally differs from `source/inference.py`: it uses
eSpeak WASM rather than native eSpeak, padded core inputs plus a separate
decoder, seeded JavaScript noise, and browser chunk scheduling. The explicit
zero-noise comparison is the cross-runtime waveform check. See
[docs/SOURCE_DIFFERENCES.md](docs/SOURCE_DIFFERENCES.md) when adapting the
implementation.

Packaging owners remain responsible for their target runtime, performance
budgets, cancellation behavior, offline asset delivery, listening evaluation,
and GPL/provenance obligations.
