# ADR-0050: Voice Profile Registry Boundary

## Status

Accepted as a private, inert v2b preparation boundary. It creates no registry storage or runtime authority.

## Context

XTTS requires a server-controlled reference WAV, while the browser must never select or disclose a local filesystem path. A profile must bind the exact tenant, person, consent, authorized user, language, reference-audio content, model/configuration, revocation epoch and validity window before a later service can resolve any server-side asset.

## Decision

Represent an exact candidate profile containing opaque identifiers, SHA-256 commitments and the fixed `WAV_PCM_S16LE_MONO_22050` format label. Paths, raw media, embeddings, conditioning latents and speaker indexes are structurally absent. The assessor compares every claim with independently supplied trusted expectations and remains terminally blocked even when all values match. Failed scope, authorization, artifact, epoch or time checks echo neither the candidate profile identifier nor its reference-audio hash; only a fully matched but still-blocked result may retain those commitments for local correlation.

## Consequences

No upload endpoint, path resolver, filesystem read, profile store, XTTS process, cache, synthesis, playback or activation is introduced. Voice Foundation v1 terminal denial and the browser Web Speech path remain unchanged. A future server implementation must prove authenticated profile custody, consent/revocation freshness, WAV/hash verification, erasure behavior and release authorization in a new phase.
