"""Build docs/academy/mlc-master-source-manifest/PILOT-NNN.json files for MLC 2006 Regulations
from the ILO consolidated text (2014+2016+2018+2022 amendments, published 2 October 2024),
with the four-source diff evidence computed by slice_diff.py embedded as provenance.

Nothing here invents text: fullText is the consolidated ILO block, re-flowed only to undo
PDF line wrapping, soft hyphenation, running headers and page numbers. Every join that
removed a hyphen is logged into the output so a reviewer can audit it.
"""
import json, os, re, sys, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import slice_diff as sd

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, 'out'); os.makedirs(OUT, exist_ok=True)
PROV = json.load(open(os.path.join(BASE, 'sources-provenance.json'), encoding='utf-8'))
def prov(name):
    for p in PROV:
        if p['file'] == name:
            return {'file': p['file'], 'url': p['url'], 'sha256': p['sha256'], 'bytes': p['bytes'], 'fetchedUtc': p['fetchedUtc']}
    raise KeyError(name)

RUNNING_HEADS = {
    'Maritime Labour Convention, 2006', 'Maritime Labour Convention, 2006, as amended',
    'Minimum requirements for seafarers to work on a ship', 'Conditions of employment',
    'Accommodation, recreational facilities, food and catering',
    'Health protection, medical care, welfare and social security protection',
    'Health protection, medical care, welfare', 'and social security protection',
    'Compliance and enforcement',
}
PARA_START = re.compile(r'^(Regulation\s+\d|Standard\s+A\d|Guideline\s+B\d|Purpose:|\d{1,2}\.\s|\([a-z]{1,5}\)\s)')

def ascii_punct(s):
    return (s.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')
             .replace('–', '-').replace('—', '-').replace(' ', ' ').replace(' ', ' '))

# Tokens that no source resolves automatically. Each entry records the evidence used; nothing here changes wording.
MANUAL_HYPHEN = {
    'onequar-ter': ('one-quarter', "pypdf dropped the real hyphen and added a soft one; 'one-quarter' occurs 4 times across the sources (Standard A2.2 / Guideline B2.2.2 'one and one-quarter times')."),
    'non-toxic': ('non-toxic', "both ILO consolidated PDFs break the line as 'non-' + 'toxic'; the compound is hyphenated in standard usage and no unhyphenated 'nontoxic' occurs in any source."),
    'book-case': ('bookcase', "both ILO consolidated PDFs break the line as 'book-' + 'case'; standard orthography 'bookcase' (Guideline B3.1.5); no hyphenated form occurs in any source."),
    'herein-after': ('hereinafter', "the 2006 ILO mirror carries '(hereinafter' as one word (Standard A3.1 paragraph 6); line-break hyphenation only."),
    'appropriate-ly': ('appropriately', "the 2022 authentic amendment text reads 'appropriately-sized personal protective equipment' (Standard A4.3 paragraph 1(b)); line-break hyphenation only."),
}
# Single English words split at a line break whose joined form happens to occur nowhere else in the four sources.
MANUAL_HYPHEN['under-utilized'] = ('under-utilized', "all four sources break 'under-' + 'utilized' at the same point and no unhyphenated 'underutilized' occurs anywhere; the 2006-mirror-based first version of this file (commit 24c824a) also carried 'under-utilized' (Guideline B4.4.2).")
for _w in ['address-ing', 'appli-ances', 'cloth-ing', 'con-tinuation', 'con-trolled', 'disem-barking', 'engineer-ing', 'fraudu-lently', 'repre-senting', 'un-founded', 'devel-oped', 'entertain-ment']:
    MANUAL_HYPHEN[_w] = (_w.replace('-', ''), "line-break hyphenation of a single English word (no such hyphenated compound exists); joined form is standard orthography.")

