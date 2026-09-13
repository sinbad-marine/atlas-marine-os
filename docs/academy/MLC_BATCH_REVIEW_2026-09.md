# SINBAD Academy - MLC 2006 Batch Review Package (Owner review, 2026-09-13)

Prepared under the Owner's 2026-09-08 instruction "MLC 2006 - toplu hazirlik ve toplu PR inceleme" (item 7: one consolidated review package) and the Owner's 2026-09-12 GO on the resumption plan. This file is a review aid. It authorizes nothing: every PR listed below is DRAFT, UNMERGED and NOT OWNER ACCEPTED until the Owner says otherwise. Git history, each PILOT-*.json provenance record and docs/academy/PROJECT_STATE.json are authoritative over this summary where they differ.

State vocabulary (kept separate on purpose): IMPLEMENTED / TESTED / SOURCE-VERIFIED / IN DRAFT PR / MERGED / INTEGRATED / OWNER ACCEPTED / LIVE.

## 1. Coverage

All 28 Regulations of MLC 2006, Titles 1-5, now have a source manifest, each in its own draft PR. SOURCE HOLD is cleared: the ten held Regulations were released on 2026-09-12/13 after the ILO consolidated text (Amendments of 2014, 2016, 2018 and 2022; published 2 October 2024) and the authentic amendment texts were acquired and their provenance recorded (`mlc-master-source-manifest/SOURCES-2026-09-13.json`).

Two text editions exist in the series and are labelled inside each file:
- PILOT-001 to 009 (2026-09-08): verified against 2006-original mirrors plus the 2014+2016 consolidated text; retrospectively re-checked against the 2022 consolidated text on 2026-09-12 (`MLC_RETRO_CHECK_2026-09-13.md`) - eight consistent, one corrected (PILOT-008).
- PILOT-010 to 028 (2026-09-13): built directly from the ILO 2022 consolidated text with the four-stage diff method and the authentic amendment texts as evidence.

The Amendments of 2025 (ILC 113, adopted 6 June 2025, expected entry into force 23 December 2027) are NOT in force. Where they touch a Regulation they are recorded in `pendingAmendments2025` only and never blended into `fullText`.

## 2. Title / Regulation -> PR map

| Title | Regulation | File | PR | In-force amendment rounds | Pending 2025 |
|---|---|---|---|---|---|
| 1 | 1.1 Minimum age | PILOT-001 | #215 | none | no |
| 1 | 1.2 Medical certificate | PILOT-002 | #216 | none | no |
| 1 | 1.3 Training and qualifications | PILOT-003 | #217 | none | no |
| 1 | 1.4 Recruitment and placement | PILOT-012 | #226 | 2022 (A1.4 5(c)(vi)) | yes (B1.4.1 2(l)) |
| 2 | 2.1 Seafarers' employment agreements | PILOT-010 | #224 | 2018 (A2.1 para 7) | no |
| 2 | 2.2 Wages | PILOT-011 | #225 | 2018 (A2.2 para 7) | no |
| 2 | 2.3 Hours of work and hours of rest | PILOT-004 | #218 | none | no |
| 2 | 2.4 Entitlement to leave | PILOT-013 | #227 | none | yes (A2.4.1/A2.4.2, B2.4.5) |
| 2 | 2.5 Repatriation | PILOT-014 | #228 | 2014 (A2.5.1/A2.5.2, B2.5.3), 2018 (B2.5.1 para 8), 2022 (A2.5.1 para 9) | yes (A2.5.1 paras 3 and 10, B2.5.1 para 3, B2.5.2) |
| 2 | 2.6 Compensation for ship's loss | PILOT-005 | #219 | none | no |
| 2 | 2.7 Manning levels | PILOT-006 | #220 | none | no |
| 2 | 2.8 Career and skill development | PILOT-007 | #221 | none | no |
| 3 | 3.1 Accommodation and recreational facilities | PILOT-018 | #232 | 2022 (A3.1 para 17, B3.1.11 4(j) and para 8) | yes (B3.1.10 1(d)) |
| 3 | 3.2 Food and catering | PILOT-019 | #233 | 2022 (A3.2 2(a), 2(b), 7(a)) | no |
| 4 | 4.1 Medical care | PILOT-015 | #229 | 2022 (A4.1 paras 5-6, B4.1.3 paras 4-5, B4.1.4 1(k)) | yes (B4.1.1 paras 2 and 4) |
| 4 | 4.2 Shipowners' liability | PILOT-016 | #230 | 2014 (A4.2.1/A4.2.2, B4.2.1/B4.2.2) | no |
| 4 | 4.3 Health and safety protection | PILOT-017 | #231 | 2016 (B4.3.1, B4.3.6), 2022 (A4.3 1(b) and para 5, B4.3.5 paras 4-5) | yes (A4.3, B4.3.1, B4.3.6, B4.3.11) |
| 4 | 4.4 Shore-based welfare facilities | PILOT-008 (corrected) | #222 | 2022 (B4.4.2 para 5) | yes (B4.4.6 para 2) |
| 4 | 4.5 Social security | PILOT-009 | #223 | none | no |
| 5 | 5.1.1 General principles | PILOT-020 | #234 | none | no |
| 5 | 5.1.2 Authorization of recognized organizations | PILOT-021 | #235 | none | no |
| 5 | 5.1.3 Maritime labour certificate and DMLC | PILOT-022 | #236 | 2016 (A5.1.3 para 4) | no |
| 5 | 5.1.4 Inspection and enforcement | PILOT-023 | #237 | none | no |
| 5 | 5.1.5 On-board complaint procedures | PILOT-024 | #238 | none | yes (A5.1.5 paras 2, 3, 5) |
| 5 | 5.1.6 Marine casualties | PILOT-025 | #239 | none (no Standard/Guideline exists) | yes (new A5.1.6) |
| 5 | 5.2.1 Inspections in port | PILOT-026 | #240 | none | no |
| 5 | 5.2.2 Onshore complaint-handling | PILOT-027 | #241 | none | no |
| 5 | 5.3 Labour-supplying responsibilities | PILOT-028 | #242 | none | no |

