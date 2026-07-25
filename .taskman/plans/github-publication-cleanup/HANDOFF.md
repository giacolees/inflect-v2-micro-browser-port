## Goal
Make the repository publishable as a transparent feasibility harness: accurate current status, reproducible checks, architecture/source-behavior differences, and licensing/provenance guidance.

## Scope decisions
- Keep the existing source/upstream layout to avoid breaking exports and evidence scripts.
- Keep large weights and ONNX artifacts ignored; document expected local asset paths and checksums.
- Do not represent this as a finished Obsidian plugin or issue a GO. Offline plugin-local asset replay and listening review remain gates.
- Document the Obsidian renderer result as environment-specific evidence rather than adding a launcher that starts a local Obsidian installation.

## Deliverables
- Rewrite README as the publication entry point: purpose/status, quick start, repository map, architecture, verification commands, explicit source-vs-browser behavior differences, performance/streaming observations, and limitations.
- Reconcile REPORT.md with current evidence and make its assertion history consistent with checked fixtures.
- Add a concise contributor/release checklist and ensure notices/provenance are discoverable.
- Run the documented browser/native checks after documentation changes.

## Acceptance
A first-time reader can determine what this project is, what it proves, which assets are not committed, how to reproduce validation, precisely how the browser behavior differs from upstream Python, and why it is not yet a production/Obsidian GO.