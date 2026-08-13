# Adapters

Adapters translate Atlas Marine OS, local Bridge AI and cloud AI data into the
stable contracts defined by `contracts.js`. Adapters must not contain expert
navigation mathematics or silently remove safety warnings.

## Phase 2N public delivery boundary

`public-response-adapter.js` is the only adapter intended to convert a Phase 2M
grounded orchestration result into a user-facing delivery. It independently
recomputes the serialized public-response hash, requires the exact orchestrator,
schema, projector, rendering and content-type versions, and exposes only the
answer plus presentation-safe source fields. Internal grounded answers, claims,
evidence and provenance are never copied into the delivery. Invalid, stale,
tampered or unsafe input returns an immutable `DELIVERY_BLOCKED` result. The
adapter accepts only an authentic same-process orchestration result; copied or
serialized results cannot be re-trusted even if their hashes are recomputed.
The producer and adapter must share one loaded orchestration-contract module
instance; duplicated bundles intentionally fail closed rather than weakening
object-identity authentication. A present-but-blank URI is invalid, not absent.

## Phase 2O single-use delivery authorization

`../delivery/single-use-delivery-authorizer.js` accepts only an authentic Phase
2N delivery and binds its single allowed presentation to a non-empty session,
target channel and caller nonce. The delivery object and the session/channel
nonce tuple are consumed atomically in process. Reuse, copying, Proxy wrapping,
retargeting, malformed context or hash changes return a response-free
`DELIVERY_AUTHORIZATION_BLOCKED` result. Session, channel and nonce identifiers
use a strict normalized ASCII grammar. Nonce replay records have a bounded
15-minute lifetime and hard capacity; capacity exhaustion fails closed. All
external denials share one reason code to avoid replay-probing distinctions.

## Phase 2P terminal delivery receipt

`../delivery/terminal-delivery-receipt.js` lets a UI adapter close an authentic
Phase 2O authorization once with `DELIVERED` or `FAILED`. The terminal receipt
is session/channel bound and response-free: it exposes hashes, outcome and
source count but never answer or source content. Duplicate, copied, retargeted
or malformed receipt attempts are denied uniformly.
The recorder accepts authorization objects only in the authorizing process;
serialized or cloned authorizations fail closed. Durable replay prevention is
the responsibility of the delivery persistence boundary.

## Phase 2Q terminal-receipt verification

`../verification/terminal-delivery-receipt-verifier.js` verifies that a Phase
2P terminal receipt is authentic, hash-intact and bound to the adapter's exact
transaction, session, channel, attempt and outcome expectations. Verification
is same-process and response-free. Its success contract omits transaction,
session, channel and attempt identifiers while binding them inside the opaque
verification hash. Copies, Proxy wrappers, mutations and target mismatches
return one uniform denial without echoing identifiers.

## Phase 2R single-use terminal closure

`../delivery/single-use-terminal-closure.js` lets an adapter consume a bound
Phase 2Q verification once. It rechecks the hidden target manifest through the
verifier and emits a minimal closure proof without response or target content.
Replay, copies, clones, Proxy wrappers and mismatched closure context are denied
uniformly. Same-process identity is mandatory; persistence is outside Core.

## Phase 2S terminal-closure verification

`../verification/terminal-closure-verifier.js` verifies an authentic Phase 2R
closure once against its hidden closure identifier and outcome binding. The
result exposes only terminal outcome, source count, closure hash and its own
verification hash. It never exposes response or target identifiers and remains
same-process, offline and fail-closed.

## Phase 2T terminal audit record

`../audit/terminal-delivery-audit-record.js` produces a single content-free
audit record from a bound Phase 2S verification. Adapters may persist this
minimal record but must not treat its process-local authenticity as durable
cross-process authorization.

## Phase 2U terminal audit verification

`../verification/terminal-delivery-audit-verifier.js` independently verifies a
Phase 2T record once and retains audit/closure identifiers only inside its
same-process bound manifest. Persisted hashes are observational audit data, not
portable authorization credentials.

## Phase 2V mandatory completion gate

Adapters must use `../delivery/terminal-completion-gate.js` to declare terminal
completion. Phase 2P receipts and Phase 2Q–2U intermediate objects are not
completion credentials and must never independently update terminal state.
Adapters must generate attempt, closure and audit identifiers inside their
trusted boundary. Client-supplied identifiers must not be forwarded as these
bindings. Existing adapters must not call standalone Phase 2P before Phase 2V;
an already consumed authorization fails closed and is deliberately non-retriable.

## Phase 2W terminal-state transition

`terminal-state-transition.js` is the only adapter-facing terminal state gate.
It consumes one authentic Phase 2V completion and emits a minimal immutable
success or failure transition. Reusing a completion or presenting an earlier
chain object cannot update terminal state.

## Phase 2X trusted production adapter

Use the `sinbad-ai-core` package root, which exports only
`trusted-terminal-delivery-adapter.js`. Configure `create({ present })` inside
the trusted UI/transport adapter and call `deliver(authorization)` without a
caller-provided context. Phase 2X generates all terminal identifiers, derives
the outcome from the configured presenter and synchronously composes Phase
2P–2W after presentation. False returns and presentation exceptions become a
verified terminal failure; copies, replays and concurrent duplicate attempts
fail closed. Direct relative imports of Phase 2P–2W are internal/test-only and
must be rejected by production lint/build policy.
The adapter acquires a same-process identity lock before calling `present`, so
concurrent duplicate calls cannot repeat the presentation side effect. An
optional `diagnose` hook receives fixed, content-free reason codes only.

