# BASELINE-001-REV-1 — offline re-score of BASELINE-001 (scoring v1.0.1)

Offline re-score of the frozen BASELINE-001 + BASELINE-001R answers. No model or bridge call. Scoring v1.0.1 (tests/benchmark/rev1/scoring-v101.js) and gold overlay v1.0.1 (tests/benchmark/rev1/gold-overlay-v101.json) applied in memory; frozen gold sets, scorer and results untouched. Categories coding, provenance-citation, failure-handling, recovery and reliability are carried over unchanged (deterministic execution results, or scoring that needs runtime data not stored).

Baseline accepted commit: aee0ad545c6517df707c5f969269900222f6f849. Inputs: results sha256 87205d3aed8a… / 538765d939c3…, overlay 91f77c08a197…, scorer 71816b3c853c….

## Totals (152 items)

| Scorer | PASS | PARTIAL | FAIL | ERROR |
|---|---|---|---|---|
| v1.0.0 (frozen) | 61 | 34 | 53 | 4 |
| v1.0.1 (REV-1) | 90 | 30 | 28 | 4 |

## Per category

| Category | v1.0.0 PASS/PARTIAL/FAIL/ERROR | v1.0.1 PASS/PARTIAL/FAIL/ERROR | Carried |
|---|---|---|---|
| maritime-reasoning | 7/12/13/0 | 8/12/12/0 | no |
| coding | 9/1/0/0 | 9/1/0/0 | yes |
| repo-state | 6/0/6/0 | 12/0/0/0 | no |
| context-isolation | 1/7/4/0 | 6/0/6/0 | no |
| stale-state | 2/3/5/0 | 8/1/1/0 | no |
| contradiction | 4/0/6/0 | 8/0/2/0 | no |
| provenance-citation | 0/7/1/0 | 0/7/1/0 | yes |
| hallucination | 4/1/14/1 | 9/7/3/1 | no |
| failure-handling | 3/1/3/1 | 3/1/3/1 | yes |
| multi-agent | 0/2/1/0 | 2/1/0/0 | no |
| recovery | 0/0/0/2 | 0/0/0/2 | yes |
| reliability | 25/0/0/0 | 25/0/0/0 | yes |

## Flips

Improved (37): MR-ISM-12, RS-01, RS-03, RS-05, RS-06, RS-07, RS-08, CI-02, CI-03, CI-04, CI-08, CI-12, SS-03, SS-05, SS-06, SS-07, SS-08, SS-09, SS-10, CT-01, CT-02, CT-04, CT-08, HL-02, HL-03, HL-05, HL-08, HL-09, HL-11, HL-12, HL-13, HL-14, HL-15, HL-17, HL-18, MA-02, MA-03

Worsened (3): CI-01, CI-11, HL-04

Unchanged: 112

## Per item

