# Sinbad Core Architecture Inventory — 2026-08-14

Status: read-only baseline completed at `80d2d3cfc3610def56b34434e69989c90151711e`; this document does not activate a capability.

## Preserved foundation

The existing repository is the real Sinbad Core and is not being replaced. Its fail-closed delivery chain, provenance and grounded-response pipeline, governance/evidence contracts, identity and vessel profile, offline synchronization, access-control isolation, sensitive-data governance, task-memory lifecycle, engineering artifact/V&V contracts, digital-twin provenance, MetOcean/celestial/PNT contracts, and VCASK authority boundary remain in place. The verified baseline was clean with 813 passing tests in 142 test files, 11 migrations, and evidence hash `285147d315597480d13c49c835b1e495cc9566b753637aad9f9b1641969f1d2d`.

## Repository boundary inventory

| Area | Current role | Classification |
| --- | --- | --- |
| `contracts.js`, `intent-engine.js`, `safety-engine.js`, `orchestrator/`, `experts/` | Generic intent, safety, orchestration, and expert routing | Core, but expert manifest is too weak for the binding port policy |
| Identity, sync, governance, access, memory, engineering, sensor, digital-twin, and vessel-control contract files | Exact inert candidate contracts and deny-only gates | Core foundation; preserve |
| `retrieval/`, `grounding/`, `library/`, `delivery/`, `verification/`, `audit/` | Evidence-backed answer and delivery integrity chain | Reusable Core service boundary; preserve |
| `adapters/` and Supabase migrations | Trusted terminal delivery and rollout/recovery integration | Legacy delivery product adapter family; keep compatible, do not treat as the universal Core public surface |
| Root `bridge/`, root tests and training-data assets | Academy/product integration and client-side material | Product/client boundary; not universal Core |

## Product leakage findings

No direct `Zabit`, `GASM`, or academy product identity was found in Core runtime contracts. Generic `training` intent vocabulary is a valid domain capability and is not by itself product leakage.

Two structural leaks require compatibility-preserving separation:

1. `sinbad-ai-core/package.json` is named `@sinbad-ai/core-terminal-delivery`, its main entry is the trusted terminal-delivery adapter, and its public exports describe rollout/recovery. This historical adapter surface must become a legacy subpath or separately packaged adapter before a universal Core package surface is claimed.
2. `README.md` is dominated by delivery/rollout phase history and describes the terminal adapter as the production entry point. It is evidence-rich history, but not a product-independent architecture entry document.

The static Zabit Akademisi prototype under the separate product workspace is not evidence of Core failure and must remain a Core client/module.

## Binding port gap

The existing `experts/expert-contract.js` records identity, intents, capabilities, confidence, and execution callbacks. It does not yet bind protocol version, safety class, tenant/vessel scope, units/time/coordinate/currency requirements, provenance/license policy, sandbox permissions, offline behavior, validation harness, human approval, activation mode, or direct-write prohibitions. `marine-capability-registry.js` is correctly deny-only but covers only sensor/MetOcean/celestial/PNT capabilities rather than the universal A–O motor set.

Required next separation is a generic, versioned Engine Port Manifest and deny-only activation assessment. Expert engines remain outside Core and communicate through typed ports. Port O (software/web/design/content production) is the first expert engine, but cannot write directly to Core or production. Port N (vessel automation/control) remains `READ_ONLY` and cannot obtain physical authority from this contract package.

## Stability Data Package decision

The Stability Data Package remains valid and aligned with engineering artifacts, independent V&V, digital-twin provenance, vessel profile, and governance foundations. It does not conflict with the universal Core goal if it is implemented as a future maritime-engine module behind the generic port boundary. It is paused as the immediate next implementation until the common port manifest, registry, validation, isolation, and activation-denial backbone exists. No existing stability work is deleted.

## Source traceability

- `SINBAD_CORE_GELECEK_MOTOR_PORTLARI_VE_MODUL_SOZLESMESI.md`: SHA-256 `A51D894F73AD303AB0554B57D9F1CDD84D95002B5A3AB7A1FF5C8E5B7DB158C6`
- `SINBAD_CORE_MOTOR_PORTLARI_UYGULAMA_YOL_HARITASI.md`: SHA-256 `6817B047270452235DBFCDA552A83DEFAC0DCFB2A14714CB2B3DA7265D74FF13`
- `SINBAD_TEMEL_POLITIKA.md`: SHA-256 `34E7FC7C2E5E52676EBEECCD7C7F9ADD8396AE8A22087E2999D04A2E16E5AEFA`
- `SINBAD_CORE_FAZ0_ILK_MIMARI_INCELEME_2026-08-14.md`: SHA-256 `FE9104172260712F22948E2E2BC60BA1250011D014A48679C5B1E8FD2A7C2EA1`

