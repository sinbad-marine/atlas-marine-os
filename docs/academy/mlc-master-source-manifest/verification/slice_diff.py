import re, sys, json, difflib, os, glob

BASE = os.path.dirname(os.path.abspath(__file__))
SOURCES = {
    'cons2022': 'ILO_MLC2006_consolidated_2022.txt',
    'cons2016': 'ILO_267866_MLC2006_2014_2016_consolidated.txt',
    'orig_ilo': 'ILO_269841_MLC2006_original.txt',
    'orig_iri': 'RegisterIRI_MLC2006_original.txt',
}
REGS = ['1.1','1.2','1.3','1.4','2.1','2.2','2.3','2.4','2.5','2.6','2.7','2.8',
        '3.1','3.2','4.1','4.2','4.3','4.4','4.5',
        '5.1.1','5.1.2','5.1.3','5.1.4','5.1.5','5.1.6','5.2.1','5.2.2','5.3']
NEXT = {r: REGS[i+1] if i+1 < len(REGS) else None for i, r in enumerate(REGS)}

def load(name):
    return open(os.path.join(BASE, name), encoding='utf-8').read()

def heading_re(reg):
    # "Regulation 2.1 – Seafarers’ employment agreements" on its own line, dash may be – or -
    return re.compile(r'^[ \t]*Regulation[ \t]+' + re.escape(reg) + r'[ \t]*[–\-—][ \t]*\S', re.M)

def body_start(txt):
    # skip the table of contents: first heading occurrence AFTER the line 'Regulation 1.1 – Minimum age' that is not followed by dots
    m = None
    for mm in heading_re('1.1').finditer(txt):
        line = txt[mm.start(): txt.find('\n', mm.start())]
        if not is_toc_line(line):
            m = mm; break
    return m.start() if m else 0

def is_toc_line(line):
    # table-of-contents entries carry dot leaders ("....", ". . . .") and/or a trailing page number
    return bool(re.search(r'(\.\s*){4,}', line)) or bool(re.search(r'\s\d{1,3}\s*$', line))

def slice_reg(txt, reg):
    start_at = body_start(txt)
    m = None
    for mm in heading_re(reg).finditer(txt, start_at):
        line = txt[mm.start(): txt.find('\n', mm.start())]
        if not is_toc_line(line):
            m = mm; break
    if not m:
        return None
    # for 5.1 / 5.2 headings (group headings) we start at the sub-regulation itself
    end = len(txt)
    nxt = NEXT[reg]
    if nxt:
        m2 = heading_re(nxt).search(txt, m.end())
        if m2:
            end = m2.start()
    # Title 5 / Appendix / group heading cut
    stops = [r'^\s*Regulation\s+5\.1\s*[–\-—]\s*Flag', r'^\s*Regulation\s+5\.2\s*[–\-—]\s*Port', r'^\s*TitlE\s+5', r'^\s*Title\s+5[\.:]', r'^\s*TITLE\s+5']
    if reg not in ('5.1.6','5.2.2','5.3'):
        for stop in stops:
            ms = re.compile(stop, re.M).search(txt, m.end(), end)
            if ms and ms.start() < end:
                end = ms.start()
    # every block ends before the appendices at the latest
    for stop in [r'^[ \t]*App[Ee]ndix[ \t]+A\d', r'^[ \t]*APPENDIX[ \t]+A\d', r'^[ \t]*Appendix[ \t]+B5']:
        ms = re.compile(stop, re.M | re.I).search(txt, m.end(), end)
        if ms and ms.start() < end:
            end = ms.start()
    return txt[m.start():end]

def normalize(s):
    s = s.replace('\f', '\n')
    # drop running headers/footers and page numbers
    lines = []
    for ln in s.split('\n'):
        t = ln.strip()
        if not t: continue
        if re.fullmatch(r'\d{1,3}', t): continue
        if re.search(r'Maritime Labour Convention, 2006(, as amended)?\s*$', t) and len(t) < 60: continue
        if re.fullmatch(r'(Title|TitlE)\s+\d.*', t): continue
        lines.append(t)
    s = '\n'.join(lines)
    # join hyphenated line breaks "prop -\nerly" / "prop-\nerly"
    s = re.sub(r'(\w)\s*-\s*\n\s*(\w)', r'\1\2', s)
    s = s.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')
    s = s.replace('–', '-').replace('—', '-').replace(' ', ' ')
    s = re.sub(r'\s+', ' ', s)
    return s.strip()

def words(s):
    return s.split(' ')

def diff_summary(a, b):
    wa, wb = words(a), words(b)
    sm = difflib.SequenceMatcher(None, wa, wb, autojunk=False)
    spans = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal': continue
        spans.append({'op': tag, 'a': ' '.join(wa[i1:i2])[:300], 'b': ' '.join(wb[j1:j2])[:300]})
    return {'ratio': round(sm.ratio(), 4), 'spans': len(spans), 'detail': spans[:40]}

if __name__ == '__main__':
    texts = {k: load(v) for k, v in SOURCES.items()}
    out_dir = os.path.join(BASE, 'slices'); os.makedirs(out_dir, exist_ok=True)
    report = {}
    for reg in REGS:
        entry = {}
        norm = {}
        for k, txt in texts.items():
            blk = slice_reg(txt, reg)
            if blk is None:
                entry[k] = {'found': False}; continue
            n = normalize(blk)
            norm[k] = n
            open(os.path.join(out_dir, f'{reg}_{k}.txt'), 'w', encoding='utf-8').write(n)
            entry[k] = {'found': True, 'chars': len(n), 'words': len(words(n))}
        if 'orig_ilo' in norm and 'orig_iri' in norm:
            entry['orig_ilo_vs_orig_iri'] = diff_summary(norm['orig_ilo'], norm['orig_iri'])
        if 'orig_ilo' in norm and 'cons2016' in norm:
            entry['orig_vs_cons2016'] = diff_summary(norm['orig_ilo'], norm['cons2016'])
        if 'cons2016' in norm and 'cons2022' in norm:
            entry['cons2016_vs_cons2022'] = diff_summary(norm['cons2016'], norm['cons2022'])
        report[reg] = entry
    json.dump(report, open(os.path.join(BASE, 'slice_report.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    for reg, e in report.items():
        f = lambda k: (e.get(k) or {}).get('spans', '-')
        r = lambda k: (e.get(k) or {}).get('ratio', '-')
        print(f"{reg:6} words2022={e.get('cons2022',{}).get('words','-'):>5}  mirrors={f('orig_ilo_vs_orig_iri')}  orig->2016={f('orig_vs_cons2016')} ({r('orig_vs_cons2016')})  2016->2022={f('cons2016_vs_cons2022')} ({r('cons2016_vs_cons2022')})")
