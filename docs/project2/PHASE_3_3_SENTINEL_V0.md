# Project 2 — Phase 3.3: Sentinel v0 (inert, observe-only)

Owner GO "PROJECT 2 / PHASE 3.3 — SENTINEL v0 ONLY" (2026-09-17), starting state main `c506f21869c237e601de019e85f4408c14afc289`. Scope delivered: Sentinel v0 as a pure, deterministic, testable component under `sinbad-ai-core/sentinel/`, built on the OWNER ACCEPTED Phase 3.1 contracts (`sinbad-ai-core/authority/*`, unchanged). No Gatekeeper, Pilot or Co-Pilot; no model, routing, runtime, bridge, Academy, GASM, Owner Console, ARGOS policy, protected-file or frozen-baseline change. `MANIFEST.status = INERT_COMPONENT`, `role = OBSERVER`, `authority = NONE`, `decides = false`, `wiredInto = []`.

## What Sentinel v0 is

`sentinel.observe(input) → SentinelReport`. One call, one observation, no memory between calls, no clock (the caller supplies `observedAt`), no I/O, no model call, never throws.

Input (`sinbad-sentinel-input/0-v1`, exact own-property snapshot, extra or missing fields fail closed):

| Field | Meaning |
|---|---|
| `observationId`, `tap`, `observedAt` | identity of the observation; tap ∈ INGRESS / POST_RETRIEVAL / POST_DRAFT / POST_GATE / DELIVERY (recorded, not interpreted in v0) |
| `context` | a Phase 3.1 `TaskContext` (task id, workflow/surface/principal refs, evidence scope, expiry) |
| `evidenceSet` | a Phase 3.1 `EvidenceSet` (identified items with source class, locator, content hash, observed time, scope) or `null` when none was supplied |
| `claims[]` | claim units the caller already segmented: `claimId`, `contentHash` (sha256 of the text), optional `text`, `evidenceIds`, `originRef`, `originScopeRef`, `assertionMode` ASSERTED / REPORTED |
| `policy` | `{maxEvidenceAgeMs}`; `DEFAULT_POLICY` = 24 h |
| `priorReportDigest` | optional digest of the previous report (hash chaining) |

Output (`sinbad-sentinel-report/0-v1`, frozen, sealed with `reportDigest`, verifiable with `verifyReport`):

- `status` OBSERVED or BLOCKED (fail-closed), `signal` CLEAR / ATTENTION / RISK / BLOCKED, `coverage` FULL / PARTIAL / NONE with `unobservable[]` reason codes.
- Per claim: `truthState` ∈ VERIFIED / NOT_VERIFIED / CONFLICT / SOURCE_MISSING / BLOCKED (from the Phase 3.1 label rules, applied to *eligible* evidence only), `reasonCode`, the evidence ids split into eligible / foreign / stale / unknown / non-authoritative / conflicting, detected reserved terms, whether specific values were present, the flags raised, and what could not be observed. The report never carries claim text, only its hash.
- Evidence summary: set id, item count, foreign ids, stale ids, drifted locators (same locator observed with two different contents, classified with `classifyConflict`).
- `flags[]`: typed early warnings in the Phase 3.1 `CoPilotVerdict.warning` shape, all `checkerKind = DETERMINISTIC`, each with a `pointerRef` to a claim, evidence id, locator or the evidence set.
- `ruleResults[]`: ten named rules in the Phase 3.1 `GateDecision.rule` shape (PASS/FAIL, proposed blocking flag, detail ref). They are signals; whether a FAIL blocks a real request is a future gate policy, never Sentinel's decision.
- `provenance`: input digest (sha256 of the canonical admitted input), context task id, evidence set id, policy, Sentinel and ruleset versions, prior report digest.

## Observation rules (`sinbad-sentinel-ruleset/0-v1`)

