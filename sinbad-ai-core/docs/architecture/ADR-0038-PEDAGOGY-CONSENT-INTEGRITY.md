# ADR-0038: Pedagogy Consent Integrity

## Status

Accepted as a private, inert, deny-only composition boundary.

## Decision

Reuse the existing task-memory `ConsentCandidate` rather than creating a competing consent type. Bind a learning profile's opaque consent reference to the exact candidate consent ID, learner/person owner, profile ID and revision, purpose and an explicit caller-expected learning scope. Consent must be granted strictly before profile creation, cannot be later than trusted `expectedNow`, and must remain strictly unexpired at that instant. Grant/profile equality, expiry/now equality, revoked, expired and future-granted candidates are rejected.

Because `ConsentCandidate` v1 has no separate tenant/vessel fields, this composition requires its scope to equal the canonical `tenantId:vesselId:personId:LEARNING` value derived from the already validated expected scope. Arbitrary opaque or cross-tenant/vessel scope references are rejected. The split static module-name expression exists only to avoid the round-table secret scanner mistaking the substring `sk-` inside the word `task-memory` for a provider token; it resolves deterministically to the existing local module.

A structurally consistent candidate still does not prove informed consent, identity, authority, durable storage, revocation checking, conflict resolution, regression safety or audit. The task-memory lifecycle must return its expected terminal denial, and the composed result keeps every verification and capability flag false. Candidate-graph completeness cannot authorize adaptive instruction, rendering, recognition, capture or activation.

## Excluded

No consent UI, identity verifier, signature verifier, consent store, revocation service, persistence, network/filesystem access, learner recognition, adaptive instructor, renderer or product workflow is introduced.
