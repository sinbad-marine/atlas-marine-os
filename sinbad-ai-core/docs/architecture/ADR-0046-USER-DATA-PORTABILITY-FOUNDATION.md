# ADR-0046: User Data Portability Foundation

## Status

Accepted as a private, inert, deny-only interface foundation.

## Decision

Define an exact draft export manifest using vendor-neutral `SINBAD_PORTABLE_JSONL`, UTF-8 and an `NFC_REQUIRED` normalization policy with a versioned schema catalog, tenant plus vessel/person scope, record count, payload/provenance commitments and trusted-boundary time. The policy label is a requirement, not proof that absent payload bytes were normalized. A separate unverified round-trip candidate binds the export, scope, catalog, source/re-export payloads, source provenance, semantic comparison and importer implementation. Scope, schema, payload, provenance, semantic-comparison and importer-implementation commitments are pairwise distinct; only source/re-export payload equality is expected. Equal create/test timestamps are allowed for discrete clock resolution but never confer authority.

Matching hashes remain blocked. Candidate equality does not prove authorization, redaction, schema correctness, semantic preservation, provenance, independent reproduction or durable audit. Mismatch is visible and cannot enable export or import.

## Excluded

No data reader, writer, exporter, importer, redactor, archive builder, filesystem/database/network access, personal-data processing, audit append, publication or activation is introduced. The module remains outside package exports.
