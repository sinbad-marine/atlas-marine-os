# Project 2 — Phase 4.3a, step A2: offline shadow-capture evaluator

Status: implemented, tested, **not** Owner-accepted. Nothing here records an acceptance.
Base: `origin/main` `4d20b3440217db51260e37ce50cb9ce6e2d557ab`. Built as SINBAD **TASK-5** through the accepted Participation Gate (opened, preflight PASS, delegated, then implemented; the result is ingested back through the gate). Owner GO: "Phase 4.3a A2 için GO veriyorum".

## What it is

The evaluation half of the Phase 4.3a replay shadow (design: `PHASE_4_3_SHADOW_DESIGN_PROPOSAL.md`). It takes **captured** answers of the cloud function `sinbad-answer` from a local directory and answers: what would the gate have done with them? It does not call the function, any cloud endpoint or a model, delivers and labels nothing, and changes no accepted component. The capture client that writes the records (A3) does not exist yet.

```
capture record -> A1 mapper -> Draft Adapter v0 -> Offline Chain v0 -> gate record
              -> v1.0.1 text outcome (accepted detectors, existing runner code)
              -> v1.0.2 delivery cell (ungated versus gated, same answers)
              -> v1.0.3 content safety
              -> ONE aggregate report
```

Files: `sinbad-ai-core/shadow/capture-evaluator.js` (pure: record validation, per-capture pipeline, report builder), `tools/evaluate-shadow-capture.js` (reads the directory, scores through the existing runner, writes the report), `tests/sinbad-shadow-evaluator.test.js`, this document. The A1 mapper, Draft Adapter, Offline Chain and the scorers are used unchanged and pinned by hash in the test.

## Capture record format (what A3 must write)

One JSON file per capture in a directory **outside the repository**, record `sinbad-shadow-capture-record/0-v1`, exact keys:

| key | meaning |
|---|---|
| `version` | `sinbad-shadow-capture-record/0-v1` |
| `captureId` | unique id (grammar `[A-Za-z0-9][A-Za-z0-9._:-]*`, at most 90 characters) |
| `itemId` | the gold prompt id from the stage-gate plan, for example `CI-01`, `MR-ISM-05` (the prompt text is not stored) |
| `capturedAt` | capture time, integer milliseconds |
| `workspaceId` | the workspace the request ran in |
| `language` | `en`, `tr`, `en-US` ... |
| `httpStatus` | the HTTP status (`0` when there was none) |
| `latencyMs` | integer or `null` |
| `response` | the function's JSON as received, or `null` |
| `error` | short text or `null` |

The evaluator builds the `TaskContext` of a replay itself from the record: workspace-scoped evidence (`workspace:<id>`), no authority references, one-hour lifetime.

## Per-capture result

`GATED` (mapped, adapted, gate record from a verified transcript), `REFUSED` (the A1 mapper refused: non-privileged access, any mode other than `private-rag`, no sources, malformed or duplicate markers, scope mismatch), `ADAPTER_BLOCKED` (for example more than 256 claims), `ERROR` (HTTP failure, no body, unverified transcript, exception). Nothing is dropped silently: every capture lands in exactly one class and is counted by reason. Only `GATED` captures are scored.

## The report

`sinbad-shadow-capture-report/0-v1`: intake (files seen, invalid files by reason, duplicate and unknown items), capture classes and reasons, response modes, items of the plan not captured, marker statistics (claims, claims with a marker, share, captures with unknown markers), gate outcomes and deliveries, **blocking causes ranked by rule id**, `GATE_RECORD_INVALID` items, and scoring: gated versus ungated on the same answers (v1.0.2), content safety (v1.0.3, `unsafeDeliveredCount`, unjudgeable rows), per category, and per item (public gold id, text outcome, delivery, both cells). A digest seals it. It carries no clock.

**Privacy.** The report holds counts, enumerations and public gold item ids only: no answer text, source title, document id, workspace id, capture id, mime type or spoken text (tested by searching the serialized report for each). Captures and the report must be outside the repository: the tool refuses a captures directory or an output path inside it, never overwrites (`wx`) and writes nothing but the report. The answer text and titles exist only transiently inside the process for text scoring. Moving a report into the repository is a separate, manual, Owner-gated step.

## Usage

`node tools/evaluate-shadow-capture.js --captures <dir> --out <report.json>`. Exit 0 and a one-line summary on success; 1 on any refusal (no valid captures, too many files, inside the repository, output exists).

## Limits (also in every report)

- Identity-only content hashes: the response carries no passage text, so evidence consistency cannot be checked; a citation proves existence, not support (the A1 limits).
- Replay of a fixed gold prompt set, not real user traffic; restricted (non-privileged) responses are counted as refused and never gated.
- The chain runs offline on the captured answer; nothing was delivered, labelled or blocked for anyone.
- The report states what the gate does on these captures. It is not a threshold, not a D6 decision and not an acceptance.
- Synthetic captures in the tests prove the mechanism, not the production behavior.

## What SINBAD can do after this phase that it could not do before

Before: SINBAD could map one captured `sinbad-answer` response into Draft Adapter input but had no way to evaluate a set of captures or report what the gate does on them.
After: SINBAD can evaluate a directory of captured responses offline (map, adapt, gate, score ungated versus gated) and produce a privacy-safe aggregate report, proven on synthetic captures, ready for real captures once A3 is authorized.

## Holds

Phase 4.3a A3-A6 (capture client, cloud calls, aggregate report in the repository, state sync) and Engine Room stay on HOLD. No cloud call, no production change, no wiring, no Owner acceptance recorded; `PROJECT2_STATE.json`, Engine Room files, `app.js`, `package.json`, the ARGOS policy and the accepted Participation Gate files are unchanged.
