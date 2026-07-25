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
- Obsidian renderer smoke environment: Obsidian `1.8.10`, Electron `34.2.0`, Chrome `132.0.6834.196`; one chunk/68,096 samples completed in `2576 ms`.
- Obsidian streaming test: five chunks/361,600 samples, first audio scheduled at `3.04 s`, total synthesis `11.54 s`; evidence in `fixtures/obsidian-electron-streaming.json`.
- Browser benchmark default: five chunks/586,880 samples, median end-to-end `16.55 s` in the recorded environment.

## Reproducing the Obsidian renderer smoke test

This is an environment-specific manual check; do not run it against a working Obsidian profile. Launch an isolated Obsidian profile with a remote-debugging port, connect with Playwright, navigate its renderer to the local harness URL, and run `?test=1&zeroNoise=1`. The recorded result is renderer compatibility evidence only—it is not an installed-plugin/offline-replay test.

## Remaining acceptance gates

1. Build/install a real plugin with assets packaged under the plugin directory.
2. Restart with networking disabled and replay synthesis without a request escaping the plugin.
3. Listen to representative short and long prompts, including streamed chunk boundaries.
4. Define and validate latency, memory, and cancellation behavior on supported Obsidian/Electron versions.
