# Sinbad Core Activation Gates

These gates are binding acceptance policy. A green test run alone does not authorize production activation or a compliance claim.

The current machine-readable gate is `core-activation-gate.js`. It accepts only an exact own-data `{ level, environment }` request envelope and rejects accessors, inherited fields, extras, symbols, arrays, and non-plain objects. It intentionally returns `CORE_ACTIVATION_BLOCKED` for every capability level and environment while binding blockers remain. It contains no activation or execution function.

## Architecture Gate 0

Gate 0 passes only when evidence demonstrates all of the following:

- immutable company → fleet → vessel → department → system → equipment identities and isolation boundaries;
- a versioned vessel profile covering flag, class, vessel type, tonnage, build/contract dates, operating area, voyage context, and exemptions;
- bounded contexts, versioned API/event contracts, idempotency, compatibility rules, and contract-test ownership;
- offline-first storage capable of extended disconnected vessel operation, with deterministic conflict, synchronization, duplicate, and out-of-order policy;
- UTC and vessel-local time, unit, currency, language, and controlled maritime terminology rules;
- tenant/vessel isolation, RBAC/ABAC, MFA/device identity, key/secret lifecycle, and append-only audit;
- shared document/rule/requirement/evidence/signature/approval/revision/supersession models;
- equipment hierarchy, meter/measurement, file/hash, provenance, license, and data-quality models;
- tested backup/restore, disaster recovery, signed updates, rollback/forward recovery, and defined degraded modes;
- logs, metrics, traces, security events, and synchronization-health observability;
- explicit AI source, confidence, human-approval, and fail-closed critical-action boundaries;
- documented user-data export formats and an anti-lock-in portability path.

## Core Release Gate

Release activation additionally requires:

- current ADRs, system context, threat model, hazard register, and data classification;
- realistic migration plus rollback/forward-recovery evidence;
- tests for disconnection, latency, duplicate/out-of-order messages, clock skew, disk exhaustion, and partial file transfer;
- tenant/vessel isolation, privilege escalation, sensitive-data handling, and audit-integrity evidence;
- clean-environment restore evidence with measured RPO and RTO;
- API/event contract adapters proving future navigation, stability, weather, PMS, training, and management-engine extensibility;
- rule/evidence/approval evaluation across representative flag, class, and vessel profiles;
- no open critical/high findings; medium findings require written owner acceptance, rationale, expiry, and activation impact;
- immutable release/evidence identifiers, known limitations, rollback plan, and explicit activation decision.

## Decision record

Each gate result must state `PASS` or `BLOCKED`, evidence hashes, reviewer identities, decision time, scope, unresolved risks, and activation authority. Missing evidence is `BLOCKED`; it is never interpreted as not applicable without an approved ADR.

External publication, sensitive-data transfer, financial commitment, formal compliance submission, or real safety-critical activation requires separate owner authorization.

## Binding protocol gates

[CORE_PROTOCOL_INTEGRATION_AND_GAP_PLAN.md](./CORE_PROTOCOL_INTEGRATION_AND_GAP_PLAN.md) adds mandatory evidence for truth/safe-stop; task-profile consent/version/revoke/delete; engineering unit/coordinate/provenance and `DRAFT`/`VERIFIED`/`VALIDATED` separation; independent calculation and V&V; Stability Booklet/Load Master approval boundaries; pedagogy/animation authority separation; voice consent/disclosure/anti-impersonation; and emergency voice deletion stop, cryptographic erasure, replica/provider/backup confirmation, restore-negative tests, non-reconstructive tamper-evident reporting, and `PARTIAL_DELETION` honesty. Documentation alone satisfies none of these gates.
