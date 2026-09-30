# SINBAD Post-Merge Lifecycle v0

Status: implemented, tested, **not** Owner-accepted. Nothing here records an acceptance.
Base: `origin/main` `44fd1f34ba89551fb64dfff31013d18a97af8100`. Built as SINBAD **TASK-2** through the accepted Participation Gate v0 (opened, preflight PASS, delegated, then implemented; the result is ingested back through the gate).

## What it adds

The accepted Participation Gate v0 stops its authoritative knowledge of a task at report ingestion. A v0 task in state `CLOSED` means "the agent report was accepted" (**IMPLEMENTATION INGESTED**). It does not mean merged, verified or completed. This extension teaches SINBAD the rest of the lifecycle:

```
OPEN -> PREFLIGHT -> DELEGATED -> INGESTED (v0 CLOSED)
     -> PR_LINKED -> PR_OPEN | MERGED -> POST_MERGE_PENDING -> COMPLETED
     side exits: PR_CLOSED_UNMERGED (terminal), MERGE_CONTRADICTED, POST_MERGE_FAILED, POST_MERGE_BLOCKED (retry possible)
```

Files (all new): `sinbad-ai-core/participation/lifecycle-v0.js` (pure logic), `tools/sinbad-participation-lifecycle.js` (commands, separate shelf, local git observer), `tools/sinbad-participation-github.js` (read-only GitHub observer), `tests/sinbad-participation-lifecycle.test.js`, this document. No accepted file was changed.

## Commands

| Command | What SINBAD does |
|---|---|
| `link-pr --task T --pr N [--claimed-merge-sha S] [--claimed-runs ID,ID] [--claimed-by NAME]` | Associates a PR with an ingested task. Merge and CI statements given here are recorded as **UNVERIFIED claims**. Repeating it for the same PR (for example to correct claims) is allowed before the merge; another PR for the same task, or the same PR for another task, is refused. |
| `verify-merge --task T` | Observes the PR (GitHub, read-only) and, if it was merged, the merge in local git; records the evidence and the outcome. |
| `verify-ci --task T` | Observes the merge **again**, then the post-merge CI on the exact merge SHA; completes the task only if everything is verified. |
| `summary [--out file]` | The v0 Owner summary, unchanged, followed by the task lifecycle section. |

Options: `--root`, `--repo`, `--base-ref` (default `origin/main`). The tool never fetches; run `git fetch` first when a fresh remote state matters.

## Storage

A separate shelf `participation-lifecycle` in the same ledger root (outside the repository), on the existing ARGOS event shelf plus content-addressed bodies in the shared `bodies/` directory. The accepted v0 shelf, reducer, schemas and summary are untouched: the v0 tool never reads the lifecycle shelf and produces the same summary with or without it. Four event kinds: `pr.linked`, `merge.observed`, `ci.observed`, `task.completed`. Every read re-walks the chain and re-hashes every body; a broken chain, missing or tampered body, foreign actor, unknown event kind or a structurally impossible sequence (for example a completion without the evidence it names) fails closed (`LEDGER_INVALID`).

## Observation and verification

Local git (read-only): the merge commit exists, is contained in `origin/main`, how far main moved on, its parents, the files it changed, and whether each such file has the **same blob** at the merge commit as in the ingested result (a squash merge onto a moved main has a different tree but identical file contents). GitHub (read-only, `gh api --method GET`, three allowlisted endpoint shapes: a pull request, the workflow runs of one commit SHA, one workflow run): PR number, state, merged, merge commit, head SHA, base branch; run workflow, id, event, head SHA, status, conclusion.

GitHub is evidence input, not authority. The merge must also be verified locally: GitHub saying "merged as X" is not enough unless git confirms X exists, is in main and carries the delegated content.

## Completion rule

`COMPLETED` is written only by `verify-ci`, in the same command, when all of these hold: the task was ingested (v0) and the PR is linked; the PR head equals the ingested resulting commit; the merge was independently observed and is **observed again in this command**; the merge commit exists locally and is contained in current main; the merged files and blobs equal the ingested result; the repository workflow definitions at the merge commit still trigger exactly the required set (below); every required workflow has at least one `push` run on the **exact merge SHA**, all completed, all `success`; no contradictory evidence (claims included) remains. No observation, no completion.

