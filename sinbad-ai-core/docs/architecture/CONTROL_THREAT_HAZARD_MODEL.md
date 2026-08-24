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

## Added protocol hazards

| Hazard | Required control | Status |
|---|---|---|
| unsupported fact or completed-work claim | truth class, provenance, safe-stop and honest execution state | BLOCKING |
| task memory silently changed, leaked or retained | consent, versioning, isolation, retention, export/revoke/delete and audit | BLOCKING |
| design/as-built/as-is/proposed or DRAFT/VERIFIED/VALIDATED conflation | immutable layer/revision/provenance state machine and independent evidence | BLOCKING |
| unit, coordinate, solver or uncertainty error reaches engineering use | gates, independent calculation, benchmark, convergence, V&V and human approval | BLOCKING |
| draft Stability Booklet or Load Master presented as approved | approval boundary, reference tests and class/flag evidence | BLOCKING |
| animation or synthetic voice mistaken for authority | layer isolation, disclosure, watermark/provenance and prohibited-purpose gate | BLOCKING |
| voice used outside consent or for impersonation/coercion | owner verification, narrow consent, use-intent gate, immediate stop and quarantine | BLOCKING |
| emergency voice deletion vetoed, restored, incomplete or falsely reported | non-vetoable `EMERGENCY_REVOKED`, key destruction, deletion evidence, restore-negative tests and `PARTIAL_DELETION` | BLOCKING |

Actual irreversible voice deletion is a future destructive operation requiring provider/replica/backup inventory, legal/privacy review, dedicated authority, and independent restore-negative evidence. No current Core contract or administrator may claim or perform it.
