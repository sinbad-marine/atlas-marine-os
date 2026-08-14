# ADR-0003: Common Sensor Trust Chain

- Status: Accepted as inert contract foundation; trust issuance not authorized

## Decision

Use versioned exact-data contracts for `DeviceIdentity`, `CalibrationRecord`, `TimeAuthority`, `EvidenceReference`, and `OfficialWarningVerification`. These records share device/vessel identity, bounded time and uncertainty, provenance/evidence hashes, calibration and certificate hashes, revocation epochs, media/license metadata, and content-addressed external evidence.

The current package cannot emit `TRUSTED`, calibration `VALID`, time `VALID`, or warning `VERIFIED` states. It records unverified, degraded, expired, revoked, invalid, or rejected candidates only. Positive trust requires future authenticated issuer verification, revocation/status checking, secure time, evidence-store validation, capability/ODD authorization, and separate gate evidence.

Camera and other binary material is never embedded in core records. `EvidenceReference` carries immutable content hash and metadata while storage remains an external adapter concern.

Hash fields are SHA-256-shaped opaque identifiers in this foundation. They are not authenticated claims, and domain-separated hashing remains an explicit future trust-issuer requirement.

`SENSOR_TRUST` is contract-only in capability registry version `sinbad-marine-capability-registry/2-v1`. Physical device drivers, vendor protocols, and live sensor admission remain blocked and belong to future sandboxed edge adapters/plugins.
