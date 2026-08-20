# ADR-0037: Pedagogy Governance and Grounding Integrity

## Status

Accepted as a private, inert, deny-only composition boundary.

## Decision

Compose the ADR-0036 pedagogy chain with existing sensitive-data governance and truth/safe-stop candidates. A learning profile must bind the exact `LEARNING` descriptor, retention policy and isolation context for the same tenant, vessel, person, resource and purpose. A pedagogy decision must bind a `TruthClaim` whose scope is the lesson being presented.

Composition proves only referential and temporal consistency. Candidate consent, classification, isolation and truth records do not become verified merely because their graph is complete. The existing critical-claim gate remains safe-stop-only, and the terminal result denies adaptive instruction, rendering, recognition, capture and activation pending external consent, source currency/applicability, independent checking, qualified human review and renderer assurance.

`expectedNow` is a trust-boundary value and must be supplied by a trusted clock adapter, never copied from learner or remote request data. Retention, review and isolation end instants are exclusive: equality with `expectedNow` is expired. `IsolationContextCandidate` intentionally contains no classification/domain fields; those remain bound through its descriptor and policy references.

The evaluator remains pure and performs no logging. An `ASSESSOR_FAULT` result must be emitted by its future calling boundary as a redacted structured security/operational event; it must never be treated as an ordinary successful denial or retried into an allow decision.

Internal exceptions use the distinct `PEDAGOGY_FOUNDATION_INTEGRITY_FAULT` status. A structurally complete graph is labelled `COMPLETE_CANDIDATE_GRAPH`, never simply complete. Unknown truth-gate reasons and unexpected pedagogy-stage outcomes are rejected as contract drift instead of entering that terminal candidate path.

`TruthClaim` v1 has no tenant, vessel or person fields. This composition therefore binds it only by claim ID and exact lesson scope; cross-tenant claim custody remains an activation blocker until a scoped truth-claim revision exists. Likewise, `consentRef` remains an unverified opaque reference because no consent-verifier/store boundary exists. Callers must never infer consent from candidate-graph completeness.

## Excluded

No consent verifier/store, learner identity recognition, data persistence, knowledge engine, adaptive instructor, renderer, capture path, competency certification or product workflow is introduced.
