# ADR-0011: Task-Memory Storage, Authorization, and Audit Foundation

- Phase: Post-6H / Architecture Gate 0 / `PROTO-TRUTH-STOP-MEMORY` Runtime Foundation 3
- Status: Inert evidence-candidate contracts accepted; persistence and every memory action blocked

## Decision

Define exact versioned candidates for a memory-store receipt, a deny-only authorization decision, and a pending append-only audit event. Bind the candidates to the same owner, profile revision, scope, receipt, store, decision, payload hash, action/event meaning, and total timestamp order. The host must select the exact receipt, decision, audit event, and originating request identities, preventing a coherent evidence chain from being substituted for another request. The explicit time input is caller-supplied, provisional, non-authorizing, and non-authoritative in this foundation. The joint evaluator remains blocked even for an internally consistent chain.

The receipt status is only `UNVERIFIED`; the authorization decision, including `STORE`, is only `DENIED`; the audit status is only `PENDING_APPEND`. Previous receipt/event hashes must be null until a real continuity verifier exists. None proves persistence, authenticity, authorization, append durability, revocation, export, deletion, or completion. The module contains no database, filesystem, network, signer, verifier, writer, authorizer, or audit appender and is absent from package exports.

Production use remains forbidden until isolated tenant/person storage, authenticated store receipts, replay protection, trusted monotonic time, credential and policy verification, immutable durable audit, retention/export/revoke/delete services, restore-negative tests, and adversarial integration evidence exist. Runtime Foundation 3 narrows the future trust boundary but does not close `PROTO-TRUTH-STOP-MEMORY`.
