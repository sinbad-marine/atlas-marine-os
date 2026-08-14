# ADR-0023: Engine Candidate Readiness Composition

## Status

Accepted as an inert, always-blocked composition boundary.

## Decision

Compose the ADR-0016 manifest assessment, ADR-0020 nominal candidate catalog, ADR-0021 process-local evidence, and ADR-0022 isolation declaration through one exact, accessor-safe input. Reject manifest, evidence, isolation, and engine-identity failures distinctly. Even a complete inert chain returns `ready: false`, `loadAllowed: false`, `executeAllowed: false`, and `activationAllowed: false` with durable-audit and explicit-activation gaps.

This composition performs no loading, execution, registration, persistence, network, filesystem, process, credential, or physical-control operation. It does not turn process-local evidence or an isolation declaration into external assurance.

## Consequences

Future consumers have a single fail-closed readiness check and cannot infer readiness from one favorable-looking sub-result. Durable audit, signed policy/profile attestation, enforced sandbox verification, validation harness evidence, revocation, and explicit activation remain blocking.
