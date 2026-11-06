import os, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))
from medicaments import construire

F = os.path.join(os.path.dirname(__file__), 'fixtures')


class Import(unittest.TestCase):
    def setUp(self):
        self.base, self.stats = construire(os.path.join(F, 'anmv-d.xml'), os.path.join(F, 'anmv-v.xml'))
        self.par_nom = {m['nom']: m for m in self.base['items']}

    def test_garde_seulement_les_bovins_autorises(self):
        self.assertEqual(sorted(self.par_nom), ['IVOMEC SOLUTION INJECTABLE POUR BOVINS', 'VACCIN SANS VOIE RENSEIGNEE'])
        self.assertEqual(self.base['date'], '2026-11-05T10:22:08')

    def test_fiche_ivomec(self):
        m = self.par_nom['IVOMEC SOLUTION INJECTABLE POUR BOVINS']
        self.assertIn("0,2 mg d'ivermectine par kg", m['posologie'])
        self.assertEqual(m['substances'], ['Ivermectine'])
        self.assertEqual(m['voies'], ['Sous-cutanée'])
        self.assertEqual(m['forme'], 'Solution injectable')
        self.assertEqual(m['attente'][0], {'denree': 'Viande et abats', 'valeur': '49 jours', 'voie': 'Sous-cutanée'})
        self.assertTrue(m['attente'][1]['valeur'].startswith('Ne pas utiliser'))
        self.assertIn('\n Lait', m['attenteTexte'])
        self.assertTrue(m['lien'].startswith('https://www.ircp.anmv.anses.fr/'))

    def test_ancien_format_de_rcp(self):
        self.assertEqual(self.par_nom['VACCIN SANS VOIE RENSEIGNEE']['posologie'], '2 mL par animal.')


if __name__ == '__main__':
    unittest.main()
