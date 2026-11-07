# GeneTrack

Application web (PWA) de gestion d'un troupeau de Blonde d'Aquitaine. Gratuite, sans serveur : **les données restent dans le navigateur de chaque appareil** (IndexedDB) et fonctionnent hors ligne. Cahier des charges : [`docs/CAHIER_DES_CHARGES.md`](docs/CAHIER_DES_CHARGES.md).

## Fonctions de la V1
Animaux (fiche, recherche, arbre généalogique cliquable : grands-parents, parents, produits), saillies/IA avec alerte de consanguinité, diagnostics, vêlages (création automatique du veau lié à ses parents), chaleurs observées et prévues (cycle de 21 jours), soins avec délais d'attente et rappels, ventes/sorties (une ou plusieurs bêtes à la fois), tableau de bord et alertes, export/import JSON, export CSV, export calendrier `.ics`, mot de passe unique.

Ajouts : filtres avancés des animaux ; base officielle des médicaments bovins (posologies, temps d'attente, calcul de dose indicatif) ; **registre des traitements** imprimable / PDF (Réglages) ; **bilan de reproduction** par campagne avec vaches à surveiller (Reproduction → Bilan).

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

## Synchronisation entre appareils (gratuit)
Sans configuration, chaque appareil garde ses propres données. Pour que téléphone, PC et autres appareils partagent le même troupeau en temps réel, l'app utilise **Firebase** (offre gratuite *Spark*, sans carte bancaire ; largement suffisante pour quelques centaines d'animaux). L'app reste utilisable hors ligne : les saisies partent dès le retour du réseau.

1. Sur [console.firebase.google.com](https://console.firebase.google.com) : **Ajouter un projet** (ex. `genetrack`, Google Analytics inutile).
2. **Authentication** → *Commencer* → *Méthode de connexion* → **Adresse e-mail/Mot de passe** → Activer.
3. **Firestore Database** → *Créer une base de données* → emplacement en Europe (ex. `europe-west9`, Paris) → mode production. Onglet **Règles** : collez le contenu de [`firestore.rules`](firestore.rules) puis *Publier*.
4. ⚙ *Paramètres du projet* → *Vos applications* → icône **Web `</>`** → nom `GeneTrack` → copiez le bloc `firebaseConfig` affiché (ces valeurs ne sont pas secrètes).
5. Sur GitHub : *Settings* → *Secrets and variables* → *Actions* → onglet **Variables** → *New repository variable* : nom `FIREBASE_CONFIG`, valeur = le bloc copié.
6. *Actions* → **Publier GeneTrack** → *Run workflow*. Une minute plus tard, l'app affiche un écran de connexion.
7. Sur le premier appareil (celui qui contient déjà vos données) : **Créer le compte**. Les données existantes sont envoyées. Sur les autres appareils : **Se connecter** avec le même e-mail et mot de passe.
8. Conseillé, une fois le compte créé : *Authentication* → *Paramètres* → *Actions utilisateur* → décochez la création de comptes, pour que personne d'autre ne puisse en créer.

Chaque compte ne voit que son propre troupeau (`herds/{uid}`), garanti par les règles Firestore.

## Alertes par e-mail (gratuit)
Une tâche GitHub planifiée ([`alertes.yml`](.github/workflows/alertes.yml)) lit chaque matin les données synchronisées et envoie un e-mail s'il y a un événement proche :

| Événement | E-mail envoyé |
|---|---|
| Vêlage prévu | 7 jours et 2 jours avant |
| Chaleurs prévues / retour possible après saillie | 2 jours avant |
| Diagnostic de gestation (saillie + 60 j) | 3 jours avant |
| Rappel de soin | 3 jours avant |

Les délais sont réglables dans `DELAIS_ALERTE` ([`src/logic.ts`](src/logic.ts)). Rien n'est envoyé les jours sans événement. Nécessite la synchronisation ci-dessus.

1. Firebase : ⚙ *Paramètres du projet* → **Comptes de service** → *Générer une nouvelle clé privée* (fichier JSON).
2. Gmail : activez la *validation en deux étapes*, puis créez un **mot de passe d'application** sur [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) (nom : `GeneTrack`).
3. Sur GitHub : *Settings* → *Secrets and variables* → *Actions* → onglet **Secrets** → *New repository secret*, trois fois :
   - `FIREBASE_SERVICE_ACCOUNT` : tout le contenu du fichier JSON (supprimez ensuite le fichier de votre ordinateur) ;
   - `GMAIL_USER` : votre adresse Gmail ;
   - `GMAIL_APP_PASSWORD` : le mot de passe d'application (16 lettres).
   - Facultatif : `ALERT_EMAIL_TO` pour d'autres destinataires, séparés par des virgules (par défaut : `GMAIL_USER`).
4. Test : *Actions* → **Alertes e-mail GeneTrack** → *Run workflow*.

Si vous avez modifié la durée de gestation dans l'app, reportez-la dans une variable `GESTATION_JOURS`. Sur un dépôt public, GitHub suspend les tâches planifiées après 60 jours sans activité sur le dépôt et prévient par e-mail : un clic les réactive.

Essai local, sans envoi, à partir d'une sauvegarde exportée :
```bash
npx tsx scripts/alertes.ts --file genetrack-2026-11-05.json --date 2026-11-20 --dry-run
```

## Calendrier
Réglages → *Exporter le calendrier (.ics)* : à importer dans Google Calendar / Calendrier iPhone. Ré-exportez après de nouvelles saisies.
