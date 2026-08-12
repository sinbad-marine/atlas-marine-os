# Phase 2Q–2W terminal delivery migration

## Supported production path

Production consumers must use exactly one package entry point:

1. `adapters/trusted-terminal-delivery-adapter.js` →
   `create({ present, idempotencyStore })`
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
Post-claim chain denial returns `TRUSTED_TERMINAL_DELIVERY_BLOCKED` only after
its minimal failure stage is durably settled. Settlement failure after
presentation or state application returns `TRUSTED_TERMINAL_DELIVERY_UNSETTLED`
with reason `DURABLE_SETTLEMENT_REQUIRED`; it must not be interpreted as “not
presented.” The optional `diagnose` hook receives fixed codes only.

Configure a shared durable `idempotencyStore`. Its `claim(key)` operation must
atomically insert the unique key and return exactly `true` only to the winner;
read-then-write is forbidden. `settle(key, summary)` must durably attach the
minimal terminal summary to that existing claim. An unavailable or ambiguous
store fails closed and must not fall back to process-local deduplication.
The store must advertise the exact contract version, `durable: true`, and a
positive `claimLeaseMs`. Its lease recovery must be atomic/fenced so an
ambiguous client timeout cannot create two live winners. Claim keys are internal
and are intentionally not exported by the package API.

The presentation side effect and Core's process-local terminal record cannot be
one distributed transaction. A post-presentation `UNSETTLED` result is terminal
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
- Configure and health-check the shared atomic idempotency store.
- Configure content-free diagnostic/metric handling if operationally required.
- Persist adapter-side idempotency before presentation; never retry a blocked or
  unsettled
  authorization or resume from an intermediate Core object.
- Call only `deliver(authorization)`; do not accept terminal context from clients.
- Persist only the minimal terminal transition/audit fields required by policy.
- Treat `BLOCKED` and `UNSETTLED` as distinct non-retriable results and never
  fall back to an earlier phase.
- Run the complete SINBAD Core test suite before deployment.
