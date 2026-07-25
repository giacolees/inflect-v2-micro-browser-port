# Context

## Intent

- Prepare this feasibility harness for a clean public GitHub repository.
- Make published documentation accurately distinguish the browser/WASM port from upstream Python behavior.
- Make validation evidence and reproduction commands easy to find.

## Decisions

- Preserve the repository as a feasibility harness, not claim it is an Obsidian plugin or production-ready package.
- Keep upstream Python source and large model/ONNX files out of the default Git payload; document provenance and retrieval instead.
- Replace stale claims in README/REPORT with current evidence: browser frontend parity, waveform parity, Chromium and Obsidian renderer checks, streaming, and benchmarks.
- Organize documentation around quick start, architecture/differences, verification matrix, provenance/licensing, and explicit remaining GO gates.

## Constraints

- Production path remains local eSpeak-NG WASM + ORT-Web/WASM; no Python sidecar, hosted inference, native ORT, or substitute model.
- ephone/eSpeak is GPL-3.0-or-later; public repository must preserve notices/source provenance.
- Do not overstate listening quality, offline plugin integration, or production readiness.

## Open questions

- Whether to include an automated Obsidian renderer script (currently manually executed through isolated Obsidian profile) or document it as an environment-specific optional check.
- Whether upstream/source snapshots should remain at repository root or be moved under a clearly named `upstream/`/`reference/` directory; moving affects scripts and reproducibility.

## Discarded options

- Publishing the current README/REPORT unchanged: rejected because both have material stale NO-GO reasons and obsolete implementation claims.
- Treating the harness as an installable Obsidian plugin: rejected because plugin-local asset/offline restart validation is unfinished.
