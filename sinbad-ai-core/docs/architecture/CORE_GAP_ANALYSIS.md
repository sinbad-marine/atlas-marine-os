# Sinbad Core Binding Gap Analysis

This baseline classifies obligations from the Core Charter. A checked item requires evidence; prose or intent alone does not close a gap.

## Required in the core now

| Capability | Current evidence | Owner | Closure condition | Activation blocking |
|---|---|---|---|---|
| Trust-boundary snapshots, fail-closed authorization, audit, reconciliation | Phase 6H tests and release evidence | Core security owner | All in-scope adapters reviewed and evidenced | YES |
| Immutable organization/fleet/vessel/equipment identity model | ADR-0004 inert canonical contract foundation; persistence and isolation evidence open | Core architecture owner | Gate 0 model and isolation evidence | YES |
| Versioned vessel profile and applicability context | ADR-0004 inert draft/superseded profile foundation; approval and rule integration open | Maritime domain owner | Gate 0 profiles and rule tests | YES |
| Offline-first store, conflict and sync policy | ADR-0005 inert mutation/envelope/conflict contracts and replay/order gate; durable store and convergence evidence open | Data/sync owner | Disconnection and convergence evidence | YES |
| Tenant/vessel isolation and RBAC/ABAC/device identity | ADR-0007 scoped inert principal/policy/request contracts and always-deny gate; authenticated enforcement and isolation evidence open | Security owner | Isolation and escalation test evidence | YES |
| Shared rule/evidence/approval/revision model | ADR-0006 inert scoped contracts and always-blocked approval gate; trusted issuers, signatures and applicability integration open | Core architecture owner | Integrated model and profile tests | YES |
| Backup plus clean restore and measured RPO/RTO | No release-gate evidence identified | Operations owner | Clean restore evidence and measured targets | YES |
| Signed update, rollback/forward recovery, degraded mode | Partial rollout recovery evidence | Release owner | System-wide update/recovery evidence | YES |
| Log/metric/trace/security/sync observability | No complete evidence package identified | Operations/security owner | Release-gate observability evidence | YES |
| User-data export and portability contract | No complete evidence package identified | Data owner | Documented export plus round-trip tests | YES |
| Threat model, hazard register, data classification, system context | Preliminary control model only | Safety/security owners | Approved system-wide records | YES |

## Interfaces to stabilize now

- Versioned `VesselState`, `OperationalEnvelope`, `CommandIntent`, `SafetyDecision`, `ControlExecutionReceipt`, and `HazardAndIncident` schemas.
- Identity, time, units, provenance, confidence, authorization, idempotency, ordering, signature, revision, and compatibility envelopes.
- Read-only example adapters for navigation, stability, weather, PMS, training, and management engines.
- Feature and activation gates that make real physical authority impossible by default.

Schema stabilization does not authorize actuator code or imply class/flag approval.

## MetOcean, celestial, and PNT foundation

The v1 inert contracts, one Observation golden vector, official-warning hash binding, and default-off capability registry are present. Remaining activation-blocking gaps include device trust and calibration lifecycle, controlled unit/quantity registry, official-warning signature verification and precedence engine, time-authority model, evidence store integration, PNT duplicate/replay tracking, multi-source fusion/integrity algorithms, ODD/capability authorization integration, edge-adapter sandboxing, and golden vectors for every remaining contract type. None is an accepted deferral; live sensors and accepted navigation solutions remain blocked.

ADR-0003 now supplies inert candidate contracts for device identity, calibration, time authority, evidence references, and warning verification. Positive trust issuance, certificate-chain validation, revocation/status services, secure-clock discipline, evidence-store verification, and contract binding into observations remain activation-blocking.

## Future separate certified program

- VCASK runtime and safety lifecycle;
- deterministic command arbiter and verified control functions;
- steering, propulsion, valve, pump, firefighting, and energy-isolation integration;
- shore control centre, supervised autonomy, minimum-risk manoeuvre, and advanced autonomy;
- simulation/HIL/sea-trial infrastructure and real-vessel commissioning;
- vessel-specific FMEA/STPA, cyber/human-factors assurance, class/flag/IMO/IEC/ISO approval.

## Deferred-risk rule

Any deferred mandatory item must record owner, rationale, target closure date, evidence link, and `ACTIVATION_BLOCKING: YES|NO`. Until a gate records verified closure or approved risk acceptance, every item marked blocking remains blocking.

Rows above are open gaps, not accepted deferrals. They have no invented closure date and remain activation-blocking. A dated deferral requires a separate authorized risk-acceptance record.

## Binding protocol expansion

[CORE_PROTOCOL_INTEGRATION_AND_GAP_PLAN.md](./CORE_PROTOCOL_INTEGRATION_AND_GAP_PLAN.md) adds open blockers for truth/safe-stop, consented task memory, engineering V&V, scan/digital-twin provenance, Stability Booklet/Load Master, pedagogy/animation separation, sensitive learning/ship/person data, voice consent/revocation, and emergency deletion evidence. These are requirements, not completed capabilities.
