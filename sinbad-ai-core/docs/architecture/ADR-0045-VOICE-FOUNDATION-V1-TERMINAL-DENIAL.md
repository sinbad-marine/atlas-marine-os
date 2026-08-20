# ADR-0045: Voice Foundation v1 Terminal Denial

## Status

Accepted as the private terminal boundary for Voice Foundation v1.

## Decision

Close ADR-0041–0044 behind one final deny-only contract version. Every declared voice capability—capture, voiceprint creation, cloning, synthesis, playback, identity/payment/legal/emergency-call use, incident-report retention, deletion completion, emergency-revocation restore/veto and activation—is denied and final for this contract version. Malformed and unknown requests use a distinct invalid status while remaining denied.

No accumulation of candidate consent, lifecycle, deletion or incident evidence can unlock this terminal surface. A positive capability requires a new contract version, ADR, privacy/threat review, independently verified assurance and explicit authorization.

The repository currently contains no voice capture, synthesis, playback, identity-use, retention or deletion runtime entry point. A regression tripwire rejects imports of these private foundation modules from other runtime files; adding a real entry point therefore requires deliberate contract and test revision rather than silently bypassing the terminal boundary.

## Consequences

Foundation closure means only that private inert contracts and their terminal denial are regression-locked. It does not attest consent, identity, anti-impersonation, isolation, watermark/provenance, revocation persistence, deletion, restore-negative results, audit durability, retention legality or production readiness.
