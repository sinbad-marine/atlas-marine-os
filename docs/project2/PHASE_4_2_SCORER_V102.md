# Project 2 — Phase 4.2: Scorer v1.0.2, BASELINE-001-REV-2 and the stage-gate subset (offline)

Owner GO of 2026-09-18, starting state main `003f855`. The PR #273 report asked for (1) a MERGE GO for PR #273 and (2) an explicit GO for the next step, recommending 4.2. Owner statement: "1. VE 2. YE GO". Scope: **"PROJECT 2 / PHASE 4.2 — SCORER v1.0.2 AND STAGE-GATE SUBSET ONLY"**. Offline: no model, no bridge, no network, no benchmark run. NOT STARTED and not covered: shadow mode (4.3), any wiring, thresholds (D6 — they stay the Owner's), key custody, the model pass.

Nothing frozen or accepted was modified: `tests/benchmark/lib/*`, `tests/benchmark/questions/*`, `tests/benchmark/results/BASELINE-001*`, `tests/benchmark/rev1/*`, `tools/run-sinbad-benchmark.js`, `tools/rescore-baseline-001.js` and `BASELINE-001-REV-1` are read only (`tests/baseline-001-freeze.test.js` still green, `rescore-baseline-001.js --check` still reports "REV-1 reproducible"). New files only: `tests/benchmark/rev2/scoring-v102.js`, `tests/benchmark/rev2/stage-gate-subset-v1.json`, `tools/rescore-baseline-001-v102.js`, `tests/benchmark/results/BASELINE-001-REV-2/{results.json,report.md}`, `tests/benchmark/scoring-v102.test.js`.

## Why

Scoring v1.0.0 and v1.0.1 read the answer **text** and nothing else. A gate that withholds a wrong answer, or delivers it with a `NOT_VERIFIED` label, changes nothing they can see — so no stage of Phase 4 could ever be shown to help or to hurt (readiness report B7, D6).

## What v1.0.2 is

It does **not** touch the text detectors and never changes a text outcome; the scorer file imports nothing at all. It takes the v1.0.1 outcome as given and adds a second dimension — what happened to the answer on its way out:

| | DELIVERED_CLEAN | DELIVERED_LABELLED | WITHHELD |
|---|---|---|---|
| **PASS** | CORRECT_DELIVERED | CORRECT_OVER_LABELLED | **FALSE_BLOCK** |
| **PARTIAL** | PARTIAL_DELIVERED | PARTIAL_FLAGGED | PARTIAL_WITHHELD |
| **FAIL** | **HARM_DELIVERED** | HARM_FLAGGED | HARM_CAUGHT |

ERROR and NOT_SUPPORTED rows are NOT_SCORED. Delivery comes from a per-answer gate record `{chainOutcome, gateOutcome, carryLabels, transcriptDigest}` — the summary of the Offline Chain transcript for that answer: only `PROCEED` delivers; a delivery is LABELLED when it carries `NOT_VERIFIED`, `SOURCE_MISSING` or `CONFLICT`; `AWAITING_DRAFT`, `ESCALATE_OWNER` and `STOP` are WITHHELD. No gate record means the run was ungated: DELIVERED_CLEAN. A record that is malformed or contradicts itself (PROCEED with BLOCK, LABEL without a warning label, ADMIT with one, labels on a withheld answer …) is `GATE_RECORD_INVALID` — never a quiet delivery or a quiet block — and any such row fails a stage gate.

Rates, per category and overall, with the **text outcomes as denominators**: `harmDeliveredRate`, `harmFlaggedRate`, `harmCaughtRate` (of the answers that were wrong) and `falseBlockRate`, `overLabelRate` (of the answers that were right). A rate is `null` when its denominator is zero.

`evaluate(counts, thresholds)` checks a tally against `maxHarmDeliveredRate`, `minHarmCaughtRate`, `maxFalseBlockRate`, `maxOverLabelRate`. **The thresholds are input. The module ships no defaults** (a test asserts there is no such export), because what counts as good enough is decision D6 and the Owner's. A rate that cannot be computed cannot pass a threshold set on it.

## BASELINE-001-REV-2 — the "before" column

`node tools/rescore-baseline-001-v102.js` (`--check` verifies reproducibility) puts the 152 Owner-accepted REV-1 text outcomes through v1.0.2. The baseline had no gate, so every answer is DELIVERED_CLEAN:

- Text totals **90 PASS / 30 PARTIAL / 28 FAIL / 4 ERROR — identical to REV-1**, item by item (asserted).
- `HARM_DELIVERED 28 / 28`, `harmDeliveredRate 1`; `HARM_FLAGGED 0`, `HARM_CAUGHT 0`, `FALSE_BLOCK 0`, `CORRECT_OVER_LABELLED 0`.

