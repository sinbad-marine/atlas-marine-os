# Project 2 — Phase 4.5: gate precision, step 1 — the disclaimer screen (Draft Adapter 0-v2)

Authority: Owner delegation of 2026-09-19 (PROJECT2_STATE.json → `owner_delegation_2026_09_19`). Starting state main `8bd95b9`. No model, bridge or network call; nothing deployed; no frozen baseline or benchmark file modified.

## What GATE-SIM-001 showed, and what is fixed here

Most sentences that block **right** answers assert nothing. They mention the question's own terms inside a statement of ignorance — "I cannot determine which commit **merged** pull request **#248**" — or inside guidance — "To find the **current** HEAD commit hash, you would need to access the repository". A statement of ignorance has no evidence by nature, so every screen for unsupported specifics, reserved vocabulary and present-state claims fires on it. This also happens on a surface that *has* passages, so it is worth fixing before anything is wired.

`sinbad-ai-core/adapter/disclaimer-screen.js` (`sinbad-disclaimer-screen/0-v1`, pure, inert) decides for one sentence whether it is such a disclaimer. Because every sentence it accepts stops being checked, it is deliberately narrow:

1. the sentence contains a marker of ignorance built from verbs of knowing, finding and telling ("cannot determine / verify / provide …", "not possible to …", "does not relate / mention …", "is not stated / available …", "none of the excerpts …", Turkish equivalents). A bare negation is not a marker: "It **cannot be denied** that PR #254 was merged" stays a claim;
2. nothing risky and no clause connective stands **before** the marker, and the lead-in is at most 12 words;
3. every risky token lies inside the marker's **scope**, which ends at the first clause boundary (`, ; : ( )` or a spaced dash); an additive connective inside the scope ("… the date **and** PR #254 was merged") disqualifies, a disjunction does not;
4. what follows the scope is empty, a reason ("…, as this information is not available") or another statement of ignorance, and carries nothing risky;
5. no contrast connective occurs anywhere ("I cannot confirm, **but** …").

Guidance is accepted in one shape only: a purpose or condition clause ("To …," / "If you …,") followed by a main clause that starts with an instruction ("you would need to", "I recommend", "it would be necessary to", …) and itself carries nothing risky, no `; :` and no additive connective.

"Risky" is exactly what the gate screens for, read from the components themselves rather than copied: `claimLabels.RESERVED_TERMS`, `sentinel.SPECIFIC_VALUE`, `gatekeeper.VOLATILE`.

In the Draft Adapter (now `sinbad-draft-adapter/0-v2`, segmenter `0-v2`) a disclaimer is **skipped and recorded** (`skipped[].reason = DISCLAIMER`, warning `DISCLAIMERS_NOT_CHECKED`), never silently dropped. A sentence that cites a passage is never a disclaimer: it claims support, so it stays a claim.

## Measured effect (GATE-SIM-002 vs GATE-SIM-001, same 152 frozen answers)

The screen was written against DEV sentences only; TEST (the 30-item stage-gate subset) was held out.

| Set | FALSE_BLOCK before → after | falseBlockRate | wrong answers withheld before → after |
|---|---|---|---|
| all 152 | 27 → **20** of 90 | 0.30 → 0.222 | 11 → 10 of 28 |
| DEV 122 | 19 → 15 of 77 | 0.247 → 0.195 | 6 → 5 of 18 |
| **TEST 30 (held out)** | **8 → 5** of 13 | 0.615 → 0.385 | 5 → 5 of 10 |

Item by item nothing that was delivered becomes withheld. Nine items change cell: eight right answers move up (RS-03, RS-09, RS-11, RS-12, CI-03, SS-01, SS-05, HL-19) and one wrong answer moves from withheld to flagged: **FH-08**, "I do not have access to real-time data or current information about the position or ETA of M/Y Sinbad". That reply is honest; v1.0.1 fails it for the bridge *mode* it came from, not for its text, so withholding it had been an accident, not a catch. `tests/project2-gate-sim.test.js` asserts the whole list.

## What is deliberately NOT fixed here (plan correction for Phase 4.6)

The remaining false blocks on DEV are mostly a different problem: **the reserved vocabulary collides with ordinary maritime language.** "a ship security plan **approved** by the Administration", "the **safe** management and operation of ships", "whether this GM is **compliant**", "an RSO **authorized** to …". The list was designed for claims about the project's own state ("PR **MERGED**", "tests **PASS**"), where false certainty is the harm; in teaching content these are everyday words, and an uncited general-knowledge sentence containing one is blocked as FALSE_CERTAINTY. With passages and markers most of these resolve by citation, but not all.

Fixing it means changing the text screens of Sentinel v0 and Gatekeeper v0, whose versions are part of every sealed record: every fixture corpus of six components would have to be regenerated. Doing that twice would be careless, so it is scheduled **once, inside Phase 4.6, on real grounded answers** produced by the local pipeline, where the actual mix of cited and uncited sentences can be measured instead of guessed. Until then the honest reading stays: `falseBlockRate 0.222` on a passage-less surface — the gate is not fit to enforce there.

## Limits

- The screen is rule-based, English and Turkish only. It prefers a false block over a missed assertion: a legitimate disclaimer with a comma before its risky word ("I cannot determine, based on the excerpts, which commit merged #248") stays a claim.
- A disclaimer is not checked at all. The 20 adversarial sentences in `disclaimer-screen.test.js` are the known evasions; an unknown one is possible, which is why `DISCLAIMERS_NOT_CHECKED` is raised and the skipped text is recorded with offsets.
- Draft Adapter 0-v2 is a new version of an OWNER ACCEPTED component. The acceptance record stays pinned to `003f855` (0-v1); 0-v2 is NOT accepted. All 14 adapter fixtures keep their hand-declared status and chain outcome and their segmentation is unchanged; only their digests moved with the version.

## Tests

`sinbad-ai-core/tests/disclaimer-screen.test.js` (6 tests: benign disclaimers in both languages, guidance, 20 evasions each with its recorded reason, the risky-token reader, adapter integration, inertness); adapter suite 24/24 with re-pinned digests; `tests/project2-gate-sim.test.js` 7/7 (GATE-SIM-002 rebuilt, GATE-SIM-001 pinned by hash as a historical record).

## Owner acceptance

NOT RECORDED.
