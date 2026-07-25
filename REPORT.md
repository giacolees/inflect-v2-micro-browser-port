# Inflect Micro v2 browser-port feasibility report

## Decision: **NO-GO**

Do not integrate Inflect Micro v2 into the Obsidian plugin yet. The legacy single graph was replaced with a padded, fixed-width core and a duration-trimmed dynamic decoder. Both execute in actual Chromium through ONNX Runtime Web/WASM for four- and eight-token smoke inputs, and the padded Python core agrees with the unpadded reference to a maximum waveform error of `5.05e-08`. The GPL-approved eSpeak-NG WASM frontend now matches all six corpus cases for normalized text, phoneme strings, and blank-interspersed IDs. Remaining acceptance gates are end-to-end seeded corpus synthesis, WAV playback/offline cache, renderer measurements, numerical audio parity, and listening evidence.

## Reproducibility

| Item | Value |
| --- | --- |
| Upstream | `owensong/Inflect-Micro-v2` tag `v2.0.0`, commit `9598ed6d37166d05df6260322012f6938ffe9141` (annotated tag object `ff40219f68ccacb8fba4a24fa77ccb53614bf107`) |
| Weights | `model.pth`, 37,529,995 bytes, SHA-256 `3eede065c9ccfa88ade0a5a9a5c23de34afcbbb32213e59aad44d5cf100fdee8` |
| Host | macOS 26.3 (25D125), MacBookPro18,3, Apple M1 Pro, 16 GB |
| Python / PyTorch | CPython 3.11 / torch 2.10.0 |
| ONNX / ORT diagnostic | onnx 1.19.1 / onnxruntime 1.23.2 |
| Renderer | Google Chrome 150.0.7871.184 headless via Playwright Core 1.55.0 |
| Browser runtime | `onnxruntime-web` 1.23.2, `wasm` execution provider, one thread |
| Export | `PYTHONPATH=source:source/runtime .venv/bin/python scripts/export_onnx.py`; legacy `torch.onnx.export`, opset 18 |

All large inputs and generated artifacts are ignored. `README.md` documents their local-cache locations and checksum. `npm run verify-browser-port` is the one-command evidence check once those assets are present.

## Architecture and deterministic export

The upstream public API normalizes text, eSpeak-NG phonemizes it, maps symbols to IDs, inserts blank ID `0`, predicts durations, expands the prior, samples a 192-channel latent, reverses a four-flow residual coupling block, then invokes a HiFi-GAN/VITS-family decoder. The model is one fixed English male voice and emits 24,000 Hz mono float32.

`scripts/export_onnx.py` now exports two graphs:

| Graph | Input/output | Type and shape |
| --- | --- | --- |
| Core | `tokens` | `int64`, fixed `[1, 512]`, zero-padded |
| Core | `lengths` | `int64`, `[1]` actual non-padding count |
| Core | `latent_noise` | `float32`, `[1, 192, 4000]` |
| Core | `latent`, `frame_lengths` | `float32 [1,192,4000]`, `int64 [1]` |
| Decoder | `latent` | `float32`, `[1,192,frames]` |
| Decoder | `waveform` | `float32`, `[1,1,frames*256]` |

The maximum frame length is explicit (`4000`), as is the latent noise input. This removes runtime-hidden random sampling; a caller can generate a seeded normal tensor outside the graph. Speed is fixed at 1.0 and variation is represented by the scale of `latent_noise`. Fixing the core token window to 512 prevents legacy tracing from capturing a particular attention reshape; `lengths` and masks exclude zero padding. Browser code reads `frame_lengths`, slices the latent prefix, then invokes the dynamic decoder, so it does not generate the former 1,024,000-sample tail. Both graphs pass `onnx.checker`; machine-readable metadata is `fixtures/onnx-metadata.json`.

## Frontend and licensing

The source frontend is `source/inflect_nano_v2_frontend.py`: regex/`num2words` normalization followed by `phonemizer`'s `EspeakBackend` and native eSpeak-NG library/data. The corpus in `fixtures/prompts.json` covers prose, punctuation, numbers, abbreviations, non-ASCII names, and long text. Python frontend records and corresponding ID vectors are retained in `fixtures/python-baseline-metadata.json` and `fixtures/python-token-ids.json`.

