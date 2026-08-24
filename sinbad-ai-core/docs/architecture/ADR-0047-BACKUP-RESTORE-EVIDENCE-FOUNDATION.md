# ADR-0047: Backup and Clean-Restore Evidence Foundation

## Status

Accepted as a private, inert, deny-only evidence foundation.

## Decision

Define exact draft backup-set and unverified clean-restore trial candidates bound to tenant scope, data snapshot, schema catalog, externally expected encryption policy, key custody, target-environment fingerprint, integrity/application evidence, isolation attestation and explicit time boundaries. Restore-integrity, application-check and isolation-attestation commitments must be pairwise distinct; one artifact cannot silently satisfy multiple assurance roles. RPO and RTO are recomputed from bound timestamps; caller-supplied measurements must equal those calculations and are compared with explicit maximum targets. Replica count is inventory metadata only and never proves durability.

An exact snapshot match and in-target measurements remain blocked. Candidate hashes and labels do not verify backup durability, encryption, key custody, clean-environment isolation, restore integrity, application correctness, RPO/RTO evidence or durable audit.

## Excluded

No backup writer, restore executor, database/filesystem/network access, key service, disaster-recovery operation, environment provisioning, application runner, audit append, release or activation authority is introduced. Load Master is outside this workstream and remains frozen.
