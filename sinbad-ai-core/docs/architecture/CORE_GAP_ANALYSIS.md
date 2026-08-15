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

- Universal A-O engine-port manifests, module isolation, validation harnesses, policy/audit integration, and explicit activation decisions. ADR-0016 supplies an inert exact manifest and deny-only assessment. ADR-0020 adds an internal metadata-only candidate catalog that cannot retain modules or callbacks and cannot load, execute, or activate them. ADR-0022 adds a deny-only isolation declaration requiring zero filesystem/network/process/environment/secret authority, but it does not prove runtime enforcement. ADR-0024 binds format-checked candidate/policy/isolation/audit hash labels while forbidding self-asserted verification; durable storage, signatures, custody, applicability, trusted time/actor, and revocation remain unverified. ADR-0025 adds an inert validation-result envelope with balanced clean counts and adversarial cases, while treating all results as unverified until isolated independent reproduction and signed evidence exist. Authenticated registration, persistence/revocation, sandbox attestation and escape testing, real harness execution, loading, and execution remain absent and blocked.
- The legacy `experts` route is not yet composed behind ADR-0016. Runtime Foundation 17 rejects executable callbacks before registry insertion and blocks router execution under the current versioned contract, closing the prior callback-bearing dual path. Manifest composition, authenticated registration/loading, and any future execution remain activation-blocking; the new manifest assessment is not an execution authority.
- Runtime Foundation 17 rejects both `execute` and `canHandle` callbacks at expert normalization/registration and forces `sinbad-expert-route-plan/2-v1` plans to `executionAllowed: false`. Safety and expertise-gap reasons precede the mandatory `ENGINE_PORT_GATE_REQUIRED` reason. `routable: true` means plan metadata exists; it never authorizes execution. A coarse literal product-identity CI guard covers direct Zabit/Akademi/Academy/GASM leakage across runtime JavaScript and JSON assets. Semantic product assumptions still require manual architecture review; neither guard activates an engine.

- Versioned `VesselState`, `OperationalEnvelope`, `CommandIntent`, `SafetyDecision`, `ControlExecutionReceipt`, and `HazardAndIncident` schemas.
- Identity, time, units, provenance, confidence, authorization, idempotency, ordering, signature, revision, and compatibility envelopes.
- Read-only example adapters for navigation, stability, weather, PMS, training, and management engines.
- Feature and activation gates that make real physical authority impossible by default.

Schema stabilization does not authorize actuator code or imply class/flag approval.

## MetOcean, celestial, and PNT foundation

The v1 inert contracts, one Observation golden vector, official-warning hash binding, and default-off capability registry are present. Remaining activation-blocking gaps include device trust and calibration lifecycle, controlled unit/quantity registry, official-warning signature verification and precedence engine, time-authority model, evidence store integration, PNT duplicate/replay tracking, multi-source fusion/integrity algorithms, ODD/capability authorization integration, edge-adapter sandboxing, and golden vectors for every remaining contract type. None is an accepted deferral; live sensors and accepted navigation solutions remain blocked.

ADR-0003 now supplies inert candidate contracts for device identity, calibration, time authority, evidence references, and warning verification. Positive trust issuance, certificate-chain validation, revocation/status services, secure-clock discipline, evidence-store verification, and contract binding into observations remain activation-blocking.

## Stability Foundation v1

ADR-0027 through ADR-0035 establish a private, inert and deny-only Stability foundation: DRAFT data packages; typed lightship/tank/compartment/hydrostatics/cross-curves sources; test/loading conditions; unverified reference and independent-check records; criteria/uncertainty candidates; full graph integrity composition; ephemeral evidence and initial custody candidates; and a terminal denial for publication, Stability Booklet use, loading-computer use and operational activation. The terminal boundary is evidenced by 1086 passing repository tests at commit `eb178a1` and Claude/Grok diff review. This closes the planned interface-foundation item only.

Activation-blocking gaps remain: authenticated approved source custody, real engineering calculations, independent reproduction, rule applicability, intact/damage stability criteria, longitudinal strength, benchmark and validation evidence, durable append-only audit/read-back, signatures, trusted identity/time, class/flag/vessel-specific approval, approved test conditions, failure/offline/backup validation, authorized loading-computer runtime, publication and operational release. No gap in this list is implicitly deferred or accepted.

## Pedagogy and animation foundation

ADR-0036 adds private, inert learning-profile, lesson-state, pedagogy-decision and animation-intent candidates. Knowledge grounding remains confined to pedagogy; animation carries presentation commitments only and is structurally forbidden from claiming knowledge authority or requesting identity recognition, biometric capture or live capture. Consent/isolation verification, grounded-content binding, qualified pedagogy review, adaptive-learning logic, competency assessment, renderer isolation, synthetic-media disclosure enforcement, persistence, capture and product workflows remain activation-blocking.

ADR-0037 composes that chain with the existing `LEARNING` sensitive-data descriptor, retention-policy, isolation-context and truth-claim candidates. It rejects scope, purpose, resource, reference and time-window mismatches, but deliberately treats a complete candidate graph as non-authoritative. Consent verification, source currency/applicability, independent truth checking, qualified human review and renderer assurance remain open activation blockers.

ADR-0038 reuses the task-memory `ConsentCandidate` and binds its learner owner, profile/revision, purpose, explicit learning scope and validity window to the pedagogy graph. This closes only referential integrity: informed-consent verification, authenticated identity, durable/revocable storage, conflict handling, regression evidence and audit remain activation-blocking.

ADR-0039 binds the learning profile and lesson progress to existing unverified governance evidence and a pending unsigned human-review request. It cannot mark competency, lesson completion, examination success or certification. Qualified reviewer identity, assessment policy, provenance verification, signature authorization, durable audit and independent oversight remain activation-blocking.

ADR-0040 binds animation intent to external synthetic-presentation evidence and a strict inert renderer isolation profile. It does not verify disclosure/provenance/license custody or OS/container enforcement and cannot render, capture, recognize or activate anything.

Pedagogy Foundation v1 now closes only the ADR-0036–0040 private interface and terminal-denial groundwork. It remains not production ready; no evidence accumulation in v1 can unlock adaptive instruction, rendering, recognition, capture, certification or activation.

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

[CORE_PROTOCOL_INTEGRATION_AND_GAP_PLAN.md](./CORE_PROTOCOL_INTEGRATION_AND_GAP_PLAN.md) adds open blockers for truth/safe-stop, consented task memory, engineering V&V, scan/digital-twin provenance, operational Stability Booklet/Load Master, pedagogy/animation separation, sensitive learning/ship/person data, voice consent/revocation, and emergency deletion evidence. Stability Foundation v1 closes only inert interface and terminal-denial groundwork; operational requirements remain open.
