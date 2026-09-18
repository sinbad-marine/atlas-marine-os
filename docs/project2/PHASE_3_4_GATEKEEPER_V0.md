# Project 2 — Phase 3.4: Gatekeeper v0 (inert, deterministic post-gate, label-only)

Owner GO "PROJECT 2 / PHASE 3.4 — GATEKEEPER v0 ONLY" (2026-09-17), starting state main `b06345e`. Scope delivered: Gatekeeper v0 as a pure, deterministic, testable component under `sinbad-ai-core/gatekeeper/`, built on the OWNER ACCEPTED Phase 3.1 contracts (`sinbad-ai-core/authority/*`, unchanged) and the merged Sentinel v0 (`sinbad-ai-core/sentinel/*`, unchanged) as its observation engine. No Pilot or Co-Pilot; no model, routing, runtime, bridge, Academy, GASM, Owner Console, ARGOS policy, protected-file or frozen-baseline change. `MANIFEST.status = INERT_COMPONENT`, `role = DETERMINISTIC_GATE`, `stage = POST`, `authority = NONE`, `executes = false`, `delivers = false`, `enforces = false`, `wiredInto = []`.

## What Gatekeeper v0 is

`gatekeeper.decide(input) → GatekeeperDecision`. One call, one decision on paper, no memory between calls, no clock (the caller supplies `observedAt`), no I/O, no model call, never throws.

Input (`sinbad-gatekeeper-input/0-v1`, exact own-property snapshot, extra or missing fields fail closed):

| Field | Meaning |
|---|---|
| `decisionId`, `observedAt` | identity and time of the decision |
| `context` | a Phase 3.1 `TaskContext` (task id, evidence scope, authority refs, expiry) |
| `evidenceSet` | a Phase 3.1 `EvidenceSet` or `null` when none was supplied |
| `draft` | `draftId`, `draftHash`, `claims[]` (Sentinel claim units), `citations[]` (`citationId`, `evidenceId`), `proposedActions[]` (`actionId`, `actionClass` READ / WRITE / EXECUTE / DELIVER, `protected`, `authorityRef`); WRITE and EXECUTE are always protected, a draft that declares otherwise is invalid |
| `verdict` | an optional Phase 3.1 `CoPilotVerdict` (an input signal, never a rule) |
| `policy` | `{maxEvidenceAgeMs, volatileMaxEvidenceAgeMs}`; `DEFAULT_POLICY` = 24 h / 5 min |
| `priorDecisionDigest` | optional digest of the previous decision (hash chaining) |

Output (`sinbad-gatekeeper-decision/0-v1`, frozen, sealed with `decisionDigest`, verifiable with `verifyDecision`, which also re-verifies the embedded Sentinel report):

- `outcome` ADMIT / LABEL / ESCALATE / BLOCK, `failClosed`, `reasonCode`, `labels[]`, `deliveryLabel` (the worst label over asserted claims, or BLOCKED).
- `decision`: the accepted Phase 3.1 `GateDecision` that composed the outcome, so every outcome is attributed to deterministic rule ids or to a verdict id.
- `claimLabels[]`: per claim the Sentinel truth state, reason code, eligible evidence ids and whether the volatile rule failed for it. The decision never carries claim text.
- `actions[]`: per proposed action ADMITTED / ESCALATED / BLOCKED with a reason code. These are statuses on paper; nothing is executed or delivered.
- `ruleResults[]`: sixteen named rules in the `GateDecision.rule` shape; `observation`: the full Sentinel report; `provenance`: input digest, task id, evidence set id, draft id and hash, observation digest, verdict id, prior decision digest, policy and versions.

## Gate rules (`sinbad-gatekeeper-ruleset/0-v1`)

