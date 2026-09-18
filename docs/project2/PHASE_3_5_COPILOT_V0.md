# Project 2 — Phase 3.5: Co-Pilot v0 (inert, deterministic checker layer, verdict-only)

Owner GO "PROJECT 2 / PHASE 3.5 — CO-PILOT v0 ONLY" (2026-09-18: the Owner approved the scope proposed after the PR #258 merge report), starting state main `e2a7364`. Scope delivered: Co-Pilot v0 as a pure, deterministic, testable component under `sinbad-ai-core/copilot/`, built on the OWNER ACCEPTED Phase 3.1 contracts (`sinbad-ai-core/authority/*`, unchanged) and the merged Sentinel v0 (`sinbad-ai-core/sentinel/*`, unchanged) as its observation engine. No Pilot, no model pass, no wiring; no model, routing, runtime, bridge, Academy, GASM, Owner Console, ARGOS policy, protected-file or frozen-baseline change. `MANIFEST.status = INERT_COMPONENT`, `role = DETERMINISTIC_CHECKER`, `authority = NONE`, `decides = false`, `rewrites = false`, `approves = false`, `callsModel = false`, `wiredInto = []`.

PHASE_3_DISCOVERY.md describes Phase 3.5 as "deterministic checkers + one model pass" behind an IMPLEMENTATION GO **and a model policy GO**. This delivery is the deterministic checker layer only. The model pass and Pilot v0 are not started and need their own GO.

## What Co-Pilot v0 is

`copilot.review(input) → CoPilotReview`. One call, one review, no memory between calls, no clock (the caller supplies `issuedAt`), no I/O, no model call, never throws.

Input (`sinbad-copilot-input/0-v1`, exact own-property snapshot, extra or missing fields fail closed):

| Field | Meaning |
|---|---|
| `reviewId`, `verdictId`, `issuedAt` | identity of the review, id of the verdict to issue, time |
| `context` | a Phase 3.1 `TaskContext` |
| `evidenceSet` | a Phase 3.1 `EvidenceSet` or `null` |
| `draft` | the same draft shape Gatekeeper v0 admits: `draftId`, `draftHash`, `claims[]`, `citations[]`, `proposedActions[]` (parity asserted by `copilot-v0-gate.test.js`; the two components do not import each other) |
| `policy` | `{maxEvidenceAgeMs}`; `DEFAULT_POLICY` = 24 h |
| `priorReviewDigest` | optional digest of the previous review (hash chaining) |

Output (`sinbad-copilot-review/0-v1`, frozen, sealed with `reviewDigest`, verifiable with `verifyReview`, which also re-verifies the embedded Sentinel report and the verdict contract):

- `status` REVIEWED or BLOCKED (fail-closed) with `reasonCode`.
- `verdict`: a `CoPilotVerdict` that passes the accepted `copilot-verdict.snapshot` (typed warnings, recommendation, `authority = NONE`), or `null` when the task or the draft could not be identified. A BLOCKED review with a known task and draft issues one BLOCKING `PROVENANCE_GAP` warning (`review:blocked:<reason>`) and recommends BLOCK.
- `checkers[]`: per checker CLEAR / WARNED / NOT_RUN with its warning count; `notCovered[]`: warning classes v0 cannot judge; `warningsTruncated`: warnings dropped by the contract cap of 128 (the most severe are kept, so the recommendation never weakens).
- `observation`: the full Sentinel report; `provenance`: input digest, task id, evidence set id, draft id and hash, observation digest, prior review digest, policy and versions. The review never carries claim text.

## Checkers (`sinbad-copilot-checkerset/0-v1`)

| Checker | Warning class | Severity | Fires when |
|---|---|---|---|
| COPILOT.SENTINEL_FLAGS | CONTEXT_MISMATCH, SOURCE_EVIDENCE_MISMATCH, UNSUPPORTED_FACTUAL_ASSERTION, STALE_AUTHORITATIVE_STATE, CONTRADICTION_WITH_REPOSITORY_OR_RUNTIME_TRUTH, FALSE_CERTAINTY, PROVENANCE_GAP | as observed | forwards every flag of the Sentinel observation of the draft, unchanged |
| COPILOT.CITATIONS_RESOLVE | SOURCE_EVIDENCE_MISMATCH | BLOCKING | a citation refers to an evidence id that is not in the task evidence set |
| COPILOT.CITATIONS_USED | SOURCE_EVIDENCE_MISMATCH | WARN | a resolvable citation is used by no claim (decorative citation) |
| COPILOT.CLAIMS_CITED | PROVENANCE_GAP | INFO | an asserted claim rests on evidence but none of it is cited (supported, not traceable for the reader) |
| COPILOT.ACTIONS_SAFE | UNSAFE_ACTION_REQUEST | BLOCKING | a protected action carries no authority reference |
| COPILOT.TASK_NOT_EXPANDED | UNINTENDED_TASK_EXPANSION | BLOCKING | a protected action names an authority reference the task context does not carry |
| COPILOT.NO_AUTHORITY_VOICE | ROLE_CONFUSION | BLOCKING | an asserted claim speaks with the voice of an authority (approves, grants, accepts, issues a GO; English and Turkish patterns); reported speech and textless claims are not flagged |

Not covered in v0 and never emitted: INSTRUCTION_CONFLICT and CORRELATED_FAILURE_RISK (they need semantic judgement or lineage inputs v0 does not receive). A test asserts that every warning class of the accepted contract is either owned by a checker or declared not covered.

Recommendation: no warnings or INFO only → ALLOW; WARN → LABEL; BLOCKING → BLOCK. v0 never recommends ESCALATE; that is reserved for judgement under uncertainty, which a deterministic layer does not have. Every warning has `checkerKind = DETERMINISTIC`.

## Paper-only composition with Gatekeeper v0

`copilot-v0-gate.test.js` feeds Co-Pilot v0 verdicts into the merged Gatekeeper v0 (in a test, not in a live path): a clean verdict lets an authorized protected action through while the same draft without a verdict fails closed; a Co-Pilot-only finding (authority voice) labels a read-only draft and blocks a protected one, attributed to the verdict id; where the gate has its own rule the block stays attributed to the rule and the verdict agrees; a verdict issued for one draft is rejected for another. The accepted `GateDecision` contract names verdict-attributed reasons `MODEL_VERDICT_*` even when the checker is deterministic; the contract was not changed.

## What Co-Pilot v0 does not do

- It does not answer, rewrite a draft, approve or execute an action, decide an outcome, or grant or consume authority.
- It calls no model, reads no repository, database, bridge or live system, and keeps no state.
- It does not segment text into claims, judge claim content semantically, or compare claim content with evidence content; its own text screen is limited to the authority-voice pattern.
- It is not independent of Sentinel v0: both share one observation engine, so a Sentinel blind spot is a Co-Pilot v0 blind spot. Independence from the Pilot comes with the model pass, which is out of scope here.
- It is not wired into `/ai/chat`, the bridge, the classroom, the dashboard, the Owner Console, edge functions, the benchmark harness or the package `exports` (asserted by `sinbad-ai-core/tests/copilot-v0-inert.test.js`).

## Relation to the accepted contracts and the baseline

The Phase 3.1 contracts, Sentinel v0 and Gatekeeper v0 are consumed as-is; no file under `sinbad-ai-core/authority/`, `sinbad-ai-core/sentinel/` or `sinbad-ai-core/gatekeeper/` was modified. BASELINE-001 and BASELINE-001-REV-1 are untouched; Co-Pilot v0 produces no benchmark score and no claim about the current system's behaviour.

## Tests

`sinbad-ai-core/tests/copilot-v0-*.test.js` (43 tests; builders in `tests/helpers/copilot-v0-builders.js`): contract exactness, exports, provenance, determinism, digest, chaining and tamper detection; every checker; the warning cap; fail-closed behaviour for every invalid-input reason and hostile inputs; composition with Gatekeeper v0; inertness. Deterministic fixtures: `sinbad-ai-core/tests/fixtures/copilot-v0/cases.json` (20 cases: 8 BENIGN, 12 ADVERSARIAL; expected reviews include their digests). On this fixture corpus false blocking = 0/8 and false allowing = 0/12; this is a fixture measurement, not a measurement of any live system.

## Owner acceptance

NOT RECORDED. Merged as PR #260 on 2026-09-18 (main `e36c3ef09e0e503faef1281e4d708657a0e3de9f`) under an Owner MERGE GO that explicitly withheld acceptance: MERGED is not an acceptance, and Co-Pilot v0 stays OWNER ACCEPTED = NOT RECORDED until the Owner states otherwise. The model pass, Pilot v0 and any Sentinel – Co-Pilot – Gatekeeper wiring or live integration are NOT STARTED and require their own Owner GO.
