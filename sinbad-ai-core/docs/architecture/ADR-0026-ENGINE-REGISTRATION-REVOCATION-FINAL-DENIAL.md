# ADR-0026: Engine Registration, Revocation, and Final Activation Denial

## Status

Accepted as an inert final motor-port backbone boundary.

## Decision

Registration, quarantine, and revocation requests are exact, non-coercive assessments that never apply a state transition. Revocation is terminal and cannot be reversed by a request. Quarantine/revocation require durable receipts plus read-back integrity; registration requires authenticated external authority, policy/audit validation, validation-harness verification, revocation checks, and durable registration evidence.

A separate final gate accepts only format-checked receipt labels and always denies activation. Receipt accumulation cannot produce registration, readiness, loading, execution, an allowed mode, or activation. Authenticity, cross-binding, revocation status, and explicit activation authority remain unverified.

Outputs never publish `registered: false` or `revoked: false`, because an unchecked negative could be misread as verified state. They expose only `registrationVerified: false` and `revocationVerified: false`. A caller-claimed `REVOKED` state remains terminal for transition assessment but is not promoted into verified revocation evidence.

No registry writer, durable store, state mutator, loader, executor, activator, network/filesystem/process operation, credential access, or physical-control surface is introduced.

## Consequences

The inert universal motor-port backbone now has an explicit terminal denial boundary. This does not close Core Release Gate, authorize specialized engines, or activate Stability/Load Master/control functions. Future operational registration requires a separately reviewed certified program and explicit user-authorized release workflow.
