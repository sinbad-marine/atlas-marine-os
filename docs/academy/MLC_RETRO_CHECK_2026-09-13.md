# MLC 2006 - Retrospective consistency check of PILOT-001 to PILOT-009 against the ILO 2022 consolidated text

Date: 2026-09-12/13. Performed under the Owner's 2026-09-12 GO on the resumption plan (Hat B). Read-only check; the one defect found was corrected by a separate commit on its own PR branch (PR #222), not by editing this report.

## Why

PILOT-001 to PILOT-009 (PRs #215-#223, 2026-09-08) were verified against two 2006-original mirrors plus the ILO 2014+2016 consolidated text, and their amendment status was judged from an amendment-history web search because no 2018/2022 consolidated text was available in that session. On 2026-09-12 the ILO consolidated text including the Amendments of 2014, 2016, 2018 and 2022 (published 2 October 2024) and the authentic amendment texts were acquired (provenance in `SOURCES-2026-09-13.json`). Every committed `fullText` was re-diffed, word by word, against the matching Regulation block of that consolidated text (`verification/retro_check.py`).

## Result

| File | Regulation | Committed words | 2022 text words | Diff spans | Verdict |
|---|---|---|---|---|---|
| PILOT-001 | 1.1 | 332 | 321 | 1 | CONSISTENT - the only span is the Title heading line included in the committed text |
| PILOT-002 | 1.2 | 712 | 722 | 2 | CONSISTENT - running header; `ILO/WHO` spacing |
| PILOT-003 | 1.3 | 182 | 182 | 1 | CONSISTENT - line-break hyphenation (`provi-sions`) |
| PILOT-004 | 2.3 | 1128 | 1131 | 2 | CONSISTENT - running header; `standard.`/`Standard.` capitalisation at end of Guideline B2.3.1 (2022 edition capitalises) |
| PILOT-005 | 2.6 | 239 | 238 | 1 | CONSISTENT - extraction spacing (`compensationfor`) |
| PILOT-006 | 2.7 | 317 | 317 | 0 | IDENTICAL |
| PILOT-007 | 2.8 | 462 | 465 | 2 | CONSISTENT - running header; hyphenation |
| PILOT-008 | 4.4 | 1493 | 1544 | 8 | **DEFECT** - Guideline B4.4.2 paragraph 5 (internet access in ports, Amendments of 2022) missing; paragraphs 5-8 not renumbered 6-9; the file's amendmentHistory wrongly stated no 2022 change |
| PILOT-009 | 4.5 | 1020 | 1029 | 1 | CONSISTENT - running header |

Eight of nine files carry the in-force text. One file (PILOT-008, Regulation 4.4) carried the 2006 text of one Guideline paragraph set that the 2022 amendments changed.

## Cause of the defect

The 2026-09-08 amendment check for Regulation 4.4 relied on a web search for "Regulation 4.4" in the 2022 round. The 2022 amendment to Guideline B4.4.2 was adopted under the joint heading "Amendments to the Code relating to Regulations 3.1 and 4.4" and is easy to miss when searching by single Regulation number. The authentic 2022 text (ILC 110, wcms_848492) lists it explicitly. The other eight Regulations are genuinely unamended through 2022.

## Correction

PR #222, second commit: PILOT-008.json regenerated from the ILO 2022 consolidated text with the four-stage diff method, amendmentHistory corrected (the wrong original statement is quoted inside it, not deleted), `correctionNote`/`correctedAt` added, and the pending 2025 amendment to Guideline B4.4.6 paragraph 2 recorded.

## 2025 amendments and the nine files

The Amendments of 2025 (ILC 113, adopted 6 June 2025, expected entry into force 23 December 2027, not in force) touch Regulations 1.4, 2.4, 2.5, 3.1, 4.1, 4.3, 4.4, 5.1.5 and 5.1.6. Among PILOT-001 to 009 only Regulation 4.4 is affected (Guideline B4.4.6 paragraph 2) and that is now recorded in the corrected PILOT-008. The other eight files need no pending-amendment note.

## Method note for the record

Word-level diff after normalisation (page breaks, running headers, page numbers, line-break hyphenation, curly quotes and dashes removed). Spans were inspected one by one; a span counts as an artifact only when both readings are the same words. No text was changed in PILOT-001 to 007 and 009.
