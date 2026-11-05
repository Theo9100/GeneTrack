# GeneTrack

Application web (PWA) de gestion d'un troupeau de Blonde d'Aquitaine. Gratuite, sans serveur : **les données restent dans le navigateur de chaque appareil** (IndexedDB) et fonctionnent hors ligne. Cahier des charges : [`docs/CAHIER_DES_CHARGES.md`](docs/CAHIER_DES_CHARGES.md).

## Fonctions de la V1
Animaux (fiche, recherche, généalogie sur 3 générations), saillies/IA avec alerte de consanguinité, diagnostics, vêlages (création automatique du veau lié à ses parents), soins avec délais d'attente et rappels, ventes/sorties (une ou plusieurs bêtes à la fois), tableau de bord et alertes, export/import JSON, export CSV, export calendrier `.ics`, mot de passe unique.

## Lancer en local (PC)
```bash
npm install
npm run dev        # développement
npm run build && npm run preview   # version de production sur http://localhost:4173
npm test           # tests unitaires
```

## Utiliser sur téléphone
Le service worker (mode hors ligne et installation) exige HTTPS. Publiez le dossier `dist/` sur un hébergeur statique gratuit ; le workflow `.github/workflows/pages.yml` le fait sur GitHub Pages à chaque push sur `main` (Settings → Pages → Source : GitHub Actions). Ouvrez ensuite l'adresse sur le téléphone, puis :
- **iPhone (Safari)** : Partager → « Sur l'écran d'accueil ». Indispensable : iOS peut effacer les données d'un site non installé.
- **Android (Chrome)** : menu → « Installer l'application ».

Seul le code est publié ; vos données ne quittent jamais l'appareil.

## Sauvegardes et PC ↔ téléphone
Chaque appareil a sa propre base. Réglages → *Exporter une sauvegarde* produit un `.json` ; *Importer* en mode **Fusionner** garde la fiche la plus récente (les suppressions ne sont pas propagées) ou **Remplacer tout**. L'app rappelle de sauvegarder après 14 jours.

## Alertes
Réglages → *Exporter le calendrier (.ics)* : à importer dans Google Calendar / Calendrier iPhone, qui préviennent par notification ou e-mail. Ré-exportez après de nouvelles saisies.
