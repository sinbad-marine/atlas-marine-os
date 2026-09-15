# Owner-private Academy training path (pilot)

Owner Limited Implementation GO, 2026-09-14. Scope: the minimum path for the Owner to study and answer the existing PILOT-001 question (`ISM-M1-EL2-Q001`, live Human Review package `b513867b-e4e2-4be1-9595-7a123f8bf792`) without routing the Owner's own training through the Human Review reviewer workflow, and without changing what any Human Review state means.

## Access model (unchanged principles)

- Academy is private: OWNER + Owner-approved invited users. No public registration, no anonymous Academy access, no commercial features.
- CONTENT GOVERNANCE and TRAINING ACCESS are separate concepts:
  - `verification_stage` keeps its meaning. `HUMAN_REVIEW_ACCEPTED` still means real Human Review plus Owner governance happened. A new truthful value, `TECHNICALLY_VERIFIED`, is used only for questions copied verbatim from a Human Review package row whose `technical_status` is `TECHNICALLY_VERIFIED`.
  - `training_scope` (new column on `academy_ism_questions`) decides who may train on a row: `NONE` (default) or `OWNER_ONLY`. Invited-user scopes are deliberately not implemented in this pilot (HOLD).
- MERGED != OWNER ACCEPTED != HUMAN REVIEW VERIFIED; Owner training on PILOT-001 is NOT a Human Review pass and does not authorize question generation (Hat D HOLD).

## What was added (additive only)

1. `supabase/migrations/20260914000100_academy_owner_private_training.sql`
   - `academy_ism_questions`: `training_scope`, `training_promoted_by`, `training_promoted_at`, `source_content_sha256`; `verification_stage` check list widened with `TECHNICALLY_VERIFIED`; index on `(workspace_id, module_code, training_scope)`.
   - Policies: the active Owner reads `OWNER_ONLY` rows in their workspace (questions and the linked source manifest rows). The existing "members read accepted questions" policy is untouched.
   - `academy_ism_owner_promote_training(workspace, actor, package, question_id, request_id)` - service_role only; requires active Owner; reads the Human Review package/question (must be `TECHNICALLY_VERIFIED`); copies content and provenance (evidence sourceId -> source manifest `source_id`, `review_package_id`, `source_content_sha256`, promoted-by/at); idempotent per question; never writes Human Review tables or audit.
   - `academy_ism_submit_attempt(workspace, question_row_id, response)` - authenticated; verifies membership and training visibility (`OWNER_ONLY` needs the Owner role; `HUMAN_REVIEW_ACCEPTED` any active member); marks the answer server-side from `marking_rubric`; inserts exactly one `academy_ism_attempts` row; returns correctness, score, correct key and reasoning. Attempts stay private per user (existing RLS); no update/delete.
2. `supabase/functions/academy-training/index.ts` - one action, `promote_owner_training`: exact origin (`ACADEMY_TRAINING_ALLOWED_ORIGINS`, falls back to `HUMAN_REVIEW_ALLOWED_ORIGINS`), bearer JWT, server-derived identity, active Owner, AAL2 + consumed founder step-up (`identity.academy.training_promote`), then the RPC above.
3. `academy-owner-training.js` + a hidden `#academyOwnerTraining` panel in `academy.html` (shown only for the `ism-code-foundations` module). Loads the Owner's `OWNER_ONLY` questions under RLS, renders prompt and choices, submits through the RPC, shows the server result, lists the Owner's own attempts, and offers the Owner-only promotion form (package id + question id, step-up gated). The client never selects `correct_answer` or `expected_reasoning`.
4. Tests: `tests/academy-owner-private-training-database.test.js` (PGlite, real migrations, the real PILOT-001 manifest through the real import function), `tests/academy-training-edge.test.js`, `tests/academy-owner-training-ui.test.js`.
5. Mastery/readiness: NOT YET CALCULATED for this pilot (no calculation engine exists; tables untouched).

## Production rollout (Owner-operated; no credentials exist in the agent environment)

1. Apply the migration to the production project (`supabase db push` from a machine with the linked project, or run the SQL in the SQL editor). It is additive and idempotent.
2. Deploy the function: `supabase functions deploy academy-training` and set `ACADEMY_TRAINING_ALLOWED_ORIGINS=https://sinbad-marine.github.io` (or rely on the existing `HUMAN_REVIEW_ALLOWED_ORIGINS`).
3. Merge the PR so the Pages release publishes `academy.html` and `academy-owner-training.js` (allowlisted).
4. In the classroom: ISM / ISPS / MLC -> ISM Code foundations -> "Owner · Human Review paketinden özel eğitime aktar": package `b513867b-e4e2-4be1-9595-7a123f8bf792`, question `ISM-M1-EL2-Q001`, AAL2 code -> "Eğitim sorularımı yükle" -> answer -> "Cevabı gönder".

## Second pilot question (Owner Limited GO "SECOND PILOT QUESTION ONLY", 2026-09-14)

