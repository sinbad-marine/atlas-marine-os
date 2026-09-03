# Human Reviewer System — Phase 7 acceptance checkpoint

## Decision

**REVISE before production release.** The scoped Human Reviewer implementation is complete, the coordinated CI gate is green and the production-backup restore/migration/rollback rehearsal passes. Production release remains closed until the Edge Function is deployed with the production allowlist and an authenticated Owner/two-Reviewer canary is completed before the Pages release.

## Delivered

- Separate least-privilege Human Reviewer authorization; no Developer, Owner, deployment or GASM authority is inherited.
- Owner AAL2 controls for reviewer activation/suspension/revocation, immutable manifest import, package transfer/reclaim and final accept/return.
- Database-authoritative package lock, assignment generation, optimistic lock version and idempotency request ID.
- Packages of 25, 50, 100 or 250 with authoritative expected/present/missing/deferred completeness.
- Independent technical, Human Review and Owner decision states.
- Assigned-package IDOR protection, bounded keyset pagination, safe DOM output and exact-origin Edge access.
- Immutable audit history and preservation of prior work after transfer.
- Existing answer-key review retained beside the package workflow.
- Desktop, tablet and mobile responsive review surface.
- Read-only checkpoint SQL, evidence-preserving emergency rollback and controlled release runbook.

No GASM workflow, question source, production database, live Edge Function or Pages release was changed.

## Verification evidence

- Focused Node suite: 25 passed, 0 failed.
- Hosted Human Review browser suite: 2 passed, 0 failed (desktop and mobile).
- Native PostgreSQL 18.4: simultaneous claim had exactly one winner; transfer preserved work; former reviewer stale save was rejected; 30,000-question fixture used bounded indexed package paging; disposable server stopped.
- Repository `npm test`: 1,962 passed, 0 failed, 1 skipped.
- Local repository `npm run test:web`: 81 passed, 3 failed. Human Review passed in both projects. The failures repeated in existing unrelated tests: desktop/mobile hands-free Professor remained in “Sinbad düşünüyor” while waiting on its unstubbed response path; mobile dashboard-card smoke timed out. A focused rerun also exposed the dashboard-card timeout on desktop.
- Coordinated GitHub Release quality workflow run `33805271270`: passed in full after making the optional PGlite check explicitly skip when that runtime is absent; job `100814139244` completed successfully in 6m24s.
- Supabase backup rehearsal: production backup `02 Sep 2026 23:47:51 (+0000)` restored successfully into isolated Frankfurt project `atlas-human-review-rehearsal-20260904` (`paiskgudruamfgzgbrij`). Storage objects/settings and other project-level settings were intentionally outside the database restore scope.
- Isolated migration checkpoint: 5/5 Human Review tables present with RLS enabled; 7/7 mutation functions executable by `service_role`; `anon` and `authenticated` execute grants both 0; completeness/orphan/Owner-actor invariant violations 0.
- Evidence-preserving rollback rehearsal: `service_role` mutation grants changed from 7 to 0 while all 5 tables remained present; re-enable restored the grant count to 7 and the final invariant count remained 0.

## Remaining production gates

1. Provision two dedicated Human Reviewer identities; do not reuse the unused Varol Colak account.
2. Apply the migration to production, deploy the function with the exact production origin allowlist and run authenticated Owner/two-Reviewer smoke tests.
3. Run a synthetic 25-question canary, record its audit evidence and verify transfer/stale-writer behavior before enabling real immutable manifests.
4. Release the Pages artifact only through `.github/workflows/pages-release.yml` after the canary and required checks pass.

Until all four gates pass, the system must not be described as live or production-complete.
