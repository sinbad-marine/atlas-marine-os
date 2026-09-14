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

## Acceptance evidence

Recorded in `PROJECT_STATE.json` after the live Owner run. Until then every classification in the Owner's acceptance test is NOT VERIFIED.
