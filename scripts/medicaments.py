"""
Construit public/medicaments.json à partir de la base publique des médicaments vétérinaires de l'ANMV (Anses) :
https://www.data.gouv.fr/datasets/5549ff78c751df34c0190c78/ (fichiers https://pro.anses.fr/RCP/amm-vet-fr-v2-v.7z).

Garde les médicaments autorisés pour les bovins, avec pour chacun : posologie, temps d'attente, indications,
contre-indications (textes du RCP officiel), forme, substances actives, voies, lien vers le RCP.

Usage : python3 scripts/medicaments.py <amm-vet-fr-v2-d.xml> <amm-vet-fr-v2-v.xml> <sortie.json>
"""
import collections
import json
import re
import sys
import xml.etree.ElementTree as ET


def short(tag):
    return tag.split('}')[-1]


def texte(s):
    """Les RCP contiennent des « \\n » littéraux : on les convertit en vrais retours à la ligne."""
    s = (s or '').replace('\\n', '\n').replace('\r', '')
    s = re.sub(r'[ \t]+\n', '\n', s)
    s = re.sub(r'\n{3,}', '\n\n', s)
    return s.strip()


def coupe(s, n):
    return s if len(s) <= n else s[:n].rsplit(' ', 1)[0] + '…'


def charger_references(path):
    """Tables de codes : {table: {code: libellé}}."""
    refs = {}
    for table in ET.parse(path).getroot():
        d = {}
        for entry in table:
            code = entry.findtext('source-code')
            if code is not None:
                d[code.strip()] = (entry.findtext('source-desc') or '').strip()
        refs[short(table.tag)] = d
    return refs


def est_bovin(libelle):
    l = libelle.lower()
    if 'exception' in l and 'bovin' in l:
        return False
    return 'bovin' in l or 'cattle' in l or l in (
        "toutes les espèces productrices d'aliments",
        "toutes les espèces de mammifères productrices d'aliments",
        "toutes les espèces de mammifères productrices d'aliments et les poissons",
    )


STATUTS_EXCLUS = re.compile(r'abrog|retir|suspen|caduc|refus|instruction|annul|expir', re.I)


def rubrique(titre):
    t = titre.lower()
    if 'posologie' in t:
        return 'posologie'
    if "temps d'attente" in t or 'temps d’attente' in t:
        return 'attenteTexte'
    if 'espèces cibles' in t and 'indication' not in t and 'précaution' not in t and 'mise' not in t:
        return 'especes'
    if t.startswith(('4.2', '3.2')) and 'indication' in t:
        return 'indications'
    if 'contre-indication' in t:
        return 'contreIndications'
    return None


def pluriel(n, mot):
    try:
        v = float(n.replace(',', '.'))
    except ValueError:
        return f'{n} {mot}'
    if v == 0:
        return f'Zéro {mot}'
    return f'{n} {mot}{"s" if v > 1 and not mot.endswith("s") else ""}'


def construire(ref_path, base_path):
    refs = charger_references(ref_path)
    lib = lambda table, code: refs.get(table, {}).get((code or '').strip(), '')
    date = ''
    items = []
    stats = collections.Counter()
    for ev, el in ET.iterparse(base_path, events=('end',)):
        tag = short(el.tag)
        if tag == 'date-jeu-de-donnees':
            date = (el.text or '').strip()
        if tag != 'medicinal-product':
            continue
        stats['total'] += 1
        statut = lib('term-stat-auto', el.findtext('term-stat-auto'))
        stats['statut: ' + statut] += 1

        paras = {}
        for p in el.iter('para-rcp'):
            r = rubrique(lib('term-titre', p.findtext('term-titre')))
            c = texte(p.findtext('contenu'))
            if r and c and r not in paras:
                paras[r] = c

        voies, attente, bovin = [], [], False
        for va in el.iter('voie-admin'):
            esp = lib('term-esp', va.findtext('term-esp'))
            if not est_bovin(esp):
                continue
            bovin = True
            voie = lib('term-va', va.findtext('term-va'))
            if voie and voie not in voies:
                voies.append(voie)
            denree = lib('term-denr', va.findtext('term-denr'))
            qte = (va.findtext('qte-ta') or '').strip()
            unite = lib('term-unite', va.findtext('term-unite'))
            comm = texte(va.findtext('commentaire'))
            if denree and (qte or comm):
                valeur = pluriel(qte, unite or 'jour') if qte else comm
                t = {'denree': denree[:1].upper() + denree[1:], 'valeur': valeur, 'voie': voie}
                if t not in attente:
                    attente.append(t)
        if not bovin and re.search(r'\bbovin', paras.get('especes', ''), re.I):
            bovin = True
        if not bovin:
            el.clear()
            continue
        stats['bovins'] += 1
        if STATUTS_EXCLUS.search(statut):
            stats['bovins exclus (statut)'] += 1
            el.clear()
            continue

        substances = []
        for sa in el.iter('sa'):
            n = lib('term-sa', sa.findtext('term-sa'))
            if n and n not in substances:
                substances.append(n)
        lien = (el.findtext('lien-rcp') or '').strip().replace('http://', 'https://')
        items.append({
            'id': (el.findtext('src-id') or el.findtext('num') or '').strip(),
            'nom': (el.findtext('nom') or '').strip(),
            'amm': (el.findtext('num-amm') or '').strip(),
            'maj': (el.findtext('maj-rcp') or '').strip(),
            'lien': lien,
            'forme': lib('term-fp', el.findtext('term-fp')),
            'titulaire': lib('term-tit', el.findtext('term-tit')),
            'substances': substances,
            'voies': voies,
            'attente': attente,
            'attenteTexte': paras.get('attenteTexte', ''),
            'especes': coupe(paras.get('especes', ''), 300),
            'posologie': paras.get('posologie', ''),
            'indications': coupe(paras.get('indications', ''), 900),
            'contreIndications': coupe(paras.get('contreIndications', ''), 900),
        })
        if items[-1]['posologie']:
            stats['avec posologie'] += 1
        el.clear()

    items.sort(key=lambda m: m['nom'])
    base = {
        'date': date,
        'source': "Base publique des médicaments vétérinaires autorisés en France — ANMV (Anses), licence ouverte",
        'items': items,
    }
    return base, stats


if __name__ == '__main__':
    ref, src, out = sys.argv[1:4]
    base, stats = construire(ref, src)
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(base, f, ensure_ascii=False, separators=(',', ':'))
    for k, v in sorted(stats.items()):
        print(f'{k}: {v}')
    print(f'{len(base["items"])} médicaments bovins écrits dans {out} (jeu de données du {base["date"]})')
    if len(base['items']) < 50:
        sys.exit('Trop peu de médicaments : format inattendu, arrêt.')
