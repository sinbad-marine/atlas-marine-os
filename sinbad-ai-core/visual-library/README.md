# SINBAD Visual Library

This layer binds approved visual evidence to existing SINBAD text sources. It
does not treat a search-engine result, a university collection, or an image on
an official website as reusable merely because it is publicly accessible.

Every displayed asset must have:

- a stable topic and alias set in Turkish/English where applicable;
- the original source page and direct asset URL;
- authority, creator, credit line and item-level licence evidence;
- retrieval time and SHA-256 of the downloaded bytes;
- links to one or more existing text-source identifiers;
- `licenceStatus: APPROVED` before it is eligible for display.

`source-coverage-plan.js` is the first-pass coverage map for the nine current
training sources. It is a research queue, not an approved visual catalogue.

Preferred acquisition order:

1. the same official authority as the linked text source;
2. another government source with item-level public-domain confirmation;
3. an open-access museum or university item with an explicit reusable licence;
4. Wikimedia Commons only when the original file page and licence are retained;
5. commissioned or generated explanatory artwork, clearly labelled as such,
   when no authoritative documentary image is available.

Logos, seals, identifiable people, third-party imagery embedded on government
pages, unclear licences and merely “free to view” assets remain in review and
must not be shown by Sinbad.

Approved local assets live under `assets/`. `catalog.js` preserves the original
download URL and the SHA-256 of the exact downloaded bytes. Captions must state
important negative distinctions (for example, a research buoy is not an aid to
navigation) so retrieval cannot silently turn a related image into a false one.

`nga-chart-no-1-atlas.js` indexes page-rendered official symbol plates already
present in the local SINBAD corpus. Page number, original document checksum and
render checksum are retained independently. This document-first extraction is
the default path; external image search is only for genuine corpus gaps.

Chart-symbol queries use the complete table pages from the 131-page atlas,
rather than fragile row crops. This preserves every NOAA/NGA/INT/ECDIS column,
multi-line explanation and adjacent legend exactly as published. The query
bridge maps Turkish and English subject aliases to the relevant whole pages and
serves them by immutable render hash.

## Complete private-library atlas

The complete local corpus is processed into a private, resumable SQLite + CAS
atlas outside the Git repository. Source PDFs are never modified. The pipeline
retains every registered source location while merging byte-identical documents
under their SHA-256.

Required runtime components are Python, Pillow, pypdf, PyMuPDF and Poppler's
`pdftoppm`. The stages are:

1. `scripts/build-complete-library-atlas.py --stage inventory` hashes every PDF,
   records duplicate locations, page counts, encryption and inventory failures.
2. Eight disjoint `--stage process --shard-count 8 --shard-index N` workers
   render every page at 160 DPI, extract page text/headings/topics and store
   original embedded raster images. Poppler failures fall back to PyMuPDF.
3. `scripts/extract-complete-library-regions.py` scans every completed page for
   tables and vector-diagram clusters, renders accepted regions at 240 DPI and
   rejects decorative/blank crops below the versioned ink-density threshold.
   Each document is isolated behind a page-count-based timeout.
4. `scripts/finalize-complete-library-atlas.py --prune-orphans --verify-hashes`
   builds the Unicode FTS5 index, derives publication and volume labels, removes
   only unreferenced generated CAS WebPs, verifies every referenced file/hash
   and writes `final-audit.json`.

Completion requires all valid documents to be terminal, each complete
document's `page_plates` count to equal its PDF page count, all complete pages
to have terminal `region_scans`, no missing/hash-mismatched/orphan assets, and
an FTS row for every page, embedded image and accepted region. Corrupt,
encrypted, fallback and failed records remain explicitly enumerable in the
audit instead of stopping unrelated publications.

`scripts/query-complete-library-atlas.py` provides status, search and immutable
asset resolution for the loopback Sinbad Bridge. Browser-visible asset URLs are
hash-bound and the Bridge refuses paths that are not present in the catalogue.
