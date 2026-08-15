# ADR-0001: VCASK Physical-Control Boundary

- Status: Accepted as architectural constraint; implementation not authorized
- Scope: Future vessel control and autonomy
- Decision owner: Sinbad Core owner

## Context

Future Sinbad capability may coordinate navigation, machinery, energy, safety, and emergency systems under authorized remote supervision or an approved autonomy level. General AI/management software is nondeterministic and cannot be the final authority for safety-critical actuation.

## Decision

Create a separate deterministic and certifiable Vessel Control & Autonomy Safety Kernel (VCASK) boundary. General Sinbad Management/AI reads `VesselState`, proposes `CommandIntent`, and manages authorization workflow. VCASK evaluates the current `OperationalEnvelope` and returns `SafetyDecision`. Verified control functions, hard safety interlocks, and a command arbiter control any actuator path and return `ControlExecutionReceipt`. `HazardAndIncident` carries hazard state and response evidence without granting actuator authority.

Master/local authority, independent emergency stop, and certified safety systems retain highest priority. Remote or autonomous commands cannot override them. Remote command admission requires authenticated human/machine identity, role, vessel, operation envelope, expiry, integrity, replay protection, and dual approval where required.

Independent constraint, approval, actor, nonce, command-scope, time-authority, parameter, envelope, intent, kernel, decision, and equipment roles use pairwise-distinct hash commitments within their records. A single artifact cannot impersonate multiple control-admission, safety-decision, or execution-receipt roles.

Loss of link, excessive latency, replay, spoofing/jamming, sensor disagreement, cyber incident, invalid time, or insufficient evidence enters an approved degraded or minimum-risk condition. Irreversible actions such as firefighting-agent discharge require vessel/cargo/occupancy-aware independent safety logic and required human approval; general AI cannot initiate them alone.

Training/simulation, shore-control, HIL/test, and real-vessel environments are cryptographically and network isolated. Every intent, authorization, envelope decision, approval, transmission, acceptance/rejection, execution, and result is append-only audited.

## Consequences

- No real actuator implementation or activation is authorized by this ADR.
- The present inert contract package cannot mint an `ACCEPTED` safety decision or `ACCEPTED`/`COMPLETED` execution receipt. Positive authority types require a separately authorized VCASK package with kernel attestation and gate evidence.
- Protocols such as NMEA, IEC, Modbus, CAN, or Ethernet terminate in edge adapters.
- Domain contracts remain vendor-neutral and versioned.
- Real control requires applicable class, flag, IMO/IEC/ISO, vessel-specific approvals, hazard analysis, independent assurance, staged commissioning, and explicit activation.
- A future VCASK program must maintain separate safety lifecycle, threat model, assurance case, and certification evidence.
