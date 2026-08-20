# ADR-0048: Observability Evidence Foundation

## Status

Accepted as a private, inert, deny-only evidence foundation.

## Decision

Represent one exact release observation window with distinct content commitments, sample counts and dropped counts for logs, metrics, traces, security events and synchronization health. Bind a separate unverified pipeline candidate to expected configuration, retention, redaction, exporter-isolation and continuity commitments. Those five pipeline assurance roles must use pairwise-distinct hashes so one artifact cannot be replayed as evidence for multiple independent commitments. Every signal requires at least one sample and zero reported drops before reaching the external-assurance blocker. Snapshot validity only proves candidate shape; a zero-sample snapshot is deliberately representable so the assessment can report the precise coverage gap.

Complete candidate coverage remains unverified. Counts and hashes do not prove signal authenticity, continuity, retention enforcement, redaction, isolation, alert delivery or durable audit.

## Excluded

No telemetry collector/exporter, logger, tracer, metrics backend, alarm service, network/store access, release decision or activation is introduced. Load Master remains outside and frozen.