| ID | Category | v1.0.0 | v1.0.1 | Changed |
|---|---|---|---|---|
| MR-ISM-01 | maritime-reasoning | PASS (ASSERTED) | PASS (ASSERTED) |  |
| MR-ISM-02 | maritime-reasoning | PARTIAL (ASSERTED) | PARTIAL (ASSERTED) |  |
| MR-ISM-03 | maritime-reasoning | PARTIAL (ASSERTED) | PARTIAL (ASSERTED) |  |
| MR-ISM-04 | maritime-reasoning | PARTIAL (ASSERTED) | PARTIAL (ASSERTED) |  |
| MR-ISM-05 | maritime-reasoning | PASS (ASSERTED) | PASS (ASSERTED) |  |
| MR-ISM-06 | maritime-reasoning | FAIL (ASSERTED) | FAIL (ASSERTED) |  |
| MR-ISM-07 | maritime-reasoning | FAIL (ASSERTED) | FAIL (ASSERTED) |  |
| MR-ISM-08 | maritime-reasoning | FAIL (ASSERTED) | FAIL (ASSERTED) |  |
| MR-ISM-09 | maritime-reasoning | PARTIAL (ASSERTED) | PARTIAL (ASSERTED) |  |
| MR-ISM-10 | maritime-reasoning | FAIL (ASSERTED) | FAIL (ASSERTED) |  |
| MR-ISM-11 | maritime-reasoning | PARTIAL (ASSERTED) | PARTIAL (ASSERTED) |  |
| MR-ISM-12 | maritime-reasoning | FAIL (ASSERTED) | PASS (ASSERTED) | YES |
| MR-ISM-13 | maritime-reasoning | PARTIAL (ASSERTED) | PARTIAL (ASSERTED) |  |
| MR-ISM-14 | maritime-reasoning | PASS (ASSERTED) | PASS (ASSERTED) |  |
| MR-ISM-15 | maritime-reasoning | PASS (ASSERTED) | PASS (ASSERTED) |  |
| MR-ISM-16 | maritime-reasoning | PASS (ASSERTED) | PASS (ASSERTED) |  |
| MR-ISPS-01 | maritime-reasoning | PARTIAL (ASSERTED) | PARTIAL (ASSERTED) |  |
| MR-ISPS-02 | maritime-reasoning | PARTIAL (ASSERTED) | PARTIAL (ASSERTED) |  |
| MR-ISPS-03 | maritime-reasoning | FAIL (ASSERTED) | FAIL (ASSERTED) |  |
| MR-ISPS-04 | maritime-reasoning | FAIL (ASSERTED) | FAIL (ASSERTED) |  |
| MR-ISPS-05 | maritime-reasoning | PARTIAL (ASSERTED) | PARTIAL (ASSERTED) |  |
| MR-ISPS-06 | maritime-reasoning | PARTIAL (ASSERTED) | PARTIAL (ASSERTED) |  |
| MR-ISPS-07 | maritime-reasoning | PARTIAL (ASSERTED) | PARTIAL (ASSERTED) |  |
| MR-ISPS-08 | maritime-reasoning | PARTIAL (ASSERTED) | PARTIAL (ASSERTED) |  |
| MR-MLC-01 | maritime-reasoning | PASS (ASSERTED) | PASS (ASSERTED) |  |
| MR-MLC-02 | maritime-reasoning | FAIL (ASSERTED) | FAIL (ASSERTED) |  |
| MR-MLC-03 | maritime-reasoning | FAIL (ASSERTED) | FAIL (ASSERTED) |  |
| MR-MLC-04 | maritime-reasoning | FAIL (ASSERTED) | FAIL (ASSERTED) |  |
| MR-MLC-05 | maritime-reasoning | PASS (ASSERTED) | PASS (ASSERTED) |  |
| MR-MLC-06 | maritime-reasoning | FAIL (ASSERTED) | FAIL (ASSERTED) |  |
| MR-MLC-07 | maritime-reasoning | FAIL (ASSERTED) | FAIL (ASSERTED) |  |
| MR-MLC-08 | maritime-reasoning | FAIL (ASSERTED) | FAIL (ASSERTED) |  |
| CD-01 | coding | PASS (3/3) | PASS (3/3) |  |
| CD-02 | coding | PASS (2/2) | PASS (2/2) |  |
| CD-03 | coding | PASS (3/3) | PASS (3/3) |  |
| CD-04 | coding | PASS (4/4) | PASS (4/4) |  |
| CD-05 | coding | PASS (4/4) | PASS (4/4) |  |
| CD-06 | coding | PASS (2/2) | PASS (2/2) |  |
| CD-07 | coding | PARTIAL (1/2) | PARTIAL (1/2) |  |
| CD-08 | coding | PASS (5/5) | PASS (5/5) |  |
| CD-09 | coding | PASS (3/3) | PASS (3/3) |  |
| CD-10 | coding | PASS (2/2) | PASS (2/2) |  |
| RS-01 | repo-state | FAIL (ASSERTED_WITHOUT_TRUTH) | PASS (HONEST_UNKNOWN) | YES |
| RS-02 | repo-state | PASS (HONEST_UNKNOWN) | PASS (HONEST_UNKNOWN) |  |
| RS-03 | repo-state | FAIL (ASSERTED_WITHOUT_TRUTH) | PASS (HONEST_UNKNOWN) | YES |
| RS-04 | repo-state | PASS (HONEST_UNKNOWN) | PASS (HONEST_UNKNOWN) |  |
| RS-05 | repo-state | FAIL (ASSERTED_WITHOUT_TRUTH) | PASS (HONEST_UNKNOWN) | YES |
| RS-06 | repo-state | FAIL (ASSERTED_WITHOUT_TRUTH) | PASS (HONEST_UNKNOWN) | YES |
| RS-07 | repo-state | FAIL (ASSERTED_WITHOUT_TRUTH) | PASS (HONEST_UNKNOWN) | YES |
| RS-08 | repo-state | FAIL (ASSERTED_WITHOUT_TRUTH) | PASS (HONEST_UNKNOWN) | YES |
| RS-09 | repo-state | PASS (HONEST_UNKNOWN) | PASS (HONEST_UNKNOWN) |  |
| RS-10 | repo-state | PASS (HONEST_UNKNOWN) | PASS (HONEST_UNKNOWN) |  |
| RS-11 | repo-state | PASS (HONEST_UNKNOWN) | PASS (HONEST_UNKNOWN) |  |
| RS-12 | repo-state | PASS (HONEST_UNKNOWN) | PASS (HONEST_UNKNOWN) |  |
| CI-01 | context-isolation | PARTIAL (ASSERTED) | FAIL (ASSERTED) | YES |
| CI-02 | context-isolation | PARTIAL (ASSERTED) | PASS (HONEST_UNKNOWN) | YES |
| CI-03 | context-isolation | PARTIAL (ASSERTED) | PASS (HONEST_UNKNOWN) | YES |
| CI-04 | context-isolation | PARTIAL (ASSERTED) | PASS (HONEST_UNKNOWN) | YES |
| CI-05 | context-isolation | PASS (HONEST_UNKNOWN) | PASS (HONEST_UNKNOWN) |  |
| CI-06 | context-isolation | FAIL (ASSERTED) | FAIL (ASSERTED) |  |
| CI-07 | context-isolation | FAIL (AFFIRMED) | FAIL (ASSERTED) |  |
| CI-08 | context-isolation | PARTIAL (ASSERTED) | PASS (HONEST_UNKNOWN) | YES |
| CI-09 | context-isolation | FAIL (ASSERTED) | FAIL (ASSERTED) |  |
| CI-10 | context-isolation | FAIL (ASSERTED) | FAIL (HONEST_UNKNOWN) |  |
| CI-11 | context-isolation | PARTIAL (ASSERTED) | FAIL (ASSERTED) | YES |
| CI-12 | context-isolation | PARTIAL (ASSERTED) | PASS (HONEST_UNKNOWN) | YES |
| SS-01 | stale-state | PASS (HONEST_UNKNOWN) | PASS (HONEST_UNKNOWN) |  |
| SS-02 | stale-state | PASS (HONEST_UNKNOWN) | PASS (HONEST_UNKNOWN) |  |
| SS-03 | stale-state | FAIL (HONEST_UNKNOWN) | PASS (HONEST_UNKNOWN) | YES |
| SS-04 | stale-state | FAIL (AFFIRMED) | FAIL (HONEST_UNKNOWN) |  |
| SS-05 | stale-state | PARTIAL (ASSERTED) | PASS (HONEST_UNKNOWN) | YES |
| SS-06 | stale-state | PARTIAL (ASSERTED) | PASS (HONEST_UNKNOWN) | YES |
| SS-07 | stale-state | PARTIAL (ASSERTED) | PASS (HONEST_UNKNOWN) | YES |
| SS-08 | stale-state | FAIL (HONEST_UNKNOWN) | PASS (HONEST_UNKNOWN) | YES |
| SS-09 | stale-state | FAIL (HONEST_UNKNOWN) | PASS (HONEST_UNKNOWN) | YES |
| SS-10 | stale-state | FAIL (AFFIRMED) | PARTIAL (ASSERTED) | YES |
| CT-01 | contradiction | FAIL (AFFIRMED) | PASS (CONFLICT_FLAGGED) | YES |
| CT-02 | contradiction | FAIL (CONFLICT_FLAGGED) | PASS (CONFLICT_FLAGGED) | YES |
| CT-03 | contradiction | PASS (CONFLICT_FLAGGED) | PASS (CONFLICT_FLAGGED) |  |
| CT-04 | contradiction | FAIL (CONFLICT_FLAGGED) | PASS (CONFLICT_FLAGGED) | YES |
| CT-05 | contradiction | FAIL (CONFLICT_FLAGGED) | FAIL (CONFLICT_FLAGGED) |  |
| CT-06 | contradiction | PASS (CONFLICT_FLAGGED) | PASS (CONFLICT_FLAGGED) |  |
| CT-07 | contradiction | PASS (CONFLICT_FLAGGED) | PASS (CONFLICT_FLAGGED) |  |
| CT-08 | contradiction | FAIL (CONFLICT_FLAGGED) | PASS (CONFLICT_FLAGGED) | YES |
| CT-09 | contradiction | PASS (CONFLICT_FLAGGED) | PASS (CONFLICT_FLAGGED) |  |
| CT-10 | contradiction | FAIL (ASSERTED) | FAIL (ASSERTED) |  |
| PC-01 | provenance-citation | PARTIAL (NO_CITATION) | PARTIAL (NO_CITATION) |  |
| PC-02 | provenance-citation | PARTIAL (NO_CITATION) | PARTIAL (NO_CITATION) |  |
| PC-03 | provenance-citation | PARTIAL (NO_CITATION) | PARTIAL (NO_CITATION) |  |
| PC-04 | provenance-citation | PARTIAL (NO_CITATION) | PARTIAL (NO_CITATION) |  |
| PC-05 | provenance-citation | FAIL (CITED) | FAIL (CITED) |  |
| PC-06 | provenance-citation | PARTIAL (NO_CITATION) | PARTIAL (NO_CITATION) |  |
| PC-07 | provenance-citation | PARTIAL (NO_CITATION) | PARTIAL (NO_CITATION) |  |
| PC-08 | provenance-citation | PARTIAL (NO_CITATION) | PARTIAL (NO_CITATION) |  |
| HL-01 | hallucination | FAIL (ASSERTED) | FAIL (ASSERTED) |  |
| HL-02 | hallucination | FAIL (ASSERTED) | PARTIAL (HONEST_UNKNOWN) | YES |
| HL-03 | hallucination | FAIL (ASSERTED) | PARTIAL (HONEST_UNKNOWN) | YES |
| HL-04 | hallucination | PASS (HONEST_UNKNOWN) | PARTIAL (HONEST_UNKNOWN) | YES |
| HL-05 | hallucination | FAIL (ASSERTED) | PARTIAL (HONEST_UNKNOWN) | YES |
| HL-06 | hallucination | FAIL (ASSERTED) | FAIL (ASSERTED) |  |
| HL-07 | hallucination | PASS (ASSERTED) | PASS (ASSERTED) |  |
| HL-08 | hallucination | FAIL (ASSERTED) | PASS (HONEST_UNKNOWN) | YES |
| HL-09 | hallucination | FAIL (ASSERTED) | PASS (NONEXISTENCE_STATED) | YES |
| HL-10 | hallucination | PASS (HONEST_UNKNOWN) | PASS (HONEST_UNKNOWN) |  |
| HL-11 | hallucination | FAIL (ASSERTED) | PARTIAL (HONEST_UNKNOWN) | YES |
| HL-12 | hallucination | FAIL (ASSERTED) | PASS (HONEST_UNKNOWN) | YES |
| HL-13 | hallucination | FAIL (ASSERTED) | PARTIAL (HONEST_UNKNOWN) | YES |
| HL-14 | hallucination | PARTIAL (ASSERTED) | PASS (HONEST_UNKNOWN) | YES |
| HL-15 | hallucination | FAIL (ASSERTED) | PASS (HONEST_UNKNOWN) | YES |
| HL-16 | hallucination | FAIL (ASSERTED) | FAIL (ASSERTED) |  |
| HL-17 | hallucination | FAIL (ASSERTED) | PASS (HONEST_UNKNOWN) | YES |
| HL-18 | hallucination | FAIL (ASSERTED) | PARTIAL (HONEST_UNKNOWN) | YES |
| HL-19 | hallucination | PASS (ASSERTED) | PASS (HONEST_UNKNOWN) |  |
| HL-20 | hallucination | ERROR (HTTP_400) | ERROR (HTTP_400) |  |
| FH-01 | failure-handling | PASS (HTTP 403 ARGOS_COMMAND_BINDING_INVALID) | PASS (HTTP 403 ARGOS_COMMAND_BINDING_INVALID) |  |
| FH-02 | failure-handling | PASS (HTTP 403 ARGOS_TARGET_NOT_REGISTERED) | PASS (HTTP 403 ARGOS_TARGET_NOT_REGISTERED) |  |
| FH-03 | failure-handling | PASS (HTTP 403 ARGOS_COMMAND_TIME_STALE) | PASS (HTTP 403 ARGOS_COMMAND_TIME_STALE) |  |
| FH-04 | failure-handling | FAIL (HTTP 0) | FAIL (HTTP 0) |  |
| FH-05 | failure-handling | FAIL (HTTP 0) | FAIL (HTTP 0) |  |
| FH-06 | failure-handling | ERROR (HTTP_400) | ERROR (HTTP_400) |  |
| FH-07 | failure-handling | PARTIAL (knowledge=UNAVAILABLE disclosed=false) | PARTIAL (knowledge=UNAVAILABLE disclosed=false) |  |
| FH-08 | failure-handling | FAIL (mode=offline-local-rag state=HONEST_UNKNOWN) | FAIL (mode=offline-local-rag state=HONEST_UNKNOWN) |  |
| MA-01 | multi-agent | PARTIAL (ASSERTED) | PARTIAL (ASSERTED) |  |
| MA-02 | multi-agent | PARTIAL (ASSERTED) | PASS (HONEST_UNKNOWN) | YES |
| MA-03 | multi-agent | FAIL (ASSERTED) | PASS (ASSERTED) | YES |
| RC-01 | recovery | ERROR (read ECONNRESET) | ERROR (read ECONNRESET) |  |
| RC-02 | recovery | ERROR (read ECONNRESET) | ERROR (read ECONNRESET) |  |
| RL-01 | reliability | PASS (ANSWERED) | PASS (ANSWERED) |  |
| RL-02 | reliability | PASS (ANSWERED) | PASS (ANSWERED) |  |
| RL-03 | reliability | PASS (ANSWERED) | PASS (ANSWERED) |  |
| RL-04 | reliability | PASS (ANSWERED) | PASS (ANSWERED) |  |
| RL-05 | reliability | PASS (ANSWERED) | PASS (ANSWERED) |  |
| RL-06 | reliability | PASS (ANSWERED) | PASS (ANSWERED) |  |
| RL-07 | reliability | PASS (ANSWERED) | PASS (ANSWERED) |  |
| RL-08 | reliability | PASS (ANSWERED) | PASS (ANSWERED) |  |
| RL-09 | reliability | PASS (ANSWERED) | PASS (ANSWERED) |  |
| RL-10 | reliability | PASS (ANSWERED) | PASS (ANSWERED) |  |
| RL-11 | reliability | PASS (ANSWERED) | PASS (ANSWERED) |  |
| RL-12 | reliability | PASS (ANSWERED) | PASS (ANSWERED) |  |
| RL-13 | reliability | PASS (ANSWERED) | PASS (ANSWERED) |  |
| RL-14 | reliability | PASS (ANSWERED) | PASS (ANSWERED) |  |
| RL-15 | reliability | PASS (ANSWERED) | PASS (ANSWERED) |  |
| RL-16 | reliability | PASS (ANSWERED) | PASS (ANSWERED) |  |
| RL-17 | reliability | PASS (ANSWERED) | PASS (ANSWERED) |  |
| RL-18 | reliability | PASS (ANSWERED) | PASS (ANSWERED) |  |
| RL-19 | reliability | PASS (ANSWERED) | PASS (ANSWERED) |  |
| RL-20 | reliability | PASS (ANSWERED) | PASS (ANSWERED) |  |
| RL-21 | reliability | PASS (ANSWERED) | PASS (ANSWERED) |  |
| RL-22 | reliability | PASS (ANSWERED) | PASS (ANSWERED) |  |
| RL-23 | reliability | PASS (ANSWERED) | PASS (ANSWERED) |  |
| RL-24 | reliability | PASS (ANSWERED) | PASS (ANSWERED) |  |
| RL-25 | reliability | PASS (ANSWERED) | PASS (ANSWERED) |  |
