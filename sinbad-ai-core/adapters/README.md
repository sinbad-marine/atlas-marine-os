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

