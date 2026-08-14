# ADR-0005: Offline-First Synchronization Foundation

- Status: Accepted as inert contract and admission-policy foundation; synchronization not authorized

## Decision

Represent locally queued mutations, synchronization envelopes, and unresolved conflict candidates with exact versioned contracts. Every record is explicitly tenant-, vessel-, device-, entity-, sequence-, revision-, time-, provenance-, and idempotency-scoped.

Ingress classification requires an exact expected tenant, vessel, sender device, next sequence, and prior batch scope. It fails closed on scope mismatch, duplicates/replays, sequence gaps, rejected envelopes, batches above 256 mutations, malformed values, accessors, coercion, and unknown fields. Even the exact next sequence returns only `SYNC_INGRESS_PENDING_VERIFICATION`; it is never accepted or applied without a future authenticated store, authorization decision, integrity proof, and durable audit.

The foundation cannot emit `APPLIED`, `ACCEPTED`, `SYNCHRONIZED`, `RESOLVED`, or `MERGED`. It contains no database, filesystem, transport, network, automatic merge, clock-authority, or activation implementation. References are opaque and non-authoritative.

Persistent uniqueness, authenticated device/tenant binding, payload integrity, transactional journals, deterministic convergence, tombstone retention, bounded storage, clock-skew handling, long-disconnection tests, recovery, and sync observability remain activation-blocking.
