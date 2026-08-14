# Sinbad Core Capability and Assurance Roadmap

Progression is gated; levels are not marketing labels and cannot be self-declared.

1. Observation: ingest, normalize, correlate, and audit vessel data and alarms.
2. Decision support: produce evidence-backed recommendations; a human performs the action.
3. Authorized command intent: an authorized workflow emits `CommandIntent`; local operator and/or VCASK validates it.
4. Supervised autonomy: operate only inside a certified `OperationalEnvelope` under active supervision.
5. Approved local degraded autonomy: on link loss, execute a certified minimum-risk condition or manoeuvre.
6. Vessel-specific advanced autonomy: activate only after class/flag and other applicable approval.

The current `OperationalEnvelope` v1 enum intentionally represents levels 1–5 only. Level 6 advanced autonomy is not representable by the inert core contract package and requires a separately reviewed schema-version change in the future certified program.

No level advances without representative simulation, hardware-in-the-loop testing, sea trials where applicable, cybersecurity validation, human-factors work, FMEA/STPA or equivalent hazard analysis, and independent safety assurance.

## Near-term core roadmap

- Complete Architecture Gate 0 models and evidence plumbing.
- Stabilize the six vendor-neutral conceptual contract schemas without actuator authority.
- Establish threat/hazard registers, feature gates, environment isolation, and activation records.
- Add example read-only adapters for future navigation, stability, weather, PMS, training, and management contexts.
- Prove offline-first, synchronization, migration/recovery, restore, observability, and data-export behavior.

## Separate future certified program

VCASK implementation, command arbitration, verified control functions, actuator integration, shore-control operation, supervised autonomy, minimum-risk manoeuvres, and real-vessel trials belong to a separately authorized and independently assured safety program.
