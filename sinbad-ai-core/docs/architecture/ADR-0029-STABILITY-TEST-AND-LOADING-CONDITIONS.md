# ADR-0029: Stability Test and Loading Condition Candidates

## Status

Accepted as DRAFT-only inert condition foundations.

## Decision

Define Stability Test Conditions for reference, departure, arrival, intermediate and damage-case inputs, plus Loading Condition Candidates binding cargo, tank, consumable, density/temperature correction, ballast sequence and voyage-state commitments. Tenant/vessel/package/condition identity must match.

The host supplies an exact expected Stability Package identity; candidate-to-condition equality alone is insufficient. Canonical field order is part of each versioned wire contract and must not change without a version bump.

All hashes, references and timestamps are untrusted declarations. Evaluation always blocks pending source-data integrity, reference-result verification, calculations, longitudinal strength, stability criteria and class/flag approval.

No trim/list/GZ/strength solver, ballast optimizer, what-if engine, alarm generator, loading computer, approval, persistence or physical-control surface is introduced.
