# Sinbad Professor Phase 1 — Frozen Baseline

## Decision

- Reality check: `CORE_REALITY_CHECK_V1`
- Decision: `GO`
- Freeze status: `FROZEN`
- Evaluated production commit: `35dc0751ee8fcd62dcd00c6cd5b626e5ef2bcd03`
- Production release: `v8.20.18`
- Evaluation date: `2026-08-22`

This document freezes the verified Phase 1 boundary. It is an acceptance record,
not a claim that the complete Professor engine is finished.

## Included in Phase 1

- Independent, movable, resizable Sinbad Academy browser window.
- Free-form written classroom questions without selecting a predefined topic.
- Browser microphone input when the browser grants permission.
- Captain Sinbad idle, thinking, speaking, listening and board-teaching states.
- Browser speech narration with voice enable, stop and replay controls.
- Atlas-authenticated `sinbad-answer` request path through the Core safety envelope.
- Automatically requested, provenance-linked PDF page visuals when matching indexed
  source pages exist.
- Optional and explicitly temporary guided-lesson shortcuts.
- Persisted local Academy conversation history.
- Safe stopping when the Atlas session, workspace, source or Core gate is unavailable.

## Explicitly not included

- Final Academy curriculum or final topic taxonomy.
- Adaptive student model, mastery scoring or personalized lesson sequencing.
- Teacher-authored grading rubrics, examinations, certificates or attendance.
- Guaranteed source visual for every question; a visual requires a matching indexed
  PDF page with provenance.
- A cloned voice, photorealistic 3D instructor or game-engine character animation.
- Autonomous operational authority or replacement of an instructor, master,
  official publication or approved vessel procedure.

## Reality-check evidence

- Unit/integration regression: `647` total, `646` passed, `0` failed, `1` skipped.
- Browser/WCAG regression: `8/8` passed on desktop and mobile Chromium.
- Live Academy probe: chat, free question input, microphone control, animated
  instructor, voice controls, optional topics and Core script all present.
- Supabase `sinbad-answer`: `ACTIVE`, version `17`, `verify_jwt=true`.
- Edge bundle SHA-256: `c024abb61b0fe0f61b49d8dac878d99e0c041ccc881d545a9299012a3e5eb622`.

## Frozen file hashes

| File | SHA-256 |
|---|---|
| `academy.html` | `4246622077b95cb71276e0db9e96a1ba0264d5fb6262f92aa376b412d4ffcac8` |
| `academy.css` | `11485ceccdb967732b5c48104a327f5720469e992ff252223fbdfdc4189af75b` |
| `academy-window.js` | `77d1548433486f5271313816dfb6022a9ee6153a2c016974f587d83465ea9ef8` |
| `sinbad-core.js` | `f4da2aa5e70e75436d497d48441e9ada6d3aefd944f5e71f59ff8578afe3d7b1` |
| `supabase/functions/sinbad-answer/index.ts` | `1ba487a973efbbe8f884fe9f7c3720d2c06fe93109d53ccb198bbccb6514cf63` |
| `supabase/functions/sinbad-answer/core-decision.js` | `016d89dec3aeac09f0540d0b1b9f1323ed76d4b11593fa5a020a7a68b9de2585` |

Hashes are calculated from UTF-8 text with line endings canonicalized to LF so
the same frozen source verifies on Windows and Linux.

## Change rule

The immutable Git tag created from the accepted freeze commit is the Phase 1
reference. Later Professor work must use a new branch/version. Phase 1 files may
evolve on `main`, but the frozen tag and this evidence record must never be
rewritten or force-moved.
