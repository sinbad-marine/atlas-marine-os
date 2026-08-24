# ADR-0021: Engine Candidate Decision Evidence

## Status

Accepted as non-durable, deny-only evidence foundation.

## Decision

Only a same-process nominally authentic ADR-0020 catalog entry with the exact cataloged-blocked status, incomplete-assurance reason, deny-only flags, and normalized string assurance gaps may produce candidate decision evidence. The evidence binds a deterministic hash to minimal catalog metadata and the sorted unique assurance-gap commitment. Copies, clones, proxies, duplicate/invalid rejections, and reconstructed objects cannot produce or verify evidence. `isAuthenticEntry` is an internal construction check, never an authorization decision.

The evidence is explicitly `durable: false` and `activationAllowed: false`. It contains no manifest, callback, module, credential, policy content, timestamp, actor identity, approval, or executable reference. Verification proves only same-process construction and hash integrity; it is not durable audit, signature verification, provenance custody, installation, loading, approval, or activation evidence.

## Consequences

Future durable audit work can bind to a stable content-minimized evidence hash without mistaking the current process-local catalog for authority. Durable append-only storage, actor/device identity, trusted time, signature verification, revocation, policy binding, and explicit activation decisions remain blocking.
