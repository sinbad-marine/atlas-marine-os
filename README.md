# Sinbad Marine v8.20.13

Sinbad Marine is an offline-capable maritime decision-support and private
workspace application. Captain Sinbad combines deterministic local marine
calculations, an optional owner-local Ollama/XTTS bridge, approved private
Atlas Cloud knowledge, and an optional server-side AI provider.

## Verified runtime capabilities

- deterministic marine intent, risk and human-approval classification;
- bounded navigation calculations and draft passage planning;
- local official-training retrieval with citations;
- local Ollama chat and owner-local XTTS voice with browser fallback;
- authenticated Supabase workspace, member, document and private-media flows;
- private document text extraction, indexing and workspace-scoped retrieval;
- explicit-consent web-assisted answers through the `sinbad-answer` Edge Function;
- GPX import/export and local OpenCPN route exchange;
- permission-based position, camera and draft logbook capture.

## Core safety boundary

Every local expert adapter is `DECISION_SUPPORT_ONLY`; legacy bare callbacks
are not invoked. Expert output that claims authorization, control execution or
an actuator command is blocked. Cloud and consented-web AI requests carry a
Core safety envelope. The Edge Function independently recomputes the decision
before calling the provider. That server-side recomputation is the authoritative
security boundary. The browser also verifies the returned decision before
displaying an answer as defense-in-depth and stale-deployment protection; a
modified client is not a trusted enforcement point.

The hardened `sinbad-ai-core/` evidence pipeline remains `PLAN_ONLY`. It
provides deterministic trusted-library, provenance, verification, citation,
release and single-use delivery contracts without executing experts or
activating navigation mathematics.

## Explicit limits

Sinbad Marine is not certified ECDIS/ECS, a loading computer, a class/flag
approval system, or a vessel-control/autonomy system. It cannot command
actuators, approve a passage, replace official corrected charts/publications,
or override the master and responsible human operator. Current weather, MSI,
Notices to Mariners, traffic, port status and vessel-specific facts require
current authoritative sources and independent verification.

## Verification

Run the complete Node regression suite from the repository root:

```powershell
node --test sinbad-ai-core/tests/*.test.js tests/*.test.js
```

The v8.20.9 UTF-8 Core-gate checkpoint passes 425 tests. Re-run the suite for every
change; the recorded count is evidence for this checkpoint, not a permanent
claim about future revisions.

## Release order

Deploy the Supabase `sinbad-answer` Edge Function before publishing the static
GitHub Pages package. Then verify `CORE_GATE_BLOCKED` for a missing or altered
Core envelope and verify `DECISION_SUPPORT_ONLY` on a valid response. See
`UPLOAD_ALL_FILES_TR.md` and `supabase/functions/sinbad-answer/README_TR.md`.

Never place a Supabase service-role key, database password or AI-provider key
in the browser bundle or Git repository. Only a Supabase publishable/anon key
belongs in the web application; RLS and server-side membership checks enforce
workspace access.