- `docs/academy/ism-master-source-manifest/PILOT-002-second-question-package.json`: one question, `ISM-M1-EL4-Q002`, grounded verbatim in the verified Element 4 entry (`IMO-ISM-A741-18-EL4`, verifiedBy GROK + GEMINI + PRIMARY_SOURCE_CROSSCHECK, no amendment identified). Own Human Review package identity (`ISM-M1-EL4-PILOT-Q2`, revision `PILOT-002-2026-09-14`); hashes computed with the real manifest builder; validated with the real payload contract; imported and promoted next to Q001 in PGlite (`tests/academy-owner-second-question-database.test.js`). Not bulk generation.
- Classroom panel now walks all of the Owner's `OWNER_ONLY` questions in order (progress "Soru n / N", previous/next, "Sonraki soruya geç" after a recorded attempt), resumes at the first unanswered question on reload, and lists attempts per question.
- UX corrections from the Owner's live test report: promotion form open by default with the last package/question ids remembered locally; panel measured against the chalkboard and laid below its title (placeholder chalk line hidden while active); board title reads "Owner özel eğitim modu"; status line inside the panel.

## Acceptance evidence (live Owner run, 2026-09-14, production)

Live code: main `7a4d06e` (PR #245) on Pages; `academy.html` sha256 equals `config/ui-design-contract.json`. All production facts below were read with read-only queries; the agent never held credentials and never clicked a gated button.

| Step | Evidence | Result |
|---|---|---|
| PILOT-001 import (Owner, Owner Console) | package `b513867b-e4e2-4be1-9595-7a123f8bf792`, `ISM-M1-EL2-PILOT-Q1`, AVAILABLE, lock 0, 06:09Z | PASS |
| PILOT-002 import (Owner, Owner Console) | package `9bf9d8d3-db60-4369-90ef-2e1bfa7c9c83`, `ISM-M1-EL4-PILOT-Q2`, AVAILABLE, lock 0, 20:47Z; `human_review_audit` PACKAGE_IMPORTED by OWNER; package and question hashes equal the repository manifest (`2202205e…`, `c37071c9…`) | PASS |
| Q001 promotion (classroom, edge function) | training row `e3555f88-348f-487e-b06b-48a0f82395fb`, OWNER_ONLY, TECHNICALLY_VERIFIED, promoted 19:48Z | PASS |
| Q002 promotion (classroom, edge function) | training row `712624ff-97d9-48e0-8617-950e2de9b708`, OWNER_ONLY, TECHNICALLY_VERIFIED, `source_content_sha256` == package question hash, promoted 20:59Z; 2 rows, 2 distinct question ids, no duplicate | PASS |
| AAL2 enforcement on import/promotion | Read-only evidence review 2026-09-15 (Owner Limited GO): the Owner session (`cf8e8223`) was at AAL2 after a TOTP challenge verified 06:09:23Z; the step-up issuer checked the JWT AAL level server-side; the package-import and academy-training functions each enforced AAL2 again; every gated operation (PILOT-001 import, Q001 promotion, PILOT-002 import, Q002 promotion) consumed its own nonce-bound, command-bound, session-bound, 5-minute, single-use step-up authorization; no rejected step-up in the sequence. See "AAL2 semantics" below. | VERIFIED |
| Classroom refresh UI state | after browser refresh the selected training module reset to General Maritime Education; data and attempts persisted once section/module were reselected | UI-STATE ISSUE (follow-up) |
| Q001 attempt | `ef3549cf-dc88-4449-84c7-af61e2eec605`, key A, correct, score 1, 19:51Z | PASS |
| Q002 attempt | `2791b25a-d0a3-495c-b1d2-22c74573546f`, key A, correct, score 1, 21:03Z | PASS |
| Reload | classroom showed "2 özel eğitim sorusu yüklendi · cevaplanan 2/2", "Soru 2 / 2" (Q002) and "Soru 1 / 2" (Q001) each with its attempt listed | PASS |
| Human Review unchanged | no review/transfer/finalize audit rows for either pilot package; canary still OWNER_ACCEPTED lock 29; 0 rows HUMAN_REVIEW_ACCEPTED | PASS |
| Owner-only access | foreign authenticated user and anon see 0 training questions, 0 attempts, 0 source manifest rows | PASS |
| Mastery / readiness | not calculated (no engine) | OUT OF SCOPE |
| Owner acceptance | no acceptance statement recorded | NOT RECORDED |

Owner decision (2026-09-15): the core Q002 Owner-private training test is accepted as PASS. The AAL2 finding was closed on 2026-09-15 by the read-only evidence review recorded above and in `PROJECT_STATE.json` (`owner_private_training_pilot.aal2_evidence`). The classroom refresh UI-state finding remains an open follow-up, deliberately not fixed in a documentation/state PR.

### AAL2 semantics (recorded 2026-09-15)

- **AAL2 ENFORCEMENT VERIFIED does NOT mean NEW TOTP PROMPT REQUIRED FOR EVERY OPERATION.** The live Owner session had already been elevated to AAL2 following the 06:09Z TOTP verification, so the client (`founder-owner-ui.js` `verify()`) correctly skipped a new 6-digit prompt while that session remained AAL2. This is consistent with the current implementation.
- **Three separate controls:** session AAL2 state; the TOTP challenge/prompt; the per-operation single-use step-up authorization. Gated operations still use separate step-up authorizations (issued by `founder-owner-step-up` after its own JWT AAL2 check, consumed by the target function after its own JWT AAL2 check) even when no new TOTP prompt is shown.
- **Not implemented, not claimed:** mandatory TOTP re-entry for every gated action; an Owner-defined AAL2 freshness / re-authentication interval. Either would require a separate Owner GO and an implementation change.

Flow note: Q001 was promoted and answered during the Owner's first live test (before PR #245 went live), so the second-question run proceeded Q002 import → promotion → answer → reload, and the classroom resumed at Q002 as designed. STOP applies after this run: no third question, no bulk generation, Hat D HOLD, invited users HOLD.
