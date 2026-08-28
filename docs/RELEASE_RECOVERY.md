# Sinbad Marine release protection and recovery

## Normal release

All production changes follow: protected branch → pull request → regression tests → visual golden comparison → allowlisted artifact → GitHub Pages deployment. Local folders and alternate worktrees are never production sources.

The approved UI contract lives in `config/ui-design-contract.json`. Golden desktop and mobile images live in `tests/browser/__screenshots__/` and are reviewed as product assets.

## If the live design looks wrong

1. Stop new merges and record the live URL, release SHA, screenshot, and time.
2. Check `release-manifest.json` on the live Pages site. Its `sourceCommit` identifies the deployed source.
3. Select the most recent successful **Controlled Pages release** run whose visuals were approved.
4. Run **Controlled Pages release** manually from that exact known-good commit/ref. Enter the full commit SHA in `release_ref`.
5. Confirm the workflow reports the same source SHA, passes all tests, and deploys its newly attested allowlisted artifact.
6. Verify the live manifest and the three protected surfaces before reopening merges.

Never copy old HTML/CSS files over the current tree as a rollback. An exact Git commit is the recovery unit.

## Golden update procedure

1. Obtain explicit approval for the intended visual change.
2. Run `npm run test:web:update-golden` on the change branch.
3. Inspect expected images and the Playwright diff output at desktop and mobile sizes.
4. Commit code, contract, and golden changes together.
5. Merge only after the normal browser suite passes without snapshot update mode.
