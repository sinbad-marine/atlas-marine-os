# ADR-0040: Pedagogy Renderer Integrity

## Status

Accepted as a private, inert, deny-only composition boundary.

## Decision

Bind animation intent to an external, content-addressed `EvidenceReference`: presentation script, provenance and synthetic-disclosure/license hashes must match exactly, media type is the Sinbad synthetic-presentation type, and bytes remain outside Core. The evidence source ID is the SHA-256 commitment of `[tenantId,vesselId,personId,"PRESENTATION_RENDERER"]`, preventing cross-scope reuse; intent and evidence times cannot exceed trusted `expectedNow`. Bind the candidate renderer to the existing strict engine isolation profile with no filesystem, network, process, environment, secret, dynamic-module or native-code authority.

Even a complete graph remains blocked because the isolation profile is not OS/container attestation. Disclosure authenticity, provenance custody, licensing, sandbox enforcement, escape resistance, renderer review and human approval remain required. Animation cannot become knowledge authority or enable identity recognition, biometric/live capture, rendering or activation.

## Excluded

No renderer, speech synthesis, voice clone, camera/microphone capture, biometric processing, digital-human runtime, filesystem/network operation or product workflow is introduced.
