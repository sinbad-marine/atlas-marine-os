import sys, re, pypdf
src = sys.argv[1]; out = sys.argv[2]
r = pypdf.PdfReader(src)
pages = [p.extract_text() or '' for p in r.pages]
open(out, 'w', encoding='utf-8').write('\n\f\n'.join(pages))
print('pages', len(pages), 'chars', sum(len(p) for p in pages))
txt = '\n'.join(pages)
for pat in [r'Regulation 1\.4', r'Regulation 2\.1\b', r'Regulation 2\.2', r'Regulation 2\.4', r'Regulation 2\.5', r'Regulation 3\.1', r'Regulation 3\.2', r'Regulation 4\.1', r'Regulation 4\.2', r'Regulation 4\.3', r'Regulation 5\.1\.1', r'Regulation 5\.1\.6', r'Regulation 5\.2\.1', r'Regulation 5\.2\.2', r'Regulation 5\.3', r'Standard A2\.5\.2', r'Guideline B4\.3\.1']:
    print(pat.ljust(22), len(re.findall(pat, txt)))
