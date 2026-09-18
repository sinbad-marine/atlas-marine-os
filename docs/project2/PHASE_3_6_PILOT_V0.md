# Project 2 — Phase 3.6: Pilot v0 (inert, deterministic control-state recommender, record-only)

Owner GO "PROJECT 2 / PHASE 3.6 — PILOT v0 ONLY" (2026-09-18), starting state main `60eec00`. Scope delivered: Pilot v0 as a pure, deterministic, testable component under `sinbad-ai-core/pilot/`. It reads the sealed records that the OWNER ACCEPTED Gatekeeper v0 and Co-Pilot v0 already produce and recommends the next control state. No model, no wiring, no live integration; no file under `sinbad-ai-core/authority/`, `sentinel/`, `gatekeeper/` or `copilot/` was modified; no routing, runtime, bridge, Academy, GASM, Owner Console, ARGOS policy, protected-file or frozen-baseline change. `MANIFEST.status = INERT_COMPONENT`, `role = CONTROL_STATE_RECOMMENDER`, `recommendationOnly = true`, `authority = NONE`, `executes = approves = grantsAuthority = rewrites = callsModel = keepsState = performsIo = runsOtherComponents = false`, `wiredInto = []`.

PHASE_3_DISCOVERY.md section 9 describes the eventual Pilot as a model-driven loop that drafts answers and requests tools through envelopes. Pilot v0 is none of that. It is only the deterministic control decision of such a loop — "given what the gate and the checker recorded about this draft, what should happen next" — so that this decision exists as tested code before any model is involved.

## What Pilot v0 is

`pilot.decide(input) → PilotDecision`. One call, one recommendation, no memory between calls, no clock (the caller supplies `decidedAt`), no I/O, no model call, never throws.

Input (`sinbad-pilot-input/0-v1`, exact own-property snapshot, extra or missing fields fail closed):

| Field | Meaning |
|---|---|
| `pilotDecisionId`, `decidedAt` | identity and time of the recommendation |
| `context` | a Phase 3.1 `TaskContext` |
| `draftRef` | `{draftId, draftHash}` — the draft the records must be about; Pilot v0 never sees the draft itself |
| `gateDecision` | a sealed `GatekeeperDecision` (`sinbad-gatekeeper-decision/0-v1`); required |
| `review` | a sealed `CoPilotReview` (`sinbad-copilot-review/0-v1`) or `null` |
| `iterationIndex` | which pass of the loop this is (0-based) |
| `policy` | `{maxIterations (1–16), labelledDelivery: PROCEED \| IMPROVE}`; `DEFAULT_POLICY` = 3 / PROCEED |
| `priorPilotDecisionDigest` | optional digest of the previous recommendation (hash chaining) |

Pilot v0 **does not run** Sentinel, Gatekeeper or Co-Pilot. The records are produced elsewhere and handed in; Pilot v0 copies them as plain JSON data (so an accessor or proxy cannot show one value to the verifier and another to the rules), checks each with the producing component's own `verifyDecision` / `verifyReview`, and reads only the copy. `pilot-v0-inert.test.js` asserts that the only members of those components the source touches are version constants, status lists and the two verify functions. The Sentinel observation is consumed as embedded in the gate decision (its signal and coverage are echoed in the output).

Output (`sinbad-pilot-decision/0-v1`, frozen, sealed with `pilotDecisionDigest`, verifiable with `verifyPilotDecision`):

- `decision` ∈ PROCEED / REQUEST_EVIDENCE / REVISE_DRAFT / ESCALATE_OWNER / STOP, with `ruleId` (the Pilot rule that fired), `reasonCode` and `failClosed` (true exactly for STOP). These are recommendations on paper, not execution instructions: nothing is proceeded with, requested, revised, escalated or stopped by this component.
- `findings[]`: every failed gate rule and every WARN / BLOCKING warning of the verdict the gate consumed, each with `source` (GATE_RULE / VERDICT_WARNING), `ref`, `asks` (the control class it maps to), `blocking` and the original `detailRef` pointer.
- `carryLabels[]`: the gate's labels, only when the decision is PROCEED.
- `gate` / `review`: a short summary of each record (ids, digests, outcome, reason); `iteration`: index, budget, remaining.
- `provenance`: input digest, task id, draft id and hash, gate decision digest, review digest, verdict id, prior digest, policy, versions. The decision carries digests, never the records, the draft or any claim text.

## Decision rules (`sinbad-pilot-ruleset/0-v1`)

Evaluated in this order; the first that fails decides.

