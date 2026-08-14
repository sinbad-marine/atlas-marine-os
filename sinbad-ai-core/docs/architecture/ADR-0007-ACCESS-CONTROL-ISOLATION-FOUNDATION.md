# ADR-0007: Access-Control and Isolation Foundation

- Status: Accepted as inert contract and deny-gate foundation; access authorization not available

## Decision

Use exact versioned contracts for principal candidates, RBAC/ABAC policy candidates, and access requests. Every decision input is explicitly tenant-, vessel-, principal-, device-, resource-, action-, purpose-, time-, operational-envelope-, revision-, and idempotency-scoped.

The gate requires exact expected tenant, vessel, purpose, and operational-envelope boundaries; binds request principal/device to the candidate identity; binds resource type/action and role-set scope to the policy candidate; and rejects expired or future-dated credentials and requests using an explicit trusted-time input. Attribute sets and attribute rules are intentionally not equated: an authenticated ABAC resolver is required to evaluate them. Matching candidates still return `ACCESS_BLOCKED` because this foundation has no authenticator, policy authority, MFA verifier, role/attribute resolver, audit writer, or capability issuer.

It cannot emit authenticated principals, active policies, allowed/granted/elevated requests, privileges, tokens, or physical authority. References remain opaque and non-authoritative.

Authenticated device identity, MFA, credential revocation, tenant/vessel persistence isolation, role and attribute evaluation, least privilege, separation of duties, privilege-escalation tests, append-only decision audit, break-glass governance, and operational-envelope integration remain activation-blocking.
