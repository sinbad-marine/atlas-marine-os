# SINBAD Owner Console Human Reviewer System — Phase 0 Audit

**Date:** 3 September 2026  
**Scope:** Owner Console human-review infrastructure only. GASM extraction, verification and production were not changed.  
**Recommendation:** **REVISE**

The current application contains a useful authenticated two-stage answer-key review foundation, but it is not yet a multi-user Human Reviewer system. The safe path is an additive extension that reuses Supabase authentication, workspace membership, Owner administration, protected answer material, decision audit and the hosted review surface. Package ownership, a dedicated least-privilege reviewer role, completeness, optimistic concurrency and scalable retrieval must be added before human review begins.

## 1. Current implementation

The deployed review surface is `exam-review.html` with `exam-review.js` and `exam-review.css`. Hosted Academy opens this same-origin page; a local Academy may instead open the loopback review service. The page restores the existing Supabase session, accepts a workspace ID, calls the `exam-answer-key-review` Edge Function and shows up to 200 answer-key review records.

The implemented decision chain is:

1. an active workspace `developer` may record `approved` or `changes_requested`;
2. an active workspace `owner` may record `approved` or `rejected`;
3. Owner approval is refused unless the Developer state is already `approved`;
4. neither decision publishes directly.

The live database has `exam_answer_key_reviews`, separately protected `exam_answer_key_materials`, and append-only `exam_answer_key_review_audit`. At audit time it contained **0 review records and 0 answer-review audit records**. Workspace identity infrastructure contained 5 members, 4 invitations and 5 member-administration audit events; active roles were 2 Owner, 2 Developer and 1 Visitor. There is no deployed review-package or review-question table.

The repository has two local export concepts but no database ingestion/assignment path connecting them to the hosted review system:

- `export-gasm-owner-review.mjs` describes a 644-question source-page map and an Owner-only answer-key file.
- `export-canon-owner-review.mjs` produces question records with provenance images, `PENDING_OWNER_VALIDATION`, unverified answers and publication blocking.
- `build-academy-gasm-catalog.mjs` builds a public Academy catalog from an external validation directory. The checked-in catalog currently contains 1,379 questions; all have `PENDING_HUMAN_REVIEW`, 1,372 answers are unverified and 7 are merely reported. These labels are data fields, not evidence of completed human review.

The audit workspace is on `codex/exam-hosted-owner-review`, diverged from current `origin/main` and has extensive unrelated uncommitted work. Implementation must begin in a fresh `codex/` worktree from current main and selectively reuse approved files. This audit did not reset, move or modify those existing changes.

## 2. What already exists

- Supabase email/session authentication with persisted and automatically refreshed browser sessions.
- Server-side `auth.getUser()` validation in the answer-review endpoint.
- Active workspace membership checks on every answer-review request.
- Existing Owner invitation, role change, activation/suspension and member audit facilities.
- Owner-only sensitive member changes protected by the existing Founder AAL2 step-up mechanism.
- Allowlisted origins, POST-only behavior, no-store responses and UUID validation in `exam-answer-key-review`.
- A separate answer-key material table with no browser policy and no grants to anonymous/authenticated clients.
- Workspace-scoped review metadata and RLS read policies.
- Service-only transactional decision functions.
- Database enforcement that Owner approval follows Developer approval.
- An immutable update/delete trigger on answer-review audit rows.
- Individual actor IDs and server timestamps on decisions.
- Notes limited to 2,000 characters.
- Safe DOM rendering of review data with `textContent` and `JSON.stringify` rather than HTML insertion.
- Basic responsive CSS that changes the two-column review layout to one column below 800 px.
- A protected Pages release path and existing desktop/mobile browser-test infrastructure.

Focused existing tests passed **14/14** during this audit. They verify the hosted/loopback launcher, authentication/origin/role checks, protected answer material, separate Developer and Owner decisions, and the no-direct-publish rule.

## 3. What can be reused

Reuse the following boundaries rather than creating a second identity system:

- Supabase Auth identities and `workspace_members` as the account and workspace root.
- `workspace_invites`, `manage-members`, `member_admin_audit`, active/suspended status and last-Owner protection.
- Founder AAL2 step-up for high-impact Owner actions such as reviewer authorization, revocation and forced reassignment.
- The `exam-review` same-origin authenticated surface and its responsive visual language.
- `exam_answer_key_materials` as the protected answer-material pattern.
- The transactional RPC pattern and immutable audit pattern.
- Existing canonical question identifiers, provenance fields and source images from approved upstream exports.
- Existing canonical technical statuses. Human decisions must be stored in separate columns/tables and must never rewrite them.
- Existing protected release workflow and browser projects.

The existing `developer` role must not be relabelled as Human Reviewer. Developer currently carries broader contribution and private-library abilities. A dedicated reviewer permission or role is required.

## 4. Missing components

The following required capabilities do not exist:

- a dedicated `human_reviewer` role or equally narrow server-side permission;
- Owner reviewer roster with reviewer-specific state, current package, progress and last review activity;
- package records and package membership;
- supported package sizes such as 25, 50, 100 and 250;
- Owner assignment, reviewer claim, reclaim, transfer and reassignment;
- authoritative assignee, assignment generation and package state;
- stale-write protection and idempotent submissions;
- preservation of work across transfer with invalidation of the former assignee;
- question-level Human Review decisions distinct from Developer/technical and Owner states;
- `SOURCE PROBLEM / HOLD` as a Human Review outcome linked to actual evidence;
- revision/history records for each question decision and note;
- expected/present/missing/deferred counts and authoritative package-complete state;
- question text, options, provenance, page/image, warnings and revision history in the hosted review UI;
- package and question pagination, filtering and search;
- aggregate Owner progress reporting;
- reviewer activity/assignment audit events;
- rate limiting or abuse quotas;
- tested offline/reconnect behavior;
- tested mobile/tablet Human Reviewer workflow.

The existing review page only handles answer-key JSON. It lists at most 200 newest records, has no cursor, search, filters or package view, and cannot safely represent a 30,000-question program.

## 5. Database and migration impact

Use additive, backward-compatible migrations. Do not migrate production question data until a backup, test migration, rollback rehearsal and count/invariant comparison pass.

Minimal new data model:

1. `human_reviewer_authorizations`: workspace, user, active/suspended/revoked state, authorized-by, timestamps and optional bounded permissions. This avoids granting the existing Developer capabilities. If the workspace role enum is extended, treat the enum migration and every role allowlist as a coordinated compatibility change.
2. `human_review_packages`: immutable package identity/source revision, expected/present/missing/deferred counts, authoritative completeness flag, status, assignee, `assignment_generation`, `lock_version`, assigned/claimed/activity/submitted timestamps.
3. `human_review_package_questions`: package/question position and immutable source revision/hash. Unique package/question and package/position constraints.
4. `human_question_reviews`: current materialized decision per package/question with reviewer, decision, note, source revision, assignment generation and lock version.
5. `human_review_audit`: append-only events for authorization, assignment, claim, save, decision, submission, reclaim, transfer, revocation and Owner override, including previous/new state and assignment generation.

All mutations should be service-only RPCs or Edge Functions that authenticate the bearer token, check current authorization, lock the package row with `FOR UPDATE`, compare assignment generation and expected lock version, perform the state change and append its audit event in one transaction. A former reviewer save must return a conflict without changing data. Duplicate client requests need a unique idempotency key scoped to actor and operation.

Indexes should cover workspace/status, workspace/assignee/status, package/position, package/question, reviewer activity time, review decision, source identity/revision and audit package/time. Counts must be maintained transactionally or derived from indexed rows; the browser must never load the entire bank.

The GASM team should deliver only a versioned, immutable import manifest at the existing boundary. The Human Reviewer subsystem should ingest it idempotently into staging/package tables while preserving upstream technical state and evidence. No extraction logic needs modification.

## 6. Security risks

### Critical before rollout

- `developer` is currently the answer reviewer. It is not least privilege and also has contribution/private-library abilities.
- Every active Developer can list every workspace answer review and retrieve its protected answer material. There is no assignment-level authorization.
- No server-side package authorization exists because packages do not exist.
- No version/generation token protects a decision from stale or transferred reviewers.

### High

- Owner finalization uses normal authenticated Owner membership but no fresh AAL2 step-up. Final Human Review acceptance and forced transfer/reclaim should use the established Founder/Owner step-up where policy requires it.
- The endpoint returns raw database error messages for several failures. Map these to stable safe reason codes and keep detailed errors server-side.
- There is no endpoint rate limiting or bounded per-user mutation quota.
- Authorization and answer-material retrieval are separate calls; revocation can race the privileged read. Use an authorization-aware transactional/read function or repeat authorization immediately at the data boundary.

### Existing protections

Classical CSRF risk is reduced by bearer-token APIs plus the answer endpoint's exact origin allowlist. This does not replace XSS prevention or server authorization. The UI's safe text rendering should be retained. The wildcard CORS configuration on older member/contribution functions should not be copied into the reviewer API.

## 7. Concurrency risks

The current Developer decision RPC updates without a prior row lock or expected version. Two decisions can become last-write-wins while both are logged. Owner finalization locks the row, but a concurrent later Developer update can reset a completed Owner decision to pending. There is no duplicate-submission key.

For packages, the required authoritative rule is:

`workspace + package + current assignee + assignment generation + lock version`

Every claim/assign/reclaim/transfer/save/submit RPC must lock the package, verify this tuple and atomically increment the generation/version. Transfer preserves existing reviews and history but invalidates all commands carrying the old generation. Reconnect reloads the authoritative server snapshot. A save conflict must be explicit and must never merge or overwrite silently.

The existing terminal-delivery subsystem contains lease/idempotency design ideas, but it is a separate domain. Its tables or authorization must not be reused directly; only the proven transaction pattern should be adapted.

## 8. Proposed minimal implementation plan

