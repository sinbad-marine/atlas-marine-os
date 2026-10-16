# Denge Engine Room integration

The Engine Room at `index.html?workspace=engine-room` opens the Denge 3D view. **Details** opens the complete previous text interface, including sign-in, the existing refresh control, source facts and technical disclosures. Returning to 3D preserves the visual scene. ARGOS is the visible name; `command-gate`, its data source and authority rules are unchanged.

The renderer reuses the r24 Denge assets and interactions. Its frame contains no credentials and makes no service or model requests. The parent sends only a bounded projection of an observation that has already passed the existing Engine Room authority and scope checks. Source responses, unknown operation, explicit fresh FAULT, missing/denied data and old records remain separate. Health is not inferred. A fresh online field is not workload evidence. Source age is reclassified using the existing 15 minute limit without new polling requests. Revocation, scope change and page history clear the projection. Prototype diagnostics and sample controls are disabled. No sample arc appears on live opening.

Existing source contracts:

| Identity | Existing read source |
| --- | --- |
| `bridge` | `GET /status`, `GET /argos/status` Bridge record |
| `local-ai` | `GET /ai/status`, existing ARGOS fallback |
| `command-gate` | `GET /argos/status` |
| `library` | `GET /library/status`, existing `/status` fallback |
| `studio` | `GET /studio/status` |

All use the application's existing `http://127.0.0.1:31983` base. No new URL, proxy, credentials, permissions or backend are introduced. The Groq source-only record remains in Details; it is neither a measured provider connection nor a sixth live motor. The legacy `notConnected` fields, including SINBAD Core link and data flow, remain available. A successful source GET does not prove a functional Core link.

Before this integration, the deployed source was `9a497748b60aeedccd01e35cb4735da7c77db18d`. Local snapshots of changed files and the full old section were saved outside the repository. Recovery follows `docs/RELEASE_RECOVERY.md`: rebuild and redeploy that exact known-good commit through **Controlled Pages release**; never copy old files over the active source tree. No runtime service restart is required for this static UI release.

On the development Mac, all five sequential real source GETs returned connection refused on 2026-10-16. No motor is claimed connected from those results. Existing service availability and the intended device must be resolved before claiming end-to-end connections. No service, model, repair, inference or memory-gate action was performed by this integration.

Validation uses the existing unit/browser suites plus controlled source fixtures in `engine-room-denge.spec.js`. Fixtures exercise authority loss, old/missing/denied records, explicit fresh fault, synthetic exclusion, Details, EN/TR, visual movement, size gestures and unchanged help-panel canvas dimensions. Fixture success is not a real device connection or design acceptance.

Software WebGL rasterizers (SwiftShader/llvmpipe/softpipe) use a 120,000-pixel raster ceiling and no multisampled offscreen target. Hardware retains the original 1,800,000-pixel ceiling and two offscreen samples. Geometry, crystal materials, bloom, DOM labels and every gesture remain active. The real backend selects this production resource limit; there is no test-only or user-agent bypass. This addresses CPU raster latency observed in the first hosted CI run; no test deadline, assertion or golden is relaxed.

When Details hides the iframe, the renderer ignores zero-sized resize observations. Returning to 3D restores a valid viewport without changing the camera distance; otherwise the hidden 0/0 aspect could poison it with NaN and leave a black scene. The existing visitor lifecycle test now requires a zero-width hidden canvas followed by a finite, preserved camera on return.
