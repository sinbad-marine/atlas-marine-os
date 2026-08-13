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

For periodic integrity checks, run
`supabase-terminal-recovery-audit.scan({ pageSize, maxEvents })`. Require
`AUDIT_SCAN_COMPLETE`; alert on incomplete, unavailable and integrity-failure
states. Size `maxEvents` above expected history or intentionally treat the
bounded result as incomplete instead of accepting a partial scan.

Before enabling terminal delivery traffic, run the server-only
`supabase-terminal-recovery-readiness.check()` gate with explicit SLA and scan
budget. Continue only for exact `RECOVERY_READINESS_READY`. Any blocked result
must stop rollout; recovery failures intentionally prevent the audit scan from
starting and no exception may be treated as readiness.

For asynchronous activation in the same trusted process, wrap the gate with
`supabase-terminal-recovery-attestation`, configure a short explicit TTL and
consume the original object once. Do not serialize, persist or move it across
processes; run readiness again after restart or expiry.

Connect activation through `trusted-terminal-rollout-activation`, not a direct
traffic-enable call. Require `TRUSTED_ROLLOUT_ACTIVATION_APPLIED`; blocked and
failed outcomes stop rollout. Use the hook's `attestationHash` as the native
external idempotency key. Treat exception or timeout as unsettled and reconcile
externally by hash. Never retry an ambiguous hook outcome with the same
attestation, since it is consumed before the side effect begins.

For a same-process unsettled activation, call the same adapter instance's
`reconcile(unsettled)`. Its trusted resolve hook may only query by
`attestationHash` and return `APPLIED`, `REJECTED` or `PENDING`; it must never
repeat activation. After restart, use an operator/provider recovery workflow
keyed by the hash.

Apply `20260816_rollout_activation_journal.sql` after the recovery migrations.
It stores only attestation hash, monotonic activation state and timestamps.
Keep its service-role client server-side. Phase 3J delivers the internal
journal contract; do not call these RPCs from application or browser code.
Settlement requires the caller's expected current state and reports conflicts
without overwriting a competing terminal result. Treat `DENIED`, `CONFLICT`,
`INVALID` and `UNAVAILABLE` as closed outcomes; never infer success or absence
from them.

For Phase 3K, pass that journal as `activationJournal` to the trusted rollout
adapter. Activation is blocked unless the journal begins a fresh hash. Do not
treat `EXISTS` as permission to repeat the provider side effect. Terminal
results require durable settlement; a settlement outage remains `UNSETTLED`
and reconciliation may query provider state but must never activate again.

After a process restart, Phase 3L uses the internal
`trusted-terminal-rollout-recovery` adapter. Supply the exact journal, a bounded
provider-state resolver and the recorded attestation hash. The adapter contains
no activation hook and cannot repeat rollout activation. Keep it behind a
trusted server/operator boundary; it remains unexported until that authorization
boundary is implemented.

Phase 3M adds the single-use operator authorization wrapper. Configure the
hashed operator identity, fixed recovery purpose, explicit clock, bounded
authorization TTL/timeout and a trusted `authorize` function. Only exact boolean
`true` issues a capability. Pass the original capability to `recover()` once;
never serialize or persist it. The safe wrapper remains internal until the real
operator identity provider is connected.
Make `authorize` a side-effect-free identity/policy decision. Late completion
after timeout is ignored. Any downstream failure consumes the capability, so
retry by obtaining new operator approval rather than replaying the same object.

Phase 3N requires a trusted durable `authorizationAudit` created with a
server-side `append(event)` writer. Persist the minimal immutable event before
returning operator approval. Only exact boolean `true` confirms persistence;
writer denial, exception or malformed output blocks capability issuance. Keep
the writer credentials outside browser and application clients.

For Phase 3O, apply `20260817_rollout_recovery_authorization_audit.sql` after
the activation journal migration. Create the internal Supabase audit adapter
with a service-role client and pass its `append` method into the Phase 3N audit
factory. The database recomputes event hashes and permits only idempotent exact
replay. Do not grant table or RPC access to `anon` or `authenticated`, and do
not export this adapter before migration verification and operator identity
wiring are complete.

For Phase 3P, apply the `20260818` verification migration after `20260817` and
run the internal verifier with bounded `pageSize` and `maxEvents`. Require
`AUDIT_SCAN_COMPLETE`; unavailable capability, hash mismatch, invalid ordering
and bounded-incomplete scans must block operational readiness. The verifier
returns summaries only and must stay on the trusted server.

Phase 3Q wraps that verifier with an explicit bounded readiness policy. Require
`AUTHORIZATION_AUDIT_READINESS_READY` before enabling the operator recovery
workflow. Every other status blocks; never substitute missing counters with
zero or treat an incomplete bounded scan as healthy.

Phase 3R makes `auditReadiness` mandatory when constructing the recovery
authorization adapter. Deploy the verifier, readiness gate and authorization
adapter atomically because the authorization wire version is now `3R-v1`.
Readiness denial occurs before the operator identity/policy hook.

After applying migrations through `20260818`, Phase 3S provides the single
server-side composition point. Supply one service-role client, hashed operator
identity, purpose, clock, authorization/recovery timeouts, audit page/event
budgets, side-effect-free `authorize` and provider-only `resolve`. Do not compose
the internal adapters independently in application code or export the runtime
until deployment verification succeeds.

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
