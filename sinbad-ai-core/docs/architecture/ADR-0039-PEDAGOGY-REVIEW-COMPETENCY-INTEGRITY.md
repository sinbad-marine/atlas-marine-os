# ADR-0039: Pedagogy Review and Competency Integrity

## Status

Accepted as a private, inert, deny-only composition boundary.

## Decision

Reuse governance `EvidenceCandidate` and `ApprovalCandidate` records rather than creating a parallel approval system. A learning profile's competency evidence reference must identify an `UNVERIFIED` `COMPETENCY_OBSERVATION` whose content is the exact `PLANNED` or `PAUSED` lesson progress evidence. That progress reference is the SHA-256 commitment of the canonical JSON tuple `[tenantId,vesselId,profileId,personId,"PROGRESS"]`, preventing delimiter ambiguity and cross-scope/cross-learner substitution. Evidence must have a finite validity window. A human-review request must reference that same evidence under the same tenant, vessel and competency requirement.

The approval candidate remains `PENDING` with a null signature. Structural consistency never verifies competency, completes a lesson, certifies a learner, authorizes adaptive instruction or permits rendering. The existing governance approval evaluator must reach its expected terminal denial requiring verification, signature and authorization; qualified reviewer identity, assessment policy, evidence provenance, durable audit and independent oversight remain external blockers.

Only the two structural `Bound` flags become true at the final candidate-graph denial; every verification, completion and capability flag remains false. The v1 governance approval contract has no person subject field, so local tuple binding is defense-in-depth rather than approval authority. Callers must enforce durable uniqueness/replay protection for evidence and approval IDs before any future activation proposal.

## Excluded

No examination engine, score/pass calculation, certificate issuer, instructor identity verifier, signature verifier, adaptive instructor, renderer, persistence, network/filesystem operation or Academy-specific workflow is introduced.
