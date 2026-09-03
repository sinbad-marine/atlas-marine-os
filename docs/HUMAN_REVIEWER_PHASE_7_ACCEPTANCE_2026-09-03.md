# Human Reviewer System — Phase 7 acceptance checkpoint

## Decision

**REVISE before production release.** The scoped Human Reviewer implementation is complete and its focused gates pass. Production release remains closed because the repository-wide web gate has three repeatable failures outside the Human Reviewer files, and no verified production backup/restore rehearsal or two-reviewer canary has been performed.

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
- Repository `npm run test:web`: 81 passed, 3 failed. Human Review passed in both projects. The failures repeated in existing unrelated tests: desktop/mobile hands-free Professor remained in “Sinbad düşünüyor” while waiting on its unstubbed response path; mobile dashboard-card smoke timed out. A focused rerun also exposed the dashboard-card timeout on desktop.
- Migration rollback test: mutation execute privileges removed while package evidence remained present.

## Remaining production gates

1. Repair or independently clear the unrelated repository-wide web failures without changing Human Review semantics.
2. Create and verify a production backup, restore it into an isolated environment, apply the migration, run checkpoints and test the evidence-preserving rollback.
3. Deploy the function with the exact production origin allowlist and run authenticated Owner/two-Reviewer smoke tests.
4. Release the Pages artifact only through `.github/workflows/pages-release.yml` after required checks pass.
5. Run a synthetic 25-question canary, record its audit evidence, then enable real immutable manifests.

Until all five gates pass, the system must not be described as live or production-complete.
