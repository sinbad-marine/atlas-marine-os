# Preliminary Control Threat and Hazard Model

Status: baseline for interface design only; not a safety case and not certification evidence.

## Protected assets and authority

Protected assets include vessel identity and state, operator and machine identity, command intent, operational envelope, safety decision, execution receipt, hazard evidence, audit history, keys, time, software/update provenance, local-master authority, emergency stop, and independent safety systems.

## Trust boundaries

- shore operator/device ↔ communications gateway;
- communications gateway ↔ Sinbad Management/AI;
- Management/AI ↔ future VCASK;
- VCASK ↔ command arbiter/interlocks;
- command arbiter ↔ edge protocol adapters/actuators;
- sensors/edge adapters ↔ `VesselState` evidence;
- simulation, HIL, shore-control, and real-vessel environments;
- tenant, fleet, vessel, and equipment identities.

## Threat and hazard baseline

| Scenario | Required response | Activation effect |
|---|---|---|
| stolen operator/device identity or privilege escalation | MFA/device identity, least privilege, revocation, durable attribution | BLOCKING |
| replayed, reordered, duplicated, expired, or cross-vessel intent | integrity, nonce/idempotency, vessel scope, monotonic/secure time, expiry | BLOCKING |
| spoofed/jammed GNSS or satellite loss | independent sensor evidence, disagreement detection, degraded/minimum-risk condition | BLOCKING |
| compromised sensor or single-source authority | provenance, confidence, redundancy, bounded uncertainty; never single unverified authority | BLOCKING |
| link loss or excessive latency | local authority and approved minimum-risk/degraded behavior; no blind continuation | BLOCKING |
| AI hallucination, prompt injection, or forged safety decision | AI cannot emit VCASK authority; strict contracts and kernel identity; default deny | BLOCKING |
| command crosses operational envelope | deterministic reject and audit | BLOCKING |
| fire-agent discharge with people/cargo risk | independent vessel-specific logic and required human/dual approval | BLOCKING |
| command arbiter/interlock bypass | hard architectural and certified control boundary; independent emergency stop | BLOCKING |
| simulation/HIL command reaches real vessel | cryptographic identity, network segregation, environment-bound keys | BLOCKING |
| malicious/partial update, rollback failure, disk exhaustion | signed update, atomic recovery, storage reserve, tested rollback/forward recovery | BLOCKING |
| missing/corrupt audit or time | fail closed; no safety-critical authorization | BLOCKING |

## Required analysis before physical authority

A separately authorized VCASK program must produce vessel-specific FMEA and STPA (or accepted equivalents), cybersecurity threat analysis, human-factors assessment, fault trees where appropriate, operational-envelope hazards, emergency and minimum-risk state definitions, independent assurance, and traceability from every hazard control to simulation/HIL/sea-trial evidence.
