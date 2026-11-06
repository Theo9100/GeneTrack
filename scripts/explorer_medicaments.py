"""Reconnaissance ponctuelle de la base ANMV : fichier de référence (codes) et exemple bovin complet."""
import sys, collections, re, xml.etree.ElementTree as ET

ref, base = sys.argv[1], sys.argv[2]
short = lambda t: t.split('}')[-1]

print('### RÉFÉRENCE : structure ###')
root = ET.parse(ref).getroot()
for table in root:
    rows = list(table)
    print(f'\n== <{short(table.tag)}> : {len(rows)} entrées ; exemple :', [(short(c.tag), (c.text or '')[:60]) for c in (rows[0] if rows else [])])
    for r in rows:
        txt = ' | '.join(f'{short(c.tag)}={(c.text or "").strip()}' for c in r)
        if re.search(r'osolog|attente|Bovin|Viande|Lait|Jour|Heure|Esp[eè]ce|Contre|Indication|Mode d|voie|Intramusc|Sous-cut|Orale|Pour-on|Abats', txt, re.I) and len(txt) < 300:
            print('   ', txt)

print('\n### BASE : un médicament bovin complet (EPRINEX ou IVOMEC) ###')
for ev, el in ET.iterparse(base, events=('end',)):
    if short(el.tag) != 'medicinal-product':
        continue
    nom = el.findtext('nom') or ''
    if re.search(r'EPRINEX|IVOMEC', nom):
        for sub in el.iter():
            t = (sub.text or '').strip()
            if t:
                print(f'  {short(sub.tag)} = {t[:700]}')
        break
    el.clear()
