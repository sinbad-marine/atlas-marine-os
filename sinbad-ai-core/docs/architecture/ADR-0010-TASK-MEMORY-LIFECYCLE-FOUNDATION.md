# ADR-0010: Task-Memory Consent and Lifecycle Foundation

- Phase: Post-6H / Architecture Gate 0 / `PROTO-TRUTH-STOP-MEMORY` Runtime Foundation 2
- Status: Inert lifecycle contracts accepted; durable use and all actions blocked

## Decision

Represent consent candidates, instruction conflicts, one-task-only exceptions, and user view/export/revoke/delete requests with exact versioned contracts. Profile use remains blocked even with a candidate consent until an isolated store, profile/template binding, conflict workflow, regression verification, audit, and user-control service exist.

A conflict always requires user confirmation. Candidate lifecycle time is bounded by the host's trusted `expectedNow`: consent cannot be future-dated, and conflict detection or one-time exception creation cannot precede consent or exceed that bound. The action gate also binds the host-selected request identity and action, and rejects future-dated requests. A one-time exception is structurally `ONE_TASK_ONLY` and explicitly blocks persistence. Delete requests produce no deletion side effect and cannot claim completion without a deletion manifest and storage evidence. Revoke/export/view similarly remain requests, not results.

This module is absent from the package export map and contains no durable writer, consent verifier, resolver, exporter, revoker, deleter, filesystem, database, or network capability. Repository-local code can still load the file by relative path, so non-export is not an authorization boundary; every evaluator therefore remains unconditionally blocked. Production imports remain forbidden until an explicit package export, isolated storage adapter, authorization gate, audit integration, and regression suite are reviewed together. Identifiers are opaque references and must never be interpolated directly into filesystem paths, storage keys, or queries without a downstream allow-list/encoding boundary. Ordered schema field lists are part of each versioned byte-serialization contract and must not be reordered within a version. The `PROTO-TRUTH-STOP-MEMORY` blocker remains open.
