# ADR-0034: Stability Evidence Custody and Audit Candidate

## Status

Accepted as an ephemeral, deny-only initial custody event foundation.

## Decision

Create a custody/audit candidate only from the same-process authentic Stability Foundation evidence handle. The evidence verified-handle status, terminal denial reason, hashes and every authority flag form an exact versioned dependency; any dependency drift fails closed. A handle is consumed only after a complete valid custody candidate is created: rejected contexts are not observations and do not consume it. The candidate binds audit and custody identities, tenant, vessel, package, custodian and policy references, observation time, foundation hash and evidence hash into a deterministic event hash.

Contract v1 permits only an initial candidate with `previousEventHash: null`. It does not accept a caller-asserted predecessor and does not claim an append-only chain. Observation time may equal but must not precede the evidence manifest's bounded host-time declaration. The timestamp remains an untrusted caller declaration and may not be used as freshness or legal custody proof. Candidate verification proves only same-process object provenance and deterministic hidden-manifest integrity.

Every result remains non-durable, append-only-unverified, custody-unverified, unapproved and activation-blocked. Real persistence, atomic append, read-back, signatures, trusted actor/time, retention, export, revocation and independent custody verification require separate adapters and activation gates.

## Excluded

No filesystem/database/network writer, audit appender, signer, trusted clock, identity provider, approval, loading computer, public package export or physical-control capability is introduced.
