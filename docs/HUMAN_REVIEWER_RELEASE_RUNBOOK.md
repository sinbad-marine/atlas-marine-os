# Human Reviewer controlled release

This release is additive and does not modify GASM extraction or production. Do not expose the Pages UI until the database and Edge Function gates below pass.

## Preflight and backup

1. Record the exact release commit and current production migration list.
2. Run `tools/human-review-checkpoint.sql` read-only and save its output with the release evidence.
3. Create a Supabase database backup and verify that it can be selected for restore. A backup job existing in the dashboard is not sufficient evidence by itself.
4. Restore into an isolated project or database and verify the pre-migration counts.

## Rehearsal

1. Apply `supabase/migrations/20260903000400_human_reviewer_system.sql` to the restored copy.
2. Run the focused Node tests and `node tools/human-review-test-concurrency.js`.
3. Run the checkpoint SQL. Every invariant count must be zero and pre-existing relation counts must be unchanged.
4. Insert a synthetic package, exercise claim, transfer, stale-write rejection, submit and Owner return/accept.
5. Apply `supabase/rollback/20260903000400_human_reviewer_system_preserve_data.sql`. Verify the tables and evidence counts remain intact and `service_role` no longer has execute permission on the seven mutation functions.
6. Reapply the grants from the migration and repeat the checkpoint.

## Production order

1. Apply the tested additive migration.
2. Deploy the `human-review` Edge Function with an exact `HUMAN_REVIEW_ALLOWED_ORIGINS` allowlist.
3. Keep the browser entry hidden until API smoke tests pass with an Owner and two dedicated Reviewer accounts.
4. Release Pages only through `.github/workflows/pages-release.yml` after required checks pass.
5. Use one synthetic 25-question canary. Confirm a simultaneous claim has one winner, transfer rejects the former reviewer, audit is visible, and Owner acceptance requires AAL2.
6. Enable real immutable manifests only after the canary evidence is recorded.

If a gate fails, disable the browser entry, undeploy or disable the Edge route, and apply the preserve-data rollback. Do not delete Human Review tables or audit records.
