# ADR-0049: Voice Synthesis Integration Readiness Boundary

## Status

Accepted as a private, inert preparation boundary. It does not supersede or weaken Voice Foundation v1 terminal denial.

## Context

The current browser application uses `SpeechSynthesisUtterance` and has no XTTS request, reference-audio upload or voice-profile resolution path. A separately tested local Coqui XTTS-v2 CLI and TypeScript adapter can synthesize with `--speaker_wav`, but the adapter currently keeps one constructor-level speaker WAV path, starts a fresh CLI process for every request and provides no authenticated multi-profile resolution, durable revocation, upload validation, conditioning-cache custody or product activation authority. CPU synthesis is batch class and has measured approximately 12–13 seconds for a short sentence.

## Decision

Introduce a private v2a readiness candidate that binds request, tenant, person, voice profile, consent, disclosure, purpose, language, authorized user, reference-audio hash, model hash, config hash, text hash, trusted time and bounded latency/text policy. The contract accepts identifiers and hashes only. It never accepts a client filesystem path, raw audio, speaker index, embedding, conditioning latent or provider credential.

The assessor remains terminally blocked. Complete metadata cannot authorize profile resolution, conditioning cache, synthesis, playback or activation. A later positive runtime requires authenticated owner identity and consent, durable revocation, server-controlled `voiceProfileRef` resolution, WAV format/hash validation, model/config custody, disclosure/watermark/provenance, bounded queue/timeout/cancellation, temporary-output erasure, independent threat/privacy review and an explicit release decision.

## Consequences

Voice Foundation v1 remains unchanged and deny-only. The browser continues using its existing standard speech path. No XTTS process, network listener, upload endpoint, cache, file operation or audio playback is introduced by this phase. The new envelope provides a strict target contract for a future local Node Voice Service without silently activating cloning.
