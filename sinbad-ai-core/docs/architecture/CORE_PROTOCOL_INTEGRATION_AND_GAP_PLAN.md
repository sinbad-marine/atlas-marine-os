# Binding Protocol Integration and Gap Plan

- Status: Binding requirements recorded; runtime implementation and every activation gate remain blocked
- Source date: 2026-08-14

## Source provenance

The four external user-owned source protocols were read in full and hashed during this integration. These are review-provenance values mirrored in the non-executable `core-protocol-requirements.json`; the external source bytes are not under repository custody:

| Protocol | SHA-256 |
|---|---|
| `SINBAD_TEMEL_POLITIKA.md` | `BC0EBCDE2F9A5A6DFF7E8338937CD4D22DE75D1C57C775EDFEC817DF98FF6C9A` |
| `SINBAD_CORE_DOGRULUK_DURMA_VE_KALICI_GOREV_HAFIZASI_PROTOKOLU.md` | `467D7EB34692294A5BC7A6E5D688DC9ABD8485FE6ABE2716EF9AC843B77AB066` |
| `SINBAD_GEMI_INSA_TASARIM_TARAMA_VE_DIJITAL_IKIZ_PROTOKOLU.md` | `560DE89BC60A955D3E3B324F2FB548D374BA5DD0376BE7133BE62608912DFCF2` |
| `SINBAD_GERCEK_ZAMANLI_DIJITAL_EGITMEN_VE_SANAL_SINIF_PROTOKOLU.md` | `9FC879C6C38169B5BF9C3DC4F7B0287CE50F2D440C466004D35B47B857F7B8FA` |

The sources are not runtime configuration and grant no activation authority. A changed hash requires a new comparison and revision.

## Binding interpretation

Sinbad is an internationally applicable maritime knowledge, engineering, training, and decision-support platform. Significant claims distinguish `verified_fact`, `user_supplied_fact`, `inference`, `estimate`, `recommendation`, and `unknown`. Missing, conflicting, stale, inapplicable, failed, irreversible, safety-critical, or materially ambiguous work enters an explicit safe-stop state and is never reported complete.

User-approved task memory is consented, versioned, scoped, reversible, inspectable, exportable, revocable, and deletion-aware. A durable template/profile requires a machine-valid schema, golden example, regression tests, conflict policy, retention classification, and immutable provenance. One-time exceptions never silently mutate it.

Engineering artifacts preserve design intent versus approved/as-built/as-is/proposed reality; units, coordinates, geometry, source, uncertainty, solver/version, independent calculation, benchmark, convergence, sensitivity, V&V, and physical/sea-trial validation. `DRAFT`, `VERIFIED`, and `VALIDATED` are distinct externally evidenced states. Sinbad cannot issue `APPROVED FOR CONSTRUCTION`, `APPROVED STABILITY BOOKLET`, class/flag approval, or authorized loading-computer status.

Training separates knowledge authority, pedagogy, dialogue/voice, animation, simulation, identity/consent/memory, and audit. Animation, visual confidence, voice likeness, or charisma never raises evidence authority. Personal voice synthesis requires verified owner consent, narrow purpose/time/language/user scope, synthetic disclosure, provenance/watermark, revocation, and anti-impersonation controls.

An explicit emergency voice-destruction request or high-confidence prohibited/coercive-use trigger stops generation and enters `EMERGENCY_REVOKED`; serious uncertainty enters `QUARANTINED`. Source audio, voiceprints/embeddings, fine-tunes/adapters, caches, replicas, and recoverable backups require cryptographic-erasure orchestration. Admin/owner roles cannot veto or restore emergency destruction. Only a non-reconstructive tamper-evident incident report may remain; incomplete deletion is `PARTIAL_DELETION`, never complete.

## Dependency classification

### Required in Core now

- truth classification, source currency/applicability, uncertainty/conflict, safe-stop, honest execution state, and intent confirmation;
- consented versioned task-profile/golden-template lifecycle and user view/export/revoke/delete boundaries;
- sensitive-data classification and tenant/vessel/person isolation for learning, voice, imagery, ship geometry, security layers, and operational data;
- engineering artifact identity, unit/coordinate/provenance/uncertainty and `DRAFT`-only foundations;
- consent, retention, disclosure, revocation, quarantine, emergency-destruction manifest, deletion evidence, and non-reconstructive incident contracts;
- default-off gates for solvers, loading computers, navigation/control, biometric recognition, voice synthesis, official approval, and destructive operations.

### Interfaces to stabilize

- `TruthClaim`, `SafeStopRecord`, `ExecutionStatus`, `TaskProfile`, `GoldenTemplate`, `MemoryConflict`;
- `EngineeringArtifact`, `CoordinateFrame`, `MeasurementProvenance`, `CalculationChain`, `VerificationRecord`, `ValidationRecord`;
- `ScanDataset`, `ModelLayer`, `DeviationFinding`, `DigitalTwinState`, `StabilityDataPackage`, `LoadingConditionCandidate`;
- `LearningProfile`, `LessonState`, `PedagogyDecision`, `AnimationIntent`;
- `VoiceConsent`, `SyntheticVoiceDisclosure`, `VoiceUseIntent`, `VoiceSecurityIncident`, `DeletionManifest`, `DeletionEvidence`.

### Separate gated product/certification programs

- CAD/CAE/CAM, scan-to-CAD/BIM, point-cloud/SLAM, AR/VR/MR and living digital-twin runtimes;
- engineering solvers, CFD/FEA, Stability Booklet production, Load Master/loading computer and vessel-specific approval;
- real-time digital human, speech, adaptive classroom, biometric features and multi-user training;
- voice model training/synthesis and irreversible cross-provider emergency-erasure execution;
- accepted navigation, VCASK/physical control, class/flag claims and real-vessel commissioning.

## Safe implementation order

1. Truth/safe-stop/execution-state and versioned task-memory contracts. **Current: Runtime Foundations 1–2 (ADR-0009/0010), NOT PRODUCTION READY / BLOCKED; truth/stop plus consent/conflict/one-time/action request contracts are inert and the blocker remains open.**
2. Sensitive-data classification, consent/retention/export/delete and isolation gates.
3. Engineering artifact/unit/coordinate/provenance and DRAFT-only contracts.
4. Calculation-chain/V&V state machine with independent-check and uncertainty evidence.
5. Digital-twin layer identity and scan provenance without geometry generation.
6. Stability/Load Master input and test-condition contracts without calculations or approval states.
7. Pedagogy/learning/animation-intent separation without live capture or biometrics.
8. Voice consent/use/disclosure/revocation/quarantine contracts; emergency deletion only after threat model, provider inventory, key architecture, legal/privacy review, restore-negative tests, and explicit destructive-operation authority.

## Activation blockers

No voice deletion may be claimed complete without replica/provider/backup evidence. No engineering result is `VERIFIED` without independent calculation evidence or `VALIDATED` without physical/operational comparison. No Stability Booklet or Load Master may claim approval. No animation or synthetic voice is knowledge, identity, legal, payment, emergency-call, or official-command authority.
