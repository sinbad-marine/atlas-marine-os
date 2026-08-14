# ADR-0030: Stability Reference Results and Independent Check Candidates

## Status

Accepted as an inert, deny-only Stability Foundation contract.

## Decision

Represent a versioned `StabilityReferenceResultCandidate` and `IndependentStabilityCheckCandidate`. The host binds the exact tenant, vessel, Stability Package, test condition, reference-result identity, input-set commitment and trusted upper time bound. The check must use a different checker, method, method version, input commitment and result commitment from the reference result.

Both records can only be `UNVERIFIED` or explicitly `REJECTED`. Distinct checker, method, version and hash strings are only format-checked separation commitments; renamed, recycled or colliding identities are not proof of independence. Structurally complete records do not prove source authenticity, correct calculations, criteria satisfaction, uncertainty treatment, independent reproduction, class/flag acceptance or approval. Evaluation therefore always returns `STABILITY_REFERENCE_VERIFICATION_BLOCKED` and never grants calculation, approval or activation.

Canonical field order is part of each versioned JSON wire contract; exact in-memory records are normalized by schema order before serialization. Hashes, references, identities and timestamps are untrusted declarations until independently authenticated by a future assurance boundary. `expectedNow` must come from a trusted host clock and all timestamps are bounded to the ECMAScript date range.

## Excluded

No hydrostatics, KN/GZ, intact/damage stability, trim/list, longitudinal-strength or loading calculation is performed. No solver, comparison engine, verifier, approver, persistence, alarm, loading computer, physical control or package export is introduced.
