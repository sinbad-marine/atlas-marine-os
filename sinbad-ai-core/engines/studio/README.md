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

`node-loopback-http-transport.js` is the concrete Node transport for that gate.
It revalidates the endpoint, canonicalizes `localhost` to the numeric loopback
address, permits only bounded POST JSON, honors abort signals, requires a JSON
response and stops reading at the caller's byte limit. It does not follow
redirects and exposes no generic remote client, shell, installer or publisher.

`local-model-artifact-validator.js` treats the returned model text as hostile
until it passes an exact JSON schema, bounded artifact count/bytes, fixed domain
roots, duplicate/traversal rejection and the same static artifact policy used by
the deterministic Studio compiler. A clean proposal remains explicitly
untrusted `DATA_ONLY`, stays in memory, and cannot be written without another
separate authorization boundary.

`local-model-proposal-writer.js` provides that isolated authorization boundary.
It atomically creates a new, never-overwritten project under
`studio-proposals/`, rechecks every artifact hash, and adds a non-executable
evidence marker that labels the material untrusted and not publishable. It does
not merge into `studio-workspaces`, open, execute, connect or publish anything.

`guided-pro-model-session.js` composes the Pro boundaries into a finite state
machine. Model-call approval and proposal-write approval remain separate; an
invalid input, transport failure or policy violation produces a concrete safe
next action. A successful session ends at isolated, untrusted proposal storage
for human review—not execution, merge, Core modification or publication.

For local artifact sessions the protocol requests provider JSON mode, disables
supported reasoning traces, fixes temperature to zero and bounds generation to
1024 tokens. The authorization timeout remains finite (maximum 60 seconds) so
CPU-only local runtimes can complete without creating an unbounded wait.

Verified local-model proposals can also enter the existing scriptless preview
packager. JavaScript is excluded, HTML receives the offline CSP, and a third
single-use authorization is required before `studio-previews/` is created. The
guided Pro session never opens that preview automatically.

`studio-pro-acceptance-manifest.js` freezes the Pro 0.2 completion meaning and
the real local runtime probe observed on 2026-08-21. The runtime observation is
explicitly non-portable. It also records the remaining activation blocker:
generated code cannot execute until a sandbox capable of denying network access
is available; Node's current host permission flags alone are insufficient.

## Pro 0.3 review foundation

`model-proposal-diff-planner.js` compares an authentic verified workspace with
an authentic model proposal after rechecking the exact persisted file set and
hashes. It emits only `CREATE`, `UPDATE`, `UNCHANGED` and `PRESERVE`; deletion is
always denied. The result is a read-only human-review plan and exposes no patch,
write, execution, network or publication capability.

`model-proposal-revision-writer.js` can materialize an approved diff only as a
new atomic project beneath `studio-revisions/`. Before copying it reruns the
read-only planner and rehashes every source file. Existing files absent from the
proposal are preserved, proposed files may update only the derived staging tree,
and the original workspace is never modified or deleted.

`studio-pro-03-acceptance-manifest.js` freezes this finite Pro 0.3 completion
scope and the observed host sandbox gap. Pro 0.3 means authenticated read-only
proposal review plus atomic no-delete derived revisions; it does not mean code
execution, automatic merge, Core modification or publication.
