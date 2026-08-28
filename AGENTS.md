# Sinbad Marine protected-change rules

The repository has one coordinated release path. Do not treat another agent's branch, an old screenshot, a local preview, or a cached page as the current design.

## Required workflow

1. Work on a `codex/` branch. Never push directly to `main`.
2. Read `config/ui-design-contract.json` before changing `index.html`, `academy.html`, their CSS, navigation, or release files.
3. Preserve unrelated working-tree changes and untracked user assets.
4. Run `npm test` and `npm run test:web` before proposing a merge.
5. Release only through `.github/workflows/pages-release.yml` after required checks pass.

## Golden design protection

- Files under `tests/browser/__screenshots__/` are approved product baselines, not disposable test output.
- Never run `npm run test:web:update-golden` merely to make a failing test pass.
- Update golden images only when the user explicitly approves the visible design change; include the changed images in the same PR.
- Passage plan, Sources, and Sinbad tools are retired from Captain Sinbad. Do not restore their tabs, panels, or menu without an explicitly approved product decision.
- The dashboard and Captain Sinbad must both retain their Academy entrances.

## Recovery

Follow `docs/RELEASE_RECOVERY.md`. Prefer redeploying an exact known-good commit over reconstructing an old design by hand.
