# Phase 2Q–2W terminal delivery migration

## Phase 4K reconciliation runtime

`tools/trusted-rollout-recovery-deployment-reconciliation-runtime.js` is the server-only composition boundary for deployment reconciliation. It requires an explicit Supabase service-role client and bounded audit, authorization, and reconciliation policies. The frozen facade exposes only `preflight`, `issue`, and `reconcile`.

`preflight` performs a complete verified audit scan. Authorization repeats that readiness check at issuance time, durably records the decision, and produces a one-use opaque capability only after explicit operator approval. Provider or storage ambiguity remains fail-closed or unsettled. The browser application must never receive this runtime or its service-role credential.

Phase 4L adds `tools/trusted-rollout-recovery-deployment-lifecycle-runtime.js`. It retains the deployment authorization hash in a private `WeakMap` and releases it to the reconciliation authorization layer only after the exact same-instance deployment produces an unsettled outcome. The hash is never accepted back from caller-controlled input, and terminal or replayed deployments cannot open a reconciliation path.

Phase 4M tracks each reconciliation capability in a second private `WeakMap`. A nonterminal owning result reopens exactly one authorization path; an applied or rejected result closes the deployment source. Concurrent and copied capability calls never mutate that retry decision.

Phase 4N makes the sequential retry budget explicit and mandatory with `maxReconciliationAttempts` (1–10). The budget increments only after a capability is successfully authorized and is checked before readiness scanning, audit writes, or operator callbacks.

Phase 4O adds mandatory `reconciliationRetryDelayMs` (1000–300000). A nonterminal reconciliation samples the trusted monotonic clock and delays the next authorization; an early request or clock rollback is rejected before any downstream work.

Phase 4P adds mandatory `reconciliationRetryBackoffFactor` (2–4) and `maxReconciliationRetryDelayMs` (base delay through 300000). Delay growth is deterministic, capped before multiplication can overflow, and based only on successfully issued attempts.

Phase 4Q exposes a frozen, content-free `inspect(authorization)` snapshot for scheduling and diagnostics. It accepts only the original same-instance deployment authorization and performs no database, audit, provider, or operator calls.

Phase 4R makes inspection internally side-effect-free as well: observational clock reads validate against the last decision sample without updating it, so monitoring cannot change later retry authorization behavior.

Phase 4S wraps trusted clock invocation and numeric conversion. Exceptions, symbols, and other invalid samples produce clock-invalid outcomes and do not mutate the last accepted decision sample.

Phase 4T stores `retryClockPending` when a nonterminal completion cannot obtain a valid time and exposes it as `RETRY_CLOCK_PENDING`. It never writes a synthetic maximum deadline; a later valid authorization decision establishes the complete delay window before any downstream work. Exhausted attempts take precedence over pending-clock recovery.

Phase 4U explicitly clears retry-clock state when a nonterminal result consumes the final attempt. It takes no extra scheduling sample after the mandatory capability-verification clock read; `RETRY_EXHAUSTED` always reports a null retry boundary.

Phase 4V replaces the snapshot's absolute `retryNotBefore` field with relative `retryAfterMs`. This server-only breaking contract is versioned as 4V and prevents disclosure or coupling to the trusted clock's absolute value.

Phase 4W adds `tools/create-rollout-recovery-deployment-lifecycle-from-env.js`. It accepts an explicit environment mapping, rejects missing or non-canonical values, and delegates all numeric bounds to the exact lifecycle constructor. Service-role clients and side-effect functions remain injected trusted dependencies, never environment-derived browser values.

Phase 4X reads required environment fields once into a frozen null-prototype snapshot. Only own string data properties are accepted; inherited values, getters, proxy descriptor failures, and later source mutations cannot influence the parsed policy.

Phase 4Y snapshots the exact server dependency allowlist through own data-property descriptors before parsing policy or constructing the lifecycle. Accessors and inherited dependency injection are rejected without invocation.

Phase 4Z enforces the same exact own-data-property snapshot inside the rollout-recovery lifecycle runtime. Every accepted runtime dependency is read once before subordinate construction, while inherited values, accessors, missing fields, and descriptor failures are rejected without invoking dependency getters.

Phase 5A requires exact primitive lifecycle identity and numeric policy values at the runtime boundary. Callers must pass canonical strings and safe integers directly; implicit object, string, boolean, bigint, infinity, or unsafe-integer coercion is rejected before subordinate construction.

Phase 5B moves all lifecycle numeric bounds and cross-field ordering into atomic dependency admission. Existing limits are unchanged; invalid timeout, authorization, audit, attempt, delay, factor, or cap values now fail before any subordinate runtime or RPC work begins.

Phase 5C requires `now()` to return a direct non-negative safe integer. The runtime wraps the clock once and never coerces callback results, so object conversion hooks cannot execute inside deployment or reconciliation authorization paths.

Phase 5D requires deployment-readiness results to expose the exact decision fields as own data properties. Accessors, inherited fields, descriptor failures, and non-string reason codes are rejected without invocation or coercion before authorization issuance.

Phase 5E requires reconciliation audit-readiness decisions to expose exact own data fields. The shared snapshot is used by runtime preflight and reconciliation capability issuance, preventing getter or reason-code coercion in either path.

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

