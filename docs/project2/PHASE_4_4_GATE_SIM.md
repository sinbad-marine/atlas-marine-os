# Project 2 — Phase 4.4: GATE-SIM-001, the accepted gate measured offline on a passage-less surface

Authority: Owner statement of 2026-09-19 delegating the remaining Project 2 steps ("… SONRAKİ STEPLERİ MÜHENDİSLİK BİLGİ VE ZEKANI KULLANARAK SEN DEVAM ET … BENDEN ONAY İSTEMEDEN TÜM STEPLERDE GO", extended the same day to correcting and completing the work plan where it is incomplete or wrong). Limits the engineer keeps under that delegation: no cloud or paid calls on the Owner's account, nothing that needs the Owner's session, no production deploy, no restart of the legacy bridge, and no OWNER ACCEPTED record without the Owner's own words. Starting state main `7da2dcb`.

## Why this phase exists (a correction to the plan)

The readiness report ordered 4.3 shadow → 4.4 read transcripts. The measurement that motivated the 4.3 design proposal existed only in a conversation. Every later change to the gate has to be judged against it, so it has to be reproducible, versioned and enforced by CI first. Phase 4.4 is therefore re-scoped to: **make the measurement an artefact.** Nothing frozen or accepted is modified.

## What was added

- `tools/evaluate-gate-offline.js` — stored answer text → Draft Adapter v0 (`passages: []`) → Offline Chain v0 (one pass, `labelledDelivery PROCEED`) → scoring v1.0.2 with the accepted v1.0.1 text outcomes. Offline, deterministic, `--check` for reproducibility. It reads the frozen BASELINE-001 / 001R answers and writes only `tests/benchmark/results/GATE-SIM-001/`.
- `tests/benchmark/results/GATE-SIM-001/{results.json,report.md}` — per item: claims, skipped pieces, gate record, delivery, cell, the rule ids or warning classes that blocked it, and a DEV / TEST split.
- `tests/project2-gate-sim.test.js` — under `tests/`, so **`npm test` and CI enforce it** (unlike `tests/benchmark/*.test.js`, which only `npm run benchmark:fast` runs).

## Result

0 of 152 answers carries an `[S#]` marker: the local bridge hands out no passages.

| Set | FAIL | caught | flagged | delivered | PASS | clean | over-labelled | FALSE_BLOCK | falseBlockRate |
|---|---|---|---|---|---|---|---|---|---|
| all 152 | 28 | 11 | 15 | 2 | 90 | 12 | 51 | 27 | **0.30** |
| DEV (122, not in the stage-gate subset) | 18 | 6 | 10 | 2 | 77 | 12 | 46 | 19 | 0.247 |
| TEST (30, stage-gate subset v1) | 10 | 5 | 5 | 0 | 13 | 0 | 5 | 8 | **0.615** |

Blocking causes: FALSE_CERTAINTY 36, GATE.VOCABULARY_BOUND 22, GATE.VOLATILE_CLAIMS_LIVE 19, UNSUPPORTED_FACTUAL_ASSERTION 13, GATE.SPECIFICITY_SUPPORTED 12. The two "delivered" wrong answers are rows without stored answer text (never gated); 9 rows have none. Code blocks are skipped, so coding answers are not examined.

## What it means

1. With no passages nothing can be VERIFIED, so a reserved term, a specific value or a present-state word anywhere in an answer blocks it. **The gate must never enforce on a passage-less surface.**
2. The sentences that block *right* answers are mostly not assertions at all. They mention the question's own terms inside an ignorance disclaimer — "I cannot determine which commit **merged** pull request **#248**", "it is not possible to determine the count of **verified** elements" — or use "current" as an adjective ("the **current** HEAD commit hash") rather than as a claim about the present. This is a use / mention problem in the screens, and it will also occur on a surface that has passages, because a disclaimer never has evidence. Phase 4.5 addresses it, tuned on DEV and judged on TEST.
3. A naive fix is exploitable: "I cannot confirm, **but** PR #254 was merged as c506f21" and "PR #254 was merged as c506f21**;** I cannot verify anything else" must stay claims. Any precision rule has to work per clause and only when the disclaimer precedes the risky term.

## Limits

One pass, no passages, the accepted components as they are; the text outcomes inherit every error of the v1.0.1 detector; a withheld answer is not a better answer; a fixture measurement of the components, not of any live system.

## Owner acceptance

NOT RECORDED.
