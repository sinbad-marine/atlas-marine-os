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

