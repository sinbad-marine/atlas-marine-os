# Voice Synthesis Integration Readiness — 2026-08-20

The verified local engine command uses Coqui TTS 0.22.0, XTTS-v2, Turkish language selection and `--speaker_wav`. Three independent reference recordings changed synthesized pitch toward the supplied speaker, establishing that the engine consumes the reference input. The current Sinbad Marine browser application does not call that engine; it selects a device voice through `SpeechSynthesisUtterance`.

The external TypeScript XTTS adapter is a useful engine prototype but not yet a product boundary. Its `speakerWavPath` is constructor-level even though requests contain `voiceProfileId`; it spawns a new CLI process per synthesis, does not enforce the declared first-byte timeout, does not validate profile ownership or WAV custody, has no conditioning-latent cache, queue limit or final output cleanup, and must not accept client-controlled paths.

ADR-0049 adds only an inert hash-and-identity readiness envelope. Implementation remains blocked pending a server-controlled profile registry, authenticated consent and revocation state, disclosure/watermark/provenance custody, a persistent model worker or explicitly accepted batch latency, bounded cancellation and erasure behavior, and independent security/privacy/release approval.
