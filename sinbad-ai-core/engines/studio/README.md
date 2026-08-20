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

`persisted-workspace-verifier.js` re-verifies a written sandbox project against
that process-local static report. It requires the exact expected file set and
matching byte counts and SHA-256 hashes, and rejects redirected roots, symbolic
links, junctions and special filesystem entries. It only reads files: it does
not render or execute generated content, write changes, access a network or
grant preview/publish authority. A clean result is evidence for a later,
scriptless local-preview packaging gate.

`scriptless-preview-packager.js` rechecks every selected persisted file against
the bound verification report, excludes JavaScript, removes HTML script tags,
and injects a restrictive offline Content Security Policy. It returns a new
immutable package in memory only. It neither writes nor opens the preview and
does not expose execution, rendering, network, deployment or publish methods.

`scriptless-preview-writer.js` is the separate persistence boundary for that
package. A short-lived, single-use authorization is bound to one authentic
package and one manifest. The writer atomically creates a new project beneath
the exact `studio-previews/` root, refuses overwrite and redirected roots, and
rechecks all artifact hashes before writing. It never opens a browser, renders,
executes, connects or publishes the preview.

`guided-studio-session.js` joins the gates into one finite offline workflow. It
guides the caller from a brief to a verified draft, requests the exact sandbox
and preview-write approvals at the correct stages, and reports a concrete next
action when input, policy or integrity blocks progress. It never weakens the
underlying process-local authenticity boundaries and still exposes no command,
browser-open, model/network, Core-write or publishing capability.

`studio-acceptance-manifest.js` freezes the finite Studio 0.1 acceptance scope.
It distinguishes implemented offline draft/verification/preview capabilities
from prohibited actions and honest limitations. In particular, this foundation
uses deterministic bounded templates; it is not itself a local language model.
Grok, Gemini and Claude cannot operate offline, and any future local-model or
explicit online-review adapter remains a separate product and authorization
decision.

## Pro 0.2 foundation

`local-model-protocol.js` begins the Pro boundary without installing or calling
a model. It accepts only explicit HTTP loopback endpoints on an allowlisted API
path, validates bounded model identity and prompt fields, and normalizes common
local-provider response shapes as untrusted `DATA_ONLY` drafts. The module has
no transport, shell, installer or downloader. A real localhost connection must
remain behind a later explicit authorization and timeout boundary.

`local-model-loopback-gateway.js` implements that next boundary without bundling
a network client. An injected transport can be invoked once only after a short-
lived authorization bound to one authentic request, endpoint and model. The
gateway enforces timeout, HTTP/JSON and wire-size checks, consumes authorization
before transport, and marks every result untrusted `DATA_ONLY`. It cannot reach
a remote host because the authenticated protocol request is loopback-only.
