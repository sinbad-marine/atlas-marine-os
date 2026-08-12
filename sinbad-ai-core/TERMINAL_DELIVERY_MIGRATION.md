# Phase 2Q–2W terminal delivery migration

## Supported production path

Production consumers must use exactly one package entry point:

1. `adapters/trusted-terminal-delivery-adapter.js` → `create({ present })`
   followed by `deliver(authorization)`

The trusted adapter internally enforces Phase 2P through Phase 2W. Package
`exports` exposes only this adapter. Receipt, verification, closure, audit,
completion and transition modules remain repository-internal for contract tests
and composition; they are not production APIs. A repository-relative import can
still bypass package exports, so production lint/build rules must forbid imports
below the package root.

## Required trusted context

Phase 2X generates `attemptId`, `closureId`, `auditId` and `transitionId`
internally. `deliver()` accepts no context argument and binds the generated IDs
to the authentic authorization's exact transaction, session and channel.

Configure `present` once inside the trusted adapter boundary. Only an exact
boolean `true` return becomes `DELIVERED`; false, other values and exceptions
become a fully verified `FAILED`. No caller-supplied outcome is accepted.
Concurrent calls for the same authorization are locked before presentation.
Unexpected failures after presentation return `TRUSTED_TERMINAL_DELIVERY_BLOCKED`
rather than claiming a verified failure. The optional `diagnose` hook receives
fixed codes only and must not log response content.

The presentation side effect and Core's process-local terminal record cannot be
one distributed transaction. A post-presentation `BLOCKED` result is terminal
for that authorization and must never retry presentation with the same object.
The trusted transport adapter must use its own durable idempotency key and start
a newly authorized recovery workflow when operator policy permits it.

## Breaking changes

- An authorization already consumed through standalone Phase 2P cannot enter
  Phase 2V and is deliberately non-retriable.
- Intermediate Phase 2P–2U values cannot update terminal state.
- Phase 2V completions update terminal state once through Phase 2W.
- Authenticity and replay state are process-local. Persisted hashes are audit
  observations, not portable credentials. Durable idempotency remains the
  responsibility of the trusted persistence adapter.
- Phase 2P–2W is one version-coupled unit and must be deployed atomically. A
  partial module upgrade is expected to fail at startup rather than degrade.
- A failure after any single-use stage is non-retriable with the same
  authorization. Record a metric, create a fresh authorized attempt through the
  trusted workflow, and never resume from an intermediate object.

## Rollout checklist

- Remove production calls to standalone terminal Phase 2P–2U APIs.
- Remove production calls to standalone Phase 2V and 2W APIs.
- Import the package root only and reject repository-relative internal imports.
- Configure the trusted `present` function at adapter startup.
- Configure content-free diagnostic/metric handling if operationally required.
- Persist adapter-side idempotency before presentation; never retry a blocked
  authorization or resume from an intermediate Core object.
- Call only `deliver(authorization)`; do not accept terminal context from clients.
- Persist only the minimal terminal transition/audit fields required by policy.
- Treat blocked results uniformly and never fall back to an earlier phase.
- Run the complete SINBAD Core test suite before deployment.
