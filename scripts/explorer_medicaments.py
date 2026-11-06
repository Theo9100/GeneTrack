"""Reconnaissance ponctuelle de la base XML ANMV : structure, exemples, rubriques posologie / temps d'attente."""
import sys, collections, xml.etree.ElementTree as ET

path = sys.argv[1]
counts = collections.Counter()
samples = {}
stack = []
hits = 0
first_product_dumped = False

def short(t):
    return t.split('}')[-1]

for ev, el in ET.iterparse(path, events=('start', 'end')):
    if ev == 'start':
        stack.append(short(el.tag))
        continue
    p = '/'.join(stack[-4:])
    counts[p] += 1
    txt = (el.text or '').strip()
    if txt and p not in samples:
        samples[p] = txt[:160]
    low = txt.lower()
    if hits < 6 and ('posolog' in short(el.tag).lower() or ('posolog' in low and len(txt) > 40)):
        hits += 1
        print(f'\n### POSOLOGIE trouvée dans <{p}> :\n{txt[:1500]}\n')
    if not first_product_dumped and len(stack) == 2 and len(list(el)) > 3:
        first_product_dumped = True
        print('### PREMIER ENREGISTREMENT (aperçu) ###')
        for sub in el.iter():
            t = (sub.text or '').strip()
            if t:
                print(f'  {short(sub.tag)} = {t[:200]}')
        print('### FIN ###')
    stack.pop()
    if len(stack) <= 2:
        el.clear()

print('\n### CHEMINS (fin de chemin) — nombre — exemple ###')
for p, n in counts.most_common(160):
    print(f'{n:>8}  {p}  ::  {samples.get(p, "")}')