| Rule | Proposed severity | Fires when |
|---|---|---|
| SENTINEL.INPUT_ADMITTED | blocking | input is not exact, context invalid or expired at `observedAt`, evidence set invalid / for another task / observed in the future, claim invalid or duplicated, claim text does not match its content hash → whole report BLOCKED |
| SENTINEL.EVIDENCE_SET_PRESENT | soft | claims arrive without an evidence set → coverage PARTIAL, claims with evidence ids become NOT_VERIFIED (`EVIDENCE_SET_NOT_PROVIDED`), never VERIFIED |
| SENTINEL.EVIDENCE_IN_SCOPE | soft | an evidence item belongs to another evidence scope (Phase 3.1 `foreignItems`); such items never verify a claim |
| SENTINEL.EVIDENCE_FRESH | soft | an item is older than `policy.maxEvidenceAgeMs`; stale items never verify a claim |
| SENTINEL.EVIDENCE_CONSISTENT | soft | one locator observed with two different content hashes; every claim resting on that locator is CONFLICT |
| SENTINEL.PROVENANCE_RESOLVABLE | blocking | a claim cites an evidence id that is not in the set → claim BLOCKED (`UNKNOWN_EVIDENCE`), PROVENANCE_GAP BLOCKING |
| SENTINEL.CLAIMS_SUPPORTED | soft | an asserted claim is not VERIFIED → UNSUPPORTED_FACTUAL_ASSERTION (WARN) |
| SENTINEL.NO_UNSUPPORTED_SPECIFICS | blocking | an unsupported asserted claim states specific values (hex digests with a digit, `#123`, ISO dates, semantic versions) → UNSUPPORTED_FACTUAL_ASSERTION BLOCKING (confident invention) |
| SENTINEL.RESERVED_TERMS_BOUND | blocking | an asserted claim contains a reserved term (VERIFIED, PASS, MERGED, ONLINE, OWNER ACCEPTED, …) and is not VERIFIED → FALSE_CERTAINTY BLOCKING |
| SENTINEL.NO_FOREIGN_ADOPTION | blocking | a claim whose origin scope differs from the task's evidence scope is asserted without in-scope verification → CONTEXT_MISMATCH BLOCKING; the same claim REPORTED (attributed) or verified in scope is INFO only |

Additional deterministic flag: an asserted claim whose only eligible evidence is NORMATIVE (Owner directive, policy, authorization, release decision) is NOT_VERIFIED and raises SOURCE_EVIDENCE_MISMATCH (a class A source used as if it were a class B fact — ARCHITECTURE_AUTHORITY_MODEL.md). Model memory / inference evidence is non-authoritative and yields NOT_VERIFIED (`NON_AUTHORITATIVE_ONLY`).

Uncertainty is reported, not filled: missing evidence set → PARTIAL + `EVIDENCE_SET_NOT_PROVIDED`; missing claim text → PARTIAL + `CLAIM_TEXT_NOT_PROVIDED` and `specificValues = null`; a claim without evidence stays SOURCE_MISSING regardless of how plausible its wording is.

## What Sentinel v0 does not do

- It does not decide, admit, block, label a live answer, rewrite, approve, execute, or grant or consume authority (`decides = false`, `authority = NONE`).
- It does not read repositories, databases, the bridge, Ollama or any live system; it has no health/liveness probe (that would need I/O and a runtime GO).
- It does not segment free text into claims and does not judge claim content semantically; claim units, evidence identity and scope come from the caller. Its text screens are limited to reserved terms and specific-value patterns.
- It does not compare claim content with evidence content; provenance is checked by identity (evidence ids, content hashes, scopes, times), not by reading sources.
- It is not wired into `/ai/chat`, the bridge, the classroom, the dashboard, the Owner Console, edge functions, the benchmark harness or the package `exports` (asserted by `sinbad-ai-core/tests/sentinel-v0-inert.test.js`).
- It changes no model, routing, prompt, evidence, answer or authoritative state.

## Relation to the accepted contracts and the baseline

The Phase 3.1 contracts are consumed as-is: `task-context` (snapshot, expiry, isolation), `evidence-set` (snapshot, foreign items), `claim-labels` (label derivation, reserved terms), `authority-model` (dimensions, conflict classification), `copilot-verdict.warning` (flag shape). No contract file was modified. BASELINE-001 and BASELINE-001-REV-1 are untouched; Sentinel v0 produces no benchmark score and no claim about the current system's behaviour.

## Tests

`sinbad-ai-core/tests/sentinel-v0-*.test.js` (42 tests): contract exactness and exports; determinism, digest and chaining; missing / stale / conflicting / foreign / future-dated evidence; foreign claim adoption vs reported claims; confident invention with specific values; reserved terms; non-authoritative and normative-only evidence; provenance loss (unknown evidence ids, content-hash mismatch, edited reports, flag id caps); fail-closed behaviour for structural and semantic failures and hostile inputs (throwing getters, proxies, cycles); inertness (no I/O, clock, randomness, runtime or product identity in the sources; no live file or package surface imports it); shape compatibility of flags and rule results with the accepted contracts. Deterministic input/output fixtures: `sinbad-ai-core/tests/fixtures/sentinel-v0/cases.json` (8 cases covering every status, signal, coverage level and truth state except NOT_APPLICABLE; expected reports include their digests).

## Owner acceptance

Sentinel v0 = OWNER ACCEPTED on 2026-09-18 (explicit Owner statement after the PR #258 merge report), against main `8f47edcd6114cd1b4b586383c141c8e814c4b7f3` (PR #255). Scope: Sentinel v0 as delivered and merged; not an authorization to wire, execute or integrate it (`MANIFEST.wiredInto` stays empty). Recorded in `docs/project2/PROJECT2_STATE.json` → `owner_acceptance.phase_3_3_sentinel_v0`. Any wiring requires its own GO.
