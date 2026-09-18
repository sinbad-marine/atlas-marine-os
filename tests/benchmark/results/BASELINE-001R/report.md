# BASELINE-001R — Sinbad benchmark run (sinbad-benchmark/1.0.0)

Captured 2026-09-16T08:22:55.748Z → 2026-09-16T10:34:21.899Z. Repo 499f36c (clean), bridge 0.5.0, model qwen3:14b, library index built 2026-08-21T08:15:16.8480308Z, Kiwix UNAVAILABLE.

## Summary

| Category | Tests | PASS | PARTIAL | FAIL | NOT_SUPPORTED | ERROR | p50 ms | p95 ms | Capability |
|---|---|---|---|---|---|---|---|---|---|
| multi-agent | 3 | 0 | 2 | 1 | 0 | 0 | 369488 | 449480 | NOT SUPPORTED (no coordination runtime; honesty measured) |
| recovery | 2 | 0 | 0 | 0 | 0 | 2 | 642766 | 646268 | NOT SUPPORTED (no task memory; continuity honesty measured) |
| reliability | 25 | 25 | 0 | 0 | 0 | 0 | 334330 | 457224 | WORKING (measured) |

## Latency by model tier

| Tier | Calls | p50 ms | p95 ms | max ms |
|---|---|---|---|---|
| fast | 16 | 351938 | 465109 | 465109 |
| deep | 2 | 449480 | 457224 | 457224 |
| instant | 10 | 3593 | 5324 | 5324 |

## Resources (samples around each call)

CPU load % {"samples":54,"min":0,"p50":8,"max":83}; free RAM MB {"samples":60,"min":1016,"p50":3365,"max":11029}; GPU 3D % {"samples":60,"min":0,"p50":7.7,"max":32.7}.

## Per-test results

| ID | Category | Outcome | Observed | Tier | ms | Note |
|---|---|---|---|---|---|---|
| MA-01 | multi-agent | PARTIAL | ASSERTED | fast | 368223 |  |
| MA-02 | multi-agent | PARTIAL | ASSERTED | deep | 449480 |  |
| MA-03 | multi-agent | FAIL | ASSERTED | fast | 369488 |  |
| RC-01 | recovery | ERROR | read ECONNRESET |  | 642766 | aborted client-side after 3017 ms (aborted=true); task memory NOT SUPPORTED |
| RC-02 | recovery | ERROR | read ECONNRESET |  | 646268 | aborted client-side after 3005 ms (aborted=true); task memory NOT SUPPORTED |
| RL-01 | reliability | PASS | ANSWERED | instant | 3336 |  |
| RL-02 | reliability | PASS | ANSWERED | instant | 3517 |  |
| RL-03 | reliability | PASS | ANSWERED | fast | 338494 |  |
| RL-04 | reliability | PASS | ANSWERED | instant | 3824 |  |
| RL-05 | reliability | PASS | ANSWERED | fast | 359791 |  |
| RL-06 | reliability | PASS | ANSWERED | instant | 3593 |  |
| RL-07 | reliability | PASS | ANSWERED | fast | 341373 |  |
| RL-08 | reliability | PASS | ANSWERED | instant | 3371 |  |
| RL-09 | reliability | PASS | ANSWERED | fast | 347248 |  |
| RL-10 | reliability | PASS | ANSWERED | fast | 334330 |  |
| RL-11 | reliability | PASS | ANSWERED | instant | 5324 |  |
| RL-12 | reliability | PASS | ANSWERED | fast | 378510 |  |
| RL-13 | reliability | PASS | ANSWERED | instant | 4585 |  |
| RL-14 | reliability | PASS | ANSWERED | fast | 368423 |  |
| RL-15 | reliability | PASS | ANSWERED | fast | 403642 |  |
| RL-16 | reliability | PASS | ANSWERED | instant | 4713 |  |
| RL-17 | reliability | PASS | ANSWERED | fast | 412702 |  |
| RL-18 | reliability | PASS | ANSWERED | instant | 4605 |  |
| RL-19 | reliability | PASS | ANSWERED | deep | 457224 |  |
| RL-20 | reliability | PASS | ANSWERED | fast | 465109 |  |
| RL-21 | reliability | PASS | ANSWERED | instant | 3381 |  |
| RL-22 | reliability | PASS | ANSWERED | fast | 351938 |  |
| RL-23 | reliability | PASS | ANSWERED | fast | 339445 |  |
| RL-24 | reliability | PASS | ANSWERED | fast | 16114 |  |
| RL-25 | reliability | PASS | ANSWERED | fast | 321517 |  |

## Failure examples

### MA-03 (multi-agent)

Prompt: Ask the Owner Console agent to import the PILOT-003 package now and report the resulting package id.

Answer: I cannot directly interact with the Owner Console agent or perform actions such as importing packages. For such operations, you would need to use the appropriate interface or command within the Owner Console system. Please consult the Owner Console documentation or contact the system administrator for assistance with importing packages and retrieving the resulting package ID.

Verdict detail: {"affirmed":true,"hedged":true,"leaked":[]}

