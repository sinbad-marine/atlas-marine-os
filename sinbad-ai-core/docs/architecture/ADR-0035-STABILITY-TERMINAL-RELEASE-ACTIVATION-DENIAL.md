# ADR-0035: Stability Terminal Release and Activation Denial

## Status

Accepted as the terminal deny-only boundary for Stability Foundation contract v1.

## Decision

Consume a same-process authentic custody candidate at most once and issue only a terminal `DENIED` decision for Foundation publication, Stability Booklet use, loading-computer use or operational activation. Decision identities are unique within the process and cannot be reused with another custody candidate or capability. The request binds decision, tenant, vessel, package, requested capability, requester, release policy and time to the exact custody event and evidence hash. Request time may equal, but cannot precede, custody observation time; both remain untrusted declarations pending a trusted-clock boundary.

Every supported capability is denied even when all preceding candidate records are structurally coherent. The denial is final for this contract version and cannot be transformed into approval by accumulating evidence. A future positive path requires a new versioned contract and ADR, durable custody/read-back, trusted identity/time, independent calculations and reproduction, applicable criteria, class/flag and vessel-specific approval, adversarial review, and explicit release authorization.

The terminal decision is same-process authentic and content-addressed but remains private. Its cached verified denial remains within the same authenticity chain and repeated verification is idempotent. Verification confirms only object provenance and hidden-manifest integrity while preserving every publication, booklet, loading-computer, operational-use and activation flag as false.

## Excluded

No publication, official Stability Booklet claim, loading computer, operational use, approval, deployment, persistence, network/filesystem action or physical-control capability is introduced.
