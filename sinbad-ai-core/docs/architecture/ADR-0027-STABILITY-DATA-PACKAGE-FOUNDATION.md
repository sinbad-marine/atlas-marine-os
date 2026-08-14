# ADR-0027: Stability Data Package Foundation

## Status

Accepted as a DRAFT-only, inert maritime-engine input foundation.

## Decision

Define a tenant/vessel-scoped Stability Data Package that binds a vessel profile, geometry, lightship, tank plan, compartment plan, hydrostatics, cross-curves, provenance-set and content commitments. Packages are revisioned and `DRAFT` only. Evaluation always blocks approval, verification, validation, calculations, loading-computer use, and activation pending approved references, provenance, independent calculation/V&V, and class/flag review.

All hashes are format-checked, untrusted labels. Their presence proves neither canonical-byte integrity nor provenance custody and cannot be used for authorization. `createdAt` is an unverified draft timestamp and cannot drive audit/order decisions until a trusted-time and revision-graph verifier exists. Identifiers are structured values and must never be concatenated into paths, cache keys, or authority scopes without separate encoding and scope validation.

The module contains no hydrostatics/KN/GZ solver, intact/damage stability calculation, tank/sounding processor, longitudinal-strength calculation, approval generator, persistence, loading computer, or control function.

## Consequences

Stability work begins behind the completed universal motor-port denial boundary without claiming a Stability Booklet or vessel-specific approval. Subsequent phases may add inert typed source records and test-condition candidates; live calculations and official use remain separate gated programs.