The browser frontend is implemented in `browser/frontend.mjs` using GPL-3.0-or-later `ephone` 1.0.2, an eSpeak-NG WASM build pinned in `package.json`. It ports the normalization required by the corpus, restores punctuation that ephone renders as commas, maps every phoneme character into the Inflect symbol IDs, inserts blank ID `0`, and splits source text using the upstream 280-character policy before enforcing the 512-ID core limit. `node scripts/frontend_parity.mjs` runs actual Chromium and passes all six corpus cases for normalized text, phoneme string, and IDs. GPL source/provenance/hash requirements are recorded in `THIRD_PARTY_NOTICES.md` and `third_party/EPHONE_COPYING.txt`.

## Python baseline and audio checks

With fixed seed `0` and variation `0.667`, Python generated six deterministic baseline WAVs. They validate as finite mono 24 kHz data; all peaks are within `[-1, 1]`. Sample counts range from 68,096 (simple prose) to 439,104 (long text); details are in `fixtures/wav-validation.json`. Generated WAVs are local artifacts, not committed blobs.

The padded-core implementation was checked against the equivalent unpadded PyTorch calculation for an eight-token, zero-noise case: retained latent maximum error is `1.91e-06` and waveform maximum error is `5.05e-08`. Native ORT executes both four- and eight-token padded inputs, producing 4,352 and 7,424 samples respectively. The browser now uses documented mulberry32 plus Box-Muller seeded normal noise (seed `0` in the proof) and encodes finite output as RIFF/WAVE float32, 24 kHz, mono; its header and byte length are validated. Python-to-browser waveform/correlation and spectral comparison for the same seeded noise remain unperformed because the JavaScript PRNG is deliberately reproducible but not PyTorch-bit-identical. No manual listening conclusion is available.

## Actual Chromium ORT Web/WASM result

`browser/index.html` loads the local core and decoder ONNX assets and invokes only `onnxruntime-web` WASM. `scripts/browser_proof.mjs` serves them with cross-origin isolation and launches the installed Chrome binary; it does not use Node ORT, a server inference path, CDN inference, or a remote TTS call.

Chrome executes the eight-token padded smoke case: core and decoder model setup plus inference took about 1.06 seconds on the stated host, predicted 29 frames, and returned a finite 7,424-sample waveform. It also executes frontend-generated IDs for the simple corpus prompt: 107 IDs, 266 frames, and 68,096 finite samples. A cold-browser corpus pass (`scripts/corpus_browser.mjs`) completed the five single-chunk cases with finite, valid WAV buffers; elapsed setup+synthesis ranged from about 2.57 to 4.89 seconds, and per-case results are in `fixtures/browser-corpus-results.json`. The long prompt was deliberately not reported as passed: chunk concatenation/pause/fade runtime is not yet implemented. This is actual Chromium ORT Web/WASM evidence for the two-graph path. `npm run verify-browser-port` validates both graphs, native four/eight-token runs, padding parity, WAVs, the Chromium frontend parity fixture, and the Chromium synthesis smoke run; it still prints `GO_NO_GO_SUMMARY NO-GO` because long-text, offline cache, warm/memory, and end-to-end audio evidence remain unresolved.

## Permissive frontend alternative

The GPL-3.0-or-later license of eSpeak-NG originally blocked the browser frontend under the Apache-compatible constraint. The user explicitly approved GPL-3.0-or-later distribution for this plugin, so ephone/eSpeak-NG WASM is now the chosen frontend. A permissive-alternative audit remains documented for comparison: MIT `phonemize` 2.0.0 achieved **0/6 exact phoneme matches** and only **4.9%–9.4% character-position agreement** across the corpus. Its output is retained in `fixtures/permissive-g2p-evaluation.json` and is not used by the model.

## Caveats and required next work

The trace-captured-attention, untrimmed-decoder, browser frontend parity, seeded-noise generation, and basic WAV encoding issues are resolved in this feasibility harness. The result remains **NO-GO**: long-text chunk synthesis/pauses/fades, durable local cache plus network-disabled replay, warm timing and peak renderer memory, shared-noise Python/browser numerical comparison, and manual listening evidence are still absent. The plugin must be distributed GPL-3.0-or-later-compatible with ephone/eSpeak corresponding-source and notices. Do not use a Python sidecar, native ORT, or substitute model as a workaround under this decision.
