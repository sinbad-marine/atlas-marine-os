# ADR-0044: Voice Security Incident Hash-Chain Candidate

## Status

Accepted as a private, inert, deny-only Voice Foundation 4.

## Decision

Retain only an exact content-minimized incident candidate: opaque incident identity, externally prepared scope commitment, lifecycle-request/manifest/deletion-assessment hashes, bounded trigger class, honest `PARTIAL_DELETION`, sequence, predecessor hash and time. Scope, lifecycle request, deletion manifest, deletion assessment and any predecessor use pairwise-distinct commitments so one artifact cannot impersonate several incident-chain roles. Direct tenant, person and voice-profile identifiers, voice text, media, embeddings and provider payloads are absent. Canonical SHA-256 binds each field and predecessor for deterministic local tamper detection.

Hash integrity is not authenticity or durable append evidence. Even an intact candidate remains blocked with all verification, retention, deletion-completion and activation flags false until external signature, trusted time, authenticated actor, append-only durability, non-reconstruction review and retention authorization exist.

The opaque incident identifier and event hash remain sensitive correlation metadata. They may be returned only for a structurally intact local candidate and do not authorize retention, disclosure or external publication.

## Excluded

No event store, audit appender, signer, identity resolver, trusted clock, provider/storage access, deletion operation, reconstruction test or retention decision is introduced. The module remains outside package exports.