| Rule | Severity | Source | Fails when |
|---|---|---|---|
| GATE.INPUT_ADMITTED | blocking | gate | input not exact, policy / context / evidence set / draft / verdict invalid, context expired, evidence set for another task → whole decision BLOCK with the reason code |
| GATE.OBSERVATION_AVAILABLE | blocking | gate | the Sentinel observation came back BLOCKED (`OBSERVATION_<reason>`) |
| GATE.CITATIONS_IN_EVIDENCE | blocking | gate | a citation refers to an evidence id that is not in the task evidence set (including when no set was supplied) |
| GATE.CLAIM_EVIDENCE_RESOLVABLE | blocking | SENTINEL.PROVENANCE_RESOLVABLE | a claim names an unknown evidence id |
| GATE.SPECIFICITY_SUPPORTED | blocking | SENTINEL.NO_UNSUPPORTED_SPECIFICS | specific values asserted in a claim that is not VERIFIED (confident invention) |
| GATE.VOCABULARY_BOUND | blocking | SENTINEL.RESERVED_TERMS_BOUND | a reserved term in a claim that is not VERIFIED |
| GATE.FOREIGN_CLAIMS_EXCLUDED | blocking | SENTINEL.NO_FOREIGN_ADOPTION | a foreign-scope claim asserted without in-scope verification |
| GATE.VOLATILE_CLAIMS_LIVE | blocking | gate | an asserted claim about the present state (now / currently / today / şu anda / bugün / çalışıyor …) is not VERIFIED by LIVE_SYSTEM or DATABASE evidence younger than `volatileMaxEvidenceAgeMs` |
| GATE.ACTIONS_AUTHORIZED | blocking | gate | a protected action carries no authority reference present in the task context; the gate never grants one |
| GATE.VERDICT_MATCHES_DRAFT | blocking | gate | a supplied verdict is for another task or another draft hash; such a verdict is not passed to the composition |
| GATE.CLAIMS_SUPPORTED | soft | SENTINEL.CLAIMS_SUPPORTED | an asserted claim is not VERIFIED |
| GATE.EVIDENCE_CONSISTENT | soft | SENTINEL.EVIDENCE_CONSISTENT | one locator observed with two contents |
| GATE.EVIDENCE_FRESH | soft | SENTINEL.EVIDENCE_FRESH | an evidence item older than `maxEvidenceAgeMs` |
| GATE.EVIDENCE_IN_SCOPE | soft | SENTINEL.EVIDENCE_IN_SCOPE | an evidence item from a foreign scope |
| GATE.PROVENANCE_ADEQUATE | soft | gate | claims without an evidence set, or an asserted claim naming no evidence id |
| GATE.CLAIM_TEXT_OBSERVABLE | soft | gate | an asserted claim carries no text, so vocabulary, specificity and volatility could not be screened |

Sentinel-sourced rules are mapped from the embedded observation (outcome and detail ref), not re-derived. Composition follows the accepted `GateDecision` contract: a blocking rule failure is BLOCK attributed to the rule ids, and a clean verdict never lifts it; soft failures are LABEL; a protected action without a verdict fails closed; Co-Pilot WARN labels, Co-Pilot BLOCKING escalates or labels a read-only draft and blocks a protected action, attributed to the verdict id.

## What Gatekeeper v0 does not do

- It does not execute, deliver, enforce, rewrite, approve, or grant or consume authority (`authority = NONE`, `executes = false`). ADMIT / LABEL / ESCALATE / BLOCK exist only as a sealed record.
- It does not read repositories, databases, the bridge, Ollama or any live system, keeps no state and calls no model.
- It does not segment text into claims, judge claim content semantically, or compare claim content with evidence content; its own text screen is limited to the volatile-state pattern, the rest comes from Sentinel v0.
- It is not a pre-gate: `stage` is POST only.
- It is not wired into `/ai/chat`, the bridge, the classroom, the dashboard, the Owner Console, edge functions, the benchmark harness or the package `exports` (asserted by `sinbad-ai-core/tests/gatekeeper-v0-inert.test.js`).

## Relation to the accepted contracts, Sentinel v0 and the baseline

The Phase 3.1 contracts (`task-context`, `evidence-set`, `copilot-verdict`, `gate-decision`, `exact`) and Sentinel v0 are consumed as-is; no file under `sinbad-ai-core/authority/` or `sinbad-ai-core/sentinel/` was modified. BASELINE-001 and BASELINE-001-REV-1 are untouched; Gatekeeper v0 produces no benchmark score and no claim about the current system's behaviour.

## Tests

`sinbad-ai-core/tests/gatekeeper-v0-*.test.js` (43 tests; builders in `tests/helpers/gatekeeper-v0-builders.js`, reusing the Sentinel builders): contract exactness, exports, provenance, determinism, digest, chaining and tamper detection (decision and embedded observation); every gate rule including volatile claims in English and Turkish; action authority, protected actions without a verdict, mismatching verdicts, Co-Pilot WARN / BLOCKING attribution; fail-closed behaviour for every invalid-input reason and hostile inputs; inertness. Deterministic input/output fixtures: `sinbad-ai-core/tests/fixtures/gatekeeper-v0/cases.json` (20 cases: 8 BENIGN, 12 ADVERSARIAL; expected decisions include their digests). On this fixture corpus false blocking = 0/8 and false allowing = 0/12; this is a fixture measurement, not a measurement of any live system.

## Owner acceptance

Gatekeeper v0 = OWNER ACCEPTED on 2026-09-18 (explicit Owner statement after the PR #258 merge report), against main `0424552324709eaf6d9b04d083ee4d2a893b4ad8` (PR #257). Scope: Gatekeeper v0 as delivered and merged; not an authorization to wire, enforce, execute or integrate it (`MANIFEST.wiredInto` stays empty). Recorded in `docs/project2/PROJECT2_STATE.json` → `owner_acceptance.phase_3_4_gatekeeper_v0`. Any wiring of Sentinel or Gatekeeper requires its own GO.
