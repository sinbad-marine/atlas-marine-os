# GATE-SIM-001 - the accepted gate on a passage-less surface

Stored answer text -> Draft Adapter (passages: []) -> Offline Chain, one pass, labelledDelivery PROCEED -> scoring v1.0.2 with the accepted v1.0.1 text outcomes. No model, bridge or network call. A fixture measurement of the components, not of a live system.

Surface: local bridge answers of BASELINE-001 / BASELINE-001R (no passages, no [S#] markers). Answers carrying an [S#] marker: **0 of 152**. Components: adapter sinbad-draft-adapter/0-v1, segmenter sinbad-draft-segmenter/0-v1, chain sinbad-offline-chain/0-v1, scorer sinbad-benchmark-scoring/1.0.2.

| Set | FAIL | caught | flagged | delivered | PASS | clean | over-labelled | FALSE_BLOCK | falseBlockRate | harmCaughtRate |
|---|---|---|---|---|---|---|---|---|---|---|
| all | 28 | 11 | 15 | 2 | 90 | 12 | 51 | 27 | 0.3 | 0.393 |
| DEV (not in the stage-gate subset) | 18 | 6 | 10 | 2 | 77 | 12 | 46 | 19 | 0.247 | 0.333 |
| TEST (stage-gate subset v1) | 10 | 5 | 5 | 0 | 13 | 0 | 5 | 8 | 0.615 | 0.5 |
| coding | 0 | 0 | 0 | 0 | 9 | 9 | 0 | 0 | 0 | n/a |
| context-isolation | 6 | 2 | 4 | 0 | 6 | 0 | 4 | 2 | 0.333 | 0.333 |
| contradiction | 2 | 1 | 1 | 0 | 8 | 0 | 4 | 4 | 0.5 | 0.5 |
| failure-handling | 3 | 1 | 0 | 2 | 3 | 3 | 0 | 0 | 0 | 0.333 |
| hallucination | 3 | 2 | 1 | 0 | 9 | 0 | 6 | 3 | 0.333 | 0.667 |
| maritime-reasoning | 12 | 4 | 8 | 0 | 8 | 0 | 8 | 0 | 0 | 0.333 |
| multi-agent | 0 | 0 | 0 | 0 | 2 | 0 | 1 | 1 | 0.5 | n/a |
| provenance-citation | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | n/a | 0 |
| recovery | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | n/a | n/a |
| reliability | 0 | 0 | 0 | 0 | 25 | 0 | 20 | 5 | 0.2 | n/a |
| repo-state | 0 | 0 | 0 | 0 | 12 | 0 | 5 | 7 | 0.583 | n/a |
| stale-state | 1 | 1 | 0 | 0 | 8 | 0 | 3 | 5 | 0.625 | 1 |

Blocking causes behind the withheld answers: FALSE_CERTAINTY 36, GATE.VOCABULARY_BOUND 22, GATE.VOLATILE_CLAIMS_LIVE 19, UNSUPPORTED_FACTUAL_ASSERTION 13, GATE.SPECIFICITY_SUPPORTED 12.

Rows without stored answer text (9; they count as ungated): HL-20, FH-01, FH-02, FH-03, FH-04, FH-05, FH-06, RC-01, RC-02. Code blocks are skipped by the adapter, so coding answers are not examined.

Reading: with no passages nothing can be VERIFIED, so every reserved term, specific value or present-state word inside an answer blocks it - including honest "I cannot know that" answers. The gate must never enforce on a passage-less surface. This table is the reference any precision change is measured against: DEV for tuning, TEST held out.

