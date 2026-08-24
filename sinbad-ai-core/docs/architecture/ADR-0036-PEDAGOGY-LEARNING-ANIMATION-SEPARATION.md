# ADR-0036: Pedagogy, Learning, and Animation Intent Separation

## Status

Accepted as an inert, deny-only training foundation.

## Decision

Represent exact versioned `LearningProfileCandidate`, `LessonStateCandidate`, `PedagogyDecisionCandidate`, and `AnimationIntentCandidate` records. Learning profiles bind purpose, consent, sensitive-data descriptor, retention policy and isolation-context references without asserting that any is verified. Lesson progress and competency remain evidence references rather than self-certified completion.

Knowledge grounding belongs only to the pedagogy decision. Animation intents bind a presentation-script hash, synthetic disclosure and provenance, but contain no knowledge-grounding source and cannot claim knowledge authority. Identity recognition, biometric capture and live capture request fields must all be exactly false. Structurally complete chains remain blocked pending consent, isolation, grounded knowledge, pedagogy/human review and renderer assurance.

Canonical wire identity is produced only through the schema-ordered `serialize`/`deserialize` path. In-memory snapshots normalize exact own data fields to schema order; callers must not hand-roll a wire representation or treat caller-supplied time as trusted time.

Animation action, visual realism, lip sync, gaze, gesture, expression or synthetic presentation can never elevate evidence authority, authenticate a person, certify competency or authorize an official/safety-critical action. Enabling adaptive instruction or rendering requires a future versioned boundary and explicit privacy/security activation decision.

## Excluded

No learner recognition, biometric processing, camera/microphone capture, speech synthesis, voice cloning, adaptive-learning engine, quiz/exam authority, animation renderer, digital human, persistence, network/filesystem operation or product-specific Academy workflow is introduced.
