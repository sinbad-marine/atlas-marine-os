# ADR-0025: Engine Validation Harness Contract

## Status

Accepted as an inert, externally-unverified validation-result foundation.

## Decision

Define exact commitments for a validation plan, fixture set, result bundle, and coverage evidence together with bounded balanced test counts and at least one adversarial case. Failed or skipped tests prevent a clean candidate claim. Caller-provided isolation and independent-verification flags must remain `false`; only future verifier-produced attestations may establish those facts.

Even a clean claimed suite remains activation-blocked pending verified isolation execution, independent result verification, signed result bundles, adversarial coverage review, and reproducibility evidence. Hashes and counts are untrusted declarations, not proof.

The module contains no test runner, sandbox, fixture loader, coverage collector, signature verifier, filesystem/network/process operation, readiness grant, or activation surface.

## Consequences

Future engine programs gain a versioned validation evidence envelope without allowing self-reported green tests to authorize registration or execution. Real harness execution, independent reproduction, policy-specific acceptance thresholds, and signed durable evidence remain blocking.
