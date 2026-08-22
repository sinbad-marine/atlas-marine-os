# Sinbad Professor Phase 2 — Frozen Baseline

## Decision

- Reality check: `professor-phase-2-reality-check.json`
- Decision: `GO`
- Freeze status: `FROZEN`
- Evaluated commit: `9c12111e2813532cf5b728dd8cbfa405a8f97c2c`
- Evaluation date: `2026-08-23`

This record freezes the verified adaptive Professor layer. It does not claim
that the final curriculum, complete Professor product, or embodied instructor
has been completed.

## Included

- A separately resizable Professor workspace composed around frozen Phase 1.
- A bounded, local learner profile that excludes chats, voice and documents.
- Optional six-question diagnostic assessment.
- Deterministic, prerequisite-aware study recommendations.
- Reflection prompts only after completed Sinbad answers, never safe stops.
- Topic-linked knowledge checks before mastery can change.
- Separation of mastery evidence from observation-only learner actions.
- Evidence-only spaced review with actionable due-review controls.
- Strict local backup/restore, evidence ledger and explicit local reset.
- Desktop/mobile browser, accessibility, mojibake and console-error gates.

## Partial inherited capability

Live model answers and provenance-linked source visuals remain dependent on a
valid Atlas/Supabase session, workspace and deployed Edge Function. The freeze
does not represent those external dependencies as locally guaranteed.

## Explicitly excluded

- Final maritime curriculum and final topic taxonomy.
- Certification, licensing or competency endorsement.
- Cloud-synchronized learner profiles.
- Automated mastery inference from chat, voice, face, gesture or lesson opening.
- A rigged 3D instructor or improvisational gesture/action engine.
- Replacement for approved instructors, simulators, official publications or
  operational decision processes.

## Verification evidence

- Unit/integration regression: `680` total, `679` passed, `0` failed, `1` skipped.
- Browser/WCAG regression: `10/10` passed on desktop and mobile Chromium.
- The Phase 1 freeze hash test remains part of the complete regression suite.
- The Phase 2 reality-check and freeze tests bind the exact tested files.

## Frozen file hashes

| File | SHA-256 |
|---|---|
| `academy-professor.html` | `97bd5fdee8b5ab34b48b9316e059648d9f848133b31cadcb66d1e9fbc03f3ff4` |
| `academy-professor.css` | `96ae6c21a736ae99680b8205f5eb44071a3362da4192b95dd3e48bb8b22a8ef4` |
| `academy-professor-guidance.css` | `439bf3ce1e0876d6cf3f58e20412a9ccaeab5f092f4fb28ae8d25c7fbf2d38d0` |
| `academy-professor.js` | `ffab18d2bf0bd1478fed209d8d0d46ab28131dbeeca717347cadc67bb91fd223` |
| `sinbad-professor.js` | `e5da5b8f8d440357a38b736f8f4a150d207369474216bf2fdb5958f502531b4c` |

## Change rule

The local annotated tag created from the accepted freeze commit is the Phase 2
reference. Future Professor or embodied-instructor development must occur on a
new branch/version. This record, its hashes and the tag must never be rewritten
or force-moved.
