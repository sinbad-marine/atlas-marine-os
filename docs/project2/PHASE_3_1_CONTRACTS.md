# Project 2 — Phase 3.1: authority contracts (inert)

Owner IMPLEMENTATION GO "PHASE 3.1 CONTRACTS ONLY" (2026-09-17). Scope delivered: versioned, exact, frozen contracts under `sinbad-ai-core/authority/` with unit tests. No live wiring, no I/O, no execution, no model, no runtime, Academy, GASM, Owner Console or ARGOS assurance change. `MANIFEST.status = INERT_CONTRACTS`, `authority = NONE`, `wiredInto = []` (asserted by `sinbad-ai-core/tests/authority-contracts-inert.test.js`, which also proves no live file imports them and no product identity is embedded).

## Modules

| Module | Version | What it fixes |
|---|---|---|
| `authority-model.js` | sinbad-authority-model/1-v1 | Two dimensions (NORMATIVE / OBSERVED) plus NONE for model memory/inference; `canAuthorize`, `canEstablishFact`; `classifyConflict` — cross-dimension disagreements are not conflicts (record both), normative conflicts escalate to the Owner, observed conflicts prefer the higher-quality observation of the same fact, non-authoritative inputs are discarded. |
| `claim-labels.js` | sinbad-claim-labels/1-v1 | The six truth-state labels; `labelClaim` derives a label only from source classes (SOURCE_MISSING / CONFLICT / VERIFIED / NOT_VERIFIED / NOT_APPLICABLE; invalid input → BLOCKED); reserved terms (VERIFIED, PASS, MERGED, DEPLOYED, ONLINE, SAFE, COMPLIANT, AAL2, OWNER ACCEPTED, AUTHORIZED, READY FOR MERGE, APPROVED, COMPLETE) detected as whole words and reported unbound unless tied to evidence. |
| `task-context.js` | sinbad-task-context/1-v1 | TaskContext with opaque workflow/surface/principal/authority/evidence-scope refs, optional state snapshot hash, bounded lifetime; `isolationCheck` marks evidence from another scope FOREIGN_SCOPE; `isExpired` is fail-closed. |
| `evidence-set.js` | sinbad-evidence-set/1-v1, sinbad-evidence-map/1-v1 | Identified evidence items (source class, locator, content hash, observation time, scope); EvidenceMap claim → evidence ids; `verifyMap` yields BOUND / UNBOUND / UNKNOWN_EVIDENCE / UNSUPPORTED_NON_AUTHORITATIVE per claim and MAP_BOUND / MAP_UNBOUND / MAP_INVALID overall; `foreignItems` against a TaskContext. |
| `copilot-verdict.js` | sinbad-copilot-verdict/1-v1 | The twelve hallucination early-warning classes, severities INFO/WARN/BLOCKING, checker kind DETERMINISTIC/MODEL per warning, recommendation ALLOW/LABEL/ESCALATE/BLOCK with consistency rules; `authority` is always NONE; no approve/apply/rewrite export. |
| `gate-decision.js` | sinbad-gate-decision/1-v1 | Deterministic composition of rule results and an optional verdict into ADMIT / LABEL / ESCALATE / BLOCK with separate attribution (`deterministicRuleIds` vs `modelVerdictId`) and `failClosed`. Policy v1: a failed blocking rule blocks; a missing verdict on a protected POST-stage action blocks; a BLOCKING model warning blocks only protected actions and otherwise labels or escalates; soft failures and WARN label NOT_VERIFIED; invalid inputs block closed. |
| `index.js` | sinbad-authority-contracts/1-v1 | Manifest and re-exports. |

## What these contracts do not do

They do not read repositories, databases or live systems; they do not call models; they do not decide anything for a real request; they are not reachable from the bridge, the dashboard, the classroom, the Owner Console or any edge function; they are not part of the package `exports`. Wiring them (Phase 3.3+) needs a separate Owner GO.

## Tests

`sinbad-ai-core/tests/authority-*.test.js` (29 tests): exact snapshotting (accessor, inherited, extra, symbol, coercion rejection), dimension rules, conflict classification, label derivation, reserved-term detection, isolation, evidence-map verification, verdict consistency and lack of authority, gate composition and attribution, inertness and product-identity absence.

## Owner acceptance

Phase 3.1 contract set = OWNER ACCEPTED on 2026-09-17 (Owner instruction "PROJECT 2 / ACCEPTANCE CLOSURE ONLY", after the PR #253 merge report), against main `bd0c167ab15b0399086ce92eea828788535ef4fb` (PR #252). Scope: the contracts as delivered and merged; not an authorization to wire, execute or integrate them (`MANIFEST.wiredInto` stays empty). Recorded in `docs/project2/PROJECT2_STATE.json` → `owner_acceptance.phase_3_1_contracts`.

## Relation to BASELINE-001

These contracts encode the labels and checks that the frozen baseline showed missing in the current system (0/8 verifiable citations, ≥6 confident inventions, foreign claims accepted). They change no score; the baseline remains the untouched reference.
