# Adapters

Adapters translate Atlas Marine OS, local Bridge AI and cloud AI data into the
stable contracts defined by `contracts.js`. Adapters must not contain expert
navigation mathematics or silently remove safety warnings.

## Installed navigation engine boundary

`installed-navigation-engine.js` is the lazy loader for the vendored,
versioned engine in `../engines/navigation`. Reading loader metadata does not
load or execute navigation mathematics. `navigation-engine-adapter.js` denies
execution by default and requires an explicit, unexpired authorization whose
operation allowlist includes the requested function. Unsupported, unauthorized
or expired requests fail closed before the engine is loaded. This boundary is
not imported by the Core orchestrator, so its `PLAN_ONLY` contract remains
unchanged. Outputs remain decision support subject to onboard verification and
human authority.

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

