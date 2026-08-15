# ADR-0012: Sensitive-Data Governance Foundation

- Phase: Post-6H / Architecture Gate 0 / Sensitive Data Foundation 1
- Status: Inert classification, retention, action-request, and isolation contracts accepted; all data actions blocked

## Decision

Represent sensitive-data descriptors, draft retention policies, pending user data-action requests, and unverified tenant/vessel/person isolation contexts with exact versioned contracts. Bind every action to the same tenant, vessel, optional person, resource, policy, classification, domain, purpose, and provisional time scope. The host must select the exact descriptor, retention policy, action request, isolation context, and requested action; a coherent candidate graph cannot be substituted for another selected request.

The only descriptor state is `CANDIDATE`, policy state `DRAFT`, request state `PENDING`, and isolation state `UNVERIFIED`. Export remains blocked until portable-format, authorization, redaction, consent, and durable-audit evidence exist. Delete remains blocked until a deletion manifest covers live data, replicas, providers, caches and recoverable backups and restore-negative evidence proves the data cannot be reconstructed. No action may claim completion from a request or candidate record.

This module has no classifier, consent verifier, storage, network, exporter, deleter, erasure executor, or audit writer and remains outside package exports. Authenticated person identity, legal/contractual retention basis, jurisdiction rules, data-subject authorization, immutable audit, offline replica inventory, backup lifecycle, partial-deletion reporting, and adversarial isolation tests remain activation-blocking.
