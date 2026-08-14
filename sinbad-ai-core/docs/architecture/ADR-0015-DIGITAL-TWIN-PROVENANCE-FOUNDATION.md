# ADR-0015: Scan and Digital-Twin Provenance Foundation

- Phase: Post-6H / Architecture Gate 0 / Digital Twin Foundation 1
- Status: Inert scan/layer/deviation/twin candidates accepted; geometry generation and living-twin activation blocked

## Decision

Represent scan datasets, model layers, deviation findings, and digital-twin state candidates with exact versioned contracts. Bind tenant, vessel, source device/calibration, units, coordinate frame, raw/derived hashes, artifact/layer/scan identities, baseline versus observed reality, provenance, uncertainty, evidence, revision lineage, synchronization checkpoint, and total time order.

Scans and deviations remain `UNVERIFIED`; layers remain `DRAFT`; twin state remains `CANDIDATE`. `APPROVED_REFERENCE` is a source/reality label and not an approval. No contract can mint registered geometry, verified as-built/as-is truth, accepted deviation, living/operational twin, or official authority.

This module contains no sensor driver, capture process, photogrammetry, point-cloud processing, SLAM, registration, scan-to-CAD/BIM, geometry generation, deviation calculation, AR/VR/MR, synchronization runtime, storage, network, or live-twin engine and remains outside package exports.
