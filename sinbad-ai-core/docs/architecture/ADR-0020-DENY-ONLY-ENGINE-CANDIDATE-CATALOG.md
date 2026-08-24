# ADR-0020: Deny-Only Engine Candidate Catalog

## Status

Accepted as an inert catalog foundation.

## Context

ADR-0016 validates universal A–O engine manifests but intentionally supplies no registry, loader, or executor. A future module program needs deterministic candidate inventory without allowing a catalog operation to become registration, trust, loading, or activation authority.

## Decision

- Introduce an internal candidate catalog that invokes the ADR-0016 assessment directly.
- Retain only immutable assessment metadata: engine identity, port, blocked status, reason, and assurance gaps.
- Never retain the submitted manifest, module reference, callback, credentials, policy material, or executable object.
- Reject invalid and duplicate candidates without changing catalog state.
- Require the manifest assessor's explicit `catalogable: true` and `activationAllowed: false` invariants rather than inferring eligibility from a reason string.
- Keep at most 256 process-local entries and reject overflow pending capacity review.
- Expose only `consider`, `get`, and deterministic `list`; expose no unregister, loader, executor, activator, discovery, filesystem, network, or persistence surface.
- Every cataloged candidate remains activation-, load-, and execution-blocked.

## Consequences

Core can build an inert inventory for future validation planning without creating authenticated registration or executable module trust. Loading, sandbox verification, signature/provenance verification, audit binding, persistence, revocation, and explicit activation decisions remain separate activation-blocking work.

The catalog is ephemeral and non-authoritative: process restart clears it, and `list()` must never be treated as activation, deployment, installation, or durable registration evidence. Non-string lookups intentionally return `null` without coercion.