Apply `20260819_rollout_recovery_runtime_preflight.sql` before constructing the
Phase 3T runtime. Require `ROLLOUT_RECOVERY_RUNTIME_READY` from `healthCheck()`
at startup. A blocked preflight prevents both authorization and recovery; do not
bypass it or substitute a local configuration check for the database RPC.

Apply `20260820_rollout_recovery_runtime_fingerprint.sql` last. Phase 3U no
longer accepts the Phase 3T boolean preflight response. Verify that startup
returns `ROLLOUT_RECOVERY_RUNTIME_READY`; a stale deployment fingerprint means
the migration chain is incomplete and must not be bypassed.

Phase 3V startup health also performs the bounded authorization-audit integrity
scan. Require ready only when both fingerprint and live audit readiness pass.
Do not use database fingerprint alone as a traffic or operator-workflow health
signal.

Before applying migrations, run the Phase 3W migration release verifier from
the repository root. Require `MIGRATION_RELEASE_VERIFIED` with the manifest's migrations
and the expected Phase 3U fingerprint. Never deploy after a hash mismatch and
never repair it by silently resealing an edited historical migration.

Use the Phase 3X release command as the required local/CI quality gate. Require
`ROLLOUT_RECOVERY_RELEASE_VERIFIED` before any migration deployment. The command
checks the migration seal before running all tests, so a compromised migration
cannot be hidden behind an otherwise green test suite.

After the reviewed changes are committed, require the Phase 3Y evidence command
to return `RELEASE_EVIDENCE_VERIFIED` from a clean worktree. Preserve its JSON
with the deployment record and confirm its commit before applying migrations.
The evidence record is content-free and does not grant deployment authority.
Any dirty worktree, changed commit/manifest, or failed Phase 3X gate blocks
evidence creation and must not be bypassed.

At deployment handoff, run the Phase 3Z verifier against the preserved evidence
JSON from the exact checkout that will be deployed. Require
`RELEASE_EVIDENCE_VALID`. A valid deterministic hash proves internal record
consistency only; it is not a signer identity, approval token or substitute for
the external release system's provenance controls.

Phase 4A is the final composition boundary for deployment readiness. Inject the
verified evidence record, live trusted runtime `healthCheck`, opaque operator
identity attestation, bounded identity timeout and side-effect-free identity
verifier. Require `ROLLOUT_RECOVERY_DEPLOYMENT_READY`. Never replace the live
runtime or identity checks with static configuration values, and never log the
operator attestation.

Phase 4B turns the Phase 4A decision into a purpose-bound, short-lived
same-process deployment authorization. Pass the original object to `execute()`
once. The authorization is consumed before the deployment side effect; an
`UNSETTLED` timeout, exception or malformed response requires external
reconciliation and a newly approved workflow, never replay of the same object.

Phase 4C requires a durable deployment journal before wiring the real provider
callback. Persist `BEGUN` by authorization hash before the side effect and
confirm terminal settlement afterward. Treat `EXISTS`, begin outage, settlement
conflict and response loss as non-success. Do not activate this composition
until a deployment-specific durable journal implementation and its migration
have been independently verified.

For Phase 4D, apply `20260821_rollout_recovery_deployment_journal.sql` only
after the earlier sealed migrations. Verify anon/authenticated RPC denial and
construct the internal adapter with a server-side service-role client. This
forward migration enables journaling for later deployments; it cannot journal
its own first application and does not authorize deployment by itself.

Phase 4E reconciles `PENDING` and `UNKNOWN` deployment records after restart.
Provide only a bounded, authenticated, side-effect-free provider status query;
never pass a deployment function. Terminal journal states require no provider
call. Timeout, invalid response and compare-and-set conflict remain unsettled
and must be escalated through a separately authorized operator workflow.

Phase 4F provides that single-use operator boundary for reconciliation. Supply
a hashed actor identity, fixed purpose, monotonic clock, bounded authorization
TTL/timeout and a side-effect-free identity/policy decision. Never persist or
reconstruct the returned capability. Durable operator-decision audit remains a
required later boundary before production exposure.

Phase 4G makes the reconciliation authorization audit mandatory. Configure a
durable append writer for the exact `4G-v1` audit event and require `RECORDED`
before returning either approval or denial. Do not substitute the older rollout
recovery authorization audit stream: its purpose and wire contract are distinct.
Remote persistence wiring remains required before exposure.

For Phase 4H, apply `20260822_rollout_recovery_deployment_reconciliation_audit.sql`
after Phase 4D. Construct the internal append adapter only with a server-side
service-role client and pass it through the Phase 4G audit factory. Verify the
database hash recipe, immutability triggers and client-role denial before
exposing the reconciliation workflow.

For Phase 4I, apply the `20260823` verification migration after Phase 4H and run
the internal verifier with explicit page and event budgets. Require
`AUDIT_SCAN_COMPLETE`. Capability loss, invalid hashes/order, storage outage and
bounded-incomplete scans must block reconciliation workflow readiness.

Phase 4J makes that bounded integrity decision mandatory for reconciliation
authorization. Configure exact verifier version, page size and maximum events.
Readiness denial occurs before the operator callback but still requires a
durably recorded denied decision. Deploy authorization, audit writer, verifier
and readiness gate as one version-coupled unit.

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