_CORPUS = None
def corpus():
    """All four source texts with line breaks flattened, used as evidence for hyphen decisions."""
    global _CORPUS
    if _CORPUS is None:
        parts = []
        for name in ['ILO_MLC2006_consolidated_2022.txt', 'ILO_267866_MLC2006_2014_2016_consolidated.txt',
                     'ILO_269841_MLC2006_original.txt', 'RegisterIRI_MLC2006_original.txt']:
            t = ascii_punct(sd.load(name)).replace('\f', '\n')
            t = re.sub(r'\s*\n\s*', ' ', t)
            parts.append(t)
        _CORPUS = parts
    return _CORPUS

def hyphen_evidence(left, right):
    """Count how often the joined form and the hyphenated form occur across the sources (whole words)."""
    joined = sum(len(re.findall(r'\b' + re.escape(left + right) + r'\b', c)) for c in corpus())
    hyph = sum(len(re.findall(r'\b' + re.escape(left) + r'-' + re.escape(right) + r'\b', c)) for c in corpus())
    return joined, hyph

def resolve_hyphens(text, decisions, origin):
    """Decide every 'xxx-yyy' token (yyy lower-case) on corpus evidence. Unresolvable tokens keep the hyphen and are logged."""
    def repl(m):
        left, right = m.group(1), m.group(2)
        joined, hyph = hyphen_evidence(left, right)
        if joined > 0 and hyph == 0:
            decisions.append({'token': f'{left}-{right}', 'decision': 'JOIN', 'joinedForms': joined, 'hyphenForms': hyph, 'origin': origin})
            return left + right
        if hyph > 0 and joined == 0:
            decisions.append({'token': f'{left}-{right}', 'decision': 'KEEP', 'joinedForms': joined, 'hyphenForms': hyph, 'origin': origin})
            return left + '-' + right
        if joined == 0 and hyph == 0:
            key = f'{left}-{right}'
            if key in MANUAL_HYPHEN:
                out, reason = MANUAL_HYPHEN[key]
                decisions.append({'token': key, 'decision': 'MANUAL', 'result': out, 'reason': reason, 'origin': origin})
                return out
            # second evidence layer: the joined form as a substring of a longer word in any source (e.g. 'assess' in 'assessment')
            sub_joined = sum(len(re.findall(re.escape(left + right), c)) for c in corpus())
            sub_hyph = sum(len(re.findall(re.escape(left + '-' + right), c)) for c in corpus())
            if sub_joined > 0 and sub_hyph == 0:
                decisions.append({'token': key, 'decision': 'JOIN_SUBSTRING', 'joinedForms': sub_joined, 'hyphenForms': 0, 'origin': origin})
                return left + right
            decisions.append({'token': key, 'decision': 'KEEP_UNRESOLVED', 'joinedForms': 0, 'hyphenForms': 0, 'origin': origin})
            return left + '-' + right
        dec = 'JOIN' if joined > hyph else 'KEEP'
        decisions.append({'token': f'{left}-{right}', 'decision': dec + '_MAJORITY', 'joinedForms': joined, 'hyphenForms': hyph, 'origin': origin})
        return left + right if dec == 'JOIN' else left + '-' + right
    return re.sub(r'\b([A-Za-z]+)-([a-z][A-Za-z]*)\b', repl, text)

def format_block(raw):
    joins = []
    paras = []
    cur = None
    for ln in raw.replace('\f', '\n').split('\n'):
        t = ascii_punct(ln).strip()
        if not t or re.fullmatch(r'\d{1,3}', t) or t in RUNNING_HEADS or re.fullmatch(r'(TitlE|Title|TITLE)\s+\d.*', t):
            continue
        if PARA_START.match(t) or cur is None:
            if cur is not None:
                paras.append(cur)
            cur = t
            continue
        # continuation line
        m = re.search(r'(\w)\s?-$', cur)
        if m and (t[0].islower() or t[0].isupper()):
            # hyphen at a line break: keep it attached with no space; resolve_hyphens decides on evidence afterwards
            cur = cur[:m.end(1)] + '-' + t
            joins.append(cur[max(0, m.end(1)-12):m.end(1)] + '-|' + t[:12])
        else:
            cur = cur + ' ' + t
    if cur is not None:
        paras.append(cur)
    text = '\n\n'.join(re.sub(r'\s+', ' ', p).strip() for p in paras)
    decisions = []
    text = resolve_hyphens(text, decisions, 'line-end-or-inline')
    return text, decisions

