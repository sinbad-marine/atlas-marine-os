# ADR-0013: Engineering Artifact, Unit, Coordinate, and Provenance Foundation

- Phase: Post-6H / Architecture Gate 0 / Engineering Foundation 1
- Status: DRAFT-only inert contracts accepted; engineering use and every authority claim blocked

## Decision

Represent engineering artifacts, rational unit definitions, coordinate frames, and measurement provenance with exact versioned contracts. Preserve the distinction between design intent, approved-reference input, as-built, as-is, and proposed reality. Bind a draft artifact to the exact tenant, vessel, unit set, coordinate frame, provenance record, uncertainty reference, revision lineage, and provisional time order.

`APPROVED_REFERENCE` is a reality/source label only and never mints approval. The only artifact state is `DRAFT`; unit state `CANDIDATE`; coordinate/provenance state `UNVERIFIED`. The joint evaluator always blocks pending authenticated source applicability, controlled unit catalog, verified transforms/datums, calibration, evidence integrity, uncertainty evaluation, independent calculation, benchmark, convergence, V&V, and physical/sea-trial validation.

This module contains no CAD/CAE/CAM, geometry generation, scan processing, solver, CFD/FEA, calculation, transform engine, verifier, approver, storage, network, Stability Booklet, Load Master, or official submission capability and remains outside package exports. Calculation-derived provenance is rejected until the separate Calculation Chain foundation exists; global/projected frames require an explicit unverified transform reference, and artifact uncertainty must bind the measurement-provenance uncertainty identity.