Required post-merge workflows (Owner decision D2): **Release quality** and **Controlled Pages release**, a constant in the lifecycle module. `verify-ci` reads the workflow files at the merge commit and compares the set of workflows triggered by a push to `main` with the constant; any difference, or a trigger it cannot decide, is `WORKFLOW_SET_DRIFT` and blocks completion. A test runs the same check against this repository's workflow files. Other workflows (for example the scheduled ARGOS assurance) and runs that are not `push` on the merge SHA are recorded separately and never block or unblock completion. Several push runs of one required workflow must all succeed.

## Fail-closed outcomes

| Situation | Result |
|---|---|
| GitHub or local git observation unavailable, run list incomplete, workflow files unreadable | `OBSERVATION_UNAVAILABLE`: recorded, state unchanged, never forward |
| PR head differs from the ingested result, wrong PR number or base, PR not found | `MERGE_CONTRADICTED` |
| merge commit missing locally or not in main; changed files or blobs differ | `MERGE_CONTRADICTED` |
| PR closed without merge | `PR_CLOSED_UNMERGED` (terminal) |
| a CI run (listed or claimed) belongs to another SHA, or a claimed run does not exist | `CONTRADICTED` -> `POST_MERGE_BLOCKED` |
| required workflow missing or still running | `POST_MERGE_PENDING` (retry) |
| required workflow failed, cancelled, timed out | `POST_MERGE_FAILED` |
| workflow set changed | `WORKFLOW_SET_DRIFT` -> `POST_MERGE_BLOCKED` |

## Provenance

`VERIFIED` / `UNVERIFIED` / `CONTRADICTED`. An agent's or operator's merge SHA or run id enters through `link-pr` as an UNVERIFIED claim and stays UNVERIFIED even when it equals what was observed; observed evidence is recorded separately and a claim that differs from the observation is CONTRADICTED and blocks the step until corrected.

## Owner summary

After the unchanged v0 summary: a `TASK LIFECYCLE` section with LIFECYCLE STATE, IMPLEMENTATION INGESTED, PR, MERGED (with every check and its basis), POST-MERGE CI VERIFIED (workflow, run id, event, head SHA, status, conclusion for each run, required and non-required separately), COMPLETED, RETROACTIVE LABEL, and UNVERIFIED CLAIMS. Every line names the event it came from; anything unrecorded is `NOT RECORDED`. A v0 task that was never linked shows `PR: NOT RECORDED`.

## Retroactive honesty

Whether a task's evidence is retroactive is derived from git, not from a flag: the merge is retroactive if it is a proper ancestor of the commit that first added `lifecycle-v0.js` to main. Such evidence is labelled `RETROACTIVE` with the statement that the lifecycle capability did not exist when the task was merged. **Task #1 / PR #311 is not ingested by this change**, nor are BOOTSTRAP-0, PR #309 or PR #310 (Owner decisions D4). Retroactive ingestion of Task #1 needs this capability to be merged, to pass post-merge CI, to be Owner-accepted, and a separate Owner GO.

## Known limitations

- **D1:** an ingested task releases its file claim while its PR may still be open (accepted v0 preflight behavior, unchanged). Another task can be preflighted onto the same files in that window.
- GitHub Actions results cannot be verified cryptographically; the trust placed in the GitHub API is stated, not removed.
- Agent identity and report transport are unchanged from v0 (asserted, manual).
- The tool never fetches and never writes to GitHub; `gh` must be logged in and the merge commit must already be in the local clone, otherwise the observation is unavailable.
- Two shelves exist side by side; consolidating them would change the accepted v0 schema and needs a separate decision.
- Deleting the newest events of a shelf is still not detectable (as in v0).
- The required-workflow list is a constant maintained by the Owner; the drift check makes a mismatch loud, it does not choose the list.

## What SINBAD can do after this phase that it could not do before

Before: SINBAD knew a task only up to report ingestion; PR, merge and post-merge CI verification was done by Claude with `gh` and reported in chat, and a `CLOSED` task looked finished.
After: SINBAD links a task to its PR, independently observes the PR and the merge (GitHub read-only plus local git), verifies post-merge CI on the exact merge SHA against the required workflows, keeps agent claims separate from observed evidence, refuses completion without observation, and reports the whole lifecycle to the Owner from its ledger.

## Holds

Phase 4.3a A2-A6 and Engine Room stay on HOLD. No Engine Room file, `PROJECT2_STATE.json`, `app.js`, `package.json`, ARGOS policy, accepted Participation Gate v0 file or ledger entry was changed.