## Phase 2Y durable idempotency store

`trusted-terminal-delivery-adapter.create()` requires `idempotencyStore` with
asynchronous `claim(key)` and `settle(key, summary)` methods. `claim` must be an
atomic insert-if-absent backed by durable shared storage and must return exactly
`true` only for the sole winner. It runs before `present`. `settle` may update
only the winning key and must return exactly `true` after durably recording the
minimal summary. Timeouts, ambiguous writes, false values and exceptions fail
closed. Settlement failure after presentation returns non-retriable `UNSETTLED`
with known terminal fields; it never masquerades as a pre-presentation block.
Never implement production claiming as read-then-write or with a process-local
collection.
The store must also declare `version` equal to the Phase 2Y store contract,
`durable: true`, and a positive `claimLeaseMs`. Lease expiry/recovery must be
atomic and fenced by the store: a transport timeout may be an ambiguous winning
claim, so the application must not simply retry presentation.

## Phase 2Z Supabase store

Import `@sinbad-ai/core-terminal-delivery/supabase-idempotency-store` and call
`create({ client, claimLeaseMs })` with a server-side Supabase service-role
client. Never construct or expose this client in the browser. Apply migration
`20260813_terminal_delivery_idempotency.sql` first. The database issues a UUID
lease token and accepts settle only from the current unexpired holder. Choose a
lease longer than the bounded presentation timeout; use transport-native
idempotency as the final protection against a crash followed by lease takeover.

## Phase 3A reconciliation

When `deliver()` returns an authentic same-process `UNSETTLED` value containing
the full applied terminal fields, call `reconcile(value)` on the same trusted
adapter instance. This performs a
settle-only retry using the hidden original key, fencing token and minimal
summary; presentation is never repeated. A successful result is `RECONCILED`
and the value cannot be reused. Do not serialize, clone or persist the
`UNSETTLED` object as a portable credential. After process restart, stop and use
an explicitly audited database reconciliation procedure.
An unsettled chain-block record is intentionally not reconcileable through this
API because it is not an applied terminal result.

## Phase 3B cross-restart quarantine

After a process restart, use the server-only `supabase-terminal-recovery`
adapter with a service-role client. `listExpired(limit)` returns only validated
claim hashes and timestamps. `quarantine({ claimKey, actorHash, reasonCode })`
accepts a SHA-256 operator identity and one of `PROCESS_CRASH`,
`SETTLEMENT_AMBIGUOUS` or `LEASE_EXPIRED`. It permanently prevents replay and
creates an audit entry in the same transaction. It cannot declare `DELIVERED`
or repeat presentation. Never expose this adapter or its service-role client to
a browser.
Call `healthCheck()` at startup and require exact `true` before list or
quarantine; the adapter otherwise returns no rows and performs no mutation.
Apply `20260814_terminal_delivery_recovery.sql` after the Phase 2Z migration.
Monitor the oldest expired claim and define an operator response SLA; liveness
is deliberately subordinate to preventing duplicate presentation.

## Phase 3C recovery monitoring

Use `inspect({ limit, slaMs, now })` for monitoring instead of interpreting an
empty `listExpired()` result as health. The immutable result distinguishes
healthy, SLA-breached and unavailable states and includes only count, oldest
expired age and minimal claim hash/timestamps. Production callers supply a
bounded SLA and alert on `RECOVERY_UNAVAILABLE` as an infrastructure/security
failure, not as “zero expired claims.”
Any malformed RPC row makes the entire inspection unavailable rather than
shrinking the count into a false healthy result. Treat `listExpired()` as an
operator-detail helper only; all monitors must use `inspect()`.

## Phase 3D recovery audit verification

Use the separate server-only `supabase-terminal-recovery-audit` adapter after
applying `20260815_terminal_recovery_audit_integrity.sql`. Its `inspect()`
method reads only through a service-role-gated RPC and recomputes each event's
versioned SHA-256 hash. It fails closed as `AUDIT_INTEGRITY_FAILED` for malformed
or modified data. Database triggers reject audit UPDATE and DELETE operations,
and a unique claim key prevents a second event for the same claim. Timestamps
are observational; the hash binds claim, actor, action and reason fields.

## Phase 3E bounded audit scanning

Call `scan({ pageSize, maxEvents })` from a trusted server process to validate
successive audit pages. IDs must be globally unique and strictly descending.
The scan returns no event array, even on failure. Alert on
`AUDIT_SCAN_INTEGRITY_FAILED`, `AUDIT_SCAN_UNAVAILABLE` and
`AUDIT_SCAN_INCOMPLETE`; only `AUDIT_SCAN_COMPLETE` reached the end of the
sequence visible during that run. Keep `maxEvents` as an explicit operational
budget.

## Phase 3F readiness decision

Use `supabase-terminal-recovery-readiness` as the deployment or traffic gate.
It constructs both trusted recovery adapters internally from the same
service-role client and explicit policy bounds. Require exact
`RECOVERY_READINESS_READY`; every other status blocks rollout. The result
contains only counts, oldest expired age and audit watermark metadata. RPC
exceptions are converted to blocked reason codes.

