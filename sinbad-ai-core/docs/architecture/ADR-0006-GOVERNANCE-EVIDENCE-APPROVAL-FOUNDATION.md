# ADR-0006: Governance, Evidence, Approval, and Revision Foundation

- Status: Accepted as inert contract foundation; compliance and approval not authorized

## Decision

Use exact versioned contracts for rule requirements, evidence candidates, approval candidates, and revision links. Every record is tenant-, vessel-, requirement-, profile-, provenance-, time-, revision-, and supersession-scoped.

This foundation can represent only draft/withdrawn rules, unverified/rejected/expired evidence, pending/rejected/cancelled approval requests, and candidate/rejected revision links. A signature reference must remain null. It cannot emit active rules, verified evidence, signed or approved decisions, compliance findings, certificates, or official/class/flag claims.

Approval candidates bind one exact host-selected approval and evidence identity in this foundation. The gate also requires an explicit trusted time input, enforces `collectedAt <= requestedAt <= expectedNow`, and rejects expired evidence. Even perfectly matching candidate scopes return `GOVERNANCE_APPROVAL_BLOCKED` until a future authenticated issuer/verifier, evidence-store integrity proof, authorized signature service, separation-of-duties policy, append-only audit, and vessel-profile applicability engine all succeed.

Persistent uniqueness, canonical content integrity, issuer trust, revocation, signature verification, quorum/two-person approval where applicable, supersession graph validation, regulatory rule evaluation, and cross-profile tests remain activation-blocking.
