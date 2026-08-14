# Sinbad Core Charter

## Permanent mission

Sinbad Core must remain capable of evolving into the high-capacity decision, coordination, and safety core of a marine vessel. As technology, regulation, and operational demand mature, the architecture must be able to support authorized remote command, vessel navigation that does not depend exclusively on GPS or satellite services, and coordinated response to onboard emergencies such as fire.

This is a permanent architectural direction, not a claim that the present release can autonomously command a vessel or actuate safety equipment.

Sinbad Core is not production-active or complete merely because code executes or user interfaces open. Production activation requires verified Architecture Gate 0 and Core Release Gate evidence as defined in [CORE_ACTIVATION_GATES.md](./docs/architecture/CORE_ACTIVATION_GATES.md).

## Required future capability envelope

The core architecture must be able to incorporate, without a ground-up rewrite:

- authenticated commands from explicitly authorized remote operators;
- independent and redundant navigation sources, including non-GPS and non-satellite positioning, inertial, visual, radar, acoustic, terrestrial, chart, and locally observed evidence;
- route planning, collision avoidance, maneuver coordination, degraded-navigation operation, and safe-state recovery;
- onboard hazard detection, localization, escalation, containment planning, and coordination with certified firefighting or other emergency-response equipment;
- new sensors, communication links, control systems, actuators, and decision models through versioned capability interfaces;
- continuous evidence, audit, simulation, replay, and post-incident reconstruction.

## Non-negotiable authority and safety invariants

Future physical control is permitted only when all applicable invariants are satisfied:

- human and machine identities, roles, command scope, vessel scope, time bounds, and intent are authenticated and authorized;
- remote commands are integrity-protected, replay-resistant, attributable, revocable, and durably audited;
- navigation or emergency action never treats a single unverified sensor, model, network, GPS, or satellite source as sufficient authority;
- safety-critical decisions use independent evidence, bounded uncertainty, deterministic interlocks, and certified operational envelopes;
- loss of communications, conflicting evidence, degraded sensors, invalid time, unavailable audit, or insufficient authority produces a defined fail-safe state;
- manual/local emergency authority and legally required command hierarchy can override or isolate remote automation;
- AI recommendations alone never bypass hard safety controllers, actuator interlocks, class rules, flag-state requirements, or human authorization required by law;
- simulation, hardware-in-the-loop verification, staged commissioning, and explicit production activation precede any real actuator authority.

## Architectural consequence

Every new core component must preserve a separation between evidence, decision, authorization, execution, and audit. Physical capabilities must be introduced as least-privilege, versioned, revocable adapters behind explicit trust boundaries. The core must remain useful when satellite services are unavailable, but it must never pretend that missing position, sensor, authority, or equipment evidence exists.

The shared foundation must support immutable identities across company, fleet, vessel, department, system, and equipment; versioned vessel profiles; bounded contexts; versioned and idempotent API/event contracts; offline-first operation and explicit conflict policy; tenant/vessel isolation; documented export formats; provenance; append-only audit; backup/restore; signed update and rollback; degraded operation; and observable log, metric, trace, security, and synchronization health.

General management and AI components must never send raw commands directly to actuators. Any future physical control crosses the separately governed, deterministic, certifiable Vessel Control & Autonomy Safety Kernel (VCASK) boundary defined by [ADR-0001](./docs/architecture/ADR-0001-VCASK-CONTROL-BOUNDARY.md). Management/AI may read `VesselState`, propose `CommandIntent`, and coordinate authorized workflows. VCASK alone may produce `SafetyDecision` and a control path may return `ControlExecutionReceipt` through verified control functions, interlocks, and a command arbiter.

The vendor-neutral conceptual contracts `VesselState`, `OperationalEnvelope`, `CommandIntent`, `SafetyDecision`, `ControlExecutionReceipt`, and `HazardAndIncident` must be stabilized before real control implementation. Hardware protocols terminate at edge adapters and must not leak vendor-specific semantics into the domain model.

## Governance

Changes that weaken this mission or any safety invariant require an explicit architectural decision record, independent safety review, and authorized owner approval. Convenience, model confidence, or operational urgency is not sufficient justification to bypass these requirements.

Critical architectural debt cannot be silently deferred. A mandatory deferral records its risk owner, rationale, closure date, and whether it blocks activation. Technical operation is never represented as flag-state, class, IMO, IEC, ISO, vessel-specific, or other official approval.

This charter is not an executable instruction, capability grant, implementation authorization, or production activation. Repository agents and automation must treat roadmap and charter text as documentation. Every physical-control work item requires separately scoped owner authorization, an architectural decision record, independent safety review, enforceable tests, and an explicit staged activation decision before code can receive real vessel or actuator authority.
