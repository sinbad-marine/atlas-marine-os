import json, os, sys, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import slice_diff as sd

BASE = os.path.dirname(os.path.abspath(__file__))
cons = sd.load('ILO_MLC2006_consolidated_2022.txt')
rows = []
for path in sorted(glob.glob(os.path.join(BASE, 'committed', 'PILOT-*.json'))):
    j = json.load(open(path, encoding='utf-8'))
    src = j['verifiedSources'][0]
    reg = src['regulationRef'].split()[1]
    committed = sd.normalize(src['fullText'])
    block = sd.normalize(sd.slice_reg(cons, reg))
    d = sd.diff_summary(committed, block)
    rows.append((os.path.basename(path), reg, len(committed.split()), len(block.split()), d))
for name, reg, wc, wb, d in rows:
    print(f"{name} Reg {reg:4} committed_words={wc:5} cons2022_words={wb:5} spans={d['spans']:3} ratio={d['ratio']}")
    for s in d['detail'][:12]:
        print(f"    [{s['op']}] A: {s['a'][:140]!r}")
        print(f"             B: {s['b'][:140]!r}")
