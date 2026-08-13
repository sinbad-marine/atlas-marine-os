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

For Supabase, apply `20260813_terminal_delivery_idempotency.sql`, create the
store from the exported `supabase-idempotency-store` subpath with a server-side
service-role client, and keep that credential outside every browser bundle.
Set `claimLeaseMs` above the bounded presentation timeout. Lease takeover is
fenced for settlement, but a crash after an external side effect can still be
followed by a later takeover; use the transport provider's native idempotency
key for presentation whenever it supports one.

For same-process ambiguous settlement of an applied terminal state, retain the
exact full-field `UNSETTLED` object and call `reconcile(unsettled)` on the same
adapter instance. This retries
settlement only; it never calls `present`. On success, persist/observe the
`RECONCILED` result and discard the consumed object. Never reconstruct an
`UNSETTLED` value from JSON or use this path after process restart.

Expired claims do not auto-reclaim in Phase 3B. After restart, a trusted
operator must use the server-only `supabase-terminal-recovery` adapter to list
expired claim hashes and quarantine the selected claim with a hashed actor ID
and allowlisted reason. Quarantine is conservative: it records `BLOCKED`, never
asserts successful delivery, and never repeats presentation.
Deploy this through the new `20260814_terminal_delivery_recovery.sql` forward
migration; never edit an already-applied migration. Require a successful
service-role database `healthCheck()` before recovery operations, and alert on
expired-claim age against an explicit operator SLA.
Use `inspect({ limit, slaMs })` for health/SLA monitoring. Treat
`RECOVERY_UNAVAILABLE` and `RECOVERY_SLA_BREACHED` as distinct alerts; never use
the legacy empty-list behavior as evidence that the recovery queue is healthy.

Apply `20260815_terminal_recovery_audit_integrity.sql` next, without modifying
earlier migrations. Start the server-only `supabase-terminal-recovery-audit`
adapter with a service-role client and require `healthCheck() === true`. Alert
on `AUDIT_UNAVAILABLE` and `AUDIT_INTEGRITY_FAILED`; `AUDIT_PAGE_VALID`
verifies only the returned page, not unscanned history. Audit rows are append-only, unique per
claim and contain no delivery content or raw operator identity.

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
- Phase 3B removes expired-lease automatic takeover. Operations must deploy the
  recovery audit table/RPCs before relying on cross-restart quarantine.

## Rollout checklist

- Remove production calls to standalone terminal Phase 2P–2U APIs.
- Remove production calls to standalone Phase 2V and 2W APIs.
- Import the package root only and reject repository-relative internal imports.
- Configure the trusted `present` function at adapter startup.
- Configure and health-check the shared atomic idempotency store.
- Apply the Phase 2Z migration and verify anon/authenticated RPC denial.
- Keep the Supabase service-role client server-side only.
- Configure content-free diagnostic/metric handling if operationally required.
- Persist adapter-side idempotency before presentation; never retry a blocked or
  unsettled
  authorization or resume from an intermediate Core object.
- Call only `deliver(authorization)`; do not accept terminal context from clients.
- Persist only the minimal terminal transition/audit fields required by policy.
- Treat `BLOCKED` and `UNSETTLED` as distinct non-retriable results and never
  fall back to an earlier phase.
- Reconcile authentic same-process `UNSETTLED` values with settle-only retry;
  route cross-restart cases to audited operator recovery.
- Monitor expired claims and require explicit operator quarantine; never
  implement automatic presentation retry after lease expiry.
- Run the complete SINBAD Core test suite before deployment.
