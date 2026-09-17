# BASELINE-001 — FROZEN (CURRENT SINBAD AS-IS)

Owner MASTER TASK DIRECTIVE, 2026-09-16: Project 2 Phase 2 is OWNER ACCEPTED against main `aee0ad545c6517df707c5f969269900222f6f849` (PR #250), and BASELINE-001 becomes the immutable reference against which future Sentinel / Gatekeeper / Pilot / Co-Pilot changes are compared.

## What is frozen

The machine-readable record is `docs/project2/BASELINE-001_FREEZE.json`. It lists 31 files with the sha256 of their content on `aee0ad5` (CRLF normalized to LF), grouped by role:

- GOLD_DATASET (12): `tests/benchmark/questions/*.json` — benchmark definitions and expected outcomes.
- SCORING_OR_HARNESS_LIBRARY (7): `tests/benchmark/lib/*.js` — scoring logic, client, coding sandbox, gold loader, profile and resource sampling, report.
- HARNESS_RUNNER (1): `tools/run-sinbad-benchmark.js`.
- FAST_DETERMINISTIC_CHECK (2): `tests/benchmark/gold-dataset.test.js`, `tests/benchmark/scoring.test.js`.
- HARNESS_DOCUMENTATION (1): `tests/benchmark/README.md`.
- BASELINE_RESULT (4) and BASELINE_RESULT_CONTINUATION (4): `tests/benchmark/results/BASELINE-001/*` and `.../BASELINE-001R/*` — results, per-test reports, frozen runtime profiles, resume journals.

The record also carries: run identities (BASELINE-001 2026-09-15T10:15:49Z→21:36:23Z, 152 items; BASELINE-001R 2026-09-16T08:22:55Z→10:34:21Z, 30 items), the combined final totals (61 PASS / 34 PARTIAL / 53 FAIL / 4 ERROR, NOT MEASURED 0), the runtime identity (bridge 0.5.0, installed release 13cd522d…, instance d8389e80…, qwen3:14b bdbd181c33f2… serving both tiers, qwen3:4b installed, Ollama 0.34.0, library index 1,686 documents / 90,552 chunks built 2026-08-21, Kiwix UNAVAILABLE, host profile), the zero-regression class baseline, known limitations, unresolved findings and truth-state labels.

## Enforcement

`tests/baseline-001-freeze.test.js` runs with `npm test` (and therefore in CI `verify`). It fails if any frozen file is missing or differs from the record, or if the result files no longer reproduce the frozen run identities and combined totals.

## Rules

- Do not improve, re-run for prettier numbers, silently update or replace any frozen file. A baseline is historical evidence, not a target to repair.
- A genuinely necessary correction (for example the proposed gold v1.0.1 detector fixes and an offline re-score of the same stored answers) is a separately identified revision: `BASELINE-001-REV-n`, its own directory under `tests/benchmark/results/`, its own provenance, and a reference back to this record. The original files stay unchanged and remain recoverable from `aee0ad5`.
- Future comparisons cite BASELINE-001 by this record and commit, never by a paraphrase of its numbers.

## Truth-state labels

MERGED: VERIFIED (aee0ad5). OWNER ACCEPTED: VERIFIED for Phase 2 (the environment and the baseline as a reference), not for any measured capability. BASELINE RESULTS: VERIFIED as recorded evidence of the system as found. "The future architecture is better": NOT VERIFIED until measured against this baseline under Owner-approved thresholds.