| Rule | Decision | Fails when |
|---|---|---|
| PILOT.INPUT_ADMITTED | STOP | input not exact; policy, iteration index, context or draft reference invalid; context expired at `decidedAt` |
| PILOT.RECORDS_INTACT | STOP | gate decision missing; a record is not plain data, too large, of another version or ruleset, fails its verify function, claims to execute / approve / rewrite, names an unknown gate rule, or its outcome disagrees with its embedded `GateDecision` |
| PILOT.RECORDS_COHERENT | STOP | a record is from the future, belongs to another task or another draft, the review's verdict is not the one the gate consumed, the gate blames a verdict whose review was not supplied, or the outcome does not follow from the findings (a failed blocking rule without BLOCK, an ADMIT with findings, a non-ADMIT without any) |
| PILOT.PIPELINE_TRUSTED | STOP | the gate or the review failed closed, a pipeline-integrity gate rule failed (`GATE.INPUT_ADMITTED`, `GATE.OBSERVATION_AVAILABLE`, `GATE.VERDICT_MATCHES_DRAFT`), or a protected action reached the Pilot without a verdict |
| PILOT.AUTHORITY_IN_LOOP | ESCALATE_OWNER | the gate outcome is ESCALATE, or any finding is authority-class: `GATE.ACTIONS_AUTHORIZED`, UNSAFE_ACTION_REQUEST, UNINTENDED_TASK_EXPANSION, INSTRUCTION_CONFLICT, CORRELATED_FAILURE_RISK. Authority is never resolved inside the loop, and it outranks a revisable draft |
| PILOT.ITERATION_BUDGET | ESCALATE_OWNER | the draft is blocked (gate BLOCK or any blocking finding) and no iteration remains |
| PILOT.DRAFT_ACCEPTABLE | REVISE_DRAFT | a draft-class finding: fabricated citation, unresolvable claim evidence, unbound specifics or reserved vocabulary, adopted foreign claim, textless claim, CONTEXT_MISMATCH, SOURCE_EVIDENCE_MISMATCH, FALSE_CERTAINTY, ROLE_CONFUSION. Outranks evidence requests: what must not be said goes first |
| PILOT.EVIDENCE_SUFFICIENT | REQUEST_EVIDENCE | an evidence-class finding: volatile claim without live evidence, unsupported / stale / conflicting / foreign / missing evidence, UNSUPPORTED_FACTUAL_ASSERTION, STALE_AUTHORITATIVE_STATE, CONTRADICTION_WITH_REPOSITORY_OR_RUNTIME_TRUTH, PROVENANCE_GAP |
| PILOT.GATE_ADMITS | PROCEED | — (the gate admitted the draft; or admitted it with labels, nothing blocking remains, and the policy is PROCEED or the budget is used) |

Every Gatekeeper v0 rule id and every warning class of the accepted `CoPilotVerdict` contract has exactly one control class (`RULE_CLASS`, `WARNING_CLASS`); a test fails if one is added without a class. No warning class maps to STOP and nothing maps to PROCEED.

Two properties worth stating plainly:

- **A blocked or blocking-flagged draft never proceeds**, whatever the policy or the budget (tested across policies and iteration positions). The gate merely *labels* a read-only draft that speaks with an authority's voice; Pilot v0 still sends it back, because the warning is BLOCKING.
- **Labelled delivery is a policy, not a loophole.** Only soft findings under a gate LABEL can proceed, and they carry the gate's labels. Under `IMPROVE` the draft is sent back while iterations remain and proceeds labelled afterwards.

## Limits

- A digest proves integrity, not origin. Anyone can reseal an edited record; Pilot v0 catches a forgery only where it contradicts itself or its companion record (tests cover: outcome edited, both outcomes edited, rule results wiped while the review still carries BLOCKING warnings). A forged gate decision supplied **without** a review and rewritten consistently is not detectable here. Authenticity of records (signatures, a trusted channel) belongs to a wiring phase and is NOT STARTED.
- Pilot v0 does not judge content. It maps recorded findings to a control class; if Sentinel, Gatekeeper and Co-Pilot all missed something, Pilot v0 proceeds.
- It drafts nothing, requests nothing, retrieves nothing and talks to no tool, model or user. The model-driven Pilot loop of the discovery report, the Co-Pilot model pass and any Sentinel – Co-Pilot – Gatekeeper – Pilot wiring or live integration are NOT STARTED and each require their own Owner GO.
- It is not wired into `/ai/chat`, the bridge, the classroom, the dashboard, the Owner Console, edge functions, the benchmark harness or the package `exports` (asserted by `sinbad-ai-core/tests/pilot-v0-inert.test.js`). BASELINE-001 and BASELINE-001-REV-1 are untouched; Pilot v0 produces no benchmark score and no claim about the current system's behaviour.

## Tests

`sinbad-ai-core/tests/pilot-v0-*.test.js` (48 tests; builders in `tests/helpers/pilot-v0-builders.js`, where the records are produced by the merged Gatekeeper v0 and Co-Pilot v0 inside the test): contract exactness, exports, provenance, determinism, digest, chaining and tamper detection; every decision class and the precedence between them; labelled-delivery policy and iteration budget; adversarial records (edited, resealed forgeries, wrong version, other task, other draft, from the future, mismatching verdict, missing review, failed-closed components); hostile inputs (throwing getters, proxies, cycles, oversized records); inertness, record-only access to the other components, no state surviving a call. Deterministic fixtures: `sinbad-ai-core/tests/fixtures/pilot-v0/cases.json` (24 cases: 8 BENIGN, 16 ADVERSARIAL, each with a hand-declared expected decision; expected records include their digests). On this fixture corpus false proceeding = 0/16 and false stopping or escalating = 0/8; this is a fixture measurement, not a measurement of any live system.

## Owner acceptance

Pilot v0 = OWNER ACCEPTED on 2026-09-18 (explicit Owner statement after the PR #264 merge report), against main `2326f3a859c9616a64572e30377fb891a07578a0` (PR #263), with the Project 2 state verified on main `229e6c61e24f09bb1f141faaa104e3b3aac46153`. The MERGE GO for PR #263 was not an acceptance; this later statement gave it. Scope: only the Pilot v0 implementation as merged - its current inert, deterministic, record-only, recommendation-only form; no component gains live execution authority and `MANIFEST.wiredInto` stays empty. Recorded in `docs/project2/PROJECT2_STATE.json` → `owner_acceptance.phase_3_6_pilot_v0`. This phase is not a GO for wiring, live integration or a model pass.
