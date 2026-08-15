# ADR-0041: Voice Consent, Disclosure, and Use Intent

## Status

Accepted as a private, inert, deny-only Voice Foundation 1.

## Decision

Represent exact versioned candidate consent, synthetic disclosure and voice-use intent records. Consent binds one person, voice profile, purpose, language, authorized user, time window and revocation epoch. Each intent binds the exact consent revocation epoch so a later epoch change invalidates stale intent. Disclosure binds the same consent, purpose, language and a validity window contained by the consent window; intent validity is contained by both. Equal grant/disclosure and request timestamps are explicitly allowed because timestamps are discrete, but they never create authority. Intent supports only training or accessibility narration; identity authentication, payment authorization, legal attestation and emergency calling are structurally inadmissible.

Complete candidate chains remain blocked pending authenticated voice-owner identity, informed-consent authenticity, durable revocation status, disclosure/watermark enforcement, provenance custody, anti-impersonation controls and human review. No candidate status can assert active consent, verified disclosure or authorized synthesis.

## Excluded

No audio capture, voiceprint/embedding, cloning, fine-tuning, speech synthesis, playback, identity verification, consent store, network/filesystem operation, deletion or emergency-destruction action is introduced.
