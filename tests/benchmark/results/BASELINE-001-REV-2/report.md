# BASELINE-001-REV-2 - delivery dimension added to the accepted REV-1 text outcomes

BASELINE-001-REV-1 text outcomes (scoring v1.0.1, unchanged) put through scoring v1.0.2, which adds the delivery dimension. The baseline had no gate: every answer is DELIVERED_CLEAN. No model or bridge call, no text re-scoring.

Scorers: text `sinbad-benchmark-scoring/1.0.1`, delivery `sinbad-benchmark-scoring/1.0.2`. Text totals match REV-1: **true**.

| Category | tests | PASS | PARTIAL | FAIL | HARM_DELIVERED | HARM_FLAGGED | HARM_CAUGHT | FALSE_BLOCK | harmDeliveredRate |
|---|---|---|---|---|---|---|---|---|---|
| coding | 10 | 9 | 1 | 0 | 0 | 0 | 0 | 0 | n/a |
| context-isolation | 12 | 6 | 0 | 6 | 6 | 0 | 0 | 0 | 1 |
| contradiction | 10 | 8 | 0 | 2 | 2 | 0 | 0 | 0 | 1 |
| failure-handling | 8 | 3 | 1 | 3 | 3 | 0 | 0 | 0 | 1 |
| hallucination | 20 | 9 | 7 | 3 | 3 | 0 | 0 | 0 | 1 |
| maritime-reasoning | 32 | 8 | 12 | 12 | 12 | 0 | 0 | 0 | 1 |
| multi-agent | 3 | 2 | 1 | 0 | 0 | 0 | 0 | 0 | n/a |
| provenance-citation | 8 | 0 | 7 | 1 | 1 | 0 | 0 | 0 | 1 |
| recovery | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | n/a |
| reliability | 25 | 25 | 0 | 0 | 0 | 0 | 0 | 0 | n/a |
| repo-state | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | n/a |
| stale-state | 10 | 8 | 1 | 1 | 1 | 0 | 0 | 0 | 1 |
| **all** | 152 | 90 | 30 | 28 | 28 | 0 | 0 | 0 | 1 |

Reading: without a gate every wrong answer reached the user (harmDeliveredRate 1 wherever there is a FAIL) and nothing was blocked or labelled. This is the reference a gated run is compared with; it says nothing about what a gate would do.

## Stage-gate subset

30 items (10 TARGET, 13 CONTROL, 7 OTHER) from context-isolation, stale-state, contradiction, provenance-citation, hallucination. Rule: per class in item-id order: up to 3 FAIL (TARGET), up to 2 PASS (CONTROL), up to 1 PARTIAL, topped up to 6 from the class's remaining items. Sum of the frozen baseline latencies of these items: 2.93 h (sum of the frozen per-item latencies of these items on the baseline host; an estimate of one subset run, not a measurement of one).

