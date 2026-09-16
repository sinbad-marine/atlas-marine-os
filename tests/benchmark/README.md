# Sinbad benchmark harness (Project 2, Phase 2)

Reproducible, local, model-free scoring of the CURRENT Sinbad runtime (bridge/sinbad-bridge.ps1 + Ollama) exactly as found. It never refreshes the library index, never enables Kiwix, never changes models, prompts or routing, and never writes to Supabase or the Academy.

## Two tiers

| Tier | Command | What it does | Cost |
|---|---|---|---|
| FAST DETERMINISTIC BENCHMARK CHECKS | `npm run benchmark:fast` | Validates the gold datasets (every maritime anchor verbatim in the verified manifests, ids unique, provenance present) and the scorers on fixture answers. No bridge, no model, no network. | seconds |
| FULL LOCAL AI BENCHMARK RUN | `npm run benchmark:full -- --run-id BASELINE-001` | Sends the gold prompts to the live bridge `/ai/chat` with the production ARGOS command envelope, scores every answer deterministically, samples CPU/RAM/GPU around each call and writes `results.json` + `report.md` under `tests/benchmark/results/<run-id>/`. | one to several hours on CPU/iGPU |

Options: `--categories a,b` (subset), `--limit N` (first N items per category), `--resume` (continue an interrupted run from `results.partial.jsonl`), `--out dir`, `--base-url`.

The full run is not part of PR CI. Which subset belongs in CI is decided after runtimes are measured.

## Layout

- `lib/bridge-client.js` — production-equivalent ARGOS envelope + `/ai/chat` POST, status GETs.
- `lib/scoring.js` — deterministic scorers (anchors, repo-state, non-affirmation, contradiction, hallucination, citations, continuity) with documented marker lists.
- `lib/coding.js` — extracts the answer's code block and runs gold cases in an isolated `vm` context (2 s budget, no require/process).
- `lib/gold.js` — loads `questions/*.json` and proves maritime anchors against `docs/academy/*-master-source-manifest`.
- `lib/host-profile.js`, `lib/resources.js` — frozen runtime facts and resource samples (read-only).
- `lib/report.js` — summary, latency by tier, resource profile, markdown.
- `questions/*.json` — gold sets; each file documents its scoring method.
- `results/<run-id>/` — committed baseline evidence.

## Categories and how they are scored

maritime-reasoning (verified anchor groups) · coding (executed gold cases) · repo-state (CORRECT / HONEST_UNKNOWN / FABRICATED against git, gh, PROJECT_STATE, live status) · context-isolation, stale-state, multi-agent (non-affirmation of unverifiable or foreign claims) · contradiction (conflict must be named) · hallucination (nonexistence or uncertainty must be stated, no invention) · provenance-citation (citations must match indexed library titles) · failure-handling (ARGOS admission probes with fixed expected statuses; current-claim blocking; Kiwix state disclosure) · recovery (no false continuity after an aborted request) · reliability (sequential calls, empty answers, timeouts, bridge recovery flags) · latency and resources (every call).

Outcomes: PASS, PARTIAL, FAIL, NOT_SUPPORTED, ERROR. A capability the current system does not have is reported as NOT SUPPORTED in the capability column and its probes measure only honesty. Nothing is scored by a model.

## Gold dataset rules

Maritime expected answers come from the verified ISM/ISPS/MLC source texts (anchor phrases are verbatim substrings, enforced by `gold-dataset.test.js`). Repo/state truths come from git, gh, CI run records, PROJECT_STATE.json and the live bridge status, each with a provenance string. Contradiction and stale-state items pair a verified statement with a fabricated one and record the expected outcome. Hallucination items are unanswerable by construction. No expected answer was generated from model output.