### Phase 1 — contracts and safe baseline

- Start a fresh `codex/` worktree at current main.
- Freeze canonical state vocabulary and the mandatory invariant: technical status, Human Review status and Owner final status are separate.
- Define the import manifest, package lifecycle, transition matrix and authorization matrix.
- Create backup/count/invariant and rollback scripts before production migration.

### Phase 2 — reviewer authorization

- Add dedicated reviewer authorization and Owner controls by extending the existing Settings member UI minimally.
- Enforce current active reviewer authorization server-side for every read/write.
- Use Owner AAL2 step-up for authorize, suspend, revoke and sensitive recovery actions.

### Phase 3 — packages and concurrency

- Add package, package-question, current review and audit tables plus required indexes.
- Implement transactional claim/assign/reclaim/transfer/save/submit RPCs with generation, version and idempotency checks.
- Preserve work and reject all former-assignee writes after transfer.

### Phase 4 — Human Reviewer workflow

- Extend the existing hosted review surface with paginated package list, one package at a time, question navigation, evidence/provenance display and APPROVE / CORRECTION REQUIRED / SOURCE HOLD decisions.
- Keep all upstream technical fields read-only and visually separate.
- Save per question; support reconnect by reloading authoritative progress.

### Phase 5 — completeness and Owner oversight

- Enforce expected/present/missing/deferred counts on package submission.
- Show overall package/reviewer progress and append-only history to Owner.
- Keep Owner final acceptance distinct and protected.

### Phase 6 — security, scale and mobile verification

- Run database concurrency tests, authorization abuse tests, query plans at 30,000-question scale and desktop/tablet/mobile browser tests.
- Verify no secret/evidence leakage, bounded queries, safe errors and revocation behavior.

### Phase 7 — controlled acceptance

- Restore a production-shaped backup into an isolated database, apply/rollback/reapply migrations and compare counts/invariants.
- Deploy additively, create a small canary package, run two real reviewer accounts through transfer/stale-save acceptance, then allow wider review.

## 9. Test plan

### Database and concurrency

- Two reviewers concurrently claim one available package: exactly one succeeds.
- Reviewer A saves, disconnects; Owner reclaims and assigns to B; A's old-generation save is rejected; B's data remains unchanged.
- Duplicate claim/save/submit idempotency keys create one mutation and one authoritative audit outcome.
- Simultaneous question saves with the same version produce one success and one conflict.
- Transfer retains prior decisions/notes and the full assignment history.
- Missing/deferred questions prevent `packageComplete=true` and package submission as complete.
- Owner override never erases reviewer history.

### Authorization and security

- anonymous, inactive, suspended, revoked, wrong-workspace and unassigned users are denied each read/write action;
- client-supplied role, actor, assignee, counts, completion and Owner status are ignored;
- IDOR attempts with another workspace/package/question are denied;
- reviewer cannot invite users, change roles, administer the system, control GASM or perform Owner final acceptance;
- revoked session is denied on its next server action and cannot finish an in-flight stale transaction;
- malformed IDs, oversized notes, unsafe text and unknown transitions return stable errors without internals;
- exact origin/CORS, bearer validation, rate limits and logs expose no token or secret.

### Scale and UI

- Seed at least 30,000 representative questions and inspect query plans for all list/progress/search paths.
- Verify keyset pagination, indexed filters and bounded payload size; assert no endpoint can return the entire bank.
- Test desktop, iPad/tablet and modern mobile widths for package claim, evidence inspection, notes, decisions, reconnect and submission.
- Run WCAG checks and keyboard/focus tests.
- Preserve existing Owner Console layout and golden screenshots unless a visible change is explicitly approved.

### Data safety and invariant

- Before/after/rollback record counts and hashes for imported source revisions.
- Imports create technical records only; they never populate Human Review or Owner approval actor/time fields.
- Technical pass never changes Human Review state; Human Review never changes Owner final state automatically.
- SOURCE HOLD remains unresolved until real evidence/version changes; no test helper can auto-approve it.

## 10. Recommendation

**REVISE.** Continue to Phase 1 with the additive plan above. Do not open Human Reviewer access or import the 30,000-question bank into the current review tables yet.

The foundation is strong enough to reuse: authenticated sessions, workspace membership, Owner administration, protected material, transactional RPCs, immutable decision audit and responsive hosted UI. The missing package authority, dedicated reviewer permission, completeness model, stale-write defense and scale controls are release-blocking. They can be added without modifying the GASM production workflow or destroying existing production data.

## Audit evidence

- Local focused tests: 14 passed, 0 failed.
- Live aggregate counts: 5 workspace members, 4 invites, 5 member-admin audit events, 0 document submissions, 0 answer-key reviews, 0 answer-review audit events.
- Live schema inspection confirmed only the answer-review tables/functions/policies in this domain; no package/claim table was found.
- Live review indexes cover primary/unique identities, but not package/status/assignee/progress because those structures are absent.
- No production rows were modified. No GASM source, extraction logic, workflow or artifact was modified.
