# ADR-0024: Engine Candidate Policy and Audit Binding

## Status

Accepted as an inert, externally-unverified binding foundation.

## Decision

Define exact SHA-256 commitments for candidate evidence, provenance policy, license policy, isolation profile, and a future audit receipt. The v1 contract requires all signature, attestation, durable-audit, and revocation verification flags to remain `false`; callers cannot self-assert authority.

Even a structurally complete binding remains blocked pending policy authenticity/applicability, isolation attestation, durable append-only audit verification, revocation status, trusted time, and actor/device binding. Hashes are opaque format-checked labels and do not prove custody, signature, persistence, approval, or activation.

The module contains no audit writer/store, signature verifier, policy resolver, clock, identity provider, registration, loader, executor, or activation surface.

Caller-provided `engineId` is validated only to constrain the binding input and is never echoed as authenticated output. A future trusted catalog/verifier receipt must supply identity binding independently.

## Consequences

Future durable adapters and independent verifiers gain a versioned binding envelope without allowing evidence accumulation to activate an engine. Real durable storage, read-back integrity scans, trusted identities/time, revocation, and explicit activation decisions remain blocking.
