# Verification evidence

All timing values are host-specific measurements, not performance guarantees.

## Automated checks

| Command | Evidence |
| --- | --- |
| `npm run verify-browser-port` | ONNX checker, native two-graph execution, padding parity, WAV validation, Chromium frontend fixtures, Chromium synthesis smoke run |
| `node scripts/frontend_parity.mjs` | Six browser frontend fixtures pass normalized text, phonemes, and blank-interspersed IDs |
| `node scripts/export_browser_waveform.mjs && .venv/bin/python scripts/compare_browser_waveform.py` | Native ORT / Chromium zero-noise waveform comparison |
| `npm run benchmark-browser` | Repeatable end-to-end Chromium benchmark; set `TEXT` to benchmark an exact note |
| `npm run benchmark-python-onnx` | Warm CPU Python/PyTorch vs. native ONNX comparison |

## Recorded results

- Browser/native zero-noise comparison: 68,096 samples, latent max error `3.34e-06`, waveform max error `1.19e-04`, RMSE `1.99e-06`, correlation `0.9999999995`.
- Python/PyTorch vs. native ONNX CPU benchmark for the simple prompt: median `1082 ms` vs. `327 ms` (native ONNX `3.31×` faster). This does not predict browser performance.
- Electron renderer smoke environment: Electron `34.2.0`, Chrome `132.0.6834.196`; one chunk/68,096 samples completed in `2576 ms`.
- Electron streaming test: five chunks/361,600 samples, first audio scheduled at `3.04 s`, total synthesis `11.54 s`; evidence in `fixtures/electron-streaming.json`.
- Browser benchmark default: five chunks/586,880 samples, median end-to-end `16.55 s` in the recorded environment.

## Reproducing an Electron renderer smoke test

This is an environment-specific manual check. Launch an isolated Electron renderer with a remote-debugging port, connect with Playwright, navigate its renderer to the local harness URL, and run `?test=1&zeroNoise=1`. The result is renderer compatibility evidence only; downstream applications must validate their own packaging and offline behavior.

## Remaining acceptance work

1. Complete listening review for representative short and long streamed text.
2. Define and validate latency, memory, and cancellation behavior for a target environment.
3. Validate runtime compatibility, asset packaging, and offline behavior in each downstream application.
