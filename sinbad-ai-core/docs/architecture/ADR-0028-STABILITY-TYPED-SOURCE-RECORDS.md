# ADR-0028: Stability Typed Source Records

## Status

Accepted as DRAFT-only inert source identity foundations.

## Decision

Define separate source records for lightship particulars, tank plans, compartment plans, hydrostatics and cross-curves. Each record binds tenant/vessel, vessel profile, unit set, coordinate frame, engineering artifact, provenance, content commitment and revision lineage. Typed table/field references identify expected source structure without parsing or interpreting values.

A set evaluation enforces common tenant/vessel/profile/unit/frame scope and always blocks pending source-byte integrity, provenance, units, table-schema and approval verification. Records remain `DRAFT`; hashes and timestamps are untrusted labels.

Field order is part of each versioned canonical serialization contract and must not change without a version change. Separate source kinds intentionally carry distinct artifact and provenance references. Cross-source identifier uniqueness, byte custody and provenance-set indexing remain future verifier responsibilities; the current set assessment never treats their absence as verified.

No document/table parser, sounding/ullage conversion, hydrostatics/KN/GZ calculation, lightship validation, damage/intact stability solver, longitudinal-strength engine, approval generator, persistence or loading-computer surface exists.