## 3. Per-PR change summary and evidence

Common facts, verified live with git and gh on 2026-09-13:
- Every PR #215-#242 is cut directly from origin/main 1f7d584, adds or changes exactly one file under docs/academy/mlc-master-source-manifest/, touches nothing else, and shares no commit with any other branch. PR #222 has two commits (original file + correction); all others one.
- GitHub "Release quality" CI (verify job) passed on #215-#223 as of 2026-09-13 morning; #224-#242 and the #222 correction were pushed on 2026-09-13 and their CI results must be read from GitHub (documentation-only files; CI proves they break nothing, not that their content is correct).
- Content correctness rests on the provenance fields inside each file: verificationMethod, diffEvidence (word-diff span counts per comparison stage, hyphen decisions with evidence), amendmentHistory (every substantive diff span attributed to a named amendment), pendingAmendments2025, primarySources and amendmentTextSources (URL, SHA-256, size, fetch time).

Method for PILOT-010 to 028: `PRIMARY_SOURCE_FOUR_STAGE_DIFF`. Stage 1: two 2006-original mirrors (ILO media/269841, register-iri.com) diffed against each other - identical for all 28 Regulations apart from three mirror typos. Stage 2: 2006 original vs ILO 2014+2016 consolidated (media/267866). Stage 3: 2014+2016 consolidated vs 2014+2016+2018+2022 consolidated (NORMES_MLC Amendments-EN_2022_Web_1.pdf). Stage 4: every non-artifact span matched against the authentic amendment texts (2014 GB.322/LILS/3, 2016 ILC 105 wcms_488452, 2018 ILC 107 wcms_632462, 2022 ILC 110 wcms_848492) and the 2025 ILC 113 text for pending notes. The scripts are kept as reference under `mlc-master-source-manifest/verification/` (not wired into any tooling or CI).

Method caveat, unchanged from 2026-09-08: no GROK/GEMINI access in either session; the ISM/ISPS "two model candidates + primary source" method was replaced by direct primary-source diffing, which the Owner accepted for this series.

## 4. Provenance and human-acceptance status

- Source verification: done for 28/28 Regulations by the methods above. Source-text verification only.
- Human Review acceptance: NONE. No MLC content has entered the Supabase Human Review flow; no academy_mlc_* table exists; no promotion tooling consumes these files.
- Owner acceptance: NONE recorded for any MLC file.
- Live: NOTHING.

## 5. Dependencies and recommended review/merge order

Git dependencies: none between #215-#242, and none on #212/#213/#214 (disjoint files, common base). Semantic dependency: PR #213's pilot question package was validated with PR #212's tools, so #212 should land before #213.

Recommended order (recommendation only; merge is an Owner Gate): #212 -> #213 -> #214 -> #215-#223 -> #224-#242, Title order within MLC. After #212 merges, ARGOS policy on main changes; re-run CI on the remaining PRs before each merge.

## 6. Integration test results

- PR #212 tip fc2e1a0 (2026-09-12): local full regression 1993 tests, 1976 pass, 0 fail, 17 skip; ARGOS verifier VERIFIED (105 files); GitHub CI run 34715942840 success on all 19 steps including browser tests.
- No combined "all merged together" test has been run; merge-tree dry runs against main were clean for the first twelve Academy branches and the nineteen new branches change nineteen new files nobody else touches.

## 7. Gaps and Owner-gated work

- No SOURCE HOLD remains. Title 5 is reviewed.
- Pending 2025 amendments: nine Regulations carry a `pendingAmendments2025` note; when the amendments enter into force (expected 23 December 2027) those nine files need a new edition.
- Local Windows environment notes (not Academy defects): OWNER_GOVERNANCE.md lacks an eol=lf attribute so the local ARGOS verifier must run on a git archive export; the hands-free browser test fails locally but passes on CI.
- Owner Gate items: merge of any PR; live Human Review run of the pilot question package (PENDING_OWNER_ACTION); any question generation (HOLD).
