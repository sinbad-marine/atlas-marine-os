Reference copies of the scripts used on 2026-09-12/13 to verify the MLC 2006 manifests (PILOT-010 to 028 and the PILOT-008 correction). They are documentation of method, not project tooling: nothing in the repository imports or runs them, they are not part of npm test or CI, and they need only Python 3.11 with pypdf (and cryptography for one encrypted circular) installed outside the repository.

- extract.py       PDF -> text (pypdf), one form feed per page.
- slice_diff.py    slices every Regulation block from the four source texts and word-diffs them stage by stage (slice_report.json).
- retro_check.py   re-diffs the committed PILOT-001..009 fullText against the ILO 2022 consolidated text.
- build_manifest.py / manifest_meta.py   re-flow the consolidated block into fullText (evidence-based hyphen decisions, logged in each file) and assemble the PILOT-NNN.json records with provenance.

Inputs (URL, SHA-256, size, fetch time) are listed in ../SOURCES-2026-09-13.json.
