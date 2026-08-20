# Sinbad Studio Engine 0.1

Sinbad Studio Engine is an offline-first, inert planning boundary for web,
software and animation work. Version 0.1 produces deterministic project plans;
it does not write files, run commands, call a model, access a network, modify
Sinbad Core or publish a result.

The returned contract is always `PLAN_ONLY`. Requests involving production,
Core writes, destructive actions, external model/API use, secrets, personal
data, purchases or subscriptions surface an explicit approval gate. Grok and
Gemini are optional online reviewers and are never offline dependencies.

Future implementation adapters must live outside this module and must preserve
the `SANDBOX_ONLY`, `NO_CORE_WRITE`, `NO_PRODUCTION_WRITE`, `NO_NETWORK`,
`NO_SECRETS`, `NO_PUBLISH` and `HUMAN_REVIEW_REQUIRED` constraints unless a
separate, explicit and auditable authorization boundary grants one exact action.

`virtual-artifact-compiler.js` is the next inert boundary. It can compile a
valid Studio plan into bounded, immutable web, software and SVG/storyboard
artifacts held only in memory. Artifact paths are fixed by the compiler, user
text is escaped at markup boundaries, and the result explicitly reports that
filesystem, network and command I/O did not occur. Persisting these virtual
artifacts requires a future, separate sandbox-write authorization gate.

`sandbox-writer.js` supplies that narrow gate. It accepts only authentic,
process-local virtual bundles and a short-lived, single-use authorization bound
to one bundle. It creates a new project atomically beneath the exact
`studio-workspaces/` root, rejects redirected roots and existing targets, and
never overwrites. It exposes no command, network, Core, production or publish
capability. Authorization is consumed before I/O so a failed or raced attempt
cannot be replayed.

`static-artifact-verifier.js` validates authentic virtual bundles without
rendering or executing them. It enforces extension/media-type agreement,
parses JSON and JavaScript syntax, blocks external network references and
active HTML/SVG/CSS content, and rejects command/runtime capabilities. A clean
bundle receives an immutable per-file SHA-256 manifest and a process-local
authentic static-preview report. The report is evidence for a later gate; it is
not permission to run, publish or connect the generated project.
