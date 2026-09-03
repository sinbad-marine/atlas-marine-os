# Human Reviewer System — Phase 1 Architecture

## Scope

This design extends the existing authenticated `exam-review` surface and Supabase workspace identity. It does not change GASM extraction, source content or production workflow. Human review consumes a versioned immutable manifest after the GASM team has produced it.

`config/human-review-contract.json` is the normative contract for implementation and tests.

## Authority model

`OWNER` remains a current active workspace Owner and retains final authority. `HUMAN_REVIEWER` is a separate, narrowly scoped authorization attached to an existing Supabase user and workspace. It is not an alias for `developer` and grants no contribution, library administration, deployment, GASM or Owner power.

Owner uses the existing member system to invite and activate the underlying account. A new reviewer authorization record controls Human Reviewer access independently. Suspending either the workspace membership or reviewer authorization denies the next protected action. Reviewer authorization, revocation, forced reclaim/transfer and Owner finalization use the established Owner step-up boundary.

## State separation

Each question carries three independent dimensions:

1. upstream technical/extraction state, immutable in this subsystem;
2. Human Review decision and attributable history;
3. Owner final decision and attributable history.

An import creates only dimension 1 plus `PENDING` Human/Owner states. No trigger or bulk helper propagates a technical pass into Human Review. Human approval does not set Owner acceptance.

## Package lifecycle

Packages use approved sizes 25, 50, 100 or 250. The import records expected, present, missing and deferred counts. `packageComplete` is computed by the database from all four values and is never accepted from a browser.

`AVAILABLE → ASSIGNED → IN_REVIEW → SUBMITTED_COMPLETE|SUBMITTED_INCOMPLETE` is the normal path. Owner may return an item, accept a complete submission, reclaim it to `AVAILABLE`, transfer it to another reviewer or cancel it. Incomplete submissions remain visibly incomplete and cannot be Owner-accepted as a complete package.

## Concurrency protocol

The package row is the serialization boundary. Every mutation locks it with `FOR UPDATE` and binds the command to workspace, package, authenticated actor, assignment generation, expected lock version and an idempotency UUID.

- Claim succeeds for only one competing reviewer.
- Every assignment, reclaim or transfer increments `assignment_generation`.
- Every state or question mutation increments `lock_version`.
- A former assignee's generation is rejected even if their browser reconnects later.
- A stale version is rejected with a conflict and the client reloads the authoritative snapshot.
- Repeating the same idempotency key returns the recorded result without a second mutation.
- Transfer retains all question decisions, notes and audit events.

## Minimal data model

- `human_reviewer_authorizations`: reviewer identity and lifecycle.
- `human_review_packages`: source binding, completeness, assignee, generation, version, progress and lifecycle.
- `human_review_package_questions`: immutable package ordering and source/evidence payload.
- `human_question_reviews`: current Human decision materialization.
- `human_review_audit`: append-only event stream with previous/new state and request ID.

Direct anonymous/authenticated table mutations are denied. A same-origin Edge Function authenticates the token and calls service-only transactional RPCs. Read functions apply workspace plus Owner/assigned-reviewer authorization. Audit events use database time and the authenticated server-supplied actor.

## Scale and retrieval

Package dashboards use keyset pagination and indexed workspace/status/assignee columns. Questions use package position as the cursor. The default page contains 25 items and the server caps it at 100. Progress is returned from package counters; no route returns the entire question bank.

Search is bounded to normalized question reference/text fields with an indexed strategy selected after production-shaped query-plan testing. Evidence images remain referenced by authorized storage identities; payloads never contain service credentials or arbitrary HTML.

## Migration safety

The implementation migration will be additive. Before production application:

1. capture schema, row-count and invariant checkpoints;
2. restore or clone production-shaped data into an isolated database;
3. apply the migration and run concurrency/security/scale tests;
4. exercise rollback without removing historical source/review evidence;
5. reapply and compare checkpoints;
6. deploy functions before enabling the UI;
7. run a small two-reviewer canary package.

No production migration is authorized merely by this architecture document.

## Implementation slices

1. Add tables, indexes, immutable audit and transactional RPCs.
2. Add authenticated Edge API with stable error codes and bounded reads.
3. Add Owner reviewer controls by minimally extending existing Settings.
4. Extend `exam-review` into package and question views without changing unrelated Owner Console surfaces.
5. Add native database concurrency tests, authorization abuse tests, 30,000-question query-plan tests and desktop/tablet/mobile browser coverage.
6. Perform backup/restore migration rehearsal and controlled acceptance.