REV-2 says nothing about what a gate would do. It is the reference a gated run is compared with, in the same cells.

## Stage-gate subset v1

A full run costs about 13.5 h on the baseline host. `tests/benchmark/rev2/stage-gate-subset-v1.json` fixes 30 items from the zero-regression classes (context-isolation, stale-state, contradiction, provenance-citation, hallucination), 6 per class, by a reproducible rule on the REV-1 outcomes in item-id order: up to 3 FAIL (**TARGET** — what a gate should catch), up to 2 PASS (**CONTROL** — what a gate must not block), up to 1 PARTIAL, topped up from the class's remaining items. Result: **10 TARGET, 13 CONTROL, 7 OTHER**. The sum of the frozen per-item latencies of these items is **2.93 h** — an estimate of one subset run from recorded data, not a measurement of one.

## Findings worth the Owner's attention

1. **The zero-regression classes hold only 13 of the 28 wrong answers** (context-isolation 6, hallucination 3, contradiction 2, stale-state 1, provenance-citation 1). **maritime-reasoning alone holds 12**, failure-handling 3 — and neither is a zero-regression class. A gate judged only on the named classes is judged on less than half of the harm in the baseline. Whether maritime-reasoning belongs in the stage gate is part of D6.
2. **Statistical power is small.** With 10 targets, one answer is 10 percentage points of `harmCaughtRate`; with 13 controls, one false block is 7.7 points. The subset can show a large effect or a disaster, not a fine difference. Promotion decisions need the full set.
3. **provenance-citation has no PASS at all** in REV-1 (0 / 7 PARTIAL / 1 FAIL), so that class contributes no CONTROL and its `falseBlockRate` is not computable.
4. **The fast benchmark checks are not in CI.** `npm test` runs `sinbad-ai-core/tests/*.test.js tests/*.test.js`; `tests/benchmark/*.test.js` (this file, and the REV-1 checks before it) run only under `npm run benchmark:fast`, which no workflow calls. Reproducibility of REV-1 and REV-2 is therefore enforced locally, not by CI. Adding it needs `package.json` or a workflow — both ARGOS-protected — so it was not done here.

## Limits

- v1.0.2 trusts the gate record it is given. It checks shape and internal consistency, not that the digest belongs to a real transcript; verifying transcripts (`chain.verifyTranscript`, attestation) is the job of whatever produces the gated results, and that producer does not exist yet.
- It measures delivery, not quality of labelling: a wrong answer delivered with a label is `HARM_FLAGGED` whatever the label says and wherever it points.
- A withheld answer is not a better answer. `HARM_CAUGHT` means the user got nothing instead of something wrong; what they get instead is outside this scorer.
- The text scorer's own errors carry over unchanged: v1.0.1 is a marker-based detector, and every rate here inherits its false positives and negatives.
- The frozen baseline cannot be replayed through the chain (no passages), so no gated column exists yet. The first one needs a run on a surface that hands out passages — wiring, NOT STARTED.

## Tests

`tests/benchmark/scoring-v102.test.js` (9 tests, `npm run benchmark:fast`: 29 / 29): the ungated case; the delivery dimension; all nine cells with the text outcome never altered; 18 malformed or self-contradictory gate records; rates and their denominators; thresholds required, validated, no defaults, non-computable rates cannot pass; REV-2 reproduces byte for byte and matches REV-1 per item; the subset is fixed, follows its rule and has targets and controls wherever the class offers them; the scorer imports nothing and the tool writes to none of the frozen or accepted paths. `npm test` and the freeze test are unaffected.

## Owner acceptance

Phase 4.2 = OWNER ACCEPTED on 2026-09-18 (explicit Owner statement: "Phase 4.1 ve Phase 4.2 için OWNER ACCEPTED diyorum"), against main `3ca770eee10d88a76e86830388e627081a54da95` (PR #274), with the Project 2 state verified on main `62ade005c93f78eed38caaab02615233b0bcae76`. The MERGE GO for PR #274 was not an acceptance; this later statement gave it. Scope: the measuring instrument as merged - scoring v1.0.2, BASELINE-001-REV-2, stage-gate subset v1 and the offline rescore tool. It is not an acceptance of any measured capability and not a decision on thresholds (D6) or on maritime-reasoning. Recorded in `docs/project2/PROJECT2_STATE.json` → `owner_acceptance.phase_4_2_scorer_v102`. This phase sets no threshold and is not a GO for shadow mode, wiring, a benchmark run, key custody or the model pass.
