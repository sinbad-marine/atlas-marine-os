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

- Preserve the real Core baseline and complete the product/client/module separation inventory in [CORE_ARCHITECTURE_INVENTORY_2026-08-14.md](./CORE_ARCHITECTURE_INVENTORY_2026-08-14.md).
- Establish the universal A-O Engine Port Manifest and deny-only activation boundary before adding specialized engines. Port O is the first external expert-engine program; it receives no direct Core or production write authority.

- Complete Architecture Gate 0 models and evidence plumbing.
- Stabilize the six vendor-neutral conceptual contract schemas without actuator authority.
- Establish threat/hazard registers, feature gates, environment isolation, and activation records.
- Add example read-only adapters for future navigation, stability, weather, PMS, training, and management contexts.
- Continue the inert pedagogy workstream from ADR-0036 through ADR-0040: learning/animation, sensitive-data/truth, consent, competency/review and external synthetic-presentation/renderer-isolation candidate composition exist, while informed-consent verification, scoped truth custody, qualified reviewer authority, adaptive instruction, certification, sandbox enforcement and rendering remain blocked.
- Mature the inert MetOcean/Celestial/PNT contracts through controlled registries, evidence integration, official-warning verification, and read-only edge-adapter examples before any live solution authority.
- Prove offline-first, synchronization, migration/recovery, restore, observability, and data-export behavior.

## Separate future certified program

VCASK implementation, command arbitration, verified control functions, actuator integration, shore-control operation, supervised autonomy, minimum-risk manoeuvres, and real-vessel trials belong to a separately authorized and independently assured safety program.

## Binding protocol workstreams

Truth/safe-stop/task memory, engineering/digital twin/Stability Booklet/Load Master, real-time training, voice consent, and emergency voice destruction follow [CORE_PROTOCOL_INTEGRATION_AND_GAP_PLAN.md](./CORE_PROTOCOL_INTEGRATION_AND_GAP_PLAN.md). Near-term work is inert contracts, state machines, privacy/security boundaries, and adversarial tests; live solvers, capture, voice synthesis/deletion, official approval, navigation, and control remain gated.