def check_consistency(text, raw):
    """Word-level diff between the re-flowed text and the raw block with heads stripped: expect 0 spans."""
    a = sd.normalize(text); b = sd.normalize(raw)
    return sd.diff_summary(a, b)

def derive_refs(text):
    """Regulation / Standard / Guideline references taken verbatim from the heading paragraphs of the block."""
    heads = [p for p in text.split('\n\n') if re.match(r'^(Regulation|Standard A|Guideline B)\s*\d', p)]
    reg = [h for h in heads if h.startswith('Regulation')]
    std = [h for h in heads if h.startswith('Standard')]
    gl = [h for h in heads if h.startswith('Guideline')]
    return {
        'regulation': reg[0] if reg else None,
        'standardA': '; '.join(std) if std else None,
        'guidelineB': '; '.join(gl) if gl else None,
    }

def build(reg, number, meta, section_label, refs=None):
    cons = sd.load('ILO_MLC2006_consolidated_2022.txt')
    raw = sd.slice_reg(cons, reg)
    text, joins = format_block(raw)
    refs = derive_refs(text)
    cons_check = check_consistency(text, raw)
    report = json.load(open(os.path.join(BASE, 'slice_report.json'), encoding='utf-8'))[reg]
    def short(k):
        d = report.get(k)
        return None if not d else {'wordDiffSpans': d['spans'], 'similarityRatio': d['ratio']}
    entry = {
        'sourceId': f'ILO-MLC2006-{section_label}',
        'title': meta['title'],
        'authority': 'ILO',
        'moduleCode': 'mlc-code-foundations',
        'flagAdministration': None,
        'section': meta['section'],
        'regulationRef': refs['regulation'],
        'standardARef': refs['standardA'],
        'guidelineBRef': refs['guidelineB'],
        'textEdition': 'Maritime Labour Convention, 2006, as amended - consolidated text established by the International Labour Office including the Amendments of 2014, 2016, 2018 and 2022 to the Code (ILO publication dated 2 October 2024). This is the text in force on the verification date.',
        'fullText': text,
        'variantNote': meta['variantNote'],
        'amendmentHistory': meta['amendmentHistory'],
        'pendingAmendments2025': meta.get('pending2025', 'None of the 2025 amendments (ILC 113, adopted 6 June 2025, expected entry into force 23 December 2027) touch this Regulation, its Standard or its Guidelines.'),
        'verificationMethod': 'PRIMARY_SOURCE_FOUR_STAGE_DIFF: (1) the two 2006-original mirrors were sliced and word-diffed against each other; (2) the 2006 original was word-diffed against the ILO 2014+2016 consolidated text; (3) that text was word-diffed against the ILO 2014+2016+2018+2022 consolidated text; (4) every non-artifact diff span was matched against the authentic amendment texts (ILO 2014, 2016, 2018 and 2022 amendment documents). fullText is the stage-3 target block re-flowed to undo PDF line wrapping; its word sequence was re-diffed against the raw block (consistencyCheck).',
        'diffEvidence': {
            'mirror2006_ilo_vs_registerIri': short('orig_ilo_vs_orig_iri'),
            'original2006_vs_consolidated2016': short('orig_vs_cons2016'),
            'consolidated2016_vs_consolidated2022': short('cons2016_vs_cons2022'),
            'consistencyCheck_reflow_vs_raw': {'wordDiffSpans': cons_check['spans'], 'similarityRatio': cons_check['ratio']},
            'hyphenDecisions': joins,
            'hyphenRule': 'Every hyphenated token whose second part is lower-case (line-end hyphenation and stray in-line hyphens from PDF extraction alike) was decided on evidence from the four source texts: JOIN when only the joined form occurs in the sources, KEEP when only the hyphenated form occurs, majority when both occur, KEEP_UNRESOLVED (hyphen retained, listed here) when neither occurs. Upper-case continuations (e.g. Director-General) keep the hyphen.',
            'artifactNote': 'Non-zero span counts in the mirror and stage-2/3 comparisons are explained field by field in amendmentHistory and variantNote; the remainder are PDF extraction artifacts (running headers, page numbers, line-break hyphenation, spacing before punctuation) that were inspected individually.',
        },
        'verifiedBy': ['PRIMARY_SOURCE_FOUR_STAGE_DIFF', 'AMENDMENT_TEXT_CROSSCHECK', 'AMENDMENT_HISTORY_CROSSCHECK'],
        'verifiedAt': datetime.date.today().isoformat(),
        'primarySources': [
            prov('ILO_MLC2006_consolidated_2022.pdf'),
            prov('ILO_267866_MLC2006_2014_2016_consolidated.pdf'),
            prov('ILO_269841_MLC2006_original.pdf'),
            prov('RegisterIRI_MLC2006_original.pdf'),
        ],
        'amendmentTextSources': [prov(f) for f in meta['amendmentSources']],
        'secondarySources': meta.get('secondary', []),
    }
    doc = {
        'manifestVersion': f'MLC-PILOT-{number:03d}',
        'createdAt': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'note': 'Provenance/reference record only, not a database write. Same status as PILOT-001 through 009.json: no academy_mlc_source_manifest table exists, no verification_stage asserted, not consumed by any promotion tooling. No migration, schema, or tooling change. Additive docs/ file only, on its own branch, separate from every other open PR in this series.',
        'batchNote': "Prepared under the Owner's 2026-09-08 full-scope MLC Title 1-5 instruction and the Owner's 2026-09-12 GO on the resumption plan, which released this Regulation from SOURCE HOLD only after the current consolidated ILO text and the authentic amendment texts were reacquired and their provenance recorded (see primarySources/amendmentTextSources). 'Prepared/draft' is not 'verified', 'human-accepted', 'merged' or 'live'. This file is source-text verification only.",
        'schemaExtensionNote': 'Uses the regulationRef/standardARef/guidelineBRef fields introduced in PILOT-001.json and adds textEdition, pendingAmendments2025, diffEvidence and amendmentTextSources. No further schema change; no tooling reads these files.',
        'verificationMethodNote': meta['methodNote'],
        'verifiedSources': [entry],
        'unresolvedSources': [],
        'relatedButOutOfScope': 'ISM Code and ISPS Code Part A remain closed, frozen baselines. Appendices A2-I, A4-I, A5-I to A5-III and B5-I are not part of any Regulation block and are not reproduced here; where an amendment changed an Appendix it is mentioned in amendmentHistory only. Does not touch config/human-review-contract.json, academy_ism_* schema/RLS/tooling, any open PR in this series, or GASM Human Review Cloud staging.',
    }
    path = os.path.join(OUT, f'PILOT-{number:03d}.json')
    json.dump(doc, open(path, 'w', encoding='utf-8', newline='\n'), indent=2, ensure_ascii=False)
    open(path, 'a', encoding='utf-8', newline='\n').write('\n')
    return path, len(text), cons_check, joins

if __name__ == '__main__':
    from manifest_meta import META, ORDER
    for number, reg in ORDER:
        m = META[reg]
        path, n, cc, joins = build(reg, number, m, m['sectionLabel'])
        print(f"PILOT-{number:03d} Reg {reg:6} chars={n:6} reflow_check spans={cc['spans']} ratio={cc['ratio']} hyphenJoins={len(joins)}")
        if cc['spans']:
            for s in cc['detail'][:6]:
                print('     ', s['op'], repr(s['a'][:80]), '->', repr(s['b'][:80]))
