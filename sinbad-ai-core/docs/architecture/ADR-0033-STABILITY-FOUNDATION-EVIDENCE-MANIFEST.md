# ADR-0033: Stability Foundation Evidence Manifest

## Status

Accepted as an ephemeral, deny-only evidence foundation.

## Decision

Seal evidence only after every component passes its strict canonical serializer/deserializer and the resulting new snapshot graph is re-evaluated through the internal integrity composition. Caller object identity and caller-supplied assessments are never trusted. Only the exact frozen `COMPLETE` integrity result with the allow-listed shape, blocked status and all assurance/authority flags false can produce a same-process authentic evidence object.

The hidden manifest binds canonical SHA-256 commitments for the package, five typed sources, test and loading conditions, reference result, independent check, criteria applicability and uncertainty budget. It also binds tenant, vessel, package, host time, integrity status and terminal denial reason. The public evidence exposes only the scope identities and aggregate hashes; it does not disclose component records or hashes.

Evidence verification proves only same-process object provenance and deterministic manifest integrity, and echoes its bound tenant, vessel, package and host-time declaration. The WeakSet/WeakMap brand is deliberately process-local and is not a cross-process or cryptographic security boundary. Verification explicitly does not prove durable custody, signatures, trusted time, source authenticity, independent reproduction, stability correctness, class/flag approval or activation authority. Copies and serialized clones are rejected.

## Excluded

No storage, filesystem or network write, signature service, audit appender, evidence reader, approval, solver, loading computer, public package export or physical-control capability is introduced.
